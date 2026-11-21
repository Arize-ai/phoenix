# macOS Sandboxes (TypeScript SDK)

macOS virtual machine sandboxes, their capabilities, use cases, and architecture.

macOS sandboxes are **macOS virtual machines (VMs)** that run on dedicated Apple silicon. They let an agent or a person use macOS and Apple developer tools without owning or managing a Mac.

Daytona runs each macOS sandbox as a virtual machine on a Mac mini that one organization reserves for 24 hours at a time. Code inside it sees a full macOS with a desktop and a shell, and nothing of other organizations, which never share that Mac. Up to two sandboxes share one reserved Mac, and each takes its cores, memory, and disk from it. A sandbox lives only while a reservation holds its Mac, and the end of the reservation erases the Mac.

Use macOS sandboxes to build, test, and automate software that needs macOS, Xcode, or the iPhone simulator. Your organization must have macOS sandboxes turned on before you reserve a Mac or create a sandbox. When your organization holds no reservation, a create can buy one for you.

| **Concept**      | **Description**                                                               |
| ---------------- | ----------------------------------------------------------------------------- |
| **Reservation**  | The exclusive use of one Mac by one organization for a fixed period.          |
| **Model**        | The type of Mac, defined by its chip, memory, and disk.                       |
| **Resources**    | The cores, memory, and disk of one sandbox.                                   |
| **Auto-reserve** | The automatic reservation of a Mac when a sandbox needs one and none is held. |
| **Image**        | A macOS disk that a sandbox starts from.                                      |
| **Persistent**   | A sandbox that keeps its disk across stop and start.                          |

## Contents

- [Use cases](#use-cases)
- [Connect to the macOS API](#connect-to-the-macos-api)
- [Create a macOS sandbox](#create-a-macos-sandbox)
- [Images](#images)
- [Resources](#resources)
- [Mac reservations](#mac-reservations)
- [Persistence](#persistence)
- [Snapshots](#snapshots)
- [Run commands](#run-commands)
- [SSH](#ssh)
- [Desktop](#desktop)
- [Logs](#logs)
- [Lifecycle](#lifecycle)
- [Operations](#operations)
- [Permissions](#permissions)

## Use cases

Use macOS sandboxes when the software, build, or task requires macOS or Apple tooling.

- **Build and test Apple apps.** An agent or a CI job builds and tests iOS and macOS apps with Xcode and the iPhone simulator on a clean Mac. The base image ships with Xcode, its iPhone simulator, Homebrew, and Python. The image runs macOS 26.6.2, and its Homebrew includes CocoaPods, fastlane, and Node.js 24.

- **Computer-use agents on macOS.** An agent operates macOS applications through screenshots and mouse and keyboard input. Computer use also reads the accessibility tree, acts on controls, and records the screen. The desktop is 1280 by 800, and your own VNC client can connect to it over a WebSocket.

- **Long-lived build machines.** A persistent sandbox keeps its disk across stop and start, so installed tools and build caches stay between sessions. To keep the disk after the reservation ends, take a filesystem snapshot. Automatic renewal stops when every sandbox on the Mac is stopped, and the reservation then ends with its period.

- **Remote access over SSH.** A developer or a script connects to the Mac over SSH to run commands and inspect builds. The CLI opens the connection itself, and other SSH clients sign in with a short-lived sandbox token in the user name. The token is limited to one sandbox and to SSH, so no project API key goes into the SSH command.

- **Fleets of Macs.** One request reserves up to 100 Macs for parallel builds and tests. Each Mac is a separate reservation with its own ID, period, charge, and renewal. A minimum count accepts fewer Macs when not enough are available.

## Connect to the macOS API

Connect to the macOS API to send the requests that reserve Macs and manage macOS sandboxes. A connection to a service needs its address and a credential, and reading both from the environment keeps them out of the source code that calls the service.

A connection to the macOS API is separate from the connection to the main API, because macOS sandboxes and Mac reservations live behind their own address, in their own region. It authenticates with a project API key.

Connect before you reserve a Mac or create a macOS sandbox. Create a project API key from the dashboard, then set it and the macOS API address in the environment. Install the exact SDK and CLI versions in the tabs, because pre-release and latest installs lack the macOS features. Give the region of the Macs on each reservation and each macOS create.

| **Service**                               | **Address**                                                  |
| ----------------------------------------- | ------------------------------------------------------------ |
| Dashboard                                 | **`https://app.daytona.com`**                                |
| Daytona API (organizations, API keys)     | **`https://api.daytona.com`**                                |
| macOS API (reservations, macOS sandboxes) | **`https://api.us-macos.daytona.com`**                       |
| Sandbox SSH                               | **`ssh.us-macos.daytona.com`**, port **`2222`**              |
| Desktop over VNC                          | **`wss://proxy.us-macos.daytona.app/vnc/SANDBOX_ID`**        |
| Region of the Macs                        | **`macos-1`**                                                |

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona() // reads DAYTONA_API_KEY and DAYTONA_V2_API_URL
```

> **Notes:**
>
> - **Prerequisites:** The SDK must be installed with `npm install @daytona/sdk@2.0.0-alpha.13`, on Node.js 22.15 or later. The environment must set DAYTONA_API_KEY to a project API key and DAYTONA_V2_API_URL to `https://api.us-macos.daytona.com`. `npm install @daytona/sdk@latest` installs a version without the macOS features.
> - **Compatibility:** The SDK takes memory and disk in GiB and every timeout in seconds.

## Create a macOS sandbox

Create a macOS sandbox to get a macOS virtual machine on a reserved Mac. Creation boots a virtual machine from an image and gives it a fixed share of the processor, memory, and disk of its host.

A create of a macOS sandbox places the sandbox on one Mac reservation of the organization and boots it from a macOS image.

Create a macOS sandbox programmatically after you [connect to the macOS API](#connect-to-the-macos-api). With [auto-reserve](#auto-reserve) on, which is the default, a create without a reservation buys one, so you do not need to reserve a Mac first. With auto-reserve off, [reserve a Mac](#reserve-a-mac) before you create a sandbox. A reservation that a create buys stays bought, even when the sandbox fails to start in time.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.createMacos('base-macos', { region: 'macos-1' })
```

| **Parameter** | **Description** |
| --- | --- |
| `image` | Sets the macOS image that the sandbox starts from.<br />**Required**<br />**Format:** an image name or ID<br />**Example:** `'base-macos'` |
| `reservation` | Sets the [reservation](#sandbox-placement) that the sandbox runs on.<br />**Default:** any reservation of the organization in the region with room, or one that auto-reserve buys<br />**Format:** a reservation ID<br />**Value:** `'new'` for a new reservation of the cheapest model that fits<br />**Example:** `'new'` |
| `autoRenew` | Turns on [automatic renewal](#automatic-renewal) of the reservation that the create buys.<br />**Default:** the organization's auto-reserve setting |
| `persistent` | Keeps the disk across stop and start.<br />**Default:** `false` |
| `resources` | Sets the [resources](#resources) of the sandbox.<br />**Default:** the default resources of the Mac model<br />**Example:** `{ cpu: 4, memory: 8, disk: 100 }` |
| `cpu` | Sets the number of CPU cores.<br />**Default:** the default resources of the Mac model<br />**Minimum:** `4`<br />**Maximum:** the cores of the [Mac model](./macos-sandboxes.md#models-and-prices) |
| `memory` | Sets the memory in GiB.<br />**Default:** the default resources of the Mac model<br />**Minimum:** `4`<br />**Maximum:** the memory of the [Mac model](./macos-sandboxes.md#models-and-prices)<br />**Format:** a value that converts to a whole number of MiB |
| `disk` | Sets the whole guest disk in GiB, macOS included.<br />**Default:** the default resources of the Mac model, or the disk size of a captured image<br />**Minimum:** `80`<br />**Maximum:** the sandbox disk space of the [Mac model](./macos-sandboxes.md#models-and-prices)<br />**Format:** a value that converts to a whole number of MiB |
| `region` | Sets the region.<br />**Default:** the region of the named reservation, otherwise the only region with Macs, otherwise the project's or organization's default region<br />**Format:** a listed region ID<br />**Example:** `'macos-1'` |
| `name` | Sets the display name.<br />**Default:** a generated name, sandbox- followed by 8 hexadecimal characters<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix such as sbx_ or img_<br />**Example:** `'ios-builder'` |
| `waitSeconds` | Sets how many seconds create waits for the sandbox to start.<br />**Default:** `60`<br />**Value:** `0` for no wait<br />**Example:** `120` |
| `createTimeoutSeconds` | Sets how many seconds the sandbox has to reach running before it is deleted.<br />**Default:** `3600`<br />**Maximum:** `86400`<br />**Value:** `-1` for the maximum<br />**Example:** `600` |

> **Notes:**
>
> - **Compatibility:** The other create options, env, labels, secrets, ports, and networkPolicy, work as on [Linux sandboxes](./linux-sandboxes.md#create-a-linux-sandbox).

## Images

[Images](./images.md) are packaged disks that a sandbox starts from. An image is built once and read many times, so every sandbox started from it begins in the same state.

The image of a macOS sandbox is a full macOS disk, with the operating system, its user, and the installed tools. It is set when the sandbox is created and does not change.

Start a sandbox from the base-macos image to build with Xcode and common tools, or from a [filesystem snapshot](#filesystem-snapshot) to start from a prepared disk. The base image signs in as the lume user, as [user and password](#user-and-password) describes.

| **Property**     | **Value**                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Image            | `base-macos`                                                                                                                |
| Operating system | macOS 26.6.2                                                                                                                |
| Tools            | Xcode 26.6 and its iPhone simulator, Homebrew (with git, Node.js 24, Ruby, CocoaPods, fastlane, gh and jq) and Python 3.14 |
| User             | `lume`, with home `/Users/lume`                                                                                             |
| Password         | `lume`                                                                                                                      |

## Resources

Resources are the processor cores, memory, and disk that a sandbox can use. A host divides its own hardware between the sandboxes it runs, so the resources of all of them must fit in the host together.

The resources of a macOS sandbox come from the Mac of its reservation, and its disk is the whole guest disk, macOS included. Up to two sandboxes run on one Mac at the same time. The Mac fixes the resources when it accepts the sandbox, and the sandbox reports them from then on.

Set the resources of each sandbox to share a Mac between two sandboxes, or to give one sandbox the whole Mac. On the m4pro-12c-24g model, one sandbox of 12 cores, 24 GiB memory, and 220 GiB disk uses the whole Mac. A sandbox of 4 cores, 8 GiB, and 100 GiB fits beside one of 8 cores, 16 GiB, and 120 GiB. The SDKs take memory and disk in GiB, the CLI and the API in MiB.

| **Resource** | **Minimum**        | **Maximum on `m4pro-12c-24g`** | **Default on `m4pro-12c-24g`** |
| ------------ | ------------------ | ------------------------------ | ------------------------------ |
| Cores        | 4                  | 12                             | 6                              |
| Memory       | 4 GiB (4096 MiB)   | 24 GiB (24576 MiB)             | 12 GiB (12288 MiB)             |
| Disk         | 80 GiB (81920 MiB) | 220 GiB (225280 MiB)           | 110 GiB (112640 MiB)           |

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const r = await daytona.v2.reservations.create({
  region: 'macos-1', model: 'm4pro-12c-24g', idempotencyKey: 'shared-mac-1',
})
const a = await daytona.v2.createMacos('base-macos', {
  region: 'macos-1', reservation: r.id, resources: { cpu: 4, memory: 8, disk: 100 },
})
const b = await daytona.v2.createMacos('base-macos', {
  region: 'macos-1', reservation: r.id, resources: { cpu: 8, memory: 16, disk: 120 },
})
```

| **Parameter** | **Description** |
| --- | --- |
| `reservation` | Sets the [reservation](#sandbox-placement) that the sandbox runs on.<br />**Default:** any reservation of the organization in the region with room, or one that auto-reserve buys<br />**Format:** a reservation ID<br />**Value:** `'new'` for a new reservation of the cheapest model that fits<br />**Example:** `'new'` |
| `resources` | Sets the [resources](#resources) of the sandbox.<br />**Default:** the default resources of the Mac model<br />**Example:** `{ cpu: 4, memory: 8, disk: 100 }` |
| `cpu` | Sets the number of CPU cores.<br />**Default:** the default resources of the Mac model<br />**Minimum:** `4`<br />**Maximum:** the cores of the [Mac model](./macos-sandboxes.md#models-and-prices) |
| `memory` | Sets the memory in GiB.<br />**Default:** the default resources of the Mac model<br />**Minimum:** `4`<br />**Maximum:** the memory of the [Mac model](./macos-sandboxes.md#models-and-prices)<br />**Format:** a value that converts to a whole number of MiB |
| `disk` | Sets the whole guest disk in GiB, macOS included.<br />**Default:** the default resources of the Mac model, or the disk size of a captured image<br />**Minimum:** `80`<br />**Maximum:** the sandbox disk space of the [Mac model](./macos-sandboxes.md#models-and-prices)<br />**Format:** a value that converts to a whole number of MiB |

## Mac reservations

A Mac reservation is the exclusive use of one Mac by one organization for a fixed period. Reserved hardware is set aside for a single customer, so no other workload competes for it.

The Mac reservation of a macOS sandbox gives one organization one dedicated Mac for a 24-hour period, and nobody else uses that Mac while it is held. The first period starts when a Mac accepts the reservation, not when it is requested. A reservation cannot end early, and it ends with its period unless it renews.

Reserve a Mac to control which Macs your organization holds and pays for, or let [auto-reserve](#auto-reserve) buy one at create. You pay for each period when it starts, and waiting for a Mac is not charged. A reservation that no Mac accepts within 5 minutes fails, and the charge is refunded.

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

The Mac model of a macOS sandbox is the production Mac, an Apple M4 Pro with 12 cores and 24 GB memory. The [pricing](https://www.daytona.com/pricing) page sets its price per Mac-hour, and each reservation period is charged as 24 Mac-hours when the period starts.

Give the model ID m4pro-12c-24g whenever you reserve. Read the Mac catalog for the current price and the number of available Macs, the Macs nobody has reserved. The number is a guide only, because another purchase can reserve a Mac first.

| **Model**             | **Cores** | **Memory** | **Sandbox disk** | **Sandboxes at a time** |
| --------------------- | --------- | ---------- | ---------------- | ----------------------- |
| **`m4pro-12c-24g`**   | 12        | 24 GiB     | 220 GiB          | Up to 2                 |

```typescript
const catalog = await daytona.v2.macModels.catalog({ region: 'macos-1' })
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
| `region` | Limits the catalog to one region.<br />**Default:** every region<br />**Format:** a listed region ID<br />**Example:** `'macos-1'` |

### Sandbox placement

Sandbox placement is the choice of the host that a sandbox runs on. A placement rule picks between the hosts that have room, and decides whether new capacity is bought when none has.

The placement of a macOS sandbox is one reservation of the organization in the region of the create, with a free slot and enough disk left. It is decided when the sandbox is created.

Name a reservation to choose the Mac a sandbox runs on, or leave it out to take any reservation with room. Set the reservation to new to buy a reservation for this sandbox alone, the only case in which a create can also set automatic renewal.

| **Reservation**    | **Where the sandbox goes**                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Not set            | Any reservation of the organization in the region with room, or one that [auto-reserve](#auto-reserve) buys. |
| A reservation ID   | That reservation.                                                                                            |
| `new`              | A new reservation that the create buys for this sandbox.                                                     |

### Reserve a Mac

Reserve a Mac to hold it for your organization before you create sandboxes on it. A reservation is a purchase of exclusive capacity for a fixed period.

A purchase of a Mac reservation buys one Mac of one model in one region, for one 24-hour period. Each purchase has an idempotency key, and a retry with the same key returns the same reservation without a second charge.

Give your own idempotency key when your code can retry a purchase. Without one, the SDKs and the CLI make a new key for each call, so a retry buys a second Mac.

```typescript
const reservation = await daytona.v2.reservations.create({
  region: 'macos-1',
  model: 'm4pro-12c-24g',
  idempotencyKey: 'build-mac-2026-10-24',
})
console.log(reservation.id, reservation.status)
```

| **Parameter** | **Description** |
| --- | --- |
| `region` | Sets the region whose Macs to reserve.<br />**Required**<br />**Format:** a listed region ID<br />**Example:** `'macos-1'` |
| `model` | Sets the Mac [model](#models-and-prices) to reserve.<br />**Default:** the region's default model<br />**Format:** a Mac model ID<br />**Example:** `'m4pro-12c-24g'` |
| `idempotencyKey` | Makes a retried purchase return the same reservation.<br />**Default:** a new key for each call<br />**Maximum:** 256 characters<br />**Format:** printable ASCII<br />**Example:** `'build-mac-2026-10-24'` |
| `autoRenew` | Turns on [automatic renewal](#automatic-renewal).<br />**Default:** the organization's auto-reserve setting |

##### Reserve many Macs

Reserve many Macs to run builds and tests in parallel across a fleet. A bulk purchase buys several units of the same item in one request.

A bulk purchase of Mac reservations reserves from 1 to 100 Macs of one model in one request. Each Mac is a separate reservation with its own ID, period, charge, and renewal.

Set a minimum count to accept fewer Macs than you ask for. By default, the request is all or nothing: if fewer Macs are available than the count, it reserves none and fails. With a minimum count, it reserves as many as are available, if that is at least the minimum.

```typescript
const batch = await daytona.v2.reservations.createBulk({
  region: 'macos-1',
  model: 'm4pro-12c-24g',
  count: 20,
  minCount: 10,
  idempotencyKey: 'ci-fleet-2026-10-24',
})
console.log(`reserved ${batch.reserved} of ${batch.requested} Macs`)
```

| **Parameter** | **Description** |
| --- | --- |
| `region` | Sets the region whose Macs to reserve.<br />**Required**<br />**Format:** a listed region ID<br />**Example:** `'macos-1'` |
| `model` | Sets the Mac [model](#models-and-prices) to reserve.<br />**Default:** the region's default model<br />**Format:** a Mac model ID<br />**Example:** `'m4pro-12c-24g'` |
| `count` | Sets how many Macs to reserve.<br />**Required**<br />**Minimum:** `1`<br />**Maximum:** `100`<br />**Example:** `20` |
| `minCount` | Sets the fewest Macs to accept when fewer than the count are available.<br />**Default:** the count<br />**Minimum:** `1`<br />**Maximum:** the count |
| `idempotencyKey` | Makes a retried purchase return the same reservations.<br />**Default:** a new key for each call<br />**Maximum:** 256 characters<br />**Format:** printable ASCII<br />**Example:** `'ci-fleet-2026-10-24'` |

### Renew a reservation

Renew a reservation to buy the next 24-hour period on the same Mac. A renewal extends a fixed-term purchase by one more term, without a new purchase.

A renewal of a Mac reservation keeps the Mac, its sandboxes, and their disks.

Renew a reservation by hand to keep a Mac past its period when [automatic renewal](#automatic-renewal) is off. Use a new idempotency key for each period you buy, and the same key to retry.

```typescript
await daytona.v2.reservations.renew(reservation.id, { idempotencyKey: `renew-${reservation.id}-2` })
```

| **Parameter** | **Description** |
| --- | --- |
| `idempotencyKey` | Makes a retried renewal return the reservation without charging another period.<br />**Default:** a new key for each call<br />**Maximum:** 256 characters<br />**Format:** printable ASCII<br />**Example:** `'renew-2'` |

> **Notes:**
>
> - **Prerequisites:** The reservation must be active.

### Automatic renewal

Automatic renewal is the purchase of the next period of a fixed-term resource before the current one ends, without a request from its owner. It keeps the resource in use without a gap between periods.

The automatic renewal of a Mac reservation runs in the last hour of its period, and only while a sandbox on that Mac is active: being created, starting, running, or paused. When every sandbox on the Mac is stopped, or it has none, the reservation does not renew and ends with its period.

Turn automatic renewal on for a reservation that sandboxes use across days, and off to let it end with its period. A new reservation takes the organization's auto-reserve setting. A failed renewal records the reason on the reservation, which then ends with its period.

```typescript
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

Get the settings before you change them, or to check why a create bought no Mac. The request goes to the Daytona API, not the macOS API.

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

Raise the limit when your organization needs more auto-reserved Macs at once than the limit allows. The request goes to the Daytona API, not the macOS API.

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
| 1        | The reservation enters the **`ending`** status, and no sandbox can start, resume, or be created on it.                                 |
| 2        | Persistent sandboxes shut down, paused ones after a resume, and each one that ran is exported as an unnamed image that records its ID. |
| 3        | Sandboxes that are not persistent are deleted with their data.                                                                         |
| 4        | When every export is saved or has failed, the Mac is erased: the sandbox disks, the console logs, and the macOS user and its files.    |
| 5        | The Mac is checked and goes back to the pool for the next customer.                                                                    |
| 6        | The reservation enters the **`released`** status, and every sandbox on it is deleted.                                                  |

| **Data**                          | **After the end**                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Disk of a persistent sandbox      | Kept as an unnamed image unless its export fails, and deleted after 30 days without a create from it unless you name it. |
| Snapshots you made                | Kept, named ones until you delete them and unnamed ones while a sandbox is created from them at least once every 7 days.  |
| Usage records and bills           | Kept.                                                                                                                     |
| Sandboxes that are not persistent | Lost.                                                                                                                     |
| Memory of paused sandboxes        | Lost, while the disk is exported.                                                                                         |
| Console logs                      | Lost.                                                                                                                     |
| The Mac                           | Erased.                                                                                                                   |

##### Continue after the end

Continue after the end to pick up the work of a persistent sandbox on a new reservation. A disk image saved from a stopped machine boots again on other hardware with the same files.

A continuation of a macOS sandbox is a new sandbox created from the image that the end exported. It gets a new machine identity and needs a reservation with room for its disk.

Find the exported image by the ID of the old sandbox, then create a sandbox from it on an existing reservation, a new one, or one that auto-reserve buys. Name the image to keep it past 30 days without use.

```typescript
const exports = await daytona.v2.images.list({ anonymous: true, sandboxId: 'OLD_SANDBOX_ID' })
const image = exports.items[0]
await daytona.v2.images.promote(image.id, 'ios-builder-day-2') // optional: keep it
const sandbox = await daytona.v2.createMacos(image.id, { region: 'macos-1', persistent: true, waitSeconds: 120 })
```

| **Parameter** | **Description** |
| --- | --- |
| `anonymous` | Lists only the images without a name.<br />**Default:** `false` |
| `sandboxId` | Lists only the images captured from one sandbox.<br />**Format:** a sandbox ID |
| `name` | Sets the name that promote gives the image.<br />**Required**<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix such as img_ or sbx_<br />**Example:** `'ios-builder-day-2'` |

> **Notes:**
>
> - **Prerequisites:** Only an image without a name can be named.

## Persistence

Persistence is how long the state of a sandbox lasts: the files on its disk, and the processes and data in its memory. State that persists outlives the events that would otherwise discard it.

The persistence of a macOS sandbox is set when the sandbox is created and does not change. Only a persistent sandbox keeps its disk across stop and start.

Create a persistent sandbox for work that must outlast a stop, such as installed tools and build caches. Stop, start, pause, resume, fork, and filesystem snapshots all need a persistent sandbox.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.createMacos('base-macos', {
  region: 'macos-1',
  persistent: true,
  name: 'ios-builder',
})
```

| **Parameter** | **Description** |
| --- | --- |
| `persistent` | Keeps the disk across stop and start.<br />**Default:** `false` |
| `name` | Sets the display name.<br />**Default:** a generated name, sandbox- followed by 8 hexadecimal characters<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix such as sbx_ or img_<br />**Example:** `'ios-builder'` |

### Filesystem persistence

Filesystem persistence keeps the contents of a sandbox's disk: files, installed packages, cloned repositories, and build artifacts. A sandbox with a preserved filesystem starts with its environment intact, with nothing to reinstall or rebuild.

The filesystem of a persistent macOS sandbox stays on its Mac across stop and start for as long as the reservation lives. A restart of the Mac while the sandbox runs brings the sandbox back stopped, with its disk.

To keep the disk beyond the reservation, take a [filesystem snapshot](#filesystem-snapshot), or let the [end of the reservation](#when-a-reservation-ends) export it. A sandbox that is not persistent loses its disk when it is deleted, when the reservation ends, or when its Mac restarts.

### Memory persistence

Memory persistence keeps the runtime state of a sandbox: running processes, open connections, and everything loaded in RAM. A sandbox with preserved memory continues from the point it was frozen, with processes still running, instead of starting from a clean boot.

The memory of a persistent macOS sandbox is saved on its Mac when the sandbox pauses, and the sandbox keeps its place on the reservation. A resume continues from that memory, and the end of the reservation discards it.

[Pause a sandbox](#pause--resume) to keep its processes and memory between sessions on the same reservation. Filesystem snapshots and forks copy the disk only, never the memory.

## Snapshots

Snapshots are saved copies of a sandbox at one point in time. A new sandbox starts from a snapshot instead of a clean install, so the setup that many sandboxes share runs only once.

A snapshot of a macOS sandbox is captured from a stopped persistent sandbox and holds its disk only.

Take a snapshot when many sandboxes must start from the same prepared disk, or to keep a disk after its reservation ends.

### Filesystem snapshot

A filesystem snapshot is a copy of the disk of a sandbox at one point in time, without its processes or memory. A sandbox started from it boots with the captured files.

A filesystem snapshot of a macOS sandbox is an [image](./images.md) of its disk, and new sandboxes start from it on any Mac of the region. A new sandbox from it gets a new machine identity.

Stop the sandbox, capture the image, and wait until it is ready before you create sandboxes from it. Apps bound to one machine, such as an iCloud sign-in or some licenses, need a new sign-in in the new sandbox.

```typescript
await sandbox.stop()
const image = await sandbox.captureImage({ name: 'ios-builder-ready' })
const ready = await daytona.v2.images.get(image.id, { wait: 'ready', timeoutSeconds: 3600 })
const copy = await daytona.v2.createMacos('ios-builder-ready', { region: 'macos-1', persistent: true })
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the image name.<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix such as img_ or sbx_<br />**Example:** `'ios-builder-ready'` |
| `wait` | Holds the request until the image is ready.<br />**Value:** `'ready'` |
| `timeoutSeconds` | Sets how many seconds images.get waits for the image.<br />**Value:** `0` for a single long poll<br />**Example:** `3600` |

> **Notes:**
>
> - **Prerequisites:** The sandbox must be persistent and stopped.
> - **Lifetime:** The sandbox cannot be deleted while the capture still needs its disk.

## Run commands

Run commands to build, test, and inspect software inside a sandbox. A command runs in a shell inside the sandbox and returns its output and exit code.

A command in a macOS sandbox runs in the foreground, where the call returns its output, or in the background, where the call returns a handle to the process.

Run a command to build with xcodebuild or to check the macOS version. File operations, git, and PTYs work as on [Linux sandboxes](./linux-sandboxes.md).

```typescript
const result = await sandbox.exec('sw_vers -productVersion && xcodebuild -version')
console.log(result.exitCode, result.output)
```

## SSH

SSH access is encrypted access to a sandbox over the SSH (Secure Shell) network protocol. It lets a person or a script run commands and inspect files in a sandbox from any SSH client.

SSH access to a macOS sandbox goes through an SSH gateway, which checks a short-lived sandbox token instead of a password or an SSH key. The token is limited to one sandbox and to SSH, and works until it expires.

Connect with the CLI, which opens the connection for you, or with your own SSH client. For your own client, create a token that allows SSH, and put the sandbox ID and the token in the user name, joined by a hash sign (#). Create a new token when the old one expires.

```typescript
const token = await sandbox.createAccessToken({ operations: ['ssh'], ttlSeconds: 3600 })
console.log(`ssh -p 2222 "${sandbox.id}#${token.accessToken}@ssh.us-macos.daytona.com"`)
```

| **Parameter** | **Description** |
| --- | --- |
| `operations` | Sets the operations that the token allows.<br />**Default:** every operation that the caller can grant<br />**Value:** `'toolbox'`, `'toolbox:exec'`, `'toolbox:fs'`, `'toolbox:git'`, `'toolbox:lsp'`, `'desktop'`, `'ssh'`, `'sandbox:stop'`, `'sandbox:pause'`, `'sandbox:delete'`<br />**Example:** `['ssh']` |
| `ttlSeconds` | Sets the token lifetime in seconds.<br />**Default:** `3600`<br />**Maximum:** `86400`<br />**Example:** `600` |

> **Notes:**
>
> - **Clients:** Keep project API keys out of SSH commands, and use a sandbox token scoped to the sandbox and SSH.

## Desktop

A desktop is the graphical interface of an operating system, with windows, a pointer, and a keyboard focus. A desktop in a sandbox lets a person or an agent operate graphical apps that have no command line.

The desktop of a macOS sandbox is 1280 by 800 and takes mouse and keyboard input as soon as it connects.

Open the sandbox from the dashboard and choose the desktop view to watch or control it. To drive it from code, use [computer use](#computer-use), and to view it in your own client, connect a [VNC client](#vnc-client).

### User and password

An operating system user is the account that a desktop session and its processes run as. Its password protects system settings and the locked screen.

The user of a macOS sandbox signs in when the sandbox starts, so the desktop opens without a login screen. A sandbox from a filesystem snapshot keeps the user settings of its source, including a changed password.

Enter the password when macOS asks for it, such as when you allow an app under Privacy & Security or unlock the screen. SSH and the desktop view do not use this password, and check your sandbox token instead.

| **Property**     | **Value**                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------- |
| User             | `lume`                                                                                      |
| Password         | `lume`                                                                                      |
| Administrator    | Yes                                                                                         |
| `sudo`           | Does not ask for a password                                                                 |
| Sign-in at start | Automatic                                                                                   |
| Screen lock      | Only when you lock the screen or the display sleeps, and the sandbox does not sleep on its own. |

### Computer use

Computer use is the control of a graphical desktop by a program, through screenshots and mouse and keyboard input. It lets an agent operate apps the way a person does.

Computer use in a macOS sandbox acts on the desktop of the sandbox. It also reads the accessibility tree and records the screen.

Start computer use before the first screenshot or input. For the other actions, see [computer use](./computer-use.md).

```typescript
const cu = sandbox.computerUse
await cu.start()
const shot = await cu.screen.screenshot()       // shot.screenshot is a base64 PNG
await cu.mouse.click({ x: 640, y: 400 })
await cu.keyboard.type({ text: 'hello from Daytona' })
await cu.keyboard.hotkey({ keys: 'cmd+space' })
```

> **Notes:**
>
> - **Clients:** The a11y property reads the accessibility tree and acts on controls, and the recording property records the screen.

### VNC client

A VNC client is a program that shows a remote desktop and sends mouse and keyboard input to it over the VNC protocol. It lets a person view the desktop of a sandbox in a tool of their choice.

The VNC connection of a macOS sandbox runs over a WebSocket through a proxy, which completes the VNC password step for the client.

Create a sandbox token with the desktop operation and connect a noVNC client to the WebSocket address. Your client must support the DesktopSize encoding, which noVNC supports.

```typescript
const token = await sandbox.createAccessToken({ operations: ['desktop'], ttlSeconds: 3600 })
console.log(`wss://proxy.us-macos.daytona.app/vnc/${sandbox.id}?daytona_token=${token.accessToken}`)
```

| **Parameter** | **Description** |
| --- | --- |
| `operations` | Sets the operations that the token allows.<br />**Default:** every operation that the caller can grant<br />**Value:** `'toolbox'`, `'toolbox:exec'`, `'toolbox:fs'`, `'toolbox:git'`, `'toolbox:lsp'`, `'desktop'`, `'ssh'`, `'sandbox:stop'`, `'sandbox:pause'`, `'sandbox:delete'`<br />**Example:** `['desktop']` |
| `ttlSeconds` | Sets the token lifetime in seconds.<br />**Default:** `3600`<br />**Maximum:** `86400`<br />**Example:** `600` |

## Logs

Logs are the records that an operating system and its programs write while they run. They show what happened inside a sandbox after the fact.

The console log of a macOS sandbox holds its console output and the lifecycle lines of the platform, and lives on the Mac. The end of the reservation erases it with the Mac.

Read the console log to debug a boot or a lifecycle change, and keep your own process logs for builds and tests. Copy what you need before the reservation ends.

| **Log**                   | **Description**                                                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Console log**           | The console output of the macOS sandbox and the platform's lifecycle lines, read at `GET /sandboxes/SANDBOX_ID/console-logs`.                                         |
| **Your own process logs** | The output of a command run with `process.start(...)`, read with `handle.logs()` or `handle.stream_logs()` (TypeScript: `logs()`, `streamLogs()`), or written to a file you copy out. |
| **Usage**                 | The usage of the sandbox, read with `daytona sandbox usage SANDBOX_ID`.                                                                                                 |

**CLI:**

```bash
daytona sandbox logs SANDBOX_ID
daytona sandbox logs SANDBOX_ID --follow
```

**API:**

```bash
curl 'https://api.us-macos.daytona.com/sandboxes/SANDBOX_ID/console-logs' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

## Lifecycle

A lifecycle is the set of states a sandbox moves through from creation to deletion, and the transitions between them. A sandbox changes state when a user acts on it, or automatically when a rule fires on the user's behalf.

A macOS sandbox lives from its create to its deletion or the end of its reservation. Only a persistent sandbox changes state in between, and a sandbox that is not persistent can only run or be deleted.

Stop or pause a persistent sandbox between sessions, and delete a sandbox when its work is done. A stopped sandbox does not keep [automatic renewal](#automatic-renewal) going, so a reservation whose sandboxes are all stopped ends with its period.

**Lifecycle actions:**

| **Action** | **What happens**                                                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stop       | macOS shuts down, and the disk stays on the same Mac and keeps its disk room, while the cores, memory, and slot become available to other sandboxes.                  |
| Start      | macOS boots from the same disk on any Mac of the organization with an open slot and enough cores and memory.                                                          |
| Pause      | The Mac saves the memory of the sandbox, which keeps its place on the reservation.                                                                                    |
| Resume     | The sandbox continues from the saved memory, or boots from the disk with mac_boot_mode `cold_after_restore_failure` when the memory cannot be restored.                |
| Fork       | A new sandbox starts with a copy of the disk.                                                                                                                         |
| Delete     | The sandbox and its disk are erased, with no undo.                                                                                                                    |

### Stop / start

Stop a sandbox to shut down its operating system and free its processor and memory, and start it to boot again from the same disk. A stop is a clean shutdown that keeps the disk, unlike a delete.

A stop of a macOS sandbox keeps its disk on the same Mac, and a start boots it on any Mac of the organization that has room.

Stop a persistent sandbox between sessions to free the cores and memory of its Mac for other sandboxes. After a start on a different Mac, iCloud asks the user to sign in again. With no reservation in the region, a start buys one if [auto-reserve](#auto-reserve) is on.

```typescript
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

Delete a sandbox to erase it and release its share of the Mac. Deletion removes a resource permanently, together with the data stored only in it.

A deletion of a macOS sandbox erases the sandbox and its disk, and cannot be undone.

Delete a sandbox when its work is done. To keep its disk, take a [filesystem snapshot](#filesystem-snapshot) first.

```typescript
await sandbox.delete()
```

| **Parameter** | **Description** |
| --- | --- |
| `timeoutSeconds` | Sets how many seconds the call waits for the sandbox to be deleted.<br />**Default:** `60`<br />**Value:** `0` for no limit<br />**Example:** `120` |

## Operations

Operations on existing resources read them after they are created. A list reads a scope page by page, and a get reads one resource by its identifier.

The operations of macOS sandboxes read the sandboxes and Mac reservations of one organization, and none of them changes either.

List or get a resource to check its status before a step that needs it. Follow the cursor of a list, or iterate over it, to read every page.

### List macOS sandboxes

List macOS sandboxes to find the sandboxes of a region and their states. A paged list returns a fixed number of items per request, with a cursor for the next page.

A list of macOS sandboxes is filtered by region after each page is read.

List the macOS sandboxes of a region with the CLI. A page holds up to 100 sandboxes, and fewer when the region filter removes some, so read every page to see them all.

**CLI:**

```bash
daytona sandbox list --region macos-1
```

| **Flag** | **Description** |
| --- | --- |
| `--region` | Lists the sandboxes of one region.<br />**Format:** a listed region ID<br />**Example:** `macos-1` |
| `--cursor` | Continues from a previous page.<br />**Format:** the cursor that the previous page prints |
| `--all` | Follows every page until the last one. |

### Get a macOS sandbox

Get a macOS sandbox to read its current state and properties by its ID. A get reads one resource and changes nothing.

A get of a macOS sandbox returns the sandbox with its reservation and resources.

Get a sandbox to check its state before a step that needs it, or to work with it from a new process.

```typescript
const sandbox = await daytona.v2.get('SANDBOX_ID')
console.log(sandbox.id, sandbox.reservationId)
```

### List reservations

List reservations to see which Macs an organization holds and when their periods end. A reservation list is a record of past purchases as well as a view of the current ones.

A list of Mac reservations returns the open reservations of the organization and those that ended in the last 30 days.

List reservations to check their status, period end, and automatic renewal. A page holds 100 reservations by default and up to 200, and the next cursor of a page reads the next one.

```typescript
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
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |
| `cursor` | Continues from a previous page.<br />**Format:** the nextCursor of the previous page |

##### Iterate over all reservations

Iterate over all reservations to read every page without handling cursors. An iterator fetches the next page when the current one runs out.

An iteration over Mac reservations stops when a page returns no cursor.

Iterate in the SDKs when you need every reservation. The CLI reads every page in one command.

```typescript
for await (const r of daytona.v2.reservations.iter()) {
  console.log(r.id, r.status, r.model, r.periodEnd, r.autoRenew)
}
```

| **Parameter** | **Description** |
| --- | --- |
| `limit` | Sets the page size that the iterator fetches.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |
| `cursor` | Starts the iteration after a previous page.<br />**Format:** the nextCursor of the previous page |

### Get a reservation

Get a reservation to read its current status and the end of its period. A get reads one resource by its identifier and changes nothing.

A get of a Mac reservation returns the same fields as an item of the list.

Get a reservation after a purchase to see when it becomes active, or before a renewal.

```typescript
const r = await daytona.v2.reservations.get('RESERVATION_ID')
console.log(r.id, r.status, r.periodEnd, r.autoRenew)
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
