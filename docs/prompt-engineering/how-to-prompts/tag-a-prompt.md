---
description: How to deploy prompts to different environments safely
---

# Tag a prompt

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt_version_tags.png" alt=""><figcaption></figcaption></figure>



Prompts in Phoenix are versioned in a linear history, creating a comprehensive audit trail of all modifications. Each change is tracked, allowing you to:

* Review the complete history of a prompt
* Understand who made specific changes
* Revert to previous versions if needed

## Creating a Tag

When you are ready to deploy a prompt to a certain environment (let's say staging), the best thing to do is to tag a specific version of your prompt as **ready**. By default Phoenix offers 3 tags, **production**, **staging**, and **development** but you can create your own tags as well.

