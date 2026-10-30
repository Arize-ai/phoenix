import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

import { createRejectNodeBuiltinsPlugin } from "../../../scripts/viteRejectNodeBuiltins.mjs";

const packageDirectory = fileURLToPath(new URL("../", import.meta.url));
const configPackageDirectory = fileURLToPath(
  new URL("../../phoenix-config/", import.meta.url)
);

const runtimeTargets = [
  { conditions: ["browser"], name: "browser" },
  { conditions: ["react-native"], name: "react-native" },
  { conditions: ["non-node"], name: "default" },
];

/**
 * Pack a workspace package without running publish lifecycle scripts.
 *
 * @param {object} params - Package details.
 * @param {string} params.sourceDirectory - Directory containing the package manifest.
 * @param {string} params.outputDirectory - Directory that receives the tarball.
 * @returns {string} The absolute path to the packed tarball.
 */
function packPackage({ sourceDirectory, outputDirectory }) {
  const packOutput = execFileSync(
    "npm",
    [
      "pack",
      "--ignore-scripts",
      "--json",
      "--pack-destination",
      outputDirectory,
    ],
    {
      cwd: sourceDirectory,
      encoding: "utf8",
      env: {
        ...process.env,
        npm_config_cache: join(outputDirectory, ".npm-cache"),
      },
    }
  );
  const packResults = JSON.parse(packOutput);
  const filename = packResults[0]?.filename;
  if (!filename) {
    throw new Error(
      `npm pack did not produce a tarball for ${sourceDirectory}`
    );
  }
  return join(outputDirectory, filename);
}

/**
 * Extract a package tarball into an installation-like node_modules directory.
 *
 * @param {object} params - Extraction details.
 * @param {string} params.tarballPath - Package tarball to extract.
 * @param {string} params.destinationDirectory - Package directory under node_modules.
 */
function extractPackage({ tarballPath, destinationDirectory }) {
  mkdirSync(destinationDirectory, { recursive: true });
  execFileSync(
    "tar",
    ["-xzf", tarballPath, "--strip-components=1", "-C", destinationDirectory],
    { stdio: "pipe" }
  );
}

const smokeDirectory = mkdtempSync(join(packageDirectory, ".non-node-smoke-"));

try {
  const packedClientPath = packPackage({
    sourceDirectory: packageDirectory,
    outputDirectory: smokeDirectory,
  });
  const packedConfigPath = packPackage({
    sourceDirectory: configPackageDirectory,
    outputDirectory: smokeDirectory,
  });
  const installedScopeDirectory = join(
    smokeDirectory,
    "node_modules",
    "@arizeai"
  );

  extractPackage({
    tarballPath: packedClientPath,
    destinationDirectory: join(installedScopeDirectory, "phoenix-client"),
  });
  extractPackage({
    tarballPath: packedConfigPath,
    destinationDirectory: join(installedScopeDirectory, "phoenix-config"),
  });

  const smokeEntryPath = join(smokeDirectory, "entry.ts");
  writeFileSync(
    smokeEntryPath,
    `import { createClient } from "@arizeai/phoenix-client";

const configuredFetch = async () => new Response("20.0.0");

export const client = createClient({
  getEnvironmentOptions: () => ({}),
  options: {
    baseUrl: "https://phoenix.example.com",
    fetch: configuredFetch,
  },
});
`
  );

  for (const runtimeTarget of runtimeTargets) {
    await build({
      build: {
        emptyOutDir: true,
        lib: {
          entry: smokeEntryPath,
          formats: ["es"],
          name: "PhoenixClientNonNodeSmoke",
        },
        outDir: join(smokeDirectory, `dist-${runtimeTarget.name}`),
      },
      configFile: false,
      logLevel: "silent",
      plugins: [
        createRejectNodeBuiltinsPlugin({
          targetName: runtimeTarget.name,
        }),
      ],
      resolve: {
        conditions: runtimeTarget.conditions,
        preserveSymlinks: true,
      },
      root: smokeDirectory,
    });
  }
} finally {
  rmSync(smokeDirectory, { force: true, recursive: true });
}
