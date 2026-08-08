const url = process.env.BREAD_LOAD_URL;
const concurrency = Number(process.env.BREAD_LOAD_CONCURRENCY ?? '100');
const requests = Number(process.env.BREAD_LOAD_REQUESTS ?? String(concurrency));

if (!url) {
  console.log('hot-launch-load-harness: READY (set BREAD_LOAD_URL to execute)');
  console.log('target-release-concurrency: 10000');
  process.exit(0);
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 10000) throw new Error('BREAD_LOAD_CONCURRENCY must be 1..10000');
if (!Number.isInteger(requests) || requests < 1) throw new Error('BREAD_LOAD_REQUESTS must be positive');

let next = 0;
let ok = 0;
let failed = 0;
const latencies = [];

async function worker() {
  while (true) {
    const id = next++;
    if (id >= requests) return;
    const started = performance.now();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
      latencies.push(performance.now() - started);
      if (response.ok) ok += 1; else failed += 1;
      await response.arrayBuffer();
    } catch {
      latencies.push(performance.now() - started);
      failed += 1;
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, () => worker()));
latencies.sort((a, b) => a - b);
const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] ?? 0;
console.log(JSON.stringify({ url, concurrency, requests, ok, failed, errorRate: requests ? failed / requests : 0, p50Ms: percentile(0.50), p95Ms: percentile(0.95), p99Ms: percentile(0.99) }, null, 2));
if (failed / requests >= 0.01) process.exitCode = 1;
