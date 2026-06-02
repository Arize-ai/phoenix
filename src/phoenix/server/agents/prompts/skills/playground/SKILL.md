---
name: playground
description: Author, edit, or iterate on prompts in the Phoenix prompt playground, including running experiments over a dataset. Load before any playground tool call, including single-shot prompt rewrites.
---

# Prompt Playground

The prompt playground is a tool for authoring and optimizing prompts. It supports two different
ways of working: fast manual prompt iteration without a dataset, and dataset-backed prompt
experimentation with evaluators and experiments. Choose the workflow that matches the user's
current goal and the UI context they have mounted.

## Workflow: Create And Iterate Without A Dataset

Use this workflow when the user wants to draft, rewrite, or manually improve a prompt and no
dataset-backed evaluation loop is in scope.

1. Clarify the task the prompt must perform: input variables, expected output shape, audience,
   constraints, and examples of good or bad behavior when available.
2. If a playground prompt already exists, call `read_prompt_instance` before proposing changes so
   you have the current messages, message IDs, labels, and revision.
3. Draft or revise the prompt so it clearly states the task, required context, output contract, and
   success criteria. Keep the prompt directly tied to the user's stated goal.
4. Use `edit_prompt_instance` for changes to the mounted prompt so the user can review the diff
   before accepting it.
5. Use `clone_prompt_instance` when comparing alternatives would help the user choose between
   prompt variants. Discuss variants by their alphabetic labels, but pass numeric instance IDs to
   tools.
6. Use `set_variable_values` when the user provides manual values for prompt template variables.
7. Call `run_playground` only when the user asks to run, try, test, or compare the current prompt.
   Treat the output as qualitative feedback rather than dataset-backed evidence.
8. After the run finishes, call `read_playground_output` to inspect raw output and get the traceId
   for trace analysis when needed.
9. Call `save_prompt` only when the user explicitly asks to save or confirms that the current
   prompt should be persisted. For a first-time save of an unsaved prompt, omit `name` unless the
   user provided one; the tool will derive a valid Phoenix prompt name from the prompt content.
   Always pass a save description; it should read like a clear, short git commit message. Treat
   tags like releases and do not promote tags unless the user asks.
10. Inspect the output with the user, identify the next concrete improvement, and repeat the edit or
   comparison loop until the prompt is useful for the task.

## Workflow: Iterate Over A Dataset With Evaluators And Experiments

Use this workflow when the user wants evidence that a prompt is improving across a dataset, or when
they are comparing prompt variants using evaluator results.

1. Load the dataset with `load_dataset` if it isn't already loaded. If the user named a dataset but
   no split and the dataset has splits, name them and ask whether to scope to one or load the whole
   dataset — then load once.
2. Confirm the dataset represents the task the prompt is meant to solve, including the important
   input fields, expected outputs, and failure modes.
3. Make sure the starting prompt is well formed before running it: it should define the task,
   relevant variables, output format, and any constraints needed for consistent evaluation.
4. Run the playground over the dataset. Each prompt instance run over a dataset is captured as an
   experiment, with outputs and evaluator annotations available for review.
5. Review the experiment outputs and annotations to find recurring failure patterns. Use `bash` with
   `phoenix-gql` to inspect dataset-backed experiment results when needed; `read_playground_output`
   only reads manual playground runs. Separate model randomness from prompt issues when possible.
6. Use or add evaluators when they make issue detection more systematic, especially for failures
   that are hard to spot by manual review alone.
7. Form a specific hypothesis for improving the prompt, then use `edit_prompt_instance` or
   `clone_prompt_instance` to create the next candidate.
8. Rerun the playground and compare experiments. Look for evaluator improvements, fewer repeated
   failure modes, and acceptable tradeoffs in output quality.
9. Use `save_prompt` to save a prompt as a new version only after the evidence shows an
   improvement or the user explicitly accepts the tradeoff. For unsaved prompts, the tool can
   create the Phoenix prompt directly without asking for a name unless the user cares about the
   exact name.
10. Continue the hypothesis, edit, run, compare loop until the dataset-backed results satisfy the
   user's goal.

## Workflow: Author, Refine, Or Remove A Function Tool

Use this workflow when the user wants the model to be able to call a function/tool from the prompt,
when they want to refine the signature of an existing one, or when they want to remove a tool.
Function tools are JSON-Schema function definitions stored on the playground prompt instance
(alongside messages and model config). They are the things the model can "call" during a run.

1. Call `read_prompt_tools` before doing anything else. The result gives you the current tool list,
   each tool's id and kind, and a `revision` token. Use the existing ids and names to decide
   whether you should update an existing tool, create a new one, or delete one.
2. If the user described a function in words, propose a concrete JSON Schema for it. Default to
   lowercase snake_case parameter names and a `{"type":"object","properties":{...},"required":[...]}`
   shape unless the user specifies otherwise.
3. Call `write_prompt_tools` with the latest `revision`. Put every change in a single call: `tools`
   is an array of creates/updates (omit `id` to create, pass an existing `id` to patch — only the
   fields you include change), and `deleteToolIds` is a list of ids to remove. Deletes may target
   `raw` vendor tools too, even though writes can't. The batch is all-or-nothing: if any change is
   invalid (missing id, a `raw` tool on the write path, or the same id created/updated and deleted)
   nothing is applied and the error explains which. Deleting the tool that is the forced tool choice
   is allowed — the choice is reset to auto and reported back; mention that to the user.
4. After the write, briefly summarize what changed in plain English (which tools were created vs
   updated) so the user knows what to look for in the tool editor. If you created tools, tell them
   the new ids.
5. If the user wants the model to use the new tool in a run, call `run_playground` and then
   `read_playground_output` to see whether the model actually invoked it.

### Few-shot examples

These are concrete, runnable shapes — treat them as templates, not as fixed prompts. Always pass
the latest `revision` returned by `read_prompt_tools`.

**Create a brand-new tool.** One entry with no `id`.

```json
{
  "instanceId": 1,
  "expectedRevision": "prompt-tools-abc",
  "tools": [
    {
      "name": "get_weather",
      "description": "Look up the current weather for a city.",
      "parameters": {
        "type": "object",
        "properties": {
          "city": { "type": "string", "description": "City name, e.g. \"San Francisco\"." },
          "units": { "type": "string", "enum": ["c", "f"], "description": "Temperature units." }
        },
        "required": ["city"]
      }
    }
  ]
}
```

**Create several tools at once.** Put every tool in the `tools` array — one call, one revision
check. Prefer this over issuing one call per tool.

```json
{
  "instanceId": 1,
  "expectedRevision": "prompt-tools-abc",
  "tools": [
    {
      "name": "get_weather",
      "parameters": {
        "type": "object",
        "properties": { "city": { "type": "string" } },
        "required": ["city"]
      }
    },
    {
      "name": "get_forecast",
      "parameters": {
        "type": "object",
        "properties": {
          "city": { "type": "string" },
          "days": { "type": "integer" }
        },
        "required": ["city", "days"]
      }
    }
  ]
}
```

**Add a required parameter to an existing tool.** Pass the existing `id` and the full new
`parameters` schema. Patch semantics — `name` is required even if unchanged.

```json
{
  "instanceId": 1,
  "expectedRevision": "prompt-tools-abc",
  "tools": [
    {
      "id": 3,
      "name": "get_weather",
      "parameters": {
        "type": "object",
        "properties": {
          "city": { "type": "string" },
          "units": { "type": "string", "enum": ["c", "f"] }
        },
        "required": ["city", "units"]
      }
    }
  ]
}
```

**Create one tool and patch another in the same batch.** Mix entries with and without `id`.

```json
{
  "instanceId": 1,
  "expectedRevision": "prompt-tools-abc",
  "tools": [
    {
      "name": "get_time",
      "parameters": {
        "type": "object",
        "properties": { "timezone": { "type": "string" } },
        "required": ["timezone"]
      }
    },
    {
      "id": 3,
      "name": "get_weather",
      "description": "Look up the current weather for a city. Returns temperature, humidity, and conditions."
    }
  ]
}
```

**Define a tool that returns structured output via a categorical choice.** The model is forced to
pick one of the enum labels and optionally explain.

```json
{
  "instanceId": 1,
  "expectedRevision": "prompt-tools-abc",
  "tools": [
    {
      "name": "classify_sentiment",
      "description": "Classify the sentiment of the input as positive, negative, or neutral.",
      "parameters": {
        "type": "object",
        "properties": {
          "label": {
            "type": "string",
            "enum": ["positive", "negative", "neutral"],
            "description": "The sentiment classification."
          },
          "explanation": {
            "type": "string",
            "description": "Short justification for the label."
          }
        },
        "required": ["label"]
      }
    }
  ]
}
```

**Delete a tool — and optionally swap in a replacement in the same batch.** `deleteToolIds` removes
by id; combine it with `tools` to delete and add atomically. Deletes may target `raw` vendor tools.

```json
{
  "instanceId": 1,
  "expectedRevision": "prompt-tools-abc",
  "deleteToolIds": [3],
  "tools": [
    {
      "name": "get_forecast",
      "parameters": {
        "type": "object",
        "properties": { "city": { "type": "string" } },
        "required": ["city"]
      }
    }
  ]
}
```

### Things to avoid

- Don't call `write_prompt_tools` without calling `read_prompt_tools` first this turn — the
  `expectedRevision` will be stale and the write will be rejected.
- Don't try to *write* a tool whose `kind` was `raw` in the read snapshot. Vendor passthrough tools
  (e.g. provider builtins like `web_search`) are not editable through PXI — tell the user to author
  those in the playground tool editor. A `raw` entry in `tools` rejects the whole batch. (You *can*
  delete a `raw` tool via `deleteToolIds`, though.)
- Deleting the tool that is the prompt's forced tool choice (tool_choice = specific function) is
  allowed — the tool choice is automatically reset to auto (zero-or-more) and the result reports
  `resetToolChoiceFrom`. Tell the user, since it changes how the model picks tools at run time.
- Don't invent tool `id`s. An entry's `id` (and every `deleteToolIds` id) comes from a read
  snapshot, or is omitted for create. You cannot reference an id created earlier in the same batch.
- Don't issue multiple `write_prompt_tools` calls in a row without re-reading the revision between
  them. Each successful write or delete changes the revision. Batch the changes into one call.
