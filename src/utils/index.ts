/**
 * @packageDocumentation
 * Utility functions for StateMesh SDK
 */

import path from "path";

/**
 * Generates a unique session identifier
 * @returns Unique session ID string
 * @internal
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculates exponential backoff delay for reconnection attempts
 * @param attempt - Current attempt number (1-based)
 * @param initialDelay - Initial delay in milliseconds
 * @param multiplier - Backoff multiplier
 * @returns Calculated delay in milliseconds
 * @internal
 */
export function calculateBackoffDelay(
  attempt: number,
  initialDelay: number,
  multiplier: number
): number {
  return initialDelay * Math.pow(multiplier, attempt - 1);
}

/**
 * Parses .env file content into key-value pairs
 * @param content - Raw .env file content
 * @returns Object with environment variable key-value pairs
 * @public
 */
export function parseEnvFile(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      vars[key] = value;
    }
  }

  return vars;
}

/**
 * Converts environment variables object to .env file format
 * @param vars - Object with environment variable key-value pairs
 * @returns Formatted .env file content string
 * @public
 */
export function stringifyEnvFile(vars: Record<string, string>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(vars)) {
    const escaped = value.includes(" ")
      ? `"${value.replace(/"/g, '\\"')}"`
      : value;
    lines.push(`${key}=${escaped}`);
  }
  return lines.join("\n") + (lines.length > 0 ? "\n" : "");
}

/**
 * Flattens nested object into dot-notation keys
 * @param obj - Nested object to flatten
 * @param prefix - Prefix to prepend to keys (optional)
 * @param result - Accumulator object (internal use)
 * @returns Flattened object with dot-notation keys
 * @public
 */
export function flattenObject(
  obj: Record<string, unknown>,
  prefix: string = "",
  result: Record<string, unknown> = {}
): Record<string, unknown> {
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      value.constructor === Object
    ) {
      flattenObject(value as Record<string, unknown>, newKey, result);
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

/**
 * Gets nested value from object using path array
 * @param obj - Object to traverse
 * @param path - Array of keys representing the path
 * @returns Value at path or undefined if not found
 * @public
 */
export function getNestedValue(
  obj: Record<string, unknown>,
  path: string[]
): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object" ||
      Array.isArray(current)
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Sets nested value in object using path array
 * @param obj - Object to modify
 * @param path - Array of keys representing the path
 * @param value - Value to set
 * @public
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string[],
  value: unknown
): void {
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (
      !(key in current) ||
      typeof current[key] !== "object" ||
      Array.isArray(current[key])
    ) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[path[path.length - 1]] = value;
}

/**
 * Deletes nested value from object using path array
 * @param obj - Object to modify
 * @param path - Array of keys representing the path
 * @public
 */
export function deleteNestedValue(
  obj: Record<string, unknown>,
  path: string[]
): void {
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (
      !(key in current) ||
      typeof current[key] !== "object" ||
      Array.isArray(current[key])
    ) {
      return;
    }
    current = current[key] as Record<string, unknown>;
  }
  delete current[path[path.length - 1]];
}

/**
 * Parses newline-separated JSON messages from WebSocket data
 * @param data - WebSocket message data string
 * @returns Array of parsed message objects
 * @internal
 */
export function parseWebSocketMessages(data: string): unknown[] {
  const text = data.toString();
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  const messages: unknown[] = [];

  for (const line of lines) {
    try {
      messages.push(JSON.parse(line));
    } catch (err) {
      console.error("Failed to parse message:", line, err);
    }
  }

  return messages;
}

/**
 * Finds the project root by looking for package.json, going up the directory tree
 * @param startDir - Directory to start searching from (default: process.cwd())
 * @returns Absolute path to project root, or startDir if not found
 * @public
 */
export function findProjectRoot(startDir: string = process.cwd()): string {
  const { existsSync } = require("fs");
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const packageJsonPath = path.join(currentDir, "package.json");
    const nodeModulesPath = path.join(currentDir, "node_modules");

    if (existsSync(packageJsonPath) || existsSync(nodeModulesPath)) {
      return currentDir;
    }

    currentDir = path.dirname(currentDir);
  }

  return path.resolve(startDir);
}

/**
 * Auto-detects .env file location by searching common locations
 * @param baseDir - Base directory to search from
 * @returns Relative path to .env file if found (e.g., '.env'), null otherwise
 * @public
 */
export async function findEnvFile(baseDir: string): Promise<string | null> {
  const { access } = await import("fs/promises");
  const commonPaths = [
    ".env",
    ".env.local",
    ".env.development",
    ".env.development.local",
  ];

  for (const envPath of commonPaths) {
    const fullPath = path.resolve(baseDir, envPath);
    try {
      await access(fullPath);
      return envPath; // Return relative path
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Auto-detects common configuration files by searching common locations
 * @param baseDir - Base directory to search from
 * @param fileName - Name of the config file to find (e.g., 'package.json', 'tsconfig.json')
 * @returns Relative path to config file if found, null otherwise
 * @public
 */
export async function findConfigFile(
  baseDir: string,
  fileName: string
): Promise<string | null> {
  const { access } = await import("fs/promises");
  const commonPaths = [
    fileName,
    `config/${fileName}`,
    `.config/${fileName}`,
  ];

  for (const configPath of commonPaths) {
    const fullPath = path.resolve(baseDir, configPath);
    try {
      await access(fullPath);
      return configPath; // Return relative path
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Finds common JSON configuration files in the project
 * @param baseDir - Base directory to search from
 * @returns Map of common config file names to their relative paths (if found)
 * @public
 */
export async function findCommonConfigFiles(
  baseDir: string
): Promise<Record<string, string>> {
  const commonFiles = [
    "package.json",
    "tsconfig.json",
    "jsconfig.json",
    "next.config.js",
    "next.config.json",
    "vite.config.js",
    "vite.config.ts",
    "webpack.config.js",
    "rollup.config.js",
  ];

  const found: Record<string, string> = {};

  for (const fileName of commonFiles) {
    const filePath = await findConfigFile(baseDir, fileName);
    if (filePath) {
      found[fileName] = filePath;
    }
  }

  return found;
}
