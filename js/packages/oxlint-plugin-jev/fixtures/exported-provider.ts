import { register } from "@arizeai/phoenix-otel";

// Another module imports `provider` and shuts it down; nothing to judge here.
export const provider = register({ projectName: "exported" });
