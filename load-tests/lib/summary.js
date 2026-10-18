// Shared k6 summary: latency percentiles, a short console summary and a JSON artifact per run.

export const SUMMARY_TREND_STATS = ['avg', 'min', 'p(50)', 'p(90)', 'p(95)', 'p(99)', 'max'];

export function createSummaryHandler(scenario, parameters) {
    return function handleSummary(data) {
        const report = buildReport(scenario, parameters, data);
        const timestamp = report.generatedAt.replace(/[:.]/g, '-');

        return {
            stdout: renderConsoleSummary(report),
            [`k6-summary-${scenario}-${timestamp}.json`]: JSON.stringify(report, null, 2),
        };
    };
}

function buildReport(scenario, parameters, data) {
    const value = (name, stat) => {
        const metric = data.metrics[name];
        return metric && metric.values[stat] !== undefined ? metric.values[stat] : null;
    };

    const thresholds = [];
    const metrics = {};

    Object.keys(data.metrics).sort().forEach((name) => {
        const metric = data.metrics[name];
        metrics[name] = metric.values;

        Object.keys(metric.thresholds || {}).forEach((expression) => {
            thresholds.push({ metric: name, expression, ok: metric.thresholds[expression].ok });
        });
    });

    return {
        scenario,
        generatedAt: new Date().toISOString(),
        parameters,
        latencyMs: {
            avg: value('http_req_duration', 'avg'),
            p50: value('http_req_duration', 'p(50)'),
            p90: value('http_req_duration', 'p(90)'),
            p95: value('http_req_duration', 'p(95)'),
            p99: value('http_req_duration', 'p(99)'),
            max: value('http_req_duration', 'max'),
        },
        requests: value('http_reqs', 'count'),
        requestsPerSecond: value('http_reqs', 'rate'),
        httpFailureRate: value('http_req_failed', 'rate'),
        checksPassRate: value('checks', 'rate'),
        thresholds,
        metrics,
    };
}

function renderConsoleSummary(report) {
    const ms = (stat) => (report.latencyMs[stat] === null ? 'n/a' : report.latencyMs[stat].toFixed(3));
    const percent = (rate) => (rate === null ? 'n/a' : `${(rate * 100).toFixed(2)}%`);

    const lines = [
        '',
        `Scenario: ${report.scenario}`,
        `Requests: ${report.requests}   Throughput: ${(report.requestsPerSecond || 0).toFixed(2)} req/s`,
        `Latency (ms): avg=${ms('avg')} p50=${ms('p50')} p90=${ms('p90')} p95=${ms('p95')} p99=${ms('p99')} max=${ms('max')}`,
        `HTTP failures: ${percent(report.httpFailureRate)}   Checks passed: ${percent(report.checksPassRate)}`,
        ...report.thresholds.map((t) => `${t.ok ? 'PASS' : 'FAIL'}  ${t.metric}: ${t.expression}`),
        '',
    ];

    return lines.join('\n');
}
