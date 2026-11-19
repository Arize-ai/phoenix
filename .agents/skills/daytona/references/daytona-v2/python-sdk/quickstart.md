# Quick Start (Python SDK)

Start managing your sandboxes with Daytona.

Daytona is secure and elastic cloud infrastructure built for autonomous agents.

Daytona provides composable **computers for agents** — [sandboxes](./sandboxes.md) — virtual machines with hardware isolation, a dedicated kernel, filesystem, network, and allocated vCPU, RAM, and disk.

Sandboxes are the core component of the Daytona platform and provide compute for agents. They spin up in under 90ms from code to execution and run any code in Python, TypeScript, and JavaScript. Built on OCI/Docker compatibility and massive parallelization, sandboxes deliver consistent, predictable environments for AI, autonomous agents, and reinforcement learning.

## Get started

1. Create an account → [app.daytona.com](https://app.daytona.com)
2. Get an API key → [app.daytona.com/dashboard/keys](https://app.daytona.com/dashboard/keys)
3. Save the API key → `DAYTONA_API_KEY` environment variable or in a `.env` file.

**.env:**

```bash
DAYTONA_API_KEY=YOUR_API_KEY
```

**Bash/Zsh:**

```bash
export DAYTONA_API_KEY=YOUR_API_KEY
```

**Windows PowerShell:**

```powershell
$env:DAYTONA_API_KEY="YOUR_API_KEY"
```

4. Install the Python SDK

    **Bash/Zsh:**

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install daytona==2.0.0a13
```

**Windows PowerShell:**

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install daytona==2.0.0a13
```

5. Create a sandbox and run code

    ```python
    from daytona import Daytona

    daytona = Daytona()

    sandbox = daytona.v2.create()

    response = sandbox.run_code('print("Hello World")')
    print(response.logs.stdout)
    ```

## Reference

Daytona provides a comprehensive set of resources for developers and agents to get started and build on the platform. A reference is documentation that a reader looks up for exact facts, such as names, values, and formats, instead of reading it from the first page to the last. You can find the following resources in the documentation:

- **Daytona Sandboxes**: [Linux](./sandboxes.md#linux-sandboxes), [Windows](./sandboxes.md#windows-sandboxes), [GPU](./sandboxes.md#gpu-sandboxes), [macOS](./sandboxes.md#macos-sandboxes)
- **Daytona SDKs**: [TypeScript](../typescript-sdk/README.md), [Python](./README.md)
- **Daytona APIs**: [Platform](../api/README.md#daytona-api) ([OpenAPI](https://www.daytona.com/docs/openapi.json)), [Toolbox](../api/README.md#toolbox-api) ([OpenAPI](https://www.daytona.com/docs/toolbox-openapi.json))
- **Daytona CLI**: [Mac/Linux/Windows](../cli/README.md)
- **Daytona LLMs**: [llms.txt](https://www.daytona.com/llms.txt), [llms-full.txt](https://www.daytona.com/llms-full.txt)
- **Daytona Markdown**: suffix pages with `.md` (e.g [sandboxes.md](./sandboxes.md))
