# LLM as a Judge

Evaluation of LLM assisted tasks is often a difficult endeavor: given LLM's broad capabilities, the tasks given to them often should be judged on requirements that would be very broad, and loosely-defined. For instance, an assistant’s answer to a question can be:

* not grounded in context
* repetitive, repetitive, repetitive
* grammatically incorrect
* excessively lengthy and characterized by an overabundance of word
* incoherent

The list of criteria goes on. And even if we had a limited list, each of these would be hard to mesure: “devising a rule-based program to assess the outputs is extremely challenging. Traditional evaluation metrics based on the similarity between outputs and reference answers (e.g., ROUGE, BLEU) are also ineffective for these questions.”

A powerful solution to assess outputs in a human way, without requiring costly human time, is LLM-as-a-judge. This method was introduced in [Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://huggingface.co/papers/2306.05685) - which we encourage you to read.

The idea is simple: ask an LLM to do the grading for you.
