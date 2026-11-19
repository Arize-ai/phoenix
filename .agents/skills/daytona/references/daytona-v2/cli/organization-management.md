# Organization management

Reference for the daytona audit, billing, invite, key, member, org, org-key, project, registry, role, secret, and service-account commands.

## Contents

- [Commands](#commands)
- [daytona audit](#daytona-audit)
- [daytona billing](#daytona-billing)
- [daytona invite](#daytona-invite)
- [daytona key](#daytona-key)
- [daytona member](#daytona-member)
- [daytona org](#daytona-org)
- [daytona org-key](#daytona-org-key)
- [daytona project](#daytona-project)
- [daytona registry](#daytona-registry)
- [daytona role](#daytona-role)
- [daytona secret](#daytona-secret)
- [daytona service-account](#daytona-service-account)

## Commands

This page documents the following commands. Global flags that apply to every command are listed under [`daytona`](./README.md#daytona).

| Command | Description |
| :------ | :---------- |
| [`daytona audit`](#daytona-audit) | Organization audit logs |
| [`daytona billing`](#daytona-billing) | Organization billing: usage, invoices, plans, and payment settings |
| [`daytona invite`](#daytona-invite) | Organization invitations: create, list, revoke, get, accept, decline |
| [`daytona key`](#daytona-key) | Project API keys: mint, list, revoke |
| [`daytona member`](#daytona-member) | Organization members: list, change roles, remove |
| [`daytona org`](#daytona-org) | Organizations: list, select, create, rename, delete, leave, limits |
| [`daytona org-key`](#daytona-org-key) | Organization API keys: mint, list, revoke |
| [`daytona project`](#daytona-project) | Projects in the selected organization: list, select, create, rename, delete, budget |
| [`daytona registry`](#daytona-registry) | Project registries: set, list, get, delete |
| [`daytona role`](#daytona-role) | Inspect the organization role catalog |
| [`daytona secret`](#daytona-secret) | Project secrets: set, list, get, delete |
| [`daytona service-account`](#daytona-service-account) | Service accounts: create, list, get, update, delete |

## daytona audit

Organization audit logs

```shell
daytona audit
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona audit list`](#daytona-audit-list) | List audit log entries |

### daytona audit list

List audit log entries

```shell
daytona audit list [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--action` |  | `string` |  | filter by action |
| `--action-not-in` |  | `string` |  | exclude comma-separated actions (not_in) |
| `--actor` |  | `string` |  | filter by actor user id or key id |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--end-at` |  | `string` |  | exclusive RFC3339 end of the time range |
| `--limit` |  | `int` | `100` | max items to return, 1 to 200 |
| `--start-at` |  | `string` |  | inclusive RFC3339 start of the time range |
| `--status` |  | `int` |  | filter by HTTP status |
| `--target-id` |  | `string` |  | filter by target id |
| `--target-type` |  | `string` |  | filter by target type |

## daytona billing

Organization billing: usage, invoices, plans, and payment settings

```shell
daytona billing
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona billing automatic-top-up`](#daytona-billing-automatic-top-up) | Manage automatic top-up |
| [`daytona billing balance-notification`](#daytona-billing-balance-notification) | Manage low-balance notifications |
| [`daytona billing balances`](#daytona-billing-balances) | List billing balances |
| [`daytona billing charges`](#daytona-billing-charges) | List billing charges |
| [`daytona billing contact`](#daytona-billing-contact) | Billing contact subcommands |
| [`daytona billing coupon`](#daytona-billing-coupon) | Coupon subcommands |
| [`daytona billing invoice`](#daytona-billing-invoice) | Invoice subcommands |
| [`daytona billing invoices`](#daytona-billing-invoices) | List billing invoices |
| [`daytona billing payment-method-session`](#daytona-billing-payment-method-session) | Create a payment-method setup session |
| [`daytona billing payment-methods`](#daytona-billing-payment-methods) | List payment methods |
| [`daytona billing plan`](#daytona-billing-plan) | Billing plan subcommands |
| [`daytona billing portal-session`](#daytona-billing-portal-session) | Create a billing portal session |
| [`daytona billing profile`](#daytona-billing-profile) | Read billing profile |
| [`daytona billing top-up`](#daytona-billing-top-up) | Create a manual top-up session |
| [`daytona billing usage`](#daytona-billing-usage) | Read current priced usage |
| [`daytona billing usage-periods`](#daytona-billing-usage-periods) | List priced usage periods |
| [`daytona billing wallet`](#daytona-billing-wallet) | Read billing wallet |

### daytona billing automatic-top-up

Manage automatic top-up

```shell
daytona billing automatic-top-up
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona billing automatic-top-up delete`](#daytona-billing-automatic-top-up-delete) | Delete automatic top-up |
| [`daytona billing automatic-top-up get`](#daytona-billing-automatic-top-up-get) | Read billing get |
| [`daytona billing automatic-top-up set`](#daytona-billing-automatic-top-up-set) | Set automatic top-up |

### daytona billing automatic-top-up delete

Delete automatic top-up

Asks for confirmation; in non-interactive mode (no terminal, -o json|yaml, or CI) pass --yes or set DAYTONA_YES=1. Requires write:billing.

```shell
daytona billing automatic-top-up delete
```

### daytona billing automatic-top-up get

Read billing get

Requires read:billing.

```shell
daytona billing automatic-top-up get
```

### daytona billing automatic-top-up set

Set automatic top-up

Set automatic top-up using integer-cent thresholds. It charges the organization's payment method, so it asks for confirmation; in non-interactive mode (no terminal, -o json|yaml, or CI) pass --yes or set DAYTONA_YES=1. Requires write:billing.

```shell
daytona billing automatic-top-up set [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--target-cents` |  | `int` |  | balance in cents targeted by a top-up |
| `--threshold-cents` |  | `int` |  | balance in cents that triggers a top-up |

### daytona billing balance-notification

Manage low-balance notifications

```shell
daytona billing balance-notification
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona billing balance-notification delete`](#daytona-billing-balance-notification-delete) | Delete the low-balance notification |
| [`daytona billing balance-notification get`](#daytona-billing-balance-notification-get) | Read billing get |
| [`daytona billing balance-notification set`](#daytona-billing-balance-notification-set) | Set the low-balance notification |

### daytona billing balance-notification delete

Delete the low-balance notification

Asks for confirmation; in non-interactive mode (no terminal, -o json|yaml, or CI) pass --yes or set DAYTONA_YES=1. Requires write:billing.

```shell
daytona billing balance-notification delete
```

### daytona billing balance-notification get

Read billing get

Requires read:billing.

```shell
daytona billing balance-notification get
```

### daytona billing balance-notification set

Set the low-balance notification

Set the low-balance notification using an integer-cent threshold. Requires write:billing.

```shell
daytona billing balance-notification set [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--threshold-cents` |  | `int` |  | notification threshold in integer cents |

### daytona billing balances

List billing balances

List itemized billing balances. Requires read:billing.

```shell
daytona billing balances [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `25` | items per page, 1 to 100 |

### daytona billing charges

List billing charges

List charge history. Requires read:billing.

```shell
daytona billing charges [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `25` | items per page, 1 to 100 |

### daytona billing contact

Billing contact subcommands

```shell
daytona billing contact
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona billing contact get`](#daytona-billing-contact-get) | Read billing get |
| [`daytona billing contact set`](#daytona-billing-contact-set) | Set or clear the billing contact |

### daytona billing contact get

Read billing get

Requires read:billing.

```shell
daytona billing contact get
```

### daytona billing contact set

Set or clear the billing contact

Set or clear the billing contact email. Requires write:billing.

```shell
daytona billing contact set [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--clear` |  | `bool` |  | restore the default billing contact |
| `--email` |  | `string` |  | billing contact email |

### daytona billing coupon

Coupon subcommands

```shell
daytona billing coupon
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona billing coupon redeem`](#daytona-billing-coupon-redeem) | Redeem a billing coupon |

### daytona billing coupon redeem

Redeem a billing coupon

Requires write:billing.

```shell
daytona billing coupon redeem <code>
```

### daytona billing invoice

Invoice subcommands

```shell
daytona billing invoice
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona billing invoice payment-session`](#daytona-billing-invoice-payment-session) | Create a payment session for one invoice |
| [`daytona billing invoice pdf`](#daytona-billing-invoice-pdf) | Download one invoice PDF |

### daytona billing invoice payment-session

Create a payment session for one invoice

Create a hosted payment session for one invoice. Requires write:billing.

```shell
daytona billing invoice payment-session <id>
```

### daytona billing invoice pdf

Download one invoice PDF

Requires read:billing.

```shell
daytona billing invoice pdf <id> [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--out` |  | `string` |  | write the PDF to a file instead of stdout |

### daytona billing invoices

List billing invoices

List invoice history. Requires read:billing.

```shell
daytona billing invoices [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `25` | items per page, 1 to 100 |
| `--unpaid` |  | `bool` |  | return only unpaid invoices |

### daytona billing payment-method-session

Create a payment-method setup session

Requires write:billing.

```shell
daytona billing payment-method-session [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--open` |  | `bool` |  | open the minted URL in your browser |

### daytona billing payment-methods

List payment methods

List saved payment methods. Requires read:billing.

```shell
daytona billing payment-methods [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `20` | items per page, 1 to 100 |

### daytona billing plan

Billing plan subcommands

```shell
daytona billing plan
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona billing plan get`](#daytona-billing-plan-get) | Read billing get |
| [`daytona billing plan list`](#daytona-billing-plan-list) | Read billing list |
| [`daytona billing plan set`](#daytona-billing-plan-set) | Set the billing plan |

### daytona billing plan get

Read billing get

Requires read:billing.

```shell
daytona billing plan get
```

### daytona billing plan list

Read billing list

Requires read:billing.

```shell
daytona billing plan list
```

### daytona billing plan set

Set the billing plan

Set the organization's billing plan. It changes what the organization is billed, so it asks for confirmation; in non-interactive mode (no terminal, -o json|yaml, or CI) pass --yes or set DAYTONA_YES=1. Requires write:billing.

```shell
daytona billing plan set <starter|team|enterprise>
```

### daytona billing portal-session

Create a billing portal session

Requires write:billing.

```shell
daytona billing portal-session [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--open` |  | `bool` |  | open the minted URL in your browser |

### daytona billing profile

Read billing profile

Requires read:billing.

```shell
daytona billing profile
```

### daytona billing top-up

Create a manual top-up session

Create a manual top-up checkout session. Amounts are integer cents. Requires write:billing.

```shell
daytona billing top-up [amount-cents] [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--amount-cents` |  | `int` |  | top-up amount in integer cents |

### daytona billing usage

Read current priced usage

Read the open billing usage period. Requires read:billing.

```shell
daytona billing usage
```

### daytona billing usage-periods

List priced usage periods

List current and past priced usage periods. Requires read:billing.

```shell
daytona billing usage-periods [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `12` | items per page, 1 to 60 |

### daytona billing wallet

Read billing wallet

Requires read:billing.

```shell
daytona billing wallet
```

## daytona invite

Organization invitations: create, list, revoke, get, accept, decline

```shell
daytona invite
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona invite accept`](#daytona-invite-accept) | Accept an invitation by its token or invitation link |
| [`daytona invite create`](#daytona-invite-create) | Invite someone to the selected organization |
| [`daytona invite decline`](#daytona-invite-decline) | Decline an invitation by its token or invitation link |
| [`daytona invite get`](#daytona-invite-get) | Show the invitation behind a token or invitation link |
| [`daytona invite list`](#daytona-invite-list) | List invitations for the selected organization |
| [`daytona invite revoke`](#daytona-invite-revoke) | Revoke one pending or declined invitation |

### daytona invite accept

Accept an invitation by its token or invitation link

```shell
daytona invite accept <token|link>
```

### daytona invite create

Invite someone to the selected organization

Invite someone to the selected organization by email. The invitee receives a link to accept the invitation; when the deployment sends no email, the link is printed instead.

```shell
daytona invite create <email> [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--role` |  | `strings` |  | role slug (repeatable or comma-separated) |

### daytona invite decline

Decline an invitation by its token or invitation link

```shell
daytona invite decline <token|link>
```

### daytona invite get

Show the invitation behind a token or invitation link

Show who invited you to which organization, with which roles, and until when — before accepting or declining. Takes the dtni_ token or the full link from the invitation email.

```shell
daytona invite get <token|link>
```

### daytona invite list

List invitations for the selected organization

```shell
daytona invite list [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `100` | max items to return, 1 to 200 |

### daytona invite revoke

Revoke one pending or declined invitation

```shell
daytona invite revoke <id>
```

## daytona key

Project API keys: mint, list, revoke

```shell
daytona key
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona key list`](#daytona-key-list) | List project API keys |
| [`daytona key mint`](#daytona-key-mint) | Mint a project API key |
| [`daytona key revoke`](#daytona-key-revoke) | Revoke a project API key |

### daytona key list

List project API keys

```shell
daytona key list [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `100` | max items to return, 1 to 200 |

### daytona key mint

Mint a project API key

```shell
daytona key mint [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--expires` |  | `DURATION\|RFC3339` |  | expiry as a whole-second Go duration (e.g. 720h) or an RFC3339 timestamp |
| `--name` |  | `string` |  | key name |
| `--permission` |  | `strings` |  | project permission (repeatable or comma-separated) |
| `--service-account` |  | `string` |  | service account id or name to mint this key for |

### daytona key revoke

Revoke a project API key

```shell
daytona key revoke <id>
```

## daytona member

Organization members: list, change roles, remove

```shell
daytona member
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona member list`](#daytona-member-list) | List members of the selected organization |
| [`daytona member remove`](#daytona-member-remove) | Remove a member from the selected organization |
| [`daytona member update`](#daytona-member-update) | Replace a member's roles |

### daytona member list

List members of the selected organization

```shell
daytona member list [flags]
```

__Examples__

```shell
daytona member list
daytona member list --org org-123
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `100` | max items to return, 1 to 200 |

### daytona member remove

Remove a member from the selected organization

```shell
daytona member remove <user> [flags]
```

__Examples__

```shell
daytona member remove user-123 --yes
daytona member remove user@example.com --dry-run
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--dry-run` |  | `bool` |  | show the revoked API-key count without removing the member |

### daytona member update

Replace a member's roles

```shell
daytona member update <user> [flags]
```

__Examples__

```shell
daytona member update user-123 --role admin
daytona member update user@example.com --role developer,auditor --dry-run
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--dry-run` |  | `bool` |  | preview the revocation count without committing the role change |
| `--role` |  | `strings` |  | role slug (repeatable or comma-separated); replaces the member's roles |

## daytona org

Organizations: list, select, create, rename, delete, leave, limits

```shell
daytona org
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona org create`](#daytona-org-create) | Create an organization |
| [`daytona org delete`](#daytona-org-delete) | Delete an organization (personal orgs cannot be deleted) |
| [`daytona org get`](#daytona-org-get) | Show one organization (default: the selected one) |
| [`daytona org leave`](#daytona-org-leave) | Leave an organization (revokes the API keys you minted in it) |
| [`daytona org limits`](#daytona-org-limits) | Show the organization's limits and current usage (default: the selected one) |
| [`daytona org list`](#daytona-org-list) | List the organizations you belong to |
| [`daytona org update`](#daytona-org-update) | Rename an organization |
| [`daytona org use`](#daytona-org-use) | Select the organization for following commands |

### daytona org create

Create an organization

The name is 1 to 64 characters after trimming, with no control characters.

```shell
daytona org create <name>
```

### daytona org delete

Delete an organization (personal orgs cannot be deleted)

```shell
daytona org delete <id|name>
```

### daytona org get

Show one organization (default: the selected one)

```shell
daytona org get [id|name]
```

### daytona org leave

Leave an organization (revokes the API keys you minted in it)

The CLI also forgets cached project keys and platform tokens for that organization. If it cannot list the org's projects during cleanup, it forgets the remembered project for that org and warns that other cached credentials may remain; run `daytona logout` to clear them all.

```shell
daytona org leave [id|name]
```

### daytona org limits

Show the organization's limits and current usage (default: the selected one)

Show the organization's limits — sandboxes, image
builds, Mac reservations, members, images, snapshots, secrets and API keys —
each with the current usage it is checked against; "unlimited" means no limit
applies. A request refused by one of them — a Mac reservation purchase
included (reservation create or renew, or a sandbox create-macos or start
that buys a Mac) — exits 6 with "LIMIT_EXCEEDED" naming the limit, the current count and the
maximum. Requires read:organization, or read:limits with an API key. An API
key reads its own organization when none is named, and its read leaves out
the member counts.

```shell
daytona org limits [id|name]
```

### daytona org list

List the organizations you belong to

```shell
daytona org list [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `100` | max items to return, 1 to 200 |

### daytona org update

Rename an organization

The name is 1 to 64 characters after trimming, with no control characters;
a rename to the current name is sent and left to the API.

```shell
daytona org update <id|name> --name <new> [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--name` |  | `string` |  | new name (1 to 64 characters) |

### daytona org use

Select the organization for following commands

Selects an organization and restores the project you last used in it (or
its default project). Accepts an id or an unambiguous name; with no argument
shows a picker at a terminal.

```shell
daytona org use [id|name]
```

## daytona org-key

Organization API keys: mint, list, revoke

```shell
daytona org-key
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona org-key list`](#daytona-org-key-list) | List organization API keys |
| [`daytona org-key mint`](#daytona-org-key-mint) | Mint an organization API key |
| [`daytona org-key revoke`](#daytona-org-key-revoke) | Revoke an organization API key |

### daytona org-key list

List organization API keys

```shell
daytona org-key list [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `100` | max items to return, 1 to 200 |

### daytona org-key mint

Mint an organization API key

```shell
daytona org-key mint [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--expires` |  | `DURATION\|RFC3339` |  | expiry as a whole-second Go duration (e.g. 720h) or an RFC3339 timestamp |
| `--name` |  | `string` |  | key name |
| `--permission` |  | `strings` |  | organization permission (repeatable or comma-separated) |

### daytona org-key revoke

Revoke an organization API key

```shell
daytona org-key revoke <id>
```

## daytona project

Projects in the selected organization: list, select, create, rename, delete, budget

```shell
daytona project
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona project budget`](#daytona-project-budget) | A project's monthly spend budget: get, set, remove |
| [`daytona project create`](#daytona-project-create) | Create a project in the selected organization |
| [`daytona project delete`](#daytona-project-delete) | Delete a project (refused while it still holds resources) |
| [`daytona project get`](#daytona-project-get) | Show one project (default: the selected one) |
| [`daytona project list`](#daytona-project-list) | List the projects you can reach in the selected organization |
| [`daytona project member`](#daytona-project-member) | Project membership: list, add, remove |
| [`daytona project service-account`](#daytona-project-service-account) | Project service-account membership: list, add, remove |
| [`daytona project update`](#daytona-project-update) | Rename a project |
| [`daytona project use`](#daytona-project-use) | Select the project for following commands (remembered per organization) |

### daytona project budget

A project's monthly spend budget: get, set, remove

A project's monthly spend budget caps its spend in each calendar month (UTC),
at list price and before credits. When spend reaches the budget, new Linux
sandboxes in the project can't start, and after the organization's grace period
running Linux sandboxes are deleted. macOS sandboxes keep running; the budget
instead blocks buying or renewing a Mac reservation for the project.
Spend is evaluated periodically and can lag usage by several minutes.

```shell
daytona project budget
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona project budget get`](#daytona-project-budget-get) | Show the project's monthly budget and this month's spend (default: the selected project) |
| [`daytona project budget remove`](#daytona-project-budget-remove) | Remove the project's monthly budget (default: the selected project) |
| [`daytona project budget set`](#daytona-project-budget-set) | Set or replace the project's monthly budget (default: the selected project) |

### daytona project budget get

Show the project's monthly budget and this month's spend (default: the selected project)

```shell
daytona project budget get [id|name]
```

### daytona project budget remove

Remove the project's monthly budget (default: the selected project)

```shell
daytona project budget remove [id|name]
```

### daytona project budget set

Set or replace the project's monthly budget (default: the selected project)

```shell
daytona project budget set [id|name] --monthly-usd <amount> [flags]
```

__Examples__

```shell
daytona project budget set --monthly-usd 500
daytona project budget set ml-training --monthly-usd 1250.50
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--monthly-usd` |  | `string` |  | monthly budget in US dollars, at least 1.00 and at most two decimals (e.g. 500 or 499.99) |

### daytona project create

Create a project in the selected organization

The name is 1 to 64 characters after trimming, with no
control characters; `default` is reserved.

```shell
daytona project create <name>
```

### daytona project delete

Delete a project (refused while it still holds resources)

```shell
daytona project delete <id|name>
```

### daytona project get

Show one project (default: the selected one)

```shell
daytona project get [id|name]
```

### daytona project list

List the projects you can reach in the selected organization

```shell
daytona project list [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `100` | max items to return, 1 to 200 |

### daytona project member

Project membership: list, add, remove

```shell
daytona project member
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona project member add`](#daytona-project-member-add) | Add one or more members to the selected project |
| [`daytona project member list`](#daytona-project-member-list) | List members who can access the selected project |
| [`daytona project member remove`](#daytona-project-member-remove) | Remove one member from the selected project |

### daytona project member add

Add one or more members to the selected project

```shell
daytona project member add <user> [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--bulk` |  | `string` |  | comma-separated user ids/emails/names to add in one request |

### daytona project member list

List members who can access the selected project

```shell
daytona project member list [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `100` | max items to return, 1 to 200 |

### daytona project member remove

Remove one member from the selected project

```shell
daytona project member remove <user>
```

### daytona project service-account

Project service-account membership: list, add, remove

```shell
daytona project service-account
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona project service-account add`](#daytona-project-service-account-add) | Seat a service account in the selected project |
| [`daytona project service-account list`](#daytona-project-service-account-list) | List service accounts seated in the selected project |
| [`daytona project service-account remove`](#daytona-project-service-account-remove) | Unseat a service account from the selected project |

### daytona project service-account add

Seat a service account in the selected project

```shell
daytona project service-account add <service-account>
```

### daytona project service-account list

List service accounts seated in the selected project

```shell
daytona project service-account list [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `100` | max items to return, 1 to 200 |

### daytona project service-account remove

Unseat a service account from the selected project

```shell
daytona project service-account remove <service-account>
```

### daytona project update

Rename a project

The name is 1 to 64 characters after trimming, with no control characters, and
not `default`; a rename to the current name is sent and left to the API (the default project
cannot be renamed).

```shell
daytona project update <id|name> --name <new> [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--name` |  | `string` |  | new name (1 to 64 characters) |

### daytona project use

Select the project for following commands (remembered per organization)

```shell
daytona project use [id|name]
```

## daytona registry

Project registries: set, list, get, delete

```shell
daytona registry
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona registry delete`](#daytona-registry-delete) | Delete a registry credential |
| [`daytona registry get`](#daytona-registry-get) | Show one registry credential's metadata |
| [`daytona registry list`](#daytona-registry-list) | List project registries (metadata only) |
| [`daytona registry set`](#daytona-registry-set) | Create or update a registry credential |

### daytona registry delete

Delete a registry credential

```shell
daytona registry delete <host>
```

### daytona registry get

Show one registry credential's metadata

```shell
daytona registry get <host>
```

### daytona registry list

List project registries (metadata only)

```shell
daytona registry list [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `100` | max items to return, 1 to 200 |

### daytona registry set

Create or update a registry credential

Create or update a registry credential and print it (never its password). It reads the stored credential first to preserve omitted username, kind and description, so it needs read as well as write access. A new registry requires --username. The API requires a password on every set, including metadata-only updates, except for ecr_role; passwords cannot be read back or preserved by this endpoint.

```shell
daytona registry set <host> [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--description` |  | `string` |  | registry description (set to an empty string to clear it) |
| `--kind` |  | `string` | `basic` | registry auth kind (basic, ghcr, gcr, ecr, ecr_role; ecr_role takes the IAM role ARN as --username and no password) |
| `--password` |  | `string` |  | registry password or token on the command line — visible via the process list and shell history; prefer --password-stdin |
| `--password-stdin` |  | `bool` |  | read the password from stdin |
| `--username` |  | `string` |  | registry username (required on create; omitted on update keeps the stored username) |

## daytona role

Inspect the organization role catalog

```shell
daytona role
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona role list`](#daytona-role-list) | List available roles |

### daytona role list

List available roles

```shell
daytona role list
```

## daytona secret

Project secrets: set, list, get, delete

```shell
daytona secret
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona secret delete`](#daytona-secret-delete) | Delete a project secret |
| [`daytona secret get`](#daytona-secret-get) | Show one project's secret metadata |
| [`daytona secret list`](#daytona-secret-list) | List project secrets (metadata only) |
| [`daytona secret set`](#daytona-secret-set) | Create or update a project secret |

### daytona secret delete

Delete a project secret

```shell
daytona secret delete <name>
```

### daytona secret get

Show one project's secret metadata

```shell
daytona secret get <name>
```

### daytona secret list

List project secrets (metadata only)

```shell
daytona secret list [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `100` | max items to return, 1 to 200 |

### daytona secret set

Create or update a project secret

Create or update a project secret and print it (never its value). It reads the stored secret first, so options you do not pass keep their values: it needs read as well as write access to secrets.

```shell
daytona secret set <name> [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--allowed-domain` |  | `strings` |  | hosts where this secret's value may be sent (repeatable or comma-separated; no empty entries), or '\*' to remove domain restrictions; '\*' lets the value reach any HTTPS host including one a compromised sandbox controls |
| `--description` |  | `string` |  | secret description (set to an empty string to clear it) |
| `--from-file` |  | `string` |  | read the secret value from a file; strips exactly one trailing newline (or CRLF) |
| `--stdin` |  | `bool` |  | read the secret value from stdin; strips exactly one trailing newline (or CRLF) |
| `--value` |  | `string` |  | secret value on the command line — visible to other local users via the process list and shell history; prefer --stdin or --from-file |

## daytona service-account

Service accounts: create, list, get, update, delete

```shell
daytona service-account
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona service-account create`](#daytona-service-account-create) | Create a service account |
| [`daytona service-account delete`](#daytona-service-account-delete) | Archive a service account and revoke its live keys |
| [`daytona service-account get`](#daytona-service-account-get) | Show one service account |
| [`daytona service-account list`](#daytona-service-account-list) | List service accounts in the selected organization |
| [`daytona service-account update`](#daytona-service-account-update) | Update a service account's name and/or roles |

### daytona service-account create

Create a service account

```shell
daytona service-account create <name> [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--role` |  | `strings` |  | role slug (repeatable or comma-separated) |

### daytona service-account delete

Archive a service account and revoke its live keys

```shell
daytona service-account delete <id>
```

### daytona service-account get

Show one service account

```shell
daytona service-account get <id>
```

### daytona service-account list

List service accounts in the selected organization

```shell
daytona service-account list [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--all` |  | `bool` |  | follow every page until exhausted |
| `--cursor` |  | `string` |  | opaque continuation token |
| `--limit` |  | `int` | `100` | max items to return, 1 to 200 |

### daytona service-account update

Update a service account's name and/or roles

```shell
daytona service-account update <id> [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--name` |  | `string` |  | new service-account name |
| `--role` |  | `strings` |  | role slug (repeatable or comma-separated) |
