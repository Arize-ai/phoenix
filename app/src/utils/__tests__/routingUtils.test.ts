import {
  createRedirectUrlWithReturn,
  createReturnUrlQueryParam,
  getReturnUrl,
  sanitizeUrl,
} from "../routingUtils";

const maliciousURLS = [
  "https://google.com",
  "http://badsite.io",
  "badsite.io",
  "//bin",
  // Backslash are interpreted as slash by browsers
  "/\\bin",
  "\\\\bin",
];

const validURLs = [
  "/account",
  "/organizations/QWNjb3VudE9yZ2FuaXphdGlvbjoxNTg=/spaces/U3BhY2U6MTU4",
];
describe("routingUtils", () => {
  let windowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    windowSpy = vi.spyOn(window, "location", "get");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });
  describe("sanitizeRedirectUrl", () => {
    test.each(maliciousURLS)("%s is invalid - route to root", (url) => {
      expect(sanitizeUrl(url)).toEqual("/");
    });

    test.each(validURLs)("%s is valid - route to passed value", (url) => {
      expect(sanitizeUrl(url)).toEqual(url);
    });
  });

  describe("getReturnUrl", () => {
    it("should return the returnUrl from the query string", () => {
      const returnUrl = "/account";
      windowSpy.mockReturnValueOnce({
        href: `http://localhost:6006?returnUrl=${returnUrl}`,
      });
      expect(getReturnUrl()).toEqual(returnUrl);
    });

    it("should return the returnUrl from the query string with a query param", () => {
      const returnUrl = "/account";
      windowSpy.mockReturnValueOnce({
        href: `http://localhost:6006?returnUrl=${returnUrl}&test=true`,
      });
      expect(getReturnUrl()).toEqual(returnUrl);
    });

    it("should return the returnUrl from the query string with a query param and hash", () => {
      const returnUrl = "/account";
      windowSpy.mockReturnValueOnce({
        href: `http://localhost:6006?returnUrl=${returnUrl}&test=true#test`,
      });
      expect(getReturnUrl()).toEqual(returnUrl);
    });

    it("should sanitize the returnUrl from the query string", () => {
      const returnUrl = "https://google.com";
      windowSpy.mockReturnValueOnce({
        href: `http://localhost:6006?returnUrl=${returnUrl}`,
      });
      expect(getReturnUrl()).toEqual("/");
    });
  });

  describe("createRedirectUrlWithReturn", () => {
    it("should append the returnUrl to the path", () => {
      const path = "/login";
      const returnUrl = "/projects/QWNjb3VudE9yZGluaXphdGlvbjoxNTg=";
      windowSpy.mockReturnValueOnce({
        href: `http://localhost:6006?returnUrl=${returnUrl}`,
      });
      expect(createRedirectUrlWithReturn({ path })).toEqual(
        `${path}?returnUrl=${encodeURIComponent(returnUrl)}`
      );
    });

    it("should just return the path if there is no returnUrl param", () => {
      const path = "/account?test=true";
      expect(createRedirectUrlWithReturn({ path })).toEqual(path);
    });

    it("should support additional params", () => {
      const path = "/login";
      expect(
        createRedirectUrlWithReturn({
          path,
          searchParams: {
            message: "Password has been reset.",
          },
        })
      ).toEqual(`${path}?message=Password+has+been+reset.`);
    });
  });

  describe("createReturnUrlQueryParam", () => {
    it("should return the returnUrl query param, with the current pathname and search params", () => {
      windowSpy.mockReturnValue({
        pathname: "/account",
        search: "?test=true",
      });
      expect(createReturnUrlQueryParam()).toEqual(
        `returnUrl=%2Faccount%3Ftest%3Dtrue`
      );
    });
  });
});
