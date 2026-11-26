# Interpreter (Python SDK reference)

## Contents

- [InterpreterService](#interpreterservice)
- [AsyncInterpreterService](#asyncinterpreterservice)
- [InterpreterContext](#interpretercontext)
- [AsyncInterpreterContext](#asyncinterpretercontext)
- [InterpreterContextJSON](#interpretercontextjson)
- [InterpreterProcess](#interpreterprocess)
- [InterpreterLogs](#interpreterlogs)
- [InterpreterError](#interpretererror)
- [InterpreterOutput](#interpreteroutput)
- [InterpreterResult](#interpreterresult)

## InterpreterService

```python
class InterpreterService()
```

Sandbox interpreter namespace: run code in language kernels.

#### InterpreterService.\_\_init\_\_

```python
def __init__() -> None
```

#### InterpreterService.connect\_context

```python
def connect_context(context: str | InterpreterContext | InterpreterContextJSON,
                    /,
                    *,
                    language: str | None = None) -> InterpreterContext
```

Reconnect a context by id (with `language`), handle or `to_json()`, without a request.

#### InterpreterService.create\_context

```python
def create_context(*,
                   language: str,
                   context_id: Optional[str] = None,
                   cwd: Optional[str] = None,
                   env: Optional[Mapping[str, str]] = None) -> InterpreterContext
```

Create an interpreter context: kernel state of its own.

`language` is `"python"`, `"typescript"` or `"javascript"`
(case-sensitive); any other value raises
`daytona.v2.errors.UnsupportedOperationError` (400) before a
kernel is provisioned, while
`daytona.v2.errors.KernelUnavailableError` (503) means a
supported language's kernel failed to install or start. `cwd` and
`env` apply to every run in the context.

#### InterpreterService.delete\_context

```python
def delete_context(context: InterpreterContext | InterpreterContextJSON | str,
                   /) -> None
```

#### InterpreterService.list\_contexts

```python
def list_contexts() -> list[InterpreterContext]
```

#### InterpreterService.run

```python
def run(code: str,
        /,
        *,
        language: Optional[str] = None,
        context: str | InterpreterContext | InterpreterContextJSON | None = None,
        isolated: bool = False,
        timeout: Optional[float] = None,
        cwd: Optional[str] = None,
        env: Optional[Mapping[str, str]] = None) -> InterpreterResult
```

Execute code and return the parsed interpreter result.

Without `context` (or `isolated`) runs share kernel state per
`language` (default `"python"`). `context` selects an interpreter
context by handle, `to_json()` identity or id; an id needs
`language`. `isolated=True` runs in a throwaway context. `env`
applies to context-free and isolated runs; a context takes its
environment when it is created. For a context-free or isolated run, an
unsupported `language` raises
`daytona.v2.errors.UnsupportedOperationError`, as in
`create_context`. With a context handle or `to_json()`
identity, a `language` that differs from the context's language
raises `daytona.v2.errors.BadRequestError` before any request;
a bare context id takes `language` as the context's language.

A rehydrated `kind='code'` process handle can still replay logs and
wait/kill, but it does not reconstruct this decomposed result on
another worker. A vanished explicit context surfaces the API's typed
`SESSION_NOT_FOUND` error; callers decide whether to recreate the
context and what to rerun. `timeout` is the caller wait budget in
seconds; `0` waits unbounded.

## AsyncInterpreterService

```python
class AsyncInterpreterService()
```

Sandbox interpreter namespace: run code in language kernels.

#### AsyncInterpreterService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncInterpreterService.create\_context

```python
async def create_context(*,
                         language: str,
                         context_id: Optional[str] = None,
                         cwd: Optional[str] = None,
                         env: Optional[Mapping[str, str]] = None) -> AsyncInterpreterContext
```

Create an interpreter context: kernel state of its own.

`language` is `"python"`, `"typescript"` or `"javascript"`
(case-sensitive); any other value raises
`daytona.v2.errors.UnsupportedOperationError` (400) before a
kernel is provisioned, while
`daytona.v2.errors.KernelUnavailableError` (503) means a
supported language's kernel failed to install or start. `cwd` and
`env` apply to every run in the context.

#### AsyncInterpreterService.connect\_context

```python
def connect_context(context: str | AsyncInterpreterContext | InterpreterContextJSON,
                    /,
                    *,
                    language: str | None = None) -> AsyncInterpreterContext
```

Reconnect a context by id (with `language`), handle or `to_json()`, without a request.

#### AsyncInterpreterService.list\_contexts

```python
async def list_contexts() -> list[AsyncInterpreterContext]
```

#### AsyncInterpreterService.delete\_context

```python
async def delete_context(context: AsyncInterpreterContext | InterpreterContextJSON | str,
                         /) -> None
```

#### AsyncInterpreterService.run

```python
async def run(code: str,
              /,
              *,
              language: Optional[str] = None,
              context: str | AsyncInterpreterContext | InterpreterContextJSON | None = None,
              isolated: bool = False,
              timeout: Optional[float] = None,
              cwd: Optional[str] = None,
              env: Optional[Mapping[str, str]] = None) -> InterpreterResult
```

Execute code and return the parsed interpreter result.

Without `context` (or `isolated`) runs share kernel state per
`language` (default `"python"`). `context` selects an interpreter
context by handle, `to_json()` identity or id; an id needs
`language`. `isolated=True` runs in a throwaway context. `env`
applies to context-free and isolated runs; a context takes its
environment when it is created. For a context-free or isolated run, an
unsupported `language` raises
`daytona.v2.errors.UnsupportedOperationError`, as in
`create_context`. With a context handle or `to_json()`
identity, a `language` that differs from the context's language
raises `daytona.v2.errors.BadRequestError` before any request;
a bare context id takes `language` as the context's language.

A rehydrated `kind='code'` process handle can still replay logs and
wait/kill, but it does not reconstruct this decomposed result on
another worker. A vanished explicit context surfaces the API's typed
`SESSION_NOT_FOUND` error; callers decide whether to recreate the
context and what to rerun. `timeout` is the caller wait budget in
seconds; `0` waits unbounded.

## InterpreterContext

```python
class InterpreterContext()
```

An interpreter context: kernel state of its own in one sandbox.

Built by the interpreter service (`create_context()`,
`connect_context()`, `list_contexts()`), never directly. Serialize it
with `to_json` and reconnect with `interpreter.connect_context()`.

#### InterpreterContext.\_\_init\_\_

```python
def __init__() -> None
```

#### InterpreterContext.sandbox\_id

```python
@property
def sandbox_id() -> str
```

#### InterpreterContext.context\_id

```python
@property
def context_id() -> str
```

#### InterpreterContext.language

```python
@property
def language() -> str
```

#### InterpreterContext.close

```python
def close() -> None
```

Delete this context and its kernel state.

#### InterpreterContext.run

```python
def run(code: str,
        /,
        *,
        cwd: Optional[str] = None,
        timeout: Optional[float] = None) -> InterpreterResult
```

Execute code inside this interpreter context.

Environment variables are set when the context is created. If the
context vanished, the API's typed `SESSION_NOT_FOUND` error surfaces
unchanged so the caller can recreate the context and decide what code,
if any, is safe to rerun. `timeout` is the caller wait budget in
seconds; `0` waits unbounded.

#### InterpreterContext.to\_json

```python
def to_json() -> InterpreterContextJSON
```

Return the context's JSON-safe identity for `interpreter.connect_context()`.

## AsyncInterpreterContext

```python
class AsyncInterpreterContext()
```

An interpreter context: kernel state of its own in one sandbox.

Built by the interpreter service (`create_context()`,
`connect_context()`, `list_contexts()`), never directly. Serialize it
with `to_json` and reconnect with `interpreter.connect_context()`.

#### AsyncInterpreterContext.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncInterpreterContext.to\_json

```python
def to_json() -> InterpreterContextJSON
```

Return the context's JSON-safe identity for `interpreter.connect_context()`.

#### AsyncInterpreterContext.run

```python
async def run(code: str,
              /,
              *,
              cwd: Optional[str] = None,
              timeout: Optional[float] = None) -> InterpreterResult
```

Execute code inside this interpreter context.

Environment variables are set when the context is created. If the
context vanished, the API's typed `SESSION_NOT_FOUND` error surfaces
unchanged so the caller can recreate the context and decide what code,
if any, is safe to rerun. `timeout` is the caller wait budget in
seconds; `0` waits unbounded.

#### AsyncInterpreterContext.close

```python
async def close() -> None
```

Delete this context and its kernel state.

## InterpreterContextJSON

```python
class InterpreterContextJSON(TypedDict)
```

An interpreter context's serialized identity (`context.to_json()`).

The same camelCase shape the TypeScript SDK produces and reads.

**Attributes**:

- `sandboxId` _str_
- `contextId` _str_
- `language` _str_

## InterpreterProcess

```python
@dataclass(frozen=True, kw_only=True)
class InterpreterProcess(WaitResult)
```

**Attributes**:

- `process_id` _Optional\[str\] = None_ - The code execution's process; `None` when the run timed out while
  queued behind earlier runs of its context and was never submitted.

## InterpreterLogs

```python
@dataclass(frozen=True, kw_only=True)
class InterpreterLogs()
```

**Attributes**:

- `stdout` _str = ''_
- `stderr` _str = ''_

## InterpreterError

```python
@dataclass(frozen=True, kw_only=True)
class InterpreterError()
```

**Attributes**:

- `name` _str_
- `value` _str_
- `traceback` _tuple\[str, ...\] = ()_

## InterpreterOutput

```python
@dataclass(frozen=True, kw_only=True)
class InterpreterOutput()
```

**Attributes**:

- `data` _JsonObject_
- `is_main_result` _bool_
- `text` _Optional\[str\] = None_
- `html` _Optional\[str\] = None_
- `png` _Optional\[str\] = None_
- `svg` _Optional\[str\] = None_
- `json` _Optional\[JsonValue\] = None_

## InterpreterResult

```python
@dataclass(frozen=True, kw_only=True)
class InterpreterResult()
```

Interpreter run result.

**Attributes**:

- `process` _InterpreterProcess_
- `results` _tuple\[InterpreterOutput, ...\] = ()_
- `logs` _InterpreterLogs = field(default_factory=InterpreterLogs)_
- `error` _Optional\[InterpreterError\] = None_
