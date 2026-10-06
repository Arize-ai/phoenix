## Contents

- Workflow
- Create LSP servers
- Start LSP servers
- Stop LSP servers
- Code completions
- File notifications
- Document symbols
- Sandbox symbols
- See Also




Language Server Protocol (LSP) support is available through LSP server instances created from a sandbox. A language server runs inside the sandbox and analyzes the project's code, so your application gets IDE-grade code intelligence for code that never leaves the sandbox.

An LSP server covers code completions, file open and close notifications, document symbols, and sandbox-wide symbol search. Each server instance is scoped to one language and one project directory; Python and TypeScript language servers are available by default.

## Workflow

Follow this order when using LSP in a sandbox:

1. Create an LSP server instance with **`create_lsp_server`** or **`createLspServer`**
2. Call **`start()`** to initialize the language server; LSP methods fail until the server is started
3. Call **`didOpen()`** on a file before requesting completions or document symbols for that file
4. Use completions, document symbols, or sandbox symbols
5. Call **`didClose()`** when you finish with a file
6. Call **`stop()`** when the LSP server is no longer needed

## Create LSP servers

Create an LSP server instance by providing the language ID and the path to the project.

- **Python**: **`LspLanguageId.PYTHON`**
- **TypeScript and JavaScript**: **`LspLanguageId.TYPESCRIPT`**
- **Custom**: Install the language server for your target language

```typescript
import { Daytona, LspLanguageId } from '@daytona/sdk'

// Create sandbox
const daytona = new Daytona()
const sandbox = await daytona.create()

// Create LSP server for TypeScript
const lspServer = await sandbox.createLspServer(
  LspLanguageId.TYPESCRIPT,
  'workspace/project'
)
```

## Start LSP servers

Start an LSP server by calling **`start()`** before any other LSP operation.

```typescript
const lsp = await sandbox.createLspServer(
  LspLanguageId.TYPESCRIPT,
  'workspace/project'
)
await lsp.start() // Initialize the server
// Now ready for LSP operations
```

## Stop LSP servers

Stop an LSP server by calling **`stop()`** when the LSP server is no longer needed.

```typescript
// When done with LSP features
await lsp.stop() // Clean up resources
```

## Code completions

Get code completions for a specific position in a file by providing the file path and position.

- Position values are zero-based (`line: 0` is the first line)
- Call **`didOpen()`** on the file before requesting completions

```typescript
const completions = await lspServer.completions('workspace/project/main.ts', {
  line: 10,
  character: 15,
})
console.log('Completions:', completions)
```

## File notifications

Daytona provides methods to notify the LSP server when files are opened or closed. This enables completion and symbol tracking for the specified files.

### Open file

Notify the language server that a file has been opened for editing by providing the path to the file. The server reads the file contents from disk at open time.

```typescript
// Notify server that a file is open
await lspServer.didOpen('workspace/project/main.ts')
```

### Close file

Notify the language server that a file has been closed by providing the path to the file. This allows the server to clean up resources associated with that file.

```typescript
// Notify server that a file is closed
await lspServer.didClose('workspace/project/main.ts')
```

## Document symbols

Retrieve symbols (functions, classes, variables, etc.) from a document by providing the path to the file.

```typescript
const symbols = await lspServer.documentSymbols('workspace/project/main.ts')
symbols.forEach((symbol) => {
  console.log(`Symbol: ${symbol.name}, Kind: ${symbol.kind}`)
})
```

## Sandbox symbols

Search for symbols across all files in the sandbox by providing the query and the language ID. The Java SDK uses **`workspaceSymbols()`** instead of **`sandboxSymbols()`**.

```typescript
const symbols = await lspServer.sandboxSymbols('MyClass')
symbols.forEach((symbol) => {
  console.log(`Found: ${symbol.name} at ${symbol.location}`)
})
```

## See Also
- [Python SDK - language-server-protocol](../python-sdk/language-server-protocol.md)
