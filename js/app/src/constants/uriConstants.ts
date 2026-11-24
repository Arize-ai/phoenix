// URI-safe pattern: allows letters, numbers, hyphens, underscores, and dots
export const URI_SAFE_PATTERN = /^[a-zA-Z0-9._-]+$/;

// URI-safe names must start and end with a letter or digit
export const URI_SAFE_LEADING_AND_TRAILING_PATTERN =
  /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;

export const URI_SAFE_LEADING_AND_TRAILING_MESSAGE =
  "Must start and end with a letter or number";
