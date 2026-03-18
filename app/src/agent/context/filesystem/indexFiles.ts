export function createIndexFile(payload: Record<string, unknown>) {
  return JSON.stringify(payload, null, 2);
}
