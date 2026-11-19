# Lsp (TypeScript SDK reference)

## Contents

- [LspServer](#lspserver)
- [LspService](#lspservice)
- [LspCompletionsOptions](#lspcompletionsoptions)
- [LspCompletionItem](#lspcompletionitem)
- [LspCompletionList](#lspcompletionlist)
- [LspLocation](#lsplocation)
- [LspPosition](#lspposition)
- [LspRange](#lsprange)
- [LspSymbol](#lspsymbol)

## LspServer

### Constructors

#### Constructor

```ts
new LspServer(
   transport: HttpTransport,
   languageId: string,
   pathToProject: string): LspServer;
```

**Parameters**:

- `transport` _HttpTransport_
- `languageId` _string_
- `pathToProject` _string_

**Returns**:

- `LspServer`

### Methods

#### \[Symbol.asyncDispose\]()

```ts
[Symbol.asyncDispose](): Promise<void>;
```

**Returns**:

- `Promise<void>`

#### closeDocument()

```ts
closeDocument(uri: string): Promise<void>;
```

Notify the server that the document at `uri` was closed.

**Parameters**:

- `uri` _string_

**Returns**:

- `Promise<void>`

#### completions()

```ts
completions(
   uri: string,
   position: LspPosition,
   options: LspCompletionsOptions = {}): Promise<LspCompletionList>;
```

**Parameters**:

- `uri` _string_
- `position` _LspPosition_
- `options` _LspCompletionsOptions = \{\}_

**Returns**:

- `Promise<LspCompletionList>`

#### documentSymbols()

```ts
documentSymbols(uri: string): Promise<LspSymbol[]>;
```

**Parameters**:

- `uri` _string_

**Returns**:

- `Promise<LspSymbol[]>`

#### openDocument()

```ts
openDocument(uri: string): Promise<void>;
```

Notify the server that the document at `uri` was opened.

**Parameters**:

- `uri` _string_

**Returns**:

- `Promise<void>`

#### stop()

```ts
stop(): Promise<void>;
```

**Returns**:

- `Promise<void>`

#### workspaceSymbols()

```ts
workspaceSymbols(query: string): Promise<LspSymbol[]>;
```

**Parameters**:

- `query` _string_

**Returns**:

- `Promise<LspSymbol[]>`

***

## LspService

Sandbox LSP namespace.

Each language server is identified by `languageId` + `pathToProject`.
Call `start()` before other operations: an unavailable language server
raises `LSP_SERVER_UNAVAILABLE`, and operations on a server that has not
started raise `LSP_NOT_STARTED`.

### Constructors

#### Constructor

```ts
new LspService(transport: HttpTransport): LspService;
```

**Parameters**:

- `transport` _HttpTransport_

**Returns**:

- `LspService`

### Methods

#### start()

```ts
start(languageId: string, pathToProject: string): Promise<LspServer>;
```

Start the language server for a project.

**Parameters**:

- `languageId` _string_
- `pathToProject` _string_

**Returns**:

- `Promise<LspServer>`

***

## LspCompletionsOptions

**Properties**:

- `context?` _toolbox.CompletionRequest\['context'\]_

***

## LspCompletionItem

```ts
type LspCompletionItem = {
  [key: string]: unknown
} & Omit<toolbox.CompletionItem, 'documentation'> & {
  documentation?: unknown
}
```

One completion candidate, with the shape supplied by the language server.

***

## LspCompletionList

```ts
type LspCompletionList = Omit<toolbox.CompletionList, 'items'> & { items: LspCompletionItem[] }
```

***

## LspLocation

```ts
type LspLocation = toolbox.SymbolLocation
```

***

## LspPosition

```ts
type LspPosition = toolbox.SymbolPosition
```

A zero-based LSP position.

***

## LspRange

```ts
type LspRange = toolbox.SymbolRange
```

***

## LspSymbol

```ts
type LspSymbol = toolbox.SymbolInfo
```

One symbol from `documentSymbols()` / `workspaceSymbols()`.
