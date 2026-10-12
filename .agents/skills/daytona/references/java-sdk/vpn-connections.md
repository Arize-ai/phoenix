## Contents

- Tailscale
- OpenVPN
- Netbird
- See Also




VPN connections are a way to connect your Daytona sandboxes to private networks. By establishing a VPN connection, your sandbox can access network resources using private IP addresses and can be accessed by other devices on the same VPN network.

This integration enables communication between your development environment and existing infrastructure, allowing you to test applications against services within the private network, access shared development resources, and collaborate with team members.

Daytona supports the following VPN network providers:

- [Tailscale](#tailscale)
- [OpenVPN](#openvpn)
- [Netbird](#netbird)
> **Note:**
> For connecting to a VPN network, you need to [create or access your Daytona sandbox](./sandboxes.md), **have access to your VPN network provider credentials**, and be on [**Tier 3** or higher](../platform/limits.md#resources).

## Tailscale

Daytona provides multiple ways to connect to a Daytona sandbox with a Tailscale network:

- [Connect with browser login](#tailscale-browser-login)
- [Connect with auth key](#tailscale-auth-key)
- [Connect with web terminal](#tailscale-web-terminal)

When you connect a Daytona sandbox to a Tailscale network, the sandbox becomes part of your private Tailscale network, allowing you to access resources that are available within the network and enabling other devices on the network to access the sandbox.

This integration makes your sandbox appear as a device within your Tailscale network, with its own Tailscale IP address and access to other devices and services on the network.

### Tailscale browser login

The browser login method initiates an interactive authentication flow where Tailscale generates a unique login URL that you visit in your web browser to authenticate the Dayona sandbox.

The process involves installing Tailscale, starting the daemon, initiating the login process, and then polling for the authentication status until the connection is established.

The following snippet demonstrates connecting to a Tailscale network using a browser login.


Once the connection is established and authentication is complete, the sandbox will maintain its connection as long as the service is running.

### Tailscale auth key

Using an auth key provides a non-interactive way to connect your Daytona sandbox to Tailscale, making it suitable for automated scripts, CI/CD pipelines, or any scenario where manual browser interaction is not available.

1. Access your [Tailscale admin console ↗](https://login.tailscale.com/admin/machines)
2. Click <Button>Add device</Button> and select <Button>Linux server</Button>
3. Apply the configuration and click <Button>Generate install script</Button>

This will generate a script that you can use to install Tailscale and connect to the Tailscale network.

```bash
curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up --auth-key=tskey-auth-<AUTH_KEY>
```

Copy the auth key from the generated script and use it to connect your Daytona sandbox to Tailscale:


Once the connection is established and authentication is complete, the sandbox will maintain its connection as long as the service is running.

### Tailscale web terminal

For working directly in the terminal or for more control over the Tailscale connection process, you can set up Tailscale manually through the Daytona [web terminal](../platform/web-terminal.md) or [SSH](./ssh-access.md).

This approach provides visibility into each step of the installation and connection process, and allows you to customize the setup if needed. The process involves installing Tailscale, starting the daemon in a persistent session using tmux, and then authenticating through the interactive login flow.

1. Navigate to your sandbox [web terminal](../platform/web-terminal.md) in [Daytona Dashboard ↗](https://app.daytona.io/), or [access it via SSH](./ssh-access.md)
2. Install Tailscale using the official installation script:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

This begins the Tailscale installation process and initializes the Tailscale CLI inside the sandbox. Daytona requires the Tailscale daemon to be running in the background to connect the sandbox to the Tailscale network.

The recommended approach is to run it in a detached tmux (or similar) session to ensure the daemon is running in the background:

3. Install tmux

```bash
sudo apt install tmux
```

4. Start the Tailscale daemon in a detached tmux session

```bash
tmux new -d -s tailscale 'sudo tailscaled'
```

5. Connect and authenticate your sandbox with the Tailscale network

```bash
sudo tailscale up
```

6. Visit the authentication URL in the web browser and follow the instructions to authenticate

```txt
To authenticate, visit:
https://login.tailscale.com/a/<id>
```

Once authenticated, you will see the following confirmation message:

```txt
Your device <id> is logged in to the <address> tailnet.
```

You've now successfully connected your Daytona sandbox to your Tailscale network. The sandbox should appear in your [Tailscale dashboard](https://login.tailscale.com/admin/machines).

## OpenVPN

Daytona provides multiple ways to connect to a Daytona sandbox with an OpenVPN network:

- [OpenVPN client configuration](#openvpn-client-configuration)
- [Connect with web terminal](#openvpn-web-terminal)

OpenVPN uses a client-server model where your Daytona sandbox acts as a client connecting to an OpenVPN server. This approach is suitable for connecting to existing corporate VPNs, accessing resources behind firewalls, or integrating with infrastructure that already uses OpenVPN.
> **Note:**
> Connecting a Daytona sandbox to OpenVPN network requires a [client configuration file](#openvpn-client-configuration-file).

### OpenVPN client configuration file

Client configuration file contains the connection parameters, certificates, and keys required to establish a secure connection to your OpenVPN server. This file is typically provided by your network administrator or generated from your OpenVPN server setup.

The configuration file should be named `client.ovpn` or similar, and it must contain all the required connection settings, including server address, port, protocol, encryption settings, and authentication credentials. To create this file, you can use a text editor such as nano or vim, or upload it to your sandbox if you have it prepared elsewhere.

The following snippet is an example of a client configuration file. Replace the placeholders with the actual values provided by your OpenVPN server.

```bash
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

The following snippets demonstrate connecting to an OpenVPN network using a client configuration file.


### OpenVPN web terminal

Daytona provides a [web terminal](../platform/web-terminal.md) for interacting with your sandboxes, allowing you to install OpenVPN and connect to your OpenVPN network.

1. Navigate to your sandbox [web terminal](../platform/web-terminal.md) in [Daytona Dashboard ↗](https://app.daytona.io/) by clicking on the Terminal icon `>_`, or [access it via SSH](./ssh-access.md)

2. Install OpenVPN and tmux

```bash
sudo apt update && sudo apt install -y openvpn tmux
```

3. Create the OpenVPN [client configuration file](#openvpn-client-configuration-file) for your Daytona sandbox

```bash
sudo nano client.ovpn
```

4. Save the file by pressing `Ctrl+O`, then `Enter`, and exit by pressing `Ctrl+X`

Daytona requires the OpenVPN tunnel to be running in the background to connect the sandbox to the OpenVPN network. The recommended approach is to run it in a detached tmux (or similar) session:

5. Start OpenVPN tunnel in a background tmux session

```bash
tmux new -d -s openvpn 'sudo openvpn client.ovpn'
```

This starts the OpenVPN tunnel in a background tmux session that persists even if you disconnect from the sandbox.

6. Verify the OpenVPN connection by running the following command

```bash
curl ifconfig.me
```

This will return the IP address of the sandbox connected to the OpenVPN network.

You've now successfully connected your Daytona sandbox to your OpenVPN network.

## Netbird

Daytona provides multiple ways to connect to a Daytona sandbox with a Netbird network:

- [Connect with setup key](#netbird-setup-key)
- [Connect with browser login](#netbird-browser-login)

When you connect a Daytona sandbox to a Netbird network, the sandbox becomes part of your private Netbird network, allowing you to access resources that are available within the network and enabling other devices on the network to access the sandbox.

This integration makes your sandbox appear as a device within your Netbird network, with its own Netbird IP address and access to other devices and services on the network.

### Netbird setup key

Using a Netbird setup key provides a non-interactive way to connect your Daytona sandbox to Netbird, making it suitable for automated scripts, CI/CD pipelines, or any scenario where manual browser interaction is not available.

1. Access your [Netbird dashboard ↗](https://app.netbird.io/)
2. Click <Button>Setup Keys</Button>
3. Create a new setup key or use an existing one

The following snippets demonstrate connecting to a Netbird network using a setup key.


### Netbird browser login

The browser login method initiates an interactive authentication flow where Netbird generates a unique login URL that you visit in your web browser to authenticate the Daytona sandbox.

The following snippets demonstrate connecting to a Netbird network using a browser login.

## See Also
- [Python SDK - vpn-connections](../python-sdk/vpn-connections.md)
- [TypeScript SDK - vpn-connections](../typescript-sdk/vpn-connections.md)
