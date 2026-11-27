## Contents

- 1. Upgrade the SDK
- 2. Update your code
- 3. Move workload
- CLI
- What carries over
- See Also




**Daytona v2 is the next version of the Daytona platform.**

Daytona v0 is the current platform, with SDK and CLI releases numbered `0.x`. Daytona v2 has its own API, dashboard, and resource model, with SDK and CLI releases numbered `2.x`.

Upgrading the SDK and moving a workload to Daytona v2 are separate steps. SDK 2.x calls both platforms from the same client, through a separate namespace for each platform. Installing SDK 2.x does not move existing sandboxes or change which platform serves them. Move workloads to Daytona v2 call by call, on your own schedule.

Your account, organization, members, API keys, and billing carry over to Daytona v2. Daytona syncs API keys and container registries between the platforms, and registers container snapshots as Daytona v2 images. Sandboxes stay on Daytona v0 until you import them.

| **Term**                 | **Daytona v0**                                      | **Daytona v2**                                              |
| ------------------------ | --------------------------------------------------- | ----------------------------------------------------------- |
| **SDK and CLI versions** | **`0.x`**                                           | **`2.x`**                                                   |
| **SDK namespace**        | **`daytona.v0`**                                    | **`daytona.v2`**                                            |
| **API**                  | **`https://app.daytona.io/api`**                    | **`https://api.daytona.com`**                               |
| **Dashboard**            | <u>[**app.daytona.io**](https://app.daytona.io)</u> | <u>[**app.daytona.com**](https://app.daytona.com)</u>       |
| **Documentation**        | <u>[**daytona.io/docs**](./getting-started.md)</u>             | <u>[**daytona.com/docs**](https://www.daytona.com/docs)</u> |

**Agent Prompt:**

```text
Help me upgrade the Daytona SDK in this project from 0.x to 2.x. The application must keep calling Daytona v0 after the upgrade. Do not move calls to Daytona v2 and do not import sandboxes: moving workloads to Daytona v2 is a separate step.

1. Find the Daytona SDK and its version in this project. SDK 2.x exists for Python and TypeScript only. If the project uses the Go, Ruby, or Java SDK, stop and tell me: those SDKs stay on 0.x.

2. Check that the Git working tree is clean. If it has uncommitted changes, stop and tell me: the upgrade tool refuses to run on a dirty tree.

3. Run the upgrade tool from the project directory. Preview the changes first, then apply them:

    Python: `uvx daytona-upgrade --dry`, then `uvx daytona-upgrade . --yes`
    TypeScript: `npx @daytona/upgrade --dry`, then `npx @daytona/upgrade . --yes`

    If the tool refuses because the project uses a custom API URL, stop and tell me: SDK 2.x has no API URL setting, and these applications stay on SDK 0.x. If it refuses because the project uses a newer 0.x minor version than the one SDK 2.x runs as `.v0`, stop and tell me. Report any warning about the 0.x version gap in the summary.

4. Install the SDK 2.x version the tool wrote to the dependency file. Do not change that version.

    Python: the `v0-sdk` extra of `daytona` provides the `v0` namespace
    TypeScript: `@daytona/sdk` requires Node.js 22.15 or later

5. Resolve every `FIXME(daytona-upgrade)` comment and every manual item in the output of the tool. The tool changes only the calls it can prove belong to the Daytona client. Search the code for remaining Daytona client calls without `.v0` and fix them by hand:
    - Add `.v0` to every call on the Daytona client. For example, `daytona.create()` becomes `daytona.v0.create()`. A call without a namespace fails in SDK 2.x.
    - Import Daytona v0 resource types and errors, such as `Sandbox` and `DaytonaError`, from `daytona.v0` in Python or `@daytona/sdk/v0` in TypeScript. Keep importing the `Daytona` client and its configuration from the package root.

6. Update the configuration:
    - If the client configuration sets `target`, remove it and pass `target` to each Daytona v0 sandbox create instead, or `region_id` (`regionId` in TypeScript) to each Daytona v0 snapshot create.
    - If `DAYTONA_API_URL` or `DAYTONA_V2_API_URL` is set in the environment of the process, tell me to unset it. Daytona v0 ignores both, and they redirect Daytona v2 calls.
    - Keep `DAYTONA_API_KEY`. The same key works for both namespaces.

7. Run the project's type checker and tests. If the project has no tests that call Daytona, write a short script that creates a sandbox with `daytona.v0.create()`, runs a command in it, prints the output, and deletes the sandbox. Run it to verify the upgrade.

8. Summarize the changed files and list anything you could not upgrade, with the reason.
```

## 1. Upgrade the SDK

SDK 2.x is available for Python and TypeScript. It targets Daytona Cloud: it has no API URL setting, and it calls the Daytona Cloud APIs of both platforms. Applications that use a custom API URL stay on SDK 0.x. The Go, Ruby, and Java SDKs stay on 0.x and call Daytona v0.

If you use the [upgrade tool](#11-upgrade-tool), run it before you install SDK 2.x.


### 1.1 Upgrade tool

The upgrade tool upgrades a project from SDK 0.x to SDK 2.x and keeps it on Daytona v0. It updates the Daytona dependency, adds the Daytona v0 namespace to client calls, and moves the imports of Daytona v0 resource types and errors to the Daytona v0 module. It does not move calls to Daytona v2 and does not install packages. Each language has its own tool: the Python tool changes only Python code, and the TypeScript tool changes only TypeScript and JavaScript code.

The tool changes only the calls it can prove belong to the Daytona client. It marks a call it cannot prove, but can link to Daytona, with a **`FIXME(daytona-upgrade)`** comment and lists it as a manual item in its output. Calls with no link to Daytona get no comment, so review the changes and run your tests before you deploy them. The tool refuses to run when the project sets a custom API URL in its code, environment files, or deployment files.

The tool runs from the project directory and requires a clean Git working tree. Run it before you install SDK 2.x: the TypeScript tool uses the installed SDK 0.x types to find client calls. The Python tool requires Python 3.9 or later, and the TypeScript tool requires Node.js 20 or later.

Run the latest release of the tool. It sets the Daytona dependency to the SDK 2.x release it targets.


SDK 2.x runs one 0.x release as the Daytona v0 namespace. The tool reads the 0.x version of the project from its lockfile, or from the dependency file, and compares it with that release:

| **Installed 0.x version**                       | **Result**                                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **The same release**                            | No report.                                                                                                                                       |
| **An older release, or a newer patch release**  | A warning. Calls on the Daytona v0 namespace run the 0.x release of SDK 2.x. Review the 0.x changes between the two releases, then run your tests. |
| **A newer minor release**                       | The tool refuses to run. The 0.x release of SDK 2.x lacks the newer 0.x methods. Use a later release of the tool, or pass **`--allow-newer-v0`**. |
| **Unknown**                                     | A warning.                                                                                                                                       |

| **Option**                   | **Description**                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **`[path]`**                 | The project directory. Defaults to the current directory. The Python tool also accepts a single file.                   |
| **`--dry`**                  | Print the changes as a diff. Writes nothing.                                                                            |
| **`--print`**                | Print the changed files. Writes nothing.                                                                                |
| **`--json`**                 | Print the report as JSON.                                                                                               |
| **`--yes`**                  | Skip the confirmation prompt.                                                                                           |
| **`--force`**                | Run on a Git working tree with uncommitted changes.                                                                     |
| **`--drop-api-url`**         | Accept API URLs the tool cannot verify, such as URLs read from variables, as Daytona Cloud URLs.                        |
| **`--strict`**               | Exit with code **`1`** when manual items remain.                                                                        |
| **`--allow-newer-v0`**       | Upgrade a project on a newer 0.x minor release than the 0.x release of SDK 2.x, with a warning.                         |
| **`--suggest-v2`**           | Add comments with the Daytona v2 equivalent of each call. See [move workload](#3-move-workload). |
| **`--remove-suggestions`**   | Remove the comments added by **`--suggest-v2`**.                                                                        |

Analysis covers the whole project and takes longer on large projects. In a large repository, run the tool on the directories that use Daytona, with their tests and dependency file, instead of the repository root.

## 2. Update your code

SDK 2.x moves every resource operation into a version namespace. The client and its configuration are still imported from the package root. Resource types and errors for Daytona v0, such as sandboxes, sandbox create parameters, and the not found error, move to the Daytona v0 module. The [upgrade tool](#11-upgrade-tool) makes these changes where it can. Resolve each **`FIXME(daytona-upgrade)`** comment and each manual item it reported, and apply the same rules to the calls it did not change.

Add the Daytona v0 namespace to every call on the client. The client has no resource methods of its own in SDK 2.x: a call without a namespace fails. The application keeps calling Daytona v0, and code that already uses the namespace needs no change.

| **Item**                                     | **Python**                | **TypeScript**            |
| -------------------------------------------- | ------------------------- | ------------------------- |
| **Client and configuration**                 | **`daytona`**             | **`@daytona/sdk`**        |
| **Errors shared by both platforms**          | **`daytona`**             | **`@daytona/sdk`**        |
| **Daytona v0 resource types and errors**     | **`daytona.v0`**          | **`@daytona/sdk/v0`**     |
| **Daytona v2 resource types and errors**     | **`daytona.v2`**          | **`@daytona/sdk/v2`**     |
| **Daytona v0 calls**                         | **`daytona.v0.create()`** | **`daytona.v0.create()`** |
| **Daytona v2 calls**                         | **`daytona.v2.create()`** | **`daytona.v2.create()`** |


### Configuration

One API key serves both namespaces. The client reads it from the environment or from the client configuration. The following table lists the API key and the settings that change in SDK 2.x:

| **Setting**                                | **SDK 2.x**                                                                                                                                                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`DAYTONA_API_KEY`**                      | Unchanged. The same key serves **`.v0`** and **`.v2`**.                                                                                                                                                     |
| **`api_url`**, **`toolbox_url`**           | Removed. The client configuration raises an error when either is set. Remove a setting that names the default Daytona v0 API URL. Applications that use a custom API URL stay on SDK 0.x.                  |
| **`target`**                               | Deprecated. It applies to **`.v0`** only. Pass **`target`** to each Daytona v0 sandbox create, or **`region_id`** (**`regionId`** in TypeScript) to each Daytona v0 snapshot create.                       |
| **`DAYTONA_API_URL`**                      | Ignored by **`.v0`**. When set, it overrides the Daytona v2 API URL. Unset a **`DAYTONA_API_URL`** left from SDK 0.x, or **`.v2`** calls the Daytona v0 API.                                                |
| **`DAYTONA_V2_API_URL`**                   | Ignored by **`.v0`**. When set, it overrides the Daytona v2 API URL and takes precedence over **`DAYTONA_API_URL`**.                                                                                        |
| **`.env`** files                           | Read by **`.v0`**. **`.v2`** reads only the environment of the process.                                                                                                                                     |
| **Missing API key**                        | Reported on the first **`.v0`** access, not by the client constructor. Code that catches a missing key around the constructor must access **`.v0`** inside the same **`try`** block.                         |
| **`DaytonaConfig`** (Python)               | A dataclass, not a Pydantic model. Replace **`model_dump()`** with **`dataclasses.asdict()`**, **`model_copy()`** with **`dataclasses.replace()`**, and **`model_validate()`** with **`DaytonaConfig(**data)`**. |

### Errors

Every error that the Daytona v0 namespace raises is a Daytona v0 error class. The Daytona v0 error classes keep the constructor and fields of SDK 0.x, so code that catches, raises, or subclasses errors works as before when it imports them from the Daytona v0 module.

The errors at the package root are shared by both namespaces. For example, the not found error at the package root catches a not found error from both platforms. A root error class takes only a message when you construct it, and its instances carry none of the fields of SDK 0.x. Import errors from the package root when you move calls to Daytona v2, and import errors specific to one platform from the module of that platform.

### Verify the upgrade

Run the type checker and tests of the project. A call on the client without a namespace fails in SDK 2.x, so a test that reaches it reports the call. If no test calls Daytona, run a short script that creates a Daytona v0 sandbox, runs a command in it, and deletes it.


## 3. Move workload

Move a workload to Daytona v2 by moving its calls from the Daytona v0 namespace to the Daytona v2 namespace. Both namespaces work in the same application with the same client, so you can move one workflow at a time. A sandbox created on Daytona v0 is reachable only through the Daytona v0 namespace, and a sandbox created on Daytona v2 only through the Daytona v2 namespace.


The [upgrade tool](#11-upgrade-tool) adds a comment above each Daytona v0 call with its Daytona v2 equivalent, the differences in behavior, and the other calls in the same sandbox workflow. Workflows that stop, start, pause, or archive a sandbox are marked to stay on Daytona v0, because sandbox lifecycle differs on Daytona v2. The comments start with **`daytona-v2:`**. The tool does not change calls or dependencies in this mode, and running it again replaces the comments. The <u>[**migration reference**](https://github.com/daytona/clients/blob/main/upgrade/MIGRATION.md)</u> lists the Daytona v2 equivalent of every Daytona v0 call.


Removing the comments deletes every comment line that starts with **`daytona-v2:`**, including comments you wrote. Do not use this prefix for your own comments.

Daytona v2 has its own resource model. The following concepts differ between the platforms:

| **Daytona v0**                                       | **Daytona v2**                                                                                                                                                                                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Snapshot**: an image that sandboxes are created from | <u>[**Image**](https://www.daytona.com/docs/images)</u>. A Daytona v2 <u>[**snapshot**](https://www.daytona.com/docs/snapshots)</u> saves the memory and disk of a running sandbox.                                          |
| **Organization**                                     | <u>[**Organization**](https://www.daytona.com/docs/organizations)</u> with <u>[**projects**](https://www.daytona.com/docs/projects)</u>. Resources belong to a project.                                                        |
| **Sandbox**                                          | <u>[**Sandbox**](https://www.daytona.com/docs/sandboxes)</u>: a virtual machine with its own kernel. See the <u>[**sandbox lifecycle**](https://www.daytona.com/docs/sandboxes#lifecycle)</u> of Daytona v2.                |
| **Volume**                                           | <u>[**Volume**](https://www.daytona.com/docs/volumes)</u>. Volumes do not carry over: volumes on Daytona v0 stay on Daytona v0.                                                                                                       |

## CLI

The Daytona v2 CLI calls Daytona v2 only. It installs as `daytona`, and the [Daytona v0 CLI](../cli.md#installation) installs as `daytona-v0`, so both CLIs install side by side. Both CLIs keep their configuration in separate files, so neither overwrites the other. Keep the Daytona v0 CLI for Daytona v0 sandboxes until you no longer need it. See the [CLI reference](https://www.daytona.com/docs/cli) of Daytona v2.

## What carries over

Daytona v2 uses the same account and organization as Daytona v0, with the same organization ID. Resources from Daytona v0 belong to the default project of the organization on Daytona v2. Only the default project syncs with Daytona v0. Other Daytona v2 projects are Daytona v2 only.

| **Resource**                                             | **On Daytona v2**                                                                                                     |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Account and organization**                             | The same account and organization, including personal organizations.                                                  |
| **Members**                                              | Organization members carry over. Owners become admins, and members stay members.                                      |
| <u>[**API keys**](#api-keys)</u>                         | The same API key works on both platforms. Keys sync in both directions through the **`default`** project.             |
| <u>[**Container registries**](#container-registries)</u> | Organization registries sync in both directions through the **`default`** project.                                    |
| <u>[**Billing**](#billing)</u>                           | The same balance, credits, payment method, and invoice. Usage on both platforms is billed together.                   |
| <u>[**Snapshots**](#snapshots)</u>                       | Container snapshots appear as images in the **`default`** project.                                                    |
| <u>[**Sandboxes**](#import-sandboxes)</u>                | Sandboxes stay on Daytona v0. Import archived container sandboxes as persistent sandboxes.                            |
| **Volumes**                                              | Volumes stay on Daytona v0.                                                                                           |
| **Secrets and webhooks**                                 | Secrets and webhooks stay on Daytona v0.                                                                              |
| **Audit logs**                                           | The audit log of Daytona v0 stays on Daytona v0.                                                                      |

### API keys

API keys sync between Daytona v0 and the default project on Daytona v2. A synced key has the same secret on both platforms, so the same API key works for both namespaces. A key created on one platform works on the other shortly after it is created. Revoking a key on either platform revokes it on both.

Keys created in the default project on Daytona v2 sync to Daytona v0, unless the key is turned off for Daytona v0 when it is created or [later](https://www.daytona.com/docs/api-keys#update-an-api-key). Daytona v0 has no read permissions, so the Daytona v0 copy of a key can read every sandbox, snapshot, and registry of the organization, whatever the permissions of the key. Keys imported from Daytona v0 always sync and cannot be turned off. Keys created in other Daytona v2 projects, service account keys, organization keys, and the default key of the dashboard are Daytona v2 only.

When a key name already exists on the other platform, the synced key is renamed with a suffix:

| **Synced from** | **Synced to** | **Suffix**     |
| --------------- | ------------- | -------------- |
| **Daytona v0**  | Daytona v2    | **`(v1)`**, then **`(v1 {first 8 characters of the key hash})`** |
| **Daytona v2**  | Daytona v0    | **`(v2)`**, then **`(v2 {first 8 characters of the key hash})`** |

Each Daytona v0 permission maps to its Daytona v2 [permission](https://www.daytona.com/docs/api-keys#permissions--scopes). A key synced from Daytona v0 also gets the read permissions for sandboxes, images, and registries. On Daytona v2, the role of the key owner still limits what the key can do.

| **Daytona v0**                                                  | **Daytona v2**                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------- |
| **`write:sandboxes`**, **`delete:sandboxes`**                   | **`write:sandboxes`**, **`delete:sandboxes`**                     |
| **`write:snapshots`**, **`delete:snapshots`**                   | **`write:images`**, **`delete:images`**                           |
| **`write:registries`**, **`delete:registries`**                 | **`write:registries`**, **`delete:registries`**                   |
| **`read:volumes`**, **`write:volumes`**, **`delete:volumes`**   | **`read:volumes`**, **`write:volumes`**, **`delete:volumes`**     |
| **`manage:secrets`**                                            | **`read:secrets`**, **`write:secrets`**, **`delete:secrets`**     |
| **`read:limits`**, **`read:runners`**                           | **`read:limits`**, **`read:runners`**                             |
| **`manage:api_keys`**, **`read:billing`**, **`manage:billing`**, **`manage:sso`**, **`read:audit_logs`**, **`write:regions`**, **`delete:regions`**, **`write:runners`**, **`delete:runners`** | No equivalent. Not carried over. |

### Container registries

Organization [container registries](https://www.daytona.com/docs/registries) sync between Daytona v0 and the default project on Daytona v2, in both directions. Registries sync by host: a synced registry keeps its host and credentials, and the registry name, URL path, and project of Daytona v0 do not carry over. Daytona v0 registries on the same host become one Daytona v2 registry. Amazon ECR registries that use a role carry over without changes in AWS.

### Billing

Billing continues on Daytona v2 with the same balance, credits, payment method, and invoice history. Usage on Daytona v0 and Daytona v2 is billed together, on one invoice.

### Snapshots

Active container snapshots on Daytona v0 appear as [images](https://www.daytona.com/docs/images) in the default project on Daytona v2. Daytona-provided snapshots, Linux VM snapshots, and Windows snapshots do not carry over. Daytona registers the image without copying it, in an older image format. The image converts to the current format on its first Linux sandbox create, so the first sandbox from the image waits in the queued state while the conversion runs. GPU sandboxes, functions, and builds that use the image as their source refuse it until it is converted. Windows sandboxes cannot use the image.

[Convert the image](https://www.daytona.com/docs/images#convert-images) ahead of time to remove the wait from the first create. The request requires the permission to write images.

```bash
curl 'https://api.daytona.com/images/{imageId}/convert' \
  --request POST \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

The image keeps the snapshot name, with the following changes:

| **Snapshot name**                                                   | **Image name**           |
| ------------------------------------------------------------------- | ------------------------ |
| **Characters other than letters, digits, `.`, `_`, and `-`**        | Replaced with **`-`**.   |
| **Name already taken on Daytona v2**                                | **`{name}-v1`**, then **`{name}-v1-{first 8 characters of the snapshot ID}`** |

The snapshot on Daytona v0 stays the source of the image: an image deleted on Daytona v2 is registered again while the snapshot is active. Deleting the snapshot on Daytona v0 removes the image, unless the image is converted or in use. A converted image stays on Daytona v2.

### Import sandboxes

Import a sandbox to copy it from Daytona v0 to Daytona v2. The import creates a persistent sandbox in the default project from the latest backup of the Daytona v0 sandbox. The Daytona v0 sandbox keeps working and gets a label with the ID of the Daytona v2 sandbox. The two sandboxes are independent: changes to one do not affect the other.

A sandbox can be imported when it is an archived container sandbox with a completed backup. Running and stopped sandboxes must be [archived](./sandboxes.md#archive-sandboxes) on Daytona v0 first. Linux VM, Windows, and GPU sandboxes cannot be imported. The <u>[**Daytona v2 dashboard**](https://app.daytona.com)</u> lists Daytona v0 sandboxes and imports them from the Sandboxes page, when the default project is selected.


The import requests require an API key of the default project with the following permissions:

| **Request**                   | **Permission**          |
| ----------------------------- | ----------------------- |
| **List Daytona v0 sandboxes** | **`read:sandboxes`**    |
| **Import a sandbox**          | **`write:sandboxes`**   |

#### List Daytona v0 sandboxes

List the sandboxes of the organization on Daytona v0 to see which ones can be imported. Each sandbox shows whether it can be imported now and, when it cannot, the reason. The list is paginated: pass the cursor from the response to get the next page, until the response has no cursor.

```bash
curl 'https://api.daytona.com/migration/v0/sandboxes' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

| **Field**                             | **Description**                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| **`cursor`**                          | Query parameter. The **`next_cursor`** of the previous page.                                 |
| **`next_cursor`**                     | Response field. The cursor of the next page, or **`null`** on the last page.                 |
| **`not_container`**                   | Reason. The sandbox is a Linux VM or Windows sandbox.                                        |
| **`not_archived`**                    | Reason. The sandbox is not archived.                                                         |
| **`backup_not_completed`**            | Reason. The backup of the sandbox has not completed.                                         |
| **`backup_registry_unavailable`**     | Reason. Daytona v2 cannot read the registry of the backup.                                   |
| **`gpu_not_supported`**               | Reason. The sandbox is a GPU sandbox.                                                        |

#### Import a sandbox

Import a sandbox by its Daytona v0 ID. The new sandbox starts in the queued state while its image is imported from the backup. Importing the same sandbox again returns the existing import, unless the request forces a new import.

```bash
curl 'https://api.daytona.com/migration/v0/sandboxes/{v0SandboxId}/import' \
  --request POST \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

The response contains the ID of the Daytona v2 sandbox, the settings that could not be imported, and the names of environment variables that were sandbox secrets on Daytona v0. Set those variables on the imported sandbox.

| **Field**                 | **Description**                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| **`force`**               | Request body field. **`true`** creates a new import when one already exists.                             |
| **`sandbox_id`**          | Response field. The ID of the Daytona v2 sandbox.                                                        |
| **`warnings`**            | Response field. The settings that could not be imported.                                                 |
| **`secret_env_vars`**     | Response field. The names of environment variables that were sandbox secrets on Daytona v0.              |

#### What an import keeps

| **Setting**                                         | **On the imported sandbox**                                                                                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Filesystem**                                      | The filesystem of the latest backup.                                                                                                           |
| **Name**                                            | Kept when the name is valid on Daytona v2.                                                                                                     |
| **Labels**                                          | Kept. Invalid labels are dropped and reported in **`warnings`**.                                                                               |
| **Environment variables**                           | Kept. Invalid and reserved names are dropped and reported in **`warnings`**.                                                                   |
| **CPU, memory, and disk**                           | Kept. Values are rounded up to whole units, and values above the Daytona v2 maximums are capped.                                               |
| **OS user**                                         | Kept.                                                                                                                                          |
| **Network settings**                                | Blocking all traffic and the allow list map to the network policy of Daytona v2.                                                               |
| **Auto-stop interval**                              | Becomes the <u>[**idle timeout**](https://www.daytona.com/docs/linux-sandboxes#timeouts)</u>. An auto-stop interval of **`0`** sets no idle timeout. |
| **Region**                                          | The default region of the project, or of the organization, on Daytona v2.                                                                      |
| **Sandbox secrets**                                 | Not imported. Their names are listed in **`secret_env_vars`**.                                                                                 |
| **Auto-archive, auto-delete, and auto-pause intervals** | Not imported.                                                                                                                              |
| **Public access**                                   | Not imported.                                                                                                                                  |
| **Volumes**                                         | Not imported.                                                                                                                                  |
| **Sandbox ID and preview URLs**                     | Not kept. The imported sandbox has a new ID and new preview URLs.                                                                              |
| **Memory state**                                    | Not kept. The sandbox was archived before the import.                                                                                          |
| **Daytona v0 sandbox**                              | Kept and labeled **`daytona.io/migrated-to`** with the ID of the imported sandbox.                                                             |

## See Also
- [Python SDK - upgrade-to-v2](../python-sdk/upgrade-to-v2.md)
- [TypeScript SDK - upgrade-to-v2](../typescript-sdk/upgrade-to-v2.md)
- [Java SDK - upgrade-to-v2](../java-sdk/upgrade-to-v2.md)
- [Go SDK - upgrade-to-v2](../go-sdk/upgrade-to-v2.md)
