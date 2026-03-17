export function getOtelInitCodePython({
  projectName,
}: {
  projectName: string;
}): string {
  return `from phoenix.otel import register\n
tracer_provider = register(
  project_name="${projectName}",
  auto_instrument=True
)`;
}

export function getOtelInitCodeTypescript({
  projectName,
}: {
  projectName: string;
}): string {
  return `import { register } from '@arizeai/phoenix-otel';

register({
  projectName: '${projectName}',
});`;
}
