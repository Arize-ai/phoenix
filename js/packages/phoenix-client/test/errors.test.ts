import { describe, expect, it } from "vitest";

import { HttpError, readProblemDetail } from "../src";

function response(
  body: string,
  init: { status: number; statusText?: string; contentType: string }
): Response {
  return new Response(body, {
    status: init.status,
    statusText: init.statusText,
    headers: { "content-type": init.contentType },
  });
}

describe("readProblemDetail", () => {
  it("parses a well-formed problem", async () => {
    const problem = await readProblemDetail(
      response(
        JSON.stringify({
          type: "urn:phoenix:problem:already_exists",
          title: "Already exists",
          status: 409,
          detail: "taken",
          code: "already_exists",
          existing_id: "RXZhbHVhdG9yOjE=",
        }),
        { status: 409, contentType: "application/problem+json" }
      )
    );
    expect(problem).toEqual({
      type: "urn:phoenix:problem:already_exists",
      title: "Already exists",
      status: 409,
      detail: "taken",
      code: "already_exists",
      existing_id: "RXZhbHVhdG9yOjE=",
    });
  });

  it("passes an unknown reason and extension members through unread", async () => {
    const problem = await readProblemDetail(
      response(
        JSON.stringify({
          type: "urn:phoenix:problem:conflict",
          title: "Conflict",
          status: 409,
          detail: "changed",
          code: "conflict",
          reason: "some_future_reason",
          a_future_field: { nested: true },
        }),
        { status: 409, contentType: "application/problem+json" }
      )
    );
    expect(problem?.reason).toBe("some_future_reason");
    expect(problem?.a_future_field).toEqual({ nested: true });
  });

  it("returns undefined for the right content type but a malformed body", async () => {
    const problem = await readProblemDetail(
      response(JSON.stringify({ error: "something broke" }), {
        status: 500,
        contentType: "application/problem+json",
      })
    );
    expect(problem).toBeUndefined();
  });

  it("returns undefined for a non-JSON proxy page", async () => {
    const problem = await readProblemDetail(
      response("<html><body>502 Bad Gateway</body></html>", {
        status: 502,
        contentType: "text/html",
      })
    );
    expect(problem).toBeUndefined();
  });
});

describe("HttpError", () => {
  it("keeps the original status and statusText when there is no problem", () => {
    const error = new HttpError(
      response("<html>502</html>", {
        status: 502,
        statusText: "Bad Gateway",
        contentType: "text/html",
      })
    );
    expect(error.status).toBe(502);
    expect(error.statusText).toBe("Bad Gateway");
    expect(error.problem).toBeUndefined();
  });

  it("summarizes reason and existing_id in the message", () => {
    const problem = {
      type: "urn:phoenix:problem:already_exists",
      title: "Already exists",
      status: 409,
      detail: "taken",
      code: "already_exists",
      existing_id: "RXZhbHVhdG9yOjE=",
    };
    const error = new HttpError(
      response(JSON.stringify(problem), {
        status: 409,
        statusText: "Conflict",
        contentType: "application/problem+json",
      }),
      problem
    );
    expect(error.message).toContain("[already_exists] taken");
    expect(error.message).toContain("existing_id: RXZhbHVhdG9yOjE=");
  });
});
