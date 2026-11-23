# /// script
# requires-python = ">=3.12"
# dependencies = ["PyYAML>=6,<7"]
# ///
import unittest
from pathlib import Path
from typing import Any

import yaml

WORKFLOW_PATH = Path(__file__).resolve().parents[2] / ".github/workflows/factory-preview.yml"


class TestPreviewPublishing(unittest.TestCase):
    def setUp(self) -> None:
        self.jobs: dict[str, Any] = yaml.safe_load(WORKFLOW_PATH.read_text())["jobs"]

    def collect_dependencies(self, job_name: str) -> set[str]:
        dependencies = self.jobs[job_name].get("needs", [])
        if isinstance(dependencies, str):
            dependencies = [dependencies]
        return set(dependencies).union(
            *(self.collect_dependencies(dependency) for dependency in dependencies)
        )

    def test_each_registry_publishes_the_single_build_independently(self) -> None:
        build_steps = [
            (job_name, step)
            for job_name, job in self.jobs.items()
            for step in job["steps"]
            if step.get("uses", "").endswith("/docker-build-image")
        ]
        self.assertEqual(len(build_steps), 1)
        build_job, build_step = build_steps[0]
        self.assertEqual(build_step["with"]["platform"], "linux/amd64")
        publishers = {
            job_name: step
            for job_name, job in self.jobs.items()
            for step in job["steps"]
            if step.get("uses", "").endswith("/docker-publish-image")
        }
        self.assertEqual(len(publishers), 2)
        repositories: set[str] = set()
        tag_sets: list[set[str]] = []
        for job_name, step in publishers.items():
            dependencies = self.collect_dependencies(job_name)
            self.assertIn(build_job, dependencies)
            self.assertFalse((publishers.keys() - {job_name}) & dependencies)
            self.assertEqual(step["with"]["variant"], build_step["with"]["variants"])
            self.assertEqual(step["with"]["expected-digests"], 1)
            tags = step["with"]["tags"].splitlines()
            repositories.update(tag.split(":", 1)[0] for tag in tags)
            tag_sets.append({tag.split(":", 1)[1] for tag in tags})
        self.assertEqual(repositories, {"arizephoenix/phoenix", "ghcr.io/arize-ai/phoenix"})
        self.assertEqual(tag_sets[0], tag_sets[1])
        self.assertEqual(len(tag_sets[0]), 2)

    def test_railway_requires_dockerhub_but_not_ghcr(self) -> None:
        dependencies = self.collect_dependencies("deploy")
        self.assertIn("publish-dockerhub", dependencies)
        self.assertNotIn("publish-ghcr", dependencies)
        deployment = self.jobs["deploy"]["steps"][-1]
        self.assertTrue(deployment["env"]["IMAGE"].startswith("arizephoenix/phoenix:pr-"))
        self.assertIn("needs.build.outputs.short-sha", deployment["env"]["IMAGE"])

    def test_only_ghcr_publishing_gets_package_write_access(self) -> None:
        writers = {
            job_name
            for job_name, job in self.jobs.items()
            if job.get("permissions", {}).get("packages") == "write"
        }
        self.assertEqual(writers, {"publish-ghcr"})


if __name__ == "__main__":
    unittest.main()
