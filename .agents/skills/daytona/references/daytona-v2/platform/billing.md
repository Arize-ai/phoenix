# Billing

Overview of your organization's billing, wallet, and usage details.

Billing covers your [wallet](#wallet) and [spending](#spending). It is pay-as-you-go: you are charged for the resources your sandboxes use, with the guaranteed resources you reserve as a floor. For information on sandbox resource limits and rate limits, see [limits](../python-sdk/limits.md). Billing is scoped to the organization.

## Contents

- [Sandbox billing](#sandbox-billing)
- [Plan](#plan)
- [Wallet](#wallet)
- [Spending](#spending)
- [Suspension](#suspension)
- [Permissions](#permissions)

## Sandbox billing

Daytona bills the compute, memory, GPUs, and operating system of each running sandbox per second, and volumes for the data they store, with each rate priced per hour. See [pricing](https://www.daytona.com/pricing) for the prices.

| **Rate** | **Unit** | **Billed for** |
| --- | --- | --- |
| **Compute** | Core per hour | The CPU guarantee, or the CPU the sandbox uses when it uses more, at the price of its CPU type |
| **Memory** | GiB per hour | The memory guarantee, or the memory the sandbox uses when it uses more |
| **Ephemeral disk** | GiB per hour | Nothing, since the NVMe SSD disk of a sandbox is free |
| [**Volumes**](../python-sdk/volumes.md) | GiB per hour | The data stored, at the on-demand price only |
| **GPU** | GPU per hour | Each GPU attached to the sandbox |
| **Operating system** | Core per hour | Nothing on Linux, and each core on macOS and Windows |
| [**Mac reservation**](../python-sdk/macos-sandboxes.md#mac-reservations) | Mac per 24 hours | Each reserved Mac, paid when each 24-hour period starts |

| **Factor** | **Effect on the bill** |
| --- | --- |
| **Running** | Billed per second for every rate except Mac reservations |
| **Stopped or paused** | Not billed for compute, memory, GPUs, or the operating system, while its volumes stay billed |
| **Deleted** | Not billed |
| [**Preemptible**](../python-sdk/preemption.md#spot-sandboxes) | A lower price than on demand for every rate except volumes and Mac reservations |
| **CPU type** | One of three compute price tiers: AMD Zen 3, Intel Ice Lake, AWS Graviton 4, and Apple M4; AMD Zen 4, Intel Rapids, AWS Graviton 5, and Apple M4 Pro; AMD Zen 5 and Apple M5 Pro |
| [**Region**](../python-sdk/regions.md#list-region-price-multipliers) | Set by the price multiplier of the region you request |
| **Core** | 2 vCPUs where SMT is available and enabled, and 1 vCPU otherwise |
| [**Free credits**](#credit-balances) | Used before paid credits for every rate except GPUs, with a one-time grant on Starter and a monthly grant on Team that expires at the end of each billing period |

## Plan

### Get the plan

Get the plan: the organization's current plan, its limits and entitlements, and any pending change. The plan catalog lists the plans an organization can choose.

**CLI:**

```bash
daytona billing plan get --org ORGANIZATION_ID

# Plan catalog
daytona billing plan list --org ORGANIZATION_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/plan' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'

# Plan catalog
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/plans' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Change the plan

Change the plan. Self-serve changes switch between the Starter and Team plans; the Enterprise plan is arranged with sales. The Team plan has a monthly fee, billed in advance, and includes monthly credits that expire at the end of the billing period. See [pricing](https://www.daytona.com/pricing) for the amounts. A change to Team applies immediately; a pre-paid organization needs a payment method on file first. A change to Starter takes effect at the end of the billing period and shows as pending until then.

**CLI:**

```bash
# starter or team
daytona billing plan set team --org ORGANIZATION_ID
```

| **Flag** | **Description** |
| --- | --- |
| `<plan>` | Sets the plan.<br />**Required**<br />**Value:** `starter` or `team`<br />**Example:** `team` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. A pre-paid organization must have a payment method on file to change to the Team plan.
> - **Confirmation:** The command asks for confirmation at a terminal and requires --yes otherwise.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/plan' \
  --request PUT \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "plan": "team" }'
```

| **Field** | **Description** |
| --- | --- |
| `plan` | Sets the plan.<br />**Required**<br />**Value:** `starter` or `team`<br />**Example:** `"team"` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. A pre-paid organization must have a payment method on file to change to the Team plan.

## Wallet

[Daytona Wallet ↗](https://app.daytona.com/dashboard/billing/wallet) is the central hub for managing your organization's wallet, including balances, credit consumption, and payment methods. New organizations are provisioned with the billing provider within a few minutes of creation; until then the wallet shows a provisioning notice.

### Redeem coupon

Redeem a coupon to add free credits to your wallet. Each coupon can be redeemed once per organization. Coupon credits may carry an expiration date, shown in [credit balances](#credit-balances).

1. Go to [Daytona Wallet ↗](https://app.daytona.com/dashboard/billing/wallet)
2. Navigate to the **Redeem coupon** section
3. Enter the coupon code
4. Click **Redeem**

**CLI:**

```bash
daytona billing coupon redeem COUPON_CODE --org ORGANIZATION_ID
```

| **Flag** | **Description** |
| --- | --- |
| `<code>` | Sets the coupon code.<br />**Required**<br />**Format:** 1 to 64 letters, digits, underscores, and hyphens |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/coupons/redeem' \
  --request POST \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "code": "COUPON_CODE" }'
```

| **Field** | **Description** |
| --- | --- |
| `code` | Sets the coupon code.<br />**Required**<br />**Format:** 1 to 64 letters, digits, underscores, and hyphens |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Balance

Balance displays the credit balances available to your organization.

| **Field**                 | **Description**                                                           |
| ------------------------- | ------------------------------------------------------------------------- |
| **Total balance**         | The sum of free and paid credits.                                         |
| **Free credits**          | The amount of granted credits, such as coupons or card-connected credits. |
| **Paid credits**          | The amount of purchased credits.                                          |
| **Spent this month**      | Usage charged in the current billing period.                              |
| **Amount due this month** | The open amount of the current invoice, shown only when non-zero.         |

The balance of an organization is its free credits and its paid credits, and free credits are consumed first. When both are exhausted, the paid balance shows the amount due as a negative number.

1. Go to [Daytona Wallet ↗](https://app.daytona.com/dashboard/billing/wallet)
2. Navigate to the **Balance** section

**CLI:**

```bash
daytona billing wallet --org ORGANIZATION_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/wallet' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

**Response:**

```json
{
  "balance_cents": 12500,
  "free_credits_balance_cents": 2500,
  "paid_credits_balance_cents": 10000,
  "total_spent_this_month_cents": 4321,
  "total_amount_due_this_month_cents": 0,
  "currency": "usd",
  "billing_type": "pre-paid",
  "automatic_top_up": { "enabled": true, "threshold_cents": 2000, "target_cents": 10000, "currency": "usd" }
}
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Credit balances

Credit balances itemizes every credit grant and top-up.

| **Field**      | **Description**                      |
| -------------- | ------------------------------------ |
| **Name**       | The grant or top-up.                 |
| **Type**       | Free or paid.                        |
| **Remaining**  | The unspent amount.                  |
| **Granted**    | The original amount.                 |
| **Expires**    | The expiration date, if any.         |
| **Applies to** | The products the credit can pay for. |

1. Go to [Daytona Wallet ↗](https://app.daytona.com/dashboard/billing/wallet)
2. Navigate to the **Credit Balances** section
3. Click **Show**

**CLI:**

```bash
# Paginated; pass the returned next_cursor as --cursor for more rows, or --all for every page
daytona billing balances --org ORGANIZATION_ID --limit 25
```

| **Flag** | **Description** |
| --- | --- |
| `--all` | Reads every page. |
| `--cursor` | Continues from a previous page. |
| `--limit` | Sets the page size.<br />**Default:** `25`<br />**Minimum:** `1`<br />**Maximum:** `100` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
# Paginated; follow next_cursor for more rows
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/balances?limit=25' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

| **Field** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `limit` | Sets the page size.<br />**Minimum:** `1`<br />**Maximum:** `100`<br />**Example:** `25` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Balance notification

Balance notification emails the organization's billing contact when the balance drops below a threshold, or the creator when none is set.

1. Go to [Daytona Wallet ↗](https://app.daytona.com/dashboard/billing/wallet)
2. Navigate to the **Balance notification** section
3. Enable the notification and set the threshold
4. Click **Save**

**CLI:**

```bash
# Threshold in cents
daytona billing balance-notification set --threshold-cents 1000 --org ORGANIZATION_ID

# Billing contact for notifications and receipts
daytona billing contact set --email finance@example.com --org ORGANIZATION_ID

# Read the current rule
daytona billing balance-notification get --org ORGANIZATION_ID

# Read the billing contact
daytona billing contact get --org ORGANIZATION_ID

# Turn off the notification
daytona billing balance-notification delete --org ORGANIZATION_ID
```

| **Flag** | **Description** |
| --- | --- |
| `--threshold-cents` | Sets the balance in cents below which the notification is sent.<br />**Required**<br />**Minimum:** `500`<br />**Maximum:** `5000000`<br />**Example:** `1000` |
| `--email` | Sets the billing contact email for notifications and receipts.<br />**Example:** `finance@example.com` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.
> - **Confirmation:** daytona billing balance-notification delete prompts at a terminal and requires --yes elsewhere.

**API:**

```bash
# Threshold in cents
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/balance-notification' \
  --request PUT \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "threshold_cents": 1000 }'

# Billing contact for notifications and receipts
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/contact' \
  --request PUT \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "email": "finance@example.com" }'

# Read the current rule: { "enabled": true, "threshold_cents": 1000, "currency": "usd" }
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/balance-notification' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'

# Read the billing contact. effective_email is the address mail goes to: email, or the creator's email when unset
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/contact' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'

# Turn off the notification
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/balance-notification' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

| **Field** | **Description** |
| --- | --- |
| `threshold_cents` | Sets the balance in cents below which the notification is sent.<br />**Required**<br />**Minimum:** `500`<br />**Maximum:** `5000000`<br />**Example:** `1000` |
| `email` | Sets the billing contact email for notifications and receipts.<br />**Value:** `null` for the default contact<br />**Example:** `"finance@example.com"` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Billing information

Billing information displays the name, email, phone number, and address on file with the payment provider. It is read-only in the dashboard; edit it through the billing portal.

1. Go to [Daytona Wallet ↗](https://app.daytona.com/dashboard/billing/wallet)
2. Navigate to the **Billing info** section
3. Click **Edit** to open the billing portal

**CLI:**

```bash
daytona billing profile --org ORGANIZATION_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/profile' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Payment method

Payment method connects your wallet to a card, allowing you to add funds to your balance and pay invoices. Payment methods are managed through the hosted billing portal. Personal organizations receive a one-time grant of free credits when the first card is connected, and another when the creator verifies their email address.

1. Go to [Daytona Wallet ↗](https://app.daytona.com/dashboard/billing/wallet)
2. Navigate to the **Payment methods** section
3. Click **Add payment method**, or **Edit** if a card is already on file
4. Follow the prompts in the billing portal

**CLI:**

```bash
daytona billing payment-methods --org ORGANIZATION_ID

# Hosted checkout URL for adding a payment method
daytona billing payment-method-session --org ORGANIZATION_ID

# Hosted billing portal URL for managing payment methods and billing details
daytona billing portal-session --org ORGANIZATION_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/payment-methods' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'

# Hosted checkout URL for adding a payment method
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/payment-method-sessions' \
  --request POST \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'

# Hosted billing portal URL for managing payment methods and billing details
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/portal-sessions' \
  --request POST \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Automatic top-up

Automatic top-up adds credits to your wallet when the balance drops below a threshold. Automatic top-up is available for pre-paid organizations and is disabled after a failed payment; update the payment method and enable it again.

1. Go to [Daytona Wallet ↗](https://app.daytona.com/dashboard/billing/wallet)
2. Navigate to the **Automatic top-up** section
3. Add or update the **when balance is low** and **bring balance to** values
4. Click **Save**

**CLI:**

```bash
# Amounts in cents
daytona billing automatic-top-up set --threshold-cents 2000 --target-cents 10000 --org ORGANIZATION_ID

# Read the current rule
daytona billing automatic-top-up get --org ORGANIZATION_ID

# Turn off automatic top-up
daytona billing automatic-top-up delete --org ORGANIZATION_ID
```

| **Flag** | **Description** |
| --- | --- |
| `--threshold-cents` | Sets the balance in cents that triggers a top-up.<br />**Required**<br />**Minimum:** `1000`<br />**Maximum:** `99998999`<br />**Example:** `2000` |
| `--target-cents` | Sets the balance in cents that a top-up brings the wallet to.<br />**Required**<br />**Minimum:** the threshold plus `1000`<br />**Maximum:** `99999999`<br />**Example:** `10000` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The organization must be pre-paid.
> - **Confirmation:** Setting and removing the setting ask for confirmation at a terminal and require --yes otherwise.

**API:**

```bash
# Amounts in cents
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/automatic-top-up' \
  --request PUT \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "threshold_cents": 2000, "target_cents": 10000 }'

# Read the current rule: { "enabled": true, "threshold_cents": 2000, "target_cents": 10000, "currency": "usd" }
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/automatic-top-up' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'

# Turn off automatic top-up
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/automatic-top-up' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

| **Field** | **Description** |
| --- | --- |
| `threshold_cents` | Sets the balance in cents that triggers a top-up.<br />**Required**<br />**Minimum:** `1000`<br />**Maximum:** `99998999`<br />**Example:** `2000` |
| `target_cents` | Sets the balance in cents that a top-up brings the wallet to.<br />**Required**<br />**Minimum:** threshold_cents plus `1000`<br />**Maximum:** `99999999`<br />**Example:** `10000` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The organization must be pre-paid.

### One time top-up

One time top-up buys wallet credits by card on a hosted checkout page. A payment method must be on file.

1. Go to [Daytona Wallet ↗](https://app.daytona.com/dashboard/billing/wallet)
2. Navigate to the **One-time top-up** section
3. Select a preset amount or enter a custom amount
4. Click **Top up**
5. Complete the payment on the checkout page

**CLI:**

```bash
# Amount in cents; returns a checkout URL
daytona billing top-up 5000 --org ORGANIZATION_ID
```

| **Flag** | **Description** |
| --- | --- |
| `[amount-cents]` | Sets the top-up amount in cents.<br />**Minimum:** `1000`<br />**Maximum:** `99999999`<br />**Example:** `5000` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
# Amount in cents; returns a checkout URL
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/top-up-sessions' \
  --request POST \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "amount_cents": 5000 }'
```

| **Field** | **Description** |
| --- | --- |
| `amount_cents` | Sets the top-up amount in cents.<br />**Required**<br />**Minimum:** `1000`<br />**Maximum:** `99999999`<br />**Example:** `5000` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Invoices

Invoices are generated per billing period and for each top-up.

| **Field**    | **Description**                  |
| ------------ | -------------------------------- |
| **Number**   | The invoice identifier.          |
| **Date**     | The date the invoice was issued. |
| **Due date** | The date the invoice is due.     |
| **Total**    | The amount of the invoice.       |
| **Status**   | The status of the invoice.       |
| **Type**     | The type of the invoice.         |

An unpaid invoice shows a warning with a **Pay** button. If a pre-paid organization leaves an invoice unpaid past the grace period, the organization is [suspended](#suspension) until it is paid. Post-paid organizations with a contract are never suspended for unpaid invoices.

1. Go to [Daytona Wallet ↗](https://app.daytona.com/dashboard/billing/wallet)
2. Navigate to the **Invoices** section
3. Click **View** to open the invoice PDF, or **Pay** for an open invoice

**CLI:**

```bash
daytona billing invoices --org ORGANIZATION_ID

daytona billing invoices --unpaid --org ORGANIZATION_ID

daytona billing invoice pdf INVOICE_ID --org ORGANIZATION_ID --out invoice.pdf

# Payment URL for an open invoice
daytona billing invoice payment-session INVOICE_ID --org ORGANIZATION_ID
```

| **Flag** | **Description** |
| --- | --- |
| `--out` | Writes the PDF to a file in place of standard output.<br />**Example:** `invoice.pdf` |
| `--unpaid` | Lists only unpaid invoices. |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/invoices' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'

curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/invoices?unpaid=true' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'

curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/invoices/INVOICE_ID/pdf' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --output invoice.pdf

# Payment URL for an open invoice
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/invoices/INVOICE_ID/payment-sessions' \
  --request POST \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

| **Field** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `unpaid` | Lists only unpaid invoices.<br />**Default:** `false` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Charges

Charges displays all payment attempts made on your organization, including attempts that failed. A receipt PDF is available for each successful charge.

| **Field**       | **Description**                    |
| --------------- | ---------------------------------- |
| **Date**        | The date the charge was attempted. |
| **Description** | The description of the charge.     |
| **Amount**      | The amount of the charge.          |
| **Status**      | The status of the charge.          |

**CLI:**

```bash
daytona billing charges --org ORGANIZATION_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/charges' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'

curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/charges/CHARGE_ID/pdf' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --output receipt.pdf
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

## Spending

[Daytona Spending ↗](https://app.daytona.com/dashboard/spending) provides a summary of resource usage for the selected project and the organization's billing periods. Reading usage requires the spending read [permission](../python-sdk/api-keys.md#scopes).

### Resource usage

Resource usage summarizes the selected project's measured usage over a date range.

| **Metric**      | **Description**                  |
| --------------- | -------------------------------- |
| **CPU**         | Total CPU time, in core-seconds. |
| **Memory**      | Total memory, in GiB-hours.      |
| **Network**     | Total bytes sent and received.   |
| **Disk (peak)** | The highest disk usage observed. |

1. Go to [Daytona Spending ↗](https://app.daytona.com/dashboard/spending)
2. Select a project and a date range

**API:**

```bash
# Hourly usage for the project over the last day (default)
curl 'https://api.daytona.com/usage/report' \
  --header 'Authorization: Bearer YOUR_API_KEY'

# Daily usage for a date range
curl 'https://api.daytona.com/usage/report?start_at=2026-09-01T00:00:00Z&end_at=2026-09-08T00:00:00Z&resolution=day' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

| **Field** | **Description** |
| --- | --- |
| `end_at` | Sets the exclusive end of the window.<br />**Default:** the current time<br />**Format:** an RFC 3339 timestamp<br />**Example:** `2026-09-08T00:00:00Z` |
| `resolution` | Sets the interval that usage is grouped by.<br />**Default:** `hour`<br />**Value:** `hour` or `day`<br />**Example:** `day` |
| `start_at` | Sets the inclusive start of the window.<br />**Default:** 24 hours before end_at<br />**Format:** an RFC 3339 timestamp<br />**Example:** `2026-09-01T00:00:00Z` |

### Usage timeline

Usage timeline charts one metric over the selected range: CPU, memory, or network.

### Per-sandbox usage

Per-sandbox usage displays the same measurements broken down by sandbox: **Sandbox**, **CPU core-s**, **Memory GiB-h**, **Network**, and **Disk (peak)**.

**CLI:**

```bash
# Live usage for one sandbox
daytona sandbox usage SANDBOX_ID

# Usage history for one sandbox, per minute; the CLI has no hourly resolution
daytona sandbox usage SANDBOX_ID --history
```

| **Flag** | **Description** |
| --- | --- |
| `--history` | Reads the usage history in place of the live usage. |

> **Notes:**
>
> - **Prerequisites:** Usage history requires a Linux sandbox.

**API:**

```bash
# Live usage for one sandbox
curl 'https://api.daytona.com/sandboxes/SANDBOX_ID/usage' \
  --header 'Authorization: Bearer YOUR_API_KEY'

# Usage history for one sandbox, per minute or per hour
curl 'https://api.daytona.com/sandboxes/SANDBOX_ID/usage/history?resolution=hour' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

| **Field** | **Description** |
| --- | --- |
| `end_at` | Sets the exclusive end of the window.<br />**Default:** the current time<br />**Format:** an RFC 3339 timestamp<br />**Example:** `2026-09-02T00:00:00Z` |
| `resolution` | Sets the interval that usage history is grouped by.<br />**Default:** `minute`<br />**Value:** `minute` or `hour`<br />**Example:** `hour` |
| `start_at` | Sets the inclusive start of the window.<br />**Default:** 24 hours before end_at<br />**Format:** an RFC 3339 timestamp<br />**Example:** `2026-09-01T00:00:00Z` |

### Billing period

Billing period shows the amount owed per product for the current and past periods.

- **Metric**, **Product**, **Units**, **Cost**: the current period's charges per resource and sandbox class
- **Period**, **Issued**, **Total**: the closed past periods

**CLI:**

```bash
# Current billing period
daytona billing usage --org ORGANIZATION_ID

# Billing periods, newest first
daytona billing usage-periods --org ORGANIZATION_ID --limit 3
```

| **Flag** | **Description** |
| --- | --- |
| `--limit` | Sets the page size.<br />**Default:** `12`<br />**Minimum:** `1`<br />**Maximum:** `60` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
# Billing periods, newest first; the open period is the current one
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/usage-periods?limit=3' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

**Response:**

```json
{
  "usage_periods": [
    {
      "status": "open",
      "start_at": "2026-09-01T00:00:00Z",
      "end_at": "2026-10-01T00:00:00Z",
      "issued_at": "2026-10-01T00:00:00Z",
      "currency": "usd",
      "amount_cents": 12345,
      "total_amount_cents": 12400,
      "taxes_amount_cents": 0,
      "charges": [
        {
          "name": "CPU · Linux VM",
          "quantity": 342.9,
          "total_cents": 12345,
          "units": "342.90",
          "events_count": 0,
          "billable_metric": "cpu_usage"
        }
      ]
    }
  ],
  "next_cursor": null
}
```

| **Field** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `limit` | Sets the page size.<br />**Minimum:** `1`<br />**Maximum:** `60`<br />**Example:** `3` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

## Suspension

Daytona suspends a pre-paid organization when its balance is depleted or when an invoice stays unpaid past the grace period. While suspended, creating, starting, resuming, restoring, and forking sandboxes fails with HTTP 402 and an organization suspended error; already running sandboxes are not affected. The suspension lifts automatically once its cause is resolved: a top-up or coupon that restores the balance, or payment of the unpaid invoice. The dashboard shows the suspension and its reason on the wallet page.

## Permissions

Billing is scoped to the organization. Access is governed by two organization permissions, which you can grant through an [organization role](../python-sdk/organizations.md#roles), and usage reports use the spending permission. Billing requests require a signed-in user token. An [organization API key](../python-sdk/api-keys.md#organization-api-keys) can hold the billing permissions, but they only authorize it to list the [region price multipliers](../python-sdk/regions.md#list-region-price-multipliers).

Reading the usage of a single sandbox requires the permission to read sandboxes.

| **Permission**      | **Grants**                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| **`read:billing`**  | Get the plan, wallet, balances, invoices, charges, payment methods, and billing settings               |
| **`write:billing`** | Change the plan, redeem coupons, top up, pay invoices, and change payment methods and billing settings |
| **`read:spending`** | Read resource usage and the budget of the project                                                      |
