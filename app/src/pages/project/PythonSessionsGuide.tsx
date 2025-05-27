import { ExternalLink, Heading, Text, View } from "@phoenix/components";
import { CodeWrap, PythonBlockWithCopy } from "@phoenix/components/code";

const INSTALL_OPENINFERENCE_INSTRUMENTATION_PYTHON = `pip install openinference-instrumentation`;
const ADD_SESSION_ID_PYTHON = `import uuid

import openai
from openinference.instrumentation import using_session
from openinference.semconv.trace import SpanAttributes
from opentelemetry import trace

client = openai.Client()
session_id = str(uuid.uuid4())

tracer = trace.get_tracer(__name__)

@tracer.start_as_current_span(name="agent", attributes={SpanAttributes.OPENINFERENCE_SPAN_KIND: "agent"})
def assistant(
  messages: list[dict],
  session_id: str = str,
):
  current_span = trace.get_current_span()
  current_span.set_attribute(SpanAttributes.SESSION_ID, session_id)
  current_span.set_attribute(SpanAttributes.INPUT_VALUE, messages[-1].get('content'))

  # Propagate the session_id down to spans crated by the OpenAI instrumentation
  # This is not strictly necessary, but it helps to correlate the spans to the same session
  with using_session(session_id):
   response = client.chat.completions.create(
       model="gpt-3.5-turbo",
       messages=[{"role": "system", "content": "You are a helpful assistant."}] + messages,
   ).choices[0].message

  current_span.set_attribute(SpanAttributes.OUTPUT_VALUE, response.content)
  return response

messages = [
  {"role": "user", "content": "hi! im bob"}
]
response = assistant(
  messages,
  session_id=session_id,
)
messages = messages + [
  response,
  {"role": "user", "content": "what's my name?"}
]
response = assistant(
  messages,
  session_id=session_id,
)`;

export function PythonSessionsGuide() {
  return (
    <div>
      <View paddingTop="size-200" paddingBottom="size-100">
        <Heading level={2} weight="heavy">
          Install Dependencies
        </Heading>
      </View>
      <View paddingBottom="size-100">
        <Text>
          Sessions are tracked via the OpenTelemetry attribute <b>session.id</b>
          . The easiest way to get started with sessions is to use the
          OpenInference instrumentation package.
        </Text>
      </View>
      <CodeWrap>
        <PythonBlockWithCopy
          value={INSTALL_OPENINFERENCE_INSTRUMENTATION_PYTHON}
        />
      </CodeWrap>
      <View paddingTop="size-200" paddingBottom="size-100">
        <Heading level={2} weight="heavy">
          Add Session ID to your Traces
        </Heading>
      </View>
      <View paddingBottom="size-100">
        <Text>
          Below is an example of how to add session IDs to a simple OpenAI
          application.
        </Text>
      </View>
      <CodeWrap>
        <PythonBlockWithCopy value={ADD_SESSION_ID_PYTHON} />
      </CodeWrap>
      <View paddingBottom="size-100" paddingTop="size-100">
        <Text>
          For more information on how to use sessions, consult the{" "}
          <ExternalLink href="https://docs.arize.com/phoenix/tracing/how-to-tracing/setup-sessions">
            documentation
          </ExternalLink>
        </Text>
      </View>
    </div>
  );
}
