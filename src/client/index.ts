/**
 * @packageDocumentation
 * StateMesh WebSocket Client
 */

import WebSocket from "ws";
import { EventEmitter } from "events";
import {
  DEFAULT_SERVER_URL,
  DEFAULT_RECONNECT_CONFIG,
  TIMEOUTS,
} from "../constants";
import {
  generateSessionId,
  calculateBackoffDelay,
  parseWebSocketMessages,
} from "../utils";
import type {
  StateMeshOptions,
  StateOp,
  SnapshotOptions,
  ChangeEvent,
  StateEvent,
  AckEvent,
} from "../types";
import type {
  ServerMessage,
  ClientMessage,
  BroadcastMessage,
  StateMessage,
  AckMessage,
  ErrorMessage,
  SnapshotResponseMessage,
} from "../dto";

/**
 * StateMesh WebSocket Client
 *
 * Manages connection, reconnection, and message protocol with StateMesh server.
 * Emits events for state changes, acknowledgements, and connection status.
 *
 * @public
 * @example
 * ```typescript
 * const client = createClient({
 *   namespace: 'my-project',
 *   apiKey: 'my-api-key'
 * });
 *
 * await client.connect();
 * client.on('change', (event) => {
 *   console.log('State changed:', event);
 * });
 * ```
 */
export class StateMeshClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private namespace: string;
  private apiKey: string;
  private sessionId: string;
  private sequence: number = 0;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = DEFAULT_RECONNECT_CONFIG.maxAttempts;
  private reconnectDelay: number = DEFAULT_RECONNECT_CONFIG.initialDelay;

  /**
   * Creates a new StateMesh client instance
   * @param options - Configuration options
   * @throws {Error} If namespace or apiKey is missing
   */
  constructor(options: StateMeshOptions) {
    super();

    // Priority: options.serverUrl > STATEMESH_SERVER_URL env var > DEFAULT_SERVER_URL
    this.serverUrl =
      options.serverUrl ||
      process.env.STATEMESH_SERVER_URL ||
      DEFAULT_SERVER_URL;

    if (!options.namespace) {
      throw new Error("namespace is required");
    }
    if (!options.apiKey) {
      throw new Error("apiKey is required");
    }

    this.namespace = options.namespace;
    this.apiKey = options.apiKey;
    this.sessionId = generateSessionId();
  }

  /**
   * Connects to the StateMesh server
   * @returns Promise that resolves when connection is established
   * @throws {Error} If connection fails
   * @public
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(this.serverUrl);
        url.searchParams.set("api_key", this.apiKey);

        this.ws = new WebSocket(url.toString());

        this.ws.on("open", () => {
          this.reconnectAttempts = 0;
          this.emit("connected");
          this.subscribe(this.namespace);
          resolve();
        });

        this.ws.on("message", (data: WebSocket.Data) => {
          try {
            const messages = parseWebSocketMessages(
              data.toString()
            ) as ServerMessage[];
            for (const message of messages) {
              this.handleMessage(message);
            }
          } catch (err) {
            this.emit("error", err as Error);
          }
        });

        this.ws.on("error", (error) => {
          this.emit("error", error);
          reject(error);
        });

        this.ws.on("close", () => {
          this.emit("disconnected");
          this.attemptReconnect();
        });
      } catch (err) {
        reject(err as Error);
      }
    });
  }

  /**
   * Attempts to reconnect with exponential backoff
   * @internal
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit("error", new Error("Max reconnection attempts reached"));
      return;
    }

    this.reconnectAttempts++;
    const delay = calculateBackoffDelay(
      this.reconnectAttempts,
      this.reconnectDelay,
      DEFAULT_RECONNECT_CONFIG.backoffMultiplier
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await this.connect();
    } catch {
      console.error("Failed to reconnect to StateMesh server");
      this.emit("error", new Error("Failed to reconnect to StateMesh server"));
    }
  }

  /**
   * Handles incoming messages from server
   * @param message - Server message to process
   * @internal
   */
  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case "broadcast":
        this.handleBroadcast(message as BroadcastMessage);
        break;
      case "state":
        this.handleState(message as StateMessage);
        break;
      case "ack":
        this.handleAck(message as AckMessage);
        break;
      case "error":
        this.handleError(message as ErrorMessage);
        break;
      case "snapshot_response":
        this.handleSnapshotResponse(message as SnapshotResponseMessage);
        break;
      default:
        this.emit("message", message);
    }
  }

  /**
   * Handles broadcast messages (state changes)
   * @param message - Broadcast message
   * @internal
   */
  private handleBroadcast(message: BroadcastMessage): void {
    if (message.api_key && message.api_key !== this.apiKey) {
      return;
    }

    this.emit("change", {
      namespace: message.namespace,
      ops: message.ops,
    } as ChangeEvent);
  }

  /**
   * Handles state messages (current state snapshot)
   * @param message - State message
   * @internal
   */
  private handleState(message: StateMessage): void {
    this.emit("state", {
      namespace: message.namespace,
      state: message.state,
    } as StateEvent);
  }

  /**
   * Handles acknowledgement messages
   * @param message - Acknowledgement message
   * @internal
   */
  private handleAck(message: AckMessage): void {
    this.emit("ack", {
      namespace: message.namespace,
      last_sequence: message.last_sequence,
      success: message.success,
    } as AckEvent);
  }

  /**
   * Handles error messages
   * @param message - Error message
   * @internal
   */
  private handleError(message: ErrorMessage): void {
    this.emit("error", new Error(message.message || "Unknown error"));
  }

  /**
   * Handles snapshot response messages
   * @param message - Snapshot response message
   * @internal
   */
  private handleSnapshotResponse(message: SnapshotResponseMessage): void {
    this.emit("message", message);
  }

  /**
   * Subscribes to a namespace
   * @param namespace - Namespace to subscribe to
   * @internal
   */
  private subscribe(namespace: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: ClientMessage = {
      type: "subscribe",
      namespace,
    };

    this.sendMessage(message);
  }

  /**
   * Sends a message to the server
   * @param message - Client message to send
   * @throws {Error} If WebSocket is not connected
   * @internal
   */
  private sendMessage(message: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Sets a value at a path
   * @param namespace - Namespace identifier
   * @param path - Dot-separated path to the value (e.g., 'user.name')
   * @param value - Value to set
   * @returns Promise that resolves when operation is acknowledged
   * @throws {Error} If WebSocket is not connected or operation times out
   * @public
   */
  async set(namespace: string, path: string, value: unknown): Promise<void> {
    await this.pushOps(namespace, [
      {
        path,
        op: "set",
        value,
        ts: Date.now() * 1_000_000,
        session_id: this.sessionId,
        seq: ++this.sequence,
      },
    ]);
  }

  /**
   * Deletes a value at a path
   * @param namespace - Namespace identifier
   * @param path - Dot-separated path to the value (e.g., 'user.name')
   * @returns Promise that resolves when operation is acknowledged
   * @throws {Error} If WebSocket is not connected or operation times out
   * @public
   */
  async delete(namespace: string, path: string): Promise<void> {
    await this.pushOps(namespace, [
      {
        path,
        op: "delete",
        ts: Date.now() * 1_000_000,
        session_id: this.sessionId,
        seq: ++this.sequence,
      },
    ]);
  }

  /**
   * Pushes multiple state operations atomically
   * @param namespace - Namespace identifier
   * @param ops - Array of state operations
   * @returns Promise that resolves when operations are acknowledged
   * @throws {Error} If WebSocket is not connected or operation times out
   * @public
   */
  async pushOps(namespace: string, ops: StateOp[]): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }

    return new Promise((resolve, reject) => {
      const message: ClientMessage = {
        type: "ops",
        namespace,
        ops,
      };

      const ackHandler = (ack: AckEvent) => {
        if (ack.namespace === namespace && ack.success) {
          this.removeListener("ack", ackHandler);
          resolve();
        }
      };

      const errorHandler = (error: Error) => {
        this.removeListener("ack", ackHandler);
        reject(error);
      };

      this.once("ack", ackHandler);
      this.once("error", errorHandler);

      this.sendMessage(message);

      setTimeout(() => {
        this.removeListener("ack", ackHandler);
        this.removeListener("error", errorHandler);
        reject(new Error("Timeout waiting for acknowledgement"));
      }, TIMEOUTS.ACK);
    });
  }

  /**
   * Gets current state for a namespace
   * @param namespace - Namespace identifier (optional, defaults to client namespace)
   * @returns Promise that resolves with the current state object
   * @throws {Error} If WebSocket is not connected or operation times out
   * @public
   */
  async getState(namespace?: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const targetNamespace = namespace || this.namespace;

      const stateHandler = (state: StateEvent) => {
        if (state.namespace === targetNamespace) {
          this.removeListener("state", stateHandler);
          resolve(state.state);
        }
      };

      const errorHandler = (error: Error) => {
        this.removeListener("state", stateHandler);
        reject(error);
      };

      this.once("state", stateHandler);
      this.once("error", errorHandler);

      this.subscribe(targetNamespace);

      setTimeout(() => {
        this.removeListener("state", stateHandler);
        this.removeListener("error", errorHandler);
        reject(new Error("Timeout waiting for state"));
      }, TIMEOUTS.STATE);
    });
  }

  /**
   * Creates a snapshot of current state
   * @param namespace - Namespace identifier
   * @param options - Snapshot options
   * @returns Promise that resolves with the snapshot ID
   * @throws {Error} If WebSocket is not connected or operation times out
   * @public
   */
  async snapshot(
    namespace: string,
    options: SnapshotOptions = {}
  ): Promise<string> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }

    return new Promise((resolve, reject) => {
      const message: ClientMessage = {
        type: "snapshot",
        namespace,
        ...(options.tag && { tag: options.tag }),
      };

      const snapshotHandler = (response: SnapshotResponseMessage) => {
        if (
          response.type === "snapshot_response" &&
          response.namespace === namespace
        ) {
          this.removeListener("message", snapshotHandler);
          resolve(response.snapshot_id);
        }
      };

      const errorHandler = (error: Error) => {
        this.removeListener("message", snapshotHandler);
        reject(error);
      };

      this.once("message", snapshotHandler);
      this.once("error", errorHandler);

      this.sendMessage(message);

      setTimeout(() => {
        this.removeListener("message", snapshotHandler);
        this.removeListener("error", errorHandler);
        reject(new Error("Timeout waiting for snapshot response"));
      }, TIMEOUTS.SNAPSHOT);
    });
  }

  /**
   * Disconnects from the server
   * @public
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Event: 'connected' - Emitted when connection is established
   */
  on(event: "connected", listener: () => void): this;
  /**
   * Event: 'disconnected' - Emitted when connection is closed
   */
  on(event: "disconnected", listener: () => void): this;
  /**
   * Event: 'change' - Emitted when state changes (from other clients)
   */
  on(event: "change", listener: (change: ChangeEvent) => void): this;
  /**
   * Event: 'state' - Emitted when receiving state snapshot
   */
  on(event: "state", listener: (state: StateEvent) => void): this;
  /**
   * Event: 'ack' - Emitted when operation is acknowledged
   */
  on(event: "ack", listener: (ack: AckEvent) => void): this;
  /**
   * Event: 'error' - Emitted on errors
   */
  on(event: "error", listener: (error: Error) => void): this;
  /**
   * Event: 'message' - Emitted for unhandled messages
   */
  on(event: "message", listener: (message: ServerMessage) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }
}

/**
 * Creates a new StateMesh client instance
 * @param options - Client configuration options
 * @returns New StateMesh client instance
 * @public
 * @example
 * ```typescript
 * const client = createClient({
 *   namespace: 'my-project',
 *   apiKey: 'my-api-key'
 * });
 * ```
 */
export function createClient(options: StateMeshOptions): StateMeshClient {
  return new StateMeshClient(options);
}
