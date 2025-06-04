#!/usr/bin/env python3
"""
Phoenix Prompts Exporter

This module handles exporting prompts from a Phoenix server.

Usage:
  from exporters import export_prompts

  # Export prompts
  export_prompts.export_prompts(
      client=client,
      output_dir="./phoenix_export/prompts",
  )
"""

import logging
import os
from typing import Dict, List, Optional

import httpx

from .utils import save_json

# Configure logging
logger = logging.getLogger(__name__)


def get_prompts(client: httpx.Client) -> List[Dict]:
    """Get all prompts from the Phoenix server."""
    response = client.get("/v1/prompts")
    response.raise_for_status()
    return response.json().get("data", [])


def export_prompts(
    client: httpx.Client, output_dir: str, verbose: bool = False, results_file: Optional[str] = None
) -> List[Dict]:
    """Export all prompts."""
    os.makedirs(output_dir, exist_ok=True)

    if verbose:
        logger.setLevel(logging.DEBUG)

    results = []

    try:
        # Export prompts
        logger.info("Exporting prompts...")
        prompts = get_prompts(client)

        if not prompts:
            logger.warning("No prompts found")
            return results

        logger.info(f"Found {len(prompts)} prompts")
        save_json(prompts, os.path.join(output_dir, "prompts.json"))

        # Create detailed result objects
        for prompt in prompts:
            prompt_id = prompt["id"]
            prompt_name = prompt.get("name", prompt_id)

            prompt_result = {"id": prompt_id, "name": prompt_name, "status": "exported"}
            results.append(prompt_result)

        logger.info(f"Prompts export completed successfully. Data saved to {output_dir}")

        # Save results to file if requested
        if results_file:
            save_json(results, results_file)
            logger.info(f"Export results saved to {results_file}")

        return results

    except Exception as e:
        logger.error(f"Error during prompts export: {e}")
        if results_file:
            error_results = {"error": str(e), "prompts": results}
            save_json(error_results, results_file)
        return results


if __name__ == "__main__":
    import argparse

    from dotenv import load_dotenv

    load_dotenv()

    # Configure logging
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    parser = argparse.ArgumentParser(description="Export prompts from a Phoenix server")

    parser.add_argument(
        "--base-url",
        type=str,
        default=os.environ.get("PHOENIX_BASE_URL"),
        help="Phoenix server base URL (default: from PHOENIX_BASE_URL env var)",
    )
    parser.add_argument(
        "--api-key",
        type=str,
        default=os.environ.get("PHOENIX_API_KEY"),
        help="Phoenix API key for authentication (default: from PHOENIX_API_KEY env var)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./phoenix_export/prompts",
        help="Directory to save exported data (default: ./phoenix_export/prompts)",
    )
    parser.add_argument("--verbose", action="store_true", help="Enable verbose output")
    parser.add_argument("--results-file", type=str, help="Path to save export results JSON")

    args = parser.parse_args()

    if not args.base_url:
        logger.error(
            "No Phoenix base URL provided. Set the PHOENIX_BASE_URL environment variable "
            "or use --base-url"
        )
        exit(1)

    # Create HTTPX client
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if args.api_key:
        headers["Authorization"] = f"Bearer {args.api_key}"

    client = httpx.Client(base_url=args.base_url.rstrip("/"), headers=headers)

    # Export prompts
    results = export_prompts(
        client=client,
        output_dir=args.output_dir,
        verbose=args.verbose,
        results_file=args.results_file,
    )

    # Print summary
    export_count = sum(1 for r in results if r.get("status") == "exported")
    error_count = sum(1 for r in results if r.get("status") == "error")

    print("\nExport Summary:")
    print(f"- Exported: {export_count} prompts")
    print(f"- Errors: {error_count} prompts")

    if args.results_file:
        print(f"Detailed results saved to: {args.results_file}")

    if error_count > 0:
        exit(1)
