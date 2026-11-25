---
name: daytona
description: Creates and manages isolated cloud sandboxes (secure code execution environments with dedicated runtimes) on the Daytona platform, through the SDKs, the CLI, and the REST API. Use when a task needs an isolated runtime, sandbox, secure compute, or Daytona SDK, API, or CLI operations. Covers Daytona v2 (`daytona.v2`, api.daytona.com, Python and TypeScript SDKs) and Daytona v0 (app.daytona.io, Python, TypeScript, Java, Go, and Ruby SDKs).
---

## What is Daytona

Daytona provides sandboxes for AI agents: isolated runtime environments, each with its own kernel, filesystem, network stack, and allocated vCPU, RAM, and disk. Agents install packages, run servers, compile code, and manage processes inside sandboxes.

Daytona has two platform versions with different SDK entry points, API hosts, and sandbox lifecycles. Each version has its own guide and reference files in this skill. Do not mix calls or examples from the two versions.

## Pick the Version

Check which version the code or project targets before you write or change it.

| | **Daytona v2** | **Daytona v0** |
|---|---|---|
| SDK entry point | `daytona.v2.create()` | `daytona.create()` |
| SDK version | Python and TypeScript `2.x` | Python and TypeScript `0.x`, or `2.x` through the `daytona.v0` namespace |
| SDK languages | Python, TypeScript | Python, TypeScript, Java, Go, Ruby |
| API base URL | `https://api.daytona.com` | `https://app.daytona.io/api` |
| Dashboard | `https://app.daytona.com` | `https://app.daytona.io` |
| Linux sandbox lifecycle | Ephemeral: no stop, start, or archive. Delete discards the filesystem. | Stop, start, archive |
| CLI install (macOS) | `brew install daytonaio/cli/daytona` | `brew install daytonaio/cli/daytona-v0` |

1. **Existing code:** use the version the code already targets. Check the installed SDK version (`pip show daytona`, `package.json`), the SDK calls (`daytona.v2` or not), and the API host.
2. **New code:** if the request does not name a version, ask the user which one their organization uses. Java, Go, and Ruby are v0 only.

## Guides

| Version | Guide | References |
|---|---|---|
| Daytona v2 | [daytona-v2/README.md](./references/daytona-v2/README.md) | `./references/daytona-v2/`: `python-sdk/`, `typescript-sdk/`, `platform/`, `cli/`, `api/` |
| Daytona v0 | [daytona-v0/README.md](./references/daytona-v0/README.md) | `./references/daytona-v0/`: `python-sdk/`, `typescript-sdk/`, `java-sdk/`, `go-sdk/`, `ruby-sdk/`, `platform/`, `cli.md`, `api/` |

Read the guide for the selected version first. It covers setup, SDK essentials, common patterns, limits, and an index of its reference files. Links in each guide are relative to that guide's folder.

To move an organization from v0 to v2, see [migrate-from-v0.md](./references/daytona-v2/platform/migrate-from-v0.md).
