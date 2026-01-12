import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { configSchema, getDefaultConfig, type Config } from "./schema.js";

/**
 * Default config directory and file path
 */
const DEFAULT_CONFIG_DIR = path.join(os.homedir(), ".phoenix-insight");
const DEFAULT_CONFIG_FILE = path.join(DEFAULT_CONFIG_DIR, "config.json");

/**
 * Module-level storage for CLI args passed from commander
 * This is set externally before getConfigPath is called
 */
let cliConfigPath: string | undefined;

/**
 * Set the CLI config path (called from CLI parsing)
 */
export function setCliConfigPath(configPath: string | undefined): void {
  cliConfigPath = configPath;
}

/**
 * Get the config file path based on priority:
 * 1. CLI argument (--config)
 * 2. Environment variable (PHOENIX_INSIGHT_CONFIG)
 * 3. Default path (~/.phoenix-insight/config.json)
 *
 * @returns The path to the config file and whether it's the default path
 */
export function getConfigPath(): { path: string; isDefault: boolean } {
  // Priority 1: CLI argument
  if (cliConfigPath) {
    return { path: cliConfigPath, isDefault: false };
  }

  // Priority 2: Environment variable
  const envConfigPath = process.env.PHOENIX_INSIGHT_CONFIG;
  if (envConfigPath) {
    return { path: envConfigPath, isDefault: false };
  }

  // Priority 3: Default path
  return { path: DEFAULT_CONFIG_FILE, isDefault: true };
}

/**
 * Load and parse a config file from disk
 *
 * @param configPath - Path to the config file
 * @returns Parsed JSON object or null if file not found
 * @throws Error if file exists but cannot be parsed as JSON
 */
export async function loadConfigFile(
  configPath: string
): Promise<Record<string, unknown> | null> {
  try {
    const content = await fs.readFile(configPath, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch (error) {
    // File not found is expected - return null
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    // JSON parse errors should be reported
    if (error instanceof SyntaxError) {
      console.warn(
        `Warning: Config file at ${configPath} contains invalid JSON: ${error.message}`
      );
      return null;
    }

    // Other errors (permissions, etc.) - warn and return null
    console.warn(
      `Warning: Could not read config file at ${configPath}: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/**
 * Validate a raw config object against the schema
 * Returns validated config or defaults if validation fails
 *
 * @param raw - Raw config object (or null/undefined)
 * @returns Validated config with defaults applied
 */
export function validateConfig(
  raw: Record<string, unknown> | null | undefined
): Config {
  // If no raw config, return defaults
  if (!raw) {
    return getDefaultConfig();
  }

  try {
    // Parse with Zod schema - this applies defaults for missing fields
    return configSchema.parse(raw);
  } catch (error) {
    // Log validation errors as warnings
    if (error instanceof Error && "issues" in error) {
      // Zod error with issues array
      const zodError = error as {
        issues: Array<{ path: string[]; message: string }>;
      };
      zodError.issues.forEach((issue) => {
        console.warn(
          `Warning: Config validation error at '${issue.path.join(".")}': ${issue.message}`
        );
      });
    } else {
      console.warn(
        `Warning: Config validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Return defaults on validation failure
    return getDefaultConfig();
  }
}

/**
 * Create a default config file at the given path
 * Only creates the file if it doesn't already exist
 * Only triggers for the default path, not custom paths
 *
 * @param configPath - Path where to create the config file
 * @param isDefault - Whether this is the default path (only create if true)
 * @returns true if file was created, false otherwise
 */
export async function createDefaultConfig(
  configPath: string,
  isDefault: boolean
): Promise<boolean> {
  // Only create default config for the default path
  if (!isDefault) {
    return false;
  }

  try {
    // Check if file already exists
    await fs.access(configPath);
    // File exists, don't overwrite
    return false;
  } catch {
    // File doesn't exist, create it
  }

  try {
    // Create directory if needed
    const configDir = path.dirname(configPath);
    await fs.mkdir(configDir, { recursive: true });

    // Get default config and write it
    const defaultConfig = getDefaultConfig();
    const content = JSON.stringify(defaultConfig, null, 2);
    await fs.writeFile(configPath, content, "utf-8");

    // Log informational message to stderr
    console.error(`Created default config at ${configPath}`);

    return true;
  } catch (error) {
    // Log warning but don't fail - config will use defaults
    console.warn(
      `Warning: Could not create default config at ${configPath}: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}
