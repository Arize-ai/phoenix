import type { IncomingHttpHeaders, IncomingMessage } from "node:http";
import { pipeline } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import type { Plugin, ProxyOptions, ViteDevServer } from "vite";

/**
 * Vite serves every UI module, static file, and HMR endpoint under this path.
 * Every other path belongs to the Phoenix backend.
 */
const UI_BASE = "/@phoenix-ui/";
const UI_ENTRY = `${UI_BASE}index.tsx`;

const BACKEND_ENTRY_TAG_RES = [
  // production bundle
  /<(?:script|link)\b[^>]*\/assets\/[^>]*>(?:\s*<\/script>)?/g,
  // a backend running with --dev points at its own Vite server
  /<script type="module" src="https?:\/\/[^"]*\/(?:@vite\/client|index\.tsx)"><\/script>/g,
  /<script type="module">(?:(?!<\/script>)[\s\S])*@react-refresh(?:(?!<\/script>)[\s\S])*<\/script>/g,
];
const HEAD_CONTENT_RE = /<head>([\s\S]*)<\/head>/;
/**
 * Only the backend's SPA shell carries this mount point. Other backend HTML
 * pages (Swagger UI at /docs, GraphiQL at /graphql) must pass through as is.
 */
const APP_SHELL_MARKER = '<div id="root"></div>';
const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-connection",
  "transfer-encoding",
  "upgrade",
];
const DECOMPRESSORS: Partial<Record<string, () => NodeJS.ReadWriteStream>> = {
  gzip: createGunzip,
  deflate: createInflate,
  br: createBrotliDecompress,
};

/**
 * Parse and validate the backend URL.
 * @param backendUrl - base URL of the Phoenix backend
 */
function parseBackendUrl(backendUrl: string): URL {
  let url: URL | undefined;
  try {
    url = new URL(backendUrl);
  } catch {
    url = undefined;
  }
  const isHttpUrl = url?.protocol === "http:" || url?.protocol === "https:";
  if (!url || !isHttpUrl) {
    throw new Error(
      `PHOENIX_BACKEND_URL must be an http(s) URL such as https://phoenix.example.com, got "${backendUrl}"`
    );
  }
  return url;
}

function isDocumentRequest(req: IncomingMessage): boolean {
  if (req.method !== "GET") {
    return false;
  }
  const fetchDestination = req.headers["sec-fetch-dest"];
  if (fetchDestination) {
    return fetchDestination === "document" || fetchDestination === "iframe";
  }
  return req.headers.accept?.includes("text/html") ?? false;
}

function getLocalOrigin(req: IncomingMessage): string {
  const isEncrypted =
    "encrypted" in req.socket && req.socket.encrypted === true;
  return `${isEncrypted ? "https" : "http"}://${req.headers.host}`;
}

/**
 * Make a backend Set-Cookie header valid for the local dev origin.
 * @param params.cookie - Set-Cookie value from the backend
 * @param params.isLocalSecure - whether the dev server runs over https
 */
function rewriteSetCookie({
  cookie,
  isLocalSecure,
}: {
  cookie: string;
  isLocalSecure: boolean;
}): string {
  const attributes = cookie
    .split(";")
    .map((attribute) => attribute.trim())
    .filter((attribute) => !/^domain=/i.test(attribute))
    .filter((attribute) => isLocalSecure || !/^secure$/i.test(attribute))
    .map((attribute) =>
      !isLocalSecure && /^samesite=none$/i.test(attribute)
        ? "SameSite=Lax"
        : attribute
    );
  return attributes.join("; ");
}

/**
 * Rewrite backend response headers so redirects and cookies target the local
 * dev origin instead of the backend.
 * @param params.headers - response headers from the backend
 * @param params.targetHost - host (and port) of the backend
 * @param params.localOrigin - origin the browser is using
 */
function rewriteResponseHeaders({
  headers,
  targetHost,
  localOrigin,
}: {
  headers: IncomingHttpHeaders;
  targetHost: string;
  localOrigin: string;
}): IncomingHttpHeaders {
  const isLocalSecure = localOrigin.startsWith("https:");
  const rewritten: IncomingHttpHeaders = { ...headers };
  HOP_BY_HOP_HEADERS.forEach((name) => delete rewritten[name]);
  // Match on host rather than origin: a backend behind a TLS terminator can
  // build absolute redirects with http:// even though it is reached via https.
  const location = headers.location ? URL.parse(headers.location) : null;
  if (location?.host === targetHost) {
    rewritten.location =
      localOrigin + location.pathname + location.search + location.hash;
  }
  if (headers["set-cookie"]) {
    rewritten["set-cookie"] = headers["set-cookie"].map((cookie) =>
      rewriteSetCookie({ cookie, isLocalSecure })
    );
  }
  return rewritten;
}

/**
 * Swap the backend's UI entry for the local Vite entry, keeping the
 * server-injected window.Config intact.
 * @param params.backendHtml - index.html returned by the backend
 * @param params.devHeadTags - Vite client and React refresh preamble tags
 */
function replaceUiEntry({
  backendHtml,
  devHeadTags,
}: {
  backendHtml: string;
  devHeadTags: string;
}): string {
  const strippedHtml = BACKEND_ENTRY_TAG_RES.reduce(
    (html, tagRe) => html.replace(tagRe, ""),
    backendHtml
  );
  // Function replacers keep `$` sequences in the injected tags literal.
  return strippedHtml
    .replace("</head>", () => `${devHeadTags}\n</head>`)
    .replace(
      "</body>",
      () => `<script type="module" src="${UI_ENTRY}"></script>\n</body>`
    );
}

async function getDevHeadTags(server: ViteDevServer): Promise<string> {
  const skeleton = await server.transformIndexHtml(
    "/index.html",
    "<!DOCTYPE html><html><head></head><body></body></html>"
  );
  return HEAD_CONTENT_RE.exec(skeleton)?.[1] ?? "";
}

async function readBody(
  stream: AsyncIterable<Buffer | string>
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Runs the UI from the local Vite dev server against a separately running Phoenix backend.
 *
 * Vite serves the UI under UI_BASE. Every other request goes to the backend
 * through the proxy. Page loads return the backend's index.html
 * (so window.Config reflects the backend) with its UI entry
 * swapped for the local hot-reloading one.
 * @param params.backendUrl - base URL of the Phoenix backend
 */
export function backendProxyPlugin({
  backendUrl,
}: {
  backendUrl: string;
}): Plugin {
  const target = parseBackendUrl(backendUrl);
  let devServer: ViteDevServer | undefined;
  let devHeadTags: string | undefined;

  const proxyOptions: ProxyOptions = {
    target: target.origin,
    changeOrigin: true,
    ws: false,
    selfHandleResponse: true,
    configure: (proxy) => {
      proxy.on("proxyReq", (proxyReq, req) => {
        // setHeader throws once headers are flushed; a throw here crashes the dev server.
        if (proxyReq.headersSent) {
          return;
        }
        // The backend validates Origin/Referer against its own origin (CSRF).
        if (proxyReq.getHeader("origin")) {
          proxyReq.setHeader("origin", target.origin);
        }
        const referer = proxyReq.getHeader("referer");
        const refererUrl =
          typeof referer === "string" ? URL.parse(referer) : null;
        if (refererUrl) {
          proxyReq.setHeader(
            "referer",
            new URL(refererUrl.pathname + refererUrl.search, target.origin).href
          );
        }
        if (isDocumentRequest(req)) {
          proxyReq.setHeader("accept-encoding", "identity");
        }
      });
      proxy.on("proxyRes", async (proxyRes, req, res) => {
        const headers = rewriteResponseHeaders({
          headers: proxyRes.headers,
          targetHost: target.host,
          localOrigin: getLocalOrigin(req),
        });
        const statusCode = proxyRes.statusCode ?? 502;
        const isHtmlDocument =
          isDocumentRequest(req) &&
          statusCode === 200 &&
          (headers["content-type"]?.includes("text/html") ?? false);
        if (!isHtmlDocument || !devServer) {
          res.writeHead(statusCode, headers);
          proxyRes.pipe(res);
          return;
        }
        try {
          const encoding = headers["content-encoding"];
          const createDecompressor = encoding
            ? DECOMPRESSORS[encoding]
            : undefined;
          if (encoding && !createDecompressor) {
            throw new Error(`unsupported content-encoding "${encoding}"`);
          }
          // pipeline (unlike pipe) forwards backend stream errors so the read rejects instead of hanging.
          const body = createDecompressor
            ? pipeline(proxyRes, createDecompressor(), () => {})
            : proxyRes;
          const backendBody = await readBody(body);
          delete headers["content-encoding"];
          delete headers["content-length"];
          delete headers["etag"];
          const backendHtml = backendBody.toString("utf-8");
          if (!backendHtml.includes(APP_SHELL_MARKER)) {
            res.writeHead(statusCode, headers);
            res.end(backendBody);
            return;
          }
          devHeadTags ??= await getDevHeadTags(devServer);
          const html = replaceUiEntry({ backendHtml, devHeadTags });
          res.writeHead(200, {
            ...headers,
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
          });
          res.end(html);
        } catch (error) {
          devServer.config.logger.error(
            `Failed to load the Phoenix UI shell from ${target.origin}: ${String(error)}`
          );
          if (!res.headersSent) {
            res.writeHead(502);
          }
          res.end();
        }
      });
    },
  };

  return {
    name: "phoenix:backend-proxy",
    apply: "serve",
    config: () => ({
      appType: "custom",
      base: UI_BASE,
      server: {
        // No Phoenix server is told the Vite port in this mode, so take the next free one.
        strictPort: false,
        proxy: { [`^/(?!${UI_BASE.slice(1)})`]: proxyOptions },
      },
    }),
    configureServer: (server) => {
      devServer = server;
      devHeadTags = undefined;
      server.printUrls = () => {
        const localUrl = server.resolvedUrls?.local[0];
        const uiUrl = localUrl
          ? new URL(target.pathname, localUrl).href
          : target.pathname;
        server.config.logger.info(
          `  ➜  UI:      ${uiUrl}\n` + `  ➜  Backend: ${target.href}`
        );
      };
    },
  };
}
