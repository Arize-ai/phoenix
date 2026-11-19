# Interpreter (TypeScript SDK reference)

## Contents

- [InterpreterContext](#interpretercontext)
- [InterpreterService](#interpreterservice)
- [InterpreterError](#interpretererror)
- [InterpreterLogs](#interpreterlogs)
- [InterpreterOutput](#interpreteroutput)
- [InterpreterProcess](#interpreterprocess)
- [InterpreterRunOptions](#interpreterrunoptions)
- [InterpreterContextJSON](#interpretercontextjson)
- [InterpreterContextOptions](#interpretercontextoptions)
- [InterpreterContextReference](#interpretercontextreference)
- [InterpreterResult](#interpreterresult)

## InterpreterContext

**Properties**:

- `id` _string_
- `language` _string_
- `sandboxId` _string_
- `#transport` _HttpTransport_
- `#executionQueue` _ContextExecutionQueue_
- `#onClose` _() =\> Promise\<void\>_

### Constructors

#### Constructor

```ts
new InterpreterContext(
   transport: HttpTransport,
   sandboxId: string,
   id: string,
   language: string,
   executionQueue: ContextExecutionQueue,
   onClose: () => Promise<void>): InterpreterContext;
```

**Parameters**:

- `transport` _HttpTransport_
- `sandboxId` _string_
- `id` _string_
- `language` _string_
- `executionQueue` _ContextExecutionQueue_
- `onClose` _() = \> Promise\<void\>_

**Returns**:

- `InterpreterContext`

### Methods

#### close()

```ts
close(): Promise<void>;
```

**Returns**:

- `Promise<void>`

#### run()

```ts
run(
   code: string,
   options: Omit<InterpreterRunOptions, 'sessionId' | 'language' | 'isolated' | 'context'> = {}): Promise<InterpreterResult>;
```

Execute code inside this explicit interpreter context.
If the named context vanished, the typed SESSION_NOT_FOUND error
surfaces unchanged so the caller can recreate the context and decide what
code, if any, is safe to rerun.

**Parameters**:

- `code` _string_
- `options` _Omit\<InterpreterRunOptions, 'sessionId' \| 'language' \| 'isolated' \| 'context'\> = \{\}_

**Returns**:

- `Promise<InterpreterResult>`

#### toJSON()

```ts
toJSON(): InterpreterContextJSON;
```

**Returns**:

- `InterpreterContextJSON`

***

## InterpreterService

### Constructors

#### Constructor

```ts
new InterpreterService(
   transport: HttpTransport,
   process: ProcessService): InterpreterService;
```

**Parameters**:

- `transport` _HttpTransport_
- `process` _ProcessService_

**Returns**:

- `InterpreterService`

### Methods

#### connectContext()

```ts
connectContext(sessionId: string, language: string): InterpreterContext;
```

**Parameters**:

- `sessionId` _string_
- `language` _string_

**Returns**:

- `InterpreterContext`

#### connectContext()

```ts
connectContext(context: InterpreterContextJSON): InterpreterContext;
```

**Parameters**:

- `context` _InterpreterContextJSON_

**Returns**:

- `InterpreterContext`

#### createContext()

```ts
createContext(options: InterpreterContextOptions): Promise<InterpreterContext>;
```

**Parameters**:

- `options` _InterpreterContextOptions_

**Returns**:

- `Promise<InterpreterContext>`

#### deleteContext()

```ts
deleteContext(
   sessionIdOrContext: string | InterpreterContext | InterpreterContextJSON): Promise<void>;
```

**Parameters**:

- `sessionIdOrContext` _string \| InterpreterContext \| InterpreterContextJSON_

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

Execute code and return the parsed interpreter result.
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
- `traceback` _string\[\]_

***

## InterpreterLogs

**Properties**:

- `stdout` _string_
- `stderr` _string_

***

## InterpreterOutput

**Properties**:

- `data` _Record\<string, unknown\>_
- `isMainResult` _boolean_
- `text?` _string_
- `html?` _string_
- `png?` _string_
- `svg?` _string_
- `json?` _unknown_

***

## InterpreterProcess

```ts
type InterpreterProcess = WaitResult & {
  processId: string
}
```

***

## InterpreterRunOptions

**Properties**:

- `language?` _'python' \| 'typescript' \| 'javascript' \| string_
- `sessionId?` _string_
- `context?` _InterpreterContextReference \| InterpreterContextJSON_
- `isolated?` _boolean_
- `cwd?` _string_
- `env?` _Record\<string, string\>_
- `timeout?` _number_ - Caller wait budget in milliseconds; `0` waits unbounded.

***

## InterpreterContextJSON

**Properties**:

- `sandboxId` _string_
- `contextId` _string_
- `language` _string_

***

## InterpreterContextOptions

**Properties**:

- `id?` _string_
- `language` _'python' \| 'typescript' \| 'javascript' \| string_
- `cwd?` _string_
- `env?` _Record\<string, string\>_

***

## InterpreterContextReference

**Properties**:

- `sandboxId` _string_
- `id` _string_
- `language` _string_

***

## InterpreterResult

**Properties**:

- `process` _InterpreterProcess_
- `results` _InterpreterOutput\[\]_
- `logs` _InterpreterLogs_
- `error?` _InterpreterError_
