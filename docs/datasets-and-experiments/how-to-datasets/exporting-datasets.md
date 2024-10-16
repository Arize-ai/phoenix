# Exporting Datasets

## Exporting for Fine-Tuning

Fine-tuning lets you get more out of the models available by providing:

* Higher quality results than prompting
* Ability to train on more examples than can fit in a prompt
* Token savings due to shorter prompts
* Lower latency requests

Fine-tuning improves on few-shot learning by training on many more examples than can fit in the prompt, letting you achieve better results on a wide number of tasks. **Once a model has been fine-tuned, you won't need to provide as many examples in the prompt.** This saves costs and enables lower-latency requests.\
\
Phoenix natively exports OpenAI Fine-Tuning JSONL as long as the dataset contains compatible inputs  and outputs.

## Exporting OpenAI Evals

Evals provide a framework for evaluating large language models (LLMs) or systems built using LLMs. OpenAI Evals offer an existing registry of evals to test different dimensions of OpenAI models and the ability to write your own custom evals for use cases you care about. You can also use your data to build private evals. Phoenix can natively export the OpenAI Evals format as JSONL so you can use it with OpenAI Evals. See [https://github.com/openai/evals](https://github.com/openai/evals) for details.
