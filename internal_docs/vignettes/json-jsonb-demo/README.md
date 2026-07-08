# PostgreSQL JSON vs JSONB Demo

This project demonstrates the key differences between PostgreSQL's JSON and JSONB data types. The most striking difference is how they handle key ordering:

```
Original input: { "z": 26, "a": 1, "m": 13 }

JSON output:    { "z": 26, "a": 1, "m": 13 }     | JSONB output:    { "a": 1, "m": 13, "z": 26 }
(preserves original order)                        | (sorts keys alphabetically)
```

Here's a real example from our test data:

```
Original input order: ['QVZZCJFR', 'DAUFW', 'DXRMYF', 'SEETRJBUU', ...]

JSON output: {                | JSONB output: {
  "QVZZCJFR": 8,              |   "B": 1,
  "DAUFW": 5,                 |   "XT": 2,
  "DXRMYF": 6,                |   "RHD": 3,
  "SEETRJBUU": 9,             |   "YPSE": 4,
  "YPSE": 4,                  |   "DAUFW": 5,
  "DEGAZFI": 7,               |   "DXRMYF": 6,
  "XT": 2,                    |   "DEGAZFI": 7,
  "RHD": 3,                   |   "QVZZCJFR": 8,
  "B": 1,                     |   "SEETRJBUU": 9,
  "JCXSRJOEXE": 10            |   "JCXSRJOEXE": 10
}                             | }
```

JSON preserves your exact input format, while JSONB optimizes for querying by reordering keys lexicographically. This project provides practical examples and performance comparisons to help developers understand when to use each type.

## Features

- **Key Order Comparison**: Demonstrates how JSON preserves key order while JSONB sorts keys lexicographically
- **Performance Benchmarks**: Compares insert and query performance between JSON and JSONB
- **Query Capabilities**: Shows various query operations and operators available for both types
- **Index Impact**: Demonstrates the effect of GIN indexing on JSONB queries
- **TypeScript Support**: Fully typed codebase with proper type definitions

## Prerequisites

- Node.js (v18 or higher)
- pnpm (v10.2.0 or higher)
- PostgreSQL (v12 or higher) - Optional, as the demo can use PGlite by default

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

## Configuration

The project can use either PGlite (in-memory PostgreSQL) or a real PostgreSQL database. Configure this in `src/config/db-config.ts`:

```typescript
// Set to true to use PGlite, false to use PostgreSQL
export const USE_PGLITE: boolean = true;
```

If using PostgreSQL, set the following environment variables or update the defaults in `src/services/db-service.ts`:
- `DB_USER` (default: "postgres")
- `DB_HOST` (default: "localhost")
- `DB_NAME` (default: "json_demo")
- `DB_PASSWORD` (default: "postgres")
- `DB_PORT` (default: "5432")

## Usage

Run the following commands to see different aspects of JSON vs JSONB:

```bash
# Run the main demo (key order comparison)
pnpm start

# Run performance benchmarks
pnpm run performance

# Run query examples
pnpm run query

# Run key order comparison
pnpm run compare
```

## Demo Scripts

1. **compare.ts**: Demonstrates key order preservation differences
   - Shows how JSON preserves input key order
   - Shows how JSONB reorders keys lexicographically
   - Compares storage sizes

2. **performance.ts**: Benchmarks performance characteristics
   - Insert performance comparison
   - Query performance comparison
   - Index impact on queries
   - JSONB-specific operator performance

3. **query-examples.ts**: Shows query capabilities
   - Basic key access
   - Nested key access
   - Array access
   - Filtering
   - JSONB-specific operators

## Key Findings

### When to use JSON
- When you need to preserve exact document format including whitespace and key order
- For write-heavy operations with minimal querying
- When input validation is more important than query performance

### When to use JSONB
- When you need frequent querying of the JSON data
- When you need indexing capabilities
- When query performance is critical
- When storage space is a concern
- When key order preservation is not required

## Development

- `pnpm run format`: Format code using Prettier
- `pnpm run lint`: Run ESLint
- `pnpm run typecheck`: Run TypeScript type checking

## Project Structure

```
src/
├── config/
│   └── db-config.ts       # Database configuration
├── services/
│   └── db-service.ts      # Database service with PG/PGlite support
├── types/
│   └── db.types.ts        # TypeScript type definitions
├── compare.ts             # Key order comparison demo
├── performance.ts         # Performance benchmarks
├── query-examples.ts      # Query capabilities demo
└── index.ts              # Main entry point
```

## License

MIT
