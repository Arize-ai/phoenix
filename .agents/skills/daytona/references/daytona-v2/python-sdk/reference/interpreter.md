# Interpreter (Python SDK reference)

## Contents

- [InterpreterService](#interpreterservice)
- [AsyncInterpreterService](#asyncinterpreterservice)
- [InterpreterContext](#interpretercontext)
- [AsyncInterpreterContext](#asyncinterpretercontext)
- [InterpreterContextJSON](#interpretercontextjson)
- [InterpreterDisplay](#interpreterdisplay)
- [InterpreterProcess](#interpreterprocess)
- [InterpreterLogs](#interpreterlogs)
- [InterpreterError](#interpretererror)
- [InterpreterOutput](#interpreteroutput)
- [InterpreterResult](#interpreterresult)

## InterpreterService

```python
class InterpreterService()
```

Synchronous InterpreterService.

#### InterpreterService.\_\_init\_\_

```python
def __init__(impl: AsyncInterpreterService, bridge: SyncBridge) -> None
```

#### InterpreterService.connect\_context

```python
def connect_context(context: str | InterpreterContext | InterpreterContextJSON,
                    *,
                    language: str | None = None) -> InterpreterContext
```

#### InterpreterService.create\_context

```python
def create_context(*,
                   language: str,
                   context_id: Optional[str] = None,
                   cwd: Optional[str] = None,
                   env: Optional[Mapping[str, str]] = None,
                   request_timeout: Optional[float] = None) -> InterpreterContext
```

#### InterpreterService.delete\_context

```python
def delete_context(context: InterpreterContext | InterpreterContextJSON | str) -> None
```

#### InterpreterService.get\_context

```python
def get_context(context: str | InterpreterContext | InterpreterContextJSON,
                *,
                language: str | None = None) -> InterpreterContext
```

#### InterpreterService.list\_contexts

```python
def list_contexts() -> list[InterpreterContext]
```

#### InterpreterService.run

```python
def run(code: str,
        *,
        language: str = 'python',
        context: Optional[InterpreterContext] = None,
        isolated: bool = False,
        timeout: Optional[float] = None,
        cwd: Optional[str] = None,
        env: Optional[Mapping[str, str]] = None) -> InterpreterResult
```

Execute code and return the parsed interpreter result.

## AsyncInterpreterService

```python
class AsyncInterpreterService()
```

#### AsyncInterpreterService.\_\_init\_\_

```python
def __init__(sandbox_id: str,
             transport: AsyncTransport,
             process: AsyncProcessService) -> None
```

#### AsyncInterpreterService.create\_context

```python
async def create_context(*,
                         language: str,
                         context_id: Optional[str] = None,
                         cwd: Optional[str] = None,
                         env: Optional[Mapping[str, str]] = None,
                         request_timeout: Optional[float] = None) -> AsyncInterpreterContext
```

#### AsyncInterpreterService.connect\_context

```python
def connect_context(context: str | AsyncInterpreterContext | InterpreterContextJSON,
                    *,
                    language: str | None = None) -> AsyncInterpreterContext
```

#### AsyncInterpreterService.get\_context

```python
def get_context(context: str | AsyncInterpreterContext | InterpreterContextJSON,
                *,
                language: str | None = None) -> AsyncInterpreterContext
```

#### AsyncInterpreterService.list\_contexts

```python
async def list_contexts() -> list[AsyncInterpreterContext]
```

#### AsyncInterpreterService.delete\_context

```python
async def delete_context(context: AsyncInterpreterContext | InterpreterContextJSON | str) -> None
```

#### AsyncInterpreterService.run

```python
async def run(code: str,
              *,
              language: str = 'python',
              context: Optional[AsyncInterpreterContext] = None,
              isolated: bool = False,
              timeout: Optional[float] = None,
              cwd: Optional[str] = None,
              env: Optional[Mapping[str, str]] = None) -> InterpreterResult
```

Execute code and return the parsed interpreter result.

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

Serializable interpreter context handle.

#### InterpreterContext.\_\_init\_\_

```python
def __init__(impl: AsyncInterpreterContext, bridge: SyncBridge) -> None
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

#### InterpreterContext.run

```python
def run(code: str,
        *,
        cwd: Optional[str] = None,
        env: Optional[Mapping[str, str]] = None,
        timeout: Optional[float] = None) -> InterpreterResult
```

Execute code inside this explicit interpreter context.

## AsyncInterpreterContext

```python
@dataclass(frozen=True)
class AsyncInterpreterContext()
```

Serializable interpreter context handle.

**Attributes**:

- `sandbox_id` _str_
- `context_id` _str_
- `language` _str_

#### AsyncInterpreterContext.bind

```python
def bind(runner: Callable[[str, Optional[str], Optional[Mapping[str, str]], Optional[float]], Awaitable[InterpreterResult]],
         closer: Callable[[], Awaitable[None]]) -> Self
```

#### AsyncInterpreterContext.run

```python
async def run(code: str,
              *,
              cwd: Optional[str] = None,
              env: Optional[Mapping[str, str]] = None,
              timeout: Optional[float] = None) -> InterpreterResult
```

Execute code inside this explicit interpreter context.

If the named context vanished, the API's typed
`SESSION_NOT_FOUND` error surfaces unchanged so the caller can
recreate the context and decide what code, if any, is safe to rerun.
`timeout` is the caller wait budget in seconds; `0` waits
unbounded.

#### AsyncInterpreterContext.close

```python
async def close() -> None
```

## InterpreterContextJSON

```python
class InterpreterContextJSON(TypedDict)
```

**Attributes**:

- `sandbox_id` _str_
- `context_id` _str_
- `language` _str_

## InterpreterDisplay

```python
@dataclass(frozen=True)
class InterpreterDisplay()
```

One rich interpreter output bundle.

**Attributes**:

- `mime` _str_
- `data` _str_

## InterpreterProcess

```python
@dataclass(frozen=True)
class InterpreterProcess()
```

**Attributes**:

- `process_id` _str_
- `exit_code` _Optional\[int\]_
- `signal` _Optional\[str\]_
- `reason` _Optional\[WaitReason\]_
- `raw_reason` _Optional\[str\] = None_

## InterpreterLogs

```python
@dataclass(frozen=True)
class InterpreterLogs()
```

**Attributes**:

- `stdout` _str = ''_
- `stderr` _str = ''_

## InterpreterError

```python
@dataclass(frozen=True)
class InterpreterError()
```

**Attributes**:

- `name` _str_
- `value` _str_
- `traceback` _List\[str\] = field(default_factory=list)_

## InterpreterOutput

```python
@dataclass(frozen=True)
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
@dataclass(frozen=True)
class InterpreterResult()
```

Interpreter run result.

**Attributes**:

- `process` _InterpreterProcess_
- `results` _List\[InterpreterOutput\] = field(default_factory=list)_
- `logs` _InterpreterLogs = field(default_factory=InterpreterLogs)_
- `error` _Optional\[InterpreterError\] = None_
