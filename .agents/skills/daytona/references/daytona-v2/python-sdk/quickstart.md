# Quick Start (Python SDK)

Start managing your sandboxes with Daytona.

Daytona is secure and elastic cloud infrastructure built for autonomous agents.

Daytona provides composable **computers for agents** — [sandboxes](./sandboxes.md) — virtual machines with hardware isolation, a dedicated kernel, filesystem, network, and allocated vCPU, RAM, and disk.

Sandboxes are the core component of the Daytona platform and provide compute for agents. They spin up in under 90ms from code to execution and run any code in Python, TypeScript, and JavaScript. Built on OCI/Docker compatibility and massive parallelization, sandboxes deliver consistent, predictable environments for AI, autonomous agents, and reinforcement learning.

- [Linux](./linux-sandboxes.md): Run code from AI agents, coding agents, reinforcement learning environments, and users in Firecracker microVMs.
- [Windows](../platform/windows-sandboxes.md): Run Windows virtual machines from a prepared base image or from an image of another Windows sandbox.
- [macOS](./macos-sandboxes.md): Build, test, and automate software that needs macOS, Xcode, or the iPhone simulator on dedicated Apple silicon.
- [GPU](../platform/gpu-sandboxes.md): Run model inference, training, fine-tuning, and reinforcement learning on Linux sandboxes with dedicated GPUs.

## Get started

**Agent Prompt:**

```text
Set up Daytona in this project. Before writing any Daytona code, verify the setup:

1. Check that the Daytona SDK is installed for the language used in this project. If not, install it.

    Python: `pip install "daytona>=2,<3"`
    TypeScript: `npm install @daytona/sdk@2`

2. Check DAYTONA_API_KEY in the shell environment or in environment files. If not set, tell the user they need an API key and point them to https://app.daytona.com/dashboard/keys to create one.

3. Write a script that initializes the Daytona client, creates a sandbox with the v2 API (`daytona.v2.create()`), runs a "Hello World" program inside it, captures the output, and deletes the sandbox. Follow https://www.daytona.com/docs/quickstart.md.

4. Run the script to verify the sandbox works.
```

1. **Create an account** → [app.daytona.com](https://app.daytona.com)
2. **Get an API key** → [app.daytona.com/dashboard/keys](https://app.daytona.com/dashboard/keys)
3. **Save the API key** → `DAYTONA_API_KEY` environment variable or in a `.env` file.

**.env:**

```dotenv
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

4. **Install the Python SDK**

    **Bash/Zsh:**

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install "daytona>=2,<3"
```

**Windows PowerShell:**

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install "daytona>=2,<3"
```

5. **Create a sandbox and run code**

    ```python
    from daytona import Daytona

    daytona = Daytona()

    sandbox = daytona.v2.create()

    response = sandbox.run_code('print("Hello World")')
    print(response.logs.stdout)
    ```

## Reference

Daytona provides addresses, credentials, SDKs, APIs, and machine-readable docs for developers and agents that build on the platform.

| **Resource**       | **Reference**                                                                                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**      | [`https://app.daytona.com`](https://app.daytona.com)                                                                                                                                                                                   |
| **API**            | `https://api.daytona.com`, [Platform](../api/README.md#daytona-api) ([OpenAPI](https://www.daytona.com/docs/openapi.json)) |
| **Toolbox**        | [Toolbox](./sandboxes.md#toolbox), [Toolbox API](../api/README.md#toolbox-api) ([OpenAPI](https://www.daytona.com/docs/toolbox-openapi.json))                                                                                                                                                                   |
| **Authentication** | [API keys](./authentication.md#get-an-api-key), [Environment variables](./authentication.md#environment-variables)                                                                                                                                           |
| **Sandboxes**      | [Linux](./linux-sandboxes.md), [Windows](../platform/windows-sandboxes.md), [macOS](./macos-sandboxes.md), [GPU](../platform/gpu-sandboxes.md)                                                                                                         |
| **SDKs**           | [TypeScript](../typescript-sdk/README.md), [Python](./README.md)                                                                                                                                                                         |
| **CLI**            | [Mac/Linux/Windows](../cli/README.md)                                                                                                                                                                                                         |
| **Skills**         | [Agent Skills](../platform/agent-skills.md)                                                                                                                                                                                                     |
| **LLMs**           | [llms.txt](https://www.daytona.com/llms.txt), [llms-full.txt](https://www.daytona.com/llms-full.txt)                                                                                                                                   |
| **Markdown**       | Suffix any docs page with `.md`, for example [sandboxes.md](./sandboxes.md)                                                                                                                                                        |
