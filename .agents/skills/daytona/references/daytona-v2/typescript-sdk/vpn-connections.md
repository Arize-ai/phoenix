# VPN Connections (TypeScript SDK)

Connect your sandboxes to private networks.

VPN connections are encrypted links that join a sandbox to a private network over the internet. A sandbox on a virtual private network (VPN) gets an address on that network, so it reaches internal databases and services by their private IP addresses.

Daytona connects sandboxes to private networks through a VPN client that runs inside the sandbox. Once connected, the sandbox reaches private network services, and other devices on the network reach it. The sandbox keeps its VPN connection for as long as the client runs.

Use VPN connections to test applications against services within a private network, access shared development resources, and connect to existing corporate VPNs or resources behind firewalls. Sandboxes connect to Tailscale, OpenVPN, and Netbird networks. To connect, you need a [sandbox](./sandboxes.md) and the credentials of your VPN network provider.

## Contents

- [Tailscale](#tailscale)
- [OpenVPN](#openvpn)
- [Netbird](#netbird)

## Tailscale

Tailscale is a VPN service that joins devices into a private network, where each device has its own address and reaches the other devices on the network. It builds on the WireGuard protocol: a coordination server hands out the public keys of each device, and devices then open encrypted tunnels directly to each other where the network allows it.

A sandbox on a Tailscale network becomes part of the private network and appears as a device within it, with its own Tailscale IP address. It reaches the devices and services on the network, and other devices on the network reach the sandbox.

Use Tailscale to access resources within your private Tailscale network from a sandbox. Connect the sandbox to the network with a [browser login](#tailscale-browser-login), an [auth key](#tailscale-auth-key), or the [web terminal](#tailscale-web-terminal).

### Tailscale browser login

A Tailscale browser login is an interactive authentication flow in which Tailscale generates a unique login URL, and a person visits it in a web browser to authenticate the device. The person signs in with their own account and identity provider, so the device never sees the password.

A browser login of a sandbox runs inside the sandbox and waits until a person completes it in a browser. The sandbox then keeps its VPN connection for as long as the Tailscale service runs.

Use browser login when a person can authenticate the sandbox in a web browser. The process installs Tailscale, starts the daemon, initiates the login, and then polls for the authentication status until the connection is established. The snippets below connect with a browser login.

```typescript
import { Daytona } from '@daytona/sdk'

// Configuration
const DAYTONA_API_KEY = 'YOUR_API_KEY' // Replace with your API key

// Initialize the Daytona client
const daytona = new Daytona({
  apiKey: DAYTONA_API_KEY,
})

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function setupTailscaleVpnInteractive(): Promise<void> {
  /**
   * Connect a Daytona sandbox to a Tailscale network using the TypeScript SDK.
   * Uses interactive login via browser URL (no auth key required).
   */

  // Create the sandbox
  console.log('Creating sandbox...')
  const sandbox = await daytona.v2.create('ubuntu-24.04')
  console.log(`Sandbox created: ${sandbox.id}`)

  // Step 1: Install Tailscale
  console.log('\nInstalling Tailscale (this may take a few minutes)...')
  let response = await sandbox.process.run('curl -fsSL https://tailscale.com/install.sh | sh', { timeoutSeconds: 300 })
  if (response.exitCode !== 0) {
    console.log(`Error installing Tailscale: ${response.output}`)
    return
  }
  console.log('Tailscale installed successfully.')

  // Step 2: Start tailscaled daemon in background
  console.log('\nStarting tailscaled daemon...')
  await sandbox.process.run('nohup sudo tailscaled > /dev/null 2>&1 &', { timeoutSeconds: 10 })

  // Wait for daemon to initialize
  await sleep(3000)

  // Step 3: Run tailscale up in background and capture output to a file
  console.log('\nInitiating Tailscale login...')
  await sandbox.process.run('sudo tailscale up > /tmp/tailscale-login.txt 2>&1 &', { timeoutSeconds: 10 })

  // Wait for the login URL to be written to the file
  await sleep(3000)

  // Read the login URL from the output file
  response = await sandbox.process.run('cat /tmp/tailscale-login.txt', { timeoutSeconds: 10 })
  const output = response.output || ''
  const urlMatch = output.match(/https:\/\/login\.tailscale\.com\/a\/[^\s]+/)

  if (urlMatch) {
    const loginUrl = urlMatch[0]
    console.log('\n' + '='.repeat(60))
    console.log('To authenticate, visit this URL in your browser:')
    console.log(`\n  ${loginUrl}`)
    console.log('\n' + '='.repeat(60))
    console.log('\nWaiting for authentication...')

    // Poll for connection status
    const maxWait = 300 // 5 minutes max wait
    const pollInterval = 5
    let waited = 0

    while (waited < maxWait) {
      await sleep(pollInterval * 1000)
      waited += pollInterval

      const statusResponse = await sandbox.process.run('tailscale status 2>&1', { timeoutSeconds: 30 })
      const statusOutput = statusResponse.output || ''

      // Check if we're connected (status shows our machine without login prompt)
      if (
        statusResponse.exitCode === 0 &&
        !statusOutput.toLowerCase().includes('logged out')
      ) {
        // Verify we have an IP assigned
        const ipResponse = await sandbox.process.run('tailscale ip -4 2>&1', { timeoutSeconds: 10 })
        if (ipResponse.exitCode === 0 && ipResponse.output?.trim()) {
          console.log('\nConnected to Tailscale network!')
          console.log(`Tailscale IP: ${ipResponse.output.trim()}`)
          break
        }
      }

      console.log(`  Still waiting... (${waited}s)`)
    }

    if (waited >= maxWait) {
      console.log('\nTimeout waiting for authentication. Please try again.')
      return
    }
  } else {
    // Maybe already connected or different output
    console.log(`Output from tailscale up:\n${output}`)

    // Check if already connected
    const statusResponse = await sandbox.process.run('tailscale status', { timeoutSeconds: 30 })
    if (statusResponse.exitCode === 0) {
      console.log('\nTailscale status:')
      console.log(statusResponse.output)
    }
  }

  // Final status check
  console.log('\nFinal Tailscale status:')
  response = await sandbox.process.run('tailscale status', { timeoutSeconds: 30 })
  console.log(response.output)
}

// Run the main function
setupTailscaleVpnInteractive().catch(console.error)
```

| **Parameter** | **Description** |
| --- | --- |
| `image` | Sets the registered image that the sandbox starts from.<br />**Format:** an image name or ID<br />**Example:** `'ubuntu-24.04'` |
| `timeoutSeconds` | Sets how many seconds run() waits for the command, without stopping the command.<br />**Default:** no limit<br />**Value:** `0` for no limit<br />**Example:** `300` |

> **Notes:**
>
> - **Permissions:** The requests require the `write:sandboxes` permission.
> - **Clients:** run() returns when the shell exits, so a command that ends with & and redirects its output leaves its daemon running in the background after run() returns.

### Tailscale auth key

A Tailscale auth key joins a device to a Tailscale network without a browser login. It is a secret made in advance that stands in for a person's login, so whoever holds it can add a device.

An auth key connects a sandbox to Tailscale with no person at a browser. Once the connection is established, the sandbox keeps its VPN connection for as long as the Tailscale service runs.

Use an auth key for automated scripts, CI and CD pipelines, and any scenario without manual browser interaction. Generate the key in the Tailscale admin console, which produces a script that installs Tailscale and connects to the Tailscale network:

1. Access your [Tailscale admin console ↗](https://login.tailscale.com/admin/machines)
2. Click **Add device** and select **Linux server**
3. Apply the configuration and click **Generate install script**
4. Copy the auth key from the generated script

```typescript
import { Daytona } from '@daytona/sdk'

// Configuration
const DAYTONA_API_KEY = 'YOUR_API_KEY' // Replace with your API key
const TAILSCALE_AUTH_KEY = 'YOUR_AUTH_KEY' // Replace with your auth key

// Initialize the Daytona client
const daytona = new Daytona({
  apiKey: DAYTONA_API_KEY,
})

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function setupTailscaleVpn(authKey: string): Promise<void> {
  /**
   * Connect a Daytona sandbox to a Tailscale network using the TypeScript SDK.
   * Uses auth-key for non-interactive authentication.
   */

  // Create the sandbox
  console.log('Creating sandbox...')
  const sandbox = await daytona.v2.create('ubuntu-24.04')
  console.log(`Sandbox created: ${sandbox.id}`)

  // Step 1: Install Tailscale
  console.log('\nInstalling Tailscale (this may take a few minutes)...')
  let response = await sandbox.process.run('curl -fsSL https://tailscale.com/install.sh | sh', { timeoutSeconds: 300 })
  if (response.exitCode !== 0) {
    console.log(`Error installing Tailscale: ${response.output}`)
    return
  }
  console.log('Tailscale installed successfully.')

  // Step 2: Start tailscaled daemon manually (systemd doesn't auto-start in sandboxes)
  console.log('\nStarting tailscaled daemon...')
  await sandbox.process.run('nohup sudo tailscaled > /dev/null 2>&1 &', { timeoutSeconds: 10 })

  // Wait for daemon to initialize
  await sleep(3000)

  // Step 3: Connect with auth key
  console.log('\nConnecting to Tailscale network...')
  response = await sandbox.process.run(`sudo tailscale up --auth-key=${authKey}`, { timeoutSeconds: 60 })

  if (response.exitCode !== 0) {
    console.log(`Error connecting: ${response.output}`)
    return
  }

  console.log('Connected to Tailscale network.')

  // Verify connection status
  console.log('\nChecking Tailscale status...')
  response = await sandbox.process.run('tailscale status', { timeoutSeconds: 30 })
  console.log(`Status:\n${response.output}`)
}

// Run the main function
setupTailscaleVpn(TAILSCALE_AUTH_KEY).catch(console.error)
```

| **Parameter** | **Description** |
| --- | --- |
| `image` | Sets the registered image that the sandbox starts from.<br />**Format:** an image name or ID<br />**Example:** `'ubuntu-24.04'` |
| `timeoutSeconds` | Sets how many seconds run() waits for the command, without stopping the command.<br />**Default:** no limit<br />**Value:** `0` for no limit<br />**Example:** `300` |

> **Notes:**
>
> - **Permissions:** The requests require the `write:sandboxes` permission.
> - **Clients:** run() returns when the shell exits, so a command that ends with & and redirects its output leaves its daemon running in the background after run() returns.

### Tailscale web terminal

A Tailscale web terminal setup is a manual installation of Tailscale from a shell, one command at a time. Each step shows its output, so a person can follow and customize the setup.

A manual setup in a sandbox runs the Tailscale daemon in a detached tmux session, because the sandbox joins the Tailscale network only while the daemon runs in the background.

Set up Tailscale through the [web terminal](./web-terminal.md) or [SSH](./ssh-access.md) when you work directly in the terminal or want more control over the connection. The installation script installs Tailscale and initializes its CLI, a tmux session or a similar tool keeps the daemon running, and the interactive login flow authenticates the sandbox. Once connected, the sandbox appears in your [Tailscale dashboard](https://login.tailscale.com/admin/machines).

1. Navigate to your sandbox [web terminal](./web-terminal.md) in [Daytona Dashboard ↗](https://app.daytona.com), or [access it via SSH](./ssh-access.md)

**CLI:**

```bash
# Install Tailscale using the official installation script
curl -fsSL https://tailscale.com/install.sh | sh

# Install tmux
sudo apt install tmux

# Start the Tailscale daemon in a detached tmux session
tmux new -d -s tailscale 'sudo tailscaled'

# Connect and authenticate your sandbox with the Tailscale network
sudo tailscale up
```

| **Flag** | **Description** |
| --- | --- |
| `-d` | Starts the tmux session detached from the terminal. |
| `-s` | Sets the name of the tmux session.<br />**Example:** `tailscale` |

> **Notes:**
>
> - **Order:** `sudo tailscale up` prints an authentication URL of the form `https://login.tailscale.com/a/<id>`; open it in a browser and follow its instructions.
> - **Results:** The terminal then prints `Your device <id> is logged in to the <address> tailnet.`

## OpenVPN

OpenVPN is a VPN protocol and software that uses a client-server model, in which a client connects to an OpenVPN server and joins the network behind it. It carries traffic through a tunnel secured with TLS, and the client and server prove who they are with certificates or keys.

A sandbox on an OpenVPN network acts as a client that connects to your OpenVPN server. It needs a client configuration file to connect to the server.

Use OpenVPN to connect to existing corporate VPNs, access resources behind firewalls, or integrate with infrastructure that already uses OpenVPN. Connecting a sandbox to an OpenVPN network requires a [client configuration file](#openvpn-client-configuration-file). Connect from code with an [OpenVPN client configuration](#openvpn-client-configuration), or by hand through the Daytona [web terminal](#openvpn-web-terminal).

### OpenVPN client configuration file

An OpenVPN client configuration file contains the connection parameters, certificates, and keys that a client needs to establish a secure connection to an OpenVPN server. A network administrator typically provides it, or the OpenVPN server setup generates it.

The client configuration file of a sandbox is a file inside the sandbox that the OpenVPN client reads when it starts the tunnel to the OpenVPN server.

Create the file with a text editor such as nano or vim, or upload it to your sandbox if you prepared it elsewhere. The file must contain all the required connection settings, including server address, port, protocol, encryption settings, and authentication credentials. The following snippet is an example of a client configuration file. Replace the placeholders in the example with the actual values provided by your OpenVPN server.

**CLI:**

```text
client
proto udp
explicit-exit-notify
remote <YOUR_OPENVPN_SERVER_IP> <YOUR_OPENVPN_SERVER_PORT>
dev tun
resolv-retry infinite
nobind
persist-key
persist-tun
remote-cert-tls server
verify-x509-name <YOUR_OPENVPN_SERVER_NAME> name
auth SHA256
auth-nocache
cipher AES-128-GCM
ignore-unknown-option data-ciphers
data-ciphers AES-128-GCM
ncp-ciphers AES-128-GCM
tls-client
tls-version-min 1.2
tls-cipher TLS-ECDHE-ECDSA-WITH-AES-128-GCM-SHA256
tls-ciphersuites TLS_AES_256_GCM_SHA384:TLS_AES_128_GCM_SHA256:TLS_CHACHA20_POLY1305_SHA256
ignore-unknown-option block-outside-dns
setenv opt block-outside-dns # Prevent Windows 10 DNS leak
verb 3
<ca>
-----BEGIN CERTIFICATE-----
<YOUR_OPENVPN_SERVER_CERTIFICATE>
-----END CERTIFICATE-----
</ca>
<cert>
-----BEGIN CERTIFICATE-----
<YOUR_OPENVPN_CLIENT_CERTIFICATE>
-----END CERTIFICATE-----
</cert>
<key>
-----BEGIN PRIVATE KEY-----
<YOUR_OPENVPN_CLIENT_PRIVATE_KEY>
-----END PRIVATE KEY-----
</key>
<tls-crypt-v2>
-----BEGIN OpenVPN tls-crypt-v2 client key-----
<YOUR_OPENVPN_TLS_CRYPT_V2_CLIENT_KEY>
-----END OpenVPN tls-crypt-v2 client key-----
</tls-crypt-v2>
```

### OpenVPN client configuration

An OpenVPN client configuration connection starts the OpenVPN client with a client configuration file, which holds the settings and credentials that the tunnel needs. The client reads the file at startup, then connects to the server the file names and opens an encrypted tunnel to it.

The OpenVPN client in a sandbox runs as a background process that holds the tunnel open.

Use a client configuration to connect a sandbox to OpenVPN from code. The following snippets install OpenVPN, write the [client configuration file](#openvpn-client-configuration-file), start the tunnel in the background, and check that the tun0 network interface of the tunnel is up.

```typescript
import { Daytona } from '@daytona/sdk';
import { Image } from '@daytona/sdk/v2';

// Configuration
const DAYTONA_API_KEY = "YOUR_API_KEY"; // Replace with your API key

// OpenVPN client configuration (paste your .ovpn config here)
const OPENVPN_CONFIG = `
`.trim();

// Initialize the Daytona client
const daytona = new Daytona({
  apiKey: DAYTONA_API_KEY,
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function setupOpenvpn(ovpnConfig: string): Promise<void> {
  /**
   * Connect a Daytona sandbox to an OpenVPN network using the TypeScript SDK.
   */

  // Create the sandbox
  console.log("Creating sandbox...");
  const sandbox = await daytona.v2.create('ubuntu-24.04');
  console.log(`Sandbox created: ${sandbox.id}`);

  // Step 1: Install OpenVPN
  console.log("\nInstalling OpenVPN...");
  let response = await sandbox.process.run("sudo apt update && sudo apt install -y openvpn", { timeoutSeconds: 120 });
  if (response.exitCode !== 0) {
    console.log(`Error installing OpenVPN: ${response.output}`);
    return;
  }
  console.log("OpenVPN installed successfully.");

  // Step 2: Write the OpenVPN config file
  console.log("\nWriting OpenVPN configuration...");
  // Use heredoc to write the config file
  await sandbox.process.run(`cat << 'OVPNEOF' > /tmp/client.ovpn
${ovpnConfig}
OVPNEOF`, { timeoutSeconds: 30 });
  console.log("Configuration written to /tmp/client.ovpn");

  // Step 3: Start OpenVPN in background
  console.log("\nStarting OpenVPN tunnel...");
  await sandbox.process.run("nohup sudo openvpn /tmp/client.ovpn > /tmp/openvpn.log 2>&1 &", { timeoutSeconds: 10 });

  // Wait for connection to establish
  console.log("Waiting for VPN connection to establish...");
  await sleep(10000);

  // Step 4: Verify connection
  console.log("\nVerifying OpenVPN connection...");

  // Check if tun interface exists
  response = await sandbox.process.run("ip addr show tun0", { timeoutSeconds: 10 });
  if (response.exitCode === 0) {
    console.log("VPN tunnel interface (tun0) is up:");
    console.log(response.output);
  } else {
    console.log("Warning: tun0 interface not found. Checking OpenVPN logs...");
    const logResponse = await sandbox.process.run("cat /tmp/openvpn.log", { timeoutSeconds: 10 });
    console.log(`OpenVPN log:\n${logResponse.output}`);
    return;
  }

  // Get public IP through VPN
  console.log("\nChecking public IP (should be VPN server IP)...");
  response = await sandbox.process.run("curl -s ifconfig.me", { timeoutSeconds: 30 });
  if (response.exitCode === 0) {
    console.log(`Public IP: ${response.output}`);
  } else {
    console.log(`Could not determine public IP: ${response.output}`);
  }

  console.log("\nOpenVPN connection established successfully.");
}

// Run the main function
setupOpenvpn(OPENVPN_CONFIG).catch(console.error);
```

| **Parameter** | **Description** |
| --- | --- |
| `image` | Sets the registered image that the sandbox starts from.<br />**Format:** an image name or ID<br />**Example:** `'ubuntu-24.04'` |
| `timeoutSeconds` | Sets how many seconds run() waits for the command, without stopping the command.<br />**Default:** no limit<br />**Value:** `0` for no limit<br />**Example:** `300` |

> **Notes:**
>
> - **Permissions:** The requests require the `write:sandboxes` permission.
> - **Clients:** run() returns when the shell exits, so a command that ends with & and redirects its output leaves its daemon running in the background after run() returns.

### OpenVPN web terminal

An OpenVPN web terminal setup installs OpenVPN by hand, one command at a time. Each command prints its output, so a person can check the result before running the next one.

A manual setup in a sandbox runs the OpenVPN tunnel in a detached tmux session, because the sandbox stays connected to the OpenVPN network only while the tunnel runs in the background.

Set up OpenVPN through the Daytona [web terminal](./web-terminal.md) or [SSH](./ssh-access.md) to install OpenVPN and connect to your OpenVPN network by hand. A tmux session, or a similar tool, keeps the tunnel running in the background and survives disconnects. The last step prints the IP address of the sandbox connected to the OpenVPN network, which verifies the connection.

1. In [Daytona Dashboard ↗](https://app.daytona.com), open the sandbox [web terminal](./web-terminal.md) (`>_`), or use [SSH](./ssh-access.md)

**CLI:**

```bash
# Install OpenVPN and tmux
sudo apt update && sudo apt install -y openvpn tmux

# Create the OpenVPN client configuration file for your Daytona sandbox
sudo nano client.ovpn

# Start the OpenVPN tunnel in a background tmux session
tmux new -d -s openvpn 'sudo openvpn client.ovpn'

# Verify the OpenVPN connection
curl ifconfig.me
```

| **Flag** | **Description** |
| --- | --- |
| `-d` | Starts the tmux session detached from the terminal. |
| `-s` | Sets the name of the tmux session.<br />**Example:** `openvpn` |

> **Notes:**
>
> - **Order:** Write the [client configuration file](#openvpn-client-configuration-file) in nano, save with `Ctrl+O` and `Enter`, and exit with `Ctrl+X`.

## Netbird

Netbird is a VPN service that joins devices into a private network, where each device has its own address and reaches the other devices on the network. It builds on WireGuard: a management service shares keys and access rules, and devices connect over direct encrypted tunnels.

A sandbox on a Netbird network becomes part of the private network and appears as a device within it, with its own Netbird IP address. It reaches the devices and services on the network, and other devices on the network reach the sandbox.

Use Netbird to access resources within your private Netbird network from a sandbox. Connect the sandbox to the network with a [setup key](#netbird-setup-key) or a [browser login](#netbird-browser-login).

### Netbird setup key

A Netbird setup key joins a device to a Netbird network without a browser login. It is a secret made in advance that stands in for a person's login, so whoever holds it can register a device.

A setup key connects a sandbox to Netbird with no person at a browser.

Use a setup key for automated scripts, CI and CD pipelines, and any scenario without manual browser interaction. Create a new setup key in the Netbird dashboard, or use an existing one:

1. Access your [Netbird dashboard ↗](https://app.netbird.io/)
2. Click **Setup Keys**
3. Create a new setup key or use an existing one

```typescript
import { Daytona } from '@daytona/sdk';
import { Image } from '@daytona/sdk/v2';

// Configuration
const DAYTONA_API_KEY = "YOUR_API_KEY";
const NETBIRD_SETUP_KEY = "YOUR_SETUP_KEY";

// Initialize the Daytona client
const daytona = new Daytona({
  apiKey: DAYTONA_API_KEY,
});

async function setupNetbird(): Promise<void> {
  /**
   * Connect a Daytona sandbox to a NetBird network using the TypeScript SDK.
   * Uses the official NetBird install script and a Setup Key for non-interactive auth.
   * See: https://docs.netbird.io/manage/peers/access-infrastructure/setup-keys-add-servers-to-network
   */

  // Create the sandbox
  console.log("Creating sandbox...");
  const sandbox = await daytona.v2.create('ubuntu-24.04');
  console.log(`Sandbox created: ${sandbox.id}`);

  // Install NetBird via the official install script
  console.log("\nInstalling NetBird via the official install script...");
  const installCmd = [
    "sudo rm -f /etc/apt/sources.list.d/yarn.list",
    "curl -fsSL https://pkgs.netbird.io/install.sh | sudo sh",
  ].join(" && ");
  let response = await sandbox.process.run(installCmd, { timeoutSeconds: 300 });
  if (response.exitCode !== 0) {
    console.log(`Error installing NetBird: ${response.output}`);
    return;
  }
  console.log("NetBird installed successfully.");

  // Connect to the NetBird network using the setup key
  console.log("\nConnecting to NetBird network with setup key...");
  const upCmd = `sudo netbird up --setup-key ${NETBIRD_SETUP_KEY}`;
  response = await sandbox.process.run(upCmd, { timeoutSeconds: 120 });
  if (response.exitCode !== 0) {
    console.log(`Error running 'netbird up': ${response.output}`);
    return;
  }
  console.log(response.output);

  // Final status check
  console.log("\nFinal NetBird status:");
  response = await sandbox.process.run("netbird status", { timeoutSeconds: 30 });
  console.log(response.output);
}

// Run the main function
setupNetbird().catch(console.error);
```

| **Parameter** | **Description** |
| --- | --- |
| `image` | Sets the registered image that the sandbox starts from.<br />**Format:** an image name or ID<br />**Example:** `'ubuntu-24.04'` |
| `timeoutSeconds` | Sets how many seconds run() waits for the command, without stopping the command.<br />**Default:** no limit<br />**Value:** `0` for no limit<br />**Example:** `300` |

> **Notes:**
>
> - **Permissions:** The requests require the `write:sandboxes` permission.
> - **Clients:** run() returns when the shell exits, so a command that ends with & and redirects its output leaves its daemon running in the background after run() returns.

### Netbird browser login

A Netbird browser login is an interactive authentication flow in which Netbird generates a unique login URL, and a person visits it in a web browser to authenticate the device. The person signs in through the identity provider of the network, so the password never reaches the device.

A browser login of a sandbox runs inside the sandbox and waits until a person completes it.

Use browser login when a person can authenticate the sandbox in a browser. The snippets below install Netbird, start the login, and poll the status until the sandbox is connected.

```typescript
import { Daytona } from '@daytona/sdk';
import { Image } from '@daytona/sdk/v2';

// Configuration
const DAYTONA_API_KEY = "YOUR_API_KEY";

// Initialize the Daytona client
const daytona = new Daytona({
  apiKey: DAYTONA_API_KEY,
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function setupNetbirdVpnInteractive(): Promise<void> {
  /**
   * Connect a Daytona sandbox to a NetBird network using the TypeScript SDK.
   * Uses the official NetBird install script and interactive browser login.
   */

  // Create the sandbox
  console.log("Creating sandbox...");
  const sandbox = await daytona.v2.create('ubuntu-24.04');
  console.log(`Sandbox created: ${sandbox.id}`);

  // Remove the broken Yarn list so apt-get update inside the installer succeeds,
  // then run the official NetBird install script. The script adds the NetBird
  // APT repo, imports the signing key, and installs the package.
  console.log("\nInstalling NetBird via the official install script...");
  const installCmd = [
    "sudo rm -f /etc/apt/sources.list.d/yarn.list",
    "curl -fsSL https://pkgs.netbird.io/install.sh | sudo sh",
  ].join(" && ");
  let response = await sandbox.process.run(installCmd, { timeoutSeconds: 300 });
  if (response.exitCode !== 0) {
    console.log(`Error installing NetBird: ${response.output}`);
    return;
  }
  console.log("NetBird installed successfully.");

  // Run netbird up in background and capture output to a file
  console.log("\nInitiating NetBird login...");
  await sandbox.process.run("sudo netbird up > /tmp/netbird-login.txt 2>&1 &", { timeoutSeconds: 10 });

  // Wait for the login URL to be written to the file
  await sleep(5000);

  // Read the login URL from the output file
  response = await sandbox.process.run("cat /tmp/netbird-login.txt", { timeoutSeconds: 10 });
  const output = response.output || "";
  const urlMatch = output.match(/https?:\/\/[^\s]+/);

  if (urlMatch) {
    const loginUrl = urlMatch[0];
    console.log("\n" + "=".repeat(60));
    console.log("To authenticate, visit this URL in your browser:");
    console.log(`\n  ${loginUrl}`);
    console.log("\n" + "=".repeat(60));
    console.log("\nWaiting for authentication...");

    // Poll for connection status
    const maxWait = 300; // 5 minutes max wait
    const pollInterval = 5;
    let waited = 0;

    while (waited < maxWait) {
      await sleep(pollInterval * 1000);
      waited += pollInterval;

      const statusResponse = await sandbox.process.run("netbird status 2>&1", { timeoutSeconds: 30 });
      const statusOutput = statusResponse.output || "";

      // Check if we're connected
      if (statusResponse.exitCode === 0 && statusOutput.toLowerCase().includes("connected")) {
        console.log("\nConnected to NetBird network!");
        console.log(`NetBird status:\n${statusOutput}`);
        break;
      }

      console.log(`  Still waiting... (${waited}s)`);
    }

    if (waited >= maxWait) {
      console.log("\nTimeout waiting for authentication. Please try again.");
      return;
    }
  } else {
    // Maybe already connected or different output
    console.log(`Output from netbird up:\n${output}`);

    // Check if already connected
    const statusResponse = await sandbox.process.run("netbird status", { timeoutSeconds: 30 });
    if (statusResponse.exitCode === 0) {
      console.log("\nNetBird status:");
      console.log(statusResponse.output);
    }
  }

  // Final status check
  console.log("\nFinal NetBird status:");
  response = await sandbox.process.run("netbird status", { timeoutSeconds: 30 });
  console.log(response.output);
}

// Run the main function
setupNetbirdVpnInteractive().catch(console.error);
```

| **Parameter** | **Description** |
| --- | --- |
| `image` | Sets the registered image that the sandbox starts from.<br />**Format:** an image name or ID<br />**Example:** `'ubuntu-24.04'` |
| `timeoutSeconds` | Sets how many seconds run() waits for the command, without stopping the command.<br />**Default:** no limit<br />**Value:** `0` for no limit<br />**Example:** `300` |

> **Notes:**
>
> - **Permissions:** The requests require the `write:sandboxes` permission.
> - **Clients:** run() returns when the shell exits, so a command that ends with & and redirects its output leaves its daemon running in the background after run() returns.
