export enum UserRole {
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
  VIEWER = "VIEWER",
}

export function normalizeUserRole(role: string) {
  return role.toLocaleLowerCase();
}

export function isUserRole(role: unknown): role is UserRole {
  return typeof role === "string" && role in UserRole;
}
