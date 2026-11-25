# Playground

Write and run TypeScript against the Daytona SDK in your browser.

A playground is a browser-based editor for code that creates and controls sandboxes, with no local setup. Sandbox code is tried in one place before it moves into an application.

Daytona provides a playground in the dashboard that runs TypeScript programs in your browser. Programs in it create and change real sandboxes with an API key that the playground provides, so there is nothing to install or configure on your computer.

Use the playground to try the SDK and check a sequence of sandbox operations before it goes into an application. The playground comes with the [TypeScript SDK](../typescript-sdk/README.md), a code editor, a console, and examples that run as they are or serve as a starting point for your own code.

## Use cases

The playground is used to run TypeScript SDK code without a local setup.

- **SDK trials.** SDK calls run in a web worker inside the browser. The playground provides the API key and endpoints, so there is nothing to install or configure. The Run button compiles the program in the editor and executes it in that web worker.

- **Learning the SDK.** The editor checks types and completes names from the SDK's type definitions. A new user sees the available methods and their parameters while writing the code. Programs are plain TypeScript that import the Daytona SDK, and top-level await is supported.

- **Commands and files.** A program runs a shell command in a sandbox, writes and reads files, and prints the results to the console. The Run a command and File operations examples show both tasks. File reads and writes go through the toolbox file system API.

- **Operation sequences.** A sequence of sandbox operations runs against the Daytona API and is checked before it goes into an application. A stopped run does not clean up the sandboxes it already created. Any sandbox created mid-run can still exist after the stop, and a delete removes it.

- **Starting points.** A curated example runs as it is, then changes, then moves into your own application. The examples cover the sandbox lifecycle, commands, files, images, and snapshots. A Snapshots example creates a sandbox snapshot and launches a second sandbox from it.

## Open the playground

Open the playground to write and run TypeScript programs in the browser. A browser-based code environment runs code without a local toolchain, so it is ready as soon as the page loads.

The playground is a page of the dashboard, and needs no setup before the first run.

Open the playground from the profile menu of the dashboard. It opens with the code editor, the examples browser, and the console for program output.

1. Go to [Daytona Dashboard ↗](https://app.daytona.com/dashboard)
2. Open the profile menu and click **Playground**

## Write a program

Write a program to define the sandbox operations that the playground runs. A program is source code that imports a library and calls it, as it would in an application.

A program in the playground runs with the API key and endpoints that the playground provides, so the client in the program needs no configuration of its own.

Write the program as plain TypeScript that imports the Daytona SDK. Top-level await is supported, and the editor checks types and completes names from the SDK's type definitions.

**TypeScript:**

```typescript
import { Daytona } from '@daytona/sdk'

// The playground provides the API key and endpoints
const daytona = new Daytona()

async function main() {
  console.log('Creating a sandbox…')
  const sandbox = await daytona.v2.create()
  console.log('Sandbox ready:', sandbox.id, '(', sandbox.state, ')')

  console.log('Cleaning up…')
  await daytona.v2.delete(sandbox)
  console.log('Done.')
}

await main()
```

## Run a program

Run a program to execute the code in the editor and read its output. A run compiles the source code and executes it, and a console shows what the program prints.

A program in the playground executes in a web worker inside your browser, and the sandboxes it creates exist outside the browser as real sandboxes.

Run the program to check a sequence of sandbox operations before it goes into an application. Its SDK calls go to the Daytona API, and its output appears in the console. Stopping a run does not clean up the resources it already created. A sandbox created mid-run can still exist after the stop, so delete each sandbox of the stopped run that you no longer need.

1. Go to [Daytona Playground ↗](https://app.daytona.com/dashboard/playground)
2. Click **Run** to run the program in the editor
3. Read the program's output in the console
4. Click **Stop** to terminate a run in progress

## Examples

Examples are complete programs that show one task from start to end. They let a reader start from code that runs and change it for their own task, instead of starting from an empty file.

An example in the playground is a TypeScript program that opens in the editor and acts on real sandboxes when it runs, like a program you write yourself.

Start from the example that matches your task, and run it as is or with your changes. For the operations in the examples, see [sandboxes](../python-sdk/sandboxes.md), [process execution](../python-sdk/process-execution.md), [file system operations](../python-sdk/file-system-operations.md), [images](../python-sdk/images.md), and [snapshots](../python-sdk/snapshots.md).

| **Example**                 | **Description**                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| **Hello sandbox**           | Create a sandbox, print its ID and state, then delete it.                                |
| **Lifecycle**               | Create, list, and delete sandboxes, and inspect state transitions.                       |
| **Run a command**           | Execute a shell command inside a sandbox and read its output.                            |
| **File operations**         | Write, list, and read files in a sandbox through the toolbox file system API.            |
| **Images**                  | Register a registry image under your own name and launch a sandbox from it.              |
| **Snapshots**               | Create a sandbox snapshot and launch a second sandbox from it.                           |
| **Build from a Dockerfile** | Build an image from an inline Dockerfile, then launch a sandbox from it.                 |
