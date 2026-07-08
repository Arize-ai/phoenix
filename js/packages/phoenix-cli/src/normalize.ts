function formatValueForError({ value }: { value: number | string }): string {
  if (typeof value === "number") {
    return String(value);
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : "<empty>";
}

export function trimToUndefined({
  value,
}: {
  value?: string;
}): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export function parseNumber({
  rawValue,
  inputName,
}: {
  rawValue: number | string;
  inputName: string;
}): number {
  if (typeof rawValue === "number") {
    if (Number.isFinite(rawValue)) {
      return rawValue;
    }
  } else {
    const trimmedValue = rawValue.trim();
    const parsedValue = Number(trimmedValue);
    if (trimmedValue.length > 0 && Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  throw new Error(
    `Invalid value for ${inputName}: ${formatValueForError({ value: rawValue })}. Expected a finite number.`
  );
}
