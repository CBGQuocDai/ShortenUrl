import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const RUN_ID = (__ENV.RUN_ID || `${Date.now()}`).replace(/[^a-zA-Z0-9]/g, '').slice(-8);
const PASSWORD = __ENV.PASSWORD || 'Password1!';
const SEED_URLS = Number(__ENV.SEED_URLS || 24);
const PROFILE = __ENV.PROFILE || 'load';
const MODE = __ENV.MODE || 'mixed';
const SLEEP_SECONDS = __ENV.SLEEP === undefined ? 0.1 : Number(__ENV.SLEEP);
const RATE = Number(__ENV.RATE || 500);
const DURATION = __ENV.DURATION || '45s';
const PRE_ALLOCATED_VUS = Number(__ENV.PRE_ALLOCATED_VUS || 200);
const MAX_VUS = Number(__ENV.MAX_VUS || 1000);
const FAST_CHECK = (__ENV.FAST_CHECK || 'false').toLowerCase() === 'true';
const REQUEST_TIMEOUT = __ENV.REQUEST_TIMEOUT || '30s';

const createdUrls = new Counter('shorten_created_urls');
const authFailures = new Counter('auth_failures');
const resolveOk = new Rate('resolve_ok');
const createOk = new Rate('create_ok');
const listOk = new Rate('list_ok');
const resolveLatency = new Trend('resolve_latency', true);

export const options = profileOptions(PROFILE);

export function setup() {
  const username = (`k6${RUN_ID}`).slice(0, 20);
  registerUser(username);
  const token = login(username);
  const codes = seedShortUrls(token);

  if (codes.length === 0) {
    fail('setup failed: no short URLs were created');
  }

  return { token, codes };
}

export default function (data) {
  if (MODE === 'redirect') {
    resolveShortUrl(data.codes);
    sleep(SLEEP_SECONDS);
    return;
  }

  const roll = Math.random();

  if (roll < 0.80) {
    resolveShortUrl(data.codes);
  } else if (roll < 0.95) {
    listShortUrls(data.token);
  } else {
    createShortUrl(data.token);
  }

  sleep(SLEEP_SECONDS);
}

function registerUser(username) {
  const res = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({ username, password: PASSWORD }),
    jsonParams('auth_register')
  );

  check(res, {
    'register accepted or already exists': (r) => r.status === 200 || r.status === 400,
  });
}

function login(username) {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ username, password: PASSWORD }),
    jsonParams('auth_login')
  );

  const ok = check(res, {
    'login status is 200': (r) => r.status === 200,
    'login returns token': (r) => Boolean(r.json('data.token')),
  });

  if (!ok) {
    authFailures.add(1);
    fail(`login failed: status=${res.status} body=${res.body}`);
  }

  return res.json('data.token');
}

function seedShortUrls(token) {
  const codes = [];

  for (let i = 0; i < SEED_URLS; i += 1) {
    const code = `k6${RUN_ID}${i.toString(36)}`.slice(0, 32);
    const res = createShortUrl(token, code);

    if (res.status === 200 || res.status === 400) {
      codes.push(code);
    }
  }

  return codes;
}

function createShortUrl(token, code = '') {
  const vu = typeof __VU === 'number' ? __VU : 0;
  const iter = typeof __ITER === 'number' ? __ITER : 0;
  const suffix = `${RUN_ID}-${vu}-${iter}-${Math.random().toString(36).slice(2, 8)}`;
  const shortCode = code || `k6${suffix.replace(/-/g, '')}`.slice(0, 32);
  const payload = {
    url: `https://example.com/performance/${suffix}`,
    shorten_code: shortCode,
  };

  const res = http.post(
    `${BASE_URL}/api/v1/shorten/create`,
    JSON.stringify(payload),
    jsonParams('shorten_create', token)
  );

  const ok = check(res, {
    'create status is 200': (r) => r.status === 200,
    'create returns short code': (r) => r.status !== 200 || Boolean(r.json('data.short_code')),
  });

  createOk.add(ok);
  if (ok) {
    createdUrls.add(1);
  }

  return res;
}

function resolveShortUrl(codes) {
  const code = codes[Math.floor(Math.random() * codes.length)];
  const res = http.get(`${BASE_URL}/api/v1/shorten/${code}`, {
    tags: { name: 'shorten_resolve' },
    responseType: FAST_CHECK ? 'none' : 'text',
    timeout: REQUEST_TIMEOUT,
  });

  const ok = FAST_CHECK
    ? check(res, {
        'resolve status is 200': (r) => r.status === 200,
      })
    : check(res, {
        'resolve status is 200': (r) => r.status === 200,
        'resolve returns original url': (r) => r.status !== 200 || Boolean(r.json('data')),
      });

  resolveOk.add(ok);
  resolveLatency.add(res.timings.duration);
}

function listShortUrls(token) {
  const res = http.get(`${BASE_URL}/api/v1/shorten/list?page=1&size=20`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { name: 'shorten_list' },
    timeout: REQUEST_TIMEOUT,
  });

  const ok = check(res, {
    'list status is 200': (r) => r.status === 200,
  });

  listOk.add(ok);
}

function jsonParams(name, token = '') {
  const headers = { 'Content-Type': 'application/json' };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return { headers, tags: { name }, timeout: REQUEST_TIMEOUT };
}

function profileOptions(profile) {
  const commonThresholds = {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<750', 'p(99)<1500'],
    resolve_ok: ['rate>0.99'],
    create_ok: ['rate>0.95'],
    list_ok: ['rate>0.95'],
  };

  const profiles = {
    smoke: {
      vus: 2,
      duration: '20s',
      thresholds: commonThresholds,
    },
    load: {
      stages: [
        { duration: '20s', target: 25 },
        { duration: '1m', target: 25 },
        { duration: '20s', target: 0 },
      ],
      thresholds: commonThresholds,
    },
    stress: {
      stages: [
        { duration: '30s', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '1m', target: 200 },
        { duration: '30s', target: 0 },
      ],
      thresholds: {
        ...commonThresholds,
        http_req_failed: ['rate<0.05'],
        http_req_duration: ['p(95)<1500', 'p(99)<3000'],
      },
    },
    redirect_capacity: {
      stages: [
        { duration: '20s', target: 100 },
        { duration: '30s', target: 100 },
        { duration: '20s', target: 250 },
        { duration: '30s', target: 250 },
        { duration: '20s', target: 500 },
        { duration: '30s', target: 500 },
        { duration: '20s', target: 0 },
      ],
      thresholds: {
        http_req_failed: ['rate<0.05'],
        http_req_duration: ['p(95)<1000', 'p(99)<2500'],
        resolve_ok: ['rate>0.95'],
      },
    },
    redirect_rate: {
      scenarios: {
        redirects: {
          executor: 'constant-arrival-rate',
          rate: RATE,
          timeUnit: '1s',
          duration: DURATION,
          preAllocatedVUs: PRE_ALLOCATED_VUS,
          maxVUs: MAX_VUS,
        },
      },
      thresholds: {
        http_req_failed: ['rate<0.02'],
        http_req_duration: ['p(95)<1000', 'p(99)<2500'],
        resolve_ok: ['rate>0.98'],
      },
    },
    cloud_redirect_rate: {
      scenarios: {
        redirects: {
          executor: 'constant-arrival-rate',
          rate: RATE,
          timeUnit: '1s',
          duration: DURATION,
          preAllocatedVUs: Number(__ENV.PRE_ALLOCATED_VUS || Math.max(1000, RATE * 3)),
          maxVUs: Number(__ENV.MAX_VUS || Math.max(3000, RATE * 8)),
        },
      },
      thresholds: {
        http_req_failed: ['rate<0.02'],
        http_req_duration: ['p(95)<2000', 'p(99)<6000'],
        resolve_ok: ['rate>0.98'],
      },
    },
  };

  return profiles[profile] || profiles.load;
}
