# macOS Sandboxes (TypeScript SDK)

macOS virtual machine sandboxes, their capabilities, use cases, and architecture.

macOS sandboxes are **macOS virtual machines (VMs)** that run on dedicated Apple silicon. They let an agent or a person use macOS and Apple developer tools without owning or managing a Mac.

Daytona runs each macOS sandbox as a virtual machine on a Mac mini that one organization reserves for 24 hours at a time. Code inside it sees a full macOS with a desktop and a shell, and nothing of other organizations, which never share that Mac. Up to two sandboxes share one reserved Mac, and each takes its cores, memory, and disk from it. A sandbox lives only while a reservation holds its Mac, and the end of the reservation erases the Mac.

Use macOS sandboxes to build, test, and automate software that needs macOS, Xcode, or the iPhone simulator. When your organization holds no reservation, a create can buy one for you.

| **Component**   | **Description**                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| **Sandbox**     | An isolated macOS machine that runs code.                                                              |
| **Host**        | The physical Mac that runs one or more sandboxes.                                                      |
| **Guest**       | The macOS operating system that runs inside a sandbox, as opposed to the operating system of the host. |
| **Reservation** | The exclusive use of one Mac by one organization for a fixed period.                                   |
| **Model**       | The type of Mac, defined by its chip, memory, and disk.                                                |
| **Resources**   | The cores, memory, and disk of one sandbox.                                                            |
| **Image**       | A macOS disk that a sandbox starts from.                                                               |
| **Desktop**     | The graphical interface of an operating system, operated with a mouse and keyboard.                    |

## Contents

- [Use cases](#use-cases)
- [Connect to the API](#connect-to-the-api)
- [Create a macOS sandbox](#create-a-macos-sandbox)
- [Mac reservations](#mac-reservations)
- [Resources](#resources)
- [Regions](#regions)
- [Lifecycle](#lifecycle)
- [Persistence](#persistence)
- [Snapshots](#snapshots)
- [Images](#images)
- [User and password](#user-and-password)
- [Logs](#logs)
- [Permissions](#permissions)

## Use cases

Sandboxes are used wherever code must run in a real environment, but you cannot trust the code or you cannot afford for it to affect anything else. Use macOS sandboxes when the software, build, or task requires macOS or Apple tooling.

- **Build and test Apple apps.** An agent or a CI job builds and tests iOS and macOS apps with Xcode and the iPhone simulator on a clean Mac. The base image ships with Xcode, its iPhone simulator, Homebrew, and Python. The image runs macOS 26.6.2, and its Homebrew includes CocoaPods, fastlane, and Node.js 24.

- **Computer-use agents on macOS.** An agent operates macOS applications through screenshots and mouse and keyboard input. Computer use also reads the accessibility tree, acts on controls, and records the screen. The desktop is 1280 by 800, and your own VNC client can connect to it over a WebSocket.

- **Long-lived build machines.** A persistent sandbox keeps its disk across stop and start, so installed tools and build caches stay between sessions. To keep the disk after the reservation ends, take a filesystem snapshot. Automatic renewal stops when every sandbox on the Mac is stopped, and the reservation then ends with its period.

- **Remote access over SSH.** A developer or a script connects to the Mac over SSH to run commands and inspect builds. The CLI opens the connection itself, and other SSH clients sign in with a short-lived sandbox token in the user name. The token is limited to one sandbox and to SSH, so no project API key goes into the SSH command.

- **Fleets of Macs.** One request reserves up to 100 Macs for parallel builds and tests. Each Mac is a separate reservation with its own ID, period, charge, and renewal. A minimum count accepts fewer Macs when not enough are available.

## Connect to the API

Connect to the API to send the requests that create and manage sandboxes. A connection to a service needs its address and a credential, and reading both from the environment keeps them out of the source code that calls the service.

macOS sandboxes and Mac reservations live behind the Daytona API, the same address as Linux sandboxes, which the SDKs and the CLI connect to by default. The API authenticates with a project API key.

Connect before you reserve a Mac or create a macOS sandbox. [Create a project API key](./api-keys.md#create-an-api-key) from the dashboard, then set it in the [environment](./authentication.md#environment-variables). Install SDK 2.x and the latest CLI with the commands in the tabs. Give a [region with Macs](#regions) on each reservation and each macOS create.

| **Service**     | **Address**                   |
| --------------- | ----------------------------- |
| **Dashboard**   | **`https://app.daytona.com`** |
| **Daytona API** | **`https://api.daytona.com`** |

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona() // reads DAYTONA_API_KEY
```

> **Notes:**
>
> - **Prerequisites:** The SDK must be installed with `npm install @daytona/sdk@2`, on Node.js 22.15 or later. The environment must set DAYTONA_API_KEY to a project API key. DAYTONA_V2_API_URL can stay unset, because the SDK defaults to `https://api.daytona.com`.
> - **Compatibility:** The SDK takes memory and disk in GiB and every timeout in seconds.

## Create a macOS sandbox

Create a macOS sandbox to get a macOS virtual machine on a reserved Mac. Creation boots a virtual machine from an image and gives it a fixed share of the processor, memory, and disk of its host.

A create of a macOS sandbox places the sandbox on one Mac reservation of the organization and boots it from a macOS image.

Create a macOS sandbox programmatically after you [connect to the API](#connect-to-the-api). With [auto-reserve](#auto-reserve) on, which is the default, a create without a reservation buys one, so you do not need to reserve a Mac first. With auto-reserve off, [reserve a Mac](#reserve-a-mac) before you create a sandbox. A reservation that a create buys stays bought, even when the sandbox fails to start in time.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.createMacos('base-macos', { region: 'us-east-bos-1' })
```

| **Parameter** | **Description** |
| --- | --- |
| `image` | Sets the macOS image that the sandbox starts from.<br />**Required**<br />**Format:** an image name or ID<br />**Example:** `'base-macos'` |
| `autoRenew` | Turns on [automatic renewal](#automatic-renewal) of the reservation that the create buys.<br />**Default:** the organization's auto-reserve setting |
| `createTimeoutSeconds` | Sets how many seconds the sandbox has to reach running before it is deleted.<br />**Default:** `3600`<br />**Minimum:** `1`<br />**Maximum:** `86400`<br />**Value:** `-1` for the maximum<br />**Example:** `600` |
| `name` | Sets the display name.<br />**Default:** a generated name, sandbox- followed by 8 hexadecimal characters<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix such as sbx_ or img_<br />**Example:** `'ios-builder'` |
| `persistent` | Keeps the disk across stop and start.<br />**Default:** `false`<br />**Rules:** set at creation and cannot change; stop, start, pause, resume, fork, and filesystem snapshots need a persistent sandbox |
| `region` | Sets the region.<br />**Default:** the region of the named reservation, otherwise the only region with Macs, otherwise the project's or organization's default region<br />**Value:** `earth`, `us`, `us-east`, `us-east-ash-1`, `us-east-bos-1`, or `us-east-iad-1`<br />**Example:** `'us-east-bos-1'` |
| `reservation` | Sets the [reservation](#sandbox-placement) that the sandbox runs on.<br />**Default:** any reservation of the organization in the region with room, or one that auto-reserve buys<br />**Format:** a reservation ID<br />**Value:** `'new'` for a new reservation of the cheapest model that fits<br />**Example:** `'new'` |
| `resources` | Sets the [resources](#resources) of the sandbox.<br />**Default:** the default resources of the Mac model<br />**Example:** `{ cpu: 4, memory: 8, disk: 100 }` |
| `cpu` | Sets the number of CPU cores.<br />**Default:** the default resources of the Mac model<br />**Minimum:** `4`<br />**Maximum:** the cores of the [Mac model](./macos-sandboxes.md#models-and-prices) |
| `memory` | Sets the memory in GiB.<br />**Default:** the default resources of the Mac model<br />**Minimum:** `4`<br />**Maximum:** the memory of the [Mac model](./macos-sandboxes.md#models-and-prices)<br />**Format:** a value that converts to a whole number of MiB |
| `disk` | Sets the whole guest disk in GiB, macOS included.<br />**Default:** the default resources of the Mac model, or the disk size of a captured image<br />**Minimum:** `80`<br />**Maximum:** the sandbox disk space of the [Mac model](./macos-sandboxes.md#models-and-prices)<br />**Format:** a value that converts to a whole number of MiB |
| `waitSeconds` | Sets how many seconds create waits for the sandbox to start.<br />**Default:** `60`<br />**Value:** `0` for no wait<br />**Example:** `120` |

> **Notes:**
>
> - **Compatibility:** The other create options, env, labels, secrets, ports, and networkPolicy, work as on [Linux sandboxes](./linux-sandboxes.md#create-a-linux-sandbox).

## Mac reservations

A Mac reservation is the exclusive use of one Mac by one organization for a fixed period. Reserved hardware is set aside for a single customer, so no other workload competes for it.

The Mac reservation of a macOS sandbox gives one organization one dedicated Mac for a 24-hour period, and nobody else uses that Mac while it is held. The first period starts when a Mac accepts the reservation, not when it is requested. A reservation cannot end early, and it ends with its period unless it renews.

**Reservation statuses:**

| **Status**               | **Description**                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------- |
| **`pending_charge`**     | The period is being charged.                                                           |
| **`pending_mac`**        | The period is paid, and the reservation waits up to 5 minutes for an available Mac.    |
| **`active`**             | A Mac holds the reservation until the end of the period in period_end.                 |
| **`ending`**             | The period ended, and the [end of the reservation](#when-a-reservation-ends) runs.     |
| **`released`**           | The reservation ended for the reason in end_reason, such as `expired`.                 |
| **`failed`**             | The charge failed, or no Mac accepted the reservation and the charge was refunded.     |

### Models and prices

A Mac model is a type of Mac, defined by its chip, memory, and disk. The model decides how much hardware one reservation holds and what it costs.

The Mac model of a macOS sandbox is one of four Macs with an Apple M4, M4 Pro, or M5 Pro chip, which differ in cores, memory, and disk. The model sets the hardware of the reservation, and the [resources](#resources) of each sandbox set its share of that hardware. The [pricing](https://www.daytona.com/pricing) page sets its price per Mac-hour, and each reservation period is charged as 24 Mac-hours when the period starts.

| **Model**        | **ID**          | **Cores** | **Memory** | **Sandbox disk** | **Sandboxes at a time** |
| ---------------- | --------------- | --------- | ---------- | ---------------- | ----------------------- |
| **Apple M4**     | `m4-10c-16g`    | **10**    | **16 GiB** | **80 GiB**       | **1**                   |
| **Apple M4 Pro** | `m4pro-12c-24g` | **12**    | **24 GiB** | **276 GiB**      | **Up to 2**             |
| **Apple M4 Pro** | `m4pro-12c-48g` | **12**    | **48 GiB** | **236 GiB**      | **Up to 2**             |
| **Apple M5 Pro** | `m5pro-15c-24g` | **15**    | **24 GiB** | **287 GiB**      | **Up to 2**             |

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

const catalog = await daytona.v2.macModels.catalog({ region: 'us-east-bos-1' })
for (const region of catalog.regions) {
  for (const entry of region.models) {
    const perPeriod = entry.price ? `$${(entry.price.periodCents / 100).toFixed(2)}` : 'no price'
    console.log(entry.model.id, 'available:', entry.available, 'per period:', perPeriod)
  }
}

// Model specs only; the catalog adds prices and available Macs per region
for (const model of await daytona.v2.macModels.list()) {
  console.log(model.id, model.cores, model.memoryMib, model.maxSandboxes)
}
```

| **Parameter** | **Description** |
| --- | --- |
| `region` | Limits the catalog to one region.<br />**Default:** every region<br />**Value:** `earth`, `us`, `us-east`, `us-east-ash-1`, `us-east-bos-1`, or `us-east-iad-1`<br />**Example:** `'us-east-bos-1'` |

### Sandbox placement

Sandbox placement is the choice of the host that a sandbox runs on. A placement rule picks between the hosts that have room, and decides whether new capacity is bought when none has.

The placement of a macOS sandbox is one reservation of the organization in the region of the create, with a free slot and enough disk left. It is decided when the sandbox is created.

Name a reservation to choose the Mac a sandbox runs on, or leave it out to take any reservation with room, or one that [auto-reserve](#auto-reserve) buys. Set the reservation to new to buy a reservation for this sandbox alone, the only case in which a create can also set automatic renewal.

### Reserve a Mac

Reserve a Mac to hold it for your organization before you create sandboxes on it. A reservation is a purchase of exclusive capacity for a fixed period.

A purchase of a Mac reservation buys one Mac of one model in one region, for one 24-hour period. Each purchase has an idempotency key, and a retry with the same key returns the same reservation without a second charge.

Give your own idempotency key when your code can retry a purchase. Without one, the SDKs and the CLI make a new key for each call, so a retry buys a second Mac.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

const reservation = await daytona.v2.reservations.create({
  region: 'us-east-bos-1',
  model: 'm4pro-12c-24g',
  idempotencyKey: 'build-mac-2026-10-24',
})
console.log(reservation.id, reservation.status)
```

| **Parameter** | **Description** |
| --- | --- |
| `region` | Sets the region whose Macs to reserve.<br />**Required**<br />**Value:** `earth`, `us`, `us-east`, `us-east-ash-1`, `us-east-bos-1`, or `us-east-iad-1`<br />**Example:** `'us-east-bos-1'` |
| `autoRenew` | Turns on [automatic renewal](#automatic-renewal).<br />**Default:** the organization's auto-reserve setting |
| `idempotencyKey` | Makes a retried purchase return the same reservation.<br />**Default:** a new key for each call<br />**Minimum:** 1 character<br />**Maximum:** 256 characters<br />**Format:** printable ASCII<br />**Example:** `'build-mac-2026-10-24'` |
| `model` | Sets the Mac [model](#models-and-prices) to reserve.<br />**Default:** the region's default model<br />**Value:** `m4-10c-16g`, `m4pro-12c-24g`, `m4pro-12c-48g`, or `m5pro-15c-24g`<br />**Example:** `'m4pro-12c-24g'` |

##### Reserve many Macs

Reserve many Macs to run builds and tests in parallel across a fleet. A bulk purchase buys several units of the same item in one request.

A bulk purchase of Mac reservations reserves from 1 to 100 Macs of one model in one request. Each Mac is a separate reservation with its own ID, period, charge, and renewal.

Set a minimum count to accept fewer Macs than you ask for. By default, the request is all or nothing: if fewer Macs are available than the count, it reserves none and fails. With a minimum count, it reserves as many as are available, if that is at least the minimum.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

const batch = await daytona.v2.reservations.createBulk({
  region: 'us-east-bos-1',
  model: 'm4pro-12c-24g',
  count: 20,
  minCount: 10,
  idempotencyKey: 'ci-fleet-2026-10-24',
})
console.log(`reserved ${batch.reserved} of ${batch.requested} Macs`)
```

| **Parameter** | **Description** |
| --- | --- |
| `region` | Sets the region whose Macs to reserve.<br />**Required**<br />**Value:** `earth`, `us`, `us-east`, `us-east-ash-1`, `us-east-bos-1`, or `us-east-iad-1`<br />**Example:** `'us-east-bos-1'` |
| `count` | Sets how many Macs to reserve.<br />**Required**<br />**Minimum:** `1`<br />**Maximum:** `100`<br />**Example:** `20` |
| `idempotencyKey` | Makes a retried purchase return the same reservations.<br />**Default:** a new key for each call<br />**Minimum:** 1 character<br />**Maximum:** 256 characters<br />**Format:** printable ASCII<br />**Example:** `'ci-fleet-2026-10-24'` |
| `minCount` | Sets the fewest Macs to accept when fewer than the count are available.<br />**Default:** the count<br />**Minimum:** `1`<br />**Maximum:** the count |
| `model` | Sets the Mac [model](#models-and-prices) to reserve.<br />**Default:** the region's default model<br />**Value:** `m4-10c-16g`, `m4pro-12c-24g`, `m4pro-12c-48g`, or `m5pro-15c-24g`<br />**Example:** `'m4pro-12c-24g'` |

### List reservations

List reservations to see which Macs an organization holds and when their periods end. A reservation list is a record of past purchases as well as a view of the current ones.

A list of Mac reservations returns the open reservations of the organization and those that ended in the last 30 days.

List reservations to check their status, period end, and automatic renewal. A page holds 100 reservations by default and up to 200, and the next cursor of a page reads the next one.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

let cursor: string | undefined
do {
  const page = await daytona.v2.reservations.list({ limit: 100, cursor })
  for (const r of page.items) {
    console.log(r.id, r.status, r.model, r.periodEnd, r.autoRenew)
  }
  cursor = page.nextCursor // undefined on the last page
} while (cursor)
```

| **Parameter** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page.<br />**Format:** the nextCursor of the previous page |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

##### Iterate over all reservations

Iterate over all reservations to read every page without handling cursors. An iterator fetches the next page when the current one runs out.

An iteration over Mac reservations stops when a page returns no cursor.

Iterate in the SDKs when you need every reservation. The CLI reads every page in one command.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

for await (const r of daytona.v2.reservations.iter()) {
  console.log(r.id, r.status, r.model, r.periodEnd, r.autoRenew)
}
```

| **Parameter** | **Description** |
| --- | --- |
| `cursor` | Starts the iteration after a previous page.<br />**Format:** the nextCursor of the previous page |
| `limit` | Sets the page size that the iterator fetches.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

### Get a reservation

Get a reservation to read its current status and the end of its period. A get reads one resource by its identifier and changes nothing.

A get of a Mac reservation returns the same fields as an item of the list.

Get a reservation after a purchase to see when it becomes active, or before a renewal.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

const r = await daytona.v2.reservations.get('RESERVATION_ID')
console.log(r.id, r.status, r.periodEnd, r.autoRenew)
```

### Renew a reservation

Renew a reservation to buy the next 24-hour period on the same Mac. A renewal extends a fixed-term purchase by one more term, without a new purchase.

A renewal of a Mac reservation keeps the Mac, its sandboxes, and their disks.

Renew a reservation by hand to keep a Mac past its period when [automatic renewal](#automatic-renewal) is off. Use a new idempotency key for each period you buy, and the same key to retry.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const reservation = await daytona.v2.reservations.get('RESERVATION_ID')

await daytona.v2.reservations.renew(reservation.id, { idempotencyKey: `renew-${reservation.id}-2` })
```

| **Parameter** | **Description** |
| --- | --- |
| `idempotencyKey` | Makes a retried renewal return the reservation without charging another period.<br />**Default:** a new key for each call<br />**Minimum:** 1 character<br />**Maximum:** 256 characters<br />**Format:** printable ASCII<br />**Example:** `'renew-2'` |

> **Notes:**
>
> - **Prerequisites:** The reservation must be active.

### Automatic renewal

Automatic renewal is the purchase of the next period of a fixed-term resource before the current one ends, without a request from its owner. It keeps the resource in use without a gap between periods.

The automatic renewal of a Mac reservation runs in the last hour of its period, and only while a sandbox on that Mac is active: being created, starting, running, or paused. When every sandbox on the Mac is stopped, or it has none, the reservation does not renew and ends with its period.

Turn automatic renewal on for a reservation that sandboxes use across days, and off to let it end with its period. A new reservation takes the organization's auto-reserve setting. A failed renewal records the reason on the reservation, which then ends with its period.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const reservation = await daytona.v2.reservations.get('RESERVATION_ID')

await daytona.v2.reservations.update(reservation.id, { autoRenew: false })
```

| **Parameter** | **Description** |
| --- | --- |
| `autoRenew` | Turns automatic renewal on or off.<br />**Required** |

### Auto-reserve

Auto-reserve is the automatic reservation of a Mac when a sandbox needs one and none is held. It lets a create succeed without a separate purchase step.

The auto-reserve of macOS sandboxes is a setting of the organization, and it buys a 24-hour reservation of the cheapest model that fits the sandbox, with automatic renewal on. It is on by default and holds at most 2 reservations at a time.

Turn auto-reserve off to control every purchase and reserve Macs yourself. It buys a Mac only when your organization holds no live reservation in the region, not when your reservations are only full. When it already holds its maximum, a create fails. An organization admin changes it from the dashboard under Settings, Auto-reserve Macs, or with the requests below.

##### Get the auto-reserve settings

Get the auto-reserve settings to read whether auto-reserve is on and how many reservations it may hold. Settings are stored values that control how a service behaves, and a read returns them without changing them.

A read of the macOS settings returns the values of one organization, including when and by whom auto-reserve was last turned off.

Get the settings before you change them, or to check why a create bought no Mac.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/macos-settings' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request authenticates with a user token, not an API key.
> - **Results:** The response holds macos_auto_reserve, macos_auto_reserve_max_reservations, macos_auto_reserve_disabled_at, and macos_auto_reserve_disabled_by.

##### Set the auto-reserve settings

Set the auto-reserve settings to turn auto-reserve on or off, or to change how many reservations it may hold. A partial update changes only the stored values it names.

An update of the macOS settings applies to one organization. Turning auto-reserve off records the time and the admin, turning it off again keeps them, and turning it on clears them.

Raise the limit when your organization needs more auto-reserved Macs at once than the limit allows.

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
> - **Prerequisites:** The request authenticates with a user token, not an API key.
> - **Compatibility:** The request must set at least one field.

### When a reservation ends

A reservation ends when its last paid period is over and it does not renew. The end of a fixed-term hardware rental returns the hardware to the provider, which erases it before the next customer.

The end of a Mac reservation has no grace period and sends no notice. Only the disks of persistent sandboxes survive it, as unnamed images, and everything else on the Mac is erased.

Watch the end of the period, the automatic renewal setting, and any renewal error on your reservations, or [renew a reservation](#renew-a-reservation) by hand. A failed export holds the erase for up to 24 hours, and the disk of that sandbox is then lost. Copy the console logs and other data you need before the end.

**End of a reservation:**

| **Step** | **What happens**                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **1**    | The reservation enters the **`ending`** status, and no sandbox can start, resume, or be created on it.                                 |
| **2**    | Persistent sandboxes shut down, paused ones after a resume, and each one that ran is exported as an unnamed image that records its ID. |
| **3**    | Sandboxes that are not persistent are deleted with their data.                                                                         |
| **4**    | When every export is saved or has failed, the Mac is erased: the sandbox disks, the console logs, and the macOS user and its files.    |
| **5**    | The Mac is checked and goes back to the pool for the next customer.                                                                    |
| **6**    | The reservation enters the **`released`** status, and every sandbox on it is deleted.                                                  |

| **Data**                              | **After the end**                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Disk of a persistent sandbox**      | Kept as an unnamed image unless its export fails, and deleted after 30 days without a create from it unless you name it. |
| **Snapshots you made**                | Kept, named ones until you delete them and unnamed ones while a sandbox is created from them at least once every 7 days. |
| **Usage records and bills**           | Kept.                                                                                                                    |
| **Sandboxes that are not persistent** | Lost.                                                                                                                    |
| **Memory of paused sandboxes**        | Lost, while the disk is exported.                                                                                        |
| **Console logs**                      | Lost.                                                                                                                    |
| **The Mac**                           | Erased.                                                                                                                  |

##### Continue after the end

Continue after the end to pick up the work of a persistent sandbox on a new reservation. A disk image saved from a stopped machine boots again on other hardware with the same files.

A continuation of a macOS sandbox is a new sandbox created from the image that the end exported. It gets a new machine identity and needs a reservation with room for its disk.

Find the exported image by the ID of the old sandbox, then create a sandbox from it on an existing reservation, a new one, or one that auto-reserve buys. Name the image to keep it past 30 days without use.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

const exports = await daytona.v2.images.list({ anonymous: true, sandboxId: 'OLD_SANDBOX_ID' })
const image = exports.items[0]
await daytona.v2.images.promote(image.id, 'ios-builder-day-2') // optional: keep it
const sandbox = await daytona.v2.createMacos(image.id, {
  region: 'us-east-bos-1',
  persistent: true,
  waitSeconds: 120,
})
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the name that promote gives the image.<br />**Required**<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix such as img_ or sbx_<br />**Example:** `'ios-builder-day-2'` |
| `anonymous` | Lists only the images without a name.<br />**Default:** `false` |
| `sandboxId` | Lists only the images captured from one sandbox.<br />**Format:** a sandbox ID |

> **Notes:**
>
> - **Prerequisites:** Only an image without a name can be named.

## Resources

Resources are the processor cores, memory, and disk space that a sandbox reserves to run code.

| **macOS** | **ID** | **Default** | **Minimum** | **Maximum** |
| --- | --- | --- | --- | --- |
| **Apple M4** | `m4-10c-16g` | 10 cores<br />16 GiB memory<br />80 GiB disk | 4 cores<br />4 GiB memory<br />80 GiB disk | 10 cores<br />16 GiB memory<br />80 GiB disk |
| **Apple M4 Pro** | `m4pro-12c-24g` | 6 cores<br />12 GiB memory<br />122 GiB disk | 4 cores<br />4 GiB memory<br />80 GiB disk | 12 cores<br />24 GiB memory<br />276 GiB disk |
| **Apple M4 Pro** | `m4pro-12c-48g` | 6 cores<br />24 GiB memory<br />102 GiB disk | 4 cores<br />4 GiB memory<br />80 GiB disk | 12 cores<br />48 GiB memory<br />236 GiB disk |
| **Apple M5 Pro** | `m5pro-15c-24g` | 7 cores<br />12 GiB memory<br />127 GiB disk | 4 cores<br />4 GiB memory<br />80 GiB disk | 15 cores<br />24 GiB memory<br />287 GiB disk |

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const r = await daytona.v2.reservations.create({
  region: 'us-east-bos-1',
  model: 'm4pro-12c-24g',
  idempotencyKey: 'shared-mac-1',
})
const a = await daytona.v2.createMacos('base-macos', {
  region: 'us-east-bos-1',
  reservation: r.id,
  resources: { cpu: 4, memory: 8, disk: 100 },
})
const b = await daytona.v2.createMacos('base-macos', {
  region: 'us-east-bos-1',
  reservation: r.id,
  resources: { cpu: 8, memory: 16, disk: 120 },
})
```

| **Parameter** | **Description** |
| --- | --- |
| `reservation` | Sets the [reservation](#sandbox-placement) that the sandbox runs on.<br />**Default:** any reservation of the organization in the region with room, or one that auto-reserve buys<br />**Format:** a reservation ID<br />**Value:** `'new'` for a new reservation of the cheapest model that fits<br />**Example:** `'new'` |
| `resources` | Sets the [resources](#resources) of the sandbox.<br />**Default:** the default resources of the Mac model<br />**Example:** `{ cpu: 4, memory: 8, disk: 100 }` |
| `cpu` | Sets the number of CPU cores.<br />**Default:** the default resources of the Mac model<br />**Minimum:** `4`<br />**Maximum:** the cores of the [Mac model](./macos-sandboxes.md#models-and-prices) |
| `memory` | Sets the memory in GiB.<br />**Default:** the default resources of the Mac model<br />**Minimum:** `4`<br />**Maximum:** the memory of the [Mac model](./macos-sandboxes.md#models-and-prices)<br />**Format:** a value that converts to a whole number of MiB |
| `disk` | Sets the whole guest disk in GiB, macOS included.<br />**Default:** the default resources of the Mac model, or the disk size of a captured image<br />**Minimum:** `80`<br />**Maximum:** the sandbox disk space of the [Mac model](./macos-sandboxes.md#models-and-prices)<br />**Format:** a value that converts to a whole number of MiB |

## Regions

[Regions](./regions.md) are geographic or logical areas in which sandboxes run. Every sandbox runs in a region. A create request can name one, and Daytona places the sandbox on capacity there.

| **Region** | **ID** |
| --- | --- |
| **Earth** | `earth` |
| `└─` **United States** | `us` |
| `   └─` **US East** | `us-east` |
| `      ├─` **Ashburn** | `us-east-ash-1` |
| `      ├─` **Boston** | `us-east-bos-1` |
| `      └─` **N. Virginia** | `us-east-iad-1` |

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.createMacos('base-macos', { region: 'us-east-bos-1' })
```

## Lifecycle

A sandbox lifecycle is the set of states that a sandbox moves through from creation to deletion. A sandbox changes state when a user acts on it, or on its own when a timeout elapses. The actions it accepts, and what it keeps across them, depend on its type.

| **Lifecycle**              | **macOS** |
| -------------------------- | --------- |
| **Stop and start**         | ✓         |
| **Pause and resume**       | ✓         |
| **Fork**                   | ✓         |
| **Delete**                 | ✓         |
| **Filesystem persistence** | ✓         |
| **Memory persistence**     | ✓         |
| **Spot (Preemption)**      | ✗         |

**Lifecycle actions:**

| **Action** | **What happens**                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stop**   | macOS shuts down, and the disk stays on the same Mac and keeps its disk room, while the cores, memory, and slot become available to other sandboxes. Only a persistent sandbox stops, and a stopped sandbox does not keep [automatic renewal](#automatic-renewal) going. |
| **Start**  | macOS boots from the same disk on any Mac of the organization with an open slot and enough cores and memory.                                            |
| **Pause**  | The Mac saves the memory of the sandbox, which keeps its place on the reservation. Only a persistent sandbox pauses.                                    |
| **Resume** | The sandbox continues from the saved memory, or boots from the disk with mac_boot_mode `cold_after_restore_failure` when the memory cannot be restored. |
| **Fork**   | A new sandbox starts with a copy of the disk.                                                                                                           |
| **Delete** | The sandbox and its disk are erased, with no undo.                                                                                                      |

### Stop / start

Stop a sandbox to shut down its operating system and free its processor and memory, and start it to boot again from the same disk. A stop is a clean shutdown that keeps the disk, unlike a delete.

A stop of a macOS sandbox keeps its disk on the same Mac, and a start boots it on any Mac of the organization that has room.

Stop a persistent sandbox between sessions to free the cores and memory of its Mac for other sandboxes. After a start on a different Mac, iCloud asks the user to sign in again. With no reservation in the region, a start buys one if [auto-reserve](#auto-reserve) is on.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.createMacos('base-macos', {
  region: 'us-east-bos-1',
  persistent: true,
})

await sandbox.stop()
await sandbox.wait({ until: 'stopped' })
await sandbox.start({ timeoutSeconds: 120 })

// Stop a sandbox by ID, without fetching it first
await daytona.v2.stop('SANDBOX_ID')

// Start a stopped sandbox by ID
await daytona.v2.start('SANDBOX_ID', { timeoutSeconds: 120 })
```

| **Parameter** | **Description** |
| --- | --- |
| `timeoutSeconds` | Sets how many seconds the call waits for the sandbox to reach the new state.<br />**Default:** `60`<br />**Value:** `0` for no limit<br />**Example:** `120` |
| `until` | Sets the state that wait returns at.<br />**Default:** `'started'`<br />**Example:** `'stopped'` |

> **Notes:**
>
> - **Prerequisites:** The sandbox must be persistent.

### Pause / resume

Pause a sandbox to freeze its processes and save its memory, and resume it to continue where it stopped. A pause keeps running work without the cost of a new boot.

A paused macOS sandbox counts as active, so its reservation keeps renewing automatically.

Pause a persistent sandbox to keep its processes between sessions on the same reservation. A resume that cannot restore the memory boots macOS from the disk instead.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.createMacos('base-macos', {
  region: 'us-east-bos-1',
  persistent: true,
})

await sandbox.pause()
await sandbox.resume()

// Pause a sandbox by ID, without fetching it first
await daytona.v2.pause('SANDBOX_ID')

// Resume a paused sandbox by ID
await daytona.v2.resume('SANDBOX_ID')
```

| **Parameter** | **Description** |
| --- | --- |
| `timeoutSeconds` | Sets how many seconds the call waits for the sandbox to reach the new state.<br />**Default:** `60`<br />**Value:** `0` for no limit<br />**Example:** `120` |

> **Notes:**
>
> - **Prerequisites:** The sandbox must be persistent.

### Fork

Fork a sandbox to copy its disk into a new, independent sandbox. A fork branches the state of a machine so that two copies continue separately.

A fork of a macOS sandbox copies the disk only, never the memory. A fork of a running sandbox boots with a new machine identity.

Fork a persistent sandbox to try a change without touching the source. A fork request that asks for memory fails.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.createMacos('base-macos', {
  region: 'us-east-bos-1',
  persistent: true,
})

const twin = await sandbox.fork({ name: 'ios-builder-2' })
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the display name of the fork.<br />**Default:** the source name followed by -fork<br />**Example:** `'ios-builder-2'` |
| `waitSeconds` | Sets how many seconds the call waits for the fork to settle.<br />**Default:** `60`<br />**Value:** `0` for no wait<br />**Example:** `120` |

> **Notes:**
>
> - **Prerequisites:** The source sandbox must be persistent.

### Delete

Delete a sandbox to remove it and release its resources. Deletion removes a resource permanently, together with the data stored only in it.

A deletion of a macOS sandbox erases the sandbox and its disk, and cannot be undone.

Delete a sandbox when its work is done. To keep its disk, take a [filesystem snapshot](#filesystem-snapshot) first.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.createMacos('base-macos', { region: 'us-east-bos-1' })

await sandbox.delete()
```

| **Parameter** | **Description** |
| --- | --- |
| `timeoutSeconds` | Sets how many seconds the call waits for the sandbox to be deleted.<br />**Default:** `60`<br />**Value:** `0` for no limit<br />**Example:** `120` |

## Persistence

[Persistence](./persistence.md) is how long the state of a sandbox lasts: the files on its disk, and the processes and data in its memory. State that persists outlives the events that would otherwise discard it.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.createMacos('base-macos', {
  region: 'us-east-bos-1',
  persistent: true,
  name: 'ios-builder',
})
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the display name.<br />**Default:** a generated name, sandbox- followed by 8 hexadecimal characters<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix such as sbx_ or img_<br />**Example:** `'ios-builder'` |
| `persistent` | Keeps the disk across stop and start.<br />**Default:** `false`<br />**Rules:** set at creation and cannot change; stop, start, pause, resume, fork, and filesystem snapshots need a persistent sandbox |

### Filesystem persistence

Filesystem persistence keeps the contents of a sandbox's disk, such as installed packages and build artifacts. A sandbox that starts from a preserved filesystem has its environment intact, with nothing to reinstall or rebuild.

### Memory persistence

Memory persistence keeps the runtime state of a sandbox: its running processes and everything loaded in memory. A sandbox that starts from preserved memory continues from the point it was saved, with its processes still running, instead of a clean boot.

## Snapshots

[Snapshots](./snapshots.md) are saved copies of a sandbox at one point in time. A new sandbox starts from a snapshot instead of a clean install, so the setup that many sandboxes share runs only once.

### Filesystem snapshot

A [filesystem snapshot](./images.md#capture-images) is a copy of the disk of a sandbox at one point in time, without its processes or memory. A sandbox started from it boots with the captured files.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.createMacos('base-macos', {
  region: 'us-east-bos-1',
  persistent: true,
})

await sandbox.stop()
const image = await sandbox.captureImage({ name: 'ios-builder-ready' })
const ready = await daytona.v2.images.get(image.id, { wait: 'ready', timeoutSeconds: 3600 })
const copy = await daytona.v2.createMacos('ios-builder-ready', {
  region: 'us-east-bos-1',
  persistent: true,
})
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the image name.<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix such as img_ or sbx_<br />**Example:** `'ios-builder-ready'` |
| `timeoutSeconds` | Sets how many seconds images.get waits for the image.<br />**Value:** `0` for a single long poll<br />**Example:** `3600` |
| `wait` | Holds the request until the image is ready.<br />**Value:** `'ready'` |

> **Notes:**
>
> - **Prerequisites:** The sandbox must be persistent and stopped.
> - **Lifetime:** The sandbox cannot be deleted while the capture still needs its disk.
> - **Recovery:** On `DISK_NOT_READY` shortly after the stop, retry the capture after a short wait while the sandbox saves its disk.
> - **Behaviour:** A sandbox created from the image starts on any Mac of the region with a new machine identity, so apps bound to one machine, such as an iCloud sign-in or some licenses, need a new sign-in.

## Images

[Images](./images.md) are packaged filesystems, together with the configuration a program needs to start: environment variables, a working directory, and a command. An image is built once and read many times, so every sandbox started from it begins in the same state. An image defines the operating system, tools, and files that a sandbox starts with.

| **Property**         | **Value**                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Image**            | `base-macos`                                                                                                                    |
| **Operating system** | macOS 26.6.2                                                                                                                    |
| **Tools**            | Xcode 26.6 and its iPhone simulator, Homebrew (with git, Node.js 24, Ruby, CocoaPods, fastlane, gh and jq) and Python 3.14     |
| **User**             | `lume`, with home `/Users/lume`                                                                                                 |
| **Password**         | `lume`                                                                                                                          |

## User and password

An operating system user is the account that a desktop session and its processes run as. Its password protects system settings and the locked screen.

The user of a macOS sandbox signs in when the sandbox starts, so the desktop opens without a login screen. A sandbox from a filesystem snapshot keeps the user settings of its source, including a changed password.

Enter the password when macOS asks for it, such as when you allow an app under Privacy & Security or unlock the screen. SSH and the desktop view do not use this password, and check your sandbox token instead.

| **Property**         | **Value**                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| **User**             | `lume`                                                                                          |
| **Password**         | `lume`                                                                                          |
| **Administrator**    | Yes                                                                                             |
| **`sudo`**           | Does not ask for a password                                                                     |
| **Sign-in at start** | Automatic                                                                                       |
| **Screen lock**      | Only when you lock the screen or the display sleeps, and the sandbox does not sleep on its own. |

## Logs

Logs are the text output that a program or operating system writes as it runs. They show what happened inside a sandbox after the fact.

**CLI:**

```bash
daytona sandbox logs SANDBOX_ID
daytona sandbox logs SANDBOX_ID --follow
```

> **Notes:**
>
> - **Results:** The log holds the console output of macOS and the lifecycle lines of the platform, so it shows a boot or a lifecycle change. The output of your own commands is read through [process execution](./process-execution.md).
> - **Lifetime:** The log lives on the Mac, and the end of the reservation erases it with the Mac. Copy what you need before the reservation ends.

**API:**

```bash
curl 'https://api.daytona.com/sandboxes/SANDBOX_ID/console-logs' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

> **Notes:**
>
> - **Results:** The log holds the console output of macOS and the lifecycle lines of the platform, so it shows a boot or a lifecycle change. The output of your own commands is read through [process execution](./process-execution.md).
> - **Lifetime:** The log lives on the Mac, and the end of the reservation erases it with the Mac. Copy what you need before the reservation ends.

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
