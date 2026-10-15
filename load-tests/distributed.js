
import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate } from 'k6/metrics';

export const options = {
    vus: 1,
    duration: '30s',
    thresholds: {
        http_req_failed: ['rate<0.001'],
        http_req_duration: ['p(95)<500'],
    },
};

const GATEWAY_URLS = (
    __ENV.GATEWAY_URLS ||
    'http://host.docker.internal:8081,http://host.docker.internal:8082,http://host.docker.internal:8083'
)
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

if (GATEWAY_URLS.length === 0) {
    throw new Error('At least one gateway URL is required');
}

const gatewayRequests = GATEWAY_URLS.map(
    (_, index) => new Counter(`gateway_${index + 1}_requests`)
);

const allowedDecisions = new Rate('traffic_decision_allowed');
const rejectedDecisions = new Rate('traffic_decision_rejected');
const unknownDecisions = new Rate('traffic_decision_unknown');

export default function () {
    const gatewayIndex = (__VU + __ITER) % GATEWAY_URLS.length;
    const baseUrl = GATEWAY_URLS[gatewayIndex];

    gatewayRequests[gatewayIndex].add(1);

    const payload = JSON.stringify({
        requestId: `k6-${__VU}-${__ITER}-${Date.now()}`,
        subject: {
            subjectId: `load-test-user-${__VU}`,
            type: 'USER',
        },
        resource: '/api/orders',
        requestedAt: new Date().toISOString(),
    });

    const response = http.post(
        `${baseUrl}/api/v1/traffic/evaluate`,
        payload,
        {
            headers: { 'Content-Type': 'application/json' },
            timeout: '5s',
        }
    );

    const validHttpResponse = check(response, {
        'HTTP status is 200': (r) => r.status === 200,
    });

    let decision = 'unknown';

    if (response.status === 200 && response.body) {
        try {
            const body = JSON.parse(response.body);

            if (body.status === 'ALLOWED') {
                decision = 'allowed';
            } else if (body.status === 'REJECTED') {
                decision = 'rejected';
            }
        } catch (_) {
            decision = 'unknown';
        }
    }

    allowedDecisions.add(decision === 'allowed');
    rejectedDecisions.add(decision === 'rejected');
    unknownDecisions.add(decision === 'unknown');

    check(response, {
        'business decision is recognized': () =>
            validHttpResponse && decision !== 'unknown',
    });
}
