# Reservations (TypeScript SDK reference)

## Contents

- [ReservationsService](#reservationsservice)
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
new ReservationsService(token: Internal, init: never): ReservationsService;
```

Built by the SDK: get it from the client or a sandbox.

**Parameters**:

- `token` _Internal_
- `init` _never_

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
that model is free in the region, and throws `LimitExceededError` (a `RateLimitError`) with `limit === 'max_mac_reservations'` when the organization holds its Mac reservation limit.

**Parameters**:

- `options` _CreateReservationOptions_

**Returns**:

- `Promise<MacReservation>`

#### createBulk()

```ts
createBulk(options: CreateReservationsBulkOptions): Promise<MacReservationBatch>;
```

Reserve count Macs of one model in region in one request. minCount (default count) is the fewest to accept: with fewer Macs free or fewer left under the organization's Mac reservation limit, the request reserves as many as are free and fit, or none, throwing LimitExceededError (a RateLimitError) limit === 'max_mac_reservations' when fewer than minCount fit under the limit (checked first), or ConflictError code === 'NO_MAC_AVAILABLE' when fewer than minCount are free. The request always carries an Idempotency-Key: idempotencyKey when given, otherwise a random key the SDK generates for this call. Pass your own key if you may retry, so a retry after a lost response returns the same reservations instead of reserving more Macs.

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

Renew the reservation for its next period, which the server charges. The request always carries an Idempotency-Key: idempotencyKey when given, otherwise a random key the SDK generates for this call. Pass your own key if you may retry, so a retry after a lost response does not pay for a second period. Throws LimitExceededError (a RateLimitError) with limit === 'max_mac_reservations' when the renewal would keep the organization over its Mac reservation limit.

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

## CreateReservationOptions

**Properties**:

- `region` _string_ - Region slug to reserve a Mac in.
- `model?` _string_ - Omitted uses the region's default model; unavailable models are not upgraded.
- `idempotencyKey?` _string_ - Reuse this key on retries to avoid reserving and charging for a second Mac.
- `autoRenew?` _boolean_ - Omitted uses the organization's auto-reserve setting at purchase time.

***

## CreateReservationsBulkOptions

**Properties**:

- `region` _string_ - Region slug to reserve a Mac in.
- `model?` _string_ - Omitted uses the region's default model; unavailable models are not upgraded.
- `idempotencyKey?` _string_ - Reuse this key on retries to avoid reserving and charging for a second Mac.
- `autoRenew?` _boolean_ - Omitted uses the organization's auto-reserve setting at purchase time.
- `count` _number_ - How many Macs to reserve, 1 to 100.
- `minCount?` _number_ - The fewest Macs to accept, 1 to count. Omitted means all or nothing.

***

## ListReservationsOptions

**Properties**:

- `cursor?` _string_
- `limit?` _number_

***

## RenewReservationOptions

**Properties**:

- `idempotencyKey?` _string_ - Reuse this key on retries to avoid charging for another period.

***

## UpdateReservationOptions

**Properties**:

- `autoRenew` _boolean_
