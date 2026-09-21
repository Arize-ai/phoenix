import { randomUUID } from "node:crypto";
import { withSpan } from "@arizeai/openinference-core";

export const SESSION_ID = randomUUID();

// Anti-pattern from the sessions guidance: a wrapper whose only job is to
// inject session.id.
export function withSessionTracking<T extends (...args: never[]) => unknown>(
  fn: T,
  name: string
) {
  return withSpan(fn, {
    name,
    kind: "CHAIN",
    attributes: { "session.id": SESSION_ID },
  });
}
