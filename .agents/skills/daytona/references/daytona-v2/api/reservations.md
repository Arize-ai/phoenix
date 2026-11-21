# Daytona API: reservations

Reserve Macs for macOS sandboxes.

## Contents

- [List reservations](#list-reservations)
- [Create a reservation](#create-a-reservation)
- [Create reservations in bulk](#create-reservations-in-bulk)
- [Get a reservation](#get-a-reservation)
- [Update a reservation](#update-a-reservation)
- [Create a reservation renewal](#create-a-reservation-renewal)

## List reservations

`GET /reservations`

**Auth:** `api_key` (`read:sandboxes`), `platform_token` (`read:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of reservations | [ReservationPage](./schemas.md#reservationpage) (`application/json`) |
| 400 | The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create a reservation

`POST /reservations`

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `Idempotency-Key` | header | string | Yes | Unique per organization. A replay with the same body returns the existing reservation |

### Request Body

`application/json`: [CreateReservationRequest](./schemas.md#createreservationrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `auto_renew` | boolean \| null | No | Renew the reservation near each period end while a macOS sandbox is active on it. Defaults to the organization's auto-reserve setting. |
| `model` | string \| null | No | Mac model slug from GET /mac-models. Omitted, null, or blank uses the region's default model, initially m4-10c-16g. If that model is unavailable, the purchase fails; it never upgrades to another model. |
| `region_id` | string | Yes | Region slug whose Macs to reserve. Blank or `local` names no region: when this API serves exactly one region with Macs, the reservation is made there; otherwise the project, organization, then platform default applies. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The reservation, unchanged | [MacReservation](./schemas.md#macreservation) (`application/json`) |
| 201 | The created reservation | [MacReservation](./schemas.md#macreservation) (`application/json`) |
| 400 | The idempotency key, region, model, or another request value is invalid (`BAD_REQUEST`). Missing, unknown, or mistyped fields return `UNPROCESSABLE_ENTITY`. | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 402 | The organization is suspended (`ORG_SUSPENDED`). The project reached its monthly budget (`PROJECT_BUDGET_EXCEEDED`). The organization's balance is too low (`INSUFFICIENT_BALANCE`). The charge did not succeed (`CHARGE_FAILED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The required permission is missing (`FORBIDDEN`). macOS reservations are unavailable (`FEATURE_NOT_ENABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | No Mac of the selected model is available, or the idempotency key identifies another request (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | The organization's Mac reservation limit could not be verified (`BAD_GATEWAY`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | The reservation could not be billed; try again (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create reservations in bulk

`POST /reservations/bulk`

Reserves up to 100 Macs of one model in one region. Each reserved Mac is one reservation with its own period and charge.

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `Idempotency-Key` | header | string | Yes | Unique per organization. A replay with the same body returns the same reservations |

### Request Body

`application/json`: [CreateReservationsBulkRequest](./schemas.md#createreservationsbulkrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `auto_renew` | boolean \| null | No | Renew each reservation near each period end while a macOS sandbox is active on it. Defaults to the organization's auto-reserve setting. |
| `count` | integer (int32) | Yes | How many Macs to reserve, 1 to 100. |
| `min_count` | integer (int32) \| null | No | The fewest Macs to accept, 1 to `count`. Omitted means `count`: all or nothing. With fewer than `count` Macs free, or fewer left under the organization's Mac reservation limit, but at least `min_count`, the request reserves as many as it can. |
| `model` | string \| null | No | Mac model slug from GET /mac-models. Omitted, null, or blank uses the region's default model, initially m4-10c-16g. If that model is unavailable, the purchase fails; it never upgrades to another model. |
| `region_id` | string | Yes | Region slug whose Macs to reserve. Blank or `local` names no region: when this API serves exactly one region with Macs, the reservations are made there; otherwise the project, organization, then platform default applies. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The reservation batch, unchanged | [MacReservationBatch](./schemas.md#macreservationbatch) (`application/json`) |
| 201 | The created reservation batch | [MacReservationBatch](./schemas.md#macreservationbatch) (`application/json`) |
| 400 | The idempotency key, region, model, count, minimum count, or another request value is invalid (`BAD_REQUEST`). Missing, unknown, or mistyped fields return `UNPROCESSABLE_ENTITY`. | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 402 | The organization is suspended (`ORG_SUSPENDED`). The project reached its monthly budget (`PROJECT_BUDGET_EXCEEDED`). The organization's balance is too low for the requested periods (`INSUFFICIENT_BALANCE`). No reservation's charge succeeded (`CHARGE_FAILED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The required permission is missing (`FORBIDDEN`). macOS reservations are unavailable (`FEATURE_NOT_ENABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Fewer Macs of the model are available than the minimum count, or the idempotency key identifies another request (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | The organization's Mac reservation limit could not be verified (`BAD_GATEWAY`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | The reservations could not be billed; try again (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get a reservation

`GET /reservations/{id}`

**Auth:** `api_key` (`read:sandboxes`), `platform_token` (`read:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | The reservation ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The reservation | [MacReservation](./schemas.md#macreservation) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Reservation not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Update a reservation

`PATCH /reservations/{id}`

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | The reservation ID |

### Request Body

`application/json`: [UpdateReservationRequest](./schemas.md#updatereservationrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `auto_renew` | boolean | Yes | Renew the reservation near each period end while a macOS sandbox is active on it; off lets it lapse at `period_end`. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The reservation | [MacReservation](./schemas.md#macreservation) (`application/json`) |
| 400 | The request body is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The required permission is missing (`FORBIDDEN`). macOS reservations are unavailable (`FEATURE_NOT_ENABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Reservation not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The reservation has ended or failed (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create a reservation renewal

`POST /reservations/{id}/renew`

Charges the next period of an active reservation; `period_end` moves out by one period on the same Mac. A retry with the same idempotency key never charges twice.

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | The reservation ID |
| `Idempotency-Key` | header | string | Yes | Unique per reservation renewal. A replay returns the reservation without charging another period |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The reservation | [MacReservation](./schemas.md#macreservation) (`application/json`) |
| 400 | The idempotency key is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 402 | The organization is suspended (`ORG_SUSPENDED`). The project reached its monthly budget (`PROJECT_BUDGET_EXCEEDED`). The organization's balance is too low (`INSUFFICIENT_BALANCE`). The charge did not succeed (`CHARGE_FAILED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The required permission is missing (`FORBIDDEN`). macOS reservations are unavailable (`FEATURE_NOT_ENABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Reservation not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The reservation is not active, or a renewal of it under another idempotency key is still pending (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | The reservation could not be billed; try again (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
