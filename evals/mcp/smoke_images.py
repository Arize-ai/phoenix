"""Build credential-free agent images and retain their content IDs for inspection."""

import json
import shutil
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main():
    context = HERE / ".runtime/smoke-images"
    context.mkdir(parents=True, exist_ok=True)
    shutil.copy(HERE / "smoke-images/Dockerfile", context / "Dockerfile")
    shutil.copy(HERE / "smoke_gateway.py", context)
    shutil.copy(HERE / "smoke_cli.py", context)
    for name in ("verify.py", "isolation.py", "smoke_verify.py", "smoke_tasks.py"):
        shutil.copy(HERE / name, context)
    images = {}
    for name in (
        "claude-mcp",
        "claude-cli",
        "codex-mcp",
        "codex-cli",
        "verifier",
        "gateway",
        "cli-broker",
    ):
        tag = "mcp-smoke-" + name + ":20260909"
        subprocess.run(["docker", "build", "--target", name, "-t", tag, str(context)], check=True)
        image = json.loads(subprocess.check_output(["docker", "image", "inspect", tag]))[0]
        images[name] = {"tag": tag, "id": image["Id"]}
    (context / "images.json").write_text(json.dumps(images, indent=2))
    print(json.dumps(images, indent=2))


if __name__ == "__main__":
    main()
