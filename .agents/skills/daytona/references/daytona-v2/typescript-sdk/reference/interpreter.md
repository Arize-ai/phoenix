# Interpreter (TypeScript SDK reference)

## Contents

- [InterpreterContext](#interpretercontext)
- [InterpreterService](#interpreterservice)
- [InterpreterError](#interpretererror)
- [InterpreterLogs](#interpreterlogs)
- [InterpreterOutput](#interpreteroutput)
- [InterpreterProcess](#interpreterprocess)
- [InterpreterRunOptions](#interpreterrunoptions)
- [InterpreterContextRunOptions](#interpretercontextrunoptions)
- [InterpreterContextJSON](#interpretercontextjson)
- [InterpreterContextOptions](#interpretercontextoptions)
- [InterpreterContextReference](#interpretercontextreference)
- [InterpreterResult](#interpreterresult)

## InterpreterContext

An interpreter context: kernel state of its own in one sandbox. Built by
the interpreter service (`createContext()`, `connectContext()`,
`listContexts()`), never directly. Serialize it with `toJSON()` and
reconnect with `interpreter.connectContext()`.

**Properties**:

- `contextId` _string_
- `language` _string_
- `sandboxId` _string_
- `#transport` _HttpTransport_
- `#executionQueue` _ContextExecutionQueue_
- `#onClose` _() =\> Promise\<void\>_

### Constructors

#### Constructor

```ts
new InterpreterContext(token: Internal, ...init: never[]): InterpreterContext;
```

Built by the SDK: get it from `sandbox.interpreter.createContext()` or `connectContext()`.

**Parameters**:

- `token` _Internal_
- `...init: never[]`

**Returns**:

- `InterpreterContext`

### Methods

#### #runMs()

```ts
#runMs(
   code: string,
   cwd: string | undefined,
   timeoutMs: number | undefined): Promise<InterpreterResult>;
```

Run with a caller budget in milliseconds (`0` = unbounded).

**Parameters**:

- `code` _string_
- `cwd` _string \| undefined_
- `timeoutMs` _number \| undefined_

**Returns**:

- `Promise<InterpreterResult>`

#### close()

```ts
close(): Promise<void>;
```

Delete this context and its kernel state.

**Returns**:

- `Promise<void>`

#### run()

```ts
run(
   code: string,
   options: InterpreterContextRunOptions = {}): Promise<InterpreterResult>;
```

Execute code inside this interpreter context. Environment variables are
set when the context is created. If the context vanished, the typed
SESSION_NOT_FOUND error surfaces unchanged so the caller can recreate the
context and decide what code, if any, is safe to rerun.

**Parameters**:

- `code` _string_
- `options` _InterpreterContextRunOptions = \{\}_

**Returns**:

- `Promise<InterpreterResult>`

#### toJSON()

```ts
toJSON(): InterpreterContextJSON;
```

The context's JSON-safe identity, for `interpreter.connectContext()`.

**Returns**:

- `InterpreterContextJSON`

***

## InterpreterService

Sandbox interpreter namespace (`sandbox.interpreter`): run code in language kernels.

### Constructors

#### Constructor

```ts
new InterpreterService(token: Internal, ...init: never[]): InterpreterService;
```

Built by the SDK: get it from `sandbox.interpreter`.

**Parameters**:

- `token` _Internal_
- `...init: never[]`

**Returns**:

- `InterpreterService`

### Methods

#### connectContext()

```ts
connectContext(
   context: string | InterpreterContextReference | InterpreterContextJSON,
   language?: string): InterpreterContext;
```

Reconnect a context by id (with `language`), handle or `toJSON()` identity, without a request.

**Parameters**:

- `context` _string \| InterpreterContextReference \| InterpreterContextJSON_
- `language?` _string_

**Returns**:

- `InterpreterContext`

#### createContext()

```ts
createContext(options: InterpreterContextOptions): Promise<InterpreterContext>;
```

Create an interpreter context: kernel state of its own. `cwd` and `env` apply to every run in it.

**Parameters**:

- `options` _InterpreterContextOptions_

**Returns**:

- `Promise<InterpreterContext>`

#### deleteContext()

```ts
deleteContext(
   context: string | InterpreterContextReference | InterpreterContextJSON): Promise<void>;
```

**Parameters**:

- `context` _string \| InterpreterContextReference \| InterpreterContextJSON_

**Returns**:

- `Promise<void>`

#### listContexts()

```ts
listContexts(): Promise<InterpreterContext[]>;
```

**Returns**:

- `Promise<InterpreterContext[]>`

#### run()

```ts
run(code: string, options: InterpreterRunOptions = {}): Promise<InterpreterResult>;
```

Execute code and return the parsed interpreter result. Without `context`
(or `isolated`) runs share kernel state per `language` (default
`'python'`); `context` selects an interpreter context by handle,
`toJSON()` identity or id (an id needs `language`); `isolated: true`
runs in a throwaway context.
Rehydrated `kind:'code'` process handles can replay logs and wait/kill,
but they do not recreate this decomposed result on another worker.
A vanished explicit context surfaces the typed SESSION_NOT_FOUND
error; callers decide whether to recreate the context and what to rerun.

**Parameters**:

- `code` _string_
- `options` _InterpreterRunOptions = \{\}_

**Returns**:

- `Promise<InterpreterResult>`

***

## InterpreterError

**Properties**:

- `name` _string_
- `value` _string_
- `traceback` _readonly string\[\]_

***

## InterpreterLogs

**Properties**:

- `stdout` _string_
- `stderr` _string_

***

## InterpreterOutput

**Properties**:

- `data` _Readonly\<Record\<string, unknown\>\>_
- `isMainResult` _boolean_
- `text?` _string_
- `html?` _string_
- `png?` _string_
- `svg?` _string_
- `json?` _unknown_

***

## InterpreterProcess

**Properties**:

- `reason` _ProcessReason_
- `exitCode?` _number_
- `signal?` _string_
- `rawReason?` _string_
- `processId?` _string_ - The code execution's process; absent when the run timed out while queued
  behind earlier runs of its context and was never submitted.

***

## InterpreterRunOptions

Options of `interpreter.run()` / `sandbox.runCode()`. Without `context` (or
`isolated`) runs share kernel state per `language` (default `'python'`).
`context` selects an interpreter context by handle, `toJSON()` identity or
id; an id needs `language`. `env` applies to context-free and isolated
runs; a context takes its environment when it is created.

**Properties**:

- `language?` _'python' \| 'typescript' \| 'javascript' \| (string & \{\})_ - `'python'`, `'typescript'` or `'javascript'` (case-sensitive). For a
  context-free or isolated run, any other value throws
  `UnsupportedOperationError` (400) before a kernel is provisioned, and
  `KernelUnavailableError` (503) means a supported language's kernel failed
  to install or start. With a context handle or `toJSON()` identity, a
  language that differs from the context's language throws
  `BadRequestError` before any request; a bare context id takes `language`
  as the context's language.
- `context?` _string \| InterpreterContextReference \| InterpreterContextJSON_
- `isolated?` _boolean_
- `cwd?` _string_
- `env?` _Readonly\<Record\<string, string\>\>_
- `timeoutSeconds?` _number_ - Caller wait budget in seconds; omitted or `0` waits unbounded.

***

## InterpreterContextRunOptions

Options of `context.run()`: the context fixes the language and environment.

**Properties**:

- `cwd?` _string_
- `timeoutSeconds?` _number_ - Caller wait budget in seconds; omitted or `0` waits unbounded.

***

## InterpreterContextJSON

An interpreter context's serialized identity (`context.toJSON()`), the same shape the Python SDK writes.

**Properties**:

- `sandboxId` _string_
- `contextId` _string_
- `language` _string_

***

## InterpreterContextOptions

**Properties**:

- `language` _'python' \| 'typescript' \| 'javascript' \| (string & \{\})_ - `'python'`, `'typescript'` or `'javascript'` (case-sensitive). Any other
  value throws `UnsupportedOperationError` (400) before a kernel is
  provisioned; `KernelUnavailableError` (503) means a supported language's
  kernel failed to install or start.
- `contextId?` _string_
- `cwd?` _string_
- `env?` _Readonly\<Record\<string, string\>\>_

***

## InterpreterContextReference

Anything that names an interpreter context (an `InterpreterContext` handle is one).

**Properties**:

- `sandboxId` _string_
- `contextId` _string_
- `language` _string_

***

## InterpreterResult

**Properties**:

- `process` _InterpreterProcess_
- `results` _readonly InterpreterOutput\[\]_
- `logs` _InterpreterLogs_
- `error?` _InterpreterError_
