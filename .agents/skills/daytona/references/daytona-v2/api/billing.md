# Daytona API: billing

Manage billing, balances, invoices, and payments.

## Contents

- [Get the automatic top-up](#get-the-automatic-top-up)
- [Set the automatic top-up](#set-the-automatic-top-up)
- [Reset the automatic top-up](#reset-the-automatic-top-up)
- [Get the balance notification](#get-the-balance-notification)
- [Set the balance notification](#set-the-balance-notification)
- [Reset the balance notification](#reset-the-balance-notification)
- [List billing balances](#list-billing-balances)
- [List billing charges](#list-billing-charges)
- [Get a charge receipt PDF](#get-a-charge-receipt-pdf)
- [Get the billing contact](#get-the-billing-contact)
- [Set the billing contact](#set-the-billing-contact)
- [Redeem a billing coupon](#redeem-a-billing-coupon)
- [List billing invoices](#list-billing-invoices)
- [Create an invoice payment session](#create-an-invoice-payment-session)
- [Get an invoice PDF](#get-an-invoice-pdf)
- [Get the organization's MSA](#get-the-organizations-msa)
- [Create a payment method session](#create-a-payment-method-session)
- [List billing payment methods](#list-billing-payment-methods)
- [Get the billing plan](#get-the-billing-plan)
- [Set the billing plan](#set-the-billing-plan)
- [List billing plans](#list-billing-plans)
- [Create a billing portal session](#create-a-billing-portal-session)
- [Get the billing profile](#get-the-billing-profile)
- [List region price multipliers](#list-region-price-multipliers)
- [Create a top-up session](#create-a-top-up-session)
- [List billing usage periods](#list-billing-usage-periods)
- [Get the billing wallet](#get-the-billing-wallet)

## Get the automatic top-up

`GET /orgs/{org_id}/billing/automatic-top-up`

**Auth:** `user_jwt` (`read:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The automatic top-up | [AutomaticTopUp](./schemas.md#automatictopup) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Set the automatic top-up

`PUT /orgs/{org_id}/billing/automatic-top-up`

**Auth:** `user_jwt` (`write:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Request Body

`application/json`: [SetAutomaticTopUpRequest](./schemas.md#setautomatictopuprequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `target_cents` | integer (int64) | Yes | The balance targeted by a top-up, in cents. |
| `threshold_cents` | integer (int64) | Yes | The balance that triggers a top-up, in cents. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The automatic top-up, updated | [AutomaticTopUp](./schemas.md#automatictopup) (`application/json`) |
| 400 | The request body or a field is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`). Automatic top-up is not available for the organization's billing arrangement (`AUTOMATIC_TOP_UP_NOT_AVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 413 | The request body is too large (`PAYLOAD_TOO_LARGE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Reset the automatic top-up

`DELETE /orgs/{org_id}/billing/automatic-top-up`

**Auth:** `user_jwt` (`write:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Automatic top-up reset |  |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get the balance notification

`GET /orgs/{org_id}/billing/balance-notification`

**Auth:** `user_jwt` (`read:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The balance notification | [BalanceNotification](./schemas.md#balancenotification) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Set the balance notification

`PUT /orgs/{org_id}/billing/balance-notification`

**Auth:** `user_jwt` (`write:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Request Body

`application/json`: [SetBalanceNotificationRequest](./schemas.md#setbalancenotificationrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `threshold_cents` | integer (int64) | Yes | The notification threshold in cents. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The balance notification, updated | [BalanceNotification](./schemas.md#balancenotification) (`application/json`) |
| 400 | The request body or a field is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 413 | The request body is too large (`PAYLOAD_TOO_LARGE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Reset the balance notification

`DELETE /orgs/{org_id}/billing/balance-notification`

**Auth:** `user_jwt` (`write:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Balance notification reset |  |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List billing balances

`GET /orgs/{org_id}/billing/balances`

**Auth:** `user_jwt` (`read:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of balances | [BalancePage](./schemas.md#balancepage) (`application/json`) |
| 400 | The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List billing charges

`GET /orgs/{org_id}/billing/charges`

**Auth:** `user_jwt` (`read:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of charges | [ChargePage](./schemas.md#chargepage) (`application/json`) |
| 400 | The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get a charge receipt PDF

`GET /orgs/{org_id}/billing/charges/{charge_id}/pdf`

**Auth:** `user_jwt` (`read:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `charge_id` | path | string | Yes | The charge ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The charge receipt PDF | [ChargeReceiptPdf](./schemas.md#chargereceiptpdf) (`application/pdf`) |
| 400 | The charge ID is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Charge not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`). The charge did not succeed, so it has no receipt (`CHARGE_NOT_SUCCEEDED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get the billing contact

`GET /orgs/{org_id}/billing/contact`

**Auth:** `user_jwt` (`read:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The billing contact | [BillingContact](./schemas.md#billingcontact) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Set the billing contact

`PUT /orgs/{org_id}/billing/contact`

**Auth:** `user_jwt` (`write:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Request Body

`application/json`: [SetBillingContactRequest](./schemas.md#setbillingcontactrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string \| null | No | The billing email to set, or `null` to restore the default. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The billing contact, updated | [BillingContact](./schemas.md#billingcontact) (`application/json`) |
| 400 | The request body or email is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 413 | The request body is too large (`PAYLOAD_TOO_LARGE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Redeem a billing coupon

`POST /orgs/{org_id}/billing/coupons/redeem`

**Auth:** `user_jwt` (`write:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Request Body

`application/json`: [RedeemCouponRequest](./schemas.md#redeemcouponrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | The coupon code. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The created coupon redemption | [CouponRedemption](./schemas.md#couponredemption) (`application/json`) |
| 400 | The request body is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Coupon not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`). The coupon has expired (`COUPON_EXPIRED`). The coupon has reached its redemption limit (`COUPON_LIMIT_REACHED`). The organization has already redeemed this coupon (`COUPON_ALREADY_REDEEMED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 413 | The request body is too large (`PAYLOAD_TOO_LARGE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List billing invoices

`GET /orgs/{org_id}/billing/invoices`

**Auth:** `user_jwt` (`read:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |
| `unpaid` | query | boolean | No | Whether to return only unpaid invoices (default false) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of invoices | [InvoicePage](./schemas.md#invoicepage) (`application/json`) |
| 400 | The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create an invoice payment session

`POST /orgs/{org_id}/billing/invoices/{invoice_id}/payment-sessions`

**Auth:** `user_jwt` (`write:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `invoice_id` | path | string | Yes | The invoice ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The created billing session | [BillingSession](./schemas.md#billingsession) (`application/json`) |
| 400 | The invoice ID is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Invoice not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`). The invoice cannot be paid online (`INVOICE_NOT_PAYABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get an invoice PDF

`GET /orgs/{org_id}/billing/invoices/{invoice_id}/pdf`

**Auth:** `user_jwt` (`read:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `invoice_id` | path | string | Yes | The invoice ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The invoice PDF | [InvoicePdf](./schemas.md#invoicepdf) (`application/pdf`) |
| 400 | The invoice ID is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Invoice not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`). The invoice is not finalized yet (`INVOICE_NOT_FINALIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get the organization's MSA

`GET /orgs/{org_id}/billing/msa`

**Auth:** `user_jwt` (`read:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The MSA | [Msa](./schemas.md#msa) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create a payment method session

`POST /orgs/{org_id}/billing/payment-method-sessions`

**Auth:** `user_jwt` (`write:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The created billing session | [BillingSession](./schemas.md#billingsession) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List billing payment methods

`GET /orgs/{org_id}/billing/payment-methods`

**Auth:** `user_jwt` (`read:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of payment methods | [PaymentMethodPage](./schemas.md#paymentmethodpage) (`application/json`) |
| 400 | The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get the billing plan

`GET /orgs/{org_id}/billing/plan`

**Auth:** `user_jwt` (`read:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The billing plan | [BillingPlan](./schemas.md#billingplan) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Set the billing plan

`PUT /orgs/{org_id}/billing/plan`

**Auth:** `user_jwt` (`write:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Request Body

`application/json`: [SetPlanRequest](./schemas.md#setplanrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `plan` | [PlanName](./schemas.md#planname) | Yes | The requested plan. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The billing plan, updated | [BillingPlan](./schemas.md#billingplan) (`application/json`) |
| 400 | The named plan does not exist (`UNKNOWN_PLAN`). The named plan is arranged through the Daytona sales team, not through this API (`PLAN_REQUIRES_SALES`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`). The organization is already on the requested plan (`PLAN_UNCHANGED`). An earlier plan change is still in progress (`PLAN_CHANGE_PENDING`). The organization's plan is managed by Daytona and cannot be changed here (`PLAN_MANAGED_BY_OPERATOR`). The requested plan needs a payment method on file (`PAYMENT_METHOD_REQUIRED`). The organization's billing account does not allow this plan (`BILLING_ACCOUNT_CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List billing plans

`GET /orgs/{org_id}/billing/plans`

**Auth:** `user_jwt` (`read:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The billing plans | [PlanList](./schemas.md#planlist) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create a billing portal session

`POST /orgs/{org_id}/billing/portal-sessions`

**Auth:** `user_jwt` (`write:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The created billing session | [BillingSession](./schemas.md#billingsession) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get the billing profile

`GET /orgs/{org_id}/billing/profile`

**Auth:** `user_jwt` (`read:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The billing profile | [BillingProfile](./schemas.md#billingprofile) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List region price multipliers

`GET /orgs/{org_id}/billing/region-multipliers`

Lists the price multiplier for each selectable region. Sandbox resource prices are the base price times the multiplier for the requested region; `earth` has multiplier 1.0. When no region is requested, the default region’s multiplier applies, or `earth` when no default exists.

**Auth:** `user_jwt` (`read:billing`), `org_key` (`read:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The region price multipliers | [RegionMultiplierList](./schemas.md#regionmultiplierlist) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is disabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | The billing service could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create a top-up session

`POST /orgs/{org_id}/billing/top-up-sessions`

**Auth:** `user_jwt` (`write:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Request Body

`application/json`: [CreateTopUpSessionRequest](./schemas.md#createtopupsessionrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount_cents` | integer (int64) | Yes | The amount to add in cents. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The created billing session | [BillingSession](./schemas.md#billingsession) (`application/json`) |
| 400 | The request body or amount is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 413 | The request body is too large (`PAYLOAD_TOO_LARGE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List billing usage periods

`GET /orgs/{org_id}/billing/usage-periods`

**Auth:** `user_jwt` (`read:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of usage periods | [UsagePeriodPage](./schemas.md#usageperiodpage) (`application/json`) |
| 400 | The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get the billing wallet

`GET /orgs/{org_id}/billing/wallet`

**Auth:** `user_jwt` (`read:billing`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The wallet | [Wallet](./schemas.md#wallet) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Billing is still being set up (`BILLING_NOT_PROVISIONED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Billing is not enabled (`BILLING_DISABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Billing could not complete the request (`BILLING_UNREACHABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Billing is temporarily unavailable (`BILLING_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
