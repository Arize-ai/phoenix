import { Template } from "../types/templating";

import Mustache from "mustache";

/**
 * A function that applies a set of variables to a template (e.g. a prompt)
 * Uses the Mustache library to apply the variables to the template
 */
export function formatTemplate(args: {
  template: Template;
  variables: Record<string, unknown>;
}) {
  const { template, variables } = args;
  // Disable HTML escaping by providing a custom escape function that returns text as-is
  return Mustache.render(template, variables, {}, { escape: (text) => text });
}
