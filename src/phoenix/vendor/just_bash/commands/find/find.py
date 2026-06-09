"""Find command implementation.

Usage: find [path...] [expression]

Search for files in a directory hierarchy.

Note: -user and -group predicates are not implemented as they are not
applicable in an in-memory virtual filesystem designed for sandboxed execution.

Options:
  -name PATTERN      match file name (shell glob)
  -iname PATTERN     like -name but case insensitive
  -type TYPE         file type (f=file, d=directory, l=symlink)
  -size N[cwbkMG]    file size (+ for greater, - for less)
  -mtime N           modification time in days (+ older, - newer)
  -newer FILE        newer than FILE
  -path PATTERN      match full path
  -regex PATTERN     match path with regex
  -maxdepth N        descend at most N levels
  -mindepth N        do not apply tests at levels less than N
  -empty             match empty files/directories
  -perm MODE         match permission bits

Actions:
  -print             print path (default)
  -print0            print path with null terminator
  -delete            delete matched files
  -exec CMD {} ;     execute command

Operators:
  -and, -a           logical AND (implicit)
  -or, -o            logical OR
  -not, !            logical NOT
  ( expr )           grouping
"""

import fnmatch
import re
import time
from dataclasses import dataclass
from typing import Any
from ...types import CommandContext, ExecResult


@dataclass
class Expression:
    """A find expression."""

    type: str  # "predicate", "and", "or", "not", "group"
    predicate: str = ""
    value: Any = None
    left: "Expression | None" = None
    right: "Expression | None" = None
    inner: "Expression | None" = None


class FindCommand:
    """The find command."""

    name = "find"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the find command."""
        paths: list[str] = []
        i = 0
        maxdepth = -1
        mindepth = 0

        # Parse paths (before first -option or !)
        while i < len(args):
            arg = args[i]
            if arg.startswith("-") or arg == "!" or arg == "(":
                break
            paths.append(arg)
            i += 1

        # Default to current directory
        if not paths:
            paths = ["."]

        # Parse depth options first
        j = i
        while j < len(args):
            if args[j] == "-maxdepth" and j + 1 < len(args):
                try:
                    maxdepth = int(args[j + 1])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"find: invalid argument '{args[j + 1]}' to '-maxdepth'\n",
                        exit_code=1,
                    )
            elif args[j] == "-mindepth" and j + 1 < len(args):
                try:
                    mindepth = int(args[j + 1])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"find: invalid argument '{args[j + 1]}' to '-mindepth'\n",
                        exit_code=1,
                    )
            j += 1

        # Parse expression
        expr_args = args[i:]
        # Remove depth options from expression parsing
        filtered_args = []
        j = 0
        while j < len(expr_args):
            if expr_args[j] in ("-maxdepth", "-mindepth"):
                j += 2
            else:
                filtered_args.append(expr_args[j])
                j += 1

        try:
            expr, action = self._parse_expression(filtered_args)
        except ValueError as e:
            return ExecResult(
                stdout="",
                stderr=f"find: {e}\n",
                exit_code=1,
            )

        # Default action is -print
        if action is None:
            action = ("print", None)

        # Execute find
        output = ""
        stderr = ""
        exit_code = 0

        for path in paths:
            try:
                resolved = ctx.fs.resolve_path(ctx.cwd, path)
                result, err = await self._find_recursive(
                    ctx, resolved, path, expr, action, 0, maxdepth, mindepth
                )
                output += result
                stderr += err
            except FileNotFoundError:
                stderr += f"find: '{path}': No such file or directory\n"
                exit_code = 1

        if exit_code == 0 and stderr:
            exit_code = 1

        return ExecResult(stdout=output, stderr=stderr, exit_code=exit_code)

    def _parse_expression(
        self, args: list[str]
    ) -> tuple[Expression | None, tuple[str, Any] | None]:
        """Parse find expression from arguments."""
        if not args:
            return None, None

        expr, pos, action = self._parse_or(args, 0)
        return expr, action

    def _parse_or(
        self, args: list[str], pos: int
    ) -> tuple[Expression | None, int, tuple[str, Any] | None]:
        """Parse OR expression."""
        left, pos, action = self._parse_and(args, pos)

        while pos < len(args) and args[pos] in ("-or", "-o"):
            pos += 1
            right, pos, act2 = self._parse_and(args, pos)
            if act2:
                action = act2
            left = Expression(type="or", left=left, right=right)

        return left, pos, action

    def _parse_and(
        self, args: list[str], pos: int
    ) -> tuple[Expression | None, int, tuple[str, Any] | None]:
        """Parse AND expression."""
        left, pos, action = self._parse_not(args, pos)

        while pos < len(args) and (args[pos] in ("-and", "-a") or (
            args[pos] not in ("-or", "-o", ")") and not args[pos].startswith("-print") and args[pos] != "-delete"
        )):
            if args[pos] in ("-and", "-a"):
                pos += 1
            right, pos, act2 = self._parse_not(args, pos)
            if act2:
                action = act2
            if right:
                left = Expression(type="and", left=left, right=right)

        return left, pos, action

    def _parse_not(
        self, args: list[str], pos: int
    ) -> tuple[Expression | None, int, tuple[str, Any] | None]:
        """Parse NOT expression."""
        if pos < len(args) and args[pos] in ("-not", "!"):
            pos += 1
            inner, pos, action = self._parse_primary(args, pos)
            return Expression(type="not", inner=inner), pos, action

        return self._parse_primary(args, pos)

    def _parse_primary(
        self, args: list[str], pos: int
    ) -> tuple[Expression | None, int, tuple[str, Any] | None]:
        """Parse primary expression."""
        if pos >= len(args):
            return None, pos, None

        action = None
        arg = args[pos]

        # Grouping
        if arg == "(":
            pos += 1
            expr, pos, action = self._parse_or(args, pos)
            if pos < len(args) and args[pos] == ")":
                pos += 1
            return Expression(type="group", inner=expr), pos, action

        # Actions
        if arg == "-print":
            pos += 1
            return None, pos, ("print", None)

        if arg == "-print0":
            pos += 1
            return None, pos, ("print0", None)

        if arg == "-delete":
            pos += 1
            return None, pos, ("delete", None)

        if arg == "-exec":
            # Find the terminator
            cmd_parts = []
            pos += 1
            while pos < len(args) and args[pos] not in (";", "+"):
                cmd_parts.append(args[pos])
                pos += 1
            if pos < len(args):
                pos += 1
            return None, pos, ("exec", cmd_parts)

        # Predicates
        if arg in ("-name", "-iname"):
            if pos + 1 >= len(args):
                raise ValueError(f"missing argument to '{arg}'")
            pattern = args[pos + 1]
            return (
                Expression(
                    type="predicate", predicate=arg[1:], value=pattern
                ),
                pos + 2,
                action,
            )

        if arg == "-type":
            if pos + 1 >= len(args):
                raise ValueError("missing argument to '-type'")
            type_val = args[pos + 1]
            return (
                Expression(type="predicate", predicate="type", value=type_val),
                pos + 2,
                action,
            )

        if arg == "-size":
            if pos + 1 >= len(args):
                raise ValueError("missing argument to '-size'")
            size_spec = args[pos + 1]
            return (
                Expression(type="predicate", predicate="size", value=size_spec),
                pos + 2,
                action,
            )

        if arg == "-mtime":
            if pos + 1 >= len(args):
                raise ValueError("missing argument to '-mtime'")
            mtime_val = args[pos + 1]
            return (
                Expression(type="predicate", predicate="mtime", value=mtime_val),
                pos + 2,
                action,
            )

        if arg == "-newer":
            if pos + 1 >= len(args):
                raise ValueError("missing argument to '-newer'")
            return (
                Expression(type="predicate", predicate="newer", value=args[pos + 1]),
                pos + 2,
                action,
            )

        if arg in ("-path", "-ipath"):
            if pos + 1 >= len(args):
                raise ValueError(f"missing argument to '{arg}'")
            return (
                Expression(type="predicate", predicate=arg[1:], value=args[pos + 1]),
                pos + 2,
                action,
            )

        if arg in ("-regex", "-iregex"):
            if pos + 1 >= len(args):
                raise ValueError(f"missing argument to '{arg}'")
            return (
                Expression(type="predicate", predicate=arg[1:], value=args[pos + 1]),
                pos + 2,
                action,
            )

        if arg == "-empty":
            return (
                Expression(type="predicate", predicate="empty"),
                pos + 1,
                action,
            )

        if arg == "-perm":
            if pos + 1 >= len(args):
                raise ValueError("missing argument to '-perm'")
            return (
                Expression(type="predicate", predicate="perm", value=args[pos + 1]),
                pos + 2,
                action,
            )

        if arg.startswith("-"):
            raise ValueError(f"unknown predicate '{arg}'")

        # Skip unknown args
        return None, pos + 1, action

    async def _find_recursive(
        self,
        ctx: CommandContext,
        abs_path: str,
        display_path: str,
        expr: Expression | None,
        action: tuple[str, Any],
        depth: int,
        maxdepth: int,
        mindepth: int,
    ) -> tuple[str, str]:
        """Recursively find files."""
        output = ""
        stderr = ""

        if maxdepth >= 0 and depth > maxdepth:
            return output, stderr

        try:
            stat = await ctx.fs.stat(abs_path)
        except FileNotFoundError:
            return output, f"find: '{display_path}': No such file or directory\n"

        # Check if expression matches (only at mindepth or deeper)
        if depth >= mindepth:
            matches = await self._evaluate(ctx, abs_path, display_path, stat, expr)

            if matches:
                act_name, act_val = action

                if act_name == "print":
                    output += display_path + "\n"
                elif act_name == "print0":
                    output += display_path + "\0"
                elif act_name == "delete":
                    try:
                        await ctx.fs.rm(abs_path, recursive=stat.is_directory)
                    except Exception as e:
                        stderr += f"find: cannot delete '{display_path}': {e}\n"
                elif act_name == "exec":
                    # Execute command with {} replaced by path
                    if act_val:
                        # Replace {} with the current path
                        cmd_parts = [p.replace("{}", abs_path) for p in act_val]
                        # Build command string
                        cmd_str = " ".join(cmd_parts)
                        # Execute via the context's exec function
                        try:
                            result = await ctx.exec(cmd_str, {"cwd": ctx.cwd})
                            output += result.stdout
                            stderr += result.stderr
                        except Exception as e:
                            stderr += f"find: -exec failed: {e}\n"

        # Recurse into directories
        if stat.is_directory and (maxdepth < 0 or depth < maxdepth):
            try:
                entries = await ctx.fs.readdir(abs_path)
                for entry in sorted(entries):
                    child_abs = abs_path.rstrip("/") + "/" + entry
                    child_display = display_path.rstrip("/") + "/" + entry
                    child_out, child_err = await self._find_recursive(
                        ctx, child_abs, child_display, expr, action, depth + 1, maxdepth, mindepth
                    )
                    output += child_out
                    stderr += child_err
            except Exception:
                pass

        return output, stderr

    async def _evaluate(
        self,
        ctx: CommandContext,
        abs_path: str,
        display_path: str,
        stat: Any,
        expr: Expression | None,
    ) -> bool:
        """Evaluate an expression against a file."""
        if expr is None:
            return True

        if expr.type == "and":
            left = await self._evaluate(ctx, abs_path, display_path, stat, expr.left)
            if not left:
                return False
            return await self._evaluate(ctx, abs_path, display_path, stat, expr.right)

        elif expr.type == "or":
            left = await self._evaluate(ctx, abs_path, display_path, stat, expr.left)
            if left:
                return True
            return await self._evaluate(ctx, abs_path, display_path, stat, expr.right)

        elif expr.type == "not":
            return not await self._evaluate(ctx, abs_path, display_path, stat, expr.inner)

        elif expr.type == "group":
            return await self._evaluate(ctx, abs_path, display_path, stat, expr.inner)

        elif expr.type == "predicate":
            return await self._evaluate_predicate(ctx, abs_path, display_path, stat, expr)

        return True

    async def _evaluate_predicate(
        self,
        ctx: CommandContext,
        abs_path: str,
        display_path: str,
        stat: dict,
        expr: Expression,
    ) -> bool:
        """Evaluate a single predicate."""
        pred = expr.predicate
        value = expr.value

        # Get basename for name matching
        basename = abs_path.rsplit("/", 1)[-1]

        if pred == "name":
            return fnmatch.fnmatch(basename, value)

        elif pred == "iname":
            return fnmatch.fnmatch(basename.lower(), value.lower())

        elif pred == "type":
            if value == "f":
                return stat.is_file
            elif value == "d":
                return stat.is_directory
            elif value == "l":
                return stat.is_symbolic_link
            return False

        elif pred == "size":
            return self._match_size(stat.size, value)

        elif pred == "mtime":
            now = time.time()
            days = (now - stat.mtime) / 86400
            return self._match_numeric(days, value)

        elif pred == "newer":
            try:
                ref_path = ctx.fs.resolve_path(ctx.cwd, value)
                ref_stat = await ctx.fs.stat(ref_path)
                return stat.mtime > ref_stat.mtime
            except FileNotFoundError:
                return False

        elif pred == "path":
            return fnmatch.fnmatch(display_path, value)

        elif pred == "ipath":
            return fnmatch.fnmatch(display_path.lower(), value.lower())

        elif pred == "regex":
            try:
                return bool(re.search(value, display_path))
            except re.error:
                return False

        elif pred == "iregex":
            try:
                return bool(re.search(value, display_path, re.IGNORECASE))
            except re.error:
                return False

        elif pred == "empty":
            if stat.is_directory:
                try:
                    entries = await ctx.fs.readdir(abs_path)
                    return len(entries) == 0
                except Exception:
                    return False
            else:
                return stat.size == 0

        elif pred == "perm":
            return self._match_perm(stat.mode, value)

        return True

    def _match_size(self, size: int, spec: str) -> bool:
        """Match file size against specification."""
        if not spec:
            return True

        # Parse +/- prefix
        compare = "eq"
        if spec[0] == "+":
            compare = "gt"
            spec = spec[1:]
        elif spec[0] == "-":
            compare = "lt"
            spec = spec[1:]

        # Parse unit suffix
        unit = 512  # default is 512-byte blocks
        if spec and spec[-1] in "cwbkMG":
            suffix = spec[-1]
            spec = spec[:-1]
            if suffix == "c":
                unit = 1
            elif suffix == "w":
                unit = 2
            elif suffix == "b":
                unit = 512
            elif suffix == "k":
                unit = 1024
            elif suffix == "M":
                unit = 1024 * 1024
            elif suffix == "G":
                unit = 1024 * 1024 * 1024

        try:
            n = int(spec)
        except ValueError:
            return True

        target = n * unit

        if compare == "eq":
            return size == target
        elif compare == "gt":
            return size > target
        elif compare == "lt":
            return size < target

        return True

    def _match_numeric(self, actual: float, spec: str) -> bool:
        """Match numeric value against +N/-N/N specification."""
        if not spec:
            return True

        compare = "eq"
        if spec[0] == "+":
            compare = "gt"
            spec = spec[1:]
        elif spec[0] == "-":
            compare = "lt"
            spec = spec[1:]

        try:
            n = int(spec)
        except ValueError:
            return True

        if compare == "eq":
            return int(actual) == n
        elif compare == "gt":
            return actual > n
        elif compare == "lt":
            return actual < n

        return True

    def _match_perm(self, mode: int, spec: str) -> bool:
        """Match permission mode."""
        if not spec:
            return True

        # Handle exact match
        exact = True
        if spec.startswith("-"):
            exact = False
            spec = spec[1:]
        elif spec.startswith("/"):
            # Any bit match
            exact = False
            spec = spec[1:]

        try:
            perm = int(spec, 8)
        except ValueError:
            return True

        if exact:
            return (mode & 0o7777) == perm
        else:
            return (mode & perm) == perm
