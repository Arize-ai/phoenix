# LangFlow Tracing

## Pull Langflow Repo

Navigate to the Langflow GitHub repo and pull the project down

{% @github-files/github-code-block url="https://github.com/langflow-ai/langflow" %}

## Create .env file

Navigate to the repo and create a `.env` file with all the Arize Phoenix variables.

You can use the `.env.example` as a template to create the `.env` file

Add the following environment variable to the `.env` file

```
# Arize Phoenix Env Variables
PHOENIX_API_KEY="YOUR_PHOENIX_KEY_HERE"
```

Note: This Langflow integration is for [Phoenix](https://app.phoenix.arize.com/login/sign-up)[ Cloud](https://app.phoenix.arize.com/login/sign-up)

## Start Docker Desktop

Start Docker Desktop, build the images, and run the container (this will take around 10 minutes the first time)\
\
Go into your terminal into the Langflow directory and run the following commands

<pre><code><strong>docker compose -f docker/dev.docker-compose.yml down || true 
</strong>docker compose -f docker/dev.docker-compose.yml up --remove-orphans
</code></pre>

## Go to Hosted Langflow UI

{% embed url="http://localhost:3000/" %}

## Create a Flow

In this example, we'll use Simple Agent for this tutorial

Add your OpenAI Key to the Agent component in Langflow

Go into the Playground and run the Agent

## Go to Arize Phoenix

Navigate to your project name (should match the name of of your Langflow Agent name)

[https://app.phoenix.arize.com/](https://app.phoenix.arize.com/)

## Inspect Traces

AgentExecutor Trace is Arize Phoenix instrumentation to capture what's happening with the LangChain being ran during the Langflow components

The other UUID trace is the native Langflow tracing.
