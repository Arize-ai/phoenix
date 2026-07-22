import { describe, expect, it } from "vitest";

import { HeadlessInputError } from "../../src/setup/errors";
import {
  probeEndpoint,
  chooseEndpoint,
} from "../../src/setup/steps/chooseEndpoint";
import { buildFakeDeps, fakeFetch, jsonResponse } from "./fakes";

const ENDPOINT = "http://localhost:6006";

describe("probeEndpoint", () => {
  it("treats 200 with JSON as auth off", async () => {
    const deps = buildFakeDeps({
      fetch: fakeFetch(() => jsonResponse(200, { data: [] })),
    });
    expect(await probeEndpoint(deps, ENDPOINT)).toEqual({ kind: "authOff" });
  });

  it("treats 401 as auth on", async () => {
    const deps = buildFakeDeps({
      fetch: fakeFetch(() => jsonResponse(401, { detail: "unauthorized" })),
    });
    expect(await probeEndpoint(deps, ENDPOINT)).toEqual({ kind: "authOn" });
  });

  it("treats 403 as auth on (defensive)", async () => {
    const deps = buildFakeDeps({
      fetch: fakeFetch(() => jsonResponse(403, { detail: "forbidden" })),
    });
    expect(await probeEndpoint(deps, ENDPOINT)).toEqual({ kind: "authOn" });
  });

  it("treats connection failure as unreachable", async () => {
    const deps = buildFakeDeps({
      fetch: fakeFetch(() => {
        throw new TypeError("fetch failed: ECONNREFUSED");
      }),
    });
    const outcome = await probeEndpoint(deps, ENDPOINT);
    expect(outcome.kind).toBe("unreachable");
  });

  it("treats a 200 non-JSON body as not-Phoenix", async () => {
    const deps = buildFakeDeps({
      fetch: fakeFetch(() => new Response("<html>hi</html>", { status: 200 })),
    });
    const outcome = await probeEndpoint(deps, ENDPOINT);
    expect(outcome.kind).toBe("notPhoenix");
  });

  it("treats other statuses as not-Phoenix", async () => {
    const deps = buildFakeDeps({
      fetch: fakeFetch(() => jsonResponse(500, { detail: "boom" })),
    });
    const outcome = await probeEndpoint(deps, ENDPOINT);
    expect(outcome.kind).toBe("notPhoenix");
  });
});

describe("chooseEndpoint headless", () => {
  it("without an endpoint exits with remediation instead of prompting", async () => {
    const deps = buildFakeDeps();
    await expect(
      chooseEndpoint(deps, { presetEndpoint: undefined, headless: true })
    ).rejects.toThrow(HeadlessInputError);
  });

  it("rejects a scheme-less endpoint without probing anything", async () => {
    const requested: string[] = [];
    const deps = buildFakeDeps({
      fetch: fakeFetch((url) => {
        requested.push(url);
        return jsonResponse(200, { data: [] });
      }),
    });
    await expect(
      chooseEndpoint(deps, {
        presetEndpoint: "localhost:6006",
        headless: true,
      })
    ).rejects.toThrow(HeadlessInputError);
    expect(requested).toEqual([]);
  });
});
