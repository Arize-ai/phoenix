// Launches the dev stack (mprocs: Phoenix API + Vite) with worktree-aware ports.
//
// When run through portless (`portless` from app/), the proxy injects an
// ephemeral `PORT` for the app to listen on and gives each git worktree its own
// `<worktree>.localhost` URL. We bind Phoenix's HTTP server to that `PORT` and
// auto-assign the three auxiliary dev ports (Vite, OTLP gRPC, debugpy) to free
// ports so multiple worktrees can run their dev stacks concurrently without
// colliding. Explicit overrides (a port already set in the environment) win.
//
// When run directly (`pnpm dev`), `PORT` is unset and we leave the ports alone,
// so the classic fixed defaults (6006 / 5173 / 4317 / 5678) still apply.
import { spawn } from "node:child_process";
import { createServer } from "node:net";

/** Resolve a free TCP port from the OS ephemeral range. */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

const env = { ...process.env };

// portless sets PORT to the proxy-assigned app port. Outside portless it is
// unset and we keep the existing defaults baked into the dev scripts.
if (env.PORT) {
  env.PHOENIX_PORT = env.PORT;
  env.VITE_PORT ??= String(await findFreePort());
  env.PHOENIX_GRPC_PORT ??= String(await findFreePort());
  env.DEBUGPY_PORT ??= String(await findFreePort());
}

const child = spawn("mprocs", { stdio: "inherit", env });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
