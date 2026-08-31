import { authFetch, isRedirectingToLoginError } from "@phoenix/authFetch";
vi.mock("@phoenix/config");

describe("authFetch", () => {
  const _fetch = global.fetch;
  afterEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = _fetch;
  });
  it("should call fetch with the provided input and init", async () => {
    // @ts-expect-error mock global fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ data: "12345" }),
      })
    );

    const response = await authFetch("/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ test: "test" }),
    }).then((res) => res.json());

    expect(response).toEqual({ data: "12345" });
  });
  it("should try to refresh the tokens if it gets a 401", async () => {
    let count = 0;
    // @ts-expect-error mock global fetch
    global.fetch = vi.fn(() => {
      count += 1;
      return Promise.resolve({
        status: count === 1 ? 401 : 200,
        ok: count === 1 ? false : true,
        json: () => Promise.resolve(),
      });
    });

    await authFetch("/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ test: "test" }),
    });

    expect(count).toBe(3);
    // @ts-expect-error mock global fetch
    expect(global.fetch.mock.calls[0][0]).toBe("/test");
    // @ts-expect-error mock global fetch
    expect(global.fetch.mock.calls[1][0]).toBe("http://localhost/auth/refresh");
    // @ts-expect-error mock global fetch
    expect(global.fetch.mock.calls[2][0]).toBe("/test");
  });
  it("rejects with a RedirectingToLoginError when the token refresh fails", async () => {
    // Every request 401s: the original request triggers a refresh, and the
    // refresh itself fails, so the browser is pointed at the login page.
    // @ts-expect-error mock global fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        status: 401,
        ok: false,
      })
    );

    await expect(authFetch("/test")).rejects.toSatisfy(
      isRedirectingToLoginError
    );

    // @ts-expect-error mock global fetch
    expect(global.fetch.mock.calls[1][0]).toBe("http://localhost/auth/refresh");
  });
});
