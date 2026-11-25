# Migrate from Daytona v0

Review what moved from Daytona v0 and import archived Daytona v0 sandboxes as persistent sandboxes.

Migration from Daytona v0 moves an organization's resources to Daytona v2. When an organization is migrated, Daytona syncs its API keys, container registries, and snapshots into the organization's default project. Sandboxes are not synced: you import archived Daytona v0 sandboxes one at a time, each as a new persistent sandbox in the default project.

Snapshots arrive as named images in an older format. Each image converts on its first Linux sandbox create, or ahead of time through [image conversion](../python-sdk/images.md#convert-images). An imported sandbox boots from the last backup of its Daytona v0 sandbox and keeps the settings Daytona v2 supports. Importing copies a sandbox rather than moving it: the original keeps working on Daytona v0.

Every migration request is scoped to the organization's default project, and a request made with an API key for any other project is refused. API keys created in the default project can also be copied to Daytona v0, as described in [Daytona v0 key sync](../python-sdk/api-keys.md). An organization shared with Daytona v0 also shares its [single sign-on](./sso.md) configuration.

| **Resource**             | **Migration**                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **API keys**             | Synced into the default project. A key synced from Daytona v0 works on both platforms unchanged.                      |
| **Container registries** | Synced into the default project.                                                                                      |
| **Snapshots**            | Synced into the default project as named images in an older format. Each image converts on first use or on request. |
| **Sandboxes**            | Not synced. Archived container sandboxes are imported one at a time as persistent sandboxes.                          |

## Contents

- [Get the migration summary](#get-the-migration-summary)
- [List Daytona v0 sandboxes](#list-daytona-v0-sandboxes)
- [Import a Daytona v0 sandbox](#import-a-daytona-v0-sandbox)
- [Permissions](#permissions)

## Get the migration summary

Get a summary of what the migration brought into the organization's default project. The summary reports whether the organization was migrated from Daytona v0 and counts the API keys, container registries, and images from Daytona v0 snapshots in the default project. Images are counted separately by whether they are converted to the current format. The summary also counts the Daytona v0 sandboxes imported so far.

**API:**

```bash
curl 'https://api.daytona.com/migration/v0/summary' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

**Response:**

```json
{
  "from_v0": true,
  "api_keys": 3,
  "registries": 1,
  "images_to_convert": 4,
  "images_converted": 2,
  "sandboxes_imported": 5,
  "personal": false
}
```

> **Notes:**
>
> - **Prerequisites:** The API key must belong to the organization's default project.

## List Daytona v0 sandboxes

List the organization's Daytona v0 sandboxes, one page at a time. Daytona reads the list from Daytona v0 on each request, so it reflects the current state of each sandbox. Each entry reports whether the sandbox can be imported now and, when it cannot, why. A sandbox that was already imported carries the ID of the sandbox the import created.

1. Go to [Daytona Sandboxes ↗](https://app.daytona.com/dashboard/sandboxes?version=v0)
2. Select the default project
3. Select **Daytona v0** in the version toggle

The version toggle appears only for an organization migrated from Daytona v0.

**API:**

```bash
curl 'https://api.daytona.com/migration/v0/sandboxes?limit=100' \
  --header 'Authorization: Bearer YOUR_API_KEY'

# Pass next_cursor from the previous page to get the next one
curl 'https://api.daytona.com/migration/v0/sandboxes?limit=100&cursor={nextCursor}' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

**Response:**

```json
{
  "sandboxes": [
    {
      "v0_id": "0b6c5c43-7a52-4c1f-9a42-3f0c3d7f2a11",
      "name": "data-pipeline",
      "status": "archived",
      "class": "container",
      "importable": true,
      "last_backup_at": "2026-10-14T09:21:07Z",
      "labels": { "team": "data" },
      "cpu": 2,
      "memory_gib": 4,
      "disk_gib": 10
    }
  ],
  "next_cursor": null
}
```

| **Field** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

> **Notes:**
>
> - **Prerequisites:** The API key must belong to the organization's default project.
> - **Results:** The reason field is present only when importable is `false`. The set of reason values is open, so handle a reason value that you do not recognize. The imported_sandbox_id field is present only while the sandbox that the import created exists.
> - **Polling:** A page can hold fewer entries than limit and not be the last, so read until next_cursor is `null`.

## Import a Daytona v0 sandbox

Import an archived Daytona v0 sandbox as a new persistent sandbox in the default project. The import registers the sandbox's last Daytona v0 backup as an image, converts the image to the current format, and creates the sandbox from it in the default project's region. The new sandbox waits in the queued state until the conversion finishes. The original Daytona v0 sandbox keeps working and is labeled with the ID of the sandbox the import created.

A repeat import of the same sandbox returns the existing import instead of creating another sandbox, unless the request forces a new import. When the sandbox an earlier import created was deleted or failed, the next import creates a new one.

1. Go to [Daytona Sandboxes ↗](https://app.daytona.com/dashboard/sandboxes?version=v0) and select **Daytona v0** in the version toggle
2. Click **Import** on the row of an importable sandbox
3. Click **Import** to confirm

**API:**

```bash
curl 'https://api.daytona.com/migration/v0/sandboxes/{v0Id}/import' \
  --request POST \
  --header 'Authorization: Bearer YOUR_API_KEY'

# force creates another sandbox even when a live import exists
curl 'https://api.daytona.com/migration/v0/sandboxes/{v0Id}/import' \
  --request POST \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "force": true
}'
```

**Response:**

```json
{
  "sandbox_id": "sbx_4kQm9TzVb2LxWp7R",
  "image_id": "img_7fJk2mQpXv9dLc3RtY",
  "status": "queued",
  "existing": false,
  "v0_labeled": true,
  "warnings": [
    "env vars not carried (sandbox secrets on Daytona v0; set them on the imported sandbox): OPENAI_API_KEY"
  ],
  "secret_env_vars": ["OPENAI_API_KEY"]
}
```

| **Field** | **Description** |
| --- | --- |
| `force` | Creates another sandbox even when a live import of the sandbox exists.<br />**Default:** `false` |
| `v0_id` | Sets the Daytona v0 sandbox to import.<br />**Format:** a Daytona v0 sandbox ID, a UUID<br />**Example:** `0b6c5c43-7a52-4c1f-9a42-3f0c3d7f2a11` |

> **Notes:**
>
> - **Prerequisites:** The API key must belong to the organization's default project. The Daytona v0 sandbox must be an archived container sandbox with a completed backup.
> - **Effects:** The imported sandbox starts without the variables in secret_env_vars, so set them on it.
> - **Results:** A new import has the `queued` status while its image converts.
> - **Recovery:** When v0_labeled is `false`, repeat the call to set the label again.

The import carries the following settings from the Daytona v0 sandbox to the new sandbox, and reports every dropped setting in the import warnings:

| **Setting**                                         | **Import behavior**                                                                                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**                                            | Kept when it is a valid sandbox name; otherwise the sandbox gets a generated name.                                                                                 |
| **Environment variables**                           | Kept, except reserved or invalid names, values over 64 KiB, and values that contain a NUL byte. Variables backed by a Daytona v0 sandbox secret are not carried. |
| **Labels**                                          | Kept, except labels Daytona v2 refuses and labels beyond the per-sandbox label limit. The `daytona.io/migrated-to` label is not copied.                          |
| **CPU, memory, and disk**                           | Kept, rounded up to whole units. Values above the per-sandbox limit are lowered to it.                                                                             |
| **OS user**                                         | Kept when it is a valid user name; otherwise the sandbox runs as the image's default user.                                                                         |
| **Auto-stop interval**                              | Becomes an idle timeout that stops the sandbox. An auto-stop interval of `0` disables the idle timeout.                                                            |
| **Network restrictions**                            | Become a [network policy](../python-sdk/network-limits.md) that blocks all egress except the allowed CIDRs and domains. Refused entries and entries over the limit are dropped. |
| **Auto-archive and auto-delete intervals**          | Not carried. Daytona v2 has no archive state and no delete-after-stop timer.                                                                                       |
| **Volumes, sandbox ID, preview URLs, memory state** | Not carried.                                                                                                                                                        |

## Permissions

Migration uses the sandbox permissions of the organization's default project, which you can grant either to an [organization role](../python-sdk/organizations.md#roles) or to an [API key](../python-sdk/api-keys.md).

An import requires an API key for the default project.

| **Permission**        | **Grants**                                              |
| --------------------- | ------------------------------------------------------- |
| **`read:sandboxes`**  | Get the migration summary and list Daytona v0 sandboxes |
| **`write:sandboxes`** | Import Daytona v0 sandboxes                             |
