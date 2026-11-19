# Reservations (TypeScript SDK reference)

## Contents

- [ReservationsService](#reservationsservice)
- [MacReservation](#macreservation)
- [MacReservationBatch](#macreservationbatch)
- [MacReservationEndReason](#macreservationendreason)
- [MacReservationOrigin](#macreservationorigin)
- [MacReservationStatus](#macreservationstatus)
- [CreateReservationOptions](#createreservationoptions)
- [CreateReservationsBulkOptions](#createreservationsbulkoptions)
- [ListReservationsOptions](#listreservationsoptions)
- [RenewReservationOptions](#renewreservationoptions)
- [UpdateReservationOptions](#updatereservationoptions)

## ReservationsService

Dedicated-Mac reservations. A macOS sandbox runs on a Mac the organization
has reserved: reserve one here, or let a macOS create buy one
(`reservation: 'new'`, or the organization's auto-reserve). A reservation
lasts 24-hour periods, each charged when it starts. Reserving, renewing and
turning auto-renew on need macOS access enabled for the organization
(otherwise `403` `FEATURE_NOT_ENABLED`, thrown as
`FeatureNotEnabledError`); listing, reading and turning auto-renew off do not.

### Constructors

#### Constructor

```ts
new ReservationsService(http: AxiosInstance): ReservationsService;
```

**Parameters**:

- `http` _AxiosInstance_

**Returns**:

- `ReservationsService`

### Methods

#### create()

```ts
create(options: CreateReservationOptions): Promise<MacReservation>;
```

Reserve a Mac of `model` in `region`. Mac model slug from GET /mac-models. Omitted uses the region's default model. An unavailable model is never upgraded.
The request always carries an `Idempotency-Key`:
`idempotencyKey` when given, otherwise a random key the SDK generates for
this call. Pass your own key if you may retry, so a retry after a lost
response returns the same reservation instead of reserving a second Mac.
Fails with `ConflictError` `code === 'NO_MAC_AVAILABLE'` when no Mac of
that model is free in the region.

**Parameters**:

- `options` _CreateReservationOptions_

**Returns**:

- `Promise<MacReservation>`

#### createBulk()

```ts
createBulk(options: CreateReservationsBulkOptions): Promise<MacReservationBatch>;
```

Reserve count Macs of one model in region in one request. minCount (default count) is the fewest to accept: with fewer Macs free, the request reserves as many as are free, or none, failing with ConflictError code === 'NO_MAC_AVAILABLE' when fewer than minCount are free. The request always carries an Idempotency-Key: idempotencyKey when given, otherwise a random key the SDK generates for this call. Pass your own key if you may retry, so a retry after a lost response returns the same reservations instead of reserving more Macs.

**Parameters**:

- `options` _CreateReservationsBulkOptions_

**Returns**:

- `Promise<MacReservationBatch>`

#### get()

```ts
get(id: string): Promise<MacReservation>;
```

**Parameters**:

- `id` _string_

**Returns**:

- `Promise<MacReservation>`

#### iter()

```ts
iter(options: ListReservationsOptions = {}): AsyncIterable<MacReservation>;
```

**Parameters**:

- `options` _ListReservationsOptions = \{\}_

**Returns**:

- `AsyncIterable<MacReservation>`

#### list()

```ts
list(options: ListReservationsOptions = {}): Promise<ListResult<MacReservation>>;
```

One page of the organization's reservations.

**Parameters**:

- `options` _ListReservationsOptions = \{\}_

**Returns**:

- `Promise<ListResult<MacReservation>>`

#### renew()

```ts
renew(id: string, options: RenewReservationOptions = {}): Promise<MacReservation>;
```

Renew the reservation for its next period, which the server charges. The request always carries an Idempotency-Key: idempotencyKey when given, otherwise a random key the SDK generates for this call. Pass your own key if you may retry, so a retry after a lost response does not pay for a second period.

**Parameters**:

- `id` _string_
- `options` _RenewReservationOptions = \{\}_

**Returns**:

- `Promise<MacReservation>`

#### update()

```ts
update(id: string, options: UpdateReservationOptions): Promise<MacReservation>;
```

Turn the reservation's auto-renewal on or off. Turning it on needs the
organization's macOS access enabled; turning it off works
without that access, so an organization can stop a reservation renewing. Fails with
`ConflictError` when the reservation is no longer live.

**Parameters**:

- `id` _string_
- `options` _UpdateReservationOptions_

**Returns**:

- `Promise<MacReservation>`

***

## MacReservation

```ts
type MacReservation = {
  id: string
  orgId: string
  projectId: string
  region: string
  autoRenew: boolean
  sandboxesPerMac: number
  slotsUsed: number
  model?: string | null
  capacity?: MacReservationResources | null
  resourcesUsed: MacReservationResources
  periodN: number
  periodSeconds: number
  createdAt: string
  activatedAt?: string | null
  pendingMacStartedAt?: string | null
  periodStartedAt?: string | null
  periodEnd?: string | null
  reissuedAt?: string | null
  endedAt?: string | null
  renewalPending: boolean
  renewalError?: string | null
  status: MacReservationStatus
  rawStatus: string
  endReason?: MacReservationEndReason | null
  rawEndReason?: string | null
  origin: MacReservationOrigin
  rawOrigin: string
}
```

A dedicated-Mac reservation. Timestamps are RFC 3339 strings.

**Properties**:

- `id` _string_
- `orgId` _string_
- `projectId` _string_
- `region` _string_
- `autoRenew` _boolean_
- `sandboxesPerMac` _number_
- `slotsUsed` _number_
- `model?` _string \| null_
- `capacity?` _MacReservationResources \| null_
- `resourcesUsed` _MacReservationResources_
- `periodN` _number_
- `periodSeconds` _number_
- `createdAt` _string_
- `activatedAt?` _string \| null_
- `pendingMacStartedAt?` _string \| null_
- `periodStartedAt?` _string \| null_
- `periodEnd?` _string \| null_
- `reissuedAt?` _string \| null_
- `endedAt?` _string \| null_
- `renewalPending` _boolean_
- `renewalError?` _string \| null_
- `status` _MacReservationStatus_
- `rawStatus` _string_
- `endReason?` _MacReservationEndReason \| null_
- `rawEndReason?` _string \| null_
- `origin` _MacReservationOrigin_
- `rawOrigin` _string_

***

## MacReservationBatch

```ts
type MacReservationBatch = Omit<api.MacReservationBatch, 'reservations'> & {
  reservations: MacReservation[]
}
```

`POST /reservations/bulk`: `requested` (the request's count), `reserved`, and one reservation per reserved Mac.

***

## MacReservationEndReason

```ts
type MacReservationEndReason = (typeof API_MAC_RESERVATION_END_REASONS)[number] | 'unknown'
```

***

## MacReservationOrigin

```ts
type MacReservationOrigin = (typeof API_MAC_RESERVATION_ORIGINS)[number] | 'unknown'
```

`explicit`: bought by `reservations.create()` or a macOS create with `reservation: 'new'`; `auto`: bought by the organization's auto-reserve.

***

## MacReservationStatus

```ts
type MacReservationStatus = (typeof API_MAC_RESERVATION_STATUSES)[number] | 'unknown'
```

***

## CreateReservationOptions

**Properties**:

- `region` _string_ - Region slug to reserve a Mac in.
- `model?` _string_ - Mac model slug from GET /mac-models. Omitted uses the region's default model. An unavailable model is never upgraded.
- `idempotencyKey?` _string_ - A retry with the same key returns the first request's reservation instead of reserving (and
  charging for) a second Mac. Omitted: a random key per call, so pass your own if you may retry.
- `autoRenew?` _boolean_ - Whether the reservation renews itself each period. The server defaults it to
  the organization's auto-reserve setting at purchase time.

***

## CreateReservationsBulkOptions

**Properties**:

- `region` _string_ - Region slug to reserve the Macs in.
- `count` _number_ - How many Macs to reserve, 1 to 100.
- `minCount?` _number_ - The fewest Macs to accept, 1 to count. Omitted means count: all or nothing.
- `model?` _string_ - Mac model slug from GET /mac-models. Omitted uses the region's default model. An unavailable model is never upgraded.
- `autoRenew?` _boolean_ - Whether each reservation renews itself each period. The server defaults it to
  the organization's auto-reserve setting at purchase time.
- `idempotencyKey?` _string_ - A retry with the same key returns the first request's reservations instead of reserving
  more Macs. Omitted: a random key per call, so pass your own if you may retry.

***

## ListReservationsOptions

**Properties**:

- `cursor?` _string_
- `limit?` _number_

***

## RenewReservationOptions

**Properties**:

- `idempotencyKey?` _string_ - A retry with the same key returns the reservation without charging another period.
  Omitted: a random key per call, so pass your own if you may retry.

***

## UpdateReservationOptions

**Properties**:

- `autoRenew` _boolean_ - Whether the reservation renews itself each period.
