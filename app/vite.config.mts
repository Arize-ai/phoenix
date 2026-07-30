import { resolve } from "path";
import { lezer } from "@lezer/generator/rollup";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
// Uncomment below to visualize the bundle size after running the build command, also uncomment plugins.push(visualizer());
// import { visualizer } from "rollup-plugin-visualizer";
/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import type { Plugin, ProxyOptions } from "vite";
import circleDependency from "vite-plugin-circular-dependency";
import reactFallbackThrottlePlugin from "vite-plugin-react-fallback-throttle";
import relay from "vite-plugin-relay";

// We default to not exporting source maps since the JS bundle gets added to the python package.
// We however want to enable source maps on the containers for debugging purposes.
const enableSourceMap = process.env.PHOENIX_ENABLE_SOURCE_MAP === "True";

const REMOTE_CONFIG_MARKER = "<!-- phoenix-remote-config -->";

function getRemoteConfigScript(html: string): string {
  const configDefinition = 'Object.defineProperty(window, "Config"';
  const configDefinitionIndex = html.indexOf(configDefinition);
  if (configDefinitionIndex === -1) {
    throw new Error("The remote Phoenix page does not define window.Config.");
  }

  const scriptStartIndex = html.lastIndexOf("<script", configDefinitionIndex);
  const scriptEndIndex = html.indexOf("</script>", configDefinitionIndex);
  if (scriptStartIndex === -1 || scriptEndIndex === -1) {
    throw new Error("Could not extract window.Config from remote Phoenix.");
  }

  return html.slice(scriptStartIndex, scriptEndIndex + "</script>".length);
}

function getRemoteModernizrScript(html: string): string {
  const modernizrScript = html.match(
    /<script src="[^"]*\/modernizr\.js"><\/script>/
  )?.[0];
  if (!modernizrScript) {
    throw new Error("The remote Phoenix page does not load modernizr.js.");
  }
  return modernizrScript;
}

function createRemoteBackendPlugin(remoteBackendUrl: URL): Plugin {
  return {
    name: "phoenix-remote-backend",
    transformIndexHtml: {
      order: "pre",
      async handler(html) {
        const response = await fetch(remoteBackendUrl);
        if (!response.ok) {
          throw new Error(
            `Could not load remote Phoenix config: ${response.status} ${response.statusText}`
          );
        }
        const remoteHtml = await response.text();
        return html.replace(
          REMOTE_CONFIG_MARKER,
          `${getRemoteModernizrScript(remoteHtml)}\n${getRemoteConfigScript(remoteHtml)}`
        );
      },
    },
  };
}

function createRemoteBackendProxy(remoteBackendUrl: URL): ProxyOptions {
  return {
    target: remoteBackendUrl.origin,
    changeOrigin: true,
    secure: true,
    ws: true,
    bypass(request) {
      // Serve the local SPA for top-level navigation while proxying every
      // backend request (including the GraphQL and REST explorer iframes).
      if (request.headers["sec-fetch-dest"] === "document") {
        return "/index.html";
      }
      return undefined;
    },
  };
}

// Configure React Compiler preset with custom options
// reactCompilerPreset() provides optimized filters; we customize the babel plugin options
const compilerPreset = reactCompilerPreset();
compilerPreset.preset = () => ({
  plugins: [["babel-plugin-react-compiler", { panicThreshold: "none" }]],
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const remoteBackend = env.PHOENIX_REMOTE_BACKEND?.trim();
  const remoteBackendUrl = remoteBackend ? new URL(remoteBackend) : null;
  const plugins = [
    // disable react's built-in 300ms suspense fallback timer
    // without this build plugin we see a 300ms delay on most UI interactions
    reactFallbackThrottlePlugin(),
    react(),
    // Use @rolldown/plugin-babel with React Compiler
    // This is required in Vite 8+ as plugin-react v6 removed babel integration
    babel({
      presets: [compilerPreset],
    }),
    relay,
    lezer(),
    circleDependency({ circleImportThrowErr: true }),
  ];
  if (remoteBackendUrl) {
    plugins.push(createRemoteBackendPlugin(remoteBackendUrl));
  }
  // Uncomment below to visualize the bundle size after running the build command also uncomment import { visualizer } from "rollup-plugin-visualizer";
  // plugins.push(visualizer());
  return {
    root: resolve(__dirname, "src"),
    plugins,
    publicDir: resolve(__dirname, "static"),
    server: {
      port: parseInt(process.env.VITE_PORT || "5173"),
      proxy: remoteBackendUrl
        ? {
            [remoteBackendUrl.pathname.replace(/\/$/, "")]:
              createRemoteBackendProxy(remoteBackendUrl),
          }
        : undefined,
      warmup: {
        clientFiles: ["./index.tsx", "./App.tsx", "./Routes.tsx"],
      },
      headers: {
        // Prevent browser caching during development to ensure fresh assets
        // after code changes. This fixes 304 responses causing stale files.
        "Cache-Control": "no-store",
      },
    },
    preview: {
      port: 6006,
    },
    resolve: {
      alias: {
        "@phoenix": resolve(__dirname, "src"),
        "@codemirror/state": resolve(
          __dirname,
          "./node_modules/@codemirror/state/dist/index.cjs"
        ),
      },
    },
    test: {
      include: ["../__tests__/*.test.{ts,tsx}", "**/__tests__/*.test.{ts,tsx}"],
      exclude: ["../node_modules/**"],
      environment: "jsdom",
      setupFiles: [resolve(__dirname, "./vitest.setup.ts")],
      globals: true,
      server: {
        deps: {
          // codemirror-json-schema ships ESM with extensionless relative
          // imports that Node's resolver rejects when externalized
          inline: ["codemirror-json-schema"],
        },
      },
    },
    build: {
      manifest: true,
      outDir: resolve(__dirname, "../src/phoenix/server/static"),
      emptyOutDir: true,
      sourcemap: enableSourceMap,
      rolldownOptions: {
        input: resolve(__dirname, "src/index.tsx"),
        output: {
          codeSplitting: {
            groups: [
              {
                name: "vendor-codemirror",
                test: /codemirror/,
              },
              {
                name: "vendor-recharts",
                test: /recharts/,
              },
              {
                name: "vendor-shiki",
                test: /shiki/,
              },
              {
                name: "vendor-ai-sdk-react",
                test: /@ai-sdk\/react|\/node_modules\/ai\//,
              },
              {
                name: "vendor-streamdown",
                test: /streamdown/,
              },
              // Catch-all for remaining node_modules
              {
                name: "vendor",
                test: /node_modules/,
              },
            ],
          },
        },
      },
    },
  };
});
