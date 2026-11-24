export const SECRET_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * New secret keys must start with a letter and end with a letter or digit.
 * Stricter than the server, which also accepts leading and trailing
 * underscores, so existing keys keep working.
 */
export const SECRET_KEY_LEADING_AND_TRAILING_PATTERN =
  /^[A-Za-z]([A-Za-z0-9_]*[A-Za-z0-9])?$/;

export const SecretOwnerFilterOptions = [
  { label: "All", id: "ALL" },
  { label: "Created by me", id: "MINE" },
] as const;
