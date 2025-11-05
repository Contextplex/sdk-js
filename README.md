# ContextPlex JavaScript/TypeScript SDK

[![npm version](https://img.shields.io/npm/v/@contextplex/sdk-js.svg)](https://www.npmjs.com/package/@contextplex/sdk-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

> 📝 See [CHANGELOG.md](./CHANGELOG.md) for version history and breaking changes.

Official SDK for **ContextPlex** - realtime state synchronization and file sync for developers.

ContextPlex enables seamless state sharing across development environments, making it easy to keep configuration files, environment variables, and application state synchronized across multiple machines and team members.

## Features

- 🚀 **Realtime State Sync** - Bidirectional state synchronization via WebSocket
- 📁 **File Synchronization** - Automatic `.env` and JSON file syncing across environments
- 🔍 **Auto-Detection** - Automatically detects project root and common config files
- 🔐 **API Key Authentication** - Secure, isolated namespaces per API key
- 🔄 **Auto Reconnection** - Exponential backoff with automatic reconnection
- 📦 **TypeScript Support** - Full type definitions and IntelliSense support
- 🌐 **Cross-Platform** - Works in Node.js, browser, and any JavaScript environment
- 🎯 **Simple API** - Clean, intuitive API with event-driven architecture

## Installation

```bash
npm install @contextplex/sdk-js
# or
yarn add @contextplex/sdk-js
# or
pnpm add @contextplex/sdk-js
```

## Quick Start

### Basic State Synchronization

```typescript
import { createClient } from '@contextplex/sdk-js';

// Option 1: Pass serverUrl directly (highest priority)
const client = createClient({
  namespace: 'my-project',
  apiKey: 'your-api-key',
  serverUrl: 'wss://api.contextplex.com/ws'
});

// Option 2: Use environment variable
// export STATEMESH_SERVER_URL=wss://api.contextplex.com/ws
const client = createClient({
  namespace: 'my-project',
  apiKey: 'your-api-key'
});

// Option 3: Use default (production server)
const client = createClient({
  namespace: 'my-project',
  apiKey: 'your-api-key'
  // Defaults to wss://api.contextplex.dev/ws
});

// Connect to ContextPlex
await client.connect();

// Listen for state changes
client.on('change', (event) => {
  console.log(`State changed in ${event.namespace}:`, event.ops);
});

// Set a value
await client.set('my-project', 'user.name', 'Alice');

// Get current state
const state = await client.getState('my-project');
console.log('Current state:', state);

// Delete a value
await client.delete('my-project', 'user.name');
```

### File Synchronization (.env files)

```typescript
import { createClient, createFileSync } from '@contextplex/sdk-js';

// Create client
const client = createClient({
  namespace: 'dev-environment',
  apiKey: 'dev-api-key'
});

// Create file sync instance (baseDir auto-detects project root)
const fileSync = createFileSync({
  client,
  namespace: 'dev-environment'
  // baseDir is optional - SDK auto-detects project root
});

// Connect
await fileSync.connect();

// Start syncing .env file (path auto-detected if not provided)
await fileSync.syncEnvFile({
  // path is optional - SDK auto-detects .env, .env.local, .env.development, etc.
  prefix: 'env.' // Optional, defaults to 'env.'
});

// Listen for sync events
fileSync.on('synced', (event) => {
  console.log(`${event.type} file synced: ${event.path} (${event.direction})`);
});
```

### File Synchronization (JSON files)

```typescript
// Sync a JSON configuration file
// path is optional - SDK auto-detects package.json, tsconfig.json, jsconfig.json, etc.
await fileSync.syncJsonFile({
  // path: 'config.json', // Optional - auto-detects if not provided
  // configName: 'package.json', // Or specify which config file to find
  prefix: 'config.', // Optional, defaults to 'json.'
  flatten: true      // Optional, flatten nested objects (default: true)
});
```

## API Reference

### `createClient(options: StateMeshOptions): StateMeshClient`

Creates a new ContextPlex client instance.

**Parameters:**
- `options.namespace` (string, required) - Namespace identifier for state isolation
- `options.apiKey` (string, required) - API key for authentication
- `options.serverUrl` (string, optional) - Server WebSocket URL. If provided, overrides `STATEMESH_SERVER_URL` environment variable

**Priority order for server URL:**
1. `options.serverUrl` (if provided)
2. `STATEMESH_SERVER_URL` environment variable
3. Default: `wss://api.contextplex.dev/ws`

**Returns:** `StateMeshClient` instance

**Example:**
```typescript
// Using default/localhost
const client = createClient({
  namespace: 'my-project',
  apiKey: 'my-api-key'
});

// Passing server URL directly
const client = createClient({
  namespace: 'my-project',
  apiKey: 'my-api-key',
  serverUrl: 'wss://api.contextplex.com/ws'
});

// Using environment variable
// export STATEMESH_SERVER_URL=wss://api.contextplex.com/ws
const client = createClient({
  namespace: 'my-project',
  apiKey: 'my-api-key'
});
```

### `StateMeshClient`

Main client class for ContextPlex connections.

#### Methods

##### `connect(): Promise<void>`

Connects to the ContextPlex server.

```typescript
await client.connect();
```

##### `set(namespace: string, path: string, value: unknown): Promise<void>`

Sets a value at a dot-separated path.

```typescript
await client.set('my-project', 'user.name', 'Alice');
await client.set('my-project', 'cart.items', [{ id: 1, qty: 2 }]);
```

##### `delete(namespace: string, path: string): Promise<void>`

Deletes a value at a dot-separated path.

```typescript
await client.delete('my-project', 'user.name');
```

##### `pushOps(namespace: string, ops: StateOp[]): Promise<void>`

Pushes multiple state operations atomically.

```typescript
await client.pushOps('my-project', [
  { path: 'user.name', op: 'set', value: 'Alice', ts: Date.now() * 1_000_000, session_id: '...', seq: 1 },
  { path: 'user.email', op: 'set', value: 'alice@example.com', ts: Date.now() * 1_000_000, session_id: '...', seq: 2 }
]);
```

##### `getState(namespace?: string): Promise<Record<string, unknown>>`

Gets the current state for a namespace.

```typescript
const state = await client.getState('my-project');
// or use default namespace
const defaultState = await client.getState();
```

##### `snapshot(namespace: string, options?: SnapshotOptions): Promise<string>`

Creates a snapshot of the current state.

```typescript
const snapshotId = await client.snapshot('my-project', { tag: 'checkpoint-1' });
```

##### `disconnect(): void`

Disconnects from the server.

```typescript
client.disconnect();
```

#### Events

##### `'connected'`

Emitted when connection is established.

```typescript
client.on('connected', () => {
  console.log('Connected to ContextPlex');
});
```

##### `'disconnected'`

Emitted when connection is closed.

```typescript
client.on('disconnected', () => {
  console.log('Disconnected from ContextPlex');
});
```

##### `'change'`

Emitted when state changes (from other clients).

```typescript
client.on('change', (event: ChangeEvent) => {
  console.log(`Namespace ${event.namespace} changed:`, event.ops);
});
```

##### `'state'`

Emitted when receiving state snapshot.

```typescript
client.on('state', (event: StateEvent) => {
  console.log(`State for ${event.namespace}:`, event.state);
});
```

##### `'ack'`

Emitted when operation is acknowledged.

```typescript
client.on('ack', (event: AckEvent) => {
  console.log(`Ack: ${event.namespace}, sequence: ${event.last_sequence}`);
});
```

##### `'error'`

Emitted on errors.

```typescript
client.on('error', (error: Error) => {
  console.error('ContextPlex error:', error);
});
```

### `createFileSync(options: FileSyncOptions): FileSync`

Creates a new file synchronization instance.

**Parameters:**
- `options.client` (StateMeshClient, required) - ContextPlex client instance
- `options.namespace` (string, required) - Namespace for syncing
- `options.baseDir` (string, optional) - Base directory to watch (default: auto-detected project root)

**Returns:** `FileSync` instance

**Note:** If `baseDir` is not provided, the SDK automatically detects the project root by searching for `package.json` or `node_modules` in parent directories, starting from `process.cwd()`.

### `FileSync`

Manages bidirectional synchronization of `.env` and JSON files.

#### Methods

##### `syncEnvFile(config: EnvFileConfig): Promise<void>`

Starts syncing a `.env` file.

**Parameters:**
- `config.path` (string, optional) - Path to `.env` file (relative to `baseDir`). If not provided, auto-detects common `.env` file locations (`.env`, `.env.local`, `.env.development`, `.env.development.local`)
- `config.prefix` (string, optional) - StateMesh path prefix (default: `'env.'`)

```typescript
// Auto-detect .env file location
await fileSync.syncEnvFile({
  prefix: 'env.'
});

// Or specify a custom path
await fileSync.syncEnvFile({
  path: '.env.production',
  prefix: 'env.'
});
```

##### `syncJsonFile(config: JsonFileConfig): Promise<void>`

Starts syncing a JSON file.

**Parameters:**
- `config.path` (string, optional) - Path to JSON file (relative to `baseDir`). If not provided, auto-detects common config files (`package.json`, `tsconfig.json`, `jsconfig.json`)
- `config.configName` (string, optional) - Name of config file to find (e.g., `'package.json'`). Used when `path` is not provided
- `config.prefix` (string, optional) - StateMesh path prefix (default: `'json.'`)
- `config.flatten` (boolean, optional) - Flatten nested JSON (default: `true`)

```typescript
// Auto-detect package.json or other common config files
await fileSync.syncJsonFile({
  prefix: 'config.',
  flatten: true
});

// Or specify a custom path
await fileSync.syncJsonFile({
  path: 'custom-config.json',
  prefix: 'config.',
  flatten: true
});

// Or specify which config file to find
await fileSync.syncJsonFile({
  configName: 'tsconfig.json',
  prefix: 'config.',
  flatten: true
});
```

##### `connect(): Promise<void>`

Connects to ContextPlex.

```typescript
await fileSync.connect();
```

##### `stop(): Promise<void>`

Stops watching files and disconnects.

```typescript
await fileSync.stop();
```

#### Events

##### `'syncing'`

Emitted when file sync starts.

```typescript
fileSync.on('syncing', (event: SyncingEvent) => {
  console.log(`Syncing ${event.type} file: ${event.path}`);
});
```

##### `'synced'`

Emitted when file sync completes.

```typescript
fileSync.on('synced', (event: SyncedEvent) => {
  console.log(`${event.type} file synced: ${event.path} (${event.direction})`);
});
```

##### `'connected'`

Emitted when connected to ContextPlex.

##### `'stopped'`

Emitted when sync stops.

##### `'error'`

Emitted on errors.

## Configuration

### Server URL Configuration

The SDK supports three ways to configure the server URL, with the following priority order:

1. **Pass `serverUrl` directly** (highest priority) - Overrides environment variable
2. **Environment variable** - `STATEMESH_SERVER_URL`
3. **Default** - `wss://api.contextplex.dev/ws`

#### Option 1: Pass serverUrl in createClient

```typescript
const client = createClient({
  namespace: 'my-project',
  apiKey: 'my-api-key',
  serverUrl: 'wss://api.contextplex.com/ws' // Direct override
});
```

#### Option 2: Environment Variable

```bash
# Set environment variable
export STATEMESH_SERVER_URL=wss://api.contextplex.com/ws

# Then use in code
const client = createClient({
  namespace: 'my-project',
  apiKey: 'my-api-key'
  // Uses STATEMESH_SERVER_URL automatically
});
```

#### Option 3: Default (production server)

```typescript
const client = createClient({
  namespace: 'my-project',
  apiKey: 'my-api-key'
  // Defaults to wss://api.contextplex.dev/ws
});
```

**Protocols:**
- Use `ws://` for unencrypted connections (development)
- Use `wss://` for secure WebSocket connections (production)

**Examples:**
```bash
# Local development
ws://localhost:8080/ws

# Production server
wss://api.contextplex.com/ws

# Custom server with port
wss://your-server.com:8443/ws
```

### Utility Functions

The SDK exports utility functions for path detection and file parsing:

```typescript
import {
  findProjectRoot,
  findEnvFile,
  findConfigFile,
  findCommonConfigFiles,
  parseEnvFile,
  stringifyEnvFile,
} from '@contextplex/sdk-js';

// Auto-detect project root
const projectRoot = findProjectRoot();

// Auto-detect .env file
const envFile = await findEnvFile(projectRoot);
console.log('Found .env at:', envFile); // e.g., '.env.local'

// Auto-detect config files
const configFile = await findConfigFile(projectRoot, 'package.json');
console.log('Found config at:', configFile);

// Parse .env file content
const envContent = 'KEY=value\nANOTHER_KEY=value2';
const parsed = parseEnvFile(envContent);
console.log(parsed); // { KEY: 'value', ANOTHER_KEY: 'value2' }
```

### TypeScript Types

All types are exported for TypeScript users:

```typescript
import type {
  StateMeshOptions,
  StateOp,
  SnapshotOptions,
  ChangeEvent,
  StateEvent,
  AckEvent,
  FileSyncOptions,
  EnvFileConfig,
  JsonFileConfig,
} from '@contextplex/sdk-js';
```

## Use Cases

### Development Environment Sync

Keep `.env` files synchronized across team members and machines:

```typescript
const fileSync = createFileSync({
  client: createClient({ namespace: 'team-dev', apiKey: 'team-key' }),
  namespace: 'team-dev'
  // baseDir and path auto-detected - no manual configuration needed!
});

await fileSync.connect();
// Auto-detects .env file location
await fileSync.syncEnvFile({
  prefix: 'env.'
});
```

### Configuration Management

Sync JSON configuration files across services:

```typescript
// Auto-detect and sync package.json
await fileSync.syncJsonFile({
  configName: 'package.json',
  prefix: 'package.',
  flatten: true
});

// Or sync a custom config file
await fileSync.syncJsonFile({
  path: 'services/config.json',
  prefix: 'services.config.',
  flatten: true
});
```

### Multi-Instance State Sharing

Share application state across multiple instances:

```typescript
const client = createClient({
  namespace: 'app-instances',
  apiKey: 'instance-key'
});

client.on('change', (event) => {
  // Update local application state when remote changes occur
  applyStateChanges(event.ops);
});
```

## Architecture

- **Separation of Concerns** - Clean module structure with types, DTOs, utilities, and implementations
- **Auto-Detection** - Intelligent path detection for project roots and common configuration files
- **Type Safety** - Full TypeScript support with comprehensive type definitions
- **Event-Driven** - Built on Node.js EventEmitter for reactive programming
- **Reconnection Logic** - Automatic reconnection with exponential backoff
- **File Watching** - Efficient file watching with stability detection

## Requirements

- Node.js 14+ or modern browser with WebSocket support
- ContextPlex server running and accessible

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025 ContextPlex

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/Contextplex/sdk-js).

---

**Made with ❤️ for developers**
