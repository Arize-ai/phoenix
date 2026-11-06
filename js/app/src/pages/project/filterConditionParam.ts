/**
 * The condition a filter param carries. Whitespace-only reads as empty,
 * matching how the editor settles it.
 */
export function readFilterConditionParam(
  params: URLSearchParams,
  param: string
): string {
  const condition = params.get(param) ?? "";
  return condition.trim() === "" ? "" : condition;
}

/**
 * The params with `condition` written to `param`. An empty condition deletes
 * the param, since absent means empty.
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
