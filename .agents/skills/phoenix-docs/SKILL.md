---
name: phoenix-docs
description: Write and restructure Phoenix documentation in docs/ using the Diátaxis framework, with ASD-STE100 Simplified Technical English for technical content. Use when adding, editing, or reviewing any docs page.
metadata:
  internal: true
---

# Phoenix Docs

## Diátaxis

Each page has one type. Do not mix types. Link to other types instead.

| Type | Serves | Rules |
| --- | --- | --- |
| Tutorial | Learning | A lesson. One safe path to a working result. No choices, no theory. |
| How-to guide | A task | Steps to reach a goal. Assume competence. Start with the goal. |
| Reference | Information | Describe the machinery: APIs, config, attributes. Neutral, complete, structured like the code. |
| Explanation | Understanding | Why and how it fits. Context, design, trade-offs. No steps. |

Before you write, identify the type with two questions: action or cognition? Study or work?
Action + study = tutorial. Action + work = how-to. Cognition + work = reference. Cognition + study = explanation.
If content does not fit the type, move it. Details: https://diataxis.fr/

## ASD-STE100 (technical content)

Use for how-to guides and reference.

- One instruction per sentence. Max 20 words in procedures, 25 in descriptions.
- Use the imperative for instructions: "Set the variable."
- Use active voice. Use simple tenses.
- One word, one meaning. Use the same term for the same thing.
- Put conditions before the instruction: "If X, do Y."
- Write warnings before the step they apply to.
- No idioms, no "please", no "simply/just/easily".
