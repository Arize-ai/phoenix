---
description: Phoenix Prompts Tutorial
---

# Tutorial

In agents and LLM applications, prompts define how our systems reason, when they call tools, what information they retrieve, and how they decide between possible outputs. A well-written prompt can make the difference between brittle, unpredictable outputs and reliable, production-grade behavior.\
But iterating in your prompts requires infrastructure that treats prompts like any other part of a machine learning system: versioned, evaluated, and optimized with data.

This tutorial walks through how to build that workflow end to end in Phoenix.\
You’ll learn how to identify underperforming prompts, run experiments across datasets, compare model and parameter changes, and even automatically improve your prompts based on evaluation feedback.

{% hint style="info" %}
**Follow along with code**: This guide has a companion notebook with runnable code examples. Find it [here](https://github.com/Arize-ai/phoenix/blob/main/tutorials/prompts/phoenix_prompt_tutorial.ipynb).
{% endhint %}

***

### **Tutorial Structure**

#### [identify-and-edit-prompts.md](identify-and-edit-prompts.md "mention")

**Goal:** Find and fix misclassifications at the trace level.\
Learn how to inspect LLM traces, replay failing spans in the Playground, and edit your prompt directly to improve performance.\
You’ll also learn how to save and version each prompt in the Prompts tab, laying the foundation for controlled, iterative experimentation.

***

#### [test-prompts-at-scale.md](test-prompts-at-scale.md "mention")

**Goal:** Move from anecdotal fixes to measurable performance.\
Run your updated prompt across a labeled dataset to quantify accuracy and identify recurring failure patterns.\
Use LLM-based evaluators to generate structured, natural-language feedback explaining _why_ each output failed, turning evaluation data into actionable insight.

***

#### [compare-prompt-versions.md](compare-prompt-versions.md "mention")

**Goal:** Measure whether your edits actually worked.\
Experiment with different instructions, models, and inference parameters (e.g., temperature, top-p).\
Compare prompt versions side-by-side to determine which configuration performs best, balancing accuracy, cost, and consistency.

***

#### [optimize-prompts-automatically.md](optimize-prompts-automatically.md "mention")

**Goal:** Scale beyond manual iteration.\
Leverage Prompt Learning, an optimization algorithm that uses your own evaluation feedback to generate improved prompts automatically.\
Feed experiment data back into the system, train a new prompt version through the SDK, and re-measure performance, in Phoenix.

***

### **What You’ll Have by the End**

After completing the tutorial, you’ll have:

* A full dataset and experiment workflow for testing prompts.
* Multiple prompt versions tracked and reproducible.
* Evaluation feedback structured for analysis and iteration.
* An automated optimization loop using Prompt Learning.

Together, these pieces turn prompt design from a manual process into a **data-driven, repeatable workflow -** the same framework used to maintain production LLM systems at scale.
