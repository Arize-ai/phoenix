/** Prefix for browser requests. "/" on the host, "/mock-llm/" behind Traefik. */
export function publicRoot(): string {
  const root = import.meta.env.BASE_URL.replace(/dashboard\/$/, "");
  return root.endsWith("/") ? root : `${root}/`;
}

export function publicUrl(path: string): string {
  return `${publicRoot()}${path.replace(/^\//, "")}`;
}
