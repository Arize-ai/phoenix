# Lsp (Python SDK reference)

## Contents

- [LspServer](#lspserver)
- [AsyncLspServer](#asynclspserver)
- [LspService](#lspservice)
- [AsyncLspService](#asynclspservice)
- [LspPosition: `TypeAlias`](#lspposition-typealias)
- [LspRange: `TypeAlias`](#lsprange-typealias)
- [LspLocation: `TypeAlias`](#lsplocation-typealias)
- [LspSymbol: `TypeAlias`](#lspsymbol-typealias)
- [LspCompletionItem: `TypeAlias`](#lspcompletionitem-typealias)
- [LspCompletionList: `TypeAlias`](#lspcompletionlist-typealias)

## LspServer

```python
class LspServer()
```

Synchronous LspServer.

#### LspServer.\_\_init\_\_

```python
def __init__(impl: AsyncLspServer, bridge: SyncBridge) -> None
```

#### LspServer.close\_document

```python
def close_document(uri: str) -> None
```

Notify the server that the document at `uri` was closed.

#### LspServer.completions

```python
def completions(uri: str,
                position: LspPosition | Mapping[str, int],
                *,
                context: JsonValue | None = None) -> LspCompletionList
```

#### LspServer.document\_symbols

```python
def document_symbols(uri: str) -> list[LspSymbol]
```

#### LspServer.open\_document

```python
def open_document(uri: str) -> None
```

Notify the server that the document at `uri` was opened.

#### LspServer.stop

```python
def stop() -> None
```

#### LspServer.workspace\_symbols

```python
def workspace_symbols(query: str) -> list[LspSymbol]
```

## AsyncLspServer

```python
class AsyncLspServer()
```

#### AsyncLspServer.\_\_init\_\_

```python
def __init__(transport: AsyncTransport, language_id: str, path_to_project: str) -> None
```

#### AsyncLspServer.open\_document

```python
async def open_document(uri: str) -> None
```

Notify the server that the document at `uri` was opened.

#### AsyncLspServer.close\_document

```python
async def close_document(uri: str) -> None
```

Notify the server that the document at `uri` was closed.

#### AsyncLspServer.completions

```python
async def completions(uri: str,
                      position: LspPosition | Mapping[str, int],
                      *,
                      context: JsonValue | None = None) -> LspCompletionList
```

#### AsyncLspServer.document\_symbols

```python
async def document_symbols(uri: str) -> list[LspSymbol]
```

#### AsyncLspServer.workspace\_symbols

```python
async def workspace_symbols(query: str) -> list[LspSymbol]
```

#### AsyncLspServer.stop

```python
async def stop() -> None
```

## LspService

```python
class LspService()
```

Synchronous LspService.

#### LspService.\_\_init\_\_

```python
def __init__(impl: AsyncLspService, bridge: SyncBridge) -> None
```

#### LspService.start

```python
def start(language_id: str, path_to_project: str) -> LspServer
```

## AsyncLspService

```python
class AsyncLspService()
```

#### AsyncLspService.\_\_init\_\_

```python
def __init__(transport: AsyncTransport) -> None
```

#### AsyncLspService.start

```python
async def start(language_id: str, path_to_project: str) -> AsyncLspServer
```

## LspPosition: `TypeAlias`

```python
LspPosition = SymbolPosition
```

## LspRange: `TypeAlias`

```python
LspRange = SymbolRange
```

## LspLocation: `TypeAlias`

```python
LspLocation = SymbolLocation
```

## LspSymbol: `TypeAlias`

```python
LspSymbol = SymbolInfo
```

## LspCompletionItem: `TypeAlias`

```python
LspCompletionItem = CompletionItem
```

## LspCompletionList: `TypeAlias`

```python
LspCompletionList = CompletionList
```
