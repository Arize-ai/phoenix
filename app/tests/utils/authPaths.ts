import path from "path";

export const AUTH_DIR = path.resolve(__dirname, "../../playwright/.auth");

export const ADMIN_STORAGE_STATE = path.join(AUTH_DIR, "admin.json");
export const MEMBER_STORAGE_STATE = path.join(AUTH_DIR, "member.json");
export const VIEWER_STORAGE_STATE = path.join(AUTH_DIR, "viewer.json");
