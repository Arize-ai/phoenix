# Evaluators: Designing Custom Eval Prompts

Best practices for writing effective LLM-as-judge prompt templates.

## Template Structure

1. **Task description** - What you're evaluating
2. **Input variables** - Data wrapped in XML tags
3. **Criteria** - What "pass" and "fail" mean
4. **Examples** - Concrete cases for each label
5. **Edge cases** - How to handle ambiguity
6. **Output format** - Exact response structure

## Use XML Tags

Wrap data in XML tags for [clear boundaries](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/use-xml-tags):

```python
TEMPLATE = """Evaluate faithfulness.

<context>{{context}}</context>
<response>{{output}}</response>

"faithful" means ALL claims are supported by context.
"unfaithful" means ANY claim is NOT in context.

Answer (faithful/unfaithful):"""
```

## Include Examples

```python
TEMPLATE = """...

<examples>
Context: "Price is $10" → Response: "It costs $10" → faithful
Context: "Price is $10" → Response: "About $15" → unfaithful
</examples>

..."""
```

## Handle Edge Cases

```python
"""EDGE CASES:
- Empty context → "cannot_evaluate"
- "I don't know" when appropriate → faithful
- Partial faithfulness → unfaithful (strict)"""
```

## Common Mistakes

| Mistake | Fix |
| ------- | --- |
| Vague criteria | Define exactly what each label means |
| No examples | Include 2-4 concrete cases |
| Ambiguous format | Specify exact output format |
| No edge cases | Address ambiguous situations |

## Key Principles

- **Use XML tags** for data boundaries
- **Be explicit** about every criterion
- **Show examples** of each label
- **Test** with known pass/fail cases
