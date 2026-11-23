# Code Execution (TypeScript SDK)

Run Python, TypeScript, and JavaScript code in your sandboxes through language kernels.

Code execution is the running of untrusted or AI-generated code in an isolated sandbox, with its output, errors, and result returned to the application that sent it. The code runs outside the application, so a failure or a malicious instruction cannot read or change the memory or the files of the application or of the computer that runs it.

Daytona runs code in a sandbox through a language kernel. The kernel runs as a process inside the sandbox, so code it runs stays isolated from your application.

Use code execution to run code written by an agent and feed its output and errors back into the next attempt, or to analyze data step by step. Code can run in Python, TypeScript, or JavaScript. To run shell commands and manage long-running processes, see [process execution](./process-execution.md), and to follow the output of a run as it happens, see [log streaming](./log-streaming.md). Outbound network access is open by default, so set [network limits](./network-limits.md) before you run untrusted code.

## Contents

- [Use cases](#use-cases)
- [Run code](#run-code)
- [Run code in an isolated kernel](#run-code-in-an-isolated-kernel)
- [Interpreter contexts](#interpreter-contexts)
- [Permissions](#permissions)

## Use cases

Code execution is used when an application runs Python, TypeScript, or JavaScript code that it did not write or does not trust, as in the following cases:

- **AI-generated code.** An agent writes code, runs it in the sandbox, and reads the output and errors to correct its next attempt. The code runs isolated from your application. Each result also holds the exit status of the process.

- **Data analysis.** The kernel keeps data, imports, and functions in memory between runs, so each step builds on the previous one, as in a notebook. Runs without a context share one kernel per language, so later runs in that language see the same data. The first run in a language installs the kernel, so that run can take longer than later ones.

- **Charts and tables.** Runs that plot or display data return charts and tables as artifacts with the result. Each artifact is keyed by MIME type, so an application renders it in the right format. A flag on each result tells the value of the last expression apart from displayed outputs.

- **Code interpreters for users.** Each user or conversation gets its own interpreter context, so state from one does not reach another. A context has its own kernel, working directory, and environment. Its kernel uses memory even while idle, until the application deletes the context.

- **One-off runs.** An isolated kernel runs code with no state from earlier runs. The session is deleted after the run, so nothing the code defines reaches other runs. An isolated run cannot be combined with an interpreter context.

## Run code

Run code to execute a piece of source code and get its result. A run sends code to an interpreter, which executes it and returns what the code printed, displayed, or raised.

A run in a sandbox without a context goes to a shared kernel, one per language, so state from one run is available to later runs in that language.

Run code to execute code from an agent or user and read its output and errors. To keep state apart, run it in an [interpreter context](#interpreter-contexts) or an [isolated kernel](#run-code-in-an-isolated-kernel). The result contains the standard output and standard error, rich outputs, the exception if the code raised one, and the exit status of the process. An exception that the code raises is not a request error, so the result holds it.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

const response = await sandbox.runCode(`
def greet(name):
    return f"Hello, {name}!"

print(greet("Daytona"))
`)
console.log(response.logs.stdout)
```

| **Parameter** | **Description** |
| --- | --- |
| `code` | Sets the code to run.<br />**Required**<br />**Example:** `'print(1)'` |
| `context` | Runs the code in an [interpreter context](#interpreter-contexts).<br />**Format:** a context handle, a saved toJSON() object, or a context ID<br />**Example:** `ctx` |
| `cwd` | Sets the working directory of the shared kernel when this run starts it.<br />**Default:** the default working directory of the sandbox<br />**Example:** `'/tmp'` |
| `env` | Sets environment variables of the shared kernel when this run starts it.<br />**Format:** variable names mapped to string values<br />**Example:** `{ STAGE: 'dev' }` |
| `isolated` | Runs the code in a [temporary kernel](#run-code-in-an-isolated-kernel).<br />**Default:** `false` |
| `language` | Sets the language of the code.<br />**Default:** `'python'`<br />**Value:** `python`, `typescript`, or `javascript`<br />**Example:** `'typescript'` |
| `timeoutSeconds` | Sets how many seconds the call waits for the run.<br />**Default:** no limit<br />**Value:** `0` for no limit<br />**Example:** `30` |

> **Notes:**
>
> - **Timeouts:** The first run in a language installs and starts the kernel, so its timeout must also cover that start.
> - **Behaviour:** A run on the shared kernel keeps the cwd and env of the run that started the kernel.

### Artifacts

Artifacts are the rich outputs of a run, such as charts and tables. Each artifact holds the same output in one or more MIME types, so a client can pick the format it renders.

The artifacts of a run in a sandbox come back with the result of that run, keyed by MIME type.

Use artifacts to show the charts and tables of a run. Install the packages the code imports first. A flag on each result tells the value of the last expression apart from displayed outputs.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()
await sandbox.process.run('pip install matplotlib numpy')

const response = await sandbox.runCode(`
import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 10, 30)
plt.plot(x, np.sin(x))
plt.title("Sine wave")
plt.show()
`)

if (response.error) {
    console.log(response.error.name, response.error.value)
}
for (const result of response.results) {
    console.log(Object.keys(result.data)) // MIME types, for example ['image/png', 'text/plain']
}
```

## Run code in an isolated kernel

Run code in an isolated kernel to execute it with no state from earlier runs. An isolated kernel is a temporary interpreter that starts with no state and ends with its run.

An isolated run in a sandbox does not see state from the shared kernel or from interpreter contexts, and nothing the code defines is visible to other runs.

Run code in an isolated kernel for one-off runs that must not depend on or affect other runs. Daytona creates a session with a new kernel, runs the code, and deletes the session after the run. Each isolated run starts a new kernel, so its timeout must also cover the kernel start. An isolated run cannot be combined with an interpreter context.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

await sandbox.runCode('value = 42')

// The isolated kernel does not see variables from the shared kernel
const response = await sandbox.runCode('print(value)', { isolated: true })
console.log(response.error?.name) // NameError
```

| **Parameter** | **Description** |
| --- | --- |
| `cwd` | Sets the working directory of the temporary kernel.<br />**Default:** the default working directory of the sandbox<br />**Example:** `'/tmp'` |
| `env` | Sets environment variables of the temporary kernel.<br />**Format:** variable names mapped to string values<br />**Example:** `{ STAGE: 'dev' }` |
| `isolated` | Runs the code in a temporary kernel.<br />**Default:** `false` |

> **Notes:**
>
> - **Compatibility:** An isolated run does not take a context.
> - **Timeouts:** Each isolated run starts a new kernel, so its timeout must also cover the kernel start.

## Interpreter contexts

An interpreter context is an interpreter with its own state, separate from other interpreters in the same sandbox. Code in one context sees only what earlier runs in that context defined.

An interpreter context in a sandbox is a session with its own language kernel, working directory, and environment. Its state persists across runs and is not shared with the shared kernel or with other contexts. A context lives until it is deleted, so its kernel uses memory even while idle.

Create a context for each user or conversation that needs its own interpreter state, and [delete the context](#delete-a-context) when it is no longer needed. In the Toolbox API, a context is a [session](../api/toolbox-sessions.md) that runs a language kernel. Shell sessions are not created through this endpoint. For them, see [sessions](./process-execution.md#session-operations).

### Create a context

Create a context to give code its own interpreter state. A new context starts its own kernel.

The environment variables of a context in a sandbox are set when the context is created, and runs in the context do not change them. Its kernel keeps running until the context is deleted.

Create a context, then run code in it. Give the context a known ID to [reconnect to it](#reconnect-to-a-context) from another worker.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

const ctx = await sandbox.interpreter.createContext({ language: 'python', env: { STAGE: 'dev' } })
try {
    await ctx.run(`value = 'stored in ctx'`)
    const result = await sandbox.runCode(`print(value)`, { context: ctx })
    console.log(result.logs.stdout)
} finally {
    await ctx.close()
}
```

| **Parameter** | **Description** |
| --- | --- |
| `language` | Sets the language of the context.<br />**Required**<br />**Value:** `python`, `typescript`, or `javascript`<br />**Example:** `'python'` |
| `contextId` | Sets the ID of the context.<br />**Default:** a generated ID<br />**Format:** 1 to 128 ASCII letters, digits, periods, underscores, and hyphens, other than a single or double period<br />**Example:** `'my-context'` |
| `cwd` | Sets the working directory of the kernel.<br />**Default:** the default working directory of the sandbox<br />**Example:** `'/tmp'` |
| `env` | Sets environment variables of the kernel.<br />**Format:** variable names mapped to string values<br />**Example:** `{ STAGE: 'dev' }` |

> **Notes:**
>
> - **Compatibility:** Runs in a context do not take env.
> - **Lifetime:** The kernel of a context keeps running until the context is deleted.

### List contexts

List contexts to see which interpreter states a sandbox holds. Each entry of a listing names one interpreter, with the ID and the language that identify it.

A listing of a sandbox covers its interpreter contexts and the shared kernel of each language that has run code. Shell sessions are not part of the listing.

List contexts to find the contexts to reconnect to or to delete. The shared kernels have the ID code-python, code-typescript, or code-javascript, by language.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

await sandbox.interpreter.createContext({ language: 'python', contextId: 'my-context' })

for (const ctx of await sandbox.interpreter.listContexts()) {
  console.log(`Context: ${ctx.contextId}, Language: ${ctx.language}`)
}
```

### Reconnect to a context

Reconnect to a context to run code in it from another worker or process. A context is addressed by its ID, so its state does not depend on the client that created it.

A context in a sandbox belongs to the sandbox, not to a client. Any client that has both the sandbox ID and the context ID can run code in the context.

Reconnect to a context when work moves between workers or processes. Create the context with a known ID, or save the context and reconnect from the saved form, which carries the language. A reconnect from a context ID needs the language of the context. A reconnect sends no request, so it does not check that the context exists.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

// Worker A: create a context with a known ID
const ctx = await sandbox.interpreter.createContext({ contextId: 'my-context', language: 'python' })
await ctx.run('x = 42')

// Worker B: reconnect to the context by ID
const context = sandbox.interpreter.connectContext('my-context', 'python')
const response = await context.run('print(x)')
console.log(response.logs.stdout) // 42

// Or persist the context in worker A and reconnect from the saved object, which carries the language
const saved = ctx.toJSON() // { sandboxId: '...', contextId: 'my-context', language: 'python' }
const restored = sandbox.interpreter.connectContext(saved)
```

| **Parameter** | **Description** |
| --- | --- |
| `context` | Selects the context to reconnect to.<br />**Required**<br />**Format:** a context handle, a saved toJSON() object, or a context ID<br />**Example:** `'my-context'` |
| `language` | Sets the language of the context.<br />**Rules:** required when context is a context ID<br />**Value:** `python`, `typescript`, or `javascript`<br />**Example:** `'python'` |

> **Notes:**
>
> - **Clients:** connectContext() sends no request, so it does not check that the context exists.

### Delete a context

Delete a context to end its interpreter state. Its state is lost, and its kernel stops.

A context in a sandbox keeps its kernel and memory until it is deleted. The delete shuts the kernel down and frees the memory that the kernel used.

Delete a context when its user or conversation ends, so its idle kernel stops using memory. The state of a deleted context is lost. To start again, create the context again.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

const ctx = await sandbox.interpreter.createContext({ language: 'python' })
try {
    await ctx.run('data = list(range(10_000_000))')
} finally {
    await sandbox.interpreter.deleteContext(ctx)
}
```

| **Parameter** | **Description** |
| --- | --- |
| `context` | Selects the context to delete.<br />**Required**<br />**Format:** a context handle, a saved toJSON() object, or a context ID<br />**Example:** `ctx` |

## Permissions

Code execution runs through the toolbox of a sandbox. Access is governed by one project permission, which you can grant to an [organization role](./organizations.md#roles) or an [API key](./api-keys.md).

A [sandbox access token](./sandboxes.md#create-an-access-token) with the toolbox:exec operation grants the same access to a single sandbox, without an API key. The sandbox read permission alone does not grant toolbox access.

| **Permission**        | **Grants**                               |
| --------------------- | ---------------------------------------- |
| **`write:sandboxes`** | Run code and manage interpreter contexts |
