import path from "path";

const APP_DIR = path.resolve(__dirname, "..");

export const AUTH_DIR = path.resolve(APP_DIR, "playwright/.auth");
export const ADMIN_STORAGE_STATE_PATH = path.join(AUTH_DIR, "admin.json");
export const MEMBER_STORAGE_STATE_PATH = path.join(AUTH_DIR, "member.json");
export const VIEWER_STORAGE_STATE_PATH = path.join(AUTH_DIR, "viewer.json");
