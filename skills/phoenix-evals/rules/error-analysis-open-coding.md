# Error Analysis: Open Coding

Free-form annotation of traces to discover failure modes.

## What Is Open Coding?

Write open-ended notes about traces without predefined categories. Focus on observations, not judgments.

## How to Do It

1. **Review trace** - Look at input, output, context
2. **Note what's wrong** - In your own words
3. **Be specific** - "Wrong timezone" not "bad response"
4. **Find root cause** - First upstream failure, not symptoms

## Example Notes

```
Trace 1: "wrong timezone - said 3pm EST but user is PST"
Trace 2: "ok"
Trace 3: "too verbose - 3 paragraphs for yes/no question"
Trace 4: "hallucinated feature we don't have"
Trace 5: "didn't use retrieved context at all"
```

## What to Note

| Type | Examples |
| ---- | -------- |
| Factual errors | Wrong dates, prices, made-up features |
| Missing info | Didn't answer question, omitted details |
| Tone issues | Too casual/formal for context |
| Tool issues | Wrong tool, wrong parameters |
| Retrieval | Wrong docs, missing relevant docs |

## Good vs Bad Notes

```
BAD:  "Response is bad"
GOOD: "Response says ships in 2 days but policy is 5-7 days"

BAD:  "Tone is wrong"
GOOD: "Used 'Hey!' for enterprise client who prefers formal"
```

## Adding Notes via API

Use the span notes API to programmatically add free-form annotations:

```python
from phoenix.client import Client

client = Client()

# Add a note to a span during review
client.spans.add_span_note(
    span_id="abc123def456",
    note="wrong timezone - said 3pm EST but user is PST"
)
```

```typescript
import { addSpanNote } from "@arizeai/phoenix-client/spans";

await addSpanNote({
  spanNote: {
    spanId: "abc123def456",
    note: "wrong timezone - said 3pm EST but user is PST"
  }
});
```

Notes are a special annotation type that allow multiple entries per span (unlike regular annotations which are unique by name).

Open coding feeds into axial coding (categorization). See [axial-coding-taxonomy](axial-coding-taxonomy.md).
