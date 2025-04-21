# LangFlow

Langflow is an open-source visual framework that enables developers to rapidly design, prototype, and deploy custom applications powered by large language models (LLMs). Built on top of LangChain,

Langflow users can now seamlessly observe their LLM workflows through Arize Phoenix. This integration allows developers to gain granular visibility into the performance and behavior of their Langflow applications. By leveraging Arize AI's observability platform, users can capture detailed telemetry data from their Langflow pipelines, enabling them to identify bottlenecks, trace the flow of requests, and ensure the reliability and efficiency of their LLM-powered systems. This enhanced observability empowers teams to debug issues faster, optimize performance, and maintain high-quality user experiences across their LLM applications.

## Pull Langflow Repo

Navigate to the Langflow GitHub repo and pull the project down

{% @github-files/github-code-block url="https://github.com/langflow-ai/langflow" %}

## Create .env file

Navigate to the repo and create a `.env` file with all the Arize Phoenix variables.

You can use the `.env.example` as a template to create the `.env` file

<figure><img src="../../.gitbook/assets/image (7).png" alt=""><figcaption></figcaption></figure>

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

<figure><img src="../../.gitbook/assets/image (1) (1).png" alt=""><figcaption><p>Add New Flow</p></figcaption></figure>

## Create a Flow

In this example, we'll use Simple Agent for this tutorial

<figure><img src="../../.gitbook/assets/image (4).png" alt=""><figcaption></figcaption></figure>

Add your OpenAI Key to the Agent component in Langflow

<figure><img src="../../.gitbook/assets/image (5).png" alt=""><figcaption><p>Add your OpenAI Key</p></figcaption></figure>

Go into the Playground and run the Agent

<figure><img src="../../.gitbook/assets/image (3).png" alt=""><figcaption></figcaption></figure>

## Go to Arize Phoenix

Navigate to your project name (should match the name of of your Langflow Agent name)

[https://app.phoenix.arize.com/](https://app.phoenix.arize.com/)

<figure><img src="../../.gitbook/assets/image (8).png" alt=""><figcaption></figcaption></figure>

<figure><img src="../../.gitbook/assets/image (9).png" alt=""><figcaption></figcaption></figure>

## Inspect Traces

<figure><img src="../../.gitbook/assets/image (10).png" alt=""><figcaption><p>Agent Executor Trace by Arize Phoenix</p></figcaption></figure>

AgentExecutor Trace is Arize Phoenix instrumentation to capture what's happening with the LangChain being ran during the Langflow components

<figure><img src="../../.gitbook/assets/image (11).png" alt=""><figcaption><p>Native Langflow Tracing</p></figcaption></figure>

The other UUID trace is the native Langflow tracing.
