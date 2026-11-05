## Contents

- Get started
- Next steps
- Reference
- See Also




Daytona is a secure and elastic infrastructure for running AI-generated code.

Daytona provides **full composable computers** — [sandboxes](./sandboxes.md) — with complete isolation, a dedicated kernel, filesystem, network stack, and allocated vCPU, RAM, and disk.

Sandboxes are the core component of the Daytona platform, spinning up in under 90ms from code to execution and running any code in Python, TypeScript, and JavaScript. Built on OCI/Docker compatibility, massive parallelization, and unlimited persistence, sandboxes deliver consistent, predictable environments for AI, agent and reinforcement learning workflows.

Agents and developers interact with sandboxes programmatically using the SDKs, API, and CLI.

<AgentPrompt
  title="Agent Prompt"
  prompt={`
Help me set up Daytona in this project. Before writing any Daytona code, verify the setup:

1. Check that the Daytona SDK is installed for the language used in this project. If not, install it.

    Python: \`pip install daytona\`
    TypeScript: \`npm install @daytona/sdk\`
    Ruby: \`gem install daytona\`
    Go: \`go get github.com/daytona/clients/sdk-go\`
    Java: add the \`io.daytona:sdk\` dependency to \`build.gradle.kts\` or \`pom.xml\`

2. Check DAYTONA_API_KEY in the shell environment or in environment files. If not set, tell the user they need an API key and point them to https://app.daytona.io/dashboard/keys to create one.

3. Write a script that initializes the Daytona client, creates a sandbox, runs a "Hello World" program inside it, captures the output, and deletes the sandbox.

4. Run the script to verify the sandbox works.
`}
/>

## Get started

1. Create an account → [app.daytona.io](https://app.daytona.io)
2. Get an API key → [app.daytona.io/dashboard/keys](https://app.daytona.io/dashboard/keys)
3. Save the API key → **`DAYTONA_API_KEY`** environment variable or in a **`.env`** file.

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

4. Install the Java SDK

    **Gradle**

    Add the Daytona SDK dependency to your `build.gradle.kts`:

    ```kotlin
    dependencies {
        implementation("io.daytona:sdk-java:0.1.0")
    }
    ```

    **Maven**

    Add the Daytona SDK dependency to your `pom.xml`:

    ```xml
    <dependency>
      <groupId>io.daytona</groupId>
      <artifactId>sdk-java</artifactId>
      <version>0.1.0</version>
    </dependency>
    ```

5. Create a sandbox and run code

    ```java
    import io.daytona.sdk.Daytona;
    import io.daytona.sdk.Sandbox;
    import io.daytona.sdk.DaytonaConfig;
    import io.daytona.sdk.model.ExecuteResponse;

    public class Main {
        public static void main(String[] args) {
            DaytonaConfig config = new DaytonaConfig.Builder()
                .apiKey("YOUR_API_KEY")
                .build();

            try (Daytona daytona = new Daytona(config)) {
                Sandbox sandbox = daytona.create();

                // Run code
                ExecuteResponse response = sandbox.getProcess().codeRun("print(\"Hello World\")");
                System.out.println(response.getResult());
            }
        }
    }
    ```

## Next steps

Daytona provides core platform resources for managing sandboxes, environments, and storage.

- [Linux sandboxes](./linux-sandboxes.md): Linux container and virtual machine runtime for running processes, executing code, and Linux-specific tools.
- [Windows sandboxes](./windows-sandboxes.md): Windows OS runtime in a virtual machine for running Windows applications and tooling.
- [macOS sandboxes](https://www.daytona.com/docs/macos-sandboxes): macOS runtime for automating applications and desktop interactions.
- [GPU sandboxes](./gpu-sandboxes.md): NVIDIA and AMD GPU runtime for CUDA development, 3D and graphics workloads, and other GPU-accelerated compute.

## Reference

Daytona provides a comprehensive set of resources for developers and agents to get started and build on the platform. You can find the following resources in the documentation:

- **Daytona SDKs**: [TypeScript](../typescript-sdk/README.md), [Python](../python-sdk/README.md), [Ruby](../ruby-sdk/README.md), [Go](../go-sdk/README.md), [Java](./README.md)
- **Daytona APIs**: [Platform](../api/README.md#daytona) ([OpenAPI](https://www.daytona.io/docs/en/openapi.json)), [Toolbox](../api/README.md#daytona-toolbox) ([OpenAPI](https://www.daytona.io/docs/en/toolbox-openapi.json)), [Analytics](../api/README.md#daytona-analytics) ([OpenAPI](https://www.daytona.io/docs/en/analytics-openapi.json))
- **Daytona CLI**: [Mac/Linux/Windows](../cli.md)
- **Daytona LLMs**: [llms.txt](https://www.daytona.io/docs/llms.txt), [llms-full.txt](https://www.daytona.io/docs/llms-full.txt)
- **Daytona Sitemap**: [sitemap-0.xml](https://www.daytona.io/docs/sitemap-0.xml)
- **Daytona Skills**: [agent skills](../platform/agent-skills.md)
- **Daytona Markdown**: suffix pages with **`.md`** (e.g [sandboxes.md](https://www.daytona.io/docs/en/sandboxes.md))

## See Also
- [Python SDK - getting-started](../python-sdk/getting-started.md)
- [TypeScript SDK - getting-started](../typescript-sdk/getting-started.md)
