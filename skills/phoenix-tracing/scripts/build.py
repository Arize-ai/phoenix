#!/usr/bin/env python3
"""
Build script for Phoenix Tracing Skill

Validates SKILL.md against OpenInference semantic conventions:
- Checks JSON examples for validity
- Verifies all span kinds are documented
- Validates attribute path patterns
- Ensures flattening convention is followed
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import List, Tuple

# Expected span kinds from OpenInference spec
EXPECTED_SPAN_KINDS = {
    "LLM",
    "EMBEDDING",
    "CHAIN",
    "RETRIEVER",
    "RERANKER",
    "TOOL",
    "AGENT",
    "GUARDRAIL",
    "EVALUATOR",
}

# Required attribute
REQUIRED_ATTRIBUTE = "openinference.span.kind"

# Common attribute patterns (for validation)
ATTRIBUTE_PATTERNS = {
    "llm": (
        r"^llm\.(model_name|provider|invocation_parameters|token_count\.\w+|cost\.\w+|"
        r"prompt_template\.\w+|input_messages\.\d+\.message\.\w+|"
        r"output_messages\.\d+\.message\.\w+|tools\.\d+\.tool\.\w+)$"
    ),
    "embedding": r"^embedding\.(model_name|text|vector|embeddings\.\d+\.embedding\.\w+)$",
    "retrieval": r"^retrieval\.documents\.\d+\.document\.(id|content|score|metadata)$",
    "reranker": (
        r"^reranker\.(model_name|query|top_k|input_documents\.\d+\.document\.\w+|"
        r"output_documents\.\d+\.document\.\w+)$"
    ),
    "tool": r"^tool\.(name|description|parameters)$",
    "metadata": r"^metadata\.\w+$",
    "session": r"^session\.id$",
    "user": r"^user\.id$",
    "tag": r"^tag\.tags\.\d+$",
    "exception": r"^exception\.(type|message|stacktrace|escaped)$",
    "input": r"^(input|output)\.(value|mime_type)$",
}


class SkillValidator:
    def __init__(self, skill_path: Path, verbose: bool = False):
        self.skill_path = skill_path
        self.verbose = verbose
        self.errors: List[str] = []
        self.warnings: List[str] = []

        with open(skill_path, "r") as f:
            self.content = f.read()

    def log(self, msg: str) -> None:
        """Log verbose message"""
        if self.verbose:
            print(f"[INFO] {msg}")

    def add_error(self, msg: str) -> None:
        """Add validation error"""
        self.errors.append(msg)
        print(f"[ERROR] {msg}")

    def add_warning(self, msg: str) -> None:
        """Add validation warning"""
        self.warnings.append(msg)
        print(f"[WARN] {msg}")

    def validate_frontmatter(self) -> bool:
        """Validate YAML frontmatter"""
        self.log("Validating frontmatter...")

        # Extract frontmatter
        frontmatter_match = re.match(r"^---\n(.*?)\n---", self.content, re.DOTALL)
        if not frontmatter_match:
            self.add_error("Missing YAML frontmatter")
            return False

        frontmatter = frontmatter_match.group(1)

        # Check required fields
        required_fields = ["name", "description", "license", "metadata"]
        for field in required_fields:
            if f"{field}:" not in frontmatter:
                self.add_error(f"Missing required frontmatter field: {field}")

        # Check metadata contains version info
        if "openinference_version:" not in frontmatter:
            self.add_warning("Missing openinference_version in metadata")

        self.log("Frontmatter validation complete")
        return True

    def validate_span_kinds(self) -> bool:
        """Check that all span kinds are documented"""
        self.log("Validating span kinds...")

        documented_kinds = set()

        # Find span kind sections
        for kind in EXPECTED_SPAN_KINDS:
            # Look for markdown header with span kind
            if re.search(rf"^##+ {kind} Spans?$", self.content, re.MULTILINE):
                documented_kinds.add(kind)
                self.log(f"Found documentation for {kind}")

        # Check for missing span kinds
        missing_kinds = EXPECTED_SPAN_KINDS - documented_kinds
        if missing_kinds:
            for kind in sorted(missing_kinds):
                self.add_error(f"Missing documentation for span kind: {kind}")

        # Check for unexpected span kinds
        span_kind_pattern = r"^##+ (\w+) Spans?$"
        all_documented = re.findall(span_kind_pattern, self.content, re.MULTILINE)
        unexpected = set(all_documented) - EXPECTED_SPAN_KINDS - {"Span", "Kinds"}
        if unexpected:
            for kind in sorted(unexpected):
                self.add_warning(f"Unexpected span kind documented: {kind}")

        self.log(
            f"Span kind validation complete: {len(documented_kinds)}/{len(EXPECTED_SPAN_KINDS)}"
        )
        return len(missing_kinds) == 0

    def extract_json_examples(self) -> List[Tuple[str, int]]:
        """Extract all JSON code blocks"""
        self.log("Extracting JSON examples...")

        examples = []

        # Find all JSON code blocks
        pattern = r"```json\n(.*?)\n```"
        matches = re.finditer(pattern, self.content, re.DOTALL)

        for match in matches:
            json_str = match.group(1)
            line_num = self.content[: match.start()].count("\n") + 1
            examples.append((json_str, line_num))

        self.log(f"Found {len(examples)} JSON examples")
        return examples

    def validate_json_examples(self) -> bool:
        """Validate all JSON examples are valid"""
        self.log("Validating JSON examples...")

        examples = self.extract_json_examples()
        valid_count = 0

        for json_str, line_num in examples:
            try:
                data = json.loads(json_str)
                valid_count += 1

                # Check for required attribute in span examples
                if isinstance(data, dict) and REQUIRED_ATTRIBUTE not in data:
                    # Check if this looks like a span example (has span-like attributes)
                    if any(
                        key.startswith(("llm.", "embedding.", "retrieval.", "reranker.", "tool."))
                        for key in data.keys()
                    ):
                        self.add_warning(
                            f"Line {line_num}: JSON example appears to be a span but "
                            f"missing required attribute '{REQUIRED_ATTRIBUTE}'"
                        )

            except json.JSONDecodeError as e:
                self.add_error(f"Line {line_num}: Invalid JSON - {e}")

        self.log(f"JSON validation complete: {valid_count}/{len(examples)} valid")
        return len(self.errors) == 0

    def validate_attribute_paths(self) -> bool:
        """Validate attribute paths follow flattening convention"""
        self.log("Validating attribute paths...")

        examples = self.extract_json_examples()

        for json_str, line_num in examples:
            try:
                data = json.loads(json_str)
                if not isinstance(data, dict):
                    continue

                for key in data.keys():
                    # Skip if it's the required attribute
                    if key == REQUIRED_ATTRIBUTE:
                        continue

                    # Check if key matches any expected pattern
                    matched = False
                    for namespace, pattern in ATTRIBUTE_PATTERNS.items():
                        if re.match(pattern, key):
                            matched = True
                            break

                    if not matched:
                        # Check for common mistakes
                        if ".." in key:
                            self.add_error(f"Line {line_num}: Double dot in attribute path: {key}")
                        elif key.endswith("."):
                            self.add_error(
                                f"Line {line_num}: Trailing dot in attribute path: {key}"
                            )
                        elif re.search(r"\.message\..*\.message\.", key):
                            self.add_error(f"Line {line_num}: Duplicate .message. segment: {key}")
                        elif (
                            key.startswith("llm.") and "messages" in key and ".message." not in key
                        ):
                            self.add_warning(
                                f"Line {line_num}: Message attribute missing "
                                f".message. segment: {key}"
                            )
                        # Note: We don't error on unrecognized patterns
                        # as new attributes may be added

            except json.JSONDecodeError:
                pass  # Already reported in validate_json_examples

        self.log("Attribute path validation complete")
        return True

    def validate_table_of_contents(self) -> bool:
        """Validate table of contents links"""
        self.log("Validating table of contents...")

        # Extract TOC links
        toc_pattern = r"\[([^\]]+)\]\(#([^\)]+)\)"
        toc_links = re.findall(toc_pattern, self.content)

        if not toc_links:
            self.add_warning("No table of contents found")
            return True

        # Extract actual headers
        header_pattern = r"^##+ (.+)$"
        headers = re.findall(header_pattern, self.content, re.MULTILINE)

        # Convert headers to anchor format (lowercase, replace spaces with hyphens)
        anchors = {re.sub(r"[^\w\s-]", "", header.lower()).replace(" ", "-") for header in headers}

        # Check TOC links
        broken_links = []
        for link_text, anchor in toc_links:
            if anchor not in anchors:
                broken_links.append(f"{link_text} -> #{anchor}")

        if broken_links:
            self.add_warning(f"Found {len(broken_links)} potentially broken TOC links")
            if self.verbose:
                for link in broken_links[:5]:  # Show first 5
                    self.add_warning(f"  {link}")

        self.log(f"TOC validation complete: {len(toc_links)} links checked")
        return True

    def validate_required_sections(self) -> bool:
        """Check that required sections exist"""
        self.log("Validating required sections...")

        required_sections = [
            "Overview",
            "Flattening Convention",
            "Span Kinds Overview",
            "Cumulative Metrics",
            "Query DSL",
            "Attribute Index",
            "Troubleshooting",
        ]

        for section in required_sections:
            if not re.search(rf"^##+ {re.escape(section)}", self.content, re.MULTILINE):
                self.add_error(f"Missing required section: {section}")

        self.log("Required sections validation complete")
        return len(self.errors) == 0

    def validate_examples_completeness(self) -> bool:
        """Check that each span kind has examples"""
        self.log("Validating example completeness...")

        for kind in EXPECTED_SPAN_KINDS:
            # Find section for this span kind
            section_pattern = rf"^##+ {kind} Spans?$.*?(?=^##+ |\Z)"
            section_match = re.search(section_pattern, self.content, re.MULTILINE | re.DOTALL)

            if section_match:
                section_content = section_match.group(0)

                # Check for JSON example in this section
                if "```json" not in section_content:
                    self.add_warning(f"Span kind {kind} section has no JSON example")

                # Check for "Complete Example" subsection
                if (
                    "### Complete Example" not in section_content
                    and "### Example" not in section_content
                ):
                    self.add_warning(f"Span kind {kind} section has no example subsection")

        self.log("Example completeness validation complete")
        return True

    def validate_all(self) -> bool:
        """Run all validations"""
        print(f"Validating {self.skill_path}...")
        print()

        self.validate_frontmatter()
        self.validate_required_sections()
        self.validate_span_kinds()
        self.validate_json_examples()
        self.validate_attribute_paths()
        self.validate_table_of_contents()
        self.validate_examples_completeness()

        print()
        print("=" * 60)
        print("Validation Results:")
        print(f"  Errors: {len(self.errors)}")
        print(f"  Warnings: {len(self.warnings)}")
        print("=" * 60)

        return len(self.errors) == 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Phoenix Tracing Skill documentation")
    parser.add_argument("command", choices=["validate", "check-examples"], help="Command to run")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument(
        "--skill-path",
        type=Path,
        default=Path(__file__).parent.parent / "SKILL.md",
        help="Path to SKILL.md file",
    )

    args = parser.parse_args()

    if not args.skill_path.exists():
        print(f"Error: {args.skill_path} not found")
        return 1

    validator = SkillValidator(args.skill_path, verbose=args.verbose)

    if args.command == "validate":
        success = validator.validate_all()
    elif args.command == "check-examples":
        success = validator.validate_json_examples()
    else:
        success = False

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
