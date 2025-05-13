import { ExternalLink, Heading, Text, View } from "@phoenix/components";
import { CodeWrap, PythonBlockWithCopy } from "@phoenix/components/code";
import { TypeScriptBlockWithCopy } from "@phoenix/components/code/TypeScriptBlockWithCopy";

const INSTALL_OPENINFERENCE_CORE_TYPESCRIPT = `npm install @arizeai/openinference-core --save`;

const ADD_SESSION_ID_TYPESCRIPT = `import { trace } from "@opentelemetry/api";
import { SemanticConventions } from "@arizeai/openinference-semantic-conventions";
import { context } from "@opentelemetry/api";
import { setSession } from "@arizeai/openinference-core";

const tracer = trace.getTracer("agent");

const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"], // This is the default and can be omitted
});

async function assistant(params: {
  messages: { role: string; content: string }[];
  sessionId: string;
}) {
  return tracer.startActiveSpan("agent", async (span: Span) => {
    span.setAttribute(SemanticConventions.OPENINFERENCE_SPAN_KIND, "agent");
    span.setAttribute(SemanticConventions.SESSION_ID, params.sessionId);
    span.setAttribute(
      SemanticConventions.INPUT_VALUE,
      messages[messages.length - 1].content,
    );
    try {
      // This is not strictly necessary but it helps propagate the session ID
      // to all child spans
      return context.with(
        setSession(context.active(), { sessionId: params.sessionId }),
        async () => {
          // Calls within this block will generate spans with the session ID set
          const chatCompletion = await client.chat.completions.create({
            messages: params.messages,
            model: "gpt-3.5-turbo",
          });
          const response = chatCompletion.choices[0].message;
          span.setAttribute(SemanticConventions.OUTPUT_VALUE, response.content);
          span.end();
          return response;
        },
      );
    } catch (e) {
      span.error(e);
    }
  });
}

const sessionId = crypto.randomUUID();

let messages = [{ role: "user", content: "hi! im Tim" }];

const res = await assistant({
  messages,
  sessionId: sessionId,
});

messages = [res, { role: "assistant", content: "What is my name?" }];

await assistant({
  messages,
  sessionId: sessionId,
});
`;

export function TypeScriptSessionsGuide() {
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
        <PythonBlockWithCopy value={INSTALL_OPENINFERENCE_CORE_TYPESCRIPT} />
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
        <TypeScriptBlockWithCopy value={ADD_SESSION_ID_TYPESCRIPT} />
      </CodeWrap>
      <View paddingBottom="size-100">
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
