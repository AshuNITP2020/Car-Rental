/**
 * The user's recent trip searches, kept on this device (localStorage) — no
 * backend involved. Saved when a search is run; clicking one re-fills the
 * planner. Deduped by route + filters, newest first, capped small.
 */
export interface RecentSearch {
  pickupLabel: string
  dropLabel: string | null
  plat: number
  plng: number
  dlat: number | null
  dlng: number | null
  oneWay: boolean
  /** '' = any */
  carType: string
  /** '' = any */
  seats: string
  ts: number
}

const KEY = 'cr.recent-searches'
const MAX = 6

export function loadRecentSearches(): RecentSearch[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as RecentSearch[]) : []
    return Array.isArray(list) ? list.filter((s) => s && typeof s.plat === 'number') : []
  } catch {
    return []
  }
}

/** Two searches are "the same trip" if route + filters match (time ignored). */
function keyOf(s: Omit<RecentSearch, 'ts'>): string {
  return [s.pickupLabel, s.dropLabel, s.oneWay, s.carType, s.seats].join('|')
}

export function saveRecentSearch(search: Omit<RecentSearch, 'ts'>): RecentSearch[] {
  const entry: RecentSearch = { ...search, ts: Date.now() }
  const list = [entry, ...loadRecentSearches().filter((s) => keyOf(s) !== keyOf(search))].slice(
    0,
    MAX,
  )
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* storage full/blocked — recents just won't persist */
  }
  return list
}
