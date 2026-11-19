import argparse
import io
import json
import unittest
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
            deploy.urllib.request,
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
                    deploy.urllib.request,
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

    def test_sweep_deletes_only_closed_pr_tags(self) -> None:
        tags = ["pr-42", "pr-42-abcdef0", "pr-43", "latest", "21.3.0"]
        with (
            patch.object(deploy, "read_token_scope", return_value=("project", "environment")),
            patch.object(deploy, "list_services", return_value={"pr-42": "closed-service"}),
            patch.object(deploy, "list_image_tags", return_value=tags),
            patch.object(deploy, "get_dockerhub_token", return_value="hub-token"),
            patch.object(deploy, "preview_wanted", side_effect=lambda number: number == 43),
            patch.object(deploy, "delete_service") as delete_service,
            patch.object(deploy, "upsert_comment"),
            patch.object(
                deploy.urllib.request, "urlopen", side_effect=lambda *args, **kwargs: io.BytesIO()
            ) as open_url,
        ):
            status = deploy.run_sweep(argparse.Namespace(image="arizephoenix/phoenix"))
        self.assertEqual(status, 0)
        delete_service.assert_called_once_with("closed-service")
        self.assertEqual(
            [call.args[0].full_url for call in open_url.call_args_list],
            [
                "https://hub.docker.com/v2/namespaces/arizephoenix/repositories/phoenix/tags/pr-42",
                "https://hub.docker.com/v2/namespaces/arizephoenix/repositories/phoenix/tags/pr-42-abcdef0",
            ],
        )
        for call in open_url.call_args_list:
            self.assertEqual(call.args[0].get_method(), "DELETE")
            self.assertEqual(call.args[0].get_header("Authorization"), "Bearer hub-token")

    def test_failed_service_deletion_preserves_tags_for_retry(self) -> None:
        with (
            patch.object(deploy, "delete_service", side_effect=deploy.RailwayError("unavailable")),
            patch.object(deploy, "delete_image_tag") as delete_tag,
        ):
            with self.assertRaises(deploy.RailwayError):
                deploy.sweep_preview(
                    pr_number=42,
                    image="arizephoenix/phoenix",
                    services={"pr-42": "service"},
                    tags=["pr-42"],
                    token="hub-token",
                )
        delete_tag.assert_not_called()

    def test_non_preview_tags_cannot_be_deleted(self) -> None:
        for tag in ["latest", "nightly", "21.3.0", "commit-abcdef0", "pr-42/../latest"]:
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                deploy.delete_image_tag(image="arizephoenix/phoenix", tag=tag, token="hub-token")

    def test_dockerhub_authentication_uses_existing_workflow_credentials(self) -> None:
        with (
            patch.dict(
                deploy.os.environ, DOCKERHUB_USERNAME="publisher", DOCKERHUB_PASSWORD="test-secret"
            ),
            patch.object(
                deploy.urllib.request,
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


if __name__ == "__main__":
    unittest.main()
