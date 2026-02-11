import { spawn, ChildProcess } from "child_process";
import { OpenAI } from "openai";

let serverProcess: ChildProcess | null = null;

const TEST_PORT = 18080;
const BASE_URL = `http://localhost:${TEST_PORT}/v1`;

export function getTestClient(): OpenAI {
  return new OpenAI({
    baseURL: BASE_URL,
    apiKey: "test-key",
  });
}

export function getBaseUrl(): string {
  return `http://localhost:${TEST_PORT}`;
}

export async function startServer(
  env: Record<string, string> = {},
): Promise<void> {
  if (serverProcess) {
    await stopServer();
  }

  return new Promise((resolve, reject) => {
    // Default to fast mode (no delays) for tests unless overridden
    const fullEnv = {
      ...process.env,
      PORT: String(TEST_PORT),
      STREAM_INITIAL_DELAY_MS: "0",
      STREAM_DELAY_MS: "0",
      STREAM_JITTER_MS: "0",
      ...env,
    };

    serverProcess = spawn("npx", ["tsx", "src/server.ts"], {
      cwd: process.cwd(),
      env: fullEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let started = false;

    serverProcess.stdout?.on("data", (data: Buffer) => {
      const output = data.toString();
      // Look for the startup message
      if (output.includes("Mock LLM Server running") && !started) {
        started = true;
        // Give a moment for the server to be fully ready
        setTimeout(resolve, 100);
      }
    });

    serverProcess.stderr?.on("data", (data: Buffer) => {
      console.error("Server stderr:", data.toString());
    });

    serverProcess.on("error", (err) => {
      if (!started) {
        reject(err);
      }
    });

    serverProcess.on("exit", (code) => {
      if (!started && code !== 0) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!started) {
        reject(new Error("Server failed to start within 10 seconds"));
      }
    }, 10000);
  });
}

export async function stopServer(): Promise<void> {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
    // Wait a bit for port to be released
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

export async function resetRateLimit(): Promise<void> {
  const response = await fetch(
    `http://localhost:${TEST_PORT}/api/rate-limit/reset`,
    {
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error("Failed to reset rate limit");
  }
}
