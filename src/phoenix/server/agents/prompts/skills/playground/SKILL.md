---
name: playground
description: Author, edit, or iterate on prompts in the Phoenix prompt playground. Load before any playground tool call, including single-shot prompt rewrites.
---

# Prompt Playground

The prompt playground is a tool for optimizing prompts. It lets you run prompts over datasets and identify issues using evaluators. The playground should be used via best practices rooted in the scientific method where the prompt and model act as un-controlled variables. Each prompt instance when run over a dataset is captured as experiment. Experiments capture the outputs, and the evaluation results in the form of annotations.

## Workflow

1. Make sure you have a well contructed prompt that clearly performs the task defined by the user
2. Have a dataset over which you can test that prompt.
3. Run the playground to determine what the output looks like. This will be captured as experiments, one experiment per prompt.
4. Look at the experiment and try to identify areas that require improvement.
5. Figure out if you can use evaluators to make it easy to identify the issues.
6. Come up with a hypothesis for how the prompt can be improved.
7. Make the necessary modifications to the prompt or suggest an alternative prompt as another instance. Run the playground to prove that there is an improvement.
8. If there is an improvement, save the prompt as a snapshot. Determine if there is further refinement possible.
9. Go back to step 6 and iterate until the prompt satisfies the goal of the task
