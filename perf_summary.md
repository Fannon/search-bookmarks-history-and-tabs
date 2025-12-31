# Performance Benchmark Summary

## Strategy Comparison (Micro-benchmarks)

| Scenario            | Precise (Avg) | Fuzzy (Avg) |
|---------------------|---------------|-------------|
| Warmup (210 items)  | 18.91ms       | 9.26ms      |
| Small (420 items)   | 5.76ms        | 6.79ms      |
| Medium (4200 items) | 6.96ms        | 7.53ms      |
| Big (21000 items)   | 6.96ms        | 5.55ms      |

### Core Logic Latency

```text
Precise Search ("resource-123") took: 8.78ms
Fuzzy Search ("resrc 123") took: 30.35ms
```

## Rendering & Interaction (Playwright)

```text
Playwright: Worst-case Rendering (1000 items with all badges) took: 3.20ms
Playwright: Search & Render for 5000 items took: 2.60ms
Playwright: Fuzzy Search & Render for 2000 items took: 20.00ms
```
