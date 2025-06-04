#!/usr/bin/env python3
"""
Phoenix Exporters Utility Functions

Common utility functions used across multiple exporter modules.
"""

import json
import logging
from typing import Dict, List, Union

import httpx

logger = logging.getLogger(__name__)


def save_json(data: Union[Dict, List], filepath: str) -> None:
    """Save data to a JSON file."""
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)


def get_projects(client: httpx.Client) -> List[Dict]:
    """Get all projects from the Phoenix server."""
    response = client.get("/v1/projects")
    response.raise_for_status()
    return response.json().get("data", [])


def parse_multipart_response(response: httpx.Response) -> List[Dict]:
    """Parse a multipart/mixed response and extract JSON data."""
    content_type = response.headers.get("content-type", "")

    if "boundary=" in content_type:
        boundary = content_type.split("boundary=")[1].strip()
        if boundary.startswith('"') and boundary.endswith('"'):
            boundary = boundary[1:-1]
    else:
        logger.error("No boundary found in multipart response")
        return []

    content = response.content.decode("utf-8", errors="ignore")
    parts = content.split(f"--{boundary}")

    traces = []
    for part in parts:
        if not part.strip() or part.strip() == "--":
            continue

        if "\r\n\r\n" in part:
            header_section, body = part.split("\r\n\r\n", 1)
        elif "\n\n" in part:
            header_section, body = part.split("\n\n", 1)
        else:
            continue

        if "application/json" in header_section:
            try:
                json_data = json.loads(body.strip())
                if isinstance(json_data, list):
                    traces.extend(json_data)
                elif isinstance(json_data, dict):
                    if "data" in json_data:
                        data = json_data["data"]
                        if isinstance(data, list):
                            traces.extend(data)
                        else:
                            traces.append(data)
                    else:
                        traces.append(json_data)
            except json.JSONDecodeError:
                continue

    return traces
