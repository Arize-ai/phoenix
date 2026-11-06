/**
 * Creates a Proxy that wraps an object to stringify nested object values when accessed directly.
 * This allows Mustache to access properties of objects (e.g., {{user.name}}) while
 * stringifying objects that are accessed as leaf values (e.g., {{user.profile}}).
 */
export function createTemplateVariablesProxy<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(createTemplateVariablesProxy) as T;
  }

  if (typeof obj === "object") {
    return new Proxy(obj, {
      get(target, prop: string | symbol) {
        // Handle toString and valueOf to stringify the object when accessed directly
        if (prop === "toString") {
          return () => JSON.stringify(target);
        }
        if (prop === "valueOf") {
          return () => JSON.stringify(target);
        }

        if (typeof prop !== "string") {
          return Reflect.get(target, prop);
        }

        const value = Reflect.get(target, prop);

        // If the value is an object (not array, not null), wrap it in a proxy
        // so it can be stringified if accessed directly, or have its properties accessed
        if (
          value !== null &&
          typeof value === "object" &&
          !Array.isArray(value)
        ) {
          return createTemplateVariablesProxy(value);
        }

        return value;
      },
      // Override valueOf and toString to stringify the object when Mustache tries to render it directly
      // Mustache will call toString() when it needs to render an object as a string
      has(target, prop) {
        if (prop === "toString" || prop === "valueOf") {
          return true;
        }
        return Reflect.has(target, prop);
      },
      ownKeys(target) {
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor(target, prop) {
        if (prop === "toString") {
          return {
            enumerable: false,
            configurable: true,
            value: () => JSON.stringify(target),
          };
        }
        return Reflect.getOwnPropertyDescriptor(target, prop);
      },
    });
  }

  return obj;
}
