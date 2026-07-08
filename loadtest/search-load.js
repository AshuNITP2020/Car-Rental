import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

/*
 * k6 load test for the hot read path — car search (Task #43).
 *
 * Ramps virtual users against GET /api/cars/search to find where latency/errors
 * break. ~70% of requests reuse one common query (so Redis cache hits from #34
 * dominate — the "tuning" you can watch pay off), ~30% vary the filters.
 *
 * Prerequisites (see loadtest/README.md):
 *   - backend running WITH seed data and rate limiting OFF, e.g.:
 *       ./gradlew bootRun --args='--app.seed.enabled=true --app.rate-limit.enabled=false'
 *   - k6 (or `docker run --network host grafana/k6`).
 *
 * Scale the load with env vars, e.g.  VUS=1000 HOLD=3m k6 run search-load.js
 */

const BASE = __ENV.BASE_URL || 'http://localhost:8080';
const VUS = Number(__ENV.VUS || 50);
const searchErrors = new Rate('search_errors');

export const options = {
  scenarios: {
    search: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP || '20s', target: VUS },   // ramp up
        { duration: __ENV.HOLD || '40s', target: VUS },   // hold at target
        { duration: '10s', target: 0 },                    // ramp down
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],       // <1% failed requests
    http_req_duration: ['p(95)<500'],     // 95% of requests under 500ms
    search_errors: ['rate<0.01'],
  },
};

const CITIES = ['Mumbai', 'Delhi', 'Bengaluru', 'Pune', 'Hyderabad',
  'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Gurugram'];
const CATEGORIES = ['HATCHBACK', 'SEDAN', 'SUV', 'MPV', 'LUXURY'];

// Runs once: get an access token that all VUs share (search is a read, so one
// token is fine — as long as the app's per-user rate limiter is disabled).
export function setup() {
  const email = `k6-${Date.now()}@load.local`;
  const res = http.post(`${BASE}/api/auth/register`,
    JSON.stringify({ name: 'k6', email, phone: '+919800000000', password: 'password123' }),
    { headers: { 'Content-Type': 'application/json' } });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`register failed: ${res.status} ${res.body}`);
  }
  return { token: res.json('accessToken') };
}

export default function (data) {
  const params = { headers: { Authorization: `Bearer ${data.token}` } };

  let url;
  if (Math.random() < 0.7) {
    // The common, cache-friendly query.
    url = `${BASE}/api/cars/search?city=Mumbai&category=SUV&sort=price,asc&page=0&size=20`;
  } else {
    const city = CITIES[Math.floor(Math.random() * CITIES.length)];
    const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    url = `${BASE}/api/cars/search?city=${city}&category=${cat}&size=20`;
  }

  const res = http.get(url, params);
  const good = check(res, { 'status is 200': (r) => r.status === 200 });
  searchErrors.add(!good);

  sleep(0.3 + Math.random() * 0.4);   // ~0.3-0.7s think time per VU
}
