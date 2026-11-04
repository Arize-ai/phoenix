"""Every ``px`` command in the public skills matches the CLI's real command tree.

The check loads ``createProgram()`` from ``js/packages/phoenix-cli/src`` with ``tsx`` and walks
the Commander tree, so it sees this checkout's CLI rather than a published one. It finds
commands in two places:

- lines in ```bash, ```sh, ```shell and untagged fences that start with ``px``, or that run
  ``px`` after ``|``, ``&&``, ``;`` or ``$(``;
- inline code spans that start with ``px``, such as `px trace get <trace-id>`.

Each command must name existing subcommands and flags, and pass no more positional arguments
than the command takes. A placeholder that stands for a subcommand, such as
``px <resource> <action>`` or ``px <entity>-annotations``, ends the check for that command.
Any other placeholder counts as a positional argument, so ``px trace <trace-id>`` fails
because ``px trace`` needs a subcommand.

Lives outside tests/ so CI runs it only when a skill or the CLI changes. It needs
``pnpm install`` in ``js/`` and the CLI's workspace dependencies built;
``make check-skill-px-commands`` builds them.
"""

from __future__ import annotations

import json
import re
import shlex
import subprocess
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

import pytest
from skill_examples import REPO_ROOT, location, public_skill_dirs

CLI_ROOT = REPO_ROOT / "js" / "packages" / "phoenix-cli"
_TSX = CLI_ROOT / "node_modules" / ".bin" / "tsx"
_DUMP_COMMAND_TREE = """
import { createProgram } from "./src/cli";
const walk = (command: any): any => ({
  name: command.name(),
  aliases: command.aliases(),
  options: command.options.map((option: any) => ({
    flags: [option.short, option.long].filter(Boolean),
    takesValue: option.required || option.optional,
    variadic: option.variadic,
  })),
  arguments: command.registeredArguments.length,
  variadicArguments: command.registeredArguments.some((argument: any) => argument.variadic),
  passThrough: command._passThroughOptions,
  commands: command.commands.map(walk),
});
process.stdout.write(JSON.stringify(walk(createProgram())));
"""
_HELP_FLAGS = ("-h", "--help")

# Commands that fail today, keyed by their arguments. Each entry is a bug in a skill; fix the
# skill and delete its entry. The tests are strict, so a fixed command fails until its entry goes.
KNOWN_BROKEN: dict[str, str] = {}

_FENCE = re.compile(r"^[ \t]*```(\w*)[^\n]*\n(.*?)^[ \t]*```", re.DOTALL | re.MULTILINE)
_SHELL_LANGUAGES = frozenset({"", "bash", "sh", "shell", "console"})
_INLINE_PX = re.compile(r"(?<!`)`(px [^`\n]+)`")


def _shell_tokens(line: str) -> list[str]:
    """Splits a shell line into words and the operators ``|``, ``&``, ``;``, ``(`` and ``)``."""
    lexer = shlex.shlex(line, posix=True, punctuation_chars="|&;()")
    lexer.whitespace_split = True
    return list(lexer)


def _logical_lines(body: str) -> list[tuple[int, list[str]]]:
    """Tokenizes each command line, joining continued lines and lines inside an open quote.

    Returns each line's tokens with the number of its first line, counted from 0.
    """
    lines: list[tuple[int, list[str]]] = []
    pending: list[str] = []
    start = 0
    for number, line in enumerate(body.splitlines()):
        if not pending:
            start = number
        pending.append(line)
        joined = "\n".join(pending)
        if joined.endswith("\\"):
            continue
        try:
            tokens = _shell_tokens(joined.replace("\\\n", " "))
        except ValueError:
            continue  # An open quote, as in a multi-line `px api graphql '...'`.
        lines.append((start, tokens))
        pending = []
    return lines


def _px_invocations(tokens: list[str]) -> list[list[str]]:
    """Returns the arguments of each ``px`` run in a tokenized line."""
    invocations: list[list[str]] = []
    current: list[str] | None = None
    for token in [*tokens, ";"]:
        if token and set(token) <= set("|&;()"):
            if current is not None:
                invocations.append(current)
            current = None
        elif current is not None:
            current.append(token)
        elif token == "px":
            current = []
    return invocations


@dataclass(frozen=True)
class PxCommand:
    """The arguments of one ``px`` command and where it appears."""

    where: str
    arguments: tuple[str, ...]


def px_commands() -> list[PxCommand]:
    commands = []
    for skill_dir in public_skill_dirs():
        for path in sorted(skill_dir.rglob("*.md")):
            text = path.read_text(encoding="utf-8")
            for fence in _FENCE.finditer(text):
                if fence.group(1) not in _SHELL_LANGUAGES:
                    continue
                first_line = text.count("\n", 0, fence.start(2)) + 1
                for offset, tokens in _logical_lines(fence.group(2)):
                    for arguments in _px_invocations(tokens):
                        where = f"{location(path)}:{first_line + offset}"
                        commands.append(PxCommand(where, tuple(arguments)))
            prose = _FENCE.sub(lambda fence: "\n" * fence.group(0).count("\n"), text)
            for match in _INLINE_PX.finditer(prose):
                line = prose.count("\n", 0, match.start()) + 1
                for arguments in _px_invocations(_shell_tokens(match.group(1))):
                    commands.append(PxCommand(f"{location(path)}:{line}", tuple(arguments)))
    return commands


_SUBCOMMAND_PLACEHOLDER = re.compile(
    r"^[<\[](command|subcommand|resource|action|noun|verb)s?(\.\.\.)?[>\]]$"
)


def _is_subcommand_placeholder(token: str) -> bool:
    """Checks whether a token stands for a subcommand, like ``<entity>-annotations``."""
    is_template = "<" in token and not re.fullmatch(r"<[^<>]+>", token)
    return is_template or bool(_SUBCOMMAND_PLACEHOLDER.match(token))


def problems(tokens: Sequence[str], tree: dict[str, Any]) -> list[str]:
    """Returns what's wrong with the arguments of one ``px`` command, or nothing."""
    node = tree
    path = ["px"]
    index = 0
    while index < len(tokens) and not tokens[index].startswith("-") and node["commands"]:
        token = tokens[index]
        if _is_subcommand_placeholder(token):
            return []
        subcommand = next(
            (child for child in node["commands"] if token in (child["name"], *child["aliases"])),
            None,
        )
        if subcommand is None:
            if node["arguments"]:
                break
            names = sorted(child["name"] for child in node["commands"])
            return [f"`{' '.join(path)}` has no subcommand {token!r}; it has {names}"]
        node = subcommand
        path.append(token)
        index += 1

    options = {flag: option for option in node["options"] for flag in option["flags"]}
    found: list[str] = []
    positionals = 0
    while index < len(tokens):
        token = tokens[index]
        index += 1
        if token == "--" or node["passThrough"]:
            break
        if not token.startswith("-") or token == "-":
            positionals += 1
            continue
        flag, has_inline_value = token.split("=", 1)[0], "=" in token
        option = options.get(flag)
        if option is None:
            if flag not in _HELP_FLAGS:
                found.append(f"`{' '.join(path)}` has no option {flag}")
            continue
        if option["takesValue"] and not has_inline_value:
            index += 1
            while option["variadic"] and index < len(tokens) and not tokens[index].startswith("-"):
                index += 1
    if positionals > node["arguments"] and not node["variadicArguments"]:
        found.append(
            f"`{' '.join(path)}` takes {node['arguments']} positional arguments, got {positionals}"
        )
    return found


COMMANDS = px_commands()


@pytest.fixture(scope="module")
def command_tree() -> dict[str, Any]:
    if not _TSX.exists():
        pytest.fail(f"{_TSX} is missing. Run `pnpm install` in js/.")
    result = subprocess.run(
        [str(_TSX), "-e", _DUMP_COMMAND_TREE],
        cwd=CLI_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode:
        pytest.fail(
            "Couldn't load the px command tree. Build the CLI's workspace dependencies with "
            f"`make check-skill-px-commands`.\n{result.stderr[-2000:]}"
        )
    tree: dict[str, Any] = json.loads(result.stdout)
    return tree


def test_finds_commands() -> None:
    assert COMMANDS


@pytest.mark.parametrize(
    ("command", "expected"),
    [
        ("px trace list --limit 5 --format raw", []),
        ("px span list --span-id a b --limit 1", []),
        ("px <resource> <action>", []),
        ("px trace <trace-id>", ["`px trace` has no subcommand '<trace-id>'"]),
        ("px trace lst", ["`px trace` has no subcommand 'lst'"]),
        ("px trace list --limt 5", ["`px trace list` has no option --limt"]),
        ("px dataset get a b", ["`px dataset get` takes 1 positional arguments, got 2"]),
    ],
)
def test_problems(command_tree: dict[str, Any], command: str, expected: list[str]) -> None:
    found = problems(_px_invocations(_shell_tokens(command))[0], command_tree)
    assert [problem.split(";")[0] for problem in found] == expected


def test_known_broken_commands_exist() -> None:
    assert not set(KNOWN_BROKEN) - {shlex.join(command.arguments) for command in COMMANDS}


@pytest.mark.parametrize(
    "command",
    [
        pytest.param(
            command,
            id=command.where,
            marks=[pytest.mark.xfail(reason=KNOWN_BROKEN[text], strict=True)]
            if (text := shlex.join(command.arguments)) in KNOWN_BROKEN
            else [],
        )
        for command in COMMANDS
    ],
)
def test_command_matches_cli(command_tree: dict[str, Any], command: PxCommand) -> None:
    assert not problems(command.arguments, command_tree), shlex.join(command.arguments)
