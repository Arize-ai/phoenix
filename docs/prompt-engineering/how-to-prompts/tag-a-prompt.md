---
description: How to deploy prompts to different environments safely
---

# Tag a prompt



Prompts in Phoenix are versioned in a linear history, creating a comprehensive audit trail of all modifications. Each change is tracked, allowing you to:

* Review the complete history of a prompt
* Understand who made specific changes
* Revert to previous versions if needed

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt_version_tags.png" alt=""><figcaption></figcaption></figure>

## Creating a Tag

When you are ready to deploy a prompt to a certain environment (let's say staging), the best thing to do is to tag a specific version of your prompt as **ready**. By default Phoenix offers 3 tags, **production**, **staging**, and **development** but you can create your own tags as well.

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/tagging_a_prompt.gif" alt=""><figcaption></figcaption></figure>

## Creating a custom tag

It can be helpful to have custom tags to track different versions of a prompt. For example if you wanted to tag a certain prompt as the one that was used in your v0 release, you can create a custom tag with that name to keep track!

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/cutom_tag.gif" alt=""><figcaption><p>Use custom tags to track releases or maybe just an arbitrary milestone</p></figcaption></figure>



## Pulling a prompt by tag

Once a prompt version is tagged, you can pull this version of the prompt into any environment that you would like (an application, an experiment). Similar to git tags, prompt version tags let you create a "release" of a prompt (e.x. pushing a prompt to staging).

For full details on how to use prompts in code, see [using-a-prompt.md](using-a-prompt.md "mention")



