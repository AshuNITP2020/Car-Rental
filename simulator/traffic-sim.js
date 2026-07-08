#!/usr/bin/env node
'use strict';
/*
 * Traffic simulator bot (Task #42). A standalone API client — "just another
 * client", like the web/mobile apps — that keeps the running backend busy with
 * realistic journeys so the Prometheus/Grafana metrics (#40) and structured logs
 * (#41) have live data to show. Distinct from the k6 load test (#43): this is a
 * steady "keep it alive" bot, not a high-throughput benchmark.
 *
 * It is self-bootstrapping: it registers an agency owner, creates an agency + a
 * fleet of cars, registers some customers, then loops each customer through
 * browse -> (maybe) nearby -> book -> (sometimes) cancel. Booking conflicts (409)
 * are expected and counted — that's the double-booking guarantee working under
 * concurrent demand.
 *
 * Usage (needs the backend running, e.g. `./gradlew bootRun`):
 *   node simulator/traffic-sim.js                 # run forever (Ctrl-C to stop)
 *   SIM_ITERATIONS=20 node simulator/traffic-sim.js   # run 20 journeys then exit
 *   SIM_DURATION_MS=60000 SIM_CONCURRENCY=5 node simulator/traffic-sim.js
 *
 * Env knobs: BASE_URL, SIM_CUSTOMERS, SIM_CARS, SIM_CONCURRENCY, SIM_ITERATIONS
 * (0=∞), SIM_DURATION_MS (0=∞), SIM_DELAY_MS, SIM_CANCEL_PROB.
 */

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const CUSTOMERS = intEnv('SIM_CUSTOMERS', 5);
const CARS = intEnv('SIM_CARS', 8);
const CONCURRENCY = intEnv('SIM_CONCURRENCY', 3);
const ITERATIONS = intEnv('SIM_ITERATIONS', 0);      // 0 = unbounded
const DURATION_MS = intEnv('SIM_DURATION_MS', 0);    // 0 = unbounded
const DELAY_MS = intEnv('SIM_DELAY_MS', 400);
const CANCEL_PROB = floatEnv('SIM_CANCEL_PROB', 0.3);

const CITIES = [
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
];
const CATEGORIES = ['HATCHBACK', 'SEDAN', 'SUV', 'MPV', 'LUXURY'];

const stats = { journeys: 0, search: 0, nearby: 0, booked: 0, conflicts: 0, cancelled: 0, rateLimited: 0, errors: 0 };
let running = true;

function intEnv(k, d) { const v = process.env[k]; return v != null ? parseInt(v, 10) : d; }
function floatEnv(k, d) { const v = process.env[k]; return v != null ? parseFloat(v) : d; }
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const uuid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(method, path, { token, body, idem } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  if (idem) headers['Idempotency-Key'] = idem;
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    stats.errors++;
    return { status: 0, error: e.message };
  }
  if (res.status === 429) stats.rateLimited++;
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { status: res.status, json };
}

const ok = (r) => r.status >= 200 && r.status < 300;

async function setup() {
  const stamp = Date.now();
  const ownerEmail = `sim-owner-${stamp}@sim.local`;

  let r = await req('POST', '/api/auth/register',
    { body: { name: 'Sim Owner', email: ownerEmail, phone: '+919800000000', password: 'password123' } });
  if (!ok(r)) throw new Error(`owner register -> ${r.status}`);
  let ownerToken = r.json.accessToken;

  const home = pick(CITIES);
  r = await req('POST', '/api/agencies',
    { token: ownerToken, body: { name: `Sim Agency ${stamp}`, city: home.name, latitude: home.lat, longitude: home.lng } });
  if (!ok(r)) throw new Error(`agency create -> ${r.status}`);

  // Re-login so the fresh token carries the agencyId (needed to add cars).
  r = await req('POST', '/api/auth/login', { body: { email: ownerEmail, password: 'password123' } });
  if (!ok(r)) throw new Error(`owner re-login -> ${r.status}`);
  ownerToken = r.json.accessToken;

  const cars = [];
  for (let i = 0; i < CARS; i++) {
    const c = pick(CITIES);
    r = await req('POST', '/api/agency/cars', {
      token: ownerToken,
      body: {
        make: 'Make' + i, model: 'Model' + i, category: pick(CATEGORIES),
        regNo: `SIM-${stamp}-${i}`, pricePerDay: 1000 + Math.floor(Math.random() * 5000),
        latitude: c.lat, longitude: c.lng,
      },
    });
    if (ok(r) && r.json?.id != null) cars.push({ id: r.json.id });
  }
  if (!cars.length) throw new Error('no cars created');

  const customers = [];
  for (let i = 0; i < CUSTOMERS; i++) {
    r = await req('POST', '/api/auth/register',
      { body: { name: 'Sim Cust' + i, email: `sim-cust-${stamp}-${i}@sim.local`, phone: '+919811111111', password: 'password123' } });
    if (ok(r)) customers.push(r.json.accessToken);
  }
  if (!customers.length) throw new Error('no customers created');

  return { cars, customers };
}

async function journey(ctx) {
  const token = pick(ctx.customers);

  // Browse the catalogue.
  const cat = Math.random() < 0.6 ? pick(CATEGORIES) : null;
  await req('GET', `/api/cars/search?size=10${cat ? `&category=${cat}` : ''}`, { token });
  stats.search++;

  // Sometimes "cars near me".
  if (Math.random() < 0.4) {
    const c = pick(CITIES);
    await req('GET', `/api/cars/search/nearby?lat=${c.lat}&lng=${c.lng}&radiusKm=50`, { token });
    stats.nearby++;
  }

  // Book a random car for a random future window.
  const car = pick(ctx.cars);
  const start = new Date(Date.now() + (1 + Math.floor(Math.random() * 60)) * 86400000);
  start.setUTCHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + (1 + Math.floor(Math.random() * 3)) * 86400000);
  const b = await req('POST', '/api/bookings',
    { token, idem: uuid(), body: { carId: car.id, from: start.toISOString(), to: end.toISOString() } });

  if (ok(b)) {
    stats.booked++;
    if (Math.random() < CANCEL_PROB && b.json?.id != null) {
      const c = await req('POST', `/api/bookings/${b.json.id}/cancel`, { token });
      if (ok(c)) stats.cancelled++;
    }
  } else if (b.status === 409) {
    stats.conflicts++;   // double-booking prevented — expected under contention
  }
  stats.journeys++;
}

function printStats(prefix) {
  console.log(`${prefix}journeys=${stats.journeys} search=${stats.search} nearby=${stats.nearby} ` +
    `booked=${stats.booked} conflicts=${stats.conflicts} cancelled=${stats.cancelled} ` +
    `rateLimited=${stats.rateLimited} errors=${stats.errors}`);
}

async function worker(ctx, deadline) {
  while (running
      && (ITERATIONS === 0 || stats.journeys < ITERATIONS)
      && (DURATION_MS === 0 || Date.now() < deadline)) {
    try { await journey(ctx); } catch { stats.errors++; }
    await sleep(DELAY_MS + Math.floor(Math.random() * DELAY_MS));
  }
}

(async () => {
  console.log(`Traffic simulator -> ${BASE}  (customers=${CUSTOMERS} cars=${CARS} ` +
    `concurrency=${CONCURRENCY} iterations=${ITERATIONS || '∞'} duration=${DURATION_MS || '∞'}ms)`);
  process.on('SIGINT', () => { running = false; console.log('\nstopping…'); });

  let ctx;
  try {
    ctx = await setup();
  } catch (e) {
    console.error(`Setup failed: ${e.message} — is the backend running on ${BASE} with the DB up?`);
    process.exit(1);
  }
  console.log(`Setup done: ${ctx.cars.length} cars, ${ctx.customers.length} customers. Simulating…`);

  const deadline = DURATION_MS ? Date.now() + DURATION_MS : 0;
  const ticker = setInterval(() => printStats('… '), 5000);
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(ctx, deadline)));
  clearInterval(ticker);
  printStats('DONE ');
  process.exit(0);
})();
