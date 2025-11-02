/**
 * @packageDocumentation
 * StateMesh JavaScript/TypeScript SDK
 * 
 * Main entry point - exports all public APIs
 * 
 * @example
 * ```typescript
 * import { createClient, createFileSync } from '@statemesh/sdk-js';
 * 
 * const client = createClient({
 *   namespace: 'my-project',
 *   apiKey: 'my-api-key'
 * });
 * 
 * await client.connect();
 * ```
 */

export { StateMeshClient, createClient } from './client';
export { FileSync, createFileSync } from './file-sync';

export type {
  StateMeshOptions,
  StateOp,
  SnapshotOptions,
  ChangeEvent,
  StateEvent,
  AckEvent,
  FileSyncOptions,
  EnvFileConfig,
  JsonFileConfig,
  SyncingEvent,
  SyncedEvent,
  FileType,
  SyncDirection,
  StateOperation,
} from './types';

export type {
  ServerMessage,
  ClientMessage,
  BroadcastMessage,
  StateMessage,
  AckMessage,
  ErrorMessage,
  SnapshotResponseMessage,
  MessageType,
  ClientMessageType,
} from './dto';

export {
  DEFAULT_SERVER_URL,
  DEFAULT_RECONNECT_CONFIG,
  TIMEOUTS,
  DEFAULT_PREFIXES,
  FILE_WATCHER_CONFIG,
  REMOTE_CHANGE_DELAY,
} from './constants';

export {
  findProjectRoot,
  findEnvFile,
  findConfigFile,
  findCommonConfigFiles,
  parseEnvFile,
  stringifyEnvFile,
} from './utils';
