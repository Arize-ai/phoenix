# Prompts

Authors: @mikeldking

As a user of Phoenix, I want to be able to create, store, and modify the prompts that I use to interact with LLMs. The primary reason for this is to be able to reuse prompts across different use cases and to be able to load them into different LLMs in the playground and in code as needed.

## Terminology

-- **Prompts** refer to the message(s) that are passed into the language model.

-- **Prompt Templates** refer a way of formatting information to get the prompt to hold the information you want (such as context and examples) Prompt templates can include placeholders (variables) for things such as examples (e.x. few-shot), outside context (RAG), or any other external data that is needed.
-- **Prompt Type** refer to the different types of prompts that can be used with the language model. For example, Chat, String

## Use-cases

A user may want to store a prompt or prompt template to:

- Experiment with different prompts in the playground and test the output of the LLM against different models.
- Store off prompts so that it can be loaded into a notebook when performing experiments.
- Share prompts with other users so that they can have a reasonable starting point for new prompts.

In the abstract a prompt template has:

- A human-readable name
- A description (markdown)
- A prompt type
- A set of revisions to the prompt

### Prompt Types

With LLMs, there are different ways to invoke an LLM. Broadly speaking there are the following prompting types:

- **Chat**: This is the most common type of prompt where the user is interacting with the LLM in a conversational manner.
- **String**: This is a single string that is passed into the LLM. This is useful for generating text to submit to a model for completion. This is largely a legacy use-case.

### System Messages

Depending on the LLM provider, the notion of a system message can differ. For example with OpenAI, you can have a series of system messages defined by a role. For Anthropic, you have a single system message that is passed in with the prompt. For **Chat** prompts, we will assume that there can be system messages in the list. These system messages would be extracted and concatenated together in the case of platforms such as Anthropic.

### Prompt Revisions

Similar to a git - when modifying a prompt, a new revision is created. This allows the user to see the history of the prompt and to revert back to a previous version if needed. Note that there is no real need for complex git-like functionality as a linear history is sufficient. For that reason we will adopt the idea of a linear history of revisions.
