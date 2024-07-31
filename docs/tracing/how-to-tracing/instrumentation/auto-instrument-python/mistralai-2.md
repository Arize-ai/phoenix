---
description: Instrument multi agent applications using CrewAI
---

# CrewAI

### Quickstart

In this example we will instrument a multi agent automation using the CrewAI framework and observe the traces via [`arize-phoenix`](https://github.com/Arize-ai/phoenix).

```
pip install openinference-instrumentation-crewai openinference-instrumentation-langchain crewai crewai-tools  arize-phoenix opentelemetry-sdk opentelemetry-exporter-otlp
```

Start a Phoenix server to collect traces.

```
python -m phoenix.server.main serve
```

In a python file, set up `CrewAIInstrumentor` to trace your CrewAI application and sends the traces to Phoenix at the endpoint defined below. Optionally you can also set up the `LangChainInstrumentor` to get even deeper visibility into your Crew.

```python
from openinference.instrumentation.langchain import LangChainInstrumentor
from openinference.instrumentation.crewai import CrewAIInstrumentor
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor

endpoint = "http://127.0.0.1:6006/v1/traces"
tracer_provider = trace_sdk.TracerProvider()
tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint)))
# Optionally, you can also print the spans to the console.
tracer_provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
trace_api.set_tracer_provider(tracer_provider)

CrewAIInstrumentor().instrument()
LangChainInstrumentor().instrument()

if __name__ == "__main__":
  import os
  from crewai import Agent, Task, Crew, Process
  from crewai_tools import SerperDevTool
  
  os.environ["OPENAI_API_KEY"] = "YOUR_OPENAI_API_KEY"
  os.environ["SERPER_API_KEY"] = "YOUR_SERPER_API_KEY" 
  search_tool = SerperDevTool()
  
  # Define your agents with roles and goals
  researcher = Agent(
    role='Senior Research Analyst',
    goal='Uncover cutting-edge developments in AI and data science',
    backstory="""You work at a leading tech think tank.
    Your expertise lies in identifying emerging trends.
    You have a knack for dissecting complex data and presenting actionable insights.""",
    verbose=True,
    allow_delegation=False,
    # You can pass an optional llm attribute specifying what model you wanna use.
    # llm=ChatOpenAI(model_name="gpt-3.5", temperature=0.7),
    tools=[search_tool]
  )
  writer = Agent(
    role='Tech Content Strategist',
    goal='Craft compelling content on tech advancements',
    backstory="""You are a renowned Content Strategist, known for your insightful and engaging articles.
    You transform complex concepts into compelling narratives.""",
    verbose=True,
    allow_delegation=True
  )
  
  # Create tasks for your agents
  task1 = Task(
    description="""Conduct a comprehensive analysis of the latest advancements in AI in 2024.
    Identify key trends, breakthrough technologies, and potential industry impacts.""",
    expected_output="Full analysis report in bullet points",
    agent=researcher
  )
  
  task2 = Task(
    description="""Using the insights provided, develop an engaging blog
    post that highlights the most significant AI advancements.
    Your post should be informative yet accessible, catering to a tech-savvy audience.
    Make it sound cool, avoid complex words so it doesn't sound like AI.""",
    expected_output="Full blog post of at least 4 paragraphs",
    agent=writer
  )
  
  # Instantiate your crew with a sequential process
  crew = Crew(
    agents=[researcher, writer],
    tasks=[task1, task2],
    verbose=2, # You can set it to 1 or 2 to different logging levels
    process = Process.sequential
  )

  # Get your crew to work!
  result = crew.kickoff()
  
  print("######################")
  print(result)

```

Run the python file and observe the traces in Phoenix.

```
python your_file.py
```
