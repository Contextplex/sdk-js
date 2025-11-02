/**
 * @packageDocumentation
 * File Sync Module for StateMesh
 *
 * Provides bidirectional synchronization of .env and JSON files across development environments
 */

import { EventEmitter } from "events";
import { watch, FSWatcher } from "chokidar";
import * as fs from "fs/promises";
import * as path from "path";
import { StateMeshClient } from "../client";
import {
  DEFAULT_PREFIXES,
  FILE_WATCHER_CONFIG,
  REMOTE_CHANGE_DELAY,
} from "../constants";
import {
  parseEnvFile,
  stringifyEnvFile,
  flattenObject,
  getNestedValue,
  setNestedValue,
  deleteNestedValue,
  findProjectRoot,
  findEnvFile,
  findConfigFile,
} from "../utils";
import type {
  FileSyncOptions,
  EnvFileConfig,
  JsonFileConfig,
  FileType,
  SyncDirection,
  SyncingEvent,
  SyncedEvent,
  StateOp,
} from "../types";

/**
 * File information stored in syncedFiles map
 * @internal
 */
interface SyncedFileInfo {
  type: FileType;
  prefix: string;
  path: string;
}

/**
 * File changes grouped by file
 * @internal
 */
interface FileChanges {
  type: FileType;
  changes: Record<string, unknown>;
}

/**
 * FileSync manages watching and syncing .env and JSON files via StateMesh
 *
 * Provides bidirectional synchronization between local files and StateMesh state.
 * Watches files for local changes and applies remote changes from StateMesh.
 *
 * @public
 * @example
 * ```typescript
 * const client = createClient({ namespace: 'dev', apiKey: 'key' });
 * const fileSync = createFileSync({ client, namespace: 'dev' });
 *
 * await fileSync.connect();
 * await fileSync.syncEnvFile({ path: '.env' });
 * ```
 */
export class FileSync extends EventEmitter {
  private client: StateMeshClient;
  private namespace: string;
  private baseDir: string;
  private watchers: Map<string, FSWatcher> = new Map();
  private isSyncing: boolean = false;
  private isApplyingRemote: boolean = false;
  private syncedFiles: Map<string, SyncedFileInfo> = new Map();

  /**
   * Creates a new FileSync instance
   * @param options - File sync configuration options
   */
  constructor(options: FileSyncOptions) {
    super();

    this.client = options.client;
    this.namespace = options.namespace;
    // Auto-detect project root if baseDir not provided
    this.baseDir = options.baseDir
      ? path.resolve(options.baseDir)
      : findProjectRoot();

    this.client.on("change", this.handleRemoteChange.bind(this));
    this.client.on("error", (error) => this.emit("error", error));
  }

  /**
   * Starts syncing a .env file
   * @param config - Environment file configuration (path is optional - will auto-detect if not provided)
   * @returns Promise that resolves when file is set up for syncing
   * @public
   */
  async syncEnvFile(config: EnvFileConfig): Promise<void> {
    // Auto-detect .env file if path not provided
    const envPath = config.path || (await findEnvFile(this.baseDir)) || ".env";
    const filePath = path.resolve(this.baseDir, envPath);
    const prefix = config.prefix || DEFAULT_PREFIXES.ENV;
    const fileKey = `env:${envPath}`;

    this.syncedFiles.set(fileKey, { type: "env", prefix, path: envPath });

    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, "");
    }

    await this.loadEnvFromMesh(filePath, prefix);

    const watcher = watch(filePath, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: FILE_WATCHER_CONFIG.stabilityThreshold,
        pollInterval: FILE_WATCHER_CONFIG.pollInterval,
      },
    });

    watcher.on("change", async () => {
      if (this.isSyncing || this.isApplyingRemote) return;
      await this.syncEnvToMesh(filePath, prefix);
    });

    this.watchers.set(filePath, watcher);
    this.emit("syncing", { type: "env", path: envPath } as SyncingEvent);
  }

  /**
   * Starts syncing a JSON file
   * @param config - JSON file configuration (path is optional - will auto-detect if not provided)
   * @returns Promise that resolves when file is set up for syncing
   * @public
   */
  async syncJsonFile(config: JsonFileConfig): Promise<void> {
    // Auto-detect JSON file if path not provided
    let jsonPath: string;
    if (config.path) {
      jsonPath = config.path;
    } else if (config.configName) {
      const found = await findConfigFile(this.baseDir, config.configName);
      if (!found) {
        throw new Error(
          `Config file '${config.configName}' not found. Please provide a path or ensure the file exists.`
        );
      }
      jsonPath = found;
    } else {
      const commonFiles = ["package.json", "tsconfig.json", "jsconfig.json"];
      let found: string | null = null;
      for (const fileName of commonFiles) {
        found = await findConfigFile(this.baseDir, fileName);
        if (found) break;
      }
      if (!found) {
        throw new Error(
          "No JSON config file found. Please provide a path or ensure common config files (package.json, tsconfig.json, etc.) exist."
        );
      }
      jsonPath = found;
    }

    const filePath = path.resolve(this.baseDir, jsonPath);
    const prefix = config.prefix || DEFAULT_PREFIXES.JSON;
    const flatten = config.flatten !== false;
    const fileKey = `json:${jsonPath}`;

    this.syncedFiles.set(fileKey, { type: "json", prefix, path: jsonPath });

    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, "{}");
    }

    await this.loadJsonFromMesh(filePath, prefix, flatten);

    const watcher = watch(filePath, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: FILE_WATCHER_CONFIG.stabilityThreshold,
        pollInterval: FILE_WATCHER_CONFIG.pollInterval,
      },
    });

    watcher.on("change", async () => {
      if (this.isSyncing || this.isApplyingRemote) return;
      await this.syncJsonToMesh(filePath, prefix, flatten);
    });

    this.watchers.set(filePath, watcher);
    this.emit("syncing", { type: "json", path: jsonPath } as SyncingEvent);
  }

  /**
   * Syncs local .env file to StateMesh
   * @param filePath - Absolute path to the .env file
   * @param prefix - Prefix for StateMesh keys
   * @internal
   */
  private async syncEnvToMesh(filePath: string, prefix: string): Promise<void> {
    this.isSyncing = true;
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const envVars = parseEnvFile(content);

      for (const [key, value] of Object.entries(envVars)) {
        await this.client.set(this.namespace, `${prefix}${key}`, value);
      }

      this.emit("synced", {
        type: "env",
        path: filePath,
        direction: "local->mesh",
      } as SyncedEvent);
    } catch (error) {
      this.emit("error", error as Error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Loads .env from StateMesh and merges with local file
   * @param filePath - Absolute path to the .env file
   * @param prefix - Prefix for StateMesh keys
   * @internal
   */
  private async loadEnvFromMesh(
    filePath: string,
    prefix: string
  ): Promise<void> {
    this.isSyncing = true;
    try {
      const meshState = await this.client.getState(this.namespace);
      const localContent = await fs.readFile(filePath, "utf-8").catch(() => "");
      const localVars = parseEnvFile(localContent);

      const meshEnvVars: Record<string, string> = {};
      for (const [key, value] of Object.entries(meshState)) {
        if (typeof key === "string" && key.startsWith(prefix)) {
          const envKey = key.substring(prefix.length);
          meshEnvVars[envKey] = String(value);
        }
      }

      const merged = { ...localVars, ...meshEnvVars };
      const newContent = stringifyEnvFile(merged);
      await fs.writeFile(filePath, newContent);

      this.emit("synced", {
        type: "env",
        path: filePath,
        direction: "mesh->local",
      } as SyncedEvent);
    } catch (error) {
      this.emit("error", error as Error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Syncs local JSON file to StateMesh
   * @param filePath - Absolute path to the JSON file
   * @param prefix - Prefix for StateMesh keys
   * @param flatten - Whether to flatten nested JSON
   * @internal
   */
  private async syncJsonToMesh(
    filePath: string,
    prefix: string,
    flatten: boolean
  ): Promise<void> {
    this.isSyncing = true;
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const jsonData = JSON.parse(content) as Record<string, unknown>;

      if (flatten) {
        const flat = flattenObject(jsonData);
        for (const [key, value] of Object.entries(flat)) {
          await this.client.set(this.namespace, `${prefix}${key}`, value);
        }
      } else {
        await this.client.set(
          this.namespace,
          prefix.replace(/\.$/, ""),
          jsonData
        );
      }

      this.emit("synced", {
        type: "json",
        path: filePath,
        direction: "local->mesh",
      } as SyncedEvent);
    } catch (error) {
      this.emit("error", error as Error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Loads JSON from StateMesh and updates local file
   * @param filePath - Absolute path to the JSON file
   * @param prefix - Prefix for StateMesh keys
   * @param flatten - Whether to flatten nested JSON
   * @internal
   */
  private async loadJsonFromMesh(
    filePath: string,
    prefix: string,
    flatten: boolean
  ): Promise<void> {
    this.isSyncing = true;
    try {
      const meshState = await this.client.getState(this.namespace);

      if (flatten) {
        const meshData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(meshState)) {
          if (typeof key === "string" && key.startsWith(prefix)) {
            const jsonKey = key.substring(prefix.length);
            setNestedValue(meshData, jsonKey.split("."), value);
          }
        }

        const localContent = await fs
          .readFile(filePath, "utf-8")
          .catch(() => "{}");
        const localData = JSON.parse(localContent) as Record<string, unknown>;
        const merged = { ...localData, ...meshData };

        await fs.writeFile(filePath, JSON.stringify(merged, null, 2));
      } else {
        const jsonValue = meshState[prefix.replace(/\.$/, "")];
        if (jsonValue) {
          await fs.writeFile(filePath, JSON.stringify(jsonValue, null, 2));
        }
      }

      this.emit("synced", {
        type: "json",
        path: filePath,
        direction: "mesh->local",
      } as SyncedEvent);
    } catch (error) {
      this.emit("error", error as Error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Handles remote changes from StateMesh
   * @param event - Change event containing namespace and operations
   * @internal
   */
  private async handleRemoteChange(event: {
    namespace: string;
    ops: StateOp[];
  }): Promise<void> {
    if (event.namespace !== this.namespace) return;

    const fileChanges: Map<string, FileChanges> = new Map();

    for (const op of event.ops) {
      for (const [fileKey, fileInfo] of this.syncedFiles.entries()) {
        if (op.path.startsWith(fileInfo.prefix)) {
          const relativeKey = op.path.substring(fileInfo.prefix.length);

          if (!fileChanges.has(fileKey)) {
            fileChanges.set(fileKey, { type: fileInfo.type, changes: {} });
          }

          const changes = fileChanges.get(fileKey)!.changes;
          if (op.op === "set") {
            changes[relativeKey] = op.value;
          } else if (op.op === "delete") {
            changes[relativeKey] = null;
          }
          break;
        }
      }
    }

    for (const [fileKey, { type, changes }] of fileChanges.entries()) {
      const fileInfo = this.syncedFiles.get(fileKey)!;
      const filePath = path.resolve(this.baseDir, fileInfo.path);

      if (type === "env") {
        await this.applyEnvChanges(filePath, changes);
      } else {
        await this.applyJsonChanges(filePath, changes, fileInfo.prefix);
      }
    }
  }

  /**
   * Applies environment variable changes to local file
   * @param filePath - Absolute path to the .env file
   * @param changes - Record of key-value changes
   * @internal
   */
  private async applyEnvChanges(
    filePath: string,
    changes: Record<string, unknown>
  ): Promise<void> {
    this.isApplyingRemote = true;
    try {
      const content = await fs.readFile(filePath, "utf-8").catch(() => "");
      const envVars = parseEnvFile(content);

      let hasChanges = false;
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "") {
          if (envVars[key] !== undefined) {
            delete envVars[key];
            hasChanges = true;
          }
        } else {
          const strValue = String(value);
          if (envVars[key] !== strValue) {
            envVars[key] = strValue;
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        await fs.writeFile(filePath, stringifyEnvFile(envVars));
        this.emit("synced", {
          type: "env",
          path: filePath,
          direction: "mesh->local",
        } as SyncedEvent);
      }
    } catch (error) {
      this.emit("error", error as Error);
    } finally {
      setTimeout(() => {
        this.isApplyingRemote = false;
      }, REMOTE_CHANGE_DELAY);
    }
  }

  /**
   * Applies JSON changes to local file
   * @param filePath - Absolute path to the JSON file
   * @param changes - Record of key-value changes
   * @param prefix - Prefix used for StateMesh keys
   * @internal
   */
  private async applyJsonChanges(
    filePath: string,
    changes: Record<string, unknown>,
    prefix: string
  ): Promise<void> {
    this.isApplyingRemote = true;
    try {
      const content = await fs.readFile(filePath, "utf-8").catch(() => "{}");
      const jsonData = JSON.parse(content) as Record<string, unknown>;

      let hasChanges = false;
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) {
          const oldValue = getNestedValue(jsonData, key.split("."));
          if (oldValue !== undefined) {
            deleteNestedValue(jsonData, key.split("."));
            hasChanges = true;
          }
        } else {
          const oldValue = getNestedValue(jsonData, key.split("."));
          if (oldValue !== value) {
            setNestedValue(jsonData, key.split("."), value);
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2));
        this.emit("synced", {
          type: "json",
          path: filePath,
          direction: "mesh->local",
        } as SyncedEvent);
      }
    } catch (error) {
      this.emit("error", error as Error);
    } finally {
      setTimeout(() => {
        this.isApplyingRemote = false;
      }, REMOTE_CHANGE_DELAY);
    }
  }

  /**
   * Connects to StateMesh
   * @returns Promise that resolves when connected
   * @public
   */
  async connect(): Promise<void> {
    await this.client.connect();
    this.emit("connected");
  }

  /**
   * Stops watching files and disconnects
   * @returns Promise that resolves when stopped
   * @public
   */
  async stop(): Promise<void> {
    for (const watcher of this.watchers.values()) {
      await watcher.close();
    }
    this.watchers.clear();
    this.client.disconnect();
    this.emit("stopped");
  }

  /**
   * Event: 'syncing' - Emitted when file sync starts
   */
  on(event: "syncing", listener: (event: SyncingEvent) => void): this;
  /**
   * Event: 'synced' - Emitted when file sync completes
   */
  on(event: "synced", listener: (event: SyncedEvent) => void): this;
  /**
   * Event: 'connected' - Emitted when connected to StateMesh
   */
  on(event: "connected", listener: () => void): this;
  /**
   * Event: 'stopped' - Emitted when sync stops
   */
  on(event: "stopped", listener: () => void): this;
  /**
   * Event: 'error' - Emitted on errors
   */
  on(event: "error", listener: (error: Error) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }
}

/**
 * Creates a new FileSync instance
 * @param options - File sync configuration options
 * @returns New FileSync instance
 * @public
 * @example
 * ```typescript
 * const fileSync = createFileSync({
 *   client: myClient,
 *   namespace: 'dev'
 * });
 * ```
 */
export function createFileSync(options: FileSyncOptions): FileSync {
  return new FileSync(options);
}
