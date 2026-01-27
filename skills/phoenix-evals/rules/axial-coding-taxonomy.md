# Axial Coding: Building Failure Taxonomies

Axial coding transforms open-ended notes into a structured failure taxonomy.

## Process

1. **Gather** - Collect open coding notes
2. **Pattern** - Group notes with common themes
3. **Name** - Create actionable category names
4. **Refine** - Adjust granularity

```
Raw Notes                    Categories
─────────                    ──────────
"wrong timezone"      ──┐
"date format wrong"   ──┼──► Timezone/Locale Issues
"said EST not PST"    ──┘
```

## Taxonomy Principles

### 1. MECE (Mutually Exclusive, Collectively Exhaustive)

Each failure fits ONE primary category.

### 2. Actionable

Categories suggest fixes:
- `"missing_safety_disclaimer"` → Add to system prompt
- `"wrong_persona_tone"` → Add persona detection

### 3. Consistent Depth

Similar granularity across branches.

## Example Taxonomy

```yaml
failure_taxonomy:
  content_quality:
    hallucination: [invented_facts, fictional_citations]
    incompleteness: [partial_answer, missing_key_info]
    inaccuracy: [wrong_numbers, wrong_dates]
  
  communication:
    tone_mismatch: [too_casual, too_formal]
    clarity: [ambiguous, jargon_heavy]
  
  context:
    user_context: [ignored_preferences, misunderstood_intent]
    retrieved_context: [ignored_documents, wrong_context]
  
  safety:
    missing_disclaimers: [legal, medical, financial]
    inappropriate: [harmful_advice, privacy_violation]
```

## Recording Categories via API

After categorizing, add structured annotations to spans:

```python
from phoenix.client import Client

client = Client()

# Add categorized annotation
client.spans.add_span_annotation(
    span_id="abc123def456",
    annotation_name="failure_category",
    label="hallucination",
    explanation="invented a feature that doesn't exist",
    annotator_kind="HUMAN",
    sync=True,
)
```

```typescript
import { addSpanAnnotation } from "@arizeai/phoenix-client/spans";

await addSpanAnnotation({
  spanAnnotation: {
    spanId: "abc123def456",
    name: "failure_category",
    label: "hallucination",
    explanation: "invented a feature that doesn't exist",
    annotatorKind: "HUMAN",
  }
});
```

## Key Principles

| Principle | Description |
| --------- | ----------- |
| Bottom-up | Let categories emerge from data |
| Actionable | Each category suggests a fix |
| Versioned | Track taxonomy evolution |
| Quantified | Count failures to prioritize |
