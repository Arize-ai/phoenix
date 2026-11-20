import argparse
import io
import json
import os
import unittest
import urllib.error
import urllib.request
from email.message import Message
from typing import Any
from unittest.mock import patch

import deploy


def json_response(payload: dict[str, Any]) -> io.BytesIO:
    return io.BytesIO(json.dumps(payload).encode())


class TestDockerHubPreviews(unittest.TestCase):
    def setUp(self) -> None:
        self.enterContext(
            patch.object(deploy, "run_gh", side_effect=AssertionError("Unexpected GitHub request"))
        )

    def test_listing_follows_pages_and_excludes_release_tags(self) -> None:
        with patch.object(
            urllib.request,
            "urlopen",
            side_effect=[
                json_response(
                    {
                        "results": [{"name": "pr-42"}, {"name": "latest"}],
                        "next": "https://hub.docker.com/next-page",
                    }
                ),
                json_response(
                    {
                        "results": [
                            {"name": "pr-42-abcdef0"},
                            {"name": "21.3.0"},
                            {"name": "pr-not-a-preview"},
                        ],
                        "next": None,
                    }
                ),
            ],
        ) as open_url:
            tags = deploy.list_image_tags(image="docker.io/arizephoenix/phoenix")
        self.assertEqual(tags, ["pr-42", "pr-42-abcdef0"])
        self.assertIn("page=2", open_url.call_args.args[0])
        self.assertEqual(
            deploy.preview_numbers(services={"pr-43": "service", "postgres": "db"}, tags=tags),
            {42, 43},
        )

    def test_visibility_uses_anonymous_dockerhub_metadata(self) -> None:
        for is_private, expected in [(False, "public"), (True, "private")]:
            with self.subTest(is_private=is_private):
                with patch.object(
                    urllib.request,
                    "urlopen",
                    return_value=json_response({"is_private": is_private}),
                ) as open_url:
                    self.assertEqual(
                        deploy.image_visibility(image="arizephoenix/phoenix:pr-42"), expected
                    )
                self.assertEqual(
                    open_url.call_args.args[0],
                    "https://hub.docker.com/v2/namespaces/arizephoenix/repositories/phoenix",
                )

    def test_non_preview_tags_cannot_be_deleted(self) -> None:
        for tag in ["latest", "nightly", "21.3.0", "commit-abcdef0", "pr-42/../latest"]:
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                deploy.delete_image_tag(image="arizephoenix/phoenix", tag=tag, token="hub-token")

    def test_dockerhub_authentication_uses_existing_workflow_credentials(self) -> None:
        with (
            patch.dict(
                os.environ, DOCKERHUB_USERNAME="publisher", DOCKERHUB_PASSWORD="test-secret"
            ),
            patch.object(
                urllib.request,
                "urlopen",
                return_value=json_response({"access_token": "hub-token"}),
            ) as open_url,
        ):
            self.assertEqual(deploy.get_dockerhub_token(), "hub-token")
        request = open_url.call_args.args[0]
        self.assertEqual(request.full_url, "https://hub.docker.com/v2/auth/token")
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(
            json.loads(request.data), {"identifier": "publisher", "secret": "test-secret"}
        )


class TestPreviewSweep(unittest.TestCase):
    def setUp(self) -> None:
        self.requests: list[urllib.request.Request] = []
        self.deleted_services: list[str] = []
        self.deleted_tags: list[str] = []
        self.comments: list[str] = []
        self.failed_request: str | None = None
        self.tags = ["pr-42", "pr-42-abcdef0", "pr-43", "latest", "21.3.0"]
        self.enterContext(
            patch.dict(
                os.environ,
                RAILWAY_TOKEN="railway-token",
                DOCKERHUB_USERNAME="publisher",
                DOCKERHUB_PASSWORD="test-secret",
            )
        )
        self.enterContext(patch.object(urllib.request, "urlopen", self.open_url))
        self.enterContext(patch.object(deploy, "run_gh", self.run_gh))

    def open_url(self, request: str | urllib.request.Request, *, timeout: int) -> io.BytesIO:
        if isinstance(request, str):
            request = urllib.request.Request(request)
        self.requests.append(request)
        if self.failed_request == request.full_url:
            raise urllib.error.HTTPError(request.full_url, 503, "Unavailable", Message(), None)
        if request.full_url == deploy.RAILWAY_API_URL:
            assert isinstance(request.data, bytes)
            payload = json.loads(request.data)
            query = payload["query"]
            if "projectToken" in query:
                return json_response(
                    {"data": {"projectToken": {"projectId": "project", "environmentId": "env"}}}
                )
            if "services" in query:
                return json_response(
                    {
                        "data": {
                            "project": {
                                "services": {
                                    "edges": [
                                        {"node": {"id": "closed-service", "name": "pr-42"}},
                                        {"node": {"id": "open-service", "name": "pr-43"}},
                                    ]
                                }
                            }
                        }
                    }
                )
            if "serviceDelete" in query:
                self.deleted_services.append(payload["variables"]["id"])
                return json_response({"data": {"serviceDelete": True}})
        if request.full_url == f"{deploy.DOCKERHUB_API_URL}/auth/token":
            assert isinstance(request.data, bytes)
            self.assertEqual(
                json.loads(request.data),
                {"identifier": "publisher", "secret": "test-secret"},
            )
            return json_response({"access_token": "hub-token"})
        tags_url = f"{deploy.DOCKERHUB_API_URL}/namespaces/arizephoenix/repositories/phoenix/tags"
        if request.full_url == f"{tags_url}?page_size=100&name=pr-&page=1":
            return json_response({"results": [{"name": tag} for tag in self.tags], "next": None})
        if request.full_url.startswith(f"{tags_url}/") and request.get_method() == "DELETE":
            self.assertEqual(request.get_header("Authorization"), "Bearer hub-token")
            self.deleted_tags.append(request.full_url.rsplit("/", 1)[1])
            return io.BytesIO()
        raise AssertionError(f"Unexpected request: {request.get_method()} {request.full_url}")

    def run_gh(self, *args: str, input_text: str | None = None) -> str:
        if args[:2] == ("pr", "view"):
            return json.dumps(
                {
                    "state": "CLOSED" if args[2] == "42" else "OPEN",
                    "labels": [{"name": "factory-preview"}],
                }
            )
        if args[:2] == ("api", "--paginate"):
            return "123"
        if args[:3] == ("api", "--method", "PATCH") and input_text is not None:
            self.comments.append(json.loads(input_text)["body"])
            return ""
        raise AssertionError(f"Unexpected GitHub request: {args}")

    def test_sweep_deletes_only_closed_pr_tags(self) -> None:
        self.assertEqual(deploy.run_sweep(argparse.Namespace(image="arizephoenix/phoenix")), 0)
        self.assertEqual(self.deleted_services, ["closed-service"])
        self.assertEqual(self.deleted_tags, ["pr-42", "pr-42-abcdef0"])
        self.assertEqual(len(self.comments), 1)

    def test_registry_listing_failure_still_deletes_closed_services(self) -> None:
        self.failed_request = (
            f"{deploy.DOCKERHUB_API_URL}/namespaces/arizephoenix/repositories/phoenix/tags"
            "?page_size=100&name=pr-&page=1"
        )
        self.assertEqual(deploy.run_sweep(argparse.Namespace(image="arizephoenix/phoenix")), 1)
        self.assertEqual(self.deleted_services, ["closed-service"])
        self.assertEqual(self.deleted_tags, [])

    def test_registry_auth_failure_still_deletes_closed_services(self) -> None:
        self.failed_request = f"{deploy.DOCKERHUB_API_URL}/auth/token"
        self.assertEqual(deploy.run_sweep(argparse.Namespace(image="arizephoenix/phoenix")), 1)
        self.assertEqual(self.deleted_services, ["closed-service"])
        self.assertEqual(self.deleted_tags, [])

    def test_failed_service_deletion_preserves_tags_for_retry(self) -> None:
        self.failed_request = deploy.RAILWAY_API_URL
        with self.assertRaises(deploy.RailwayError):
            deploy.sweep_preview(
                pr_number=42,
                image="arizephoenix/phoenix",
                services={"pr-42": "closed-service"},
                tags=self.tags,
                token="hub-token",
            )
        self.assertEqual(self.deleted_tags, [])

    def test_registry_visibility_failure_updates_the_preview_comment(self) -> None:
        self.failed_request = (
            f"{deploy.DOCKERHUB_API_URL}/namespaces/arizephoenix/repositories/phoenix"
        )
        self.assertEqual(
            deploy.run_deploy(
                argparse.Namespace(
                    image="arizephoenix/phoenix:pr-42-abcdef0",
                    pr=42,
                    head_sha="abcdef0",
                    run_url="https://github.com/Arize-ai/phoenix/actions/runs/123",
                )
            ),
            1,
        )
        self.assertEqual(len(self.requests), 1)
        self.assertEqual(len(self.comments), 1)
        self.assertIn("Docker Hub could not be reached", self.comments[0])
        self.assertIn("actions/runs/123", self.comments[0])


if __name__ == "__main__":
    unittest.main()
