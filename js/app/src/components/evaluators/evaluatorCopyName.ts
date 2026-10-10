/**
 * The name for a copy of `base` that collides with none of `taken`:
 * `base_copy`, then `base_copy_1`, `base_copy_2`, and so on.
 */
export function getEvaluatorCopyName(
  base: string,
  taken: Iterable<string>
): string {
  const used = new Set(taken);
  const stem = `${base.trim()}_copy`;

  if (!used.has(stem)) return stem;

  for (let index = 1; ; index += 1) {
    const candidate = `${stem}_${index}`;

    if (!used.has(candidate)) return candidate;
  }
}
