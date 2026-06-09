"""Yq command implementation.

Usage: yq [OPTIONS] [FILTER] [FILE]

Command-line YAML/XML/INI/CSV/TOML processor.
Uses jq-style expressions to query and transform data.

Options:
  -p, --input-format=FMT   input format: yaml (default), xml, json, ini, csv, toml
  -o, --output-format=FMT  output format: yaml (default), json, xml, ini, csv, toml
  -i, --inplace            modify file in-place
  -r, --raw-output         output strings without quotes (json only)
  -c, --compact            compact output (json only)
  -e, --exit-status        set exit status based on output
  -s, --slurp              read entire input into array
  -n, --null-input         don't read any input
  -j, --join-output        don't print newlines after each output
  --help                   display this help and exit
"""

import json
import re
import csv
import io
from dataclasses import dataclass, field
from typing import Any
from xml.etree import ElementTree as ET
from configparser import ConfigParser

from ...types import CommandContext, ExecResult
from ...query_engine import parse, evaluate, EvalContext


# Input formats supported
VALID_INPUT_FORMATS = {"yaml", "json", "xml", "ini", "csv", "toml"}
VALID_OUTPUT_FORMATS = {"yaml", "json", "xml", "ini", "csv", "toml"}

# File extension to format mapping
EXTENSION_FORMAT_MAP = {
    ".yaml": "yaml",
    ".yml": "yaml",
    ".json": "json",
    ".xml": "xml",
    ".ini": "ini",
    ".csv": "csv",
    ".tsv": "csv",
    ".toml": "toml",
}


@dataclass
class YqOptions:
    """Parsed yq options."""
    input_format: str = "yaml"
    output_format: str = "yaml"
    raw: bool = False
    compact: bool = False
    exit_status: bool = False
    slurp: bool = False
    null_input: bool = False
    join_output: bool = False
    inplace: bool = False
    front_matter: bool = False
    indent: int = 2
    xml_attribute_prefix: str = "+@"
    xml_content_name: str = "+content"
    csv_delimiter: str = ""  # Empty means auto-detect


def detect_format_from_extension(filename: str) -> str | None:
    """Detect format from file extension."""
    for ext, fmt in EXTENSION_FORMAT_MAP.items():
        if filename.lower().endswith(ext):
            return fmt
    return None


def extract_front_matter(content: str) -> str | None:
    """Extract YAML front matter from markdown content.

    Front matter is YAML content between --- markers at the start of a file.
    Returns the YAML content without the markers, or None if no front matter found.
    """
    content = content.lstrip()

    # Must start with ---
    if not content.startswith("---"):
        return None

    # Find the closing ---
    # Start searching after the opening ---
    rest = content[3:]

    # Skip the newline after opening ---
    if rest.startswith("\n"):
        rest = rest[1:]
    elif rest.startswith("\r\n"):
        rest = rest[2:]

    # Find the closing --- on its own line
    lines = rest.split("\n")
    front_matter_lines = []

    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped == "---":
            # Found the closing marker
            return "\n".join(front_matter_lines)
        front_matter_lines.append(line)

    # No closing marker found
    return None


def parse_yaml(content: str) -> Any:
    """Parse YAML content (simplified parser)."""
    # This is a simplified YAML parser that handles common cases
    content = content.strip()
    if not content:
        return None

    # Check for JSON-style content (array or object)
    if content.startswith("{") or content.startswith("["):
        return json.loads(content)

    lines = content.split("\n")
    return _parse_yaml_lines(lines, 0, 0)[0]


def _parse_yaml_lines(lines: list[str], start: int, base_indent: int) -> tuple[Any, int]:
    """Parse YAML lines recursively."""
    if start >= len(lines):
        return None, start

    result = {}
    is_list = False
    list_result = []
    i = start

    while i < len(lines):
        line = lines[i]

        # Skip empty lines and comments
        if not line.strip() or line.strip().startswith("#"):
            i += 1
            continue

        # Calculate indentation
        stripped = line.lstrip()
        indent = len(line) - len(stripped)

        # If less indented than base, we're done with this block
        if indent < base_indent and i > start:
            break

        # List item
        if stripped.startswith("- "):
            is_list = True
            item_content = stripped[2:].strip()

            # Check if it's a key: value on same line
            if ":" in item_content and not item_content.startswith('"'):
                # Parse as inline object
                colon_idx = item_content.find(":")
                key = item_content[:colon_idx].strip()
                value = item_content[colon_idx + 1:].strip()

                if value:
                    list_result.append({key: _parse_yaml_value(value)})
                else:
                    # Nested object
                    nested, i = _parse_yaml_lines(lines, i + 1, indent + 2)
                    list_result.append({key: nested})
                    continue
            else:
                list_result.append(_parse_yaml_value(item_content))
            i += 1
            continue

        # Key: value
        if ":" in stripped and not stripped.startswith('"'):
            colon_idx = stripped.find(":")
            key = stripped[:colon_idx].strip()
            value = stripped[colon_idx + 1:].strip()

            if not value:
                # Nested structure
                nested, i = _parse_yaml_lines(lines, i + 1, indent + 2)
                result[key] = nested
                continue
            else:
                result[key] = _parse_yaml_value(value)
            i += 1
            continue

        i += 1

    if is_list:
        return list_result, i
    return result if result else None, i


def _parse_yaml_value(value: str) -> Any:
    """Parse a YAML value."""
    if not value:
        return None

    # Quoted string
    if (value.startswith('"') and value.endswith('"')) or \
       (value.startswith("'") and value.endswith("'")):
        return value[1:-1]

    # Null
    if value.lower() in ("null", "~", ""):
        return None

    # Boolean
    if value.lower() in ("true", "yes", "on"):
        return True
    if value.lower() in ("false", "no", "off"):
        return False

    # Number
    try:
        if "." in value:
            return float(value)
        return int(value)
    except ValueError:
        pass

    # Array (inline)
    if value.startswith("[") and value.endswith("]"):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            pass

    # Object (inline)
    if value.startswith("{") and value.endswith("}"):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            pass

    return value


def format_yaml(value: Any, indent: int = 2) -> str:
    """Format a value as YAML."""
    return _format_yaml_value(value, 0, indent)


def _format_yaml_value(value: Any, level: int, indent: int) -> str:
    """Format a YAML value recursively."""
    prefix = " " * (level * indent)

    if value is None:
        return "null"
    elif isinstance(value, bool):
        return "true" if value else "false"
    elif isinstance(value, (int, float)):
        return str(value)
    elif isinstance(value, str):
        # Check if needs quoting
        if any(c in value for c in [":", "#", "[", "]", "{", "}", "&", "*", "!", "|", ">", "'", '"', "%", "@", "`"]) or \
           value.lower() in ("true", "false", "yes", "no", "null", "on", "off") or \
           not value or value.isspace() or "\n" in value:
            return json.dumps(value)
        return value
    elif isinstance(value, list):
        if not value:
            return "[]"
        lines = []
        for item in value:
            item_str = _format_yaml_value(item, level + 1, indent)
            if isinstance(item, (dict, list)) and item:
                lines.append(f"{prefix}- {item_str.lstrip()}")
            else:
                lines.append(f"{prefix}- {item_str}")
        return "\n".join(lines)
    elif isinstance(value, dict):
        if not value:
            return "{}"
        lines = []
        for k, v in value.items():
            v_str = _format_yaml_value(v, level + 1, indent)
            if isinstance(v, (dict, list)) and v:
                lines.append(f"{prefix}{k}:\n{v_str}")
            else:
                lines.append(f"{prefix}{k}: {v_str}")
        return "\n".join(lines)
    else:
        return str(value)


def parse_xml(content: str, attr_prefix: str = "+@", content_name: str = "+content") -> Any:
    """Parse XML content into a dict structure."""
    try:
        root = ET.fromstring(content)
        return {root.tag: _xml_element_to_dict(root, attr_prefix, content_name)}
    except ET.ParseError as e:
        raise ValueError(f"XML parse error: {e}")


def _xml_element_to_dict(elem: ET.Element, attr_prefix: str, content_name: str) -> Any:
    """Convert an XML element to a dict."""
    result = {}

    # Add attributes with prefix
    for attr, value in elem.attrib.items():
        result[f"{attr_prefix}{attr}"] = value

    # Add children
    children = list(elem)
    if children:
        for child in children:
            child_dict = _xml_element_to_dict(child, attr_prefix, content_name)
            if child.tag in result:
                # Multiple children with same tag - convert to list
                existing = result[child.tag]
                if not isinstance(existing, list):
                    result[child.tag] = [existing]
                result[child.tag].append(child_dict)
            else:
                result[child.tag] = child_dict

    # Add text content
    text = (elem.text or "").strip()
    if text:
        if result:
            result[content_name] = text
        else:
            return text

    return result if result else None


def format_xml(value: Any, root_name: str = "root") -> str:
    """Format a value as XML."""
    if isinstance(value, dict) and len(value) == 1:
        root_name = list(value.keys())[0]
        value = value[root_name]

    root = ET.Element(root_name)
    _dict_to_xml_element(value, root)
    return ET.tostring(root, encoding="unicode")


def _dict_to_xml_element(value: Any, elem: ET.Element) -> None:
    """Convert a dict/value to XML element."""
    if isinstance(value, dict):
        for k, v in value.items():
            if k.startswith("+@"):
                # Attribute
                elem.set(k[2:], str(v))
            elif k == "+content":
                elem.text = str(v)
            elif isinstance(v, list):
                for item in v:
                    child = ET.SubElement(elem, k)
                    _dict_to_xml_element(item, child)
            else:
                child = ET.SubElement(elem, k)
                _dict_to_xml_element(v, child)
    elif isinstance(value, list):
        for i, item in enumerate(value):
            child = ET.SubElement(elem, "item")
            _dict_to_xml_element(item, child)
    elif value is not None:
        elem.text = str(value)


def parse_ini(content: str) -> dict[str, Any]:
    """Parse INI content into a dict structure."""
    parser = ConfigParser()
    parser.read_string(content)

    result = {}
    for section in parser.sections():
        result[section] = dict(parser[section])

    # Handle default section
    if parser.defaults():
        result["DEFAULT"] = dict(parser.defaults())

    return result


def format_ini(value: dict[str, Any]) -> str:
    """Format a dict as INI."""
    lines = []
    for section, items in value.items():
        lines.append(f"[{section}]")
        if isinstance(items, dict):
            for k, v in items.items():
                lines.append(f"{k} = {v}")
        lines.append("")
    return "\n".join(lines)


def parse_csv(content: str, delimiter: str = "") -> list[dict[str, str]]:
    """Parse CSV content into a list of dicts."""
    if not content.strip():
        return []

    # Auto-detect delimiter
    if not delimiter:
        first_line = content.split("\n")[0]
        if "\t" in first_line:
            delimiter = "\t"
        elif ";" in first_line:
            delimiter = ";"
        else:
            delimiter = ","

    reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
    return list(reader)


def format_csv(value: list[dict[str, Any]] | list[list[Any]], delimiter: str = ",") -> str:
    """Format a value as CSV."""
    if not value:
        return ""

    output = io.StringIO()
    if isinstance(value[0], dict):
        fieldnames = list(value[0].keys())
        writer = csv.DictWriter(output, fieldnames=fieldnames, delimiter=delimiter)
        writer.writeheader()
        writer.writerows(value)
    else:
        writer = csv.writer(output, delimiter=delimiter)
        writer.writerows(value)

    return output.getvalue()


def parse_toml(content: str) -> dict[str, Any]:
    """Parse TOML content into a dict structure."""
    # Simple TOML parser for common cases
    result: dict[str, Any] = {}
    current_section: dict[str, Any] = result
    current_section_name = ""

    for line in content.split("\n"):
        line = line.strip()

        # Skip empty lines and comments
        if not line or line.startswith("#"):
            continue

        # Section header
        if line.startswith("["):
            section_name = line[1:-1].strip()
            # Handle nested sections like [package.metadata]
            parts = section_name.split(".")
            current_section = result
            for part in parts:
                if part not in current_section:
                    current_section[part] = {}
                current_section = current_section[part]
            continue

        # Key = value
        if "=" in line:
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip()
            current_section[key] = _parse_toml_value(value)

    return result


def _parse_toml_value(value: str) -> Any:
    """Parse a TOML value."""
    value = value.strip()

    # String
    if value.startswith('"') and value.endswith('"'):
        return value[1:-1].replace('\\"', '"')
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1]

    # Array
    if value.startswith("[") and value.endswith("]"):
        inner = value[1:-1].strip()
        if not inner:
            return []
        # Simple array parsing
        items = []
        for item in inner.split(","):
            items.append(_parse_toml_value(item.strip()))
        return items

    # Boolean
    if value == "true":
        return True
    if value == "false":
        return False

    # Number
    try:
        if "." in value:
            return float(value)
        return int(value)
    except ValueError:
        pass

    return value


def format_toml(value: dict[str, Any], section: str = "") -> str:
    """Format a dict as TOML."""
    lines = []

    # First output non-table values
    for k, v in value.items():
        if not isinstance(v, dict):
            lines.append(f"{k} = {_format_toml_value(v)}")

    # Then output tables
    for k, v in value.items():
        if isinstance(v, dict):
            section_name = f"{section}.{k}" if section else k
            lines.append("")
            lines.append(f"[{section_name}]")
            lines.append(format_toml(v, section_name).strip())

    return "\n".join(lines)


def _format_toml_value(value: Any) -> str:
    """Format a TOML value."""
    if value is None:
        return '""'
    elif isinstance(value, bool):
        return "true" if value else "false"
    elif isinstance(value, (int, float)):
        return str(value)
    elif isinstance(value, str):
        return json.dumps(value)
    elif isinstance(value, list):
        items = [_format_toml_value(v) for v in value]
        return "[" + ", ".join(items) + "]"
    else:
        return json.dumps(value)


def parse_input(content: str, options: YqOptions) -> Any:
    """Parse input based on format option."""
    fmt = options.input_format

    if fmt == "json":
        return json.loads(content)
    elif fmt == "yaml":
        return parse_yaml(content)
    elif fmt == "xml":
        return parse_xml(content, options.xml_attribute_prefix, options.xml_content_name)
    elif fmt == "ini":
        return parse_ini(content)
    elif fmt == "csv":
        return parse_csv(content, options.csv_delimiter)
    elif fmt == "toml":
        return parse_toml(content)
    else:
        raise ValueError(f"Unknown input format: {fmt}")


def format_output(value: Any, options: YqOptions) -> str:
    """Format output based on format option."""
    fmt = options.output_format

    if fmt == "json":
        if options.raw and isinstance(value, str):
            return value
        if options.compact:
            return json.dumps(value, separators=(",", ":"))
        return json.dumps(value, indent=options.indent)
    elif fmt == "yaml":
        return format_yaml(value, options.indent)
    elif fmt == "xml":
        return format_xml(value)
    elif fmt == "ini":
        if isinstance(value, dict):
            return format_ini(value)
        raise ValueError("INI output requires object input")
    elif fmt == "csv":
        if isinstance(value, list):
            return format_csv(value)
        raise ValueError("CSV output requires array input")
    elif fmt == "toml":
        if isinstance(value, dict):
            return format_toml(value)
        raise ValueError("TOML output requires object input")
    else:
        raise ValueError(f"Unknown output format: {fmt}")


class YqCommand:
    """The yq command - YAML/XML/INI/CSV/TOML processor."""

    name = "yq"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the yq command."""
        if "--help" in args or "-h" in args:
            return ExecResult(
                stdout=(
                    "Usage: yq [OPTIONS] [FILTER] [FILE]\n"
                    "Command-line YAML/XML/INI/CSV/TOML processor.\n\n"
                    "Options:\n"
                    "  -p, --input-format=FMT   input format: yaml (default), xml, json, ini, csv, toml\n"
                    "  -o, --output-format=FMT  output format: yaml (default), json, xml, ini, csv, toml\n"
                    "  -i, --inplace            modify file in-place\n"
                    "  -r, --raw-output         output strings without quotes\n"
                    "  -c, --compact            compact output\n"
                    "  -e, --exit-status        set exit status based on output\n"
                    "  -s, --slurp              read entire input into array\n"
                    "  -n, --null-input         don't read any input\n"
                    "  -j, --join-output        don't print newlines after each output\n"
                    "  -f, --front-matter       extract YAML front matter from markdown\n"
                    "  --help                   display this help and exit\n\n"
                    "Examples:\n"
                    "  yq '.name' config.yaml\n"
                    "  yq -o json '.' config.yaml\n"
                    "  yq -p json -o yaml '.' data.json\n"
                    "  yq '.users[0]' users.yaml\n"
                ),
                stderr="",
                exit_code=0,
            )

        # Parse arguments
        options = YqOptions()
        filter_str = "."
        filter_set = False
        files: list[str] = []
        input_format_explicit = False

        i = 0
        while i < len(args):
            a = args[i]

            if a.startswith("--input-format="):
                fmt = a[15:]
                if fmt not in VALID_INPUT_FORMATS:
                    return ExecResult(
                        stdout="",
                        stderr=f"yq: unknown input format: {fmt}\n",
                        exit_code=2,
                    )
                options.input_format = fmt
                input_format_explicit = True
            elif a.startswith("--output-format="):
                fmt = a[16:]
                if fmt not in VALID_OUTPUT_FORMATS:
                    return ExecResult(
                        stdout="",
                        stderr=f"yq: unknown output format: {fmt}\n",
                        exit_code=2,
                    )
                options.output_format = fmt
            elif a == "-p" or a == "--input-format":
                i += 1
                if i >= len(args):
                    return ExecResult(
                        stdout="",
                        stderr="yq: option requires argument -- 'p'\n",
                        exit_code=2,
                    )
                fmt = args[i]
                if fmt not in VALID_INPUT_FORMATS:
                    return ExecResult(
                        stdout="",
                        stderr=f"yq: unknown input format: {fmt}\n",
                        exit_code=2,
                    )
                options.input_format = fmt
                input_format_explicit = True
            elif a == "-o" or a == "--output-format":
                i += 1
                if i >= len(args):
                    return ExecResult(
                        stdout="",
                        stderr="yq: option requires argument -- 'o'\n",
                        exit_code=2,
                    )
                fmt = args[i]
                if fmt not in VALID_OUTPUT_FORMATS:
                    return ExecResult(
                        stdout="",
                        stderr=f"yq: unknown output format: {fmt}\n",
                        exit_code=2,
                    )
                options.output_format = fmt
            elif a in ("-r", "--raw-output"):
                options.raw = True
            elif a in ("-c", "--compact"):
                options.compact = True
            elif a in ("-e", "--exit-status"):
                options.exit_status = True
            elif a in ("-s", "--slurp"):
                options.slurp = True
            elif a in ("-n", "--null-input"):
                options.null_input = True
            elif a in ("-j", "--join-output"):
                options.join_output = True
            elif a in ("-i", "--inplace"):
                options.inplace = True
            elif a in ("-f", "--front-matter"):
                options.front_matter = True
            elif a == "-":
                files.append("-")
            elif a.startswith("--"):
                return ExecResult(
                    stdout="",
                    stderr=f"yq: unknown option: {a}\n",
                    exit_code=2,
                )
            elif a.startswith("-"):
                # Handle combined short options
                for c in a[1:]:
                    if c == "r":
                        options.raw = True
                    elif c == "c":
                        options.compact = True
                    elif c == "e":
                        options.exit_status = True
                    elif c == "s":
                        options.slurp = True
                    elif c == "n":
                        options.null_input = True
                    elif c == "j":
                        options.join_output = True
                    elif c == "i":
                        options.inplace = True
                    elif c == "f":
                        options.front_matter = True
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"yq: unknown option: -{c}\n",
                            exit_code=2,
                        )
            elif not filter_set:
                filter_str = a
                filter_set = True
            else:
                files.append(a)
            i += 1

        # Auto-detect format from file extension if not explicitly set
        if not input_format_explicit and files and files[0] != "-":
            detected = detect_format_from_extension(files[0])
            if detected:
                options.input_format = detected

        # Inplace requires a file
        if options.inplace and (not files or files[0] == "-"):
            return ExecResult(
                stdout="",
                stderr="yq: -i/--inplace requires a file argument\n",
                exit_code=1,
            )

        # Read input
        file_path = None
        if options.null_input:
            content = ""
        elif not files or files[0] == "-":
            content = ctx.stdin
        else:
            try:
                file_path = ctx.fs.resolve_path(ctx.cwd, files[0])
                content = await ctx.fs.read_file(file_path)
            except FileNotFoundError:
                return ExecResult(
                    stdout="",
                    stderr=f"yq: {files[0]}: No such file or directory\n",
                    exit_code=2,
                )

        try:
            # Extract front matter if requested
            if options.front_matter and not options.null_input:
                front_matter = extract_front_matter(content)
                if front_matter is None:
                    # No front matter found - return null
                    content = ""
                else:
                    content = front_matter
                # Front matter is always YAML
                options.input_format = "yaml"

            # Parse input
            if options.null_input:
                parsed = None
            elif options.front_matter and not content:
                parsed = None
            else:
                parsed = parse_input(content, options)

            if options.slurp and not options.null_input:
                parsed = [parsed]

            # Parse and evaluate filter using query engine
            ast = parse(filter_str)
            eval_ctx = EvalContext(env=dict(ctx.env))
            results = evaluate(parsed, ast, eval_ctx)

            # Format output
            formatted = []
            for result in results:
                formatted.append(format_output(result, options))

            separator = "" if options.join_output else "\n"
            output = separator.join(f for f in formatted if f)
            if output and not options.join_output:
                output += "\n"

            # Handle inplace mode
            if options.inplace and file_path:
                await ctx.fs.write_file(file_path, output)
                return ExecResult(stdout="", stderr="", exit_code=0)

            # Determine exit code
            exit_code = 0
            if options.exit_status:
                if not results or all(
                    v is None or v is False
                    for v in results
                ):
                    exit_code = 1

            return ExecResult(stdout=output, stderr="", exit_code=exit_code)

        except ValueError as e:
            return ExecResult(
                stdout="",
                stderr=f"yq: parse error: {e}\n",
                exit_code=5,
            )
        except Exception as e:
            return ExecResult(
                stdout="",
                stderr=f"yq: error: {e}\n",
                exit_code=1,
            )
