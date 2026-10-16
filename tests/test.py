import argparse
import json
import statistics
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from uuid import uuid4


def percentile(values, pct):
    if not values:
        return 0.0
    values = sorted(values)
    index = max(0, min(len(values) - 1, int((pct / 100) * len(values) + 0.999999) - 1))
    return values[index]


def send_one(base_url, prefix, number, timeout):
    txn_id = f"BENCH-{prefix}-{number:06d}"
    payload = {
        "id": txn_id,
        "amount": 100.0 + (number % 100),
        "currency": "INR",
        "description": "Automated API benchmark transaction",
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "metadata": {"benchmark": True, "sequence": number},
    }
    request = urllib.request.Request(
        base_url.rstrip("/") + "/api/transactions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8", errors="replace")
            elapsed_ms = (time.perf_counter() - started) * 1000
            return {"ok": response.status == 202, "status": response.status,
                    "elapsed_ms": elapsed_ms, "id": txn_id, "body": body[:250]}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return {"ok": False, "status": exc.code,
                "elapsed_ms": (time.perf_counter() - started) * 1000,
                "id": txn_id, "body": body[:250]}
    except Exception as exc:
        return {"ok": False, "status": "ERROR",
                "elapsed_ms": (time.perf_counter() - started) * 1000,
                "id": txn_id, "body": str(exc)[:250]}


def main():
    parser = argparse.ArgumentParser(description="Benchmark OpenFabric API transaction submissions")
    parser.add_argument("--url", default="http://127.0.0.1:8000", help="API base URL (default: %(default)s)")
    parser.add_argument("--total", type=int, default=200, help="number of requests (default: %(default)s)")
    parser.add_argument("--concurrency", type=int, default=10, help="parallel requests (default: %(default)s)")
    parser.add_argument("--timeout", type=float, default=10.0, help="per-request timeout seconds")
    args = parser.parse_args()
    if args.total < 1 or args.concurrency < 1:
        parser.error("--total and --concurrency must both be at least 1")

    prefix = uuid4().hex[:8]
    print("OpenFabric API benchmark")
    print(f"URL: {args.url}")
    print(f"Requests: {args.total} | Concurrency: {args.concurrency}")
    print(f"Test ID prefix: BENCH-{prefix}")
    print("This measures API submissions only, not end-to-end posting throughput.\n")

    wall_start = time.perf_counter()
    results = []
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futures = [pool.submit(send_one, args.url, prefix, i, args.timeout) for i in range(1, args.total + 1)]
        for future in as_completed(futures):
            results.append(future.result())
    elapsed = time.perf_counter() - wall_start

    latencies = [r["elapsed_ms"] for r in results]
    successes = sum(r["ok"] for r in results)
    failures = len(results) - successes
    print("=" * 48)
    print(f"Successful submissions (HTTP 202): {successes}/{args.total}")
    print(f"Failed submissions: {failures}")
    print(f"Total time: {elapsed:.2f} seconds")
    print(f"Throughput: {len(results) / elapsed:.2f} requests/second")
    print(f"Average latency: {statistics.mean(latencies):.2f} ms" if latencies else "Average latency: N/A")
    print(f"Median latency (p50): {percentile(latencies, 50):.2f} ms")
    print(f"p95 latency: {percentile(latencies, 95):.2f} ms")
    print(f"Maximum latency: {max(latencies):.2f} ms" if latencies else "Maximum latency: N/A")
    if failures:
        print("\nFirst failed requests:")
        for result in [r for r in results if not r["ok"]][:10]:
            print(f"  {result['id']}: HTTP {result['status']} — {result['body']}")
    print("\nNote: This benchmark inserts transactions into the configured database.")
    print("Use a separate/clean test database for repeated tests; do not delete your real DB.")


if __name__ == "__main__":
    main()