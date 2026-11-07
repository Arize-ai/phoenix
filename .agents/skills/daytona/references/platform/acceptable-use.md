## Contents

- Your users and your agents
- Prohibited use
- Cryptocurrency and token-earning workloads
- Security testing
- Enforcement
- Appeals
- Reporting abuse
- Related
- See Also



These guidelines describe how Daytona sandboxes should and shouldn't be used, to protect every customer and third parties on the internet.
> **Note: Terms of Service**
> These guidelines supplement the [Daytona Terms of Service ↗](https://www.daytona.io/terms-of-service) and any agreement you have signed with Daytona. If anything here conflicts with those documents, they govern.

The lists below are not exhaustive. If you're unsure whether a workload is allowed, ask [support@daytona.io](mailto:support@daytona.io) before you run it.

## Your users and your agents

You're responsible for everything that runs in your organization's sandboxes, including code run by your end users and actions taken by AI agents you operate. If you let others run code in Daytona through your product, you should have your own controls against abuse. When we decide how to respond to a violation, we take those controls into account.

## Prohibited use

Don't use Daytona sandboxes to do any of the following.

### Network abuse

- Access accounts, systems, or data without authorization, including other users' sandboxes.
- Scan, probe, or test systems you don't own or aren't authorized to test.
- Run internet-wide or broad-range scans without prior approval, even against systems you're authorized to test. See [Security testing](#security-testing).
- Launch denial-of-service attacks, or flood any system or network with traffic, including as a test or simulation.
- Forge or spoof packet, email, or other origin headers.
- Operate open proxies, open mail relays, open recursive DNS resolvers, or Tor relays or exit nodes.
- Run bandwidth-sharing or residential-proxy software, or otherwise resell or share sandbox network access.
- Host botnet or command-and-control infrastructure.

### Fraud and spam

- Send unsolicited bulk messages, or run phishing or credential-harvesting campaigns, other than phishing simulations approved under [Security testing](#security-testing).
- Run credential stuffing or password-cracking against accounts or systems you don't own.
- Commit ad, click, or engagement fraud, or mass-create accounts on third-party services.
- Solve CAPTCHAs as a service, or bypass third-party access controls, rate limits, or bot protection.

### Platform, quota, and billing abuse

- Circumvent usage limits, tiers, verification, network restrictions, or billing.
- Create, buy, or share accounts or organizations to obtain credits or capacity, or to evade a suspension.

### Illegal and harmful content

- Distribute malware, or content that is illegal or infringes intellectual property.
- Create, store, or distribute child sexual abuse material. We may report it to the appropriate authorities.
- Violate applicable sanctions or export controls, or provide access to sanctioned parties.

## Cryptocurrency and token-earning workloads

Don't use sandbox resources to earn digital assets:

- Mine cryptocurrency under any consensus mechanism, including proof-of-work and proof-of-space.
- Validate under proof-of-stake.
- Run nodes or workers that earn tokens for contributing compute, storage, or bandwidth, including decentralized compute, inference, storage, and bandwidth networks.

Building and testing blockchain software is fine. So is running local devnets or testnets and calling chain APIs.

## Security testing

Security work is a legitimate Daytona use case, including security agents and CTF or RL environments.

### No notice needed

Targeted, non-volumetric testing of systems you own or are authorized to test doesn't need notice.

### Needs approval first

- Internet-wide or broad-range scanning.
- Red-team, phishing, or malware simulations.

Denial-of-service and flooding tests aren't approved, even against your own systems.

To request approval, email [support@daytona.io](mailto:support@daytona.io) with your organization ID, the workload, and the targets or ranges. We confirm in writing whether and how it can run. Approval reduces, but does not remove, the chance of automated action.

Keep security workloads pointed at their targets with a network allowlist; see [Network Limits](../python-sdk/network-limits.md#create-sandboxes-with-network-restrictions). You're responsible for damage your testing causes, including testing by third parties acting on your behalf.

Testing other customers' sandboxes is never permitted. Testing Daytona itself is covered by our vulnerability disclosure program; report vulnerabilities through the [Daytona security policy ↗](https://github.com/daytona/.github/blob/main/SECURITY.md).

## Enforcement

We use automated detection and manual review to identify prohibited use. Depending on the severity and context, we may stop affected sandboxes, restrict or suspend an organization, or terminate an account under the Terms of Service.

Where we can do so without risk to the platform or others, we aim to contact you before taking action that affects your whole organization.

## Appeals

If you think we got it wrong, email [support@daytona.io](mailto:support@daytona.io) with your organization ID, the affected sandbox IDs, and what the workload was doing at the time. Contract customers can also use the support channel defined in their agreement.

A person reviews every appeal. If the action was taken in error, we restore access. If you've fixed the cause, tell us what changed and we'll review reinstatement.

## Reporting abuse

To report abuse coming from a Daytona sandbox, email [support@daytona.io](mailto:support@daytona.io). Include the source IP addresses, UTC timestamps, the destination, and any relevant logs.

## Related

- [Network Limits](../python-sdk/network-limits.md)
- [Limits](./limits.md)
- [Organizations](./organizations.md)
- [Daytona Terms of Service ↗](https://www.daytona.io/terms-of-service)

## See Also

- [Python SDK](../python-sdk/README.md)
- [TypeScript SDK](../typescript-sdk/README.md)
- [Java SDK](../java-sdk/README.md)
- [Go SDK](../go-sdk/README.md)
- [Ruby SDK](../ruby-sdk/README.md)
