# Development Guide

This document contains information for developers working on the Phoenix CLI package.

## Setup

From the root of the repository:

```bash
pnpm install
```

## Building

```bash
pnpm build
```

## Testing

```bash
pnpm test
```

## CLI Design Principles

The CLI should follow these principles:

1. **Lightweight**: Minimal dependencies and fast startup
2. **Intuitive**: Commands should be easy to discover and use
3. **Consistent**: Follow established CLI patterns and conventions
4. **Extensible**: Easy to add new commands and features

## Architecture

The CLI uses the existing `@arizeai/phoenix-client` library for all Phoenix API interactions.

### Directory Structure

```
src/
├── cli.ts          # Main CLI entry point
├── commands/       # Command implementations
├── utils/          # Utility functions
└── index.ts        # Library exports
```

## Adding Commands

> **TODO:** Add documentation for adding new commands once the command framework is implemented.
