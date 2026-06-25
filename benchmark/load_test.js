import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
    stages: [
        { duration: '5s', target: 50 },  // Ramp up to 50 users
        { duration: '15s', target: 50 }, // Stay at 50 users for 15s
        { duration: '5s', target: 200 }, // Peak at 200 users
        { duration: '10s', target: 200 },// Stay at 200 users for 10s
        { duration: '5s', target: 0 },   // Ramp down to 0
    ],
};

export default function () {
    // 1. Through NGINX Gateway
    let res = http.get('http://localhost:3000/api/v1/shorten/perf-test');
    check(res, {
        'Gateway status is 200': (r) => r.status === 200,
        'Gateway returns correct URL': (r) => JSON.parse(r.body).data === 'https://github.com/CBGQuocDai/ShortenUrl',
    });

    sleep(0.1); // Small delay
}
