import { register } from "@arizeai/phoenix-otel";

register({ projectName: "no-flush", batch: true });

export async function run() {
  return "done";
}
