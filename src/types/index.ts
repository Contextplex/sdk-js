/**
 * @packageDocumentation
 * Core types and interfaces for StateMesh SDK
 */

import type { StateMeshClient } from '../client';

/**
 * State operation types
 * @public
 */
export type StateOperation = 'set' | 'delete' | 'merge';

/**
 * File sync types
 * @public
 */
export type FileType = 'env' | 'json';

/**
 * Sync direction indicator
 * @public
 */
export type SyncDirection = 'local->mesh' | 'mesh->local';

/**
 * State operation representation
 * @public
 */
export interface StateOp {
  /** Dot-separated path to the value (e.g., 'user.name') */
  path: string;
  /** Operation type to perform */
  op: StateOperation;
  /** Value to set (optional for delete operations) */
  value?: unknown;
  /** Timestamp in nanoseconds */
  ts: number;
  /** Unique session identifier */
  session_id: string;
  /** Sequence number for ordering */
  seq: number;
}

/**
 * Client configuration options
 * @public
 */
export interface StateMeshOptions {
  /** Namespace identifier for state isolation */
  namespace: string;
  /** API key for authentication */
  apiKey: string;
  /** Server WebSocket URL (overrides STATEMESH_SERVER_URL environment variable) */
  serverUrl?: string;
}

/**
 * Snapshot creation options
 * @public
 */
export interface SnapshotOptions {
  /** Optional tag for the snapshot */
  tag?: string;
}

/**
 * Change event payload emitted when state changes
 * @public
 */
export interface ChangeEvent {
  /** Namespace where the change occurred */
  namespace: string;
  /** Array of state operations that changed */
  ops: StateOp[];
}

/**
 * State event payload emitted when receiving current state
 * @public
 */
export interface StateEvent {
  /** Namespace identifier */
  namespace: string;
  /** Current state object (key-value pairs) */
  state: Record<string, unknown>;
}

/**
 * Acknowledgement event payload emitted after operations
 * @public
 */
export interface AckEvent {
  /** Namespace where operation was applied */
  namespace: string;
  /** Last sequence number processed */
  last_sequence: number;
  /** Whether the operation was successful */
  success: boolean;
}

/**
 * File sync configuration options
 * @public
 */
export interface FileSyncOptions {
  /** StateMesh client instance to use for syncing */
  client: StateMeshClient;
  /** Namespace for syncing (e.g., 'myproject-dev') */
  namespace: string;
  /** Base directory to watch (default: process.cwd()) */
  baseDir?: string;
}

/**
 * Environment file configuration
 * @public
 */
export interface EnvFileConfig {
  /** Path to .env file (relative to baseDir). If not provided, will auto-detect common .env file locations */
  path?: string;
  /** StateMesh path prefix for env vars (default: 'env.') */
  prefix?: string;
}

/**
 * JSON file configuration
 * @public
 */
export interface JsonFileConfig {
  /** Path to JSON file (relative to baseDir). If not provided, will attempt to auto-detect common config files */
  path?: string;
  /** StateMesh path prefix (default: 'json.') */
  prefix?: string;
  /** Whether to flatten nested JSON (default: true) */
  flatten?: boolean;
  /** If path not provided, name of config file to auto-detect (e.g., 'package.json', 'tsconfig.json') */
  configName?: string;
}

/**
 * Event emitted when file sync starts
 * @public
 */
export interface SyncingEvent {
  /** Type of file being synced */
  type: FileType;
  /** Path to the file */
  path: string;
}

/**
 * Event emitted when file sync completes
 * @public
 */
export interface SyncedEvent {
  /** Type of file that was synced */
  type: FileType;
  /** Path to the file */
  path: string;
  /** Direction of the sync */
  direction: SyncDirection;
}
