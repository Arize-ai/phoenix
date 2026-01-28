# Observe: Sampling Strategies (TypeScript)

How to efficiently sample production traces for review.

## Strategies

### 1. Failure-Focused (Highest Priority)

```typescript
import { getSpans } from "@arizeai/phoenix-client/spans";

const spans = await getSpans({ project: "my-project" });
const errors = spans.filter((s) => s.statusCode === "ERROR");
const negativeFeedback = spans.filter((s) => s.feedback === "negative");
```

### 2. Outliers

```typescript
const sorted = [...spans].sort((a, b) => b.responseLength - a.responseLength);
const longResponses = sorted.slice(0, 50);

const bySlowest = [...spans].sort((a, b) => b.latencyMs - a.latencyMs);
const slowResponses = bySlowest.slice(0, 50);
```

### 3. Stratified (Coverage)

```typescript
// Sample equally from each category
function stratifiedSample<T>(items: T[], groupBy: (item: T) => string, perGroup: number): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = groupBy(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return [...groups.values()].flatMap((g) => g.slice(0, perGroup));
}

const byQueryType = stratifiedSample(spans, (s) => s.metadata?.queryType ?? "unknown", 20);
```

### 4. Metric-Guided

```typescript
// Review traces flagged by automated evaluators
const flagged = spans.filter((s) => evalResults.get(s.spanId)?.label === "hallucinated");
const borderline = spans.filter((s) => {
  const score = evalResults.get(s.spanId)?.score ?? 0;
  return score > 0.3 && score < 0.7;
});
```

## Building a Review Queue

```typescript
function buildReviewQueue(spans: Span[], maxTraces = 100): Span[] {
  const errors = spans.filter((s) => s.statusCode === "ERROR");
  const negative = spans.filter((s) => s.feedback === "negative");
  const longest = [...spans].sort((a, b) => b.responseLength - a.responseLength).slice(0, 10);
  const random = shuffle(spans).slice(0, 30);

  const combined = [...errors, ...negative, ...longest, ...random];
  const unique = [...new Map(combined.map((s) => [s.spanId, s])).values()];
  return unique.slice(0, maxTraces);
}
```

## Sample Size Guidelines

| Purpose | Size |
| ------- | ---- |
| Initial exploration | 50-100 |
| Error analysis | 100+ (until saturation) |
| Golden dataset | 100-500 |
| Judge calibration | 100+ per class |

**Saturation:** Stop when new traces show the same failure patterns.
