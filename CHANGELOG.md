# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.6] - 2025-11-02

### Added
- Added `tsup` configuration for improved build process
- Added `default` export to package.json exports field for better module compatibility
- Added `tsconfig.build.json` for separate build-time TypeScript configuration

### Changed
- Enhanced `FileSync` baseDir validation with comprehensive type checking and defensive programming
- Improved `syncEnvFile()` error handling with detailed validation and clearer error messages
- Disabled source maps and declaration maps in production builds for smaller package size
- Simplified `.npmignore` for cleaner package structure

### Fixed
- Added try-catch error handling for `.env` file auto-detection to prevent crashes
- Enhanced type safety with explicit string validation for baseDir and envPath
- Improved fallback logic when project root detection fails

## [0.1.5] - 2025-11-02

### Fixed
- Added fallback to `process.cwd()` when `findProjectRoot()` returns null, preventing FileSync initialization failures
- Added explicit error handling in `syncEnvFile()` to throw a clear error message if `baseDir` is not set

### Changed
- Improved error messages for better debugging when project root detection fails

## [0.1.4] - 2025-01-02

### Added
- `serverUrl` option in `createClient()` to pass server URL directly, overriding environment variable
- Comprehensive documentation for server URL configuration with priority order
- Updated example servers with comments showing all configuration options
- CHANGELOG.md file to track version history

### Changed
- Server URL resolution priority: `options.serverUrl` > `STATEMESH_SERVER_URL` env var > default
- Improved README documentation for configuration options

## [Unreleased]

## [0.1.3] - 2025-01-02

### Added
- Auto-detection of project root via `findProjectRoot()` utility
- Auto-detection of `.env` file location via `findEnvFile()` utility
- `parseEnvFile()` and `stringifyEnvFile()` utility functions exported from SDK
- Auto-detection for JSON config files (`package.json`, `tsconfig.json`, `jsconfig.json`)
- Support for `configName` parameter in `syncJsonFile()` for finding specific config files

### Changed
- `baseDir` parameter in `createFileSync()` is now optional (auto-detects project root)
- `path` parameter in `syncEnvFile()` is now optional (auto-detects `.env` files)
- `path` parameter in `syncJsonFile()` is now optional (auto-detects common config files)
- Simplified API - users no longer need to manually specify paths

### Fixed
- Removed duplicate `dist/file-sync.d.ts` that caused TypeScript type conflicts
- Type definitions now correctly reflect optional `path` parameters

## [0.1.2] - 2025-01-02

### Changed
- Updated repository URLs to point to standalone repository: `https://github.com/Contextplex/sdk-js`

## [0.1.1] - 2025-01-02

### Added
- Initial npm publish
- Complete refactoring with proper separation of concerns
- JSDoc comments for all public APIs
- TypeScript type safety (eliminated all `any` types)
- Modular architecture with separate directories for types, DTOs, utilities, and implementations

### Changed
- Renamed project from "StateMesh" to "ContextPlex"
- Updated all branding and documentation

## [0.1.0] - 2025-01-02

### Added
- Initial release
- WebSocket client for realtime state synchronization
- File synchronization for `.env` and JSON files
- API key authentication
- Auto-reconnection with exponential backoff
- TypeScript support with full type definitions
- Event-driven architecture

