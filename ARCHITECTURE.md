# StateMesh SDK Architecture

## Directory Structure

```
src/
├── types/           # Type definitions and interfaces
│   └── index.ts     # All TypeScript types/interfaces
├── dto/             # Data Transfer Objects for protocol
│   └── index.ts     # WebSocket message DTOs
├── constants/        # Configuration constants
│   └── index.ts     # Default values and config
├── utils/           # Utility functions
│   └── index.ts     # Helper functions (parsing, formatting, etc.)
├── client/          # WebSocket client implementation
│   └── index.ts     # StateMeshClient class
├── file-sync/        # File synchronization module
│   └── index.ts     # FileSync class for .env and JSON files
└── index.ts         # Main entry point - public API exports
```

## Separation of Concerns

### Types (`types/`)
- All TypeScript interfaces and type definitions
- Event payload types
- Configuration option types
- Re-exported by main index for public API

### DTOs (`dto/`)
- WebSocket message protocol definitions
- Server → Client messages (BroadcastMessage, StateMessage, etc.)
- Client → Server messages (SubscribeMessage, OpsMessage, etc.)
- Type-safe message handling

### Constants (`constants/`)
- Default configuration values
- Timeout settings
- Default prefixes for file sync
- File watcher configuration
- Centralized configuration management

### Utils (`utils/`)
- Pure utility functions
- No dependencies on other SDK modules
- Functions: parsing, formatting, object manipulation
- Reusable across the SDK

### Client (`client/`)
- WebSocket connection management
- Reconnection logic with exponential backoff
- Message protocol handling
- State operations (set, delete, get, snapshot)
- Event emission for state changes

### File Sync (`file-sync/`)
- File watching (chokidar integration)
- .env file parsing/stringification
- JSON file flattening/unflattening
- Bidirectional sync (local ↔ mesh)
- Change detection and loop prevention

### Main Index (`index.ts`)
- Clean public API surface
- Re-exports from all modules
- Factory functions (createClient, createFileSync)
- Type exports for TypeScript users

## Design Principles

1. **Single Responsibility**: Each module has one clear purpose
2. **Dependency Direction**: Utils → Types → DTOs → Client → FileSync
3. **Type Safety**: Full TypeScript support with exported types
4. **Extensibility**: Easy to add new file types or message types
5. **Testability**: Pure functions in utils, isolated modules

## Usage

### Basic Client
```typescript
import { createClient } from '@statemesh/sdk-js';

const client = createClient({
  namespace: 'my-project',
  apiKey: 'my-api-key'
});

await client.connect();
```

### File Sync
```typescript
import { createClient, createFileSync } from '@statemesh/sdk-js';

const client = createClient({ namespace: 'dev', apiKey: 'key' });
const fileSync = createFileSync({ client, namespace: 'dev' });

await fileSync.syncEnvFile({ path: '.env' });
```

### Advanced Types
```typescript
import type { StateOp, ChangeEvent, ServerMessage } from '@statemesh/sdk-js';

client.on('change', (event: ChangeEvent) => {
  // Type-safe event handling
});
```

## Benefits of This Structure

1. **Maintainability**: Easy to find and modify specific functionality
2. **Testability**: Isolated modules can be tested independently
3. **Documentation**: Clear boundaries make code self-documenting
4. **Scalability**: Easy to add new features without breaking existing code
5. **Type Safety**: Centralized types ensure consistency
6. **Bundle Size**: Tree-shaking friendly exports

