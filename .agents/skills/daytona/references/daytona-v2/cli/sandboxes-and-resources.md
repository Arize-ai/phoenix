# Sandboxes and resources

Reference for the daytona cpu-type, image, mac-model, region, reservation, sandbox, snapshot, and volume commands.

## Contents

- [Commands](#commands)
- [daytona cpu-type](#daytona-cpu-type)
- [daytona image](#daytona-image)
- [daytona mac-model](#daytona-mac-model)
- [daytona region](#daytona-region)
- [daytona reservation](#daytona-reservation)
- [daytona sandbox](#daytona-sandbox)
- [daytona snapshot](#daytona-snapshot)
- [daytona volume](#daytona-volume)

## Commands

This page documents the following commands. Global flags that apply to every command are listed under [`daytona`](./README.md#daytona).

| Command | Description |
| :------ | :---------- |
| [`daytona cpu-type`](#daytona-cpu-type) | Inspect the CPU type catalog |
| [`daytona image`](#daytona-image) | Manage images |
| [`daytona mac-model`](#daytona-mac-model) | Inspect the Mac model catalog |
| [`daytona region`](#daytona-region) | Inspect regions |
| [`daytona reservation`](#daytona-reservation) | Reserve dedicated Macs for macOS sandboxes |
| [`daytona sandbox`](#daytona-sandbox) | Create and operate sandboxes |
| [`daytona snapshot`](#daytona-snapshot) | Manage snapshots |
| [`daytona volume`](#daytona-volume) | Manage volumes |

## daytona cpu-type

Inspect the CPU type catalog

```shell
daytona cpu-type
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona cpu-type list`](#daytona-cpu-type-list) | List CPU types |

### daytona cpu-type list

List CPU types

List CPU types from the CPU catalog.

With --region, also show which types are available in that region:
AVAILABLE is "exact" when the requested type is available, "fallback" when a
higher tier of the same architecture serves it, and "-" when nothing does.

```shell
daytona cpu-type list [flags]
```

__Examples__

```shell
daytona cpu-type list
daytona cpu-type list --region region-a
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--region` |  | `REGION` |  | region slug: show availability from GET /cpu-catalog |

## daytona image

Manage images

```shell
daytona image
```

__Examples__

```shell
daytona image create my-base --ref python:3.12
daytona image list --all
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona image build`](#daytona-image-build) | Build an image from a Dockerfile context |
| [`daytona image capture`](#daytona-image-capture) | Capture a sandbox filesystem as an image |
| [`daytona image create`](#daytona-image-create) | Import an image from a registry ref |
| [`daytona image delete`](#daytona-image-delete) | Delete an image |
| [`daytona image get`](#daytona-image-get) | Get one image |
| [`daytona image list`](#daytona-image-list) | List images |
| [`daytona image logs`](#daytona-image-logs) | Read image build logs |
| [`daytona image promote`](#daytona-image-promote) | Name an anonymous image, making it permanent |

### daytona image build

Build an image from a Dockerfile context

Build an image from a Dockerfile context: a directory, or a tar file uploaded as is.
A directory is uploaded without what its ignore file excludes, with Docker's rules: \<Dockerfile\>.dockerignore
next to the Dockerfile when it exists, else .dockerignore at the context root. The Dockerfile and the
ignore file are always sent. The 1 GiB context limit counts what is uploaded.
A name may not start with a resource id prefix (img_, snap_, sbx_, vol_, fn_): 400 IMAGE_NAME_RESERVED.

```shell
daytona image build <name> [flags]
```

__Examples__

```shell
daytona image build my-base --dockerfile Dockerfile --context .
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--context` |  | `string` |  | path to the build context tar or directory |
| `--dockerfile` |  | `string` |  | path to the Dockerfile inside the context (default Dockerfile) |
| `--file` | `-f` | `PATH` |  | JSON object \{"name", "region_id", "cpu_arch", "dockerfile", "context"\} (strings) from a file (or - for stdin); explicit flags override its fields |
| `--no-wait` |  | `bool` |  | return once the server accepts the operation instead of waiting for it to finish |
| `--region` |  | `REGION` |  | region to build the image in (default: the project's, then the organization's, then the platform's) |
| `--timeout` |  | `DURATION` | `10m` | how long to wait for the operation to finish (Go duration); the server keeps working after it |

### daytona image capture

Capture a sandbox filesystem as an image

Capture only a sandbox disk as an image. For memory capture, use `daytona snapshot create`.
A macOS sandbox must be persistent and stopped; the capture answers DISK_NOT_READY while its disk is not ready yet (retry later).
Requires write:images and write:sandboxes.
A name may not start with a resource id prefix (img_, snap_, sbx_, vol_, fn_): 400 IMAGE_NAME_RESERVED.
A --name that already exists answers 409 IMAGE_NAME_TAKEN.

```shell
daytona image capture <sandbox> [flags]
```

__Examples__

```shell
daytona image capture <sandbox> --name saved-image
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--name` |  | `string` |  | image name |
| `--no-wait` |  | `bool` |  | return once the server accepts the operation instead of waiting for it to finish |
| `--timeout` |  | `DURATION` | `10m` | how long to wait for the operation to finish (Go duration); the server keeps working after it |

### daytona image create

Import an image from a registry ref

A name may not start with a resource id prefix (img_, snap_, sbx_, vol_, fn_): 400 IMAGE_NAME_RESERVED.
A name that already exists for different content or import options (ref, region, CPU architecture) answers
409 IMAGE_NAME_TAKEN and changes nothing; repeating an identical import returns the existing image.

```shell
daytona image create <name> [flags]
```

__Examples__

```shell
daytona image create my-base --ref python:3.12
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--file` | `-f` | `PATH` |  | JSON request body from a file (or - for stdin); explicit flags override its fields |
| `--no-wait` |  | `bool` |  | return once the server accepts the operation instead of waiting for it to finish |
| `--ref` |  | `string` |  | registry ref to import |
| `--region` |  | `REGION` |  | region to create the image in (default: the project's, then the organization's, then the platform's) |
| `--timeout` |  | `DURATION` | `10m` | how long to wait for the operation to finish (Go duration); the server keeps working after it |

### daytona image delete

Delete an image

Delete an image by id or name; the acknowledgement repeats the reference as given.

```shell
daytona image delete <id-or-name>
```

__Examples__

```shell
daytona image delete <id-or-name> --yes
```

### daytona image get

Get one image

```shell
daytona image get <id>
```

__Examples__

```shell
daytona image get <id>
```

### daytona image list

List images

--platform true lists the platform images every project can boot; --platform any adds them to the project's own.

```shell
daytona image list [flags]
```

__Examples__

```shell
daytona image list --limit 20
daytona image list --platform true
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--anonymous` |  | `string` |  | true lists only anonymous images, false only named ones (the default) |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `100` | max items to return, 1 to 200 |
| `--name` |  | `string` |  | filter by exact image name |
| `--platform` |  | `string` |  | platform images: true (only platform images)\|false (only the project's, the default)\|any (both) |
| `--region` |  | `REGION` |  | list only the images available in this region or a region inside it (region_id or region_ids; default: every region); a page can then hold fewer than --limit items |
| `--sandbox` |  | `string` |  | filter captures by source sandbox id |

### daytona image logs

Read image build logs

Read image build logs by name or id. With --follow, table output streams the log text as it arrives;
-o json streams NDJSON, one \{"data": "..."\} object per chunk; -o yaml is not supported.

```shell
daytona image logs <id-or-name> [flags]
```

__Examples__

```shell
daytona image logs <id-or-name> --follow
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--follow` |  | `bool` |  | follow until the build finishes |
| `--timeout` |  | `DURATION` | `10m` | with --follow, how long to follow the log (Go duration); the build keeps running after it |

### daytona image promote

Name an anonymous image, making it permanent

Name an anonymous image, making it permanent (PATCH /images/\{id\}).
Promotion only: an image that already has a name answers 409 — renaming a named image is not offered.
A name may not start with a resource id prefix (img_, snap_, sbx_, vol_, fn_): 400 IMAGE_NAME_RESERVED.
A name that already exists answers 409 IMAGE_NAME_TAKEN.

```shell
daytona image promote <image> <name>
```

__Examples__

```shell
daytona image promote img_abc123 saved-image
```

## daytona mac-model

Inspect the Mac model catalog

```shell
daytona mac-model
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona mac-model list`](#daytona-mac-model-list) | List registered Mac models |

### daytona mac-model list

List registered Mac models

Find regions with daytona region list (GET /regions).
With --region, also show how many Macs of each model a purchase can reserve now (AVAILABLE) and the price of one Mac-hour and one 24-hour period.

```shell
daytona mac-model list [flags]
```

__Examples__

```shell
daytona mac-model list
daytona mac-model list --region '<region>'
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--region` |  | `REGION` |  | region slug: also show free Macs and prices from GET /mac-catalog |

## daytona region

Inspect regions

```shell
daytona region
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona region list`](#daytona-region-list) | List regions |

### daytona region list

List regions

List your regions, indenting each region under its parent.
Columns are NAME, ID, PRICE MULTIPLIER and AVAILABLE.
AVAILABLE says whether a create can name the region; a create can still fail for lack of capacity.
PRICE MULTIPLIER is the region's rate relative to the base price. It needs a login with read:billing in the selected organization, and shows - otherwise (null in JSON and YAML).

```shell
daytona region list
```

__Examples__

```shell
daytona region list
```

## daytona reservation

Reserve dedicated Macs for macOS sandboxes

A reservation is one physical Mac of a named model, paid per 24-hour period. Set sandbox sizes when creating each sandbox.
Find regions with daytona region list (GET /regions), and models and prices with daytona mac-model list --region '\<region\>'.

```shell
daytona reservation
```

__Examples__

```shell
daytona mac-model list
daytona reservation create --region '<region>' --model '<model>' --idempotency-key nightly-mac
daytona reservation create --region '<region>' --count 3
daytona reservation get RESERVATION_ID
daytona reservation list
daytona reservation renew RESERVATION_ID
daytona reservation update RESERVATION_ID --auto-renew=false
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona reservation create`](#daytona-reservation-create) | Reserve a Mac |
| [`daytona reservation get`](#daytona-reservation-get) | Get one Mac reservation |
| [`daytona reservation list`](#daytona-reservation-list) | List Mac reservations |
| [`daytona reservation renew`](#daytona-reservation-renew) | Charge and renew a Mac reservation for another period |
| [`daytona reservation update`](#daytona-reservation-update) | Turn a Mac reservation's auto-renew on or off |

### daytona reservation create

Reserve a Mac

Reserve a Mac of one model in a region (POST /reservations). The SDK twin is reservations.create(…).
Find regions with daytona region list (GET /regions), and models and prices with daytona mac-model list --region '\<region\>'.
With --count, reserve several Macs of one model in one request (POST /reservations/bulk). The SDK twin is reservations.createBulk(…).
Without --model the region's default model is reserved; an unavailable model is never upgraded to another one.
Without --idempotency-key the CLI sends a fresh key; pass your own to retry without buying a second Mac.
Purchases require confirmation; use --yes to consent without a prompt. --dry-run reserves nothing and needs no confirmation.

```shell
daytona reservation create [flags]
```

__Examples__

```shell
daytona reservation create --region '<region>' --model '<model>' --idempotency-key nightly-mac
daytona reservation create --region '<region>' --model '<model>' --count 3 --idempotency-key nightly-macs
daytona reservation create --region '<region>' --count 5 --min-count 2
daytona reservation create --region '<region>' --model '<model>' --count 3 --dry-run
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--auto-renew` |  | `bool` |  | renew while a sandbox is active; create-macos requires --reservation new |
| `--count` |  | `N` |  | how many Macs to reserve, 1 to 100 (calls POST /reservations/bulk; default: one Mac through POST /reservations) |
| `--dry-run` |  | `bool` |  | print the price and the free Macs from GET /mac-catalog and reserve nothing |
| `--file` | `-f` | `PATH` |  | JSON request body from a file (or - for stdin); explicit flags override its fields |
| `--idempotency-key` |  | `KEY` |  | a retry with the same key returns the first reservation instead of buying another (default: a fresh key per invocation) |
| `--min-count` |  | `M` |  | the fewest Macs to accept when fewer than --count are free or fit under the organization's Mac reservation limit (default: --count, all or nothing) |
| `--model` |  | `MODEL` |  | Mac model slug from mac-model list (default: the region's default model; no upgrade) |
| `--region` |  | `REGION` |  | region whose Macs to reserve (required unless region_id is in --file) |

### daytona reservation get

Get one Mac reservation

Get one Mac reservation (GET /reservations/\{id\}).

```shell
daytona reservation get ID
```

__Examples__

```shell
daytona reservation get RESERVATION_ID
```

### daytona reservation list

List Mac reservations

List a page of the organization's Mac reservations (GET /reservations).

```shell
daytona reservation list [flags]
```

__Examples__

```shell
daytona reservation list --limit 25
daytona reservation list --all
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `100` | max items to return, 1 to 200 |

### daytona reservation renew

Charge and renew a Mac reservation for another period

Charge the next period of an active reservation (POST /reservations/\{id\}/renew); period_end moves out by one period on the same Mac. The SDK twin is reservations.renew(…).
Asks for confirmation at a terminal; off a terminal pass --yes (or set DAYTONA_YES=1).
Without --idempotency-key the CLI sends a fresh key; pass your own to retry without paying for a second period.

```shell
daytona reservation renew ID [flags]
```

__Examples__

```shell
daytona reservation renew RESERVATION_ID --idempotency-key renew-RESERVATION_ID-2 --yes
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--idempotency-key` |  | `KEY` |  | a retry with the same key returns the reservation without charging another period (default: a fresh key per invocation) |

### daytona reservation update

Turn a Mac reservation's auto-renew on or off

Turn auto-renew on or off (PATCH /reservations/\{id\}). An auto-renewing reservation renews near period_end only while a sandbox is in use or paused on it; stopped sandboxes do not renew it. With auto-renew off, the reservation ends at period_end, and its paused sandboxes are stopped with their disks before then.
Enabling auto-renew commits future charges: asks for confirmation at a terminal; off a terminal pass --yes (or set DAYTONA_YES=1). Disabling it needs no confirmation.

```shell
daytona reservation update ID [flags]
```

__Examples__

```shell
daytona reservation update RESERVATION_ID --auto-renew=false
daytona reservation update RESERVATION_ID --auto-renew=true
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--auto-renew` |  | `bool` |  | renew near period_end while a sandbox is in use or paused on the reservation; false lets it end at period_end |

## daytona sandbox

Create and operate sandboxes

Create sandboxes, inspect their lifecycle, and run commands inside them.

```shell
daytona sandbox
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona sandbox cp`](#daytona-sandbox-cp) | Copy files to or from a sandbox |
| [`daytona sandbox create`](#daytona-sandbox-create) | Create a sandbox from an image |
| [`daytona sandbox create-from-snapshot`](#daytona-sandbox-create-from-snapshot) | Create a sandbox from a snapshot |
| [`daytona sandbox create-macos`](#daytona-sandbox-create-macos) | Create a macOS sandbox on a reserved Mac |
| [`daytona sandbox delete`](#daytona-sandbox-delete) | Delete a sandbox |
| [`daytona sandbox docker`](#daytona-sandbox-docker) | Inspect Docker Engine inside a sandbox |
| [`daytona sandbox exec`](#daytona-sandbox-exec) | Run a command inside a sandbox |
| [`daytona sandbox fork`](#daytona-sandbox-fork) | Fork a sandbox |
| [`daytona sandbox get`](#daytona-sandbox-get) | Get one sandbox |
| [`daytona sandbox list`](#daytona-sandbox-list) | List sandboxes |
| [`daytona sandbox logs`](#daytona-sandbox-logs) | Read sandbox logs |
| [`daytona sandbox pause`](#daytona-sandbox-pause) | Pause a sandbox |
| [`daytona sandbox port`](#daytona-sandbox-port) | Inspect sandbox ports, expose them and mint preview URLs |
| [`daytona sandbox process`](#daytona-sandbox-process) | Inspect and control sandbox processes |
| [`daytona sandbox resume`](#daytona-sandbox-resume) | Resume a sandbox |
| [`daytona sandbox search`](#daytona-sandbox-search) | Search sandboxes across regions |
| [`daytona sandbox ssh`](#daytona-sandbox-ssh) | Open SSH through the sandbox gateway |
| [`daytona sandbox start`](#daytona-sandbox-start) | Start a sandbox |
| [`daytona sandbox stop`](#daytona-sandbox-stop) | Stop a sandbox |
| [`daytona sandbox update`](#daytona-sandbox-update) | Update sandbox labels or lifecycle |
| [`daytona sandbox usage`](#daytona-sandbox-usage) | Read sandbox usage |
| [`daytona sandbox wait`](#daytona-sandbox-wait) | Wait for a sandbox status |

### daytona sandbox cp

Copy files to or from a sandbox

Copies one file over a pre-signed toolbox URL minted by the API (POST /sandboxes/\{id\}/files/sign). A file copied onto an existing sandbox directory lands inside it, as with POSIX cp; a local directory needs -r. With -r, destination handling matches POSIX cp -r: if the destination ends with / (or is an existing local directory on download), the source directory is copied into it as \<dest\>/\<basename(src)\>; otherwise the destination path is the new directory itself.

```shell
daytona sandbox cp <src> <dst> [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--recursive` | `-r` | `bool` |  | copy a directory by uploading one tar archive, then extracting it remotely |

### daytona sandbox create

Create a sandbox from an image

Create a Linux sandbox from an image (POST /sandboxes). The SDK twin is create(\[image\], …).
Without --image the sandbox boots the platform default image.

```shell
daytona sandbox create [flags]
```

__Examples__

```shell
daytona sandbox create
daytona sandbox create --image py312
daytona sandbox create --image py312 --name example-user --server-wait 60s --create-ttl 1h
daytona sandbox create --image py312 --lifecycle-timeout 2h --on-lifecycle-timeout delete
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--allow-cidr` |  | `stringArray` |  | network policy: allowed IPv4 address or CIDR, any port (repeatable; needs --block-all or --allow-domain) |
| `--allow-domain` |  | `stringArray` |  | network policy: allowed hostname or \*.wildcard (repeatable; implies --block-all) |
| `--block-all` |  | `bool` |  | network policy: deny all egress not explicitly allowed |
| `--cpu` |  | `float` |  | guaranteed CPU in cores (1 core = 2 vCPUs) |
| `--cpu-arch` |  | `string` |  | CPU architecture constraint |
| `--cpu-max` |  | `float` |  | CPU limit in cores, a multiple of 0.5 (boot shape and CPU ceiling); equal to --cpu for a fixed shape |
| `--cpu-type` |  | `string` |  | CPU type constraint |
| `--create-ttl` |  | `DURATION` |  | deadline (Go duration) for the sandbox to reach running, queued or booting, before the server deletes it; max = the server's maximum (server default 1h) |
| `--disk` |  | `int32` |  | scratch disk in MiB |
| `--disk-max` |  | `int32` |  | scratch disk limit in MiB; equal to --disk for a fixed shape |
| `--env` |  | `stringArray` |  | environment variable KEY=VALUE (repeatable) |
| `--file` | `-f` | `PATH` |  | JSON request body from a file (or - for stdin); explicit flags override its fields |
| `--idempotency-key` |  | `string` |  | idempotency key |
| `--idle-timeout` |  | `DURATION` |  | idle time (Go duration, at least 1m) until --on-idle-timeout fires |
| `--image` |  | `string` |  | image name or img_… id (default: the platform default image) |
| `--label` |  | `stringArray` |  | label KEY=VALUE (repeatable) |
| `--lifecycle-timeout` |  | `DURATION` |  | wall-clock lifetime (Go duration, e.g. 2h) until --on-lifecycle-timeout fires; re-arms on every start |
| `--memory` |  | `int32` |  | memory in MiB |
| `--memory-max` |  | `int32` |  | memory limit in MiB; equal to --memory for a fixed shape |
| `--name` |  | `string` |  | sandbox name |
| `--no-wait` |  | `bool` |  | return once the server accepts the operation instead of waiting for it to finish |
| `--on-idle-timeout` |  | `ACTION` |  | action when --idle-timeout elapses: delete |
| `--on-lifecycle-timeout` |  | `ACTION` |  | action when --lifecycle-timeout elapses: delete |
| `--port` |  | `stringArray` |  | platform port mapping as PORT or PORT/PROTO (repeatable); not a preview URL (see: daytona sandbox port expose) |
| `--region` |  | `REGION` |  | region to create the sandbox in (default: the project's, then the organization's, then earth) |
| `--secret` |  | `stringArray` |  | secret name to attach (repeatable) |
| `--server-wait` |  | `DURATION` |  | how long the server holds the create response for the sandbox to reach running (Go duration; 0s answers at once; server default 3s); the CLI still waits for running unless --no-wait |
| `--spot` |  | `bool` |  | use the spot tier |
| `--timeout` |  | `DURATION` | `10m` | how long to wait for the operation to finish (Go duration); the server keeps working after it |
| `--user` |  | `string` |  | default sandbox OS user |
| `--volume` |  | `stringArray` |  | volume mount VOLUME:MOUNT_PATH\[:SUBPATH\]\[:ro\] (repeatable; a trailing :ro mounts read-only) |

### daytona sandbox create-from-snapshot

Create a sandbox from a snapshot

Create a Linux sandbox from a snapshot (POST /sandboxes/from-snapshot). The SDK twin is create_from_snapshot(snapshot, …).
Resources come from the snapshot; only name, labels, ports, lifecycle, server-wait and create-ttl apply.

```shell
daytona sandbox create-from-snapshot <snapshot-name-or-snap_id> [flags]
```

__Examples__

```shell
daytona sandbox create-from-snapshot after-setup --name resumed
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--create-ttl` |  | `DURATION` |  | deadline (Go duration) for the sandbox to reach running, queued or booting, before the server deletes it; max = the server's maximum (server default 1h) |
| `--file` | `-f` | `PATH` |  | JSON request body from a file (or - for stdin); explicit flags override its fields |
| `--idempotency-key` |  | `string` |  | idempotency key |
| `--idle-timeout` |  | `DURATION` |  | idle time (Go duration, at least 1m) until --on-idle-timeout fires |
| `--label` |  | `stringArray` |  | label KEY=VALUE (repeatable) |
| `--lifecycle-timeout` |  | `DURATION` |  | wall-clock lifetime (Go duration, e.g. 2h) until --on-lifecycle-timeout fires; re-arms on every start |
| `--name` |  | `string` |  | sandbox name |
| `--no-wait` |  | `bool` |  | return once the server accepts the operation instead of waiting for it to finish |
| `--on-idle-timeout` |  | `ACTION` |  | action when --idle-timeout elapses: delete |
| `--on-lifecycle-timeout` |  | `ACTION` |  | action when --lifecycle-timeout elapses: delete |
| `--port` |  | `stringArray` |  | platform port mapping as PORT or PORT/PROTO (repeatable); not a preview URL (see: daytona sandbox port expose) |
| `--region` |  | `REGION` |  | region to create the sandbox in (default: the project's, then the organization's, then earth) |
| `--server-wait` |  | `DURATION` |  | how long the server holds the create response for the sandbox to reach running (Go duration; 0s answers at once; server default 3s); the CLI still waits for running unless --no-wait |
| `--timeout` |  | `DURATION` | `10m` | how long to wait for the operation to finish (Go duration); the server keeps working after it |

### daytona sandbox create-macos

Create a macOS sandbox on a reserved Mac

Create a macOS sandbox on a reserved Mac (POST /sandboxes/macos). The SDK twin is create_macos(image, …).
Each omitted size uses the Mac model's default size (DEFAULT_SIZE in mac-model list); a create from a captured image without --disk gets the image's disk size.
Stop and pause need --persistent. A start can run on any Mac of the organization; after a start on a different Mac, iCloud asks the user to sign in again. Delete erases the disk. A reservation end or a Mac failure stops a persistent sandbox that has started and never deletes it; a Mac failure can lose its most recent writes.

```shell
daytona sandbox create-macos [flags]
```

__Examples__

```shell
daytona sandbox create-macos --image base-macos
daytona sandbox create-macos --image base-macos --reservation RESERVATION_ID --cores 10 --memory 16384 --disk 163840 --persistent
daytona sandbox create-macos --image base-macos --block-all --allow-domain example.com
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--allow-cidr` |  | `stringArray` |  | network policy: allowed IPv4 address or CIDR, any port (repeatable; needs --block-all or --allow-domain) |
| `--allow-domain` |  | `stringArray` |  | network policy: allowed hostname or \*.wildcard (repeatable; implies --block-all) |
| `--auto-renew` |  | `bool` |  | renew while a sandbox is active; create-macos requires --reservation new |
| `--block-all` |  | `bool` |  | network policy: deny all egress not explicitly allowed |
| `--cores` |  | `N` |  | CPU cores, minimum 4; a Mac core is one CPU of the Mac (default: the Mac model's default size) |
| `--create-ttl` |  | `DURATION` |  | deadline (Go duration) for the sandbox to reach running, queued or booting, before the server deletes it; max = the server's maximum (server default 1h) |
| `--disk` |  | `MIB` |  | whole sandbox disk in MiB, macOS included, minimum 81920 (default: the Mac model's default size, or the image's disk size for a captured image) |
| `--env` |  | `stringArray` |  | environment variable KEY=VALUE (repeatable) |
| `--file` | `-f` | `PATH` |  | JSON request body from a file (or - for stdin); explicit flags override its fields |
| `--idempotency-key` |  | `string` |  | idempotency key |
| `--idle-timeout` |  | `DURATION` |  | idle time (Go duration, at least 1m) until --on-idle-timeout fires |
| `--image` |  | `string` |  | image name or img_… id (required) |
| `--label` |  | `stringArray` |  | label KEY=VALUE (repeatable) |
| `--lifecycle-timeout` |  | `DURATION` |  | wall-clock lifetime (Go duration, e.g. 2h) until --on-lifecycle-timeout fires; re-arms on every start |
| `--memory` |  | `MIB` |  | memory in MiB, minimum 4096 (default: the Mac model's default size) |
| `--name` |  | `string` |  | sandbox name |
| `--no-wait` |  | `bool` |  | return once the server accepts the operation instead of waiting for it to finish |
| `--on-idle-timeout` |  | `ACTION` |  | action when --idle-timeout elapses: delete, or stop with --persistent |
| `--on-lifecycle-timeout` |  | `ACTION` |  | action when --lifecycle-timeout elapses: delete, or stop with --persistent |
| `--persistent` |  | `bool` |  | keep the disk and machine across stop/start on any Mac of the organization, and memory across pause/resume; delete erases the disk. A reservation end or a Mac failure stops a persistent sandbox that has started and never deletes it, though a Mac failure can lose its most recent writes; an ephemeral sandbox ends with its reservation or a failed Mac. |
| `--port` |  | `stringArray` |  | platform port mapping as PORT or PORT/PROTO (repeatable); not a preview URL (see: daytona sandbox port expose) |
| `--region` |  | `REGION` |  | region to create the sandbox in (default: the project's, then the organization's, then earth) |
| `--reservation` |  | `ID\|new` |  | target an existing reservation by ID; new buys the cheapest fitting model; omitted may buy if none fits (confirmation required unless --yes) |
| `--secret` |  | `stringArray` |  | secret name to attach (repeatable) |
| `--server-wait` |  | `DURATION` |  | how long the server holds the create response for the sandbox to reach running (Go duration; 0s answers at once; server default 3s); the CLI still waits for running unless --no-wait |
| `--timeout` |  | `DURATION` | `10m` | how long to wait for the operation to finish (Go duration); the server keeps working after it |
| `--volume` |  | `stringArray` |  | disk volume mount VOLUME:MOUNT_PATH\[:SUBPATH\] (repeatable; read-write, a macOS sandbox cannot mount a volume read-only) |

### daytona sandbox delete

Delete a sandbox

```shell
daytona sandbox delete <id> [flags]
```

__Examples__

```shell
daytona sandbox delete <id>
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--no-wait` |  | `bool` |  | return once the server accepts the operation instead of waiting for it to finish |
| `--timeout` |  | `DURATION` | `10m` | how long to wait for the operation to finish (Go duration); the server keeps working after it |

### daytona sandbox docker

Inspect Docker Engine inside a sandbox

```shell
daytona sandbox docker
```

__Examples__

```shell
daytona sandbox docker status <id>
daytona sandbox docker status <id> --wait
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona sandbox docker status`](#daytona-sandbox-docker-status) | Read Docker Engine status inside a sandbox |

### daytona sandbox docker status

Read Docker Engine status inside a sandbox

--wait polls until Docker is ready; if --timeout is not set, the command uses the SDK default wait budget of 60s.

```shell
daytona sandbox docker status <sandbox-id> [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--timeout` |  | `DURATION` | `60s` | with --wait, how long to wait for Docker (Go duration) |
| `--wait` |  | `bool` |  | wait until Docker reaches ready |

### daytona sandbox exec

Run a command inside a sandbox

Starts a sandbox process, streams its bytes, and exits with the process exit code (127 if the command cannot start). Interrupting the CLI signals the process with INT, escalating to KILL after 1s. --timeout only limits the client wait; --execution-timeout limits remote execution.

```shell
daytona sandbox exec <sandbox-id> -- <command> [args...] [flags]
```

__Examples__

```shell
daytona sandbox exec sbx-123 -- python -V
printf hi | daytona sandbox exec sbx-123 -- cat
daytona sandbox exec sbx-123 --tty -- bash
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--cwd` |  | `string` |  | working directory inside the sandbox |
| `--env` |  | `stringArray` |  | environment variable to set (KEY=VALUE, repeatable) |
| `--execution-timeout` |  | `duration` |  | server-side execution deadline (positive Go duration, rounded up to milliseconds) |
| `--timeout` |  | `DURATION` | `10m` | how long the command may run before the CLI stops waiting (Go duration; exit 8) |
| `--tty` |  | `bool` |  | run the command in a PTY sized to this terminal and attach interactively (1-65535 columns and rows; a Windows sandbox refuses more than 32767) |
| `--user` |  | `string` |  | sandbox OS user to run the command as |

### daytona sandbox fork

Fork a sandbox

```shell
daytona sandbox fork <id> [flags]
```

__Examples__

```shell
daytona sandbox fork <id>
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--name` |  | `string` |  | fork name |
| `--no-wait` |  | `bool` |  | return once the server accepts the operation instead of waiting for it to finish |
| `--timeout` |  | `DURATION` | `10m` | how long to wait for the operation to finish (Go duration); the server keeps working after it |

### daytona sandbox get

Get one sandbox

Get one sandbox by id.

```shell
daytona sandbox get <id>
```

__Examples__

```shell
daytona sandbox get <id>
```

### daytona sandbox list

List sandboxes

List sandboxes across regions.

```shell
daytona sandbox list [flags]
```

__Examples__

```shell
daytona sandbox list
daytona sandbox list --region region-a --limit 20
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `100` | max items to return, 1 to 200 |
| `--region` |  | `REGION` |  | list only the sandboxes in this region or a region inside it (default: every region); a page can then hold fewer than --limit items |

### daytona sandbox logs

Read sandbox logs

```shell
daytona sandbox logs <id> [flags]
```

__Examples__

```shell
daytona sandbox logs <id>
daytona sandbox logs <id> --entrypoint
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--entrypoint` |  | `bool` |  | read entrypoint logs |
| `--follow` |  | `bool` |  | poll for new log bytes until interrupted |

### daytona sandbox pause

Pause a sandbox

```shell
daytona sandbox pause <id> [flags]
```

__Examples__

```shell
daytona sandbox pause <id>
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--no-wait` |  | `bool` |  | return once the server accepts the operation instead of waiting for it to finish |
| `--timeout` |  | `DURATION` | `10m` | how long to wait for the operation to finish (Go duration); the server keeps working after it |

### daytona sandbox port

Inspect sandbox ports, expose them and mint preview URLs

```shell
daytona sandbox port
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona sandbox port endpoints`](#daytona-sandbox-port-endpoints) | List a sandbox's exposed ports with their preview URLs and visibility |
| [`daytona sandbox port expose`](#daytona-sandbox-port-expose) | Expose a sandbox port as a preview URL, privately or publicly |
| [`daytona sandbox port list`](#daytona-sandbox-port-list) | List listening ports inside a sandbox |
| [`daytona sandbox port preview-url`](#daytona-sandbox-port-preview-url) | Mint a preview URL for a sandbox port |
| [`daytona sandbox port unexpose`](#daytona-sandbox-port-unexpose) | Remove a sandbox port's preview URL |

### daytona sandbox port endpoints

List a sandbox's exposed ports with their preview URLs and visibility

List a sandbox's exposed ports (GET /sandboxes/\{id\}/ports): each one's preview URL and whether it is public. The SDK twin is sandbox.ports.list_endpoints(). `sandbox port list` instead lists the ports listening inside the sandbox.

```shell
daytona sandbox port endpoints <sandbox-id> [flags]
```

__Examples__

```shell
daytona sandbox port endpoints <sandbox-id>
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `100` | max items to return, 1 to 200 |

### daytona sandbox port expose

Expose a sandbox port as a preview URL, privately or publicly

Expose a sandbox port as a preview URL (PUT /sandboxes/\{id\}/ports/\{port\}). The SDK twin is sandbox.ports.expose(port, public=…).
Ports are private by default: a private URL needs the token from `daytona sandbox port preview-url` in the X-Daytona-Preview-Token header, or a short-lived `preview-url --signed` link. With --public the URL needs no credential and anyone who has it can open it, until the port is made private again: exposing an exposed port again sets its visibility, so running it without --public makes a public port private. `daytona sandbox port endpoints <sandbox-id>` shows each exposed port's visibility. The sandbox daemon's ports 2280, 2281 and 22220 are never preview ports and are refused.

```shell
daytona sandbox port expose <sandbox-id> <port> [flags]
```

__Examples__

```shell
daytona sandbox port expose <sandbox-id> 8080 --public
daytona sandbox port expose <sandbox-id> 8080
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--public` |  | `bool` |  | make the preview URL reachable without any credential |

### daytona sandbox port list

List listening ports inside a sandbox

```shell
daytona sandbox port list <sandbox-id>
```

### daytona sandbox port preview-url

Mint a preview URL for a sandbox port

Without --signed, a URL for a private port needs the printed token in the X-Daytona-Preview-Token header, which a browser cannot send. For a URL that opens in a browser: --signed gives a short-lived, revocable link with the token in its hostname, and `daytona sandbox port expose <sandbox-id> <port> --public` makes the port reachable by anyone with no credential until it is made private again. The sandbox daemon's ports 2280, 2281 and 22220 are never preview ports and are refused.

```shell
daytona sandbox port preview-url <sandbox-id> <port> [flags]
```

__Examples__

```shell
daytona sandbox port preview-url <sandbox-id> 8080
daytona sandbox port preview-url <sandbox-id> 8080 --signed --ttl 5m
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--signed` |  | `bool` |  | mint a short-lived signed preview URL |
| `--ttl` |  | `DURATION` | `60s` | lifetime of a --signed preview URL (Go duration) |

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona sandbox port preview-url expire`](#daytona-sandbox-port-preview-url-expire) | Expire every signed preview URL of a sandbox |

### daytona sandbox port preview-url expire

Expire every signed preview URL of a sandbox

Expire every signed preview URL of a sandbox, on every port. Signed preview URLs created afterwards work.

```shell
daytona sandbox port preview-url expire <sandbox-id>
```

__Examples__

```shell
daytona sandbox port preview-url expire <sandbox-id>
```

### daytona sandbox port unexpose

Remove a sandbox port's preview URL

Remove a sandbox port's preview URL (DELETE /sandboxes/\{id\}/ports/\{port\}); it also works while the sandbox is being deleted. The SDK twin is sandbox.ports.unexpose(port).

```shell
daytona sandbox port unexpose <sandbox-id> <port>
```

__Examples__

```shell
daytona sandbox port unexpose <sandbox-id> 8080
```

### daytona sandbox process

Inspect and control sandbox processes

Lists, gets, waits for, signals, kills, logs, and attaches to sandbox processes.

```shell
daytona sandbox process
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona sandbox process attach`](#daytona-sandbox-process-attach) | Attach to a process websocket stream |
| [`daytona sandbox process get`](#daytona-sandbox-process-get) | Fetch one process |
| [`daytona sandbox process kill`](#daytona-sandbox-process-kill) | Send SIGKILL to a process |
| [`daytona sandbox process list`](#daytona-sandbox-process-list) | List processes in a sandbox |
| [`daytona sandbox process logs`](#daytona-sandbox-process-logs) | Read process logs |
| [`daytona sandbox process signal`](#daytona-sandbox-process-signal) | Send a signal to a process |
| [`daytona sandbox process wait`](#daytona-sandbox-process-wait) | Wait for a process to exit |

### daytona sandbox process attach

Attach to a process websocket stream

```shell
daytona sandbox process attach <sandbox-id> <process-id> [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--cursor` |  | `string` |  | replay from this cursor before the live stream |

### daytona sandbox process get

Fetch one process

```shell
daytona sandbox process get <sandbox-id> <process-id>
```

### daytona sandbox process kill

Send SIGKILL to a process

```shell
daytona sandbox process kill <sandbox-id> <process-id>
```

### daytona sandbox process list

List processes in a sandbox

```shell
daytona sandbox process list <sandbox-id> [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--kind` |  | `string` |  | filter by exec\|pty\|code\|session |
| `--name` |  | `string` |  | filter by live name |
| `--pid` |  | `int` |  | filter by OS pid |
| `--session-id` |  | `string` |  | filter by session id |
| `--state` |  | `string` |  | filter by running\|terminal\|all |

### daytona sandbox process logs

Read process logs

```shell
daytona sandbox process logs <sandbox-id> <process-id> [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--cursor` |  | `string` |  | resume from this cursor |
| `--encoding` |  | `string` | `text` | log encoding: text\|base64 |
| `--follow` |  | `bool` |  | follow the log stream with SSE |
| `--limit` |  | `int` |  | max frames to return |
| `--timeout` |  | `DURATION` | `10m` | with --follow, how long to follow the log (Go duration) |

### daytona sandbox process signal

Send a signal to a process

```shell
daytona sandbox process signal <sandbox-id> <process-id> <signal> [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--escalate-after` |  | `DURATION` |  | escalate after this duration (Go duration, e.g. 5s) |
| `--escalate-to` |  | `string` |  | signal to escalate to, e.g. KILL |

### daytona sandbox process wait

Wait for a process to exit

```shell
daytona sandbox process wait <sandbox-id> <process-id> [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--timeout` |  | `DURATION` | `10m` | how long to wait for the process to exit (Go duration) |

### daytona sandbox resume

Resume a sandbox

```shell
daytona sandbox resume <id> [flags]
```

__Examples__

```shell
daytona sandbox resume <id>
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--no-wait` |  | `bool` |  | return once the server accepts the operation instead of waiting for it to finish |
| `--timeout` |  | `DURATION` | `10m` | how long to wait for the operation to finish (Go duration); the server keeps working after it |

### daytona sandbox search

Search sandboxes across regions

The query is optional: filters alone select a set.

```shell
daytona sandbox search [query] [flags]
```

__Examples__

```shell
daytona sandbox search python
daytona sandbox search worker --status running --class linux --region region-a
daytona sandbox search --status running
daytona sandbox search sandbox-example
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--class` |  | `strings` |  | filter by class (repeatable or comma-separated) |
| `--created-end-at` |  | `string` |  | exclusive creation-time upper bound (RFC3339) |
| `--created-start-at` |  | `string` |  | inclusive creation-time lower bound (RFC3339) |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--forked-from` |  | `string` |  | filter by source sandbox id |
| `--id-prefix` |  | `string` |  | filter by sandbox id prefix |
| `--image-ref` |  | `string` |  | filter by exact image reference |
| `--image-ref-prefix` |  | `string` |  | filter by image reference prefix |
| `--label` |  | `stringArray` |  | filter by KEY=VALUE label (repeatable; commas preserved; merged with --labels, conflicting values refused) |
| `--labels` |  | `string` |  | filter by labels JSON object |
| `--last-activity-end-at` |  | `string` |  | exclusive activity-time upper bound (RFC3339) |
| `--last-activity-start-at` |  | `string` |  | inclusive activity-time lower bound (RFC3339) |
| `--limit` |  | `int` | `100` | max items to return, 1 to 200 |
| `--max-cores` |  | `float` |  | maximum CPU limit in cores (1 core = 2 vCPUs; a macOS core is one Mac CPU) |
| `--max-disk` |  | `int` |  | maximum disk in MiB |
| `--max-memory` |  | `int` |  | maximum memory in MiB |
| `--min-cores` |  | `float` |  | minimum CPU limit in cores (1 core = 2 vCPUs; a macOS core is one Mac CPU) |
| `--min-disk` |  | `int` |  | minimum disk in MiB |
| `--min-memory` |  | `int` |  | minimum memory in MiB |
| `--name-prefix` |  | `string` |  | filter by sandbox name prefix |
| `--order` |  | `string` |  | sort order |
| `--region` |  | `REGION` |  | search this region and its child regions (validated against the region catalog) |
| `--sort` |  | `string` |  | sort field |
| `--spot` |  | `bool` |  | filter by spot tier |
| `--status` |  | `strings` |  | filter by status (queued\|pending\|assigned\|booting\|running\|pausing\|paused\|stopping\|stopped\|deleting\|deleted\|failed\|lost; repeatable or comma-separated) |
| `--updated-end-at` |  | `string` |  | exclusive update-time upper bound (RFC3339) |
| `--updated-start-at` |  | `string` |  | inclusive update-time lower bound (RFC3339) |

### daytona sandbox ssh

Open SSH through the sandbox gateway

Execs the system ssh binary against the sandbox SSH gateway. CLI flags go before the sandbox id; everything after it is passed to ssh. Extra SSH flags are forwarded before the destination; any remaining arguments become the remote command.

```shell
daytona sandbox ssh [flags] <sandbox-id> [ssh-args...] [command]
```

### daytona sandbox start

Start a sandbox

```shell
daytona sandbox start <id> [flags]
```

__Examples__

```shell
daytona sandbox start <id>
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--no-wait` |  | `bool` |  | return once the server accepts the operation instead of waiting for it to finish |
| `--timeout` |  | `DURATION` | `10m` | how long to wait for the operation to finish (Go duration); the server keeps working after it |

### daytona sandbox stop

Stop a sandbox

```shell
daytona sandbox stop <id> [flags]
```

__Examples__

```shell
daytona sandbox stop <id>
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--no-wait` |  | `bool` |  | return once the server accepts the operation instead of waiting for it to finish |
| `--timeout` |  | `DURATION` | `10m` | how long to wait for the operation to finish (Go duration); the server keeps working after it |

### daytona sandbox update

Update sandbox labels or lifecycle

Update sandbox labels or lifecycle policy. Labels are replaced, not merged, except the name label:
labels.name (stamped by a named create) is kept unless the new set names it, and then it must match the sandbox name.
--file takes \{"labels": \{...\}, "lifecycle_policy": \{...\}\}; any other top-level key is rejected.

```shell
daytona sandbox update <id> [flags]
```

__Examples__

```shell
daytona sandbox update <id> --label env=dev
daytona sandbox update <id> --idle-timeout 30m --on-idle-timeout delete
daytona sandbox update <id> --idle-timeout off
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--clear-labels` |  | `bool` |  | remove every label except the name label |
| `--file` | `-f` | `PATH` |  | JSON body \{"labels": \{...\}, "lifecycle_policy": \{...\}\} from a file (or - for stdin); explicit flags override its fields |
| `--idle-timeout` |  | `DURATION` |  | idle time (Go duration, at least 1m) until --on-idle-timeout fires; off clears the idle expiry |
| `--label` |  | `stringArray` |  | replacement label KEY=VALUE (repeatable) |
| `--lifecycle-timeout` |  | `DURATION` |  | wall-clock lifetime (Go duration, e.g. 2h) until --on-lifecycle-timeout fires; restarts the countdown from now |
| `--on-idle-timeout` |  | `ACTION` |  | action when --idle-timeout elapses: delete, or stop on a persistent macOS sandbox |
| `--on-lifecycle-timeout` |  | `ACTION` |  | action when --lifecycle-timeout elapses: delete, or stop on a persistent macOS sandbox |

### daytona sandbox usage

Read sandbox usage

```shell
daytona sandbox usage <id> [flags]
```

__Examples__

```shell
daytona sandbox usage <id>
daytona sandbox usage <id> --history
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--history` |  | `bool` |  | read usage history |

### daytona sandbox wait

Wait for a sandbox status

Wait for a sandbox to reach a settled status: running, stopped, paused or deleted.
The SDK state names started (running) and destroyed (deleted) are accepted too.

```shell
daytona sandbox wait <id> [flags]
```

__Examples__

```shell
daytona sandbox wait <id> --for running
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--for` |  | `STATUS` | `running` | status to wait for: running, stopped, paused or deleted (or the SDK names started, destroyed) |
| `--timeout` |  | `DURATION` | `10m` | how long to wait (Go duration) |

## daytona snapshot

Manage snapshots

```shell
daytona snapshot
```

__Examples__

```shell
daytona snapshot create <sandbox> --name before-upgrade
daytona snapshot list --all
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona snapshot create`](#daytona-snapshot-create) | Create a snapshot |
| [`daytona snapshot delete`](#daytona-snapshot-delete) | Delete a snapshot |
| [`daytona snapshot get`](#daytona-snapshot-get) | Get one snapshot |
| [`daytona snapshot list`](#daytona-snapshot-list) | List snapshots |

### daytona snapshot create

Create a snapshot

Create a Linux memory snapshot with memory and disk. For disk-only capture, use `daytona image capture`.
Requires write:snapshots and write:sandboxes.

```shell
daytona snapshot create <sandbox> [flags]
```

__Examples__

```shell
daytona snapshot create <sandbox> --name before-upgrade
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--file` | `-f` | `PATH` |  | JSON request body from a file (or - for stdin); explicit flags override its fields |
| `--name` |  | `string` |  | snapshot name |
| `--no-wait` |  | `bool` |  | return once the server accepts the operation instead of waiting for it to finish |
| `--timeout` |  | `DURATION` | `10m` | how long to wait for the operation to finish (Go duration); the server keeps working after it |

### daytona snapshot delete

Delete a snapshot

Delete a snapshot by id or name; the acknowledgement repeats the reference as given.

```shell
daytona snapshot delete <id-or-name>
```

__Examples__

```shell
daytona snapshot delete <id-or-name> --yes
```

### daytona snapshot get

Get one snapshot

```shell
daytona snapshot get <id>
```

__Examples__

```shell
daytona snapshot get <id>
```

### daytona snapshot list

List snapshots

```shell
daytona snapshot list [flags]
```

__Examples__

```shell
daytona snapshot list --limit 20
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `100` | max items to return, 1 to 200 |

## daytona volume

Manage volumes

```shell
daytona volume
```

__Examples__

```shell
daytona volume create data
daytona volume list
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona volume create`](#daytona-volume-create) | Create a volume |
| [`daytona volume delete`](#daytona-volume-delete) | Delete a volume |
| [`daytona volume get`](#daytona-volume-get) | Get one volume |
| [`daytona volume list`](#daytona-volume-list) | List volumes |

### daytona volume create

Create a volume

Without --type the server chooses the volume's type.

```shell
daytona volume create <name> [flags]
```

__Examples__

```shell
daytona volume create data
daytona volume create data --type disk --size-gib 200
daytona volume create data --type bucket
daytona volume create data --type bucket --bucket corp-data --bucket-region us-east-1 --access-key-secret AWS_KEY --secret-key-secret AWS_SECRET
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--access-key-secret` |  | `string` |  | project secret name holding the bucket access key |
| `--bucket` |  | `string` |  | customer bucket name; on --type bucket, omitting this creates a platform-owned bucket volume |
| `--bucket-region` |  | `string` |  | region of a customer bucket (the S3 region, not a Daytona region) |
| `--endpoint` |  | `string` |  | S3 endpoint URL for a customer bucket |
| `--file` | `-f` | `PATH` |  | JSON request body from a file (or - for stdin); explicit flags override its fields |
| `--path-style` |  | `bool` |  | use path-style S3 addressing for a customer bucket |
| `--prefix` |  | `string` |  | bucket prefix |
| `--secret-key-secret` |  | `string` |  | project secret name holding the bucket secret key |
| `--size-gib` |  | `int32` |  | volume size in GiB (disk volumes only; default: the server's) |
| `--type` |  | `string` |  | volume type: disk\|bucket (default: chosen by the server) |

### daytona volume delete

Delete a volume

Delete a volume by id or name. It prints the accepted deletion, or an acknowledgement repeating the reference as given when the API answers with no operation.

```shell
daytona volume delete <id-or-name>
```

__Examples__

```shell
daytona volume delete <id-or-name> --yes
```

### daytona volume get

Get one volume

```shell
daytona volume get <id>
```

__Examples__

```shell
daytona volume get <id>
```

### daytona volume list

List volumes

```shell
daytona volume list [flags]
```

__Examples__

```shell
daytona volume list --limit 50
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `100` | max items to return, 1 to 200 |
