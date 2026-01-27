# Error Analysis: Process

Step-by-step guide for conducting error analysis.

## Process Overview

1. **Create Dataset** - Sample 100+ representative traces
2. **Open Coding** - Review each, write free-form notes
3. **Axial Coding** - Group notes into failure categories
4. **Quantify** - Count failures per category
5. **Prioritize** - Rank by frequency × severity
6. **Iterate** - Repeat until saturation (no new categories)

## Step 1: Sample

```python
# Build representative sample
sample = pd.concat([
    errors.sample(30),           # High priority
    negative_feedback.sample(30), # User signals
    random_sample.sample(40),     # Coverage
]).drop_duplicates("span_id").head(100)
```

Balance ~50:50 pass/fail for calibration.

## Step 2: Open Coding

For each trace, ask:
- Did it answer the question?
- Is information correct?
- Is tone appropriate?
- Anything missing or extra?

Record notes using the span notes API:

```python
from phoenix.client import Client

client = Client()

# Add free-form notes during review
client.spans.add_span_note(
    span_id=trace["span_id"],
    note="Informal greeting 'Hey!' for enterprise client"
)
```

Or track in a DataFrame for batch processing:

```python
entry["notes"] = "Informal greeting 'Hey!' for enterprise client"
entry["verdict"] = "fail"
```

## Step 3: Axial Coding

Group notes into categories:

```python
categories = {
    "persona_tone_mismatch": ["informal greeting for enterprise", ...],
    "factual_inaccuracy": ["wrong shipping time", "incorrect price"],
    "hallucination": ["made up a discount"],
}
```

## Step 4-5: Quantify & Prioritize

```python
# Count by category, then prioritize
# Priority = Frequency × Severity × Fixability
```

## Step 6: Iterate Until Saturation

Keep going until new traces reveal no new failure modes. Minimum: 100 traces.

**See Also:** [axial-coding-taxonomy](axial-coding-taxonomy.md) for building failure taxonomies.
