# Load tests

The first production-capacity gate is a 10,000-concurrent-client hot-launch scenario. The bootstrap harness is intentionally dependency-free and becomes a richer production-like suite once API/indexer/realtime components exist.

It must eventually cover:
- hot launch stampede
- bot polling
- realtime fanout / slow consumers
- cache loss
- primary RPC failure and retry-storm prevention
- indexer outage/catch-up
- database pool pressure
