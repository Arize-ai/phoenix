/**
 * Fake `SetupDeps` builders for setup unit tests. No test spawns a real
 * agent or a real server: `createClient` builds the real Phoenix client over a
 * fake transport, so only the socket is faked.
 */

import { createPhoenixClient } from "../../src/client";
import type {
  Clock,
  CommandSpec,
  ExecResult,
  ProcessRunner,
  Prompter,
  RunContext,
  SelectOption,
  SetupDeps,
} from "../../src/setup/deps";
import { resolvePathKey } from "../../src/setup/deps/context";
import { SetupCancelledError } from "../../src/setup/errors";
import {
  resolveSetupInputs,
  type SetupInputs,
  type SetupOptions,
} from "../../src/setup/options";

/** Sentinel answer that simulates Ctrl-C / Escape on a prompt. */
export const CANCEL = Symbol("cancel");

export type ScriptedAnswer = unknown | typeof CANCEL;

export interface ScriptedPrompter extends Prompter {
  /** Prompts asked, in order, for assertions. */
  transcript: string[];
  /** Notes/lines emitted, for copy assertions. */
  output: string[];
}

/**
 * A prompter that answers prompts from a FIFO script. Selects verify the
 * scripted answer is one of the offered option values.
 *
 * `interruptWaits` stands in for Ctrl-C during an interruptible wait: the work
 * is handed an already-aborted signal, as if the user gave up on it.
 */
export function scriptedPrompter(
  answers: ScriptedAnswer[],
  { interruptWaits = false }: { interruptWaits?: boolean } = {}
): ScriptedPrompter {
  const queue = [...answers];
  const transcript: string[] = [];
  const output: string[] = [];

  function next(message: string): ScriptedAnswer {
    if (queue.length === 0) {
      throw new Error(`No scripted answer left for prompt: ${message}`);
    }
    return queue.shift();
  }

  return {
    transcript,
    output,
    async select<T>(args: {
      message: string;
      options: Array<SelectOption<T>>;
    }): Promise<T> {
      transcript.push(args.message);
      const answer = next(args.message);
      if (answer === CANCEL) {
        throw new SetupCancelledError();
      }
      const match = args.options.find((option) => option.value === answer);
      if (!match) {
        throw new Error(
          `Scripted answer ${String(answer)} is not an option for: ${args.message}`
        );
      }
      return match.value;
    },
    async textInput(args: {
      message: string;
      defaultValue?: string;
      validate?: (value: string) => string | undefined;
    }): Promise<string> {
      transcript.push(args.message);
      const answer = next(args.message);
      if (answer === CANCEL) {
        throw new SetupCancelledError();
      }
      const value =
        answer === undefined ? (args.defaultValue ?? "") : String(answer);
      const problem = args.validate?.(value);
      if (problem) {
        throw new Error(
          `Scripted answer "${value}" failed validation: ${problem}`
        );
      }
      return value;
    },
    async passwordInput(args: {
      message: string;
      validate?: (value: string) => string | undefined;
    }): Promise<string> {
      transcript.push(args.message);
      const answer = next(args.message);
      if (answer === CANCEL) {
        throw new SetupCancelledError();
      }
      const value = String(answer ?? "");
      const problem = args.validate?.(value);
      if (problem) {
        throw new Error(
          `Scripted answer "${value}" failed validation: ${problem}`
        );
      }
      return value;
    },
    async runInterruptible<T>(
      work: (signal: AbortSignal) => Promise<T>
    ): Promise<T> {
      const interrupted = new AbortController();
      if (interruptWaits) {
        interrupted.abort();
      }
      return work(interrupted.signal);
    },
    note(message: string): void {
      output.push(message);
    },
    line(message: string): void {
      output.push(message);
    },
    intro(message: string): void {
      output.push(message);
    },
    outro(message: string): void {
      output.push(message);
    },
  };
}

export type FetchHandler = (
  url: string,
  request: Request
) => Response | Promise<Response> | undefined;

/** Build a fetch fake from an ordered list of handlers (first match wins). */
export function fakeFetch(...handlers: FetchHandler[]): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request =
      input instanceof Request ? input : new Request(String(input), init);
    for (const handler of handlers) {
      const response = await handler(request.url, request);
      if (response) {
        return response;
      }
    }
    throw new TypeError(`fetch failed: no fake handler for ${request.url}`);
  }) as typeof fetch;
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function fakeRunContext(
  overrides: Partial<RunContext> = {}
): RunContext {
  const env = overrides.env ?? {};
  return {
    cwd: "/tmp/fake-cwd",
    env,
    // Resolved the same way the real capture does, so a fixture whose env
    // spells it "Path" (Windows) behaves like one.
    pathKey: resolvePathKey(env),
    stdinIsTTY: true,
    ...overrides,
  };
}

/** A process runner over one exec fake; interactive spawns succeed inertly. */
export function fakeProcesses(
  exec: ProcessRunner["exec"],
  spawnInteractive?: ProcessRunner["spawnInteractive"]
): ProcessRunner {
  return {
    exec,
    spawnInteractive: spawnInteractive ?? (async () => ({ exitCode: 0 })),
  };
}

/**
 * Resolve setup inputs against the fake context, exactly the way the command
 * layer resolves them against the real one.
 */
export function resolveFakeInputs(
  deps: Pick<SetupDeps, "context">,
  options: SetupOptions = {}
): SetupInputs {
  return resolveSetupInputs({ options, context: deps.context });
}

/**
 * Per-capability overrides for {@link buildFakeDeps}, mirroring the shape of
 * `SetupDeps` itself — grouped members take partials merged over inert
 * defaults — so a capability added to the seam flows through without
 * touching the fake.
 */
export interface FakeDepsOverrides {
  context?: Partial<RunContext>;
  prompter?: Prompter;
  processes?: Partial<ProcessRunner>;
  clock?: Partial<Clock>;
  writeClipboard?: SetupDeps["writeClipboard"];
  fetchDocs?: SetupDeps["fetchDocs"];
  oauthLogin?: SetupDeps["oauthLogin"];
  /** Transport beneath the real Phoenix client `createClient` builds. */
  fetch?: typeof fetch;
}

export function buildFakeDeps(overrides: FakeDepsOverrides = {}): SetupDeps {
  const fetch =
    overrides.fetch ??
    (async () => {
      throw new TypeError("fetch failed: no fake fetch configured");
    });
  return {
    context: { ...fakeRunContext(), ...overrides.context },
    prompter: overrides.prompter ?? scriptedPrompter([]),
    processes: {
      exec: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      spawnInteractive: async () => ({ exitCode: 0 }),
      ...overrides.processes,
    },
    clock: {
      now: () => 0,
      sleep: async () => {},
      ...overrides.clock,
    },
    writeClipboard: overrides.writeClipboard ?? (async () => true),
    createClient: ({ endpoint, apiKey }) =>
      createPhoenixClient({ config: { endpoint, apiKey }, fetch }),
    // Default fake: no OAuth support, so existing lanes stay on paste.
    oauthLogin: overrides.oauthLogin ?? {
      isSupported: async () => false,
      login: async () => ({ status: "error", detail: "oauth not faked" }),
    },
    fetchDocs:
      overrides.fetchDocs ??
      (async (options) => ({
        outputDir: ".px/docs",
        workflows: options.workflows ?? ["tracing"],
        written: 3,
        failed: 0,
      })),
  };
}

/** Standard git exec fake: inside a work tree, clean or dirty. */
export function gitExecFake({
  isRepo = true,
  dirtyFiles = [] as string[],
} = {}): (spec: CommandSpec) => Promise<ExecResult> {
  return async (spec: CommandSpec) => {
    if (spec.command !== "git") {
      return { exitCode: 127, stdout: "", stderr: "not faked" };
    }
    if (spec.args[0] === "rev-parse") {
      return isRepo
        ? { exitCode: 0, stdout: "true\n", stderr: "" }
        : { exitCode: 128, stdout: "", stderr: "not a git repository" };
    }
    if (spec.args[0] === "status") {
      return {
        exitCode: 0,
        stdout: dirtyFiles.map((file) => ` M ${file}`).join("\n"),
        stderr: "",
      };
    }
    return { exitCode: 1, stdout: "", stderr: "unexpected git call" };
  };
}
