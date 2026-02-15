import { type Browser, chromium, expect, type FullConfig, type Page } from "@playwright/test";
import fs from "fs/promises";
import path from "path";

const AUTH_DIR = path.join(__dirname, "playwright", ".auth");
const ADMIN_STORAGE_STATE = path.join(AUTH_DIR, "admin.json");
const MEMBER_STORAGE_STATE = path.join(AUTH_DIR, "member.json");
const VIEWER_STORAGE_STATE = path.join(AUTH_DIR, "viewer.json");

type UserCredentials = {
  email: string;
  password: string;
};

async function loginWithCredentials({
  page,
  baseURL,
  credentials,
  destinationURLPattern = "**/projects",
}: {
  page: Page;
  baseURL: string;
  credentials: UserCredentials;
  destinationURLPattern?: string;
}) {
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await page.waitForURL(destinationURLPattern);
}

async function saveStorageState({
  browser,
  baseURL,
  credentials,
  storageStatePath,
}: {
  browser: Browser;
  baseURL: string;
  credentials: UserCredentials;
  storageStatePath: string;
}) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginWithCredentials({ page, baseURL, credentials });
  await context.storageState({ path: storageStatePath });

  await context.close();
}

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  if (typeof baseURL !== "string") {
    throw new Error("Playwright baseURL must be configured for global setup.");
  }

  await fs.mkdir(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginWithCredentials({
    page,
    baseURL,
    credentials: {
      email: "admin@localhost",
      password: "admin",
    },
    destinationURLPattern: "**/reset-password",
  });

  // Reset admin password
  await page.waitForURL("**/reset-password");
  await page.getByLabel("Old Password").fill("admin");
  await page.getByLabel("New Password").fill("admin123");
  await page.getByLabel("Confirm Password").fill("admin123");
  await page.getByRole("button", { name: "Reset Password" }).click();
  await loginWithCredentials({
    page,
    baseURL,
    credentials: {
      email: "admin@localhost",
      password: "admin123",
    },
  });
  await page.goto(`${baseURL}/settings/general`);
  await page.waitForURL("**/settings/general");

  // Add member user
  await page.getByRole("button", { name: "Add User" }).click();
  await page.getByLabel("Email").fill("member@localhost.com");
  await page.getByLabel("Username").fill("member");
  await page.getByLabel("Password", { exact: true }).fill("member");
  await page.getByLabel("Confirm Password").fill("member");

  await page.getByRole("dialog").getByLabel("member", { exact: true }).click();
  await page.getByRole("option", { name: "member" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add User" })
    .click();

  // Wait for dialog to close before opening a new one
  await expect(page.getByTestId("dialog")).not.toBeVisible();

  // Add viewer user
  await page.getByRole("button", { name: "Add User" }).click();
  await page.getByLabel("Email").fill("viewer@localhost.com");
  await page.getByLabel("Username").fill("viewer");
  await page.getByLabel("Password", { exact: true }).fill("viewer");
  await page.getByLabel("Confirm Password").fill("viewer");

  await page.getByRole("dialog").getByLabel("member", { exact: true }).click();
  await page.getByRole("option", { name: "viewer" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add User" })
    .click();

  // Wait for dialog to close before proceeding
  await expect(page.getByTestId("dialog")).not.toBeVisible();

  // Log out of admin account
  await page.getByRole("button", { name: "Log Out" }).click();

  // Log in as member
  await loginWithCredentials({
    page,
    baseURL,
    credentials: {
      email: "member@localhost.com",
      password: "member",
    },
    destinationURLPattern: "**/reset-password",
  });

  // Reset member password
  await page.waitForURL("**/reset-password");
  await page.getByLabel("Old Password").fill("member");
  await page.getByLabel("New Password").fill("member123");
  await page.getByLabel("Confirm Password").fill("member123");
  await page.getByRole("button", { name: "Reset Password" }).click();

  // Log in as viewer
  await loginWithCredentials({
    page,
    baseURL,
    credentials: {
      email: "viewer@localhost.com",
      password: "viewer",
    },
    destinationURLPattern: "**/reset-password",
  });

  // Reset viewer password
  await page.waitForURL("**/reset-password");
  await page.getByLabel("Old Password").fill("viewer");
  await page.getByLabel("New Password").fill("viewer123");
  await page.getByLabel("Confirm Password").fill("viewer123");
  await page.getByRole("button", { name: "Reset Password" }).click();

  await saveStorageState({
    browser,
    baseURL,
    credentials: { email: "admin@localhost", password: "admin123" },
    storageStatePath: ADMIN_STORAGE_STATE,
  });
  await saveStorageState({
    browser,
    baseURL,
    credentials: { email: "member@localhost.com", password: "member123" },
    storageStatePath: MEMBER_STORAGE_STATE,
  });
  await saveStorageState({
    browser,
    baseURL,
    credentials: { email: "viewer@localhost.com", password: "viewer123" },
    storageStatePath: VIEWER_STORAGE_STATE,
  });

  await context.close();
  await browser.close();
}

export default globalSetup;
