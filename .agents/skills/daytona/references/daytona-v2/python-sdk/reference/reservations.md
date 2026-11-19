# Reservations (Python SDK reference)

## Contents

- [ReservationsService](#reservationsservice)
- [AsyncReservationsService](#asyncreservationsservice)
- [MacReservation](#macreservation)
- [MacReservationBatch](#macreservationbatch)
- [MacResources](#macresources)
- [MacReservationStatus](#macreservationstatus)
- [MacReservationEndReason](#macreservationendreason)
- [MacReservationOrigin](#macreservationorigin)

## ReservationsService

```python
class ReservationsService()
```

Dedicated-Mac reservations, which macOS sandboxes run on.

A macOS sandbox runs on a Mac the organization has reserved: reserve one
here, or let a macOS create buy one (`reservation="new"`, or the
organization's auto-reserve). A reservation lasts 24-hour periods, each
charged when it starts. Reserving, renewing and turning auto-renew on need
macOS access enabled for the organization (otherwise `403`
`FEATURE_NOT_ENABLED`, raised as `FeatureNotEnabledError`);
listing, reading and turning auto-renew off do not.

#### ReservationsService.\_\_init\_\_

```python
def __init__() -> None
```

#### ReservationsService.create

```python
def create(*,
           region: str,
           model: Optional[str] = None,
           idempotency_key: Optional[str] = None,
           auto_renew: Optional[bool] = None) -> MacReservation
```

Reserve a Mac of `model` in `region`.

`model`: Mac model slug from GET /mac-models. Omitted uses the region's default model. An unavailable model is never upgraded.

The request always carries an `Idempotency-Key`: `idempotency_key`
when given, otherwise a random UUID the SDK generates for this call.
Pass your own key if you may retry, so a retry after a lost response
returns the same reservation instead of reserving a second Mac.
`auto_renew` defaults server-side to the organization's auto-reserve
setting. Raises `ConflictError` with
`code == "NO_MAC_AVAILABLE"` when no Mac of that model is free in the
region, and `LimitExceededError` (a `RateLimitError`) with
`limit == "max_mac_reservations"` when the organization holds its Mac reservation limit.

#### ReservationsService.create\_bulk

```python
def create_bulk(*,
                region: str,
                count: int,
                min_count: Optional[int] = None,
                model: Optional[str] = None,
                auto_renew: Optional[bool] = None,
                idempotency_key: Optional[str] = None) -> MacReservationBatch
```

Reserve count Macs of one model in region in one request.

min_count (default count) is the fewest to accept: with fewer Macs free or fewer left under the organization's Mac reservation limit, the request reserves as many as are free and fit, or none, failing with LimitExceededError (a RateLimitError) limit == "max_mac_reservations" when fewer than min_count fit under the limit (checked first), or with ConflictError code == "NO_MAC_AVAILABLE" when fewer than min_count are free. The request always carries an Idempotency-Key: idempotency_key when given, otherwise a random key the SDK generates for this call. Pass your own key if you may retry, so a retry after a lost response returns the same reservations instead of reserving more Macs.

#### ReservationsService.get

```python
def get(reservation_id: str, /) -> MacReservation
```

#### ReservationsService.iter

```python
def iter(*,
         cursor: Optional[str] = None,
         limit: Optional[int] = None) -> Iterator[MacReservation]
```

Every reservation of the organization, draining page by page.

#### ReservationsService.list

```python
def list(*,
         cursor: Optional[str] = None,
         limit: Optional[int] = None) -> ListResult[MacReservation]
```

One page of the organization's reservations.

#### ReservationsService.renew

```python
def renew(reservation_id: str,
          /,
          *,
          idempotency_key: Optional[str] = None) -> MacReservation
```

Renew the reservation for its next period, which the server charges.

The request always carries an Idempotency-Key: idempotency_key when given, otherwise a random key the SDK generates for this call. Pass your own key if you may retry, so a retry after a lost response does not pay for a second period.
Raises LimitExceededError (a RateLimitError) with limit == "max_mac_reservations" when the renewal would keep the organization over its Mac reservation limit.

#### ReservationsService.update

```python
def update(reservation_id: str, /, *, auto_renew: bool) -> MacReservation
```

Turn the reservation's auto-renewal on or off.

Turning it on needs macOS access enabled for the organization;
turning it off works without it, so an organization can stop a reservation
renewing. Raises `ConflictError` when the reservation is no longer live.

## AsyncReservationsService

```python
class AsyncReservationsService()
```

Dedicated-Mac reservations, which macOS sandboxes run on.

A macOS sandbox runs on a Mac the organization has reserved: reserve one
here, or let a macOS create buy one (`reservation="new"`, or the
organization's auto-reserve). A reservation lasts 24-hour periods, each
charged when it starts. Reserving, renewing and turning auto-renew on need
macOS access enabled for the organization (otherwise `403`
`FEATURE_NOT_ENABLED`, raised as `FeatureNotEnabledError`);
listing, reading and turning auto-renew off do not.

#### AsyncReservationsService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncReservationsService.create

```python
async def create(*,
                 region: str,
                 model: Optional[str] = None,
                 idempotency_key: Optional[str] = None,
                 auto_renew: Optional[bool] = None) -> MacReservation
```

Reserve a Mac of `model` in `region`.

`model`: Mac model slug from GET /mac-models. Omitted uses the region's default model. An unavailable model is never upgraded.

The request always carries an `Idempotency-Key`: `idempotency_key`
when given, otherwise a random UUID the SDK generates for this call.
Pass your own key if you may retry, so a retry after a lost response
returns the same reservation instead of reserving a second Mac.
`auto_renew` defaults server-side to the organization's auto-reserve
setting. Raises `ConflictError` with
`code == "NO_MAC_AVAILABLE"` when no Mac of that model is free in the
region, and `LimitExceededError` (a `RateLimitError`) with
`limit == "max_mac_reservations"` when the organization holds its Mac reservation limit.

#### AsyncReservationsService.create\_bulk

```python
async def create_bulk(*,
                      region: str,
                      count: int,
                      min_count: Optional[int] = None,
                      model: Optional[str] = None,
                      auto_renew: Optional[bool] = None,
                      idempotency_key: Optional[str] = None) -> MacReservationBatch
```

Reserve count Macs of one model in region in one request.

min_count (default count) is the fewest to accept: with fewer Macs free or fewer left under the organization's Mac reservation limit, the request reserves as many as are free and fit, or none, failing with LimitExceededError (a RateLimitError) limit == "max_mac_reservations" when fewer than min_count fit under the limit (checked first), or with ConflictError code == "NO_MAC_AVAILABLE" when fewer than min_count are free. The request always carries an Idempotency-Key: idempotency_key when given, otherwise a random key the SDK generates for this call. Pass your own key if you may retry, so a retry after a lost response returns the same reservations instead of reserving more Macs.

#### AsyncReservationsService.list

```python
async def list(*,
               cursor: Optional[str] = None,
               limit: Optional[int] = None) -> ListResult[MacReservation]
```

One page of the organization's reservations.

#### AsyncReservationsService.iter

```python
async def iter(*,
               cursor: Optional[str] = None,
               limit: Optional[int] = None) -> AsyncIterator[MacReservation]
```

Every reservation of the organization, draining page by page.

#### AsyncReservationsService.get

```python
async def get(reservation_id: str, /) -> MacReservation
```

#### AsyncReservationsService.renew

```python
async def renew(reservation_id: str,
                /,
                *,
                idempotency_key: Optional[str] = None) -> MacReservation
```

Renew the reservation for its next period, which the server charges.

The request always carries an Idempotency-Key: idempotency_key when given, otherwise a random key the SDK generates for this call. Pass your own key if you may retry, so a retry after a lost response does not pay for a second period.
Raises LimitExceededError (a RateLimitError) with limit == "max_mac_reservations" when the renewal would keep the organization over its Mac reservation limit.

#### AsyncReservationsService.update

```python
async def update(reservation_id: str, /, *, auto_renew: bool) -> MacReservation
```

Turn the reservation's auto-renewal on or off.

Turning it on needs macOS access enabled for the organization;
turning it off works without it, so an organization can stop a reservation
renewing. Raises `ConflictError` when the reservation is no longer live.

## MacReservation

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class MacReservation()
```

**Attributes**:

- `id` _str_
- `org_id` _str_
- `project_id` _str_
- `region` _str_
- `status` _MacReservationStatus_
- `raw_status` _str_
- `period_n` _int_
- `period_seconds` _int_
- `created_at` _datetime_
- `slots_used` _int_
- `renewal_pending` _bool_
- `auto_renew` _bool_
- `origin` _MacReservationOrigin_
- `raw_origin` _str_
- `resources_used` _MacResources_
- `activated_at` _Optional\[datetime\] = None_
- `capacity` _Optional\[MacResources\] = None_
- `model` _Optional\[str\] = None_
- `end_reason` _Optional\[MacReservationEndReason\] = None_
- `raw_end_reason` _Optional\[str\] = None_
- `ended_at` _Optional\[datetime\] = None_
- `pending_mac_started_at` _Optional\[datetime\] = None_
- `period_end` _Optional\[datetime\] = None_
- `period_started_at` _Optional\[datetime\] = None_
- `reissued_at` _Optional\[datetime\] = None_
- `renewal_error` _Optional\[str\] = None_

## MacReservationBatch

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class MacReservationBatch()
```

`POST /reservations/bulk`: `requested` (the request's count), `reserved`, and one reservation per reserved Mac.

**Attributes**:

- `requested` _int_
- `reserved` _int_
- `reservations` _tuple\[MacReservation, ...\]_

## MacResources

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class MacResources()
```

A Mac sandbox size: CPU cores (one Mac CPU each), memory and disk in MiB.

**Attributes**:

- `cores` _int_
- `memory_mib` _int_
- `disk_mib` _int_

## MacReservationStatus

```python
MacReservationStatus = Literal['pending_charge', 'pending_mac', 'active', 'ending', 'released', 'failed', 'unknown']
```

## MacReservationEndReason

```python
MacReservationEndReason = Literal['expired', 'released', 'charge_failed', 'not_accepted', 'reissued', 'operator', 'unknown']
```

## MacReservationOrigin

```python
MacReservationOrigin = Literal['explicit', 'auto', 'unknown']
```
