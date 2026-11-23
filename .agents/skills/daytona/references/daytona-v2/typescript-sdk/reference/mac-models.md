# MacModels (TypeScript SDK reference)

## Contents

- [MacModelsService](#macmodelsservice)
- [MacCatalogOptions](#maccatalogoptions)
- [MacCatalog](#maccatalog)
- [MacModel](#macmodel)
- [MacResources](#macresources)
- [MacPrice](#macprice)
- [MacCatalogModel](#maccatalogmodel)
- [MacCatalogRegion](#maccatalogregion)
- [MacReservation](#macreservation)
- [MacReservationBatch](#macreservationbatch)
- [MacReservationEndReason](#macreservationendreason)
- [MacReservationOrigin](#macreservationorigin)
- [MacReservationStatus](#macreservationstatus)

## MacModelsService

The Mac model registry (`GET /mac-models`): the models `reservations.create({ model })`
accepts, with each model's CPU cores, physical memory, physical SSD capacity and
sandbox disk room in MiB, maximum sandbox count, and default sandbox size. `catalog()` adds free Macs and prices.

### Constructors

#### Constructor

```ts
new MacModelsService(token: Internal, init: never): MacModelsService;
```

Built by the SDK: get it from the client or a sandbox.

**Parameters**:

- `token` _Internal_
- `init` _never_

**Returns**:

- `MacModelsService`

### Methods

#### catalog()

```ts
catalog(options: MacCatalogOptions = {}): Promise<MacCatalog>;
```

Free Macs and prices per model. Availability is advisory; price is absent when unavailable.

**Parameters**:

- `options` _MacCatalogOptions = \{\}_

**Returns**:

- `Promise<MacCatalog>`

#### list()

```ts
list(): Promise<readonly MacModel[]>;
```

Every registered Mac model, ordered by `id`.

**Returns**:

- `Promise<readonly MacModel[]>`

***

## MacCatalogOptions

**Properties**:

- `region?` _string_

***

## MacCatalog

**Properties**:

- `regions` _readonly MacCatalogRegion\[\]_

***

## MacModel

A registered Mac model and the default sandbox size it provides.

**Properties**:

- `id` _string_
- `name` _string_
- `cores` _number_
- `memoryMib` _number_
- `diskMib` _number_
- `sandboxDiskMib` _number_
- `maxSandboxes` _number_
- `defaultSize?` _MacResources_

***

## MacResources

Physical CPU cores, memory, and sandbox disk capacity or usage.

**Properties**:

- `cores` _number_
- `memoryMib` _number_
- `diskMib` _number_

***

## MacPrice

The price of reserving one Mac for a period.

**Properties**:

- `centsPerHour` _number_
- `periodCents` _number_
- `periodSeconds` _number_
- `currency` _string_

***

## MacCatalogModel

**Properties**:

- `model` _MacModel_
- `available` _number_ - Available Macs are advisory; another purchase can consume the capacity.
- `price?` _MacPrice_ - Absent when pricing is unavailable.

***

## MacCatalogRegion

**Properties**:

- `id` _string_
- `defaultModel` _string_
- `models` _readonly MacCatalogModel\[\]_

***

## MacReservation

A dedicated-Mac reservation. Timestamps are RFC 3339 strings.

**Properties**:

- `id` _string_
- `orgId` _string_
- `projectId` _string_
- `region` _string_
- `autoRenew` _boolean_
- `slotsUsed` _number_
- `model?` _string_
- `capacity?` _MacResources_
- `resourcesUsed` _MacResources_
- `periodN` _number_
- `periodSeconds` _number_
- `createdAt` _string_
- `activatedAt?` _string_
- `pendingMacStartedAt?` _string_
- `periodStartedAt?` _string_
- `periodEnd?` _string_
- `reissuedAt?` _string_
- `endedAt?` _string_
- `renewalPending` _boolean_
- `renewalError?` _string_
- `status` _MacReservationStatus_
- `rawStatus` _string_
- `endReason?` _MacReservationEndReason_
- `rawEndReason?` _string_
- `origin` _MacReservationOrigin_
- `rawOrigin` _string_

***

## MacReservationBatch

Reservations created by one bulk purchase.

**Properties**:

- `requested` _number_
- `reserved` _number_
- `reservations` _readonly MacReservation\[\]_

***

## MacReservationEndReason

```ts
type MacReservationEndReason = (typeof END_REASONS)[number] | 'unknown'
```

***

## MacReservationOrigin

```ts
type MacReservationOrigin = (typeof ORIGINS)[number] | 'unknown'
```

How the reservation was bought: explicitly or by auto-reserve.

***

## MacReservationStatus

```ts
type MacReservationStatus = (typeof STATUSES)[number] | 'unknown'
```
