#!/usr/bin/env python3
"""
Generate sitemap.xml files from docs.json navigation structure.

This script parses docs.json and extracts all page URLs to create a standard
sitemap.xml file. The sitemap is written to both the repository root and
docs/phoenix/ directories.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET


def extract_pages(item: Any) -> list[str]:
    """
    Recursively extract page paths from the docs.json navigation structure.

    Pages can be:
    - A string starting with "docs/" (direct page path)
    - An object containing arrays/nested objects to recurse into
    - An array of items to recurse into
    """
    pages: list[str] = []

    if isinstance(item, str):
        # Only treat strings starting with "docs/" as page paths
        if item.startswith("docs/"):
            pages.append(item)
    elif isinstance(item, dict):
        # Recurse into all dict values
        for value in item.values():
            pages.extend(extract_pages(value))
    elif isinstance(item, list):
        for sub_item in item:
            pages.extend(extract_pages(sub_item))

    return pages


def indent_xml(elem: ET.Element, level: int = 0) -> None:
    """
    Add indentation to XML elements for pretty printing.
    """
    indent = "\n" + "  " * level
    if len(elem):
        if not elem.text or not elem.text.strip():
            elem.text = indent + "  "
        if not elem.tail or not elem.tail.strip():
            elem.tail = indent
        for child in elem:
            indent_xml(child, level + 1)
        if not child.tail or not child.tail.strip():
            child.tail = indent
    else:
        if level and (not elem.tail or not elem.tail.strip()):
            elem.tail = indent


def parse_existing_sitemap(sitemap_path: Path) -> dict[str, str]:
    """
    Parse an existing sitemap.xml and return a mapping of URLs to their lastmod values.
    """
    url_to_lastmod: dict[str, str] = {}

    if not sitemap_path.exists():
        return url_to_lastmod

    try:
        tree = ET.parse(sitemap_path)
        root = tree.getroot()

        # Handle namespace in sitemap
        namespace = {"ns": "http://www.sitemaps.org/schemas/sitemap/0.9"}

        for url_elem in root.findall("ns:url", namespace):
            loc_elem = url_elem.find("ns:loc", namespace)
            lastmod_elem = url_elem.find("ns:lastmod", namespace)

            if (
                loc_elem is not None
                and loc_elem.text
                and lastmod_elem is not None
                and lastmod_elem.text
            ):
                url_to_lastmod[loc_elem.text] = lastmod_elem.text
    except ET.ParseError:
        # If parsing fails, return empty dict and regenerate all timestamps
        pass

    return url_to_lastmod


def generate_sitemap_xml(
    urls: list[str],
    existing_timestamps: dict[str, str],
    base_url: str = "https://arize.com",
) -> str:
    """
    Generate a standard sitemap.xml string from a list of URL paths.

    Preserves lastmod timestamps for URLs that already exist in existing_timestamps.
    """
    # Create the root element with proper namespace
    urlset = ET.Element("urlset")
    urlset.set("xmlns", "http://www.sitemaps.org/schemas/sitemap/0.9")

    # Get current timestamp for new URLs (ISO 8601 format)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")

    # Add each URL
    for path in urls:
        url_element = ET.SubElement(urlset, "url")

        # Create the full URL - paths already include "docs/phoenix" prefix
        full_url = f"{base_url}/{path}"
        loc = ET.SubElement(url_element, "loc")
        loc.text = full_url

        lastmod = ET.SubElement(url_element, "lastmod")
        # Use existing timestamp if available, otherwise use current time
        lastmod.text = existing_timestamps.get(full_url, now)

    # Pretty print the XML
    indent_xml(urlset)

    # Convert to string with XML declaration
    xml_declaration = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml_body = ET.tostring(urlset, encoding="unicode")

    return xml_declaration + xml_body


def main() -> None:
    # Determine paths
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent
    docs_json_path = repo_root / "docs.json"
    docs_phoenix_dir = repo_root / "docs" / "phoenix"

    # Read docs.json
    with open(docs_json_path, encoding="utf-8") as f:
        docs_config = json.load(f)

    # Extract all pages from navigation (recursively handles any structure)
    navigation = docs_config.get("navigation", {})
    all_pages = extract_pages(navigation)

    # Remove duplicates while preserving order
    seen = set()
    unique_pages = []
    for page in all_pages:
        if page not in seen:
            seen.add(page)
            unique_pages.append(page)

    print(f"Found {len(unique_pages)} unique pages")

    # Parse existing sitemap to preserve timestamps for unchanged URLs
    existing_sitemap_path = repo_root / "sitemap.xml"
    existing_timestamps = parse_existing_sitemap(existing_sitemap_path)
    if existing_timestamps:
        print(f"Loaded {len(existing_timestamps)} existing timestamps")

    # Generate sitemap XML
    sitemap_xml = generate_sitemap_xml(unique_pages, existing_timestamps)

    # Write to both locations
    output_paths = [
        repo_root / "sitemap.xml",
        docs_phoenix_dir / "sitemap.xml",
    ]

    for output_path in output_paths:
        # Ensure parent directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(sitemap_xml)

        print(f"Wrote sitemap to {output_path}")


if __name__ == "__main__":
    main()
