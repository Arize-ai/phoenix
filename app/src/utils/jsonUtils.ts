export function isJsonString(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }
  try {
    JSON.parse(value);
  } catch (e) {
    return false;
  }
  return true;
}
