# Prompts

Authors: @mikeldking @anticorrelator

As a user of Phoenix, I want to be able to create, store, and modify the prompts that I use to interact with LLMs. The primary reason for this is to be able to reuse prompts across different use cases and to be able to load them into different LLMs in the playground and in code as needed.

## Terminology

- **Prompts** refer to the message(s) that are passed into the language model.
- **Prompt Templates** refer a way of formatting information to get the prompt to hold the information you want (such as context and examples) Prompt templates can include placeholders (variables) for things such as examples (e.x. few-shot), outside context (RAG), or any other external data that is needed.
- **Prompt Type** refer to the different types of prompts that can be used with the language model. For example, Chat, String. The primary prompt type will be Chat as it is the most common.

## Use-cases

A user may want to store a prompt or prompt template to:

- Experiment with different prompts in the playground and test the output of the LLM against different models.
- Store off prompts so that it can be loaded into a notebook when performing experiments.
- Share prompts with other users so that they can have a reasonable starting point for new prompts.
- Use Prompt as a source of truth for prompts in the case that prompts need to be versioned and tracked over time (e.x. beta-testing a new prompt, rolling back to an older version)

In the abstract a prompt template has:

- A human-readable name (identifier)
- A description / README (markdown)
- A prompt type (Chat, String, ...)
- A format (f-string / mustache)
- A set of revisions to the prompt

In addition a prompt template might have associated model configurations (e.g. the prompt only works under certain parameters). In this case the prompt might have a model configuration associated with it. This includes:

- The name of the model
- The model provider (think Azure, Anthropic, OpenAI)
- Model parameters (temperature, max_tokens, etc)

The model configuration is mainly meant as a guideline and might need to be tracked separately (TBD).

### Prompt Types

With LLMs, there are different ways to invoke an LLM. Broadly speaking there are the following prompting types:

- **Chat**: This is the most common type of prompt where the user is interacting with the LLM in a conversational manner.
- **String**: This is a single string that is passed into the LLM. This is useful for generating text to submit to a model for completion. This is largely a legacy use-case.

In addition to the above, a prompt template could be categorized into more granular types such as

- **ChatStructuredOutput**: Leveraging function / tool calls or output schemas to treat the LLM as a "function"

The above types are not exhaustive but mainly to indicate that we might want to extend the definition as use-cases evolve.

### System Messages

Depending on the LLM provider, the notion of a system message can differ. For example with OpenAI, you can have a series of system messages defined by a role. For Anthropic, you have a single system message that is passed in with the prompt. For **Chat** prompts, we will assume that there can be system messages in the list. These system messages would be extracted and concatenated together in the case of platforms such as Anthropic.

### Revisions

Similar to a git - when modifying a prompt, a new revision / commit is created. This allows the user to see the history of the prompt and to revert back to a previous snapshot if needed. Note that there is no real need for complex git-like functionality as a linear history is sufficient. For that reason we will adopt the idea of a linear history of revisions.

It's noting that prompt templates should also be "forkable" - meaning that a template is used as a starting point for a new prompt. The previous history of the prompt should carry over to the forked prompt.

### F-string vs mustache

Users should be able to format their prompt with input variables using either f-string or mustache format. Here is an example prompt with f-string format:

```python
Hello, {name}!
```

And here is one with mustache:

```mustache
Hello, {{name}}!
```

#### Mustache format

Mustache format gives your more flexibility around conditional variables, loops, and nested keys. Read the documentation

## Anatomy of a Prompt

### Tools

Tools are interfaces the LLM can use to interact with the outside world. Tools consist of a name, description, and JSON schema of arguments used to call the tool.

### Structured Output

Structured output is a feature of most state of the art LLMs, wherein instead of producing raw text as output they stick to a specified schema. This may or may not use Tools under the hood.

### Structured Output vs Tools

Structured outputs are similar to tools, but different in a few key ways. With tools, the LLM choose which tool to call (or may choose not to call any); with structured output, the LLM always responds in this format. With tools, the LLM may select multiple tools; with structured output, only one response is generate.

### Model

Optionally, prompts can store a model configuration alongside a prompt template. This includes the name of the model and any other parameters (temperature, etc).

### Prompt Versioning

Versioning is a key part of iterating and collaborating on your different prompts.

Every time you save a new version of a prompt, it is saved with a new commit. You can view old commit, allowing you to easily see previous prompt versions in case you need to revert to previous functionality. You can access a specific commit of the prompt in the SDK by specifying a commit alongside the prompt name.

### Tags

You may want to tag prompt version with a human-readable tag so that you can refer to it even as new versions are added. Common use cases include tagging a prompt with dev or prod tags. This allows you to track which versions of prompts are used where.

It might be worth considering having pre-configured tags when a prompt template is created (e.g. heads/main)

## Analytics

One of the benefits of using Phoenix as a source of prompts is that analytics about a given prompt can be tracked over time. This includes:

- The number of times a prompt has been used
- first used
- last used
- linking of traces to a prompt
- ...

This can be useful for tracking the effectiveness of a prompt over time.

This could mean that when a prompt is used, context attributes can be set.

## User Journeys

### First time creating a prompt

1. Create a new prompt template in the prompt playground, test it out until you are happy with it. Maybe create a small dataset that tracks the input and expected output of the prompt.
2. Save the prompt template and optionally mark it as the version to use in "production" (YOLO)
3. Continue to iterate on the prompt template, marking possible candidates for the next version.
4. Run experiments, continuously comparing the new experiments with the experiment that was run on the last production version of the prompt.
5. When you've created an experiment that results in a better evaluation, you mark the new version as the production version.

### Forking a prompt

There might come a time when you want to create your own copy of a prompt template. This might be because you want to try out a new model or you want to make destructive changes to a prompt.

1. Fork the prompt template. The prompt template carries over the history of the prompt.
2. Make changes to the prompt template. You can make as many changes as you want, including the model
3. When I look at the experiments that have been run, I can filter by the prompt template "name" and "version" so that I can just analyze the experiments that have been run on the forked template.

### Using a prompt in my IDE or code

If prompts are collaborative, versioned entities, I might want to pick up from a given snapshot of a prompt in my IDE.

1. I use `phoenix.client` to pull down a prompt template (maybe a specific tag or version is specified)
2. Alternatively, I go to the Phoenix UI and copy the prompt template into my code.
3. Run experiments or run the application using the updated prompt.
4. Modify the prompt locally in my IDE. I can then push the prompt back to Phoenix as a new candidate version.

### Using a prompt in production

If I am managing prompts in Phoenix, I might want to know which traces are associated with a given prompt. This can be useful as you can track the effectiveness of a prompt over time and see if certain tweaks result in better performance under real-world conditions.

### Testing an alternative prompt template on an LLM Span

Say I used a prompt template to invoke an LLM, I then want to re-use the data stored on the span to test an alternative prompt template.

1. I export the span to a dataset
2. I load the dataset in step 1 into the prompt playground
3. I load the prompt template into the playground
4. I iterate on alternatives to the prompt template

## Technical Considerations

Prompt templates are really an artifact that should live as close as possible to the source code. For that reason if you are relying on Phoenix to be a source of truth of the template, there should be mechanisms to reduce this risk. Some options include:

- caching
- syncing

### Server-Side Catching

A solution to server-side caching would be to carefully structure the URL of the REST APIs so that caching occurs at the network level. In addition to this, the server could also cache certain versions of the prompt template (notably a tagged version).

### Client-Side Caching

We will leverage the SDK to cache the prompt templates locally after pull. This will allow for faster access to the prompt templates and will reduce the number of requests to the server. The client should operate to always try to pull off the network (unless using a version specifier). In the case of a network failure, the client should use a cached version of the prompt template. If there is no cache, we might want to consider a graceful fallback.
