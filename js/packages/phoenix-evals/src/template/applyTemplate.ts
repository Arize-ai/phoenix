import { Template } from "../types/templating";
import { render } from "mustache";

/**
 * A function that applies a set of variables to a template (e.g. a prompt)
 */
export function formatTemplate(args: {
  template: Template;
  variables: Record<string, unknown>;
}) {
  const { template, variables } = args;
  return render(template, variables);
}
