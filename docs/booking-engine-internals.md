# How the Booking Engine Prevents Double-Booking — Internals

> A ground-up explanation of *exactly* what happens, from "two people click Book at
> the same instant" down to what PostgreSQL does internally to let only one win.
> Read top to bottom; each section builds on the previous one. No prior knowledge
> of indexes, locks, or constraints is assumed.

---

## Table of contents

1. [The one problem we are solving](#1-the-one-problem-we-are-solving)
2. [Four building blocks, in plain language](#2-four-building-blocks-in-plain-language)
3. [The naive solution and its hidden bug](#3-the-naive-solution-and-its-hidden-bug)
4. [How databases stop races in general: transactions + locks](#4-how-databases-stop-races-in-general-transactions--locks)
5. [What an index really is (and the two kinds we care about)](#5-what-an-index-really-is)
6. [The three ways to enforce "no overlap"](#6-the-three-ways-to-enforce-no-overlap)
7. [The EXCLUDE constraint, internally](#7-the-exclude-constraint-internally)
8. [Why the `btree_gist` extension is required](#8-why-the-btree_gist-extension-is-required)
9. [Step-by-step: two concurrent bookings, instruction by instruction](#9-step-by-step-two-concurrent-bookings)
10. [The application layers on top](#10-the-application-layers-on-top)
11. [Alternatives compared](#11-alternatives-compared)
12. [Glossary](#12-glossary)

---

## 1. The one problem we are solving

Two customers click **"Book car #7 for Jun 21–24"** at almost the same instant.
The system must let **exactly one** succeed and reject the other. Nothing more.

Everything in this document is about *how to guarantee that* even when requests
arrive at the same millisecond, possibly on different servers.

---

## 2. Four building blocks, in plain language

| Term | Everyday analogy | What it really is |
|------|------------------|-------------------|
| **Table** | a spreadsheet | `booking` — one row per reservation (car, dates, who, status) |
| **Transaction** | "all-or-nothing" checkout at a shop | a group of statements that either *all* commit or *all* roll back |
| **Index** | the A–Z dividers in a filing cabinet | a side structure that lets the DB find/relate rows fast, instead of scanning every row |
| **Lock** | the "occupied" sign on a toilet door | a temporary marker that makes a second writer *wait* for the first |
| **Constraint** | a rule the sheet refuses to break | e.g. "no two rows with the same email"; we want "no two overlapping bookings per car" |

You never operate indexes or locks by hand — the database creates and uses them
for you. You just declare the *rule* (constraint); the DB figures out the rest.

---

## 3. The naive solution and its hidden bug

The obvious code:

```
1. SELECT — is there any booking for car 7 overlapping Jun 21–24?
2. if none → INSERT the new booking
```

This is correct **only when requests are spread out in time**. Under simultaneous
clicks it breaks, because step 1 and step 2 are two separate trips to the database:

```
time ─────────────────────────────────────────────────────────▶
A: SELECT "free?" → "free"
B:        SELECT "free?" → "free"        (B checks before A has inserted)
A:                 INSERT ✅
B:                         INSERT ✅      ← DOUBLE BOOKING
```

The window between **check** (time-of-check) and **insert** (time-of-use) is the
bug. It is called a **TOCTOU race** (time-of-check to time-of-use). The whole
engine is about closing that window so it cannot be exploited — by accident or
by load.

---

## 4. How databases stop races in general: transactions + locks

Two ideas do the heavy lifting.

### Transactions (atomicity + isolation)
A transaction is a bubble: statements inside it are invisible to others until it
**commits**, and if it **rolls back**, it's as if nothing happened. This is the
"A" (atomic) and "I" (isolation) in **ACID**. Crucially, a half-finished booking
is never visible to another transaction.

### Locks (serialize the dangerous bit)
When two transactions want to modify the *same thing*, the database makes one
**wait** until the other finishes. That waiting is what turns "both happen at
once" into "one happens, then the other re-evaluates." A lock is just a marker
the DB places and others must respect.

The trick of the booking engine is to make the **check-and-insert a single
indivisible operation guarded by a lock**, so there is no gap for a second
transaction to slip into.

---

## 5. What an index really is

A table is just rows on disk. To answer "is there a booking for car 7 that
overlaps these dates?" the database could read **every** row and compare — slow,
and worse, it gives no natural place to put a lock that blocks a *future*
conflicting insert. An **index** solves both: it's a sorted/organized structure
that (a) finds matching rows quickly and (b) gives the DB a precise spot to lock.

There are several **kinds** of index, each good at different questions:

| Index type | Analogy | Answers questions like |
|------------|---------|------------------------|
| **B-tree** | a sorted phone book | `x = 5`, `x < 10`, `x BETWEEN a AND b` (ordered/equality) |
| **GiST** | a map divided into nested bounding boxes | `does this shape/range OVERLAP that one?` (`&&`), `contains?` |

Why two kinds matter here:
- "same car" is an **equality** question → natural for **B-tree**.
- "overlapping dates" is an **overlap** question → B-tree *cannot* do this; you
  need **GiST**.

Hold this thought — it's the reason the extension exists (§8).

### What does "a range" mean?
Instead of storing a start and end as two loose values, Postgres has a real
**range type**. For timestamps it's `tstzrange`:

```
tstzrange('Jun 21 10:00', 'Jun 24 10:00', '[)')
```

- `[` = start is **included**
- `)` = end is **excluded**

So `[Jun21 10:00, Jun24 10:00)` covers every instant from Jun21 10:00 up to *but
not including* Jun24 10:00. The **overlap operator `&&`** asks: *do two ranges
share any instant?*

```
[10:00, 12:00) && [11:00, 13:00)  →  true   (they share 11:00–12:00)
[10:00, 12:00) && [12:00, 14:00)  →  false  (12:00 belongs only to the 2nd → back-to-back is OK)
```

That `false` is why a car returned at 12:00 can be re-rented from 12:00 — the
`[)` bounds make the boundary belong to exactly one booking.

---

## 6. The three ways to enforce "no overlap"

| | How it works | Pros | Cons |
|---|---|---|---|
| **A. Check in app code** | `SELECT` then `INSERT` in Java | simplest to read | **TOCTOU race** under concurrency (§3); only safe for a toy |
| **B. One row per day + `UNIQUE`** | store `(car, day)` rows; a plain unique rule blocks a duplicate day | uses only a normal `UNIQUE` constraint (no extension); easy to reason about | whole-day granularity only; a 30-day booking = 30 rows |
| **C. One row per booking + `EXCLUDE` range rule** | store the range; DB rejects overlapping ranges for the same car | one row per booking; any precision (minutes); how real hotel/flight systems work | needs the `EXCLUDE` constraint + the `btree_gist` extension |

This project uses **C** because preventing the race *at the database level* with
ranges is the most instructive and most production-realistic. The rest of this
doc explains C's internals. (B is a perfectly valid simpler choice and needs none
of §7–§8.)

---

## 7. The EXCLUDE constraint, internally

The rule we add to the `booking` table:

```sql
EXCLUDE USING gist (
    car_id WITH =,                               -- (1) same car?
    tstzrange(start_ts, end_ts, '[)') WITH &&    -- (2) overlapping range?
) WHERE (status IN ('PENDING','CONFIRMED','ACTIVE'))   -- (3) only active bookings count
```

### What it means
"There must never exist two rows where **(1) the car ids are equal** AND **(2)
their time ranges overlap**, among rows that **(3) are still active**."

`EXCLUDE` is the generalized form of `UNIQUE`:
- `UNIQUE (email)` = "no two rows where `email = email`."
- `EXCLUDE` lets the comparison be **any operator**, here `=` *and* `&&` together.

### How it is enforced internally
The constraint is **backed by a single index** (a GiST index, because of the `&&`
part). On every `INSERT`/`UPDATE` of a matching row, PostgreSQL runs an internal
routine (`check_exclusion_constraint`) that:

1. Takes the new row's values: `(car_id=7, range=[Jun21,Jun24))`.
2. **Searches the GiST index** for any *existing* row that satisfies **all** the
   operator conditions simultaneously — i.e. same `car_id` **and** overlapping
   range, within the `WHERE` predicate.
3. If it finds a **committed** conflicting row → it raises
   `ERROR: conflicting key value violates exclusion constraint`
   (SQLSTATE **`23P01`**) and the insert fails.
4. If it finds a conflicting row from a **concurrent, not-yet-committed**
   transaction → it cannot decide yet, so it **waits** for that other
   transaction to finish (it sleeps on that transaction's id), then **re-checks**:
   - the other committed → conflict stands → this insert fails with `23P01`;
   - the other rolled back → no conflict → this insert proceeds.

Step 4 is the magic that defeats the TOCTOU race: the "check" and the "insert"
happen **inside one indivisible index operation**, and any competitor is forced to
wait and re-evaluate. There is no gap to exploit. (This is the same mechanism a
`UNIQUE` index uses to stop two equal keys; `EXCLUDE` generalizes it to `&&`.)

### The partial `WHERE` (3)
Only rows with `status IN ('PENDING','CONFIRMED','ACTIVE')` are indexed by the
constraint. A `CANCELLED`/`EXPIRED`/`COMPLETED` booking is **not** in the index,
so it neither blocks nor is checked — the car's slot is freed the instant a
booking leaves an active state.

---

## 8. Why the `btree_gist` extension is required

This is the part that looks like magic but is simple once you see the layers.

### The chain of forced choices
1. We need the **overlap** test `&&`. Only a **GiST** index can do `&&`.
   → the exclusion index **must be GiST**.
2. An exclusion constraint checks **all its conditions in one index**. So the
   `car_id = ?` test must *also* live inside that **same GiST index**.
3. But **GiST does not know how to do plain equality (`=`) on an integer** out of
   the box. Equality on scalars is B-tree's job; GiST was built for shapes/ranges.

So we hit a wall: the index has to be GiST (for `&&`), but GiST can't do the `=`
on `car_id`. That's the exact error you get without the extension:

```
ERROR: data type integer has no default operator class for access method "gist"
```

### What "operator class" means
An **operator class** is the adapter that teaches an index type how to handle a
specific data type and which operators it supports.
- B-tree ships with `int8_ops` → it can do `=`, `<`, `>` on `bigint`.
- GiST ships with `range_ops` → it can do `&&` on ranges.
- GiST does **not** ship with an equality operator class for `bigint`.

### What the extension adds
`CREATE EXTENSION btree_gist;` installs **GiST operator classes for scalar types**
(`gist_int8_ops`, `gist_timestamptz_ops`, `gist_uuid_ops`, `gist_text_ops`, …)
that replicate B-tree's `=`, `<`, `>` *inside* a GiST index.

Now a **single GiST index can mix**:
- `car_id WITH =`  (via the new `gist_int8_ops`), and
- `range WITH &&`  (via the built-in range opclass)

— which is precisely what the multi-column exclusion constraint needs.

> Mechanically, GiST is an extensible framework: a type "plugs in" by providing
> support functions (`consistent`, `union`, `penalty`, `picksplit`, `same`).
> `btree_gist` implements these for scalar types so, inside a GiST tree, an integer
> behaves like it would in a B-tree, enabling equality lookups GiST otherwise lacks.

### Is it risky?
No. `CREATE EXTENSION btree_gist` is a **one-line, built-in PostgreSQL module**
(it ships with every standard install, including our `postgis/postgis` image). It
only *adds* capability; it changes nothing else. We run it once, inside a Flyway
migration, so it's versioned and reproducible.

### One-line answer
> The overlap test forces the index to be **GiST**; GiST can't do scalar
> **equality** by itself; `btree_gist` adds that ability so `car_id =` and
> `range &&` can live in the **one** GiST index an exclusion constraint requires.

---

## 9. Step-by-step: two concurrent bookings

Two transactions try to book **car 7** for **overlapping** dates at the same time.

```
                 Transaction A                         Transaction B
t0   BEGIN                                   BEGIN
t1   INSERT booking(car7, Jun21–24)
       → check_exclusion_constraint:
         scan GiST index for conflicts
         → none committed → insert tentatively
t2                                           INSERT booking(car7, Jun22–25)
                                               → check_exclusion_constraint:
                                                 scan GiST index
                                                 → finds A's tentative row (same
                                                   car, overlapping range) but A
                                                   is NOT committed yet
                                                 → must WAIT for A  (sleeps on A's txid)
t3   COMMIT  ✅  (A's row is now permanent)
t4                                           ← B wakes up, RE-CHECKS:
                                               A committed → real conflict
                                               → ERROR 23P01 exclusion_violation
                                               → B's transaction fails / rolls back
```

Result: **A is booked, B is cleanly rejected.** Note what made it safe:
- B could not "miss" A's row, because the index check happens *as part of* the
  insert, not as a separate earlier SELECT.
- B was *forced to wait* for A's outcome rather than guessing.
- If A had rolled back at t3 instead, B would have woken up, found no conflict,
  and succeeded. Exactly one always wins.

Scale this to 50 simultaneous transactions: they line up on the index, the first
to commit wins, the other 49 re-check and get `23P01`. The 50-thread test in

In the app, `23P01` surfaces to Spring as `DataIntegrityViolationException`, which
the booking service catches and turns into a friendly **409 "just got booked,
pick another slot."**

---

## 10. The application layers on top

The database constraint *guarantees correctness*. Three application-level
mechanisms make the experience good and efficient — they do **not** replace the
constraint; they sit above it.

| Layer | Purpose | Task |
|-------|---------|------|
| **Pending hold + expiry** | Insert a `PENDING` booking with `expires_at = now+10min` to reserve the car *during checkout*; a scheduled job frees stale holds | #15, #30 |
| **Pessimistic lock** (`SELECT … FOR UPDATE`) | Serialize bookings for one hot car so they queue instead of erroring; good under high contention | #16 |
| **Optimistic lock** (`@Version`) | No lock; detect a concurrent change and retry; better under low contention | #17 |
| **Idempotency key** | A retried/double-clicked request returns the *same* booking instead of attempting a second | #18 |

Think of it as: the **constraint is the seatbelt** (always there, guarantees
safety); the locks and holds are **good driving** (avoid collisions in the first
place, handle them gracefully).

---

## 11. Alternatives compared

| Approach | Race-safe? | Needs extension? | Granularity | Rows per booking | Verdict |
|----------|-----------|------------------|-------------|------------------|---------|
| App `SELECT`+`INSERT` only | ❌ (TOCTOU) | no | any | 1 | toy only |
| App lock (`synchronized`) | ⚠️ one server only | no | any | 1 | breaks with 2+ servers |
| One row per day + `UNIQUE` | ✅ | **no** | whole day | N days | great simple choice |
| **Range + `EXCLUDE`** (this project) | ✅ | yes (`btree_gist`) | any (minutes) | 1 | production-grade |
| Distributed lock (Redis) | ✅ | n/a | any | 1 | adds infra; still want DB rule as backstop |

The guiding principle: **push the hard correctness guarantee down to the lowest,
most reliable layer (the database)** and treat application code as optimization
and UX, not as the thing correctness depends on.

---

## 12. Glossary

- **TOCTOU race** — time-of-check-to-time-of-use; the gap between checking
  "is it free?" and acting "insert it," where a competitor can slip in.
- **Transaction** — an all-or-nothing group of statements; invisible to others
  until commit.
- **Index** — a side structure for fast lookups *and* a precise place to lock.
- **B-tree index** — sorted; good at equality and ordering (`=`, `<`, `>`).
- **GiST index** — "generalized search tree"; good at overlap/containment (`&&`,
  `@>`) for ranges and geometry.
- **Range type / `tstzrange`** — a first-class start–end value; `[)` = start
  included, end excluded.
- **`&&`** — the overlap operator: true if two ranges share any point.
- **Operator class** — the adapter telling an index type how to handle a data
  type and which operators it supports.
- **`EXCLUDE` constraint** — generalized `UNIQUE`; forbids two rows related by
  given operators (here `=` on car and `&&` on range).
- **`btree_gist`** — built-in extension adding scalar operator classes to GiST so
  equality (`=`) and overlap (`&&`) can share one GiST index.
- **`23P01`** — PostgreSQL error code for `exclusion_violation`; becomes
  `DataIntegrityViolationException` in Spring.
- **Pessimistic / optimistic locking** — wait-on-a-lock vs detect-and-retry
  strategies for concurrent updates.
- **Idempotency key** — a client-supplied id so a repeated request yields the
  same result instead of a duplicate.
