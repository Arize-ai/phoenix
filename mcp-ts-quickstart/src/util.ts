export const objectToMessage = (obj: Record<string, unknown>) => {
  return Object.entries(obj)
    .map(
      ([key, value]) =>
        `${key.slice(0, 1).toUpperCase() + key.slice(1)}: ${value}`,
    )
    .join("\n");
};
