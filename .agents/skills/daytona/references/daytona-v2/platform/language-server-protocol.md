# Language Server Protocol

Interact with language server protocol servers in your sandboxes.

The Language Server Protocol (LSP) is the standard protocol through which code editors and AI coding agents get code intelligence from a language server. A language server that runs in a sandbox analyzes the code where it lives, so an agent or a browser-based editor understands a project as a local IDE does, without copying the project out of the sandbox.

Daytona runs language servers inside a sandbox, next to the code they analyze. Each server covers one language and one project directory and reads the project's files in the sandbox, so the source code never leaves the sandbox. A server runs until it is stopped or its process exits.

Use LSP servers to give a coding agent or a browser-based editor code intelligence for code that stays in a sandbox. An agent searches workspace symbols to find where a function or class is defined before it edits code, and an editor shows completions and an outline of the open file. A sandbox with several languages runs one server for each language and project directory.

## Contents

- [Use cases](#use-cases)
- [Workflow](#workflow)
- [Create LSP servers](#create-lsp-servers)
- [Start LSP servers](#start-lsp-servers)
- [Stop LSP servers](#stop-lsp-servers)
- [Code completions](#code-completions)
- [File notifications](#file-notifications)
- [Document symbols](#document-symbols)
- [Workspace symbols](#workspace-symbols)
- [Symbol fields](#symbol-fields)
- [Permissions](#permissions)

## Use cases

LSP servers give an application code intelligence for code that stays in a sandbox.

- **Coding agents.** An agent searches workspace symbols to find where a function or class is defined before it edits code. Each match carries the file URI and the line range, so the agent opens the right file at the right line. The query goes to the language server as is, so the matching rules are those of the server for the language.

- **Browser-based editors.** An editor in a web application shows completions and an outline of the open file. The language server computes both in the sandbox, next to the code. Each file is read once, when it is opened, and later changes on disk are not sent to the server.

- **Completions for generated code.** An agent or an editor requests completions at a position to fill in names that exist in the project. A trigger character, such as a dot, tells the server how the completion started. Positions are zero-based, and character offsets count UTF-16 code units within the line.

- **Code that stays in the sandbox.** The language server reads files from the sandbox filesystem. Your application gets code intelligence without copying the source code out of the sandbox. Daytona does not install language servers, so the server binary must be in the sandbox image and on its path.

- **Projects with several languages.** Each server covers one language and one project directory. A sandbox runs a Python server for one directory and a TypeScript server for another. The TypeScript server also covers JavaScript.

## Workflow

A workflow is the order in which a client calls a language server. The Language Server Protocol expects a client to start a server, tell it which files are open, and then send requests about them.

The workflow in a sandbox ties every request to a server that runs for one language and one project directory. No step starts a server on its own.

Follow this order when you use LSP in a sandbox:

1. Start a server for a language ID and a project path
2. Open a file on a TypeScript server before requesting its completions or symbols
3. Request completions, document symbols, or workspace symbols from the server
4. Close the file when you finish with it
5. Stop the server when it is no longer needed

## Create LSP servers

Create LSP servers to make a language server available where the code is. A language server is a program for one language that a client starts as a separate process, so it must be installed in the same sandbox as the source code that it analyzes.

A language server in a sandbox comes from the sandbox image instead of being installed at start, and it runs on the files of a project directory in the sandbox.

Create a sandbox whose image includes the language server, then [start the server](#start-lsp-servers) for a project directory. Daytona does not install language servers, so the binary must be in the image and on its path. Create the project directory in the image or before you start the server.

**API:**

```bash
# Build an image that ships pylsp and typescript-language-server; the response carries its id
curl 'https://api.daytona.com/images' \
  --request POST \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{ "dockerfile": "FROM node:20\nRUN apt-get update && apt-get install -y --no-install-recommends python3-pip && rm -rf /var/lib/apt/lists/*\nRUN pip3 install --no-cache-dir --break-system-packages python-lsp-server\nRUN npm install -g typescript@5 typescript-language-server\nRUN mkdir -p /workspace/project\n" }'

# Returns on ready or failed, or after timeout_ms; repeat while status is pending or building
curl 'https://api.daytona.com/images/{imageId}?wait=ready&timeout_ms=60000' \
  --header 'Authorization: Bearer YOUR_API_KEY'

# Create the sandbox from the image id
curl 'https://api.daytona.com/sandboxes' \
  --request POST \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{ "image": "{imageId}" }'

# Write the files for the examples on this page
printf 'class MyClass:\n    def method_one(self):\n        return 1\n\nMyClass().\n' |
  curl '{toolboxProxyUrl}/{sandboxId}/files/upload?path=/workspace/project/main.py' \
    --request POST \
    --header 'Authorization: Bearer YOUR_API_KEY' \
    --form 'file=@-'
printf 'class MyClass {\n  methodOne(): number {\n    return 1\n  }\n}\n' |
  curl '{toolboxProxyUrl}/{sandboxId}/files/upload?path=/workspace/project/main.ts' \
    --request POST \
    --header 'Authorization: Bearer YOUR_API_KEY' \
    --form 'file=@-'
```

| **Field** | **Description** |
| --- | --- |
| `dockerfile` | Sets the Dockerfile to build.<br />**Format:** Dockerfile text that copies no local files<br />**Example:** `"FROM node:20\nRUN npm install -g typescript@5 typescript-language-server\n"` |
| `wait` | Holds the wait request until the image reaches this status.<br />**Value:** an image status, such as `ready`<br />**Example:** `ready` |
| `timeout_ms` | Sets how many milliseconds the wait request holds.<br />**Default:** `30000`<br />**Minimum:** `0`<br />**Maximum:** `60000` |
| `image` | Sets the image that the create request boots the new sandbox from.<br />**Format:** an image name or ID |
| `path` | Sets the destination path in the sandbox.<br />**Format:** an absolute path<br />**Example:** `/workspace/project/main.py` |
| `file` | Sets the content of the file as a multipart form part.<br />**Example:** `@-` for standard input |

> **Notes:**
>
> - `{toolboxProxyUrl}` is the toolbox_proxy_url field of the [sandbox](../python-sdk/sandboxes.md#get-a-sandbox).
> - The image must have pylsp for `python` or typescript-language-server for `typescript` on PATH.
> - The image needs TypeScript 5 or 6, because typescript-language-server does not start with TypeScript 7.
> - Create the project directory before you start the server, because a start with a missing directory succeeds but runs the server from `/` with a workspace root that does not exist.

## Start LSP servers

Start an LSP server to launch a language server process for a project. A started server analyzes the project and answers requests about it until it is stopped.

A language server in a sandbox runs for one language and one project directory. Starting a server for a language and directory that already has a running server reuses that server.

Start a server for a language and a project directory before any other LSP operation. The other operations never start a server implicitly, and until then, they fail with a not started error.

**API:**

```bash
curl '{toolboxProxyUrl}/{sandboxId}/lsp/start' \
  --request POST \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "languageId": "python",
  "pathToProject": "/workspace/project"
}'
```

| **Field** | **Description** |
| --- | --- |
| `languageId` | Sets the language of the server.<br />**Required**<br />**Value:** `"python"` or `"typescript"`<br />**Example:** `"python"` |
| `pathToProject` | Sets the project directory that the server uses as its workspace root.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `"/workspace/project"` |

> **Notes:**
>
> - `{toolboxProxyUrl}` is the toolbox_proxy_url field of the [sandbox](../python-sdk/sandboxes.md#get-a-sandbox).
> - The image must have pylsp for `python` or typescript-language-server for `typescript` on PATH.
> - Starting a server for a language and project directory that already has one reuses that server.
> - A sandbox runs at most 16 language servers at once.
> - The examples on this page use the sandbox, main.py, and main.ts from [Create LSP servers](#create-lsp-servers).

## Stop LSP servers

Stop an LSP server to end its process when the project no longer needs it. A client stops a language server with a shutdown request, after which the server process ends.

Stopping a language server in a sandbox sends it a shutdown request and ends its process, which frees one of the server slots of the sandbox.

Stop a server when you finish with a project, or to make room for a server for another language or directory. A sandbox runs at most 16 language servers at once.

**API:**

```bash
curl '{toolboxProxyUrl}/{sandboxId}/lsp/stop' \
  --request POST \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "languageId": "python",
  "pathToProject": "/workspace/project"
}'
```

| **Field** | **Description** |
| --- | --- |
| `languageId` | Sets the language of the server.<br />**Required**<br />**Value:** `"python"` or `"typescript"`<br />**Example:** `"python"` |
| `pathToProject` | Sets the project directory that the server uses as its workspace root.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `"/workspace/project"` |

## Code completions

Code completions are the candidates that a language server proposes to continue the code at a position in a file, such as methods after a dot. The server computes them from the project.

Code completions in a sandbox come from the language server that runs on the project's files there. For an open file, the server computes them from the content sent at open.

Get completions at a position in a file to fill in names from the project. On a TypeScript server, [open the file](#open-file) first. Positions are zero-based, and character offsets count UTF-16 code units.

**API:**

```bash
curl '{toolboxProxyUrl}/{sandboxId}/lsp/completions' \
  --request POST \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "languageId": "python",
  "pathToProject": "/workspace/project",
  "position": {
    "character": 10,
    "line": 4
  },
  "uri": "file:///workspace/project/main.py"
}'
```

| **Field** | **Description** |
| --- | --- |
| `languageId` | Sets the language of the server.<br />**Required**<br />**Value:** `"python"` or `"typescript"`<br />**Example:** `"python"` |
| `pathToProject` | Sets the project directory that the server uses as its workspace root.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `"/workspace/project"` |
| `uri` | Sets the file that the request applies to.<br />**Required**<br />**Format:** a file URI<br />**Example:** `"file:///workspace/project/main.py"` |
| `position` | Sets the position in the file.<br />**Required**<br />**Format:** a zero-based line and character, with the character in UTF-16 code units<br />**Example:** `{"line": 4, "character": 10}` |

> **Notes:**
>
> - Call POST /lsp/did-open on the file before requesting completions from a `typescript` server, because it returns no completions for a file that is not open.
> - The pylsp server reads a file that is not open from disk.

### Completion context

A completion context tells a language server how a completion was triggered, for example by a typed character such as a dot. The protocol numbers each way to trigger a completion.

A completion context in a sandbox goes to the language server together with the completion request. Without a context, the server receives none.

Pass a completion context to tell the language server how the completion was triggered. The trigger kind is the completion trigger kind number from the Language Server Protocol specification. Set the trigger character when a typed character, such as a dot, opened the completion. Without a context, the server receives none.

**API:**

```bash
curl '{toolboxProxyUrl}/{sandboxId}/lsp/completions' \
  --request POST \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "languageId": "python",
  "pathToProject": "/workspace/project",
  "uri": "file:///workspace/project/main.py",
  "position": {
    "character": 10,
    "line": 4
  },
  "context": {
    "triggerKind": 2,
    "triggerCharacter": "."
  }
}'
```

| **Field** | **Description** |
| --- | --- |
| `context` | Sets how the completion was triggered.<br />**Example:** `{"triggerKind": 2, "triggerCharacter": "."}` |
| `context.triggerKind` | Sets the LSP completion trigger kind number.<br />**Required**<br />**Example:** `2` |
| `context.triggerCharacter` | Sets the character that triggered the completion.<br />**Example:** `"."` |

### Completion item fields

Completion item fields are the parts of a completion response and of each candidate in it. The Language Server Protocol defines them, and a server fills in the optional ones as it chooses.

A completion response from a sandbox carries the items that the language server returned, and it marks a list that the server returned only in part.

Show the label of each item, and insert its insert text when the server sets one.

| **Response field** | **Description**                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `items`            | The completion items.                                                                                   |
| `isIncomplete`     | `true` when the language server returned a partial list. |

| **Item field**  | **Description**                                                                                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`         | Text shown for the item. Always present.                                                                                                                                                                                                |
| `kind`          | LSP `CompletionItemKind` number, for example `3` for a function or `6` for a variable.                                                                                                                                                  |
| `detail`        | Extra information such as a type signature. Present only when the language server includes it in the completion list, which `pylsp` and `typescript-language-server` do not.                                                            |
| `documentation` | Either a plain string or a `MarkupContent` object with `kind` (`plaintext` or `markdown`) and `value`. Present only when the language server includes it in the completion list, which `pylsp` and `typescript-language-server` do not. |
| `sortText`      | String to sort by instead of `label`.                                                                                                                                                              |
| `filterText`    | String to filter by instead of `label`.                                                                                                                                                          |
| `insertText`    | Text to insert instead of `label`.                                                                                                                                                               |

## File notifications

File notifications are the messages that tell a language server which files a client has open. A server keeps the content of each open file and works from it until the file is closed.

A file notification in a sandbox names a file in the sandbox filesystem by its file URI, and the content of an opened file comes from that filesystem.

Open a file on a TypeScript server before requesting its completions or symbols, and close it when done, because it answers only for open files. The Python server reads closed files.

### Open file

Open a file to give a language server its content to analyze. An open file is one that the client tracks, and the server works from the content that the client sent instead of from the disk.

An open file in a sandbox has its content read from the sandbox filesystem and sent to the server, which works from that content. Later changes on disk are not sent.

Open a file on a TypeScript server before you request [code completions](#code-completions) or [document symbols](#document-symbols) for it, or search [workspace symbols](#workspace-symbols). The file must exist, be valid UTF-8, and be at most 1 MiB.

**API:**

```bash
curl '{toolboxProxyUrl}/{sandboxId}/lsp/did-open' \
  --request POST \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "languageId": "python",
  "pathToProject": "/workspace/project",
  "uri": "file:///workspace/project/main.py"
}'
```

| **Field** | **Description** |
| --- | --- |
| `languageId` | Sets the language of the server.<br />**Required**<br />**Value:** `"python"` or `"typescript"`<br />**Example:** `"python"` |
| `pathToProject` | Sets the project directory that the server uses as its workspace root.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `"/workspace/project"` |
| `uri` | Sets the file that the request applies to.<br />**Required**<br />**Format:** a file URI<br />**Example:** `"file:///workspace/project/main.py"` |

> **Notes:**
>
> - The file must exist in the sandbox, be valid UTF-8, and be at most 1 MiB.
> - The server works from the content sent at open, and later changes on disk are not sent.

### Close file

Close a file to tell a language server that the client no longer tracks it. After a close, the server stops working from the content it received when the file was opened.

Closing a file in a sandbox affects only the language server that receives the notification. The file itself stays in the sandbox filesystem with its content unchanged.

Close a file when you finish with it, as the [workflow](#workflow) describes.

**API:**

```bash
curl '{toolboxProxyUrl}/{sandboxId}/lsp/did-close' \
  --request POST \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "languageId": "python",
  "pathToProject": "/workspace/project",
  "uri": "file:///workspace/project/main.py"
}'
```

| **Field** | **Description** |
| --- | --- |
| `languageId` | Sets the language of the server.<br />**Required**<br />**Value:** `"python"` or `"typescript"`<br />**Example:** `"python"` |
| `pathToProject` | Sets the project directory that the server uses as its workspace root.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `"/workspace/project"` |
| `uri` | Sets the file that the request applies to.<br />**Required**<br />**Format:** a file URI<br />**Example:** `"file:///workspace/project/main.py"` |

## Document symbols

Document symbols are the named elements that one file declares, such as classes and functions. A language server finds them in the file, and an editor shows them as an outline.

Document symbols in a sandbox come from the language server that runs for the file's language and project directory. Each symbol is flat, with no nested children.

Get document symbols to show the outline of a file, or to find where it declares a class or a function. [Open the file](#open-file) first on a TypeScript server, which returns no symbols for a file that is not open. The Python server reads closed files from disk. [Symbol fields](#symbol-fields) describes each symbol.

**API:**

```bash
curl '{toolboxProxyUrl}/{sandboxId}/lsp/document-symbols?languageId=python&pathToProject=/workspace/project&uri=file:///workspace/project/main.py' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

| **Field** | **Description** |
| --- | --- |
| `languageId` | Sets the language of the server.<br />**Value:** `python` or `typescript`<br />**Example:** `python` |
| `pathToProject` | Sets the project directory that the server uses as its workspace root.<br />**Format:** an absolute path<br />**Example:** `/workspace/project` |
| `uri` | Sets the file that the request applies to.<br />**Format:** a file URI<br />**Example:** `file:///workspace/project/main.py` |

> **Notes:**
>
> - Call POST /lsp/did-open on the file before requesting symbols from a `typescript` server, because it returns no symbols for a file that is not open.
> - The pylsp server reads a file that is not open from disk.

## Workspace symbols

Workspace symbols are the named elements declared anywhere in a project, found by a search on their names. A language server answers the search from its analysis of the project.

A workspace symbol search in a sandbox runs on the language server for the project directory. The query is passed to the server as is, so the server's own matching rules apply.

Search the project for symbols that match a query string to find where a function or class is defined before an agent edits code. Only the TypeScript server supports the search, and it needs an open file of the project on the server. The first search after a file opens can return an empty list while the server loads the project, so repeat it.

**API:**

```bash
# Start a typescript server, in the sandbox from Create LSP servers
curl '{toolboxProxyUrl}/{sandboxId}/lsp/start' \
  --request POST \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "languageId": "typescript",
  "pathToProject": "/workspace/project"
}'

# Open a file of the project
curl '{toolboxProxyUrl}/{sandboxId}/lsp/did-open' \
  --request POST \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "languageId": "typescript",
  "pathToProject": "/workspace/project",
  "uri": "file:///workspace/project/main.ts"
}'

# Search the project
curl '{toolboxProxyUrl}/{sandboxId}/lsp/workspacesymbols?query=MyClass&languageId=typescript&pathToProject=/workspace/project' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

| **Field** | **Description** |
| --- | --- |
| `query` | Sets the string that the server matches symbol names against.<br />**Example:** `MyClass` |
| `languageId` | Sets the language of the server.<br />**Value:** `python` or `typescript`<br />**Example:** `typescript` |
| `pathToProject` | Sets the project directory that the server uses as its workspace root.<br />**Format:** an absolute path<br />**Example:** `/workspace/project` |

> **Notes:**
>
> - The server language must be `typescript`, because pylsp does not support workspace symbols.
> - Open a file of the project on the server before searching.
> - Without a tsconfig.json in the project directory, the search covers only open files and imports.
> - With a tsconfig.json, the search covers every file that the configuration includes.
> - The first search after opening a file can return an empty list while the project loads, so repeat it.

## Symbol fields

Symbol fields are the parts of each symbol that a symbol request returns. A symbol names an element of the code, states what kind of element it is, and points to where it is declared.

Document symbols and workspace symbols in a sandbox share the same flat symbol shape, whatever shape the language server answers with.

Read the location of a symbol to open its file at the right line. Hierarchical document symbol answers are reduced to the same three fields, and their nested children are dropped. A hierarchical symbol has no location, so each one gets an empty URI and a zero range. A workspace symbol whose location has only a URI keeps the URI and gets a zero range.

| **Field**              | **Description**                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `name`             | Symbol name.                                                                                               |
| `kind`             | LSP `SymbolKind` number, for example `5` for a class, `6` for a method, `12` for a function.               |
| `location.uri`     | `file://` URI of the document that declares the symbol.                                                    |
| `location.range`   | `start` and `end` positions, each with zero-based `line` and `character`.                                  |

## Permissions

Language server access runs through the toolbox of a sandbox. Access is governed by one project permission, which you can grant to an [organization role](../python-sdk/organizations.md#roles) or an [API key](../python-sdk/api-keys.md).

A [sandbox access token](../python-sdk/sandboxes.md#create-an-access-token) with the toolbox:lsp operation grants the same access to a single sandbox, without an API key. The sandbox read permission alone does not grant toolbox access. Building an image that ships a language server requires the permission to write images.

| **Permission**        | **Grants**                                                          |
| --------------------- | ------------------------------------------------------------------- |
| **`write:sandboxes`** | Start and stop language servers and request completions and symbols |
