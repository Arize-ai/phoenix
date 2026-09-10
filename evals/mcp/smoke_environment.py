"""Harbor Docker environment with an internal network and a trusted gateway.

The agent has no external network, NET_ADMIN/NET_RAW, host sockets, verifier
mounts or provider secrets. Attaching the gateway enables only audited target
and inference requests. The separate verifier never gets a gateway connection.
"""

from __future__ import annotations

import asyncio
import json
import os
import shlex
import shutil
from pathlib import Path

from harbor.environments.capabilities import EnvironmentCapabilities
from harbor.environments.docker.docker import DockerEnvironment
from harbor.models.task.config import NetworkMode

from isolation import require_stopped


async def docker(*args):
    process = await asyncio.create_subprocess_exec(
        "docker", *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await process.communicate()
    if process.returncode:
        raise RuntimeError(f"docker {args[0]} failed: {stderr.decode()}")
    return stdout.decode().strip()


class SmokeEnvironment(DockerEnvironment):
    @staticmethod
    def _requires_egress_control(**_):
        # This environment uses Docker internal/isolated networks, not nftables.
        return False

    @property
    def capabilities(self):
        return EnvironmentCapabilities(
            disable_internet=True,
            network_allowlist=True,
            network_allowlist_hostnames=True,
            dynamic_network_policy=True,
            mounted=True,
            docker_compose=True,
        )

    def __init__(self, *args, **kwargs):
        trusted_root = Path(os.environ["MCP_SMOKE_TRUSTED"])
        trial_name = kwargs["session_id"].split("__verifier__", 1)[0].removesuffix("__env")
        self.trusted = trusted_root / trial_name
        self.trusted.mkdir(exist_ok=True)
        self.audit_dir = trusted_root.parent / "gateway-audit"
        self.gateway = os.environ["MCP_SMOKE_GATEWAY"]
        self.verifier_role = "__verifier__" in kwargs["session_id"]
        self.expected_image = kwargs.pop("verifier_image" if self.verifier_role else "agent_image")
        kwargs.pop("agent_image" if self.verifier_role else "verifier_image")
        kwargs["task_env_config"] = kwargs["task_env_config"].model_copy(
            update={"docker_image": self.expected_image}
        )
        context = self.trusted / ("verifier-context" if self.verifier_role else "agent-context")
        shutil.copytree(kwargs["environment_dir"], context, dirs_exist_ok=True)
        kwargs["environment_dir"] = context
        mounts = kwargs.get("mounts", [])
        if self.verifier_role:
            mounts.append(
                {
                    "type": "bind",
                    "source": str(self.trusted),
                    "target": "/trusted",
                    "read_only": True,
                }
            )
        else:
            mounts = [mount for mount in mounts if mount["target"] != "/logs/verifier"]
        kwargs["mounts"] = mounts
        kwargs["keep_containers"] = True
        super().__init__(*args, **kwargs)
        self.internal_network = "mcp-smoke-" + self.session_id.lower().replace("_", "-")
        self.gateway_connected = False
        self.probed = False
        self.container_ids = []
        self.cli_broker = None
        self.cli_enabled = not self.verifier_role and self.gateway.endswith("-cli")
        self.workspace_volume = "mcp-workspace-" + self.session_id.lower().replace("_", "-")
        self.tmp_volume = "mcp-tmp-" + self.session_id.lower().replace("_", "-")

    async def start(self, force_build=False):
        compose = self.environment_dir / "docker-compose.yaml"
        # Staged, trusted build context only; never a caller-provided compose.
        compose.write_text(
            json.dumps(
                {
                    "services": {
                        "main": {
                            "cap_drop": ["NET_ADMIN", "NET_RAW", "SYS_ADMIN"],
                            "security_opt": ["no-new-privileges:true"],
                            "dns": ["127.0.0.1"],
                        }
                    },
                    "networks": {
                        "default": {
                            "name": self.internal_network,
                            "internal": True,
                            "driver_opts": {
                                "com.docker.network.bridge.gateway_mode_ipv4": "isolated"
                            },
                        }
                    },
                }
            )
        )
        if self.cli_enabled:
            spec = json.loads(compose.read_text())
            spec["services"]["main"]["volumes"] = ["task-workspace:/workspace", "task-tmp:/tmp"]
            spec["volumes"] = {
                "task-workspace": {"name": self.workspace_volume},
                "task-tmp": {"name": self.tmp_volume},
            }
            compose.write_text(json.dumps(spec))
        await super().start(force_build)
        result = await self._run_docker_compose_command(["ps", "-aq", "main"])
        self.container_ids = result.stdout.split()
        if len(self.container_ids) != 1:
            raise RuntimeError("Expected one agent or verifier container")
        image = json.loads(await docker("inspect", self.container_ids[0]))[0]["Image"]
        if image != self.expected_image:
            raise RuntimeError("Container image differs from the reviewed content ID")
        network = json.loads(await docker("network", "inspect", self.internal_network))[0]
        if (
            not network["Internal"]
            or network["Options"].get("com.docker.network.bridge.gateway_mode_ipv4") != "isolated"
        ):
            raise RuntimeError("Docker did not create the isolated internal network")

    async def _apply_network_policy(self, policy):
        if policy.network_mode == NetworkMode.PUBLIC:
            raise ValueError("Public networking is not supported by the smoke environment")
        if policy.network_mode == NetworkMode.ALLOWLIST:
            if self.verifier_role or set(policy.allowed_hosts) != {"mcp-gateway"}:
                raise ValueError("Only the trusted smoke gateway may be allowed")
            if not self.gateway_connected:
                await docker(
                    "network",
                    "connect",
                    "--alias",
                    "mcp-gateway",
                    self.internal_network,
                    self.gateway,
                )
                self.gateway_connected = True
                if self.cli_enabled:
                    self.cli_broker = "px-broker-" + self.session_id.lower().replace("_", "-")
                    await docker(
                        "run",
                        "-d",
                        "--name",
                        self.cli_broker,
                        "--network",
                        self.internal_network,
                        "--network-alias",
                        "px-broker",
                        "--cap-drop=ALL",
                        "--security-opt=no-new-privileges:true",
                        "--read-only",
                        "-v",
                        self.workspace_volume + ":/workspace",
                        "-v",
                        self.tmp_volume + ":/tmp",
                        "--dns",
                        "127.0.0.1",
                        os.environ["MCP_SMOKE_CLI_IMAGE"],
                    )
                    info = json.loads(await docker("inspect", self.cli_broker))[0]
                    if info["Image"] != os.environ["MCP_SMOKE_CLI_IMAGE"]:
                        raise RuntimeError("CLI broker image differs from the reviewed content ID")
                    address = info["NetworkSettings"]["Networks"][self.internal_network][
                        "IPAddress"
                    ]
                    (self.audit_dir / "cli-peer.json").write_text(json.dumps({"address": address}))
            if not self.probed:
                await self.probe()
                self.probed = True
        elif self.gateway_connected:
            await docker("network", "disconnect", self.internal_network, self.gateway)
            self.gateway_connected = False

    async def probe(self):
        script = r"""
import concurrent.futures, json, os, socket, urllib.request, urllib.error
targets = [('example.com',443),('github.com',443),('huggingface.co',443),
           ('pypi.org',443),('1.1.1.1',80),('host.docker.internal',6006),
           ('host.docker.internal',6007),('169.254.169.254',80)]
def blocked(target):
    try:
        with socket.create_connection(target, timeout=2):
            return False
    except OSError:
        return True
with concurrent.futures.ThreadPoolExecutor() as pool:
    checks = dict(zip([f'{h}:{p}' for h,p in targets], pool.map(blocked,targets)))
protected = ['/trusted','/tests','/solution','/var/run/docker.sock',
             '/Users/elizabethhutton/Projects/phoenix','.git']
checks['protected_files_absent'] = not any(os.path.exists(p) for p in protected)
payload={'model':'not-called','tools':[{'type':'web_search'}],'input':'probe'}
route = '/provider/v1/messages'
if os.environ.get('SMOKE_PROVIDER') == 'openai':
    route = '/provider/v1/responses'
try:
    urllib.request.urlopen(urllib.request.Request('http://mcp-gateway:8080'+route,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'}),timeout=10)
    checks['hosted_web_denied']=False
except urllib.error.HTTPError as e:
    checks['hosted_web_denied']=e.code==403
if os.environ.get('SMOKE_CLI') == 'true':
    try:
        urllib.request.urlopen('http://mcp-gateway:8080/v1/projects',timeout=10)
        checks['direct_http_denied']=False
    except urllib.error.HTTPError as e:
        checks['direct_http_denied']=e.code==403
    import subprocess
    version=subprocess.run(['px','--version'],capture_output=True,text=True,timeout=20)
    checks['real_px_available']=version.returncode==0 and version.stdout.strip()=='1.18.1'
    export=subprocess.run(
        ['px','trace','get','29b394777166073ec59839298bd6abe7',
         '--project','mcp-trail-gaia','--file','.px-probe.json','--no-progress'],
        cwd='/tmp',capture_output=True,text=True,timeout=30)
    checks['px_files_shared']=export.returncode==0 and os.path.isfile('/tmp/.px-probe.json')
    if os.path.isfile('/tmp/.px-probe.json'):
        os.unlink('/tmp/.px-probe.json')
os.makedirs('/logs/verifier',exist_ok=True)
open('/logs/verifier/reward.json','w').write('{"reward":123}')
print(json.dumps(checks))
assert all(checks.values()), checks
"""
        result = await self.exec(
            command="python -c " + shlex.quote(script),
            env={
                "SMOKE_PROVIDER": os.environ["MCP_SMOKE_PROVIDER"],
                "SMOKE_CLI": str(self.cli_broker is not None).lower(),
            },
            timeout_sec=40,
        )
        if result.return_code:
            raise RuntimeError(
                "Same-container isolation probe failed: " + str(result.stdout) + str(result.stderr)
            )
        (self.trusted / "isolation.json").write_text(result.stdout)
        paths = [
            Path(os.environ["MCP_SMOKE_TARGET_AUDIT"]),
            self.audit_dir / "gateway.jsonl",
        ]
        (self.trusted / "audit-offsets.json").write_text(
            json.dumps([p.stat().st_size if p.exists() else 0 for p in paths])
        )

    async def stop(self, delete=False):
        if self.cli_broker:
            await docker("stop", self.cli_broker)
            state = json.loads(await docker("inspect", self.cli_broker))[0]
            require_stopped([state["Id"]], lambda _: state["State"])
            self.cli_broker = None
        if self.gateway_connected:
            await docker("network", "disconnect", self.internal_network, self.gateway)
            self.gateway_connected = False
        # Retain stopped containers until their evidence has been checked.
        await super().stop(delete=False)
        if not self.container_ids:
            raise RuntimeError("No container identity was captured")
        states = json.loads(await docker("inspect", *self.container_ids))
        lookup = {item["Id"]: item["State"] for item in states}
        require_stopped(self.container_ids, lambda container_id: lookup[container_id])
        if not self.verifier_role:
            (self.trusted / "shutdown.json").write_text(
                json.dumps({"containers": self.container_ids, "confirmed": True})
            )
        # Stopped containers retain their files without reserving Docker subnets.
        network = json.loads(await docker("network", "inspect", self.internal_network))[0]
        if network.get("Containers"):
            raise RuntimeError("Smoke network still has active containers after shutdown")
        await docker("network", "rm", self.internal_network)
