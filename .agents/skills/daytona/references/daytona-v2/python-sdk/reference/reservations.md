# Reservations (Python SDK reference)

## Contents

- [ReservationService](#reservationservice)
- [AsyncReservationService](#asyncreservationservice)
- [MacReservation](#macreservation)
- [MacReservationBatch](#macreservationbatch)
- [MacReservationStatus](#macreservationstatus)
- [MacReservationEndReason](#macreservationendreason)
- [MacReservationOrigin](#macreservationorigin)

## ReservationService

```python
class ReservationService()
```

Dedicated-Mac reservations, which macOS sandboxes run on.

#### ReservationService.\_\_init\_\_

```python
def __init__(impl: AsyncReservationService, bridge: SyncBridge) -> None
```

#### ReservationService.create

```python
def create(*,
           region: str,
           model: Optional[str] = None,
           idempotency_key: Optional[str] = None,
           auto_renew: Optional[bool] = None) -> MacReservation
```

Reserve a Mac of `model` in `region`.

#### ReservationService.create\_bulk

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

#### ReservationService.get

```python
def get(reservation_id: str) -> MacReservation
```

#### ReservationService.iter

```python
def iter(*,
         cursor: Optional[str] = None,
         limit: Optional[int] = None) -> Iterator[MacReservation]
```

Every reservation of the organization, draining page by page.

#### ReservationService.list

```python
def list(*,
         cursor: Optional[str] = None,
         limit: Optional[int] = None) -> ListResult[MacReservation]
```

One page of the organization's reservations.

#### ReservationService.renew

```python
def renew(reservation_id: str,
          *,
          idempotency_key: Optional[str] = None) -> MacReservation
```

Renew the reservation for its next period, which the server charges.

#### ReservationService.update

```python
def update(reservation_id: str, *, auto_renew: bool) -> MacReservation
```

Turn the reservation's auto-renewal on or off.

## AsyncReservationService

```python
class AsyncReservationService()
```

Dedicated-Mac reservations, which macOS sandboxes run on.

A macOS sandbox runs on a Mac the organization has reserved: reserve one
here, or let a macOS create buy one (`reservation="new"`, or the
organization's auto-reserve). A reservation lasts 24-hour periods, each
charged when it starts. Reserving, renewing and turning auto-renew on need
macOS access enabled for the organization (otherwise `403`
`FEATURE_NOT_ENABLED`, raised as `FeatureNotEnabledError`);
listing, reading and turning auto-renew off do not.

#### AsyncReservationService.\_\_init\_\_

```python
def __init__(transport: AsyncTransport) -> None
```

#### AsyncReservationService.create

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
region.

#### AsyncReservationService.create\_bulk

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

min_count (default count) is the fewest to accept: with fewer Macs free, the request reserves as many as are free, or none, failing with ConflictError code == "NO_MAC_AVAILABLE" when fewer than min_count are free. The request always carries an Idempotency-Key: idempotency_key when given, otherwise a random key the SDK generates for this call. Pass your own key if you may retry, so a retry after a lost response returns the same reservations instead of reserving more Macs.

#### AsyncReservationService.list

```python
async def list(*,
               cursor: Optional[str] = None,
               limit: Optional[int] = None) -> ListResult[MacReservation]
```

One page of the organization's reservations.

#### AsyncReservationService.iter

```python
async def iter(*,
               cursor: Optional[str] = None,
               limit: Optional[int] = None) -> AsyncIterator[MacReservation]
```

Every reservation of the organization, draining page by page.

#### AsyncReservationService.get

```python
async def get(reservation_id: str) -> MacReservation
```

#### AsyncReservationService.renew

```python
async def renew(reservation_id: str,
                *,
                idempotency_key: Optional[str] = None) -> MacReservation
```

Renew the reservation for its next period, which the server charges.

The request always carries an Idempotency-Key: idempotency_key when given, otherwise a random key the SDK generates for this call. Pass your own key if you may retry, so a retry after a lost response does not pay for a second period.

#### AsyncReservationService.update

```python
async def update(reservation_id: str, *, auto_renew: bool) -> MacReservation
```

Turn the reservation's auto-renewal on or off.

Turning it on needs macOS access enabled for the organization;
turning it off works without it, so an organization can stop a reservation
renewing. Raises `ConflictError` when the reservation is no longer live.

## MacReservation

```python
@dataclass(frozen=True, slots=True)
class MacReservation()
```

**Attributes**:

- `id` _str_
- `org_id` _str_
- `project_id` _str_
- `region` _str_
- `status` _MacReservationStatus_
- `raw_status` _str_
- `sandboxes_per_mac` _int_
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
@dataclass(frozen=True, slots=True)
class MacReservationBatch()
```

`POST /reservations/bulk`: `requested` (the request's count), `reserved`, and one reservation per reserved Mac.

**Attributes**:

- `requested` _int_
- `reserved` _int_
- `reservations` _List\[MacReservation\]_

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
