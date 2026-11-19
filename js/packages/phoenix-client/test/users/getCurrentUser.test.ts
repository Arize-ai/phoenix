import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { HttpError } from "../../src/errors";
import type { CurrentUser } from "../../src/users";
import { getCurrentUser } from "../../src/users";
import { createTestClient } from "../testUtils";

const http = createHttp();

let server: Server;

beforeAll(async () => {
  server = await createMockServer();
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe("getCurrentUser", () => {
  it("returns the generated authenticated-user shape", async () => {
    const currentUser: CurrentUser = {
      id: "user-1",
      created_at: "2026-08-29T12:00:00Z",
      updated_at: "2026-08-29T12:00:00Z",
      email: "member@example.com",
      username: "member",
      role: "MEMBER",
      auth_method: "LOCAL",
      password_needs_reset: false,
    };

    server.use(
      http.get("/v1/user", ({ response }) =>
        response(200).json({ data: currentUser })
      )
    );

    await expect(
      getCurrentUser({ client: createTestClient() })
    ).resolves.toEqual(currentUser);
  });

  it("returns the anonymous user when authentication is disabled", async () => {
    server.use(
      http.get("/v1/user", ({ response }) =>
        response(200).json({ data: { auth_method: "ANONYMOUS" } })
      )
    );

    await expect(
      getCurrentUser({ client: createTestClient() })
    ).resolves.toEqual({ auth_method: "ANONYMOUS" });
  });

  it.each([401, 403] as const)(
    "surfaces a %i authentication error as HttpError",
    async (status) => {
      server.use(
        http.get("/v1/user", ({ response }) =>
          response(status).text(
            status === 401 ? "Not authenticated" : "Forbidden"
          )
        )
      );

      const promise = getCurrentUser({ client: createTestClient() });

      await expect(promise).rejects.toMatchObject({ status });
      await expect(promise).rejects.toBeInstanceOf(HttpError);
    }
  );
});
