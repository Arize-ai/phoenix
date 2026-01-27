# Error Analysis

Review traces to discover failure modes before building evaluators.

## Process

1. **Sample** - 100+ traces (errors, negative feedback, random)
2. **Open Code** - Write free-form notes per trace
3. **Axial Code** - Group notes into failure categories
4. **Quantify** - Count failures per category
5. **Prioritize** - Rank by frequency × severity

## Sample Traces

```python
from phoenix.client import Client

client = Client()
spans_df = client.spans.get_spans_dataframe(project_name="my-app")

# Build representative sample
sample = pd.concat([
    spans_df[spans_df["status_code"] == "ERROR"].sample(30),
    spans_df[spans_df["feedback"] == "negative"].sample(30),
    spans_df.sample(40),
]).drop_duplicates("span_id").head(100)
```

## Add Notes (Python)

```python
client.spans.add_span_note(
    span_id="abc123",
    note="wrong timezone - said 3pm EST but user is PST"
)
```

## Add Notes (TypeScript)

```typescript
import { addSpanNote } from "@arizeai/phoenix-client/spans";

await addSpanNote({
  spanNote: {
    spanId: "abc123",
    note: "wrong timezone - said 3pm EST but user is PST"
  }
});
```

## What to Note

| Type | Examples |
| ---- | -------- |
| Factual errors | Wrong dates, prices, made-up features |
| Missing info | Didn't answer question, omitted details |
| Tone issues | Too casual/formal for context |
| Tool issues | Wrong tool, wrong parameters |
| Retrieval | Wrong docs, missing relevant docs |

## Good Notes

```
BAD:  "Response is bad"
GOOD: "Response says ships in 2 days but policy is 5-7 days"
```

## Group into Categories

```python
categories = {
    "factual_inaccuracy": ["wrong shipping time", "incorrect price"],
    "hallucination": ["made up a discount", "invented feature"],
    "tone_mismatch": ["informal for enterprise client"],
}
# Priority = Frequency × Severity
```

## Saturation

Stop when new traces reveal no new failure modes. Minimum: 100 traces.
