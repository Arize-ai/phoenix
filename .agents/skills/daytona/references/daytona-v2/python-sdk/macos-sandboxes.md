# macOS Sandboxes (Python SDK)

macOS virtual machine sandboxes, their capabilities, use cases, and architecture.

macOS sandboxes are **macOS virtual machines (VMs)** on dedicated Apple silicon, for building, testing, and automating software that needs macOS. Each runs on a reserved Mac mini.

A Mac is reserved for a 24-hour period. You choose the cores, memory and disk of each sandbox when you create it: one sandbox can use the whole Mac, or two sandboxes share it. macOS sandboxes run only on reservations. When your organization holds no reservation, Daytona can buy one for you when you create a macOS sandbox.

| **Concept**      | **Description**                                                               |
| ---------------- | ----------------------------------------------------------------------------- |
| **Reservation**  | The exclusive use of one Mac by one organization for a fixed period.          |
| **Size**         | The cores, memory, and disk of one sandbox.                                   |
| **Model**        | The type of Mac, defined by its chip, memory, and disk.                       |
| **Auto-reserve** | The automatic reservation of a Mac when a sandbox needs one and none is held. |
| **Image**        | A macOS disk that a sandbox starts from.                                      |
| **Persistent**   | A sandbox that keeps its disk across stop and start.                          |

## Contents

- [Use cases](#use-cases)
- [Requirements](#requirements)
- [Create a macOS sandbox](#create-a-macos-sandbox)
- [Mac reservations](#mac-reservations)
- [Filesystem snapshot](#filesystem-snapshot)
- [Filesystem persistence](#filesystem-persistence)
- [Lifecycle](#lifecycle)
- [Run commands](#run-commands)
- [SSH](#ssh)
- [Desktop](#desktop)
- [Logs](#logs)
- [Permissions](#permissions)

## Use cases

Use macOS sandboxes when the software, build, or task requires macOS or Apple tooling.

- **Build and test Apple apps.** An agent or a CI job builds and tests iOS and macOS apps with Xcode and the iPhone simulator on a clean Mac. The base image ships with Xcode, its iPhone simulator, Homebrew, and Python. The image runs macOS 26.6.2, and its Homebrew includes CocoaPods, fastlane, and Node.js 24.

- **Computer-use agents on macOS.** An agent operates macOS applications through screenshots and mouse and keyboard input. Computer use also reads the accessibility tree, acts on controls, and records the screen. The desktop is 1280 by 800, and your own VNC client can connect to it over a WebSocket.

- **Long-lived build machines.** A persistent sandbox keeps its disk across stop and start, so installed tools and build caches stay between sessions. To keep the disk after the reservation ends, take a filesystem snapshot. Automatic renewal stops when every sandbox on the Mac is stopped, and the reservation then ends with its period.

- **Remote access over SSH.** A developer or a script connects to the Mac over SSH to run commands and inspect builds. The CLI opens the connection itself, and other SSH clients sign in with a short-lived sandbox token in the user name. The token is limited to one sandbox and to SSH, so no project API key goes into the SSH command.

- **Fleets of Macs.** One request reserves up to 100 Macs for parallel builds and tests. Each Mac is a separate reservation with its own ID, period, charge, and renewal. A minimum count accepts fewer Macs when not enough are available.

## Requirements

Your organization must have macOS sandboxes turned on, or every request to reserve a Mac or to create a macOS sandbox fails. Sign in to the dashboard at [app.daytona.com ↗](https://app.daytona.com) and create a project API key. The examples read it from an environment variable.

### Endpoints

macOS sandboxes have their own API address. Send all macOS requests to the macOS API.

| **What**                                  | **Address**                                     |
| ----------------------------------------- | ----------------------------------------------- |
| Dashboard                                 | **`https://app.daytona.com`**                   |
| Daytona API (organizations, API keys)     | **`https://api.daytona.com`**                   |
| macOS API (reservations, macOS sandboxes) | **`https://api.us-macos.daytona.com`**          |
| Sandbox SSH                               | **`ssh.us-macos.daytona.com`**, port **`2222`** |
| Region of the Macs                        | **`macos-1`**                                   |

The SDKs and the CLI read the API address and your key from environment variables. Give the region of the Macs, listed in the table above, on each reservation and each macOS create.

```bash
export DAYTONA_API_KEY=dtn_...
export DAYTONA_V2_API_URL=https://api.us-macos.daytona.com
```

### Install

Pin these exact versions. Pre-release and latest installs lack the macOS features.

Python 3.10 or later:

```bash
pip install daytona==2.0.0a13
```

> **Caution:**
>
> Do not use `pip install --pre daytona`. It installs a version without the macOS features.

### Connect

The SDK clients read your key and the macOS API address from the environment. A connection to a service needs its address and a credential, and reading both from the environment keeps them out of the source code that calls the service.

```python
from daytona import Daytona

daytona = Daytona()  # reads DAYTONA_API_KEY and DAYTONA_V2_API_URL
# AsyncDaytona has the same methods with await
```

> **Notes:**
>
> - The SDK takes memory and disk in GiB and every timeout in seconds.

## Create a macOS sandbox

Create a macOS sandbox from a macOS image. Each sandbox runs on one of your [Mac reservations](#mac-reservations). When your organization holds no reservation in the region and [auto-reserve](#auto-reserve) is on, which it is by default, the create buys one for you, so you do not need to reserve a Mac first. With auto-reserve off, reserve a Mac before you create a sandbox. The base image has macOS, Xcode and common build tools. The following table lists its contents.

| **Property**     | **Value**                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Image            | `base-macos`                                                                                                |
| Operating system | macOS 26.6.2                                                                                                |
| Tools            | Xcode 26.6 and its iPhone simulator, Homebrew (with git, Node.js 24, Ruby, CocoaPods, fastlane, gh and jq) and Python 3.14 |
| User             | `lume`, with home `/Users/lume`                                                                             |
| Password         | `lume`. See [user and password](#user-and-password)                                                         |

You choose the [size](#sizes) of each sandbox when you create it. Two sandboxes share one Mac when their sizes fit in its cores, memory and sandbox disk together.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create_macos("base-macos", region="macos-1")
```

The following example creates two sandboxes of different sizes on one reservation:

```python
from daytona.v2 import MacosResources

r = daytona.v2.reservations.create(region="macos-1", model="m4pro-12c-24g",
                             idempotency_key="shared-mac-1")
a = daytona.v2.create_macos("base-macos", region="macos-1", reservation=r.id,
                             resources=MacosResources(cpu=4, memory=8, disk=100))
b = daytona.v2.create_macos("base-macos", region="macos-1", reservation=r.id,
                             resources=MacosResources(cpu=8, memory=16, disk=120))
```

The following example creates a persistent sandbox that uses the whole Mac:

```python
from daytona.v2 import MacosResources

r = daytona.v2.reservations.create(region="macos-1", model="m4pro-12c-24g",
                             idempotency_key="ios-builder-mac-1")
sandbox = daytona.v2.create_macos(
    "base-macos",
    region="macos-1",
    reservation=r.id,
    resources=MacosResources(cpu=12, memory=24, disk=220),
    persistent=True,
    name="ios-builder",
    wait_seconds=120,
)
print(sandbox.id, sandbox.reservation_id, sandbox.cpu, sandbox.memory, sandbox.disk)
```

| **Parameter** | **Description** |
| --- | --- |
| `image` | Sets the macOS image that the sandbox starts from.<br />**Required**<br />**Format:** an image name or ID<br />**Example:** `"base-macos"` |
| `region` | Sets the region.<br />**Default:** the region of the named reservation, otherwise the only region with Macs, otherwise the project's or organization's default region<br />**Format:** a listed region ID<br />**Example:** `"macos-1"` |
| `reservation` | Sets the [reservation](#which-reservation) that the sandbox runs on.<br />**Default:** any reservation of the organization in the region with room, or one that auto-reserve buys<br />**Format:** a reservation ID<br />**Value:** `"new"` for a new reservation of the cheapest model that fits<br />**Example:** `"new"` |
| `auto_renew` | Turns on [automatic renewal](#automatic-renewal) of the reservation that the create buys.<br />**Default:** the organization's auto-reserve setting |
| `resources` | Sets the [size](#sizes) of the sandbox.<br />**Default:** the default size of the Mac model<br />**Example:** `MacosResources(cpu=4, memory=8, disk=100)` |
| `cpu` | Sets the number of CPU cores.<br />**Default:** the default size of the Mac model<br />**Minimum:** `4`<br />**Maximum:** the cores of the [Mac model](./macos-sandboxes.md#models-and-prices) |
| `memory` | Sets the memory in GiB.<br />**Default:** the default size of the Mac model<br />**Minimum:** `4`<br />**Maximum:** the memory of the [Mac model](./macos-sandboxes.md#models-and-prices)<br />**Format:** a value that converts to a whole number of MiB |
| `disk` | Sets the whole guest disk in GiB, macOS included.<br />**Default:** the default size of the Mac model, or the disk size of a captured image<br />**Minimum:** `80`<br />**Maximum:** the sandbox disk space of the [Mac model](./macos-sandboxes.md#models-and-prices)<br />**Format:** a value that converts to a whole number of MiB |
| `persistent` | Keeps the disk across stop and start.<br />**Default:** `False` |
| `name` | Sets the display name.<br />**Default:** a generated name, sandbox- followed by 8 hexadecimal characters<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix such as sbx_ or img_<br />**Example:** `"ios-builder"` |
| `wait_seconds` | Sets how many seconds create waits for the sandbox to start.<br />**Default:** `60`<br />**Value:** `0` for no wait<br />**Example:** `120` |
| `create_timeout_seconds` | Sets how many seconds the sandbox has to reach running before it is deleted.<br />**Default:** `3600`<br />**Maximum:** `86400`<br />**Value:** `-1` for the maximum<br />**Example:** `600` |

> **Notes:**
>
> - The other create options, env, labels, secrets, ports, and network_policy, work as on [Linux sandboxes](./linux-sandboxes.md#create-a-linux-sandbox).

### Sizes

A macOS sandbox takes its cores, memory and disk from the Mac of its reservation. The disk is the whole guest disk, macOS included. On the M4 Pro [model](#models-and-prices), the sandboxes of one Mac share 12 cores, 24 GiB memory and 220 GiB disk. Up to two sandboxes run on one Mac at the same time, and their sizes must fit in the Mac together. For example, one sandbox of 12 cores, 24 GiB memory and 220 GiB disk uses the whole Mac, and a sandbox of 4 cores, 8 GiB and 100 GiB fits beside a sandbox of 8 cores, 16 GiB and 120 GiB. A Mac fixes the size when it accepts the sandbox, and the sandbox reports that size from then on.

| **Setting** | **SDK (GiB)**     | **CLI (MiB)**  | **API (MiB)**      | **Minimum**        | **Maximum on `m4pro-12c-24g`** | **If you omit it, on `m4pro-12c-24g`** |
| ----------- | ----------------- | -------------- | ------------------ | ------------------ | ------------------------------ | -------------------------------------- |
| Cores       | **`resources.cpu`** (cores) | **`--cores`**  | **`cores`**        | 4                  | 12                             | 6                                      |
| Memory      | **`resources.memory`**      | **`--memory`** | **`memory_mib`**   | 4 GiB (4096 MiB)   | 24 GiB (24576 MiB)             | 12 GiB (12288 MiB)                     |
| Disk        | **`resources.disk`**        | **`--disk`**   | **`disk_mib`**     | 80 GiB (81920 MiB) | 220 GiB (225280 MiB)           | 110 GiB (112640 MiB)                   |

### Which reservation

A create places the sandbox on one of your reservations. The reservation option decides which reservation the create uses, and whether it buys a new one.

| **Reservation option**   | **Where the sandbox goes**                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Omitted                  | Any of your reservations in the region that has room. If you have none, [auto-reserve](#auto-reserve) buys one (if it is on).                    |
| `reservation="<id>"`     | That reservation.                                                                                                                                |
| `reservation="new"`      | A new reservation that the create always buys for this sandbox. Only here can you also set `auto_renew`.                                         |

The create can wait for room on a reservation. Two options set how long: seconds in the SDKs, a Go duration in the CLI. If time runs out, a reservation the create bought stays bought.

| **Option**                                                     | **Description**                                                      |
| -------------------------------------------------------------- | -------------------------------------------------------------------- |
| `wait_seconds` (`waitSeconds`, `--server-wait`)                | How long the call waits for the sandbox to start.                    |
| `create_timeout_seconds` (`createTimeoutSeconds`, `--create-ttl`) | How long the server tries before it deletes the waiting sandbox. |

### Get a sandbox

Get a macOS sandbox by its ID, or list the sandboxes in the macOS region. A get reads one resource by its identifier, a list reads a scope page by page, and neither changes them.

```python
sandbox = daytona.v2.get("SANDBOX_ID")
```

## Mac reservations

A reservation gives your organization one dedicated Mac for a 24-hour period. Nobody else uses that Mac while you hold it. You pay for each period when it starts. The first period starts when a Mac accepts the reservation, not when you request it, and waiting for a Mac is not charged.

You cannot end a reservation early: it ends with its period unless it renews. macOS sandboxes run only on your reservations: a create picks one with room left, or you name one. Up to two sandboxes share the Mac, and you choose the [size](#sizes) of each when you create it.

**Reservation statuses:**

| **Status**           | **Description**                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pending_charge` | We are charging the period.                                                                                                                           |
| `pending_mac`    | The period is paid. The reservation waits for an available Mac. If no Mac accepts it within 5 minutes, it becomes `failed` and we refund the charge.     |
| `active`         | A Mac holds the reservation. `period_end` tells you when the period ends.                                                                         |
| `ending`         | The period ended. We stop the sandboxes, save persistent disks and erase the Mac. See [when a reservation ends](#when-a-reservation-ends).           |
| `released`       | The reservation ended. `end_reason` tells you why, for example `expired`.                                                                     |
| `failed`         | The charge failed, or no Mac accepted the reservation (refunded).                                                                                     |

### Models and prices

The production Macs are **Apple M4 Pro, 12 cores, 24 GB memory**. Always give this model when you reserve. Its model ID is in the table below. The price of one reservation of this model is **$2.5032 per Mac-hour, $60.08 per 24-hour period**.

| **Model**             | **Cores** | **Memory** | **Sandbox disk** | **Sandboxes at a time** |
| --------------------- | --------- | ---------- | ---------------- | ----------------------- |
| **`m4pro-12c-24g`**   | 12        | 24 GiB     | 220 GiB          | Up to 2                 |

The sizes of the sandboxes on one Mac must fit in its cores, memory and sandbox disk together. See [sizes](#sizes) for the minimum and maximum of each setting.

The Mac catalog lists the current price and the number of available Macs, the Macs nobody has reserved. The number is a guide only: another purchase can reserve one first.

```python
catalog = daytona.v2.mac_models.catalog(region="macos-1")
for region in catalog.regions:
    for entry in region.models:
        price = entry.price
        print(
            entry.model.id,
            "available:", entry.available,
            "per period: $%.2f" % (price.period_cents / 100) if price else "no price",
        )

# Model specs only; the catalog adds prices and available Macs per region
for model in daytona.v2.mac_models.list():
    print(model.id, model.cores, model.memory_mib, model.max_sandboxes)
```

| **Parameter** | **Description** |
| --- | --- |
| `region` | Limits the catalog to one region.<br />**Default:** every region<br />**Format:** a listed region ID<br />**Example:** `"macos-1"` |

### Reserve a Mac

Reserve one Mac of a model in a region. Each purchase has an idempotency key. If you retry with the same key, you get the same reservation and you do not pay again. If you do not give a key, the SDK and the CLI make a new key for each call, so a retry buys a second Mac. Give your own idempotency key when your code can retry a purchase.

```python
reservation = daytona.v2.reservations.create(
    region="macos-1",
    model="m4pro-12c-24g",
    idempotency_key="build-mac-2026-10-24",
)
print(reservation.id, reservation.status)
```

| **Parameter** | **Description** |
| --- | --- |
| `region` | Sets the region whose Macs to reserve.<br />**Required**<br />**Format:** a listed region ID<br />**Example:** `"macos-1"` |
| `model` | Sets the Mac [model](#models-and-prices) to reserve.<br />**Default:** the region's default model<br />**Format:** a Mac model ID<br />**Example:** `"m4pro-12c-24g"` |
| `idempotency_key` | Makes a retried purchase return the same reservation.<br />**Default:** a new key for each call<br />**Maximum:** 256 characters<br />**Format:** printable ASCII<br />**Example:** `"build-mac-2026-10-24"` |
| `auto_renew` | Turns on [automatic renewal](#automatic-renewal).<br />**Default:** the organization's auto-reserve setting |

### Reserve many Macs

Reserve from 1 to 100 Macs of one model in a single request. Each Mac you reserve is a separate reservation with its own ID, period, charge and renewal.

By default, the request is all or nothing: if fewer Macs are available than you ask for, it reserves none and fails because no Mac is available. Set a minimum count to accept fewer: the request then reserves as many as are available, if that is at least the minimum.

```python
batch = daytona.v2.reservations.create_bulk(
    region="macos-1",
    model="m4pro-12c-24g",
    count=20,
    min_count=10,
    idempotency_key="ci-fleet-2026-10-24",
)
print(f"reserved {batch.reserved} of {batch.requested} Macs")
ids = [r.id for r in batch.reservations]
```

| **Parameter** | **Description** |
| --- | --- |
| `region` | Sets the region whose Macs to reserve.<br />**Required**<br />**Format:** a listed region ID<br />**Example:** `"macos-1"` |
| `model` | Sets the Mac [model](#models-and-prices) to reserve.<br />**Default:** the region's default model<br />**Format:** a Mac model ID<br />**Example:** `"m4pro-12c-24g"` |
| `count` | Sets how many Macs to reserve.<br />**Required**<br />**Minimum:** `1`<br />**Maximum:** `100`<br />**Example:** `20` |
| `min_count` | Sets the fewest Macs to accept when fewer than the count are available.<br />**Default:** the count<br />**Minimum:** `1`<br />**Maximum:** the count |
| `idempotency_key` | Makes a retried purchase return the same reservations.<br />**Default:** a new key for each call<br />**Maximum:** 256 characters<br />**Format:** printable ASCII<br />**Example:** `"ci-fleet-2026-10-24"` |

### List reservations

List the reservations of your organization, one page at a time. The list returns the open reservations and the reservations that ended in the last 30 days.

```python
cursor = None
while True:
    page = daytona.v2.reservations.list(limit=100, cursor=cursor)
    for r in page.items:
        print(r.id, r.status, r.model, r.period_end, r.auto_renew)
    cursor = page.next_cursor  # None on the last page
    if cursor is None:
        break
```

| **Parameter** | **Description** |
| --- | --- |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |
| `cursor` | Continues from a previous page.<br />**Format:** the next_cursor of the previous page |

#### Iterate over all reservations

Iterate over every reservation of your organization without handling cursors. The iterator fetches the next page when the current one runs out and stops when no cursor is returned.

```python
for r in daytona.v2.reservations.iter():
    print(r.id, r.status, r.model, r.period_end, r.auto_renew)
```

| **Parameter** | **Description** |
| --- | --- |
| `limit` | Sets the page size that the iterator fetches.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |
| `cursor` | Starts the iteration after a previous page.<br />**Format:** the next_cursor of the previous page |

### Get a reservation

Get one reservation of your organization by its ID. The response has the same fields as an item of the list, including its current status and the end of its period.

```python
r = daytona.v2.reservations.get("RESERVATION_ID")
print(r.id, r.status, r.period_end, r.auto_renew)
```

### Renew a reservation

Renew a reservation to buy the next 24-hour period on the same Mac. You keep the Mac, its sandboxes and their disks. Use a new key for each period you buy, and the same key to retry.

```python
daytona.v2.reservations.renew(reservation.id, idempotency_key=f"renew-{reservation.id}-2")
```

| **Parameter** | **Description** |
| --- | --- |
| `idempotency_key` | Makes a retried renewal return the reservation without charging another period.<br />**Default:** a new key for each call<br />**Maximum:** 256 characters<br />**Format:** printable ASCII<br />**Example:** `"renew-2"` |

> **Notes:**
>
> - The reservation must be active.

### Automatic renewal

When automatic renewal is on, we renew the reservation in the last hour of its period, **but only while a sandbox on that Mac is active** (being created, starting, running or paused). If all its sandboxes are stopped, or it has none, the reservation does not renew and ends at the end of its period. If a renewal fails, the reservation records the reason and ends at the end of its period.

Turn automatic renewal on or off for one reservation.

```python
daytona.v2.reservations.update(reservation.id, auto_renew=False)
```

| **Parameter** | **Description** |
| --- | --- |
| `auto_renew` | Turns automatic renewal on or off.<br />**Required** |

### Auto-reserve

Auto-reserve buys a Mac when you create a macOS sandbox and your organization holds no live reservation in the region. It buys the cheapest model that fits the sandbox, with automatic renewal on. To control every purchase, turn auto-reserve off and reserve Macs yourself.

- It is **on by default** and holds at most **2** reservations at a time. When it already holds **2**, a create fails because the auto-reserve limit is reached.
- It does not buy a Mac when your reservation is only full: no free slot, or too little disk left.
- An organization admin can turn it off, or change its limit, in the dashboard under Settings, **Auto-reserve Macs**, or through the [macOS settings](#macos-settings).

### macOS settings

The macOS settings control [auto-reserve](#auto-reserve) for macOS sandboxes. With auto-reserve on, a macOS create in a region where the organization holds no live Mac reservation buys a 24-hour reservation that renews while a sandbox on it runs or is paused. Auto-reserve is on by default, and the organization caps how many auto-reserved reservations it holds at once.

#### Get the settings

Get the organization's macOS settings. Settings are stored values that control how a service behaves, and a read returns their current values without changing them.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/macos-settings' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

```json
{
  "macos_auto_reserve": true,
  "macos_auto_reserve_max_reservations": 2,
  "macos_auto_reserve_disabled_at": null,
  "macos_auto_reserve_disabled_by": null
}
```

> **Notes:**
>
> - The request authenticates with a user token, not an API key.

#### Set the settings

Turn auto-reserve on or off, or change the cap on the number of auto-reserved reservations. Fields left out of the request keep their stored values.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/macos-settings' \
  --request PATCH \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "macos_auto_reserve": true, "macos_auto_reserve_max_reservations": 4 }'
```

| **Field** | **Description** |
| --- | --- |
| `macos_auto_reserve` | Turns auto-reserve on or off.<br />**Default:** the stored value |
| `macos_auto_reserve_max_reservations` | Sets the most auto-reserved reservations that the organization holds at once.<br />**Default:** the stored value<br />**Minimum:** `1`<br />**Maximum:** `2147483647` |

> **Notes:**
>
> - The request authenticates with a user token, not an API key.
> - The request must set at least one field.
> - Turning auto-reserve off again keeps the recorded time and admin, and turning it on clears them.

### When a reservation ends

A reservation ends at the end of its period when it does not renew. There is no grace period, and we do not send a notice. Watch the end of the period, the automatic renewal setting and any renewal error on your reservations, or [renew by hand](#renew-a-reservation).

At the end, in this order:

1. The reservation enters the ending status. You cannot start, resume or create sandboxes on it.
2. **Persistent sandboxes** are shut down (paused ones are resumed first, then shut down). Each one that ran is **exported as an image**: an unnamed image that records the sandbox's ID.
3. **Sandboxes that are not persistent** are deleted. Their data is lost.
4. When every export is saved or has failed, the Mac is **erased**: the sandbox disks, the console logs, the macOS user and its files. A failed export holds the erase for up to 24 hours, and the disk of the sandbox whose export failed is then lost.
5. The Mac is checked and goes back to the pool for the next customer.
6. The reservation enters the released status. Every sandbox on it is deleted.

#### What you keep

| **Data**                          | **After the end**                                                                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Disk of a persistent sandbox      | Kept as an image without a name, unless its export fails. It is deleted when no sandbox is created from it for 30 days. Give it a name to keep it. |
| Snapshots you made                | Kept. Named ones until you delete them. Unnamed ones while a sandbox is created from them at least once every 7 days.                              |
| Usage records and bills           | Kept.                                                                                                                                              |
| Sandboxes that are not persistent | Lost.                                                                                                                                              |
| Memory of paused sandboxes        | Lost. The disk is exported.                                                                                                                        |
| Console logs                      | Lost.                                                                                                                                              |
| The Mac                           | Erased.                                                                                                                                            |

#### Continue after the end

Find the exported image, then create a sandbox from it on a reservation. You can also give the image a name to keep it. The new sandbox needs a reservation with room for the disk: an existing one, a new one you buy, or one that auto-reserve buys. It gets a new machine identity.

```python
exports = daytona.v2.images.list(anonymous=True, sandbox_id="OLD_SANDBOX_ID")
image = exports.items[0]
daytona.v2.images.promote(image.id, "ios-builder-day-2")   # optional: keep it
sandbox = daytona.v2.create_macos(image.id, region="macos-1", persistent=True, wait_seconds=120)
```

| **Parameter** | **Description** |
| --- | --- |
| `anonymous` | Lists only the images without a name.<br />**Default:** `False` |
| `sandbox_id` | Lists only the images captured from one sandbox.<br />**Format:** a sandbox ID |
| `name` | Sets the name that promote gives the image.<br />**Required**<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix such as img_ or sbx_<br />**Example:** `"ios-builder-day-2"` |

> **Notes:**
>
> - Only an image without a name can be named.

## Filesystem snapshot

A filesystem snapshot saves the disk of a stopped persistent macOS sandbox as an image, without the memory. You can create new sandboxes from it on any Mac of the region.

A new sandbox from an image gets a new machine identity. Apps that are bound to one machine (for example an iCloud sign-in or some licences) need you to sign in again.

```python
sandbox.stop()
image = sandbox.capture_image(name="ios-builder-ready")
image = daytona.v2.images.get(image.id, wait="ready", timeout=3600)
print(image.id, image.status)

copy = daytona.v2.create_macos("ios-builder-ready", region="macos-1", persistent=True)
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the image name.<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix such as img_ or sbx_<br />**Example:** `"ios-builder-ready"` |
| `wait` | Holds the request until the image is ready.<br />**Value:** `"ready"` |
| `timeout` | Sets how many seconds images.get waits for the image.<br />**Value:** `0` for a single long poll<br />**Example:** `3600` |

> **Notes:**
>
> - The sandbox must be persistent and stopped.
> - The sandbox cannot be deleted while the capture still needs its disk.

## Filesystem persistence

A persistent macOS sandbox keeps its disk on its Mac across stop and start for as long as the reservation lives. To keep the disk after the reservation, make a [filesystem snapshot](#filesystem-snapshot), or let the end of the reservation save it (see [when a reservation ends](#when-a-reservation-ends)).

## Lifecycle

Every macOS sandbox moves through a lifecycle. Stop, start, pause and resume need a **persistent** sandbox. A sandbox that is not persistent can only run or be deleted.

If a Mac restarts while a sandbox is running, a sandbox that is not persistent is lost, and a persistent sandbox comes back stopped with its disk.

| **Action** | **What happens**                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stop       | macOS shuts down. The disk stays on the same Mac and keeps its disk room on the reservation. The cores, memory and slot become available to other sandboxes.                                 |
| Start      | macOS boots from the same disk on any Mac of the organization with an open slot and enough cores and memory. After a start on a different Mac, iCloud asks the user to sign in again. With no reservation in the region, start buys one if [auto-reserve](#auto-reserve) is on. |
| Pause      | The Mac saves the memory of the sandbox. It keeps its place on the reservation.                                                                                                       |
| Resume     | The sandbox continues from the saved memory. If the memory cannot be restored, macOS boots from the disk and `mac_boot_mode` is `cold_after_restore_failure`.                 |
| Delete     | The sandbox and its disk are erased. You cannot undo this.                                                                                                                            |

> **Caution:**
>
> A stopped sandbox **does not keep automatic renewal going**. If all sandboxes on a reservation are stopped at the end of the period, the reservation ends. See [when a reservation ends](#when-a-reservation-ends).

### Stop / start

Stop a persistent macOS sandbox to shut down macOS and keep its disk on the same Mac. Start boots macOS from the same disk on any Mac of the organization that has room for the sandbox.

```python
sandbox.stop()
sandbox.wait(until="stopped")
sandbox.start(timeout=120)

# Stop a sandbox by ID, without fetching it first
daytona.v2.stop("SANDBOX_ID")

# Start a stopped sandbox by ID
daytona.v2.start("SANDBOX_ID", timeout=120)
```

| **Parameter** | **Description** |
| --- | --- |
| `timeout` | Sets how many seconds the call waits for the sandbox to reach the new state.<br />**Default:** `60`<br />**Value:** `0` for no limit<br />**Example:** `120` |
| `until` | Sets the state that wait returns at.<br />**Default:** `"started"`<br />**Example:** `"stopped"` |

> **Notes:**
>
> - The sandbox must be persistent.

### Pause / resume

Pause a persistent macOS sandbox to save its memory on the Mac. When you resume it, the sandbox continues from the memory saved on the Mac.

```python
sandbox.pause()
sandbox.resume()

# Pause a sandbox by ID, without fetching it first
daytona.v2.pause("SANDBOX_ID")

# Resume a paused sandbox by ID
daytona.v2.resume("SANDBOX_ID")
```

| **Parameter** | **Description** |
| --- | --- |
| `timeout` | Sets how many seconds the call waits for the sandbox to reach the new state.<br />**Default:** `60`<br />**Value:** `0` for no limit<br />**Example:** `120` |

> **Notes:**
>
> - The sandbox must be persistent.

### Fork

Fork a persistent macOS sandbox to copy its disk into a new sandbox. A fork does not copy the memory, and a fork request that asks for memory fails.

```python
twin = sandbox.fork(name="ios-builder-2")
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the display name of the fork.<br />**Default:** the source name followed by -fork<br />**Example:** `"ios-builder-2"` |
| `wait_seconds` | Sets how many seconds the call waits for the fork to settle.<br />**Default:** `60`<br />**Value:** `0` for no wait<br />**Example:** `120` |

> **Notes:**
>
> - The source sandbox must be persistent.
> - A macOS fork copies only the disk; a fork of a running sandbox boots with a new machine identity.

### Delete

Delete a macOS sandbox to erase the sandbox and its disk. You cannot undo this.

```python
sandbox.delete()
```

| **Parameter** | **Description** |
| --- | --- |
| `timeout` | Sets how many seconds the call waits for the sandbox to be deleted.<br />**Default:** `60`<br />**Value:** `0` for no limit<br />**Example:** `120` |

## Run commands

Run commands in a macOS sandbox, in the foreground or in the background. File operations, git and PTYs work the same way as on Linux sandboxes.

```python
result = sandbox.exec("sw_vers -productVersion && xcodebuild -version")
print(result.exit_code, result.output)

handle = sandbox.process.start("xcodebuild -scheme App build")  # runs in the background
print(handle.wait().exit_code)
```

## SSH

Connect to a macOS sandbox over SSH. The CLI opens the SSH connection for you. With your own SSH client, make a short-lived sandbox token that allows SSH, and put the sandbox ID and the token in the user name, joined by a hash sign (#).

The SSH gateway checks the sandbox token, not a password or an SSH key. A token works until it expires, and you can make a new token whenever you need one.

```python
token = sandbox.create_access_token(operations=["ssh"], ttl_seconds=3600)
print(f'ssh -p 2222 "{sandbox.id}#{token.access_token}@ssh.us-macos.daytona.com"')
```

| **Parameter** | **Description** |
| --- | --- |
| `operations` | Sets the operations that the token allows.<br />**Default:** every operation that the caller can grant<br />**Value:** `"toolbox"`, `"toolbox:exec"`, `"toolbox:fs"`, `"toolbox:git"`, `"toolbox:lsp"`, `"desktop"`, `"ssh"`, `"sandbox:stop"`, `"sandbox:pause"`, `"sandbox:delete"`<br />**Example:** `["ssh"]` |
| `ttl_seconds` | Sets the token lifetime in seconds.<br />**Default:** `3600`<br />**Maximum:** `86400`<br />**Example:** `600` |

> **Caution:**
>
> Keep project API keys out of SSH commands. Use a sandbox token, scoped to the sandbox and SSH.

## Desktop

macOS sandboxes have a desktop of 1280 × 800. Open the sandbox in the dashboard and choose the desktop view. The desktop takes mouse and keyboard input as soon as it connects.

### User and password

A macOS sandbox signs in to its macOS user when it starts, so the desktop opens without a login screen. macOS asks for the password of this user when you change a protected setting, for example when you allow an app under **Privacy & Security**, and when you unlock the screen. SSH and the desktop view do not use this password. Daytona checks your sandbox token instead.

The base image has the following user settings. A sandbox from a [filesystem snapshot](#filesystem-snapshot) keeps the user settings of the sandbox it was taken from, including a changed password.

| **Property**     | **Value**                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| User             | `lume`                                                                                          |
| Password         | `lume`                                                                                          |
| Administrator    | Yes                                                                                             |
| `sudo`           | Does not ask for a password                                                                     |
| Sign-in at start | Automatic                                                                                       |
| Screen lock      | Only when you lock the screen or the display sleeps. The sandbox does not sleep on its own.     |

### Computer use

Take screenshots and send mouse and keyboard input inside the sandbox. Computer use can also read the accessibility tree, act on controls, and record the screen.

```python
import base64

cu = sandbox.computer_use
cu.start()
print(cu.status())

shot = cu.screen.screenshot()
with open("screen.png", "wb") as f:
    f.write(base64.b64decode(shot.screenshot))

cu.mouse.click(x=640, y=400)
cu.keyboard.type(text="hello from Daytona")
cu.keyboard.hotkey(keys="cmd+space")       # modifiers: cmd, ctrl, alt (option), shift
print(cu.display.windows())
```

> **Notes:**
>
> - The a11y property reads the accessibility tree and acts on controls; recording records the screen.

### VNC client

Connect your own VNC client to the desktop, which is also a VNC connection over a WebSocket. Make a sandbox access token with the desktop operation and connect a noVNC client to the WebSocket address below. The proxy does the VNC password step for your client. Your VNC client must support the DesktopSize encoding (noVNC supports it).

```text
wss://proxy.us-macos.daytona.app/vnc/SANDBOX_ID?daytona_token=TOKEN
```

```python
token = sandbox.create_access_token(operations=["desktop"], ttl_seconds=3600)
```

## Logs

A macOS sandbox has a console log, and your own processes can keep their own logs. The console log is erased with the Mac when the reservation ends. Copy what you need before then.

| **Log**                   | **Description**                                                                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Console log**           | The macOS sandbox's console output and our lifecycle lines. The API route is `GET /sandboxes/SANDBOX_ID/console-logs`.                                                            |
| **Your own process logs** | Run a command with `process.start(...)` and read `handle.logs()` or `handle.stream_logs()` (TypeScript: `logs()`, `streamLogs()`), or write logs to a file and copy it out. |
| **Usage**                 | `daytona sandbox usage SANDBOX_ID`.                                                                                                                                               |

```bash
daytona sandbox logs SANDBOX_ID
daytona sandbox logs SANDBOX_ID --follow
```

## Permissions

macOS sandboxes and Mac reservations use the sandbox permissions of their project, which you can grant to an [organization role](./organizations.md#roles) or an [API key](./api-keys.md). The macOS settings of the organization use organization permissions instead of sandbox permissions.

Attaching secrets to a new sandbox also requires the permission to read secrets, and listing the images to continue from after a reservation ends requires the permission to read images. The [audit logs](./audit-logs.md) record sandbox creates and deletes, and Mac reservations and renewals.

| **Permission**           | **Grants**                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **`read:sandboxes`**     | Get sandboxes, and list and get Mac reservations                                                                                 |
| **`write:sandboxes`**    | Create, stop, start, pause, resume, and fork sandboxes, use the toolbox and SSH, and reserve, renew, and update Mac reservations |
| **`delete:sandboxes`**   | Delete sandboxes                                                                                                                 |
| **`write:images`**       | Capture filesystem snapshots as images                                                                                           |
| **`read:organization`**  | Get the macOS settings                                                                                                           |
| **`write:organization`** | Change the macOS settings                                                                                                        |
