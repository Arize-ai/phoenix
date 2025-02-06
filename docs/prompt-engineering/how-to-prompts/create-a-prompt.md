# Create a prompt

Navigate to the **Prompts** in the navigation and click the add prompt button on the top right. This will navigate you to the Playground.&#x20;

## Compose a prompt

The playground is like the IDE where you will develop your prompt. The prompt section on the right lets you add more messages, change the template format (f-string or mustache), and an output schema (JSON mode).

To the right you can enter sample inputs for your prompt variables and run your prompt against a model. Make sure that you have an API key set for the LLM provider of your choosing.



## Save the prompt

To save the prompt, click the save button in the header of the prompt on the right. Name the prompt using alpha numeric characters (e.x. \`my-first-prompt\`) with no spaces. \
\
The model configuration you selected in the Playground will be saved with the prompt. When you re-open the prompt, the model and configuration will be loaded along with the prompt.

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/create_prompt.png" alt=""><figcaption><p>Once you are satisfied with your prompt in the playground, you can name it and save it</p></figcaption></figure>

## View your prompts

You just created your first prompt in Phoenix! You can view and search for prompts by navigating to Prompts in the UI.&#x20;

Prompts can be loaded back into the playground at any time by clicking on "open in playground"

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/open_prompt.gif" alt=""><figcaption><p>You can quickly load in the latest version of a prompt into the playground</p></figcaption></figure>





## Adding labels and metadata

:construction: Prompt labels and metadata is still [under construction.](https://github.com/Arize-ai/phoenix/issues/6290)



## Cloning a prompt

In some cases, you may need to modify a prompt without altering its original version. To achieve this, you can **clone** a prompt, similar to forking a repository in Git.

Cloning a prompt allows you to experiment with changes while preserving the history of the main prompt. Once you have made and reviewed your modifications, you can choose to either keep the cloned version as a separate prompt or merge your changes back into the main prompt. To do this, simply load the cloned prompt in the playground and save it as the main prompt.

This approach ensures that your edits are flexible and reversible, preventing unintended modifications to the original prompt.









