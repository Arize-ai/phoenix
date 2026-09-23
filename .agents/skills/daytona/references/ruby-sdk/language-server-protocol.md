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

```ruby
require 'daytona'

# Create Sandbox
daytona = Daytona::Daytona.new
sandbox = daytona.create

# Create LSP server for Python
lsp_server = sandbox.create_lsp_server(
  language_id: Daytona::LspServer::Language::PYTHON,
  path_to_project: 'workspace/project'
)
```

## Start LSP servers

Start an LSP server by calling **`start()`** before any other LSP operation.

```ruby
lsp = sandbox.create_lsp_server(
  language_id: Daytona::LspServer::Language::PYTHON,
  path_to_project: 'workspace/project'
)
lsp.start  # Initialize the server
# Now ready for LSP operations
```

## Stop LSP servers

Stop an LSP server by calling **`stop()`** when the LSP server is no longer needed.

```ruby
# When done with LSP features
lsp.stop  # Clean up resources
```

## Code completions

Get code completions for a specific position in a file by providing the file path and position.

- Position values are zero-based (`line: 0` is the first line)
- Call **`didOpen()`** on the file before requesting completions

```ruby
completions = lsp_server.completions(
  path: 'workspace/project/main.py',
  position: { line: 10, character: 15 }
)
puts "Completions: #{completions}"
```

## File notifications

Daytona provides methods to notify the LSP server when files are opened or closed. This enables completion and symbol tracking for the specified files.

### Open file

Notify the language server that a file has been opened for editing by providing the path to the file. The server reads the file contents from disk at open time.

```ruby
# Notify server that a file is open
lsp_server.did_open('workspace/project/main.py')
```

### Close file

Notify the language server that a file has been closed by providing the path to the file. This allows the server to clean up resources associated with that file.

```ruby
# Notify server that a file is closed
lsp_server.did_close('workspace/project/main.py')
```

## Document symbols

Retrieve symbols (functions, classes, variables, etc.) from a document by providing the path to the file.

```ruby
symbols = lsp_server.document_symbols('workspace/project/main.py')
symbols.each do |symbol|
  puts "Symbol: #{symbol.name}, Kind: #{symbol.kind}"
end
```

## Sandbox symbols

Search for symbols across all files in the sandbox by providing the query and the language ID. The Java SDK uses **`workspaceSymbols()`** instead of **`sandboxSymbols()`**.

```ruby
symbols = lsp_server.sandbox_symbols('MyClass')
symbols.each do |symbol|
  puts "Found: #{symbol.name} at #{symbol.location}"
end
```

## See Also
- [Python SDK - language-server-protocol](../python-sdk/language-server-protocol.md)
- [TypeScript SDK - language-server-protocol](../typescript-sdk/language-server-protocol.md)
- [Java SDK - language-server-protocol](../java-sdk/language-server-protocol.md)
- [Go SDK - language-server-protocol](../go-sdk/language-server-protocol.md)
