import { data } from "react-router";

export type NotFoundErrorData =
  | { kind: "entity"; entityType: string; identifier?: string }
  | { kind: "project-onboarding"; projectName: string };

export function notFound(payload: NotFoundErrorData) {
  return data(payload, { status: 404 });
}
