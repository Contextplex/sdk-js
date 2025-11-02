/**
 * @packageDocumentation
 * Constants and default configuration values
 */

/**
 * Default server URL
 * Can be overridden via STATEMESH_SERVER_URL environment variable
 * @public
 */
export const DEFAULT_SERVER_URL = 'ws://localhost:8080/ws';

/**
 * Default reconnection configuration
 * @public
 */
export const DEFAULT_RECONNECT_CONFIG = {
  /** Maximum number of reconnection attempts */
  maxAttempts: 10,
  /** Initial delay in milliseconds before first retry */
  initialDelay: 1000,
  /** Multiplier for exponential backoff */
  backoffMultiplier: 2,
} as const;

/**
 * Request timeout values in milliseconds
 * @public
 */
export const TIMEOUTS = {
  /** Timeout for acknowledgement messages */
  ACK: 5000,
  /** Timeout for state requests */
  STATE: 5000,
  /** Timeout for snapshot requests */
  SNAPSHOT: 10000,
} as const;

/**
 * Default path prefixes for file sync
 * @public
 */
export const DEFAULT_PREFIXES = {
  /** Prefix for environment variable keys */
  ENV: 'env.',
  /** Prefix for JSON file keys */
  JSON: 'json.',
} as const;

/**
 * File watcher configuration
 * @public
 */
export const FILE_WATCHER_CONFIG = {
  /** Stability threshold in milliseconds (wait for file to stabilize) */
  stabilityThreshold: 500,
  /** Poll interval in milliseconds */
  pollInterval: 100,
} as const;

/**
 * Delay in milliseconds after applying remote changes to prevent sync loops
 * @public
 */
export const REMOTE_CHANGE_DELAY = 100;
