export const SECRET_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const SecretOwnerFilterOptions = [
  { label: "All", id: "ALL" },
  { label: "Created by me", id: "MINE" },
] as const;
