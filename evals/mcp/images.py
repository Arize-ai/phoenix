"""Build tool images and the Phoenix wheel; keep payloads out of build contexts."""

import hashlib
import json
import shutil
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def main():
    context = HERE / ".runtime/images"
    context.mkdir(parents=True, exist_ok=True)
    shutil.copy(HERE / "images/Dockerfile", context / "Dockerfile")
    for name in (
        "gateway",
        "cli",
        "verify",
        "grading",
        "target",
        "seed_target",
        "references",
        "fixture",
    ):
        shutil.copy(HERE / (name + ".py"), context)
    shutil.copytree(HERE / "tasks", context / "tasks", dirs_exist_ok=True)
    shutil.copy(HERE / "configs/pricing.json", context)
    wheels = context / "wheels"
    wheels.mkdir(exist_ok=True)
    subprocess.run(["uv", "build", "--wheel", "--out-dir", str(wheels), str(ROOT)], check=True)
    candidates = list(wheels.glob("arize_phoenix-*.whl"))
    if len(candidates) != 1:
        raise ValueError(
            "Expected one target wheel; use a new build directory for a version change"
        )
    matrix = json.loads((HERE / "configs/matrix.json").read_text())
    digest = hashlib.sha256()
    for path in sorted(context.rglob("*")):
        if (
            path.is_file()
            and path.suffix in {".py", ".toml", ".md", ".whl"}
            or path.name in {"Dockerfile", "pricing.json"}
        ):
            digest.update(str(path.relative_to(context)).encode())
            digest.update(path.read_bytes())
    digest.update(json.dumps(matrix, sort_keys=True).encode())
    build_id = digest.hexdigest()[:20]
    images = {}
    for name in (
        "claude-mcp",
        "claude-cli",
        "codex-mcp",
        "codex-cli",
        "verifier",
        "gateway",
        "cli-broker",
        "target",
    ):
        tag = "phoenix-benchmark-" + name + ":" + build_id
        subprocess.run(
            [
                "docker",
                "build",
                "--target",
                name,
                "-t",
                tag,
                "--build-arg",
                "CLAUDE_VERSION=" + matrix["agent_versions"]["claude-code"],
                "--build-arg",
                "CODEX_VERSION=" + matrix["agent_versions"]["codex"],
                "--build-arg",
                "PX_VERSION=" + matrix["px_version"],
                str(context),
            ],
            check=True,
        )
        image = json.loads(subprocess.check_output(["docker", "image", "inspect", tag]))[0]
        images[name] = {"tag": tag, "id": image["Id"]}
    images["target"]["wheel_sha256"] = hashlib.sha256(candidates[0].read_bytes()).hexdigest()
    images["target"]["source_revision"] = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], text=True
    ).strip()
    (context / ("images-" + build_id + ".json")).write_text(json.dumps(images, indent=2))
    (context / "images.json").write_text(json.dumps(images, indent=2))
    print(json.dumps(images, indent=2))


if __name__ == "__main__":
    main()
