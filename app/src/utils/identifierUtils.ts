const identifierRegex = /^[a-z0-9]([_a-z0-9-]*[a-z0-9])?$/;

export const identifierPattern = {
  value: identifierRegex,
  message:
    "Invalid identifier. Must be alphanumeric and with dashes or underscores",
};
