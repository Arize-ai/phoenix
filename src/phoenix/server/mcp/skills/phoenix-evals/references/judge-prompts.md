# Judge prompts

A judge prompt is a rubric for one decision. Most judge errors come from a rubric
that leaves the hard cases to the model's taste.

## Structure

1. **One sentence of task.** "You are checking whether the answer is supported by the
   sources."
2. **The inputs, each in its own tag.** `<question>{{input}}</question>`,
   `<answer>{{output}}</answer>`, `<sources>{{context}}</sources>`. Give the judge only
   the fields the decision needs.
3. **A definition for each label.** Say exactly what puts a record in each label, in
   terms the judge can check against the inputs.
4. **The hard cases, decided.** Refusals, partial answers, empty context, an answer
   that's right but cites nothing. Write the label each one gets.
5. **Two to four short examples**, including at least one that sits near the line.
   Write them yourself, or take them from records you tune on, never from records
   you'll measure the judge on.

```text
You are checking whether a travel assistant's itinerary respects the traveler's constraints.

<constraints>{{constraints}}</constraints>
<request>{{input}}</request>
<itinerary>{{output}}</itinerary>

"respects": every booking and suggestion fits the stated budget, dates, and
accessibility needs, and the itinerary says which constraint drove any trade-off.
"violates": any item breaks a stated constraint, or a trade-off is made without
saying so.

Decided cases:
- The assistant asks for missing dates and proposes nothing yet: "respects".
- The itinerary fits the budget only by dropping a requested city without saying so: "violates".
```

## Rules

- **Binary labels.** Two labels with sharp definitions agree with people more often
  than a 1 to 5 scale. Split a multi-part quality into several binary judges.
- **Every label the template names must be in `choices`.** The evaluator forces the
  model to pick from `choices`, so a label such as `cannot_evaluate` that appears only
  in the prompt can never come back. Add it to `choices` or remove it from the prompt.
- **Give the judge the evidence a reviewer would check.** Tool calls and results,
  retrieved documents, earlier turns, the spec or policy. A judge that sees only the
  final reply can't tell whether it's supported.
- **Write criteria from the spec and from real failures.** Take definitions and decided cases from the
  failures you found in traces and from reviewer comments, not from what a generic
  "quality" rubric says.
- **Don't copy test cases into the prompt.** Examples in the prompt that also appear
  in the data you measure the judge on make its agreement look better than it is.
  Keep the examples you use to measure the judge out of the prompt.
- **Keep explanations on** while you build the judge. Reading why it disagreed with a
  person is how you fix the rubric.

## Choosing the judge model

- Start with a capable model. Move to a cheaper one only after the rubric is stable,
  and measure both on the same labeled set.
- The judge needs its own prompt, and the app's output never defines the reference.
  A different model from the app is optional; it can reduce shared blind spots.
- Use a decision model (`DecisionModel` in Python, `decisionModel()` in the AI SDK)
  for high-volume labeling where you don't need explanations. Don't use one for checks
  that need arithmetic or multi-step reasoning.

## Learn from the built-in prompts

The pre-built evaluators' prompts are in
`phoenix.evals.__generated__.classification_evaluator_configs` in Python. Read the
one closest to your check before writing your own.
