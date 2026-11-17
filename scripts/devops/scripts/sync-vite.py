#!/usr/bin/env python3
"""Continuously sync host js/app source changes into the vite-dev Kubernetes pod.

Apple `container cluster` does not expose host bind mounts into cluster node VMs.
When `--profile vite` is active, `./dev.sh` launches this daemon in the background
to poll `js/app/` for modified/deleted files and stream tar updates into the
running `vite-dev` pod via `kubectl exec`, preserving container-built
`node_modules/` and `.vite-config/` for instant HMR.
"""

import argparse
import io
import os
import subprocess
import sys
import tarfile
import time
from pathlib import Path

IGNORED_DIRS = {
    "node_modules",
    ".vite-config",
    ".git",
    "dist",
    "test-results",
    "playwright-report",
    ".vitest",
}


def scan_files(root: Path) -> dict[str, tuple[int, int]]:
    state: dict[str, tuple[int, int]] = {}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRS]
        rel_dir = os.path.relpath(dirpath, root)
        for fname in filenames:
            if fname.endswith((".swp", ".swo", "~")) or fname == ".DS_Store":
                continue
            full = os.path.join(dirpath, fname)
            rel = fname if rel_dir == "." else os.path.join(rel_dir, fname)
            try:
                st = os.stat(full)
            except OSError:
                continue
            state[rel] = (st.st_mtime_ns, st.st_size)
    return state


def get_vite_pod(kubeconfig: str, context: str, namespace: str) -> str | None:
    res = subprocess.run(
        [
            "kubectl",
            "--kubeconfig",
            kubeconfig,
            "--context",
            context,
            "-n",
            namespace,
            "get",
            "pods",
            "-l",
            "app=vite-dev",
            "--field-selector=status.phase=Running",
            "-o",
            "jsonpath={.items[0].metadata.name}",
        ],
        capture_output=True,
        text=True,
    )
    pod = res.stdout.strip()
    return pod if res.returncode == 0 and pod else None


def push_changes(
    kubeconfig: str,
    context: str,
    namespace: str,
    pod: str,
    root: Path,
    changed: list[str],
    deleted: list[str],
) -> bool:
    if changed:
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w") as tf:
            for rel in changed:
                full = root / rel
                if full.exists():
                    tf.add(str(full), arcname=rel)
        proc = subprocess.run(
            [
                "kubectl",
                "--kubeconfig",
                kubeconfig,
                "--context",
                context,
                "-n",
                namespace,
                "exec",
                "-i",
                pod,
                "--",
                "tar",
                "-xf",
                "-",
                "-C",
                "/phoenix/js/app",
            ],
            input=buf.getvalue(),
            capture_output=True,
        )
        if proc.returncode != 0:
            sys.stderr.write(
                f"[vite-sync] tar sync failed: {proc.stderr.decode('utf-8', 'replace')}\n"
            )
            return False

    if deleted:
        proc = subprocess.run(
            [
                "kubectl",
                "--kubeconfig",
                kubeconfig,
                "--context",
                context,
                "-n",
                namespace,
                "exec",
                pod,
                "--",
                "rm",
                "-f",
                "--",
                *[f"/phoenix/js/app/{rel}" for rel in deleted],
            ],
            capture_output=True,
        )
        if proc.returncode != 0:
            sys.stderr.write(
                f"[vite-sync] delete sync failed: {proc.stderr.decode('utf-8', 'replace')}\n"
            )
            return False

    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kubeconfig", required=True)
    parser.add_argument("--context", required=True)
    parser.add_argument("--namespace", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--interval", type=float, default=0.75)
    args = parser.parse_args()

    root = Path(args.source).resolve()
    last_pod: str | None = None
    snapshot: dict[str, tuple[int, int]] = {}

    while True:
        pod = get_vite_pod(args.kubeconfig, args.context, args.namespace)
        if not pod:
            last_pod = None
            time.sleep(2.0)
            continue

        current = scan_files(root)
        if pod != last_pod:
            # New or restarted pod: push any files modified since initial image build,
            # then establish baseline snapshot for this pod instance.
            changed = [rel for rel, meta in current.items() if snapshot.get(rel) != meta]
            if snapshot and changed:
                if push_changes(
                    args.kubeconfig, args.context, args.namespace, pod, root, changed, []
                ):
                    print(
                        f"[vite-sync] synced {len(changed)} file(s) to new pod {pod}",
                        flush=True,
                    )
            snapshot = current
            last_pod = pod
            time.sleep(args.interval)
            continue

        changed = [rel for rel, meta in current.items() if snapshot.get(rel) != meta]
        deleted = [rel for rel in snapshot if rel not in current]
        if changed or deleted:
            if push_changes(
                args.kubeconfig, args.context, args.namespace, pod, root, changed, deleted
            ):
                print(
                    f"[vite-sync] updated {len(changed)} file(s), "
                    f"removed {len(deleted)} file(s) in {pod}",
                    flush=True,
                )
                snapshot = current

        time.sleep(args.interval)


if __name__ == "__main__":
    main()
