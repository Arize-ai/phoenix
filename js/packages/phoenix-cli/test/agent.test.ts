import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildAgentRunRequest,
  createAgentCommand,
  readAgentStream,
} from "../src/commands/agent";

function makeSseStream({
  events,
}: {
  events: string[];
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event));
      }
      controller.close();
    },
  });
}

describe("buildAgentRunRequest", () => {
  it("builds the server-agent request body", () => {
    const request = buildAgentRunRequest({
      prompt: "Summarize recent trace failures",
      config: {
        endpoint: "http://localhost:6006/",
        apiKey: "secret-token",
        headers: {
          "X-Phoenix": "cli",
        },
      },
      provider: "OPENAI",
      modelName: "gpt-4.1",
      openaiApiType: "responses",
      sessionId: "session-123",
      messageId: "message-456",
      now: new Date("2026-05-05T12:30:00Z"),
      timeZone: "UTC",
    });

    expect(request.url).toBe(
      "http://localhost:6006/agents/server/sessions/session-123/chat"
    );
    expect(request.method).toBe("POST");
    expect(request.headers).toEqual({
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "X-Phoenix": "cli",
      Authorization: "Bearer secret-token",
    });
    expect(JSON.parse(request.body)).toEqual({
      id: "session-123",
      trigger: "submit-message",
      messages: [
        {
          id: "message-456",
          role: "user",
          parts: [
            {
              type: "text",
              text: "Summarize recent trace failures",
            },
          ],
        },
      ],
      contexts: [
        {
          type: "app",
          currentDateTime: "2026-05-05T12:30:00+00:00",
          timeZone: "UTC",
        },
        {
          type: "graphql",
          mutationsEnabled: false,
        },
        {
          type: "web_access",
          enabled: false,
        },
        {
          type: "subagents",
          enabled: false,
        },
      ],
      editPermission: "manual",
      ingestTraces: false,
      exportRemoteTraces: false,
      requestedSkills: [],
      model: {
        providerType: "builtin",
        provider: "OPENAI",
        modelName: "gpt-4.1",
        openaiApiType: "responses",
      },
    });
  });
});

describe("readAgentStream", () => {
  it("collects text deltas and message metadata", async () => {
    const deltas: string[] = [];
    const result = await readAgentStream({
      stream: makeSseStream({
        events: [
          'data: {"type":"text-delta","id":"msg","delta":"Hello"}\n\n',
          'data: {"type":"text-delta","id":"msg","delta":" world"}\n\n',
          'data: {"type":"message-metadata","messageMetadata":{"sessionId":"session-123","usage":{"tokens":{"prompt":1,"completion":2,"total":3},"promptDetails":null},"trace":{"traceId":"trace","rootSpanId":"span"}}}\n\n',
          "data: [DONE]\n\n",
        ],
      }),
      onTextDelta: (delta) => {
        deltas.push(delta);
      },
    });

    expect(deltas).toEqual(["Hello", " world"]);
    expect(result).toEqual({
      text: "Hello world",
      sessionId: "session-123",
      usage: {
        tokens: {
          prompt: 1,
          completion: 2,
          total: 3,
        },
        promptDetails: null,
      },
      trace: {
        traceId: "trace",
        rootSpanId: "span",
      },
    });
  });

  it("throws stream error chunks", async () => {
    await expect(
      readAgentStream({
        stream: makeSseStream({
          events: ['data: {"type":"error","errorText":"model failed"}\n\n'],
        }),
      })
    ).rejects.toThrow("model failed");
  });

  it("throws malformed JSON stream events", async () => {
    await expect(
      readAgentStream({
        stream: makeSseStream({
          events: ["data: {broken json}\n\n"],
        }),
      })
    ).rejects.toThrow("Failed to parse agent stream event as JSON");
  });
});

describe("agent run command", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects a missing provider with INVALID_ARGUMENT", async () => {
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createAgentCommand().parseAsync(["run", "hello", "--model", "gpt-4.1"], {
        from: "user",
      })
    ).rejects.toThrow("process.exit:3");

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Missing required --provider")
    );
    expect(exitSpy).toHaveBeenCalledWith(3);
  });

  it("rejects an invalid provider with the expected enum shape", async () => {
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createAgentCommand().parseAsync(
        ["run", "hello", "--provider", "BAD", "--model", "gpt-4.1"],
        { from: "user" }
      )
    ).rejects.toThrow("process.exit:3");

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid value for --provider: BAD")
    );
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("OPENAI"));
    expect(exitSpy).toHaveBeenCalledWith(3);
  });

  it("prints curl and does not execute fetch when --curl is set", async () => {
    const fetchMock = vi.fn();
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.stubGlobal("fetch", fetchMock);

    await createAgentCommand().parseAsync(
      [
        "run",
        "hello",
        "--provider",
        "OPENAI",
        "--model",
        "gpt-4.1",
        "--session-id",
        "session-123",
        "--endpoint",
        "http://localhost:6006",
        "--api-key",
        "secret-token",
        "--curl",
      ],
      { from: "user" }
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining("curl \\"));
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "  -H 'Authorization: Bearer ************************************' \\"
      )
    );
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "http://localhost:6006/agents/server/sessions/session-123/chat"
      )
    );
  });

  it("streams plain text output", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSseStream({
        events: [
          'data: {"type":"text-delta","id":"msg","delta":"Hello"}\n\n',
          'data: {"type":"text-delta","id":"msg","delta":" world"}\n\n',
          "data: [DONE]\n\n",
        ],
      }),
    });
    const stdoutWriteSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.stubGlobal("fetch", fetchMock);

    await createAgentCommand().parseAsync(
      [
        "run",
        "hello",
        "--provider",
        "OPENAI",
        "--model",
        "gpt-4.1",
        "--endpoint",
        "http://localhost:6006",
      ],
      { from: "user" }
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(stdoutWriteSpy).toHaveBeenNthCalledWith(1, "Hello");
    expect(stdoutWriteSpy).toHaveBeenNthCalledWith(2, " world");
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("emits final JSON output without live token streaming", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSseStream({
        events: [
          'data: {"type":"text-delta","id":"msg","delta":"Hello"}\n\n',
          'data: {"type":"message-metadata","messageMetadata":{"sessionId":"session-123","usage":null,"trace":null}}\n\n',
          "data: [DONE]\n\n",
        ],
      }),
    });
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const stdoutWriteSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    vi.stubGlobal("fetch", fetchMock);

    await createAgentCommand().parseAsync(
      [
        "run",
        "hello",
        "--provider",
        "OPENAI",
        "--model",
        "gpt-4.1",
        "--format",
        "json",
        "--endpoint",
        "http://localhost:6006",
      ],
      { from: "user" }
    );

    expect(stdoutWriteSpy).not.toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          text: "Hello",
          sessionId: "session-123",
          usage: null,
          trace: null,
        },
        null,
        2
      )
    );
  });

  it("maps 401 and 403 responses to AUTH_REQUIRED", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createAgentCommand().parseAsync(
        [
          "run",
          "hello",
          "--provider",
          "OPENAI",
          "--model",
          "gpt-4.1",
          "--endpoint",
          "http://localhost:6006",
        ],
        { from: "user" }
      )
    ).rejects.toThrow("process.exit:4");

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("HTTP 401 Unauthorized")
    );
    expect(exitSpy).toHaveBeenCalledWith(4);
  });
});
