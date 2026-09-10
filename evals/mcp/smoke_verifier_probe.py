"""Exercise the verifier against an existing stopped trial without rerunning an agent."""

import argparse
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sample", type=Path)
    args = parser.parse_args()
    condition = args.sample.resolve()
    artifacts = list(condition.glob("jobs/*/trace-count*/artifacts"))
    if len(artifacts) != 1:
        raise ValueError("Expected one existing trial")
    output = condition / "verifier-probe"
    output.mkdir(exist_ok=False)
    images = json.loads((HERE / ".runtime/smoke-images/images.json").read_text())
    subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "--network=none",
            "--read-only",
            "--cap-drop=ALL",
            "-v",
            f"{condition / 'trusted'}:/trusted:ro",
            "-v",
            f"{artifacts[0]}:/workspace:ro",
            "-v",
            f"{output}:/logs/verifier",
            images["verifier"]["id"],
            "python",
            "/tests/smoke_verify.py",
        ],
        check=True,
    )
    scores = json.loads((output / "reward.json").read_text())
    if not scores or any(value not in (0, 1) for value in scores.values()):
        raise RuntimeError("Verifier did not produce valid scores")
    print(json.dumps(scores))


if __name__ == "__main__":
    main()
