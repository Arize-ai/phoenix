import { AttributeValue } from "@opentelemetry/api";

export function objectAsAttributes<T extends Record<string, unknown>>(
  obj: T
): Record<string, AttributeValue> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== null)
  ) as Record<string, AttributeValue>;
}
