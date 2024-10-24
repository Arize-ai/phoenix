# Llama Researcher

In this tutorial, we'll create LLama-Researcher using LlamaIndex workflows, inspired by [GPT-Researcher.](https://github.com/assafelovic/gpt-researcher)

Credit to [rsrohan99](https://github.com/rsrohan99) for the original implementation.

Stack Used:

- LlamaIndex workflows for orchestration
- Tavily API as the search engine api
- Arize Phoenix for tracing and evaluation

## How to use

- Clone the repo

```bash
git clone https://github.com/Arize-ai/phoenix
cd examples/llamaindex-workflows-research-agent
```

- Install dependencies

```bash
pip install -r requirements.txt
```

- Create `.env` file and add `OPENAI_API_KEY`, `TAVILY_API_KEY` and `PHOENIX_API_KEY`

```bash
cp .env.example .env
```

- Run the workflow with the topic to research

```bash
 python run.py "topic to research"
```
