import fs from "fs/promises";
import type { Browser, Page } from "@playwright/test";
import { expect, test as setup } from "@playwright/test";

const AUTH_DIR = "playwright/.auth";
const ADMIN_STORAGE_STATE = `${AUTH_DIR}/admin.json`;
const MEMBER_STORAGE_STATE = `${AUTH_DIR}/member.json`;
const VIEWER_STORAGE_STATE = `${AUTH_DIR}/viewer.json`;

async function login({
  page,
  baseURL,
  email,
  password,
}: {
  page: Page;
  baseURL: string;
  email: string;
  password: string;
}) {
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log In", exact: true }).click();
}

async function resetPassword({
  page,
  oldPassword,
  newPassword,
}: {
  page: Page;
  oldPassword: string;
  newPassword: string;
}) {
  await page.waitForURL("**/reset-password");
  await page.getByLabel("Old Password").fill(oldPassword);
  await page.getByLabel("New Password").fill(newPassword);
  await page.getByLabel("Confirm Password").fill(newPassword);
  await page.getByRole("button", { name: "Reset Password" }).click();
}

async function resetPasswordAndReLogin({
  page,
  baseURL,
  email,
  oldPassword,
  newPassword,
}: {
  page: Page;
  baseURL: string;
  email: string;
  oldPassword: string;
  newPassword: string;
}) {
  await resetPassword({ page, oldPassword, newPassword });
  await page.waitForURL("**/login?message=password_reset");
  await login({ page, baseURL, email, password: newPassword });
  await page.waitForURL("**/projects");
}

type LoginOutcome = "projects" | "reset-password" | "unknown";

async function getLoginOutcome(page: Page): Promise<LoginOutcome> {
  try {
    await expect(page).toHaveURL(/\/projects(?:\?|$)/);
    return "projects";
  } catch {
    // fall through
  }
  try {
    await expect(page).toHaveURL(/\/reset-password(?:\?|$)/);
    return "reset-password";
  } catch {
    return "unknown";
  }
}

/**
 * Determine whether we can reuse existing users/passwords or need first-time bootstrap.
 *
 * - If admin/admin123 reaches /projects, the server is already bootstrapped.
 * - Otherwise we try admin/admin. If it lands on /reset-password, we bootstrap.
 * - Any other state is treated as an unexpected auth state and fails fast.
 */
async function detectBootstrapState({
  page,
  baseURL,
}: {
  page: Page;
  baseURL: string;
}): Promise<"already-bootstrapped" | "needs-bootstrap"> {
  await login({
    page,
    baseURL,
    email: "admin@localhost",
    password: "admin123",
  });
  const postBootstrapOutcome = await getLoginOutcome(page);
  if (postBootstrapOutcome === "projects") {
    return "already-bootstrapped";
  }

  await login({
    page,
    baseURL,
    email: "admin@localhost",
    password: "admin",
  });
  const initialOutcome = await getLoginOutcome(page);
  if (initialOutcome === "reset-password") {
    return "needs-bootstrap";
  }
  if (initialOutcome === "projects") {
    // Defensive: if defaults still work and already land on projects, we can reuse state.
    return "already-bootstrapped";
  }

  throw new Error(
    `Unable to determine bootstrap state. admin/admin123 outcome=${postBootstrapOutcome}, admin/admin outcome=${initialOutcome}.`
  );
}

async function bootstrapFreshServer({
  browser,
  baseURL,
}: {
  browser: Browser;
  baseURL: string;
}) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await login({
    page,
    baseURL,
    email: "admin@localhost",
    password: "admin",
  });
  await resetPasswordAndReLogin({
    page,
    baseURL,
    email: "admin@localhost",
    oldPassword: "admin",
    newPassword: "admin123",
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
  await expect(page.getByTestId("dialog")).not.toBeVisible();

  await page.getByRole("button", { name: "Log Out" }).click();

  await login({
    page,
    baseURL,
    email: "member@localhost.com",
    password: "member",
  });
  await resetPasswordAndReLogin({
    page,
    baseURL,
    email: "member@localhost.com",
    oldPassword: "member",
    newPassword: "member123",
  });
  await page.getByRole("button", { name: "Log Out" }).click();

  await login({
    page,
    baseURL,
    email: "viewer@localhost.com",
    password: "viewer",
  });
  await resetPasswordAndReLogin({
    page,
    baseURL,
    email: "viewer@localhost.com",
    oldPassword: "viewer",
    newPassword: "viewer123",
  });

  await ctx.close();
}

setup(
  "authenticate and persist role storage states",
  async ({ browser, baseURL }) => {
    if (!baseURL) {
      throw new Error("Playwright baseURL must be configured.");
    }

    await fs.mkdir(AUTH_DIR, { recursive: true });

    const probeCtx = await browser.newContext();
    const probePage = await probeCtx.newPage();
    const bootstrapState = await detectBootstrapState({
      page: probePage,
      baseURL,
    });
    await probeCtx.close();

    if (bootstrapState === "needs-bootstrap") {
      await bootstrapFreshServer({ browser, baseURL });
    }

    const saveStorageStateForUser = async ({
      email,
      password,
      storageStatePath,
    }: {
      email: string;
      password: string;
      storageStatePath: string;
    }) => {
      const context = await browser.newContext();
      const statePage = await context.newPage();

      await login({
        page: statePage,
        baseURL,
        email,
        password,
      });
      await statePage.waitForURL("**/projects");
      await context.storageState({ path: storageStatePath });

      await context.close();
    };

    await saveStorageStateForUser({
      email: "admin@localhost",
      password: "admin123",
      storageStatePath: ADMIN_STORAGE_STATE,
    });
    await saveStorageStateForUser({
      email: "member@localhost.com",
      password: "member123",
      storageStatePath: MEMBER_STORAGE_STATE,
    });
    await saveStorageStateForUser({
      email: "viewer@localhost.com",
      password: "viewer123",
      storageStatePath: VIEWER_STORAGE_STATE,
    });
  }
);
