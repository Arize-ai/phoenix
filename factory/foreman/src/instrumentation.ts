export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startMcpGrantCleanup } = await import("@/mcp/cleanup-runtime");
  startMcpGrantCleanup();
}
