export function getOtelInitCodePython({
  projectName,
}: {
  projectName: string;
}): string {
  return `from phoenix.otel import register

tracer_provider = register(
  project_name="${projectName}",
)

tracer = tracer_provider.get_tracer(__name__)

@tracer.chain
def my_function(input: str) -> str:
    # Your logic here
    return f"Processed: {input}"

my_function("hello world")`;
}

export function getOtelInitCodeTypescript({
  projectName,
}: {
  projectName: string;
}): string {
  return `import { register } from "@arizeai/phoenix-otel";
import { traceChain } from "@arizeai/openinference-core";

const provider = register({
  projectName: "${projectName}",
});

const myFunction = traceChain(
  (input: string): string => {
    // Your logic here
    return \`Processed: \${input}\`;
  },
  { name: "my-function" }
);

myFunction("hello world");

// Flush pending traces before the process exits
await provider.forceFlush();`;
}
