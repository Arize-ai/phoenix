# Judge prompts

A judge prompt is a rubric for one decision. Most judge errors come from a rubric
that leaves the edge cases to the model's taste.

## Structure

1. **One sentence of task.** "You are checking whether the answer is supported by the
   sources."
2. **The inputs, each in its own tag.** `<question>{{input}}</question>`,
   `<answer>{{output}}</answer>`, `<sources>{{context}}</sources>`.
3. **A definition for each label.** Say exactly what puts a record in each label, in
   terms the judge can check against the inputs.
4. **The edge cases, decided.** Refusals, partial answers, empty context, an answer
   that's right but cites nothing. Write the label each one gets as a rule, not as a
   worked example.

```text
You are checking whether a travel assistant's itinerary respects the traveler's constraints.

<constraints>{{constraints}}</constraints>
<request>{{input}}</request>
<itinerary>{{output}}</itinerary>

"respects": every booking and suggestion fits the stated budget, dates, and
accessibility needs, and the itinerary says which constraint drove any trade-off.
"violates": any item breaks a stated constraint, or a trade-off is made without
saying so.

Edge cases:
- The assistant asks for missing details and proposes nothing yet: "respects".
- The itinerary meets one constraint by silently dropping part of the request: "violates".
```

Avoid adding few-shot examples of scored records to the prompt. They tend to pull
the judge toward the surface features of those records, and when they also appear in
the data you measure the judge on, they inflate its agreement. Put what an example
was meant to teach into a definition or an edge-case rule.

## Rules

- **Choose labels with a meaning.** Two labels (`pass`/`fail`) or several
  (`positive`/`neutral`/`negative`, or `correct`/`partially_correct`/`incorrect`) both
  work, as long as each label has a sharp definition. Named labels agree with people
  more often than a numeric scale, so avoid a 1 to 5 scale unless the user needs one.
  Separate qualities into their own judges when you need an interpretable score for
  each one. A combined judge can make sense when the qualities share one decision.
- **Every label the template names must be in `choices`.** The evaluator forces the
  model to pick from `choices`, so a label such as `cannot_evaluate` that appears only
  in the prompt can never come back. Add it to `choices` or remove it from the prompt.
- **Give the judge what it needs, and nothing more.** Include the evidence a reviewer
  would check, such as tool calls and results, retrieved documents, earlier turns, or
  the spec. Leave out fields the decision doesn't use, because extra text costs tokens
  and distracts the judge. Format the evidence for a person to read: a transcript
  with one turn per line, not a raw JSON dump of spans. Mustache sections can do the
  formatting in the template (see [evaluators-python](evaluators-python.md)).
- **Write criteria from the spec and from real failures, without overfitting.** When
  the judge gets records wrong, find the general rule the prompt was missing and add
  that. Don't add a rule that names one record's details, because it fixes that record
  and nothing else.
- **Keep explanations on while they help.** Explanations are useful while you inspect
  disagreements and revise the rubric. You can turn them off when cost or latency
  matters more and the judge is already stable.

## Choose the judge model

Choose a model by measuring accuracy, cost, and latency on the same labeled records.

1. Run the judge with the models that fit the deployment constraints. A stronger
   model can provide a useful comparison point during evaluator alignment.
2. Tune the prompt on the development records for the models you might deploy.
3. Compare cost against accuracy, such as F1 or recall and precision on the failure
   label, and pick the model you'll run at scale.

A decision model (`DecisionModel` in Python, `decisionModel()` in the AI SDK) is
worth testing for high-volume classification when you don't need explanations. It
returns label probabilities, so you can send low-confidence records to an LLM judge
or a reviewer. Compare it with an LLM judge on tasks that need arithmetic or several
reasoning steps.

The judge needs its own prompt. The app's output is what the judge scores, not
evidence that the output is correct. Use a separate reference when the rubric needs
one. A different model from the app is optional and can reduce shared blind spots.

## Learn from the built-in prompts

The pre-built evaluators' prompts are in
`phoenix.evals.__generated__.classification_evaluator_configs` in Python, and each
evaluator class exposes its prompt as `PROMPT`. Read the one closest to your check
before writing your own, or start from it (see [pre-built](pre-built.md)).
