---
description: >-
  Testing your prompts before you ship them is vital to deploying reliable AI
  applications
---

# Test a prompt

## Testing in the Playground

### Testing a prompt in the playground

The Playground is a fast and efficient way to refine prompt variations. You can load previous prompts and validate their performance by applying different variables.

Each single-run test in the Playground is recorded as a span in the **Playground project**, allowing you to revisit and analyze LLM invocations later. These spans can be added to datasets or reloaded for further testing.

### Testing a prompt over a dataset

The ideal way to test a prompt is to construct a golden dataset where the dataset examples contains the variables to be applied to the prompt in the **inputs** and the **outputs** contains the ideal answer you want from the LLM. This way you can run a given prompt over N number of examples all at once and compare the synthesized answers against the golden answers.

Playground integrates with [datasets and experiments](test-a-prompt.md#datasets-and-experiments) to help you iterate and incrementally improve your prompts. Experiment runs are automatically recorded and available for subsequent evaluation to help you understand how changes to your prompts, LLM model, or invocation parameters affect performance.

### Testing prompt variations side-by-side

Prompt Playground supports **side-by-side comparisons** of multiple prompt variants. Click **+ Compare** to add a new variant. Whether using **Span Replay** or testing prompts over a **Dataset**, the Playground processes inputs through each variant and displays the results for easy comparison.

<figure><img src="../../.gitbook/assets/Screenshot 2024-12-02 at 9.55.26 AM.png" alt=""><figcaption><p>Testing multiple prompts simultaneously</p></figcaption></figure>

## Testing a prompt using code

Sometimes you may want to test a prompt and run evaluations on a given prompt. This can be particularly useful when custom manipulation is needed (e.x. you are trying to iterate on a system prompt on a variety of different chat messages).\
\
:construction: This tutorial is coming soon
