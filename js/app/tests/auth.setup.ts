import fs from "fs/promises";
import type { Page } from "@playwright/test";
import { expect, test as setup } from "@playwright/test";

// The app-frame project runs against its own Phoenix server (fresh database,
// different signing secret), so its setup persists to a separate directory —
// storage states are only valid against the server that issued them.
const AUTH_DIR = "playwright/.auth";
const APP_FRAME_AUTH_DIR = `${AUTH_DIR}/app-frame`;

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
  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/auth/login") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  return await loginResponse;
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

async function logout({ page }: { page: Page }) {
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Log Out" }).click();
}

async function getUserEmails({
  page,
  baseURL,
}: {
  page: Page;
  baseURL: string;
}) {
  const response = await page.request.post(`${baseURL}/graphql`, {
    data: {
      // Explicit null removes the default 50-user limit for reused test servers.
      query: `query AuthSetupUsers {
        users(first: null) {
          edges {
            node {
              email
            }
          }
        }
      }`,
    },
  });
  expect(response.ok()).toBe(true);
  const result = (await response.json()) as {
    data: { users: { edges: { node: { email: string | null } }[] } };
    errors?: { message: string }[];
  };
  expect(result.errors).toBeUndefined();
  return new Set(result.data.users.edges.map(({ node }) => node.email));
}

async function resetDefaultPasswordAndReLogin({
  page,
  baseURL,
  email,
  currentPassword,
  newPassword,
}: {
  page: Page;
  baseURL: string;
  email: string;
  currentPassword: string;
  newPassword: string;
}) {
  const response = await login({
    page,
    baseURL,
    email,
    password: currentPassword,
  });
  if (response.status() === 401) {
    await login({ page, baseURL, email, password: newPassword });
    await page.waitForURL(/\/projects(\?|$)/);
    return;
  }
  await page.waitForURL(/\/reset-password-with-token\?/);
  await page.getByLabel("New Password").fill(newPassword);
  await page.getByLabel("Confirm Password").fill(newPassword);
  await page.getByRole("button", { name: "Reset Password" }).click();
  await page.waitForURL("**/login?message=password_reset");
  await login({ page, baseURL, email, password: newPassword });
  await page.waitForURL(/\/projects(\?|$)/);
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

setup(
  "authenticate and persist role storage states",
  async ({ browser, baseURL }, testInfo) => {
    if (!baseURL) {
      throw new Error("Playwright baseURL must be configured.");
    }

    const authDir =
      testInfo.project.name === "app-frame-setup"
        ? APP_FRAME_AUTH_DIR
        : AUTH_DIR;
    const adminStorageState = `${authDir}/admin.json`;
    const memberStorageState = `${authDir}/member.json`;
    const viewerStorageState = `${authDir}/viewer.json`;

    await fs.mkdir(authDir, { recursive: true });

    const bootstrapContext = await browser.newContext();
    const page = await bootstrapContext.newPage();

    await resetDefaultPasswordAndReLogin({
      page,
      baseURL,
      email: "admin@localhost",
      currentPassword: "admin",
      newPassword: "admin123",
    });
    const userEmails = await getUserEmails({ page, baseURL });
    await page.goto(`${baseURL}/settings/users`);
    await page.waitForURL("**/settings/users");

    if (!userEmails.has("member@localhost.com")) {
      await page.getByRole("button", { name: "Add User" }).click();
      await page.getByLabel("Email").fill("member@localhost.com");
      await page.getByLabel("Username").fill("member");
      await page.getByLabel("Password", { exact: true }).fill("member");
      await page.getByLabel("Confirm Password").fill("member");
      await page
        .getByRole("dialog")
        .getByLabel("member", { exact: true })
        .click();
      await page.getByRole("option", { name: "member" }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Add User" })
        .click();
      await expect(page.getByTestId("dialog")).not.toBeVisible();
    }

    if (!userEmails.has("viewer@localhost.com")) {
      await page.getByRole("button", { name: "Add User" }).click();
      await page.getByLabel("Email").fill("viewer@localhost.com");
      await page.getByLabel("Username").fill("viewer");
      await page.getByLabel("Password", { exact: true }).fill("viewer");
      await page.getByLabel("Confirm Password").fill("viewer");
      await page
        .getByRole("dialog")
        .getByLabel("member", { exact: true })
        .click();
      await page.getByRole("option", { name: "viewer" }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Add User" })
        .click();
      await expect(page.getByTestId("dialog")).not.toBeVisible();
    }

    await logout({ page });

    const memberLoginResponse = await login({
      page,
      baseURL,
      email: "member@localhost.com",
      password: "member",
    });
    if (memberLoginResponse.status() !== 401) {
      await resetPasswordAndReLogin({
        page,
        baseURL,
        email: "member@localhost.com",
        oldPassword: "member",
        newPassword: "member123",
      });
      await logout({ page });
    }

    const viewerLoginResponse = await login({
      page,
      baseURL,
      email: "viewer@localhost.com",
      password: "viewer",
    });
    if (viewerLoginResponse.status() !== 401) {
      await resetPasswordAndReLogin({
        page,
        baseURL,
        email: "viewer@localhost.com",
        oldPassword: "viewer",
        newPassword: "viewer123",
      });
    }
    await bootstrapContext.close();

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
      storageStatePath: adminStorageState,
    });
    await saveStorageStateForUser({
      email: "member@localhost.com",
      password: "member123",
      storageStatePath: memberStorageState,
    });
    await saveStorageStateForUser({
      email: "viewer@localhost.com",
      password: "viewer123",
      storageStatePath: viewerStorageState,
    });
  }
);
