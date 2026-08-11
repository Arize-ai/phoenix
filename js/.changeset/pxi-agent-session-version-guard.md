---
"@arizeai/phoenix-client": minor
"@arizeai/phoenix-cli": minor
---

Re-enable the PXI agent-session server version guard. PXI now fails fast at startup with a clear upgrade message when the connected Phoenix server predates the agent-session chat contract (server < 20.0.0), instead of 404ing on the first send. phoenix-client adds capability requirements for the remaining agent-session routes (list, get, patch, compact, tool outputs), exports all agent-session requirements from the package root, and routes `getServerVersion` through the client's configured fetch.
