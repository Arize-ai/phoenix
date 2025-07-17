# Overview: Datasets

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/evaluator.png" alt=""><figcaption><p>How Datasets are used to test changes to your AI application</p></figcaption></figure>

The velocity of AI application development is bottlenecked by quality evaluations because AI engineers are often faced with hard tradeoffs: which prompt or LLM best balances performance, latency, and cost. High quality evaluations are critical as they can help developers answer these types of questions with greater confidence.

## Datasets

Datasets are integral to evaluation. They are collections of examples that provide the `inputs` and, optionally, expected `reference` outputs for assessing your application. Datasets allow you to collect data from production, staging, evaluations, and even manually. The examples collected are used to run experiments and evaluations to track improvements to your prompt, LLM, or other parts of your LLM application.

## Experiments

In AI development, it's hard to understand how a change will affect performance. This breaks the dev flow, making iteration more guesswork than engineering.

Experiments and evaluations solve this, helping distill the indeterminism of LLMs into tangible feedback that helps you ship more reliable product.

Specifically, good evals help you:

* Understand whether an update is an improvement or a regression
* Drill down into good / bad examples
* Compare specific examples vs. prior runs
* Avoid guesswork
