/**
 * The applied condition a trace or session filter URL param carries.
 * Whitespace-only text is read as the empty condition, which is how the
 * editor settles it, so the two never disagree about what was applied.
 */
export function readFilterConditionParam(
  params: URLSearchParams,
  param: string
): string {
  const condition = params.get(param) ?? "";
  return condition.trim() === "" ? "" : condition;
}

/**
 * The params with an applied condition written to `param`. An absent param
 * and an empty condition mean the same thing on the traces and sessions tabs,
 * so clearing deletes the param.
 */
export function withFilterConditionParam(
  params: URLSearchParams,
  param: string,
  condition: string
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (condition === "") {
    next.delete(param);
  } else {
    next.set(param, condition);
  }
  return next;
}
