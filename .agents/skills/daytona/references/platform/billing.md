## Contents

- Sandbox billing
- Wallet
- Spending
- Cancellation & post-cancellation
- See Also




Daytona provides an overview of your organization's [wallet](#wallet) and [spending](#spending). Daytona uses a pay-as-you-go billing model where you are charged based on the resources reserved for your sandboxes. For information on resource quotas, rate limits, and tier-based access, see [limits](./limits.md).

## Sandbox billing

Sandboxes are billed for the resources reserved: **vCPU**, **RAM**, and **disk**, depending on the sandbox [lifecycle state](../python-sdk/sandboxes.md#sandbox-lifecycle). The table below details which reserved resources and states are billed for [container sandboxes](../python-sdk/sandboxes.md#create-sandboxes), [VM sandboxes](../python-sdk/sandboxes.md#vm-sandboxes), and [GPU sandboxes](../python-sdk/sandboxes.md#gpu-sandboxes).

| **State**                                               | **vCPU** | **RAM** | **Disk** | **Description**                                                                                                                                                                                                                                              |
| ------------------------------------------------------- | -------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Started                                                 | ✓        | ✓       | ✓        | Billed for all reserved resources.                                                                                                                                                                                                                           |
| Creating <br /> Starting <br /> Stopping <br /> Pausing | ✓        | ✓       | ✓        | Billed the same as started. Resources remain reserved during these transitions, so reduced billing applies once the sandbox reaches the stopped or paused state, not when the stop or pause operation begins.                                                |
| Stopped                                                 | ✗        | ✗       | ✓        | Billed for reserved disk only. <u>[**Ephemeral sandboxes**](../python-sdk/sandboxes.md#ephemeral-sandboxes) </u> and <u>[**GPU sandboxes**](../python-sdk/sandboxes.md#gpu-sandboxes)</u> are automatically deleted when stopped, so stopped billing does not apply to them. |
| Paused                                                  | ✗        | ✗       | ✓        | Billed for reserved disk only. The preserved memory state is not billed. Supported for <u>[**VM sandboxes**](../python-sdk/sandboxes.md#vm-sandboxes)</u> only.                                                                                                      |
| Archived                                                | ✗        | ✗       | ✗        | Not billed. Supported for <u>[**container sandboxes**](../python-sdk/sandboxes.md#create-sandboxes)</u> only.                                                                                                                                                        |
| Deleted                                                 | ✗        | ✗       | ✗        | Not billed. <u>[**Snapshots created from sandbox**](../python-sdk/snapshots.md#create-snapshot-from-sandbox)</u> remain billed for storage.                                                                                                                          |

Disk billing and [disk quota](./limits.md#disk-quota) are separate: a sandbox can be billed for reserved disk without counting against your organization's storage limit.

## Wallet

[Daytona Wallet ↗](https://app.daytona.io/dashboard/billing/wallet) is the central hub for managing your organization's wallet, including balances, credit consumption, and payment methods.

### Redeem coupon

Redeem coupon to add credits to your wallet.

1. Go to [Daytona Wallet ↗](https://app.daytona.io/dashboard/billing/wallet)
2. Enter the coupon code in the **Redeem coupon** input field
3. Click <Button>Redeem</Button> to redeem the coupon code

### Balances

Balances displays the credit balances available to your organization.

- **Free credit balance**: the amount of free credits; not available for GPU sandboxes
- **Paid credit balance**: the amount of paid credits

Daytona consumes free credits before paid credits. During an open billing month, credit consumption is recalculated when you add credits. If you add free credits after paid credits have already covered usage, that usage is reassigned to the free credits and the paid balance is released. Available paid balance can therefore increase after you redeem free credits, even though no new payment occurred. After the month closes, free and paid credit consumption is locked and is not rebalanced.

1. Go to [Daytona Wallet ↗](https://app.daytona.io/dashboard/billing/wallet)
2. Navigate to the **Balances** section
3. Click <Button>See breakdown and expiration</Button>

### Billing information

Billing information displays the organization's billing information.

- **Billing name**: the name on file for billing
- **Billing email**: the email address on file for billing
- **Billing phone number**: the phone number on file for billing
- **Billing address**: the address on file for billing

1. Go to [Daytona Wallet ↗](https://app.daytona.io/dashboard/billing/wallet)
2. Navigate to the **Billing information** section
3. Click <Button>Edit</Button>
4. Add or update the billing information

### Payment method

Payment method connects your wallet to your preferred payment method, allowing you to add funds to your balance and receive invoices.

1. Go to [Daytona Wallet ↗](https://app.daytona.io/dashboard/billing/wallet)
2. Navigate to the **Payment method** section
3. Click <Button>Edit</Button>
4. Add or update the payment method
5. Follow the prompts to complete the payment setup

### Automatic top-up

Automatic top-up adds credits to your wallet when the balance drops below a certain threshold.

1. Go to [Daytona Wallet ↗](https://app.daytona.io/dashboard/billing/wallet)
2. Navigate to the **Automatic top-up** section
3. Add or update the **when balance is low** and **bring balance to** values
4. Click <Button>Save</Button>

### One time top-up

One time top-up adds credits to your wallet with a one time payment.

1. Go to [Daytona Wallet ↗](https://app.daytona.io/dashboard/billing/wallet)
2. Navigate to the **One time top-up** section
3. Select the top-up amount or enter a custom amount
4. Click <Button>Top up</Button>
5. Follow the prompts to complete the payment

### Invoices

Invoices are automatically generated and sent to your billing emails.

- **Invoice**: the invoice identifier
- **Date**: the date the invoice was issued
- **Due date**: the date the invoice is due
- **Amount**: the amount of the invoice
- **Status**: the status of the invoice
- **Type**: the type of the invoice

1. Go to [Daytona Wallet ↗](https://app.daytona.io/dashboard/billing/wallet)
2. Navigate to the **Invoices** section
3. Click the three dots button (**:::**) next to the invoice you want to view
4. Click <Button>View</Button> to see the invoice details
5. Optionally, download the invoice

### Charges

Charges displays all payment attempts on your organization, including failed attempts.

- **Date**: the date the charge was attempted
- **Description**: the description of the charge
- **Amount**: the amount of the charge
- **Status**: the status of the charge

---

## Spending

[Daytona Spending ↗](https://app.daytona.io/dashboard/billing/spending) provides a summary of your organization's resource usage and spending.

### Resource usage

Resource usage provides a summary of the organization's resource usage.

- **Total cost**: the total cost of your organization's usage
- **Sandboxes**: the total number of sandboxes in your organization
- **CPU**: the total CPU usage of your organization
- **RAM**: the total RAM usage of your organization
- **Disk**: the total disk usage of your organization

### Resource breakdown

Resource breakdown displays a breakdown of usage per resource.

- **CPU**: the total CPU usage of your organization
- **RAM**: the total RAM usage of your organization
- **Disk**: the total disk usage of your organization

### Usage timeline

Usage timeline displays a timeline of usage  per sandbox.

- **Compute**: the total compute usage of your organization
- **Storage**: the total storage usage of your organization
- **Memory**: the total memory usage of your organization

1. Go to [Daytona Spending ↗](https://app.daytona.io/dashboard/billing/spending)
2. Navigate to the **Usage timeline** section
4. Filter by resources and cost, and by regions

### Per-sandbox usage

Per-sandbox usage displays usage per sandbox.

- **Sandbox ID**: the ID of the sandbox
- **Total price**: the total price of the sandbox's resources usage
- **CPU (seconds)**: the total CPU usage of the sandbox
- **RAM (GB-seconds)**: the total RAM usage of the sandbox
- **Disk (GB-seconds)**: the total disk usage of the sandbox

## Cancellation & post-cancellation
> **Note:**
> Refer to [Daytona Terms of Service ↗](https://www.daytona.io/terms-of-service) for more information.

When you delete your [organization](./organizations.md), cancel your subscription, or disable billing, you remain responsible for any sandbox usage that occurred before your action.

### Charges after cancellation

There is a delay of up to 48 hours between when sandbox resources are consumed and when the corresponding charges appear in the billing system. If you cancel during this window, charges for usage that already occurred may still post to your account. These charges reflect sandbox activity that happened before your cancellation and are not charges for new usage.

No charges will be asserted for usage first reported more than 48 hours after cancellation. In no event will any charge be asserted more than 30 calendar days after cancellation, regardless of the cause of any delay.

### Before cancelling

You are responsible for deleting all sandboxes and verifying that no active resources remain before cancelling.

1. Navigate to your organization's [Daytona Dashboard ↗](https://app.daytona.io/dashboard)
2. Delete all sandboxes across all projects
3. Confirm no active resources remain under your organization

Daytona will not charge you for resources that failed to delete due to a platform issue on Daytona's side.

### Final settlement

After cancellation, Daytona sends a final billing summary to the billing email address(es) on file within 5 business days, itemizing any charges posted during the 48-hour settlement window.

### Billing disputes

If you believe a post-cancellation charge is incorrect, you can submit a billing dispute.

1. Email [support@daytona.io](mailto:support@daytona.io) within 30 days of receiving your final settlement notice
2. Include your organization name and/or ID, and the specific charges in question

Daytona will provide detailed usage records supporting the disputed charges upon request and respond within 15 business days.

## See Also

- [Python SDK](../python-sdk/README.md)
- [TypeScript SDK](../typescript-sdk/README.md)
- [Java SDK](../java-sdk/README.md)
- [Go SDK](../go-sdk/README.md)
- [Ruby SDK](../ruby-sdk/README.md)
