/**
 * @packageDocumentation
 * Data Transfer Objects for WebSocket message protocol
 */

import type { StateOp } from '../types';

/**
 * Base message structure
 * @internal
 */
export interface BaseMessage {
  /** Message type identifier */
  type: MessageType;
}

/**
 * Message types from server
 * @public
 */
export type MessageType = 
  | 'broadcast'
  | 'state'
  | 'ack'
  | 'error'
  | 'snapshot_response';

/**
 * Broadcast message containing state changes from other clients
 * @public
 */
export interface BroadcastMessage extends BaseMessage {
  type: 'broadcast';
  /** Namespace where changes occurred */
  namespace: string;
  /** Array of state operations */
  ops: StateOp[];
  /** API key of the sender (for filtering) */
  api_key?: string;
}

/**
 * State message containing current state snapshot
 * @public
 */
export interface StateMessage extends BaseMessage {
  type: 'state';
  /** Namespace identifier */
  namespace: string;
  /** Current state object */
  state: Record<string, unknown>;
}

/**
 * Acknowledgement message confirming operation completion
 * @public
 */
export interface AckMessage extends BaseMessage {
  type: 'ack';
  /** Namespace where operation was applied */
  namespace: string;
  /** Last sequence number processed */
  last_sequence: number;
  /** Operation success status */
  success: boolean;
}

/**
 * Error message from server
 * @public
 */
export interface ErrorMessage extends BaseMessage {
  type: 'error';
  /** Error code */
  code: string;
  /** Error message */
  message: string;
}

/**
 * Snapshot response message
 * @public
 */
export interface SnapshotResponseMessage extends BaseMessage {
  type: 'snapshot_response';
  /** Unique snapshot identifier */
  snapshot_id: string;
  /** Namespace of the snapshot */
  namespace: string;
  /** Timestamp when snapshot was created */
  timestamp?: number;
  /** Content identifier (CID) for snapshot */
  cid?: string;
  /** Optional tag associated with snapshot */
  tag?: string;
  /** Optional warning message */
  warning?: string;
}

/**
 * Client to server message types
 * @public
 */
export type ClientMessageType = 'subscribe' | 'ops' | 'snapshot';

/**
 * Subscribe message to receive updates for a namespace
 * @public
 */
export interface SubscribeMessage {
  type: 'subscribe';
  /** Namespace to subscribe to */
  namespace: string;
}

/**
 * Operations message to push state changes
 * @public
 */
export interface OpsMessage {
  type: 'ops';
  /** Namespace where operations apply */
  namespace: string;
  /** Array of state operations */
  ops: StateOp[];
}

/**
 * Snapshot request message
 * @public
 */
export interface SnapshotMessage {
  type: 'snapshot';
  /** Namespace to snapshot */
  namespace: string;
  /** Optional tag for the snapshot */
  tag?: string;
}

/**
 * Union type for all server messages
 * @public
 */
export type ServerMessage = 
  | BroadcastMessage
  | StateMessage
  | AckMessage
  | ErrorMessage
  | SnapshotResponseMessage;

/**
 * Union type for all client messages
 * @public
 */
export type ClientMessage = 
  | SubscribeMessage
  | OpsMessage
  | SnapshotMessage;
