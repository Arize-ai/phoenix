---
description: >-
  Phoenix Evals leverages executors that make the execution of evaluations many
  times faster.
---

# Executors

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/eval_executor.png" alt=""><figcaption></figcaption></figure>

When performing evaluations, speed is paramount so that you can focus on improving your system. Phoenix Evals executors run evaluations faster and more reliably by automatically handling rate limits, errors, and concurrency.

## What Executors Do

* **Handle Rate Limits**: Automatically retry when LLM providers throttle requests
* **Manage Errors**: Distinguish between temporary failures and permanent errors
* **Optimize Speed**: Dynamically adjust concurrency based on provider performance

## Why Use Executors

Running thousands of evaluations manually is slow and error-prone. Executors automatically handle the complexity so you can focus on your evaluation logic instead of infrastructure.
