---
description: Replay LLM spans traced in your application directly in the playground
layout:
  width: wide
  title:
    visible: true
  description:
    visible: true
  tableOfContents:
    visible: true
  outline:
    visible: true
  pagination:
    visible: true
  metadata:
    visible: true
---

# Span Replay

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/span_replay.gif" alt=""><figcaption><p>Replay LLM spans traced in your application directly in the playground</p></figcaption></figure>



Have you ever wanted to go back into a multi-step LLM chain and just replay one step to see if you could get a better outcome? Well you can with Phoenix's **Span Replay.** LLM spans that are stored within Phoenix can be loaded into the Prompt Playground and replayed. Replaying spans inside of Playground enables you to debug and improve the performance of your LLM systems by comparing LLM provider outputs, tweaking model parameters, changing prompt text, and more.&#x20;

Chat completions generated inside of Playground are automatically instrumented, and the recorded spans are immediately available to be replayed inside of Playground.
