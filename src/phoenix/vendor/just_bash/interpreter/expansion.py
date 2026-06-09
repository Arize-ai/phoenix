"""Word Expansion System.

Handles shell word expansion including:
- Variable expansion ($VAR, ${VAR})
- Command substitution $(...)
- Arithmetic expansion $((...))
- Tilde expansion (~)
- Brace expansion {a,b,c}
- Glob expansion (*, ?, [...])
- Parameter operations (${VAR:-default}, ${VAR:+alt}, ${#VAR}, etc.)
"""

import fnmatch
import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Optional

from ..ast.types import (
    WordNode,
    WordPart,
    LiteralPart,
    SingleQuotedPart,
    DoubleQuotedPart,
    EscapedPart,
    ParameterExpansionPart,
    CommandSubstitutionPart,
    ArithmeticExpansionPart,
    TildeExpansionPart,
    GlobPart,
    BraceExpansionPart,
    ProcessSubstitutionPart,
)
from .errors import BadSubstitutionError, ExecutionLimitError, ExitError, NounsetError

if TYPE_CHECKING:
    from .types import InterpreterContext


@dataclass
class ExpandedSegment:
    """A segment of expanded text with quoting context."""
    text: str
    quoted: bool  # True = protected from IFS splitting and globbing


def _is_file_read_shorthand(body) -> bool:
    """Check if this is the $(< file) shorthand for reading file contents.

    Returns True if the body is a single command with no name/args and just
    a single '<' redirection.
    """
    from ..ast.types import ScriptNode, StatementNode, PipelineNode, SimpleCommandNode

    if not isinstance(body, ScriptNode) or len(body.statements) != 1:
        return False

    stmt = body.statements[0]
    if not isinstance(stmt, StatementNode) or len(stmt.pipelines) != 1:
        return False

    pipeline = stmt.pipelines[0]
    if not isinstance(pipeline, PipelineNode) or len(pipeline.commands) != 1:
        return False

    cmd = pipeline.commands[0]
    if not isinstance(cmd, SimpleCommandNode):
        return False

    # Check: no command name, no args, exactly one '<' redirection
    if cmd.name is not None or len(cmd.args) > 0:
        return False

    if len(cmd.redirections) != 1:
        return False

    redir = cmd.redirections[0]
    return redir.operator == '<' and redir.target is not None


async def _get_file_read_path(ctx: "InterpreterContext", body) -> Optional[str]:
    """Extract the file path from a $(< file) shorthand."""
    from ..ast.types import ScriptNode

    if not isinstance(body, ScriptNode):
        return None

    stmt = body.statements[0]
    pipeline = stmt.pipelines[0]
    cmd = pipeline.commands[0]
    redir = cmd.redirections[0]

    # Expand the target path
    return await expand_word_async(ctx, redir.target)


def get_variable(ctx: "InterpreterContext", name: str, check_nounset: bool = True) -> str:
    """Get a variable value from the environment.

    Handles special parameters like $?, $#, $@, $*, $0-$9, etc.
    Also handles array subscript syntax: arr[idx], arr[@], arr[*]
    """
    env = ctx.state.env

    # Resolve nameref for regular variable names (not special params or array subscripts)
    from .types import VariableStore
    if (isinstance(env, VariableStore)
            and re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', name)
            and env.is_nameref(name)):
        try:
            name = env.resolve_nameref(name)
        except ValueError:
            return ""

    # Check for array subscript syntax: name[subscript]
    array_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[(.+)\]$', name)
    if array_match:
        arr_name = array_match.group(1)
        subscript = array_match.group(2)

        # Resolve nameref for array base name
        if isinstance(env, VariableStore) and env.is_nameref(arr_name):
            try:
                arr_name = env.resolve_nameref(arr_name)
            except ValueError:
                return ""

        # Handle arr[@] and arr[*] - all elements
        if subscript in ("@", "*"):
            elements = get_array_elements(ctx, arr_name)
            if subscript == "*":
                # $* / ${arr[*]} joins with first char of IFS
                ifs = env.get("IFS", " \t\n")
                sep = ifs[0] if ifs else ""
                return sep.join(val for _, val in elements)
            return " ".join(val for _, val in elements)

        # Check if this is an associative array
        is_assoc = env.get(f"{arr_name}__is_array") == "assoc"
        if is_assoc:
            # For associative arrays, expand the subscript first, then use as string key
            # First expand any $VAR references
            expanded_subscript = _expand_subscript_vars(ctx, subscript)
            lookup_key = expanded_subscript
            # Strip surrounding quotes from the key
            if (lookup_key.startswith('"') and lookup_key.endswith('"')) or \
               (lookup_key.startswith("'") and lookup_key.endswith("'")):
                lookup_key = lookup_key[1:-1]
            key = f"{arr_name}_{lookup_key}"
            if key in env:
                return env[key]
            elif check_nounset and ctx.state.options.nounset:
                raise NounsetError(name)
            return ""

        # Handle numeric or variable subscript for indexed arrays
        try:
            # Try to evaluate subscript as arithmetic expression
            idx = _eval_array_subscript(ctx, subscript)
            # Negative indices count from end
            if idx < 0:
                elements = get_array_elements(ctx, arr_name)
                if elements:
                    max_idx = max(i for i, _ in elements)
                    idx = max_idx + 1 + idx
            key = f"{arr_name}_{idx}"
            if key in env:
                return env[key]
            elif check_nounset and ctx.state.options.nounset:
                raise NounsetError(name)
            return ""
        except (ValueError, TypeError):
            # Invalid subscript - return empty
            return ""

    # Special parameters
    if name == "?":
        return str(ctx.state.last_exit_code)
    elif name == "#":
        # Number of positional parameters
        count = 0
        while str(count + 1) in env:
            count += 1
        return str(count)
    elif name == "@":
        # All positional parameters (space-separated for unquoted)
        params = []
        i = 1
        while str(i) in env:
            params.append(env[str(i)])
            i += 1
        return " ".join(params)
    elif name == "*":
        # All positional parameters (joined with first char of IFS)
        params = []
        i = 1
        while str(i) in env:
            params.append(env[str(i)])
            i += 1
        ifs = env.get("IFS", " \t\n")
        sep = ifs[0] if ifs else ""
        return sep.join(params)
    elif name == "0":
        return env.get("0", "bash")
    elif name == "$":
        return str(env.get("$", "1"))  # PID (simulated)
    elif name == "!":
        return str(ctx.state.last_background_pid)
    elif name == "-":
        # Shell option flags string
        flags = ""
        opts = ctx.state.options
        if opts.errexit:
            flags += "e"
        # 'h' = hashall (always on in non-interactive bash)
        flags += "h"
        if getattr(opts, 'noglob', False):
            flags += "f"
        if opts.nounset:
            flags += "u"
        if opts.verbose:
            flags += "v"
        if opts.xtrace:
            flags += "x"
        # 'B' = braceexpand (always on by default)
        if not getattr(opts, 'nobraceexpand', False):
            flags += "B"
        if getattr(opts, 'noclobber', False):
            flags += "C"
        # 'H' = histexpand (default on for interactive)
        # 's' = reading from stdin (always on for our use case)
        flags += "s"
        return flags
    elif name == "_":
        return ctx.state.last_arg
    elif name == "LINENO":
        return str(ctx.state.current_line or 1)
    elif name == "RANDOM":
        import random as _random
        # Check if RANDOM has been assigned (seed value)
        seed_val = env.get("RANDOM")
        if seed_val is not None:
            try:
                seed = int(seed_val)
                ctx.state.random_generator = _random.Random(seed)
            except ValueError:
                pass
            # Remove seed from env so it doesn't re-seed on next read
            del env["RANDOM"]
        # Use seeded generator if available, else global random
        if ctx.state.random_generator is not None:
            return str(ctx.state.random_generator.randint(0, 32767))
        return str(_random.randint(0, 32767))
    elif name == "SECONDS":
        import time
        # Check if SECONDS was reset (seconds_reset_time is set)
        if hasattr(ctx.state, 'seconds_reset_time') and ctx.state.seconds_reset_time is not None:
            return str(int(time.time() - ctx.state.seconds_reset_time))
        return str(int(time.time() - ctx.state.start_time))
    elif name == "SHELLOPTS":
        # Compute colon-separated list of enabled set -o options (alphabetical)
        opts = ctx.state.options
        enabled = []
        if not getattr(opts, 'nobraceexpand', False):
            enabled.append("braceexpand")
        if opts.errexit:
            enabled.append("errexit")
        enabled.append("hashall")  # always on
        enabled.append("interactive-comments")  # always on
        if getattr(opts, 'noclobber', False):
            enabled.append("noclobber")
        if getattr(opts, 'noglob', False):
            enabled.append("noglob")
        if opts.nounset:
            enabled.append("nounset")
        if opts.pipefail:
            enabled.append("pipefail")
        if opts.verbose:
            enabled.append("verbose")
        if opts.xtrace:
            enabled.append("xtrace")
        return ":".join(enabled)
    elif name == "BASHOPTS":
        from .builtins.shopt import _get_shopts
        shopts = _get_shopts(ctx)
        enabled = sorted(n for n, v in shopts.items() if v)
        return ":".join(enabled)
    elif name == "SHLVL":
        return env.get("SHLVL", "1")
    elif name == "BASH_VERSION":
        return env.get("BASH_VERSION", "5.0.0(1)-release")
    elif name == "BASH_VERSINFO":
        return env.get("BASH_VERSINFO", "5")
    elif name == "OSTYPE":
        return env.get("OSTYPE", "linux-gnu")
    elif name == "MACHTYPE":
        return env.get("MACHTYPE", "x86_64-pc-linux-gnu")
    elif name == "HOSTNAME":
        return env.get("HOSTNAME", "localhost")
    elif name == "BASHPID":
        return str(env.get("$", "1"))
    elif name == "UID":
        return env.get("UID", "1000")
    elif name == "EUID":
        return env.get("EUID", "1000")
    elif name == "PPID":
        return env.get("PPID", "1")

    # Regular variable
    value = env.get(name)

    if value is None:
        # Check if this is an array name without subscript - return element 0
        if re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', name) and f"{name}__is_array" in env:
            return env.get(f"{name}_0", "")
        # Check nounset (set -u)
        if check_nounset and ctx.state.options.nounset:
            raise NounsetError(name, "", f"bash: {name}: unbound variable\n")
        return ""

    return value


def get_array_elements(ctx: "InterpreterContext", name: str) -> list[tuple[int, str]]:
    """Get all elements of an array as (index, value) pairs.

    For associative arrays, the index is a synthetic sequential number.
    Use get_array_keys() for the actual keys.
    """
    # Resolve nameref if applicable
    from .types import VariableStore
    env = ctx.state.env
    if isinstance(env, VariableStore) and env.is_nameref(name):
        try:
            name = env.resolve_nameref(name)
        except ValueError:
            return []

    elements = []
    is_assoc = env.get(f"{name}__is_array") == "assoc"

    # Look for name_KEY entries
    prefix = f"{name}_"
    for key, value in env.items():
        if key.startswith(prefix) and not key.startswith(f"{name}__"):
            idx_part = key[len(prefix):]
            if is_assoc:
                # For assoc arrays, use synthetic index
                elements.append((len(elements), value))
            else:
                try:
                    idx = int(idx_part)
                    elements.append((idx, value))
                except ValueError:
                    # Non-numeric key in indexed array context - skip
                    pass

    # Sort by index for indexed arrays
    if not is_assoc:
        elements.sort(key=lambda x: x[0])
    return elements


def get_array_elements_assoc(ctx: "InterpreterContext", name: str) -> list[tuple[str, str]]:
    """Get all elements of an associative array as (key, value) pairs."""
    # Resolve nameref if applicable
    from .types import VariableStore
    env = ctx.state.env
    if isinstance(env, VariableStore) and env.is_nameref(name):
        try:
            name = env.resolve_nameref(name)
        except ValueError:
            return []

    elements = []
    prefix = f"{name}_"
    for key, value in env.items():
        if key.startswith(prefix) and not key.startswith(f"{name}__"):
            idx_part = key[len(prefix):]
            elements.append((idx_part, value))
    return elements


def is_array(ctx: "InterpreterContext", name: str) -> bool:
    """Check if a variable is an array."""
    prefix = f"{name}_"
    for key in ctx.state.env:
        if key.startswith(prefix) and not key.endswith("__length"):
            return True
    return False


def _eval_array_subscript(ctx: "InterpreterContext", subscript: str) -> int:
    """Evaluate an array subscript to an integer index.

    Supports:
    - Literal integers: arr[0], arr[42]
    - Variable references: arr[i], arr[idx], arr[$i]
    - Simple arithmetic: arr[i+1], arr[n-1]
    - Assignments with side effects: arr[b=2] assigns 2 to b and uses 2 as index
    """
    subscript = subscript.strip()

    # First, expand any $VAR references in the subscript
    expanded = _expand_subscript_vars(ctx, subscript)

    # Try direct integer
    try:
        return int(expanded)
    except ValueError:
        pass

    # Try variable reference (bare name without $)
    if re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', expanded):
        val = ctx.state.env.get(expanded, "0")
        try:
            return int(val)
        except ValueError:
            return 0

    # Use proper arithmetic expression evaluator which handles assignments
    try:
        from ..parser.parser import Parser
        parser = Parser()
        arith_expr = parser._parse_arith_comma(expanded)
        return evaluate_arithmetic_sync(ctx, arith_expr)
    except Exception:
        pass

    # Fallback: Try arithmetic expression with variable expansion
    arith_expanded = _expand_arith_vars(ctx, expanded)
    try:
        # Use Python eval with restricted builtins for safety
        result = eval(arith_expanded, {"__builtins__": {}}, {})
        return int(result)
    except Exception:
        return 0


def _expand_braced_param_sync(ctx: "InterpreterContext", content: str) -> str:
    """Expand ${content} as a full parameter expansion (sync).

    Handles operations like ${var:-default}, ${var:+alt}, ${#var},
    ${var#pattern}, etc. inside arithmetic expressions.
    """
    # Try parsing through the parser's parameter expansion handler
    try:
        from ..parser.parser import Parser
        parser = Parser()
        part = parser._parse_parameter_expansion(content)
        return expand_parameter(ctx, part, False)
    except Exception:
        pass

    # Fallback: simple variable lookup
    return get_variable(ctx, content, False)


def _expand_arith_vars(ctx: "InterpreterContext", expr: str) -> str:
    """Expand bare variable names in arithmetic expression."""
    # Replace variable names with their values
    result = []
    i = 0
    while i < len(expr):
        # Check for variable name (not preceded by digit)
        if (expr[i].isalpha() or expr[i] == '_'):
            j = i
            while j < len(expr) and (expr[j].isalnum() or expr[j] == '_'):
                j += 1
            var_name = expr[i:j]
            # Check for array subscript notation: name[subscript]
            if j < len(expr) and expr[j] == '[':
                bracket_end = j + 1
                bracket_depth = 1
                while bracket_end < len(expr) and bracket_depth > 0:
                    if expr[bracket_end] == '[':
                        bracket_depth += 1
                    elif expr[bracket_end] == ']':
                        bracket_depth -= 1
                    bracket_end += 1
                if bracket_depth == 0:
                    # Get the subscript content and evaluate it
                    subscript = expr[j + 1:bracket_end - 1]
                    idx = _eval_array_subscript(ctx, subscript)
                    # Handle negative index
                    if idx < 0:
                        elements = get_array_elements(ctx, var_name)
                        if elements:
                            max_idx = max(elem_i for elem_i, _ in elements)
                            idx = max_idx + 1 + idx
                    # Get the array element value
                    val = ctx.state.env.get(f"{var_name}_{idx}", "0")
                    try:
                        result.append(str(int(val)))
                    except ValueError:
                        result.append("0")
                    i = bracket_end
                    continue
            # Regular variable
            val = ctx.state.env.get(var_name, "0")
            try:
                result.append(str(int(val)))
            except ValueError:
                result.append("0")
            i = j
        else:
            result.append(expr[i])
            i += 1
    return ''.join(result)


def _expand_subscript_vars(ctx: "InterpreterContext", subscript: str) -> str:
    """Expand $VAR, ${VAR}, ${arr[idx]}, and $(cmd) references in array subscript."""
    result = []
    i = 0
    while i < len(subscript):
        if subscript[i] == '$':
            if i + 1 < len(subscript):
                if subscript[i + 1] == '(':
                    # $(command) substitution - find matching )
                    paren_depth = 1
                    j = i + 2
                    while j < len(subscript) and paren_depth > 0:
                        if subscript[j] == '(':
                            paren_depth += 1
                        elif subscript[j] == ')':
                            paren_depth -= 1
                        j += 1
                    if paren_depth == 0:
                        cmd_content = subscript[i + 2:j - 1]
                        # Execute command substitution
                        import asyncio
                        try:
                            import nest_asyncio
                            nest_asyncio.apply()
                        except Exception:
                            pass
                        # Parse and execute the command
                        from ..parser.parser import Parser
                        try:
                            parser = Parser()
                            script_node = parser.parse(cmd_content)

                            async def run_cmd():
                                exec_result = await ctx.execute_script(script_node)
                                return exec_result.stdout.rstrip('\n')

                            try:
                                loop = asyncio.get_event_loop()
                            except RuntimeError:
                                loop = asyncio.new_event_loop()
                                asyncio.set_event_loop(loop)
                            if loop.is_running():
                                # Create a new task in the running loop
                                import concurrent.futures
                                with concurrent.futures.ThreadPoolExecutor() as pool:
                                    future = pool.submit(asyncio.run, run_cmd())
                                    val = future.result()
                            else:
                                val = loop.run_until_complete(run_cmd())
                        except Exception:
                            val = "0"
                        result.append(val)
                        i = j
                        continue
                elif subscript[i + 1] == '{':
                    # ${VAR} or ${arr[idx]} syntax - find matching }
                    bracket_depth = 0
                    j = i + 2
                    while j < len(subscript):
                        if subscript[j] == '{':
                            bracket_depth += 1
                        elif subscript[j] == '}':
                            if bracket_depth == 0:
                                break
                            bracket_depth -= 1
                        j += 1
                    if j < len(subscript):
                        content = subscript[i + 2:j]
                        # Check for array subscript: arr[idx]
                        arr_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[(.+)\]$', content)
                        if arr_match:
                            arr_name = arr_match.group(1)
                            arr_subscript = arr_match.group(2)
                            # Recursively expand the subscript
                            expanded_subscript = _expand_subscript_vars(ctx, arr_subscript)
                            idx = _eval_array_subscript(ctx, expanded_subscript)
                            # Handle negative index
                            if idx < 0:
                                elements = get_array_elements(ctx, arr_name)
                                if elements:
                                    max_idx = max(elem_i for elem_i, _ in elements)
                                    idx = max_idx + 1 + idx
                            val = ctx.state.env.get(f"{arr_name}_{idx}", "0")
                        else:
                            val = ctx.state.env.get(content, "0")
                        result.append(val)
                        i = j + 1
                        continue
                elif subscript[i + 1].isalpha() or subscript[i + 1] == '_':
                    # $VAR syntax
                    j = i + 1
                    while j < len(subscript) and (subscript[j].isalnum() or subscript[j] == '_'):
                        j += 1
                    var_name = subscript[i + 1:j]
                    val = ctx.state.env.get(var_name, "0")
                    result.append(val)
                    i = j
                    continue
        result.append(subscript[i])
        i += 1
    return ''.join(result)


def get_array_keys(ctx: "InterpreterContext", name: str) -> list[str]:
    """Get all keys of an array (indices for indexed arrays, keys for associative)."""
    # Resolve nameref if applicable
    from .types import VariableStore
    env = ctx.state.env
    if isinstance(env, VariableStore) and env.is_nameref(name):
        try:
            name = env.resolve_nameref(name)
        except ValueError:
            return []

    keys = []
    prefix = f"{name}_"

    for key in env:
        if key.startswith(prefix) and not key.startswith(f"{name}__"):
            idx_part = key[len(prefix):]
            keys.append(idx_part)

    # Sort numerically if all indices are numbers
    try:
        keys.sort(key=int)
    except ValueError:
        keys.sort()

    return keys


def expand_tilde_in_assignment_value(ctx: "InterpreterContext", value: str) -> str:
    """Expand tilde at start and after : in assignment values.

    Used by declaration builtins (local, readonly, export, declare) to expand
    tilde in assignment values like 'foo:~' → 'foo:/home/user'.
    """
    if "~" not in value:
        return value
    home = ctx.state.env.get("HOME", "/home/user")

    def _expand_tilde_prefix(s: str) -> str:
        """Expand tilde at the start of a string segment."""
        if not s.startswith("~"):
            return s
        # Find end of tilde prefix (username or empty)
        j = 1
        while j < len(s) and s[j] not in "/:" and (s[j].isalnum() or s[j] == "_"):
            j += 1
        # Check terminator: must be /, :, or end
        if j < len(s) and s[j] not in "/:":
            return s  # Not a valid tilde expansion
        user = s[1:j]
        if not user:
            return home + s[j:]
        elif user == "+":
            return ctx.state.env.get("PWD", ctx.state.cwd) + s[j:]
        elif user == "-":
            return ctx.state.env.get("OLDPWD", "") + s[j:]
        return s  # Unknown user, keep literal

    # Split on : to handle tilde after each colon
    parts = value.split(":")
    parts[0] = _expand_tilde_prefix(parts[0])
    for i in range(1, len(parts)):
        parts[i] = _expand_tilde_prefix(parts[i])
    return ":".join(parts)


def expand_word(ctx: "InterpreterContext", word: WordNode) -> str:
    """Expand a word synchronously (no command substitution)."""
    parts = []
    for part in word.parts:
        parts.append(expand_part_sync(ctx, part))
    return "".join(parts)


async def expand_word_async(ctx: "InterpreterContext", word: WordNode) -> str:
    """Expand a word asynchronously (supports command substitution)."""
    parts = []
    for part in word.parts:
        parts.append(await expand_part(ctx, part))
    return "".join(parts)


def expand_word_for_pattern(ctx: "InterpreterContext", word: WordNode) -> str:
    """Expand a word for use as a glob pattern (sync).

    Glob metacharacters from quoted sources are escaped with backslash so they
    match literally, while unquoted glob chars remain active.
    """
    parts = []
    for part in word.parts:
        parts.append(_expand_part_for_pattern_sync(ctx, part))
    return "".join(parts)


def _expand_part_for_pattern_sync(
    ctx: "InterpreterContext", part: "WordPart", in_double_quotes: bool = False
) -> str:
    """Expand a word part for pattern matching (sync).

    Quoted parts have glob metacharacters escaped with backslash.
    """
    if isinstance(part, LiteralPart):
        # Unquoted literal - glob chars remain active
        return part.value
    elif isinstance(part, SingleQuotedPart):
        # Single-quoted - all glob chars escaped with backslash
        return _escape_glob_for_pattern(part.value)
    elif isinstance(part, EscapedPart):
        # Escaped char - literal
        return _escape_glob_for_pattern(part.value)
    elif isinstance(part, DoubleQuotedPart):
        # Double-quoted - glob chars escaped, but expansions still happen
        result = []
        for p in part.parts:
            expanded = _expand_part_for_pattern_sync(ctx, p, in_double_quotes=True)
            if isinstance(p, (LiteralPart, EscapedPart)):
                # Literal text inside double quotes is protected
                expanded = _escape_glob_for_pattern(expanded)
            elif isinstance(p, ParameterExpansionPart):
                # Parameter expansion result inside double quotes is protected
                expanded = _escape_glob_for_pattern(expanded)
            result.append(expanded)
        return "".join(result)
    elif isinstance(part, GlobPart):
        # Unquoted glob - stays active
        return part.pattern
    elif isinstance(part, ParameterExpansionPart):
        # Unquoted parameter expansion - glob chars stay active
        return expand_part_sync(ctx, part, in_double_quotes)
    else:
        # All other parts: delegate to normal expansion
        return expand_part_sync(ctx, part, in_double_quotes)


def _escape_glob_for_pattern(s: str) -> str:
    """Escape glob metacharacters with backslash for pattern matching.

    Also escapes backslash itself to prevent glob_to_regex from treating
    it as an escape character.
    """
    result = []
    for c in s:
        if c in '*?[\\':
            result.append('\\')
            result.append(c)
        else:
            result.append(c)
    return ''.join(result)


def _escape_glob_chars(s: str) -> str:
    """Escape glob metacharacters for fnmatch (literal matching).

    Uses [x] notation which fnmatch always treats as literal character class.
    Also escapes parens to prevent extglob pattern misdetection.
    """
    return (s.replace("[", "[[]").replace("*", "[*]").replace("?", "[?]")
            .replace("(", "[(]").replace(")", "[)]"))


async def expand_word_for_case_pattern(ctx: "InterpreterContext", word: WordNode) -> str:
    """Expand a word for use as a case pattern.

    Glob metacharacters from quoted sources are escaped so they match
    literally, while unquoted glob chars remain active.
    """
    parts = []
    for part in word.parts:
        parts.append(await _expand_part_for_pattern(ctx, part))
    return "".join(parts)


async def _expand_part_for_pattern(
    ctx: "InterpreterContext", part: WordPart, in_double_quotes: bool = False
) -> str:
    """Expand a word part for case pattern matching.

    Quoted parts have glob metacharacters escaped.
    """
    if isinstance(part, LiteralPart):
        # Unquoted literal - glob chars remain active
        return part.value
    elif isinstance(part, SingleQuotedPart):
        # Single-quoted - all glob chars escaped
        return _escape_glob_chars(part.value)
    elif isinstance(part, EscapedPart):
        # Escaped char - literal
        return _escape_glob_chars(part.value)
    elif isinstance(part, DoubleQuotedPart):
        # Double-quoted - glob chars escaped, but expansions still happen
        result = []
        for p in part.parts:
            expanded = await _expand_part_for_pattern(ctx, p, in_double_quotes=True)
            if isinstance(p, (LiteralPart, EscapedPart)):
                # Literal text inside double quotes is protected
                expanded = _escape_glob_chars(expanded)
            elif isinstance(p, ParameterExpansionPart):
                # Parameter expansion result inside double quotes is protected
                expanded = _escape_glob_chars(expanded)
            result.append(expanded)
        return "".join(result)
    elif isinstance(part, GlobPart):
        # Unquoted glob - stays active
        return part.pattern
    elif isinstance(part, ParameterExpansionPart):
        # Unquoted parameter expansion - glob chars stay active
        return await expand_parameter_async(ctx, part, in_double_quotes)
    else:
        # All other parts: delegate to normal expansion
        return await expand_part(ctx, part, in_double_quotes)


def expand_part_sync(ctx: "InterpreterContext", part: WordPart, in_double_quotes: bool = False) -> str:
    """Expand a word part synchronously."""
    if isinstance(part, LiteralPart):
        return part.value
    elif isinstance(part, SingleQuotedPart):
        return part.value
    elif isinstance(part, EscapedPart):
        return part.value
    elif isinstance(part, DoubleQuotedPart):
        # Recursively expand parts inside double quotes
        result = []
        for p in part.parts:
            result.append(expand_part_sync(ctx, p, in_double_quotes=True))
        return "".join(result)
    elif isinstance(part, ParameterExpansionPart):
        return expand_parameter(ctx, part, in_double_quotes)
    elif isinstance(part, TildeExpansionPart):
        if in_double_quotes:
            # Tilde is literal inside double quotes
            return "~" if part.user is None else f"~{part.user}"
        if part.user is None:
            return ctx.state.env.get("HOME", "/home/user")
        elif part.user == "+":
            return ctx.state.env.get("PWD", ctx.state.cwd)
        elif part.user == "-":
            return ctx.state.env.get("OLDPWD", "")
        elif part.user == "root":
            return "/root"
        else:
            return f"~{part.user}"
    elif isinstance(part, GlobPart):
        return part.pattern
    elif isinstance(part, ArithmeticExpansionPart):
        # Evaluate arithmetic synchronously
        # Unwrap ArithmeticExpressionNode to get the actual ArithExpr
        expr = part.expression.expression if part.expression else None
        try:
            return str(evaluate_arithmetic_sync(ctx, expr))
        except (ValueError, ZeroDivisionError) as e:
            raise ExitError(1, "", f"bash: {e}\n")
    elif isinstance(part, BraceExpansionPart):
        # Expand brace items
        results = []
        for item in part.items:
            if item.type == "Range":
                expanded = expand_brace_range(item.start, item.end, item.step)
                results.extend(expanded)
            else:
                results.append(expand_word(ctx, item.word))
        return " ".join(results)
    elif isinstance(part, CommandSubstitutionPart):
        # Command substitution requires async
        raise RuntimeError("Command substitution requires async expansion")
    elif isinstance(part, ProcessSubstitutionPart):
        # Process substitution requires async
        raise RuntimeError("Process substitution requires async expansion")
    else:
        return ""


async def expand_part(ctx: "InterpreterContext", part: WordPart, in_double_quotes: bool = False) -> str:
    """Expand a word part asynchronously."""
    if isinstance(part, LiteralPart):
        return part.value
    elif isinstance(part, SingleQuotedPart):
        return part.value
    elif isinstance(part, EscapedPart):
        return part.value
    elif isinstance(part, DoubleQuotedPart):
        result = []
        for p in part.parts:
            result.append(await expand_part(ctx, p, in_double_quotes=True))
        return "".join(result)
    elif isinstance(part, ParameterExpansionPart):
        return await expand_parameter_async(ctx, part, in_double_quotes)
    elif isinstance(part, TildeExpansionPart):
        if in_double_quotes:
            return "~" if part.user is None else f"~{part.user}"
        if part.user is None:
            return ctx.state.env.get("HOME", "/home/user")
        elif part.user == "+":
            return ctx.state.env.get("PWD", ctx.state.cwd)
        elif part.user == "-":
            return ctx.state.env.get("OLDPWD", "")
        elif part.user == "root":
            return "/root"
        else:
            return f"~{part.user}"
    elif isinstance(part, GlobPart):
        return part.pattern
    elif isinstance(part, ArithmeticExpansionPart):
        # Unwrap ArithmeticExpressionNode to get the actual ArithExpr
        expr = part.expression.expression if part.expression else None
        try:
            return str(await evaluate_arithmetic(ctx, expr))
        except (ValueError, ZeroDivisionError) as e:
            raise ExitError(1, "", f"bash: {e}\n")
    elif isinstance(part, BraceExpansionPart):
        results = []
        for item in part.items:
            if item.type == "Range":
                expanded = expand_brace_range(item.start, item.end, item.step)
                results.extend(expanded)
            else:
                results.append(await expand_word_async(ctx, item.word))
        return " ".join(results)
    elif isinstance(part, CommandSubstitutionPart):
        # Check for $(< file) shorthand - read file directly
        if _is_file_read_shorthand(part.body):
            try:
                file_path = await _get_file_read_path(ctx, part.body)
                if file_path:
                    resolved = ctx.fs.resolve_path(ctx.state.cwd, file_path)
                    content = await ctx.fs.read_file(resolved)
                    ctx.state.last_exit_code = 0
                    ctx.state.env["?"] = "0"
                    ctx.state.expansion_exit_code = 0
                    return content.rstrip("\n")
            except Exception:
                ctx.state.last_exit_code = 1
                ctx.state.env["?"] = "1"
                ctx.state.expansion_exit_code = 1
                return ""
        # Execute the command substitution
        try:
            result = await ctx.execute_script(part.body)
            ctx.state.last_exit_code = result.exit_code
            ctx.state.env["?"] = str(result.exit_code)
            ctx.state.expansion_exit_code = result.exit_code
            # Remove trailing newlines
            return result.stdout.rstrip("\n")
        except ExecutionLimitError:
            raise
        except ExitError as e:
            ctx.state.last_exit_code = e.exit_code
            ctx.state.env["?"] = str(e.exit_code)
            ctx.state.expansion_exit_code = e.exit_code
            return e.stdout.rstrip("\n")
    elif isinstance(part, ProcessSubstitutionPart):
        # Execute the subcommand and write its output to a temp file
        if part.body:
            import hashlib
            result = await ctx.execute_script(part.body)
            tmp_name = f"/tmp/proc_sub_{hashlib.md5(result.stdout.encode()).hexdigest()[:8]}"
            await ctx.fs.write_file(tmp_name, result.stdout)
            return tmp_name
        return "/dev/null"
    else:
        return ""


async def expand_word_segments(
    ctx: "InterpreterContext", word: WordNode, in_double_quotes: bool = False
) -> list[ExpandedSegment]:
    """Expand a word into a list of segments preserving quoting context.

    Each segment carries its text and whether it was quoted (protected from
    IFS splitting and globbing).

    Parameters:
    - in_double_quotes: If True, suppress tilde expansion (tilde should be literal).
    """
    segments: list[ExpandedSegment] = []
    for part in word.parts:
        segments.extend(await _expand_part_segments(ctx, part, in_double_quotes=in_double_quotes))
    return segments


async def _expand_part_segments(
    ctx: "InterpreterContext", part: WordPart, in_double_quotes: bool = False
) -> list[ExpandedSegment]:
    """Expand a single part into segments preserving quoting context."""
    if isinstance(part, LiteralPart):
        return [ExpandedSegment(text=part.value, quoted=in_double_quotes)]

    elif isinstance(part, SingleQuotedPart):
        return [ExpandedSegment(text=part.value, quoted=True)]

    elif isinstance(part, EscapedPart):
        return [ExpandedSegment(text=part.value, quoted=True)]

    elif isinstance(part, DoubleQuotedPart):
        segments: list[ExpandedSegment] = []
        for p in part.parts:
            segments.extend(
                await _expand_part_segments(ctx, p, in_double_quotes=True)
            )
        return segments

    elif isinstance(part, ParameterExpansionPart):
        # Use segment-based expansion to preserve quoting in default/alternate values
        return await expand_parameter_segments_async(ctx, part, in_double_quotes)

    elif isinstance(part, TildeExpansionPart):
        if in_double_quotes:
            text = "~" if part.user is None else f"~{part.user}"
            return [ExpandedSegment(text=text, quoted=True)]
        if part.user is None:
            text = ctx.state.env.get("HOME", "/home/user")
        elif part.user == "+":
            text = ctx.state.env.get("PWD", ctx.state.cwd)
        elif part.user == "-":
            text = ctx.state.env.get("OLDPWD", "")
        elif part.user == "root":
            text = "/root"
        else:
            text = f"~{part.user}"
        # Tilde expansion result is not subject to further splitting
        return [ExpandedSegment(text=text, quoted=True)]

    elif isinstance(part, GlobPart):
        return [ExpandedSegment(text=part.pattern, quoted=False)]

    elif isinstance(part, ArithmeticExpansionPart):
        expr = part.expression.expression if part.expression else None
        try:
            text = str(await evaluate_arithmetic(ctx, expr))
        except (ValueError, ZeroDivisionError) as e:
            raise ExitError(1, "", f"bash: {e}\n")
        return [ExpandedSegment(text=text, quoted=in_double_quotes)]

    elif isinstance(part, BraceExpansionPart):
        results = []
        for item in part.items:
            if item.type == "Range":
                expanded = expand_brace_range(item.start, item.end, item.step)
                results.extend(expanded)
            else:
                results.append(await expand_word_async(ctx, item.word))
        return [ExpandedSegment(text=" ".join(results), quoted=in_double_quotes)]

    elif isinstance(part, CommandSubstitutionPart):
        # Check for $(< file) shorthand - read file directly
        if _is_file_read_shorthand(part.body):
            try:
                file_path = await _get_file_read_path(ctx, part.body)
                if file_path:
                    resolved = ctx.fs.resolve_path(ctx.state.cwd, file_path)
                    content = await ctx.fs.read_file(resolved)
                    ctx.state.last_exit_code = 0
                    ctx.state.env["?"] = "0"
                    ctx.state.expansion_exit_code = 0
                    return [ExpandedSegment(text=content.rstrip("\n"), quoted=in_double_quotes)]
            except Exception:
                ctx.state.last_exit_code = 1
                ctx.state.env["?"] = "1"
                ctx.state.expansion_exit_code = 1
                return [ExpandedSegment(text="", quoted=in_double_quotes)]
        try:
            result = await ctx.execute_script(part.body)
            ctx.state.last_exit_code = result.exit_code
            ctx.state.env["?"] = str(result.exit_code)
            ctx.state.expansion_exit_code = result.exit_code
            text = result.stdout.rstrip("\n")
        except ExecutionLimitError:
            raise
        except ExitError as e:
            ctx.state.last_exit_code = e.exit_code
            ctx.state.env["?"] = str(e.exit_code)
            ctx.state.expansion_exit_code = e.exit_code
            text = e.stdout.rstrip("\n")
        return [ExpandedSegment(text=text, quoted=in_double_quotes)]

    elif isinstance(part, ProcessSubstitutionPart):
        if part.body:
            import hashlib
            result = await ctx.execute_script(part.body)
            tmp_name = f"/tmp/proc_sub_{hashlib.md5(result.stdout.encode()).hexdigest()[:8]}"
            await ctx.fs.write_file(tmp_name, result.stdout)
            text = tmp_name
        else:
            text = "/dev/null"
        return [ExpandedSegment(text=text, quoted=True)]

    return [ExpandedSegment(text="", quoted=in_double_quotes)]


def _segments_to_string(segments: list[ExpandedSegment]) -> str:
    """Flatten segments into a single string."""
    return "".join(seg.text for seg in segments)


def _segments_to_glob_pattern(segments: list[ExpandedSegment]) -> str:
    """Build a glob pattern from segments, escaping glob chars in quoted segments.

    Quoted segments have their glob metacharacters escaped so they match literally.
    Unquoted segments are passed through unchanged to allow glob matching.
    """
    parts = []
    for seg in segments:
        if seg.quoted:
            # Escape glob chars in quoted segments
            parts.append(_escape_glob_chars(seg.text))
        else:
            parts.append(seg.text)
    return "".join(parts)


def _segments_has_unquoted_glob(segments: list[ExpandedSegment]) -> bool:
    """Check if segments contain unquoted glob characters."""
    for seg in segments:
        if not seg.quoted and (
            any(c in seg.text for c in "*?[")
            or re.search(r'[@?*+!]\(', seg.text)
        ):
            return True
    return False


def _split_segments_on_ifs(
    segments: list[ExpandedSegment], ifs: str
) -> list[str]:
    """Split segments on IFS characters, only splitting in unquoted segments.

    Quoted segments are never split. Unquoted segments are split on IFS chars.
    Adjacent segments (quoted or unquoted) that don't contain IFS delimiters
    are concatenated into the same output word.

    IFS splitting rules:
    - IFS whitespace (space/tab/newline): leading/trailing stripped, consecutive
      merged into one delimiter
    - IFS non-whitespace: each produces a field boundary
    - Whitespace adjacent to non-whitespace IFS is part of that delimiter
    """
    if not segments:
        return []

    # Empty IFS: no splitting at all
    if not ifs:
        combined = "".join(seg.text for seg in segments)
        return [combined] if combined else []

    ifs_whitespace = set(c for c in ifs if c in " \t\n")
    ifs_nonws = set(c for c in ifs if c not in " \t\n")

    words: list[str] = []
    current: list[str] = []
    had_content = False  # Track if we've seen any non-IFS content
    had_quoted_segment = False  # Track if we've seen any quoted segment (even empty)

    # Build a flat list of (char, splittable) pairs
    chars: list[tuple[str, bool]] = []
    for seg in segments:
        if seg.quoted:
            had_quoted_segment = True
            for c in seg.text:
                chars.append((c, False))
        else:
            for c in seg.text:
                chars.append((c, True))

    i = 0
    n = len(chars)

    # Skip leading IFS whitespace
    while i < n:
        c, splittable = chars[i]
        if splittable and c in ifs_whitespace:
            i += 1
        else:
            break

    while i < n:
        c, splittable = chars[i]
        if not splittable:
            current.append(c)
            had_content = True
            i += 1
        elif c in ifs_nonws:
            # Non-whitespace IFS: always produces a field boundary
            words.append("".join(current))
            current = []
            had_content = False
            i += 1
            # Skip trailing IFS whitespace after non-ws delimiter
            while i < n and chars[i][1] and chars[i][0] in ifs_whitespace:
                i += 1
        elif c in ifs_whitespace:
            # IFS whitespace: skip consecutive, check for adjacent non-ws
            if had_content or current:
                # Save word boundary position but don't emit yet -
                # if a non-ws IFS follows, it's one composite delimiter
                saved_word = "".join(current)
                current = []
                had_content = False
                # Skip consecutive whitespace
                while i < n and chars[i][1] and chars[i][0] in ifs_whitespace:
                    i += 1
                # Check if next is a non-ws IFS char
                if i < n and chars[i][1] and chars[i][0] in ifs_nonws:
                    # Composite delimiter: ws + nonws - consume both as one delimiter
                    words.append(saved_word)
                    i += 1  # consume the nonws char
                    # Skip trailing ws after nonws
                    while i < n and chars[i][1] and chars[i][0] in ifs_whitespace:
                        i += 1
                else:
                    # Just whitespace delimiter
                    words.append(saved_word)
            else:
                # Leading whitespace (or whitespace after delimiter) - skip
                while i < n and chars[i][1] and chars[i][0] in ifs_whitespace:
                    i += 1
        else:
            current.append(c)
            had_content = True
            i += 1

    # Include final word if we have content, or if we had a quoted segment
    # (quoted empty string "" should produce one empty word)
    if current or had_content or (had_quoted_segment and not words):
        words.append("".join(current))

    return words


def expand_parameter(ctx: "InterpreterContext", part: ParameterExpansionPart, in_double_quotes: bool = False) -> str:
    """Expand a parameter expansion synchronously."""
    parameter = part.parameter
    operation = part.operation

    # Handle variable indirection: ${!var}
    if parameter.startswith("!"):
        indirect_name = parameter[1:]

        # ${!arr[@]} or ${!arr[*]} - get array keys
        array_keys_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[[@*]\]$', indirect_name)
        if array_keys_match:
            arr_name = array_keys_match.group(1)
            keys = get_array_keys(ctx, arr_name)
            return " ".join(keys)

        # ${!prefix*} or ${!prefix@} - get variable names starting with prefix
        prefix_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)[@*]$', indirect_name)
        if prefix_match:
            prefix = prefix_match.group(1)
            matching = [k for k in ctx.state.env.keys()
                       if k.startswith(prefix) and not "__" in k]
            return " ".join(sorted(matching))

        # ${!var} - variable indirection
        # For namerefs: ${!nameref} returns the target variable NAME
        from .types import VariableStore
        env = ctx.state.env
        if (isinstance(env, VariableStore)
                and re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', indirect_name)
                and env.is_nameref(indirect_name)):
            meta = env._metadata.get(indirect_name)
            if meta and meta.nameref_target:
                return meta.nameref_target
            return ""

        # Standard indirect: ${!var} uses value of var as variable name
        ref_name = get_variable(ctx, indirect_name, False)
        if operation:
            # ${!ref:-default}, ${!ref#pattern}, etc.
            # Resolve indirection, then apply operation to the resolved variable
            if ref_name:
                parameter = ref_name
            else:
                # ref doesn't resolve - use a name guaranteed to be unset
                parameter = "__indirect_unset__"
            # Fall through to operation handling below
        else:
            # Simple ${!var}
            if ref_name:
                return get_variable(ctx, ref_name, False)
            return ""

    # Check if operation handles unset variables
    skip_nounset = operation and operation.type in (
        "DefaultValue", "AssignDefault", "UseAlternative", "ErrorIfUnset"
    )

    value = get_variable(ctx, parameter, not skip_nounset)

    if not operation:
        return value

    # Check if variable is unset - handle array subscript parameters
    array_param_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[[@*]\]$', parameter)
    if array_param_match:
        arr_name = array_param_match.group(1)
        elements = get_array_elements(ctx, arr_name)
        is_unset = len(elements) == 0
    elif re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', parameter) and f"{parameter}__is_array" in ctx.state.env:
        # Bare array name - check if any elements exist
        elements = get_array_elements(ctx, parameter)
        is_unset = len(elements) == 0
    elif parameter in ("@", "*"):
        # $@ and $* are "set" if any positional parameters exist
        is_unset = "1" not in ctx.state.env
    else:
        is_unset = parameter not in ctx.state.env
    is_empty = value == ""

    if operation.type == "DefaultValue":
        use_default = is_unset or (operation.check_empty and is_empty)
        if use_default and operation.word:
            return expand_word(ctx, operation.word)
        return value

    elif operation.type == "AssignDefault":
        use_default = is_unset or (operation.check_empty and is_empty)
        if use_default and operation.word:
            default_value = expand_word(ctx, operation.word)
            ctx.state.env[parameter] = default_value
            return default_value
        return value

    elif operation.type == "ErrorIfUnset":
        should_error = is_unset or (operation.check_empty and is_empty)
        if should_error:
            message = expand_word(ctx, operation.word) if operation.word else f"{parameter}: parameter null or not set"
            raise ExitError(1, "", f"bash: {message}\n")
        return value

    elif operation.type == "UseAlternative":
        use_alt = not (is_unset or (operation.check_empty and is_empty))
        if use_alt and operation.word:
            return expand_word(ctx, operation.word)
        return ""

    elif operation.type == "Length":
        # Detect invalid length expressions like ${#x-default} or ${#v:1:3}
        # These are stored by the parser with the full content starting with '#'
        if parameter.startswith("#"):
            raise BadSubstitutionError(
                f"${{{parameter}}}: bad substitution",
                stderr=f"bash: ${{{parameter}}}: bad substitution\n",
            )
        # Check for array length
        array_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[[@*]\]$', parameter)
        if array_match:
            elements = get_array_elements(ctx, array_match.group(1))
            return str(len(elements))
        # ${#a} for arrays should return length of a[0]
        if re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', parameter) and f"{parameter}__is_array" in ctx.state.env:
            first_val = ctx.state.env.get(f"{parameter}_0", "")
            return str(len(first_val))
        return str(len(value))

    elif operation.type == "Substring":
        # Evaluate offset/length as arithmetic expressions if raw strings are present
        if hasattr(operation, 'offset_str') and operation.offset_str is not None:
            offset = _eval_array_subscript(ctx, operation.offset_str)
        else:
            offset = operation.offset if hasattr(operation, 'offset') else 0
        if hasattr(operation, 'length_str') and operation.length_str is not None:
            length = _eval_array_subscript(ctx, operation.length_str)
        else:
            length = operation.length if hasattr(operation, 'length') else None

        # Check for array slicing: ${a[@]:offset:length}
        array_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[[@*]\]$', parameter)
        if array_match:
            elements = get_array_elements(ctx, array_match.group(1))
            values = [v for _, v in elements]
            # Handle negative offset
            if offset < 0:
                offset = max(0, len(values) + offset)
            if length is not None:
                if length < 0:
                    # Negative length in array slices is an error (bash 4.2+)
                    raise ExitError(1, "", f"bash: {array_match.group(1)}[@]: bad substring expression\n")
                else:
                    sliced = values[offset:offset + length]
            else:
                sliced = values[offset:]
            return " ".join(sliced)

        # Handle negative offset
        if offset < 0:
            offset = max(0, len(value) + offset)

        if length is not None:
            if length < 0:
                end_pos = len(value) + length
                return value[offset:max(offset, end_pos)]
            return value[offset:offset + length]
        return value[offset:]

    elif operation.type == "PatternRemoval":
        pattern = expand_word_for_pattern(ctx, operation.pattern) if operation.pattern else ""
        greedy = operation.greedy
        from_end = operation.side == "suffix"
        # Check if extglob is enabled
        extglob_on = ctx.state.env.get("__shopt_extglob__", "0") == "1"

        # Check for array per-element operation: ${a[@]#pattern}
        array_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[[@*]\]$', parameter)
        if array_match:
            elements = get_array_elements(ctx, array_match.group(1))
            regex_pat = glob_to_regex(pattern, greedy=True, from_end=from_end, extglob=extglob_on)
            results = []
            for _, elem_val in elements:
                results.append(_apply_pattern_removal(elem_val, regex_pat, pattern, greedy, from_end))
            return " ".join(results)

        # Convert glob pattern to regex
        regex_pattern = glob_to_regex(pattern, greedy=True, from_end=from_end, extglob=extglob_on)

        try:
            if from_end:
                # Remove from end: ${var%pattern} or ${var%%pattern}
                if greedy:
                    # ${var%%pattern}: remove longest matching suffix
                    match = re.search(regex_pattern + "$", value)
                    if match:
                        return value[:match.start()]
                else:
                    # ${var%pattern}: remove shortest matching suffix
                    # Check empty suffix first (pattern might match empty string)
                    if re.fullmatch(regex_pattern, ""):
                        return value
                    # Try matching from the end, starting with the shortest suffix
                    for start in range(len(value) - 1, -1, -1):
                        suffix = value[start:]
                        if re.fullmatch(regex_pattern, suffix):
                            return value[:start]
            else:
                # Remove from start: ${var#pattern} or ${var##pattern}
                if greedy:
                    # ${var##pattern}: remove longest matching prefix
                    regex_greedy = glob_to_regex(pattern, greedy=True, from_end=False, extglob=extglob_on)
                    match = re.match(regex_greedy, value)
                    if match:
                        return value[match.end():]
                else:
                    # ${var#pattern}: remove shortest matching prefix
                    regex_nongreedy = glob_to_regex(pattern, greedy=False, from_end=False, extglob=extglob_on)
                    match = re.match(regex_nongreedy, value)
                    if match:
                        return value[match.end():]
        except re.error:
            pass
        return value

    elif operation.type == "PatternReplacement":
        pattern = expand_word_for_pattern(ctx, operation.pattern) if operation.pattern else ""
        replacement = expand_word(ctx, operation.replacement) if operation.replacement else ""
        replace_all = operation.all
        anchor = getattr(operation, 'anchor', None)
        extglob_on = ctx.state.env.get("__shopt_extglob__", "0") == "1"

        # Empty pattern with anchor: insert/append (bash behavior)
        # Empty pattern without anchor: return value unchanged
        if not pattern:
            if anchor == "start":
                return replacement + value
            elif anchor == "end":
                return value + replacement
            return value

        regex_pattern = glob_to_regex(pattern, greedy=True, extglob=extglob_on)

        # Check for array per-element operation: ${a[@]/pat/rep}
        array_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[[@*]\]$', parameter)
        if array_match:
            elements = get_array_elements(ctx, array_match.group(1))
            results = []
            for _, elem_val in elements:
                results.append(_apply_pattern_replacement(elem_val, regex_pattern, pattern, replacement, replace_all, anchor))
            return " ".join(results)

        try:
            if anchor == "start":
                anchored_pattern = "^" + regex_pattern
                return re.sub(anchored_pattern, replacement, value, count=1)
            elif anchor == "end":
                anchored_pattern = regex_pattern + "$"
                return re.sub(anchored_pattern, replacement, value, count=1)
            elif replace_all:
                return _bash_replace_all(regex_pattern, replacement, value)
            else:
                return re.sub(regex_pattern, replacement, value, count=1)
        except re.error:
            return value

    elif operation.type == "CaseModification":
        # ${var^^} or ${var,,} for case conversion
        # Check for array per-element: ${a[@]^^}
        array_match_cm = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[[@*]\]$', parameter)
        if array_match_cm:
            elements = get_array_elements(ctx, array_match_cm.group(1))
            results = []
            for _, elem_val in elements:
                if operation.direction == "upper":
                    if operation.all:
                        results.append(elem_val.upper())
                    else:
                        results.append(elem_val[0].upper() + elem_val[1:] if elem_val else "")
                else:
                    if operation.all:
                        results.append(elem_val.lower())
                    else:
                        results.append(elem_val[0].lower() + elem_val[1:] if elem_val else "")
            return " ".join(results)

        pattern = None
        if operation.pattern:
            try:
                from .expansion import expand_word_async
                import asyncio
                # For sync context, try to get the raw pattern
                if operation.pattern.parts:
                    pattern = "".join(
                        getattr(p, 'value', '') for p in operation.pattern.parts
                    )
            except Exception:
                pass

        if operation.direction == "upper":
            if pattern:
                # Only uppercase chars matching pattern
                result = []
                for c in value:
                    if fnmatch.fnmatch(c, pattern):
                        result.append(c.upper())
                    else:
                        result.append(c)
                return "".join(result) if operation.all else (
                    _case_first_matching(value, pattern, str.upper) if value else ""
                )
            if operation.all:
                return value.upper()
            return value[0].upper() + value[1:] if value else ""
        else:
            if pattern:
                # Only lowercase chars matching pattern
                result = []
                for c in value:
                    if fnmatch.fnmatch(c, pattern):
                        result.append(c.lower())
                    else:
                        result.append(c)
                return "".join(result) if operation.all else (
                    _case_first_matching(value, pattern, str.lower) if value else ""
                )
            if operation.all:
                return value.lower()
            return value[0].lower() + value[1:] if value else ""

    elif operation.type == "Transform":
        # ${var@Q}, ${var@P}, ${var@a}, ${var@A}, ${var@E}, ${var@K}
        # ${var@u}, ${var@U}, ${var@L} (case transforms)
        op = operation.operator

        # Check for array per-element operation: ${a[@]@X} or ${a[*]@X}
        array_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[[@*]\]$', parameter)

        if op == "Q":
            # Quoted form - unset variables produce empty output
            if array_match:
                elements = get_array_elements(ctx, array_match.group(1))
                quoted = [_shell_quote(v) for _, v in elements]
                return " ".join(quoted)
            if is_unset:
                return ""
            if not value:
                return "''"
            if "'" not in value:
                return f"'{value}'"
            escaped = value.replace("\\", "\\\\").replace("'", "\\'")
            return f"$'{escaped}'"
        elif op == "E":
            # Expand escape sequences like $'...'
            result = []
            i = 0
            while i < len(value):
                if value[i] == '\\' and i + 1 < len(value):
                    c = value[i + 1]
                    if c == 'n':
                        result.append('\n')
                    elif c == 't':
                        result.append('\t')
                    elif c == 'r':
                        result.append('\r')
                    elif c == '\\':
                        result.append('\\')
                    elif c == "'":
                        result.append("'")
                    elif c == '"':
                        result.append('"')
                    elif c == 'a':
                        result.append('\a')
                    elif c == 'b':
                        result.append('\b')
                    elif c == 'f':
                        result.append('\f')
                    elif c == 'v':
                        result.append('\v')
                    elif c == 'x' and i + 3 < len(value):
                        # Hex: \xNN
                        hex_str = value[i+2:i+4]
                        try:
                            result.append(chr(int(hex_str, 16)))
                            i += 4
                            continue
                        except ValueError:
                            result.append(value[i:i+2])
                    elif c in '0123456789':
                        # Octal: \NNN
                        oct_str = ""
                        j = i + 1
                        while j < len(value) and j < i + 4 and value[j] in '01234567':
                            oct_str += value[j]
                            j += 1
                        try:
                            result.append(chr(int(oct_str, 8)))
                            i = j
                            continue
                        except ValueError:
                            result.append(value[i:i+2])
                    else:
                        result.append(value[i:i+2])
                    i += 2
                else:
                    result.append(value[i])
                    i += 1
            return ''.join(result)
        elif op == "P":
            # Prompt expansion
            return value
        elif op == "A":
            # Assignment statement form - unset variables produce no output
            if is_unset:
                return ""
            return f"{parameter}={_shell_quote(value)}"
        elif op == "a":
            # Attributes - check VariableStore metadata first
            from .types import VariableStore
            env = ctx.state.env
            # For array subscript parameters, use the base name
            attr_name = parameter
            array_name_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[', parameter)
            if array_name_match:
                attr_name = array_name_match.group(1)
            attrs = ""
            if isinstance(env, VariableStore):
                var_attrs = env.get_attributes(attr_name)
                # Build flags in standard order
                for flag in "aAilnrtux":
                    if flag in var_attrs:
                        attrs += flag
                # Check array type if not in metadata
                if "a" not in attrs and "A" not in attrs:
                    is_arr = env.get(f"{attr_name}__is_array")
                    if is_arr == "indexed":
                        attrs = "a" + attrs
                    elif is_arr == "assoc":
                        attrs = "A" + attrs
            else:
                if env.get(f"{attr_name}__is_array") == "indexed":
                    attrs += "a"
                elif env.get(f"{attr_name}__is_array") == "assoc":
                    attrs += "A"
                if attr_name in getattr(ctx.state, 'readonly_vars', set()):
                    attrs += "r"
            return attrs
        elif op == "K" or op == "k":
            # Key-value pairs (for arrays), or quoted value (for scalars)
            elements = get_array_elements(ctx, parameter)
            if elements:
                pairs = [f"[{idx}]=\"{val}\"" for idx, val in elements]
                return " ".join(pairs)
            if is_unset:
                return ""
            return _shell_quote(value)
        elif op == "u":
            # Uppercase first character
            return value[0].upper() + value[1:] if value else ""
        elif op == "U":
            # Uppercase all
            return value.upper()
        elif op == "L":
            # Lowercase all
            return value.lower()

    return value


def _bash_replace_all(regex_pattern: str, replacement: str, value: str) -> str:
    """Replace all non-overlapping matches, skipping zero-length matches after non-empty ones.

    Bash's replace-all doesn't match empty strings at boundaries after already
    matching the full content (unlike Python's re.sub which matches '' at end).
    """
    result = []
    pos = 0
    last_end = 0
    for m in re.finditer(regex_pattern, value):
        if m.start() == m.end() and m.start() == last_end and pos > 0:
            # Skip zero-length match at the same position as end of previous match
            continue
        result.append(value[pos:m.start()])
        result.append(replacement)
        pos = m.end()
        last_end = m.end()
        if m.start() == m.end():
            # Zero-length match: advance by one to avoid infinite loop
            if pos < len(value):
                result.append(value[pos])
                pos += 1
    result.append(value[pos:])
    return "".join(result)


def _apply_pattern_removal(value: str, regex_pattern: str, pattern: str, greedy: bool, from_end: bool) -> str:
    """Apply pattern removal to a single string value."""
    try:
        if from_end:
            if greedy:
                match = re.search(regex_pattern + "$", value)
                if match:
                    return value[:match.start()]
            else:
                for start in range(len(value) - 1, -1, -1):
                    suffix = value[start:]
                    if re.fullmatch(regex_pattern, suffix):
                        return value[:start]
                if re.fullmatch(regex_pattern, ""):
                    return value
        else:
            if greedy:
                regex_greedy = glob_to_regex(pattern, greedy=True, from_end=False)
                match = re.match(regex_greedy, value)
                if match:
                    return value[match.end():]
            else:
                regex_nongreedy = glob_to_regex(pattern, greedy=False, from_end=False)
                match = re.match(regex_nongreedy, value)
                if match:
                    return value[match.end():]
    except re.error:
        pass
    return value


def _apply_pattern_replacement(value: str, regex_pattern: str, pattern: str, replacement: str, replace_all: bool, anchor) -> str:
    """Apply pattern replacement to a single string value."""
    if not pattern:
        return value
    try:
        if anchor == "start":
            anchored = "^" + regex_pattern
            return re.sub(anchored, replacement, value, count=1)
        elif anchor == "end":
            anchored = regex_pattern + "$"
            return re.sub(anchored, replacement, value, count=1)
        elif replace_all:
            return _bash_replace_all(regex_pattern, replacement, value)
        else:
            return re.sub(regex_pattern, replacement, value, count=1)
    except re.error:
        return value


def _case_first_matching(value: str, pattern: str, transform) -> str:
    """Apply case transform to the first character matching pattern."""
    for i, c in enumerate(value):
        if fnmatch.fnmatch(c, pattern):
            return value[:i] + transform(c) + value[i + 1:]
    return value


def _shell_quote(s: str) -> str:
    """Quote a string for shell use."""
    if not s:
        return "''"
    if "'" not in s:
        return f"'{s}'"
    return f"$'{s.replace(chr(92), chr(92)+chr(92)).replace(chr(39), chr(92)+chr(39))}'"


async def expand_parameter_async(ctx: "InterpreterContext", part: ParameterExpansionPart, in_double_quotes: bool = False) -> str:
    """Expand a parameter expansion asynchronously."""
    # For now, use sync version - async needed for command substitution in default values
    return expand_parameter(ctx, part, in_double_quotes)


async def expand_parameter_segments_async(
    ctx: "InterpreterContext", part: ParameterExpansionPart, in_double_quotes: bool = False
) -> list[ExpandedSegment]:
    """Expand a parameter expansion into segments preserving quoting context.

    For operations like DefaultValue and UseAlternative that use the operation.word,
    this preserves the quoting context from the word (e.g., ${Unset:-'a b c'} keeps
    'a b c' as a single quoted segment).

    For other operations (Length, Substring, PatternRemoval, etc.), the result
    is a single segment inheriting the quoting context from in_double_quotes.
    """
    parameter = part.parameter
    operation = part.operation

    # Handle variable indirection: ${!var}
    if parameter.startswith("!"):
        indirect_name = parameter[1:]

        # ${!arr[@]} or ${!arr[*]} - get array keys
        array_keys_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[[@*]\]$', indirect_name)
        if array_keys_match:
            arr_name = array_keys_match.group(1)
            keys = get_array_keys(ctx, arr_name)
            return [ExpandedSegment(text=" ".join(keys), quoted=in_double_quotes)]

        # ${!prefix*} or ${!prefix@} - get variable names starting with prefix
        prefix_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)[@*]$', indirect_name)
        if prefix_match:
            prefix = prefix_match.group(1)
            matching = [k for k in ctx.state.env.keys()
                       if k.startswith(prefix) and not "__" in k]
            return [ExpandedSegment(text=" ".join(sorted(matching)), quoted=in_double_quotes)]

        # ${!var} - variable indirection
        from .types import VariableStore
        env = ctx.state.env
        if (isinstance(env, VariableStore)
                and re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', indirect_name)
                and env.is_nameref(indirect_name)):
            meta = env._metadata.get(indirect_name)
            if meta and meta.nameref_target:
                return [ExpandedSegment(text=meta.nameref_target, quoted=in_double_quotes)]
            return []

        # Standard indirect: ${!var} uses value of var as variable name
        ref_name = get_variable(ctx, indirect_name, False)
        if operation:
            if ref_name:
                parameter = ref_name
            else:
                parameter = "__indirect_unset__"
        else:
            if ref_name:
                value = get_variable(ctx, ref_name, False)
                return [ExpandedSegment(text=value, quoted=in_double_quotes)]
            return []

    # Check if operation handles unset variables
    skip_nounset = operation and operation.type in (
        "DefaultValue", "AssignDefault", "UseAlternative", "ErrorIfUnset"
    )

    value = get_variable(ctx, parameter, not skip_nounset)

    if not operation:
        return [ExpandedSegment(text=value, quoted=in_double_quotes)]

    # Check if variable is unset
    array_param_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[[@*]\]$', parameter)
    if array_param_match:
        arr_name = array_param_match.group(1)
        elements = get_array_elements(ctx, arr_name)
        is_unset = len(elements) == 0
    elif re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', parameter) and f"{parameter}__is_array" in ctx.state.env:
        elements = get_array_elements(ctx, parameter)
        is_unset = len(elements) == 0
    elif parameter in ("@", "*"):
        # $@ and $* are "set" if any positional parameters exist
        is_unset = "1" not in ctx.state.env
    else:
        is_unset = parameter not in ctx.state.env
    is_empty = value == ""

    # Handle operations that use operation.word - preserve quoting
    if operation.type == "DefaultValue":
        use_default = is_unset or (operation.check_empty and is_empty)
        if use_default:
            if operation.word and operation.word.parts:
                # Recursively expand the default word, preserving quoting
                # Pass in_double_quotes to suppress tilde expansion when inside double quotes
                segments = await expand_word_segments(ctx, operation.word, in_double_quotes)
                # When in double quotes, mark all segments as quoted
                # and ensure at least one empty segment for empty result
                if in_double_quotes:
                    if not segments:
                        return [ExpandedSegment(text="", quoted=True)]
                    return [ExpandedSegment(text=seg.text, quoted=True) for seg in segments]
                return segments
            else:
                # Empty default like ${var:-} - if in double quotes, preserve empty
                if in_double_quotes:
                    return [ExpandedSegment(text="", quoted=True)]
                return []
        return [ExpandedSegment(text=value, quoted=in_double_quotes)]

    elif operation.type == "AssignDefault":
        use_default = is_unset or (operation.check_empty and is_empty)
        if use_default and operation.word:
            # Get segments for the default, then flatten for assignment
            # Pass in_double_quotes to suppress tilde expansion when inside double quotes
            segments = await expand_word_segments(ctx, operation.word, in_double_quotes)
            default_value = "".join(seg.text for seg in segments)
            # Handle array subscript assignment like ${arr[0]=x}
            array_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[(.+)\]$', parameter)
            if array_match:
                arr_name = array_match.group(1)
                subscript = array_match.group(2)
                # Ensure array marker exists
                if f"{arr_name}__is_array" not in ctx.state.env:
                    ctx.state.env[f"{arr_name}__is_array"] = "indexed"
                is_assoc = ctx.state.env.get(f"{arr_name}__is_array") == "assoc"
                if is_assoc:
                    # For associative arrays, use the subscript as-is
                    expanded_subscript = _expand_subscript_vars(ctx, subscript)
                    if (expanded_subscript.startswith('"') and expanded_subscript.endswith('"')) or \
                       (expanded_subscript.startswith("'") and expanded_subscript.endswith("'")):
                        expanded_subscript = expanded_subscript[1:-1]
                    ctx.state.env[f"{arr_name}_{expanded_subscript}"] = default_value
                else:
                    # For indexed arrays, evaluate as arithmetic
                    idx = _eval_array_subscript(ctx, subscript)
                    ctx.state.env[f"{arr_name}_{idx}"] = default_value
            else:
                ctx.state.env[parameter] = default_value
            return segments
        return [ExpandedSegment(text=value, quoted=in_double_quotes)]

    elif operation.type == "ErrorIfUnset":
        should_error = is_unset or (operation.check_empty and is_empty)
        if should_error:
            message = await expand_word_async(ctx, operation.word) if operation.word else f"{parameter}: parameter null or not set"
            raise ExitError(1, "", f"bash: {message}\n")
        return [ExpandedSegment(text=value, quoted=in_double_quotes)]

    elif operation.type == "UseAlternative":
        use_alt = not (is_unset or (operation.check_empty and is_empty))
        if use_alt:
            if operation.word and operation.word.parts:
                # Recursively expand the alternate word, preserving quoting
                # Pass in_double_quotes to suppress tilde expansion when inside double quotes
                segments = await expand_word_segments(ctx, operation.word, in_double_quotes)
                # If expansion produced nothing but we're in double quotes,
                # return an empty quoted segment
                if not segments and in_double_quotes:
                    return [ExpandedSegment(text="", quoted=True)]
                return segments
            else:
                # Empty alternate like ${var:+} with var set - if in double quotes, preserve empty
                if in_double_quotes:
                    return [ExpandedSegment(text="", quoted=True)]
                return []
        # Variable is unset/empty, don't use alternate - if in double quotes, preserve empty
        if in_double_quotes:
            return [ExpandedSegment(text="", quoted=True)]
        return []

    # For all other operations, use the string-based expansion
    result = expand_parameter(ctx, part, in_double_quotes)
    return [ExpandedSegment(text=result, quoted=in_double_quotes)]


def expand_brace_range(start: int, end: int, step: int = 1) -> list[str]:
    """Expand a brace range like {1..10} or {a..z}."""
    results = []

    if step == 0:
        step = 1

    if start <= end:
        i = start
        while i <= end:
            results.append(str(i))
            i += abs(step)
    else:
        i = start
        while i >= end:
            results.append(str(i))
            i -= abs(step)

    return results


def expand_braces(s: str) -> list[str]:
    """Expand brace patterns in a string.

    Handles:
    - Comma lists: {a,b,c} -> a b c
    - Numeric sequences: {1..5} -> 1 2 3 4 5
    - Alpha sequences: {a..e} -> a b c d e
    - Step sequences: {1..10..2} -> 1 3 5 7 9
    - Zero padding: {01..05} -> 01 02 03 04 05
    - Prefix/suffix: pre{a,b}suf -> preasuf prebsuf
    - Nested braces: {a,{b,c}} -> a b c
    """
    # Find the first valid brace expansion pattern
    # Must have { and } with , or .. inside, and not be quoted
    i = 0
    while i < len(s):
        if s[i] == '\\' and i + 1 < len(s):
            # Skip escaped character
            i += 2
            continue
        if s[i] == '{':
            # Find matching closing brace
            depth = 1
            j = i + 1
            has_comma = False
            has_dotdot = False
            while j < len(s) and depth > 0:
                if s[j] == '\\' and j + 1 < len(s):
                    j += 2
                    continue
                if s[j] == '{':
                    depth += 1
                elif s[j] == '}':
                    depth -= 1
                elif depth == 1 and s[j] == ',':
                    has_comma = True
                elif depth == 1 and s[j:j+2] == '..':
                    has_dotdot = True
                j += 1

            if depth == 0 and (has_comma or has_dotdot):
                # Found a valid brace expansion
                prefix = s[:i]
                suffix = s[j:]
                brace_content = s[i+1:j-1]

                # Expand this brace pattern
                expansions = _expand_brace_content(brace_content)

                # If the expansion returns the original {content} unchanged,
                # it means this wasn't a valid expansion - treat as literal
                original = '{' + brace_content + '}'
                if len(expansions) == 1 and expansions[0] == original:
                    i = j
                    continue

                # Combine with prefix/suffix and recursively expand
                result = []
                for exp in expansions:
                    combined = prefix + exp + suffix
                    # Recursively expand any remaining braces
                    result.extend(expand_braces(combined))
                return result
        i += 1

    # No brace expansion found
    return [s]


def _expand_brace_content(content: str) -> list[str]:
    """Expand the content inside braces.

    Handles comma-separated lists and sequences.
    """
    # Check for sequence pattern (..): a..z, 1..10, 1..10..2
    if '..' in content and ',' not in content:
        return _expand_sequence(content)

    # Handle comma-separated list, respecting nested braces
    items = []
    current = []
    depth = 0
    i = 0
    while i < len(content):
        c = content[i]
        if c == '\\' and i + 1 < len(content):
            current.append(c)
            current.append(content[i + 1])
            i += 2
            continue
        if c == '{':
            depth += 1
            current.append(c)
        elif c == '}':
            depth -= 1
            current.append(c)
        elif c == ',' and depth == 0:
            items.append(''.join(current))
            current = []
        else:
            current.append(c)
        i += 1
    items.append(''.join(current))

    # Recursively expand nested braces in each item
    result = []
    for item in items:
        result.extend(expand_braces(item))
    return result


def _expand_sequence(content: str) -> list[str]:
    """Expand a sequence like 1..10, a..z, or 1..10..2."""
    parts = content.split('..')
    if len(parts) < 2 or len(parts) > 3:
        return ['{' + content + '}']  # Not a valid sequence

    start_str = parts[0]
    end_str = parts[1]
    step = 1
    if len(parts) == 3:
        try:
            step = int(parts[2])
            if step == 0:
                step = 1
        except ValueError:
            return ['{' + content + '}']  # Invalid step

    # Determine padding width
    pad_width = 0
    if start_str.startswith('0') and len(start_str) > 1:
        pad_width = max(pad_width, len(start_str))
    if end_str.startswith('0') and len(end_str) > 1:
        pad_width = max(pad_width, len(end_str))

    # Try numeric sequence
    try:
        start_num = int(start_str)
        end_num = int(end_str)
        results = []
        if start_num <= end_num:
            i = start_num
            while i <= end_num:
                if pad_width:
                    results.append(str(i).zfill(pad_width))
                else:
                    results.append(str(i))
                i += abs(step)
        else:
            i = start_num
            while i >= end_num:
                if pad_width:
                    results.append(str(i).zfill(pad_width))
                else:
                    results.append(str(i))
                i -= abs(step)
        return results
    except ValueError:
        pass

    # Try alpha sequence (single characters)
    if len(start_str) == 1 and len(end_str) == 1:
        start_ord = ord(start_str)
        end_ord = ord(end_str)
        # Both must be letters, and both must be the same case
        # Bash treats mixed case (e.g., {z..A}) and mixed types (e.g., {a..3}) as invalid
        start_is_alpha = start_str.isalpha()
        end_is_alpha = end_str.isalpha()
        if not start_is_alpha or not end_is_alpha:
            return ['{' + content + '}']
        if start_str.islower() != end_str.islower():
            return ['{' + content + '}']
        results = []
        if start_ord <= end_ord:
            i = start_ord
            while i <= end_ord:
                results.append(chr(i))
                i += abs(step)
        else:
            i = start_ord
            while i >= end_ord:
                results.append(chr(i))
                i -= abs(step)
        return results

    # Not a valid sequence
    return ['{' + content + '}']


def glob_to_regex(pattern: str, greedy: bool = True, from_end: bool = False, extglob: bool = True) -> str:
    """Convert a glob pattern to a regex pattern.

    Supports standard globs (*, ?, [...]) and extended globs (@, ?, *, +, !)(pat|pat).
    Set extglob=False to disable extended glob pattern recognition.
    """
    # POSIX character class mappings
    posix_classes = {
        "[:alpha:]": "a-zA-Z",
        "[:digit:]": "0-9",
        "[:alnum:]": "a-zA-Z0-9",
        "[:upper:]": "A-Z",
        "[:lower:]": "a-z",
        "[:space:]": " \\t\\n\\r\\f\\v",
        "[:blank:]": " \\t",
        "[:punct:]": r"!\"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~",
        "[:graph:]": "!-~",
        "[:print:]": " -~",
        "[:cntrl:]": "\\x00-\\x1f\\x7f",
        "[:xdigit:]": "0-9a-fA-F",
    }

    def _convert_extglob_body(body: str) -> str:
        """Convert the body of an extglob (between parens), handling nested patterns."""
        # Split on | but respect nesting
        parts = []
        current = []
        depth = 0
        for ch in body:
            if ch == "(" and current and current[-1] in "@?*+!":
                depth += 1
                current.append(ch)
            elif ch == ")" and depth > 0:
                depth -= 1
                current.append(ch)
            elif ch == "|" and depth == 0:
                parts.append("".join(current))
                current = []
            else:
                current.append(ch)
        parts.append("".join(current))
        # Convert each alternative
        return "|".join(glob_to_regex(p, greedy, from_end) for p in parts)

    result = []
    i = 0
    while i < len(pattern):
        c = pattern[i]
        # Check for extglob patterns: @( ?( *( +( !(
        if extglob and c in "@?*+!" and i + 1 < len(pattern) and pattern[i + 1] == "(":
            # Find matching closing paren
            depth = 1
            j = i + 2
            while j < len(pattern) and depth > 0:
                if pattern[j] == "(":
                    depth += 1
                elif pattern[j] == ")":
                    depth -= 1
                j += 1
            body = pattern[i + 2:j - 1]  # Content between parens
            converted_body = _convert_extglob_body(body)
            if c == "@":
                result.append(f"(?:{converted_body})")
            elif c == "?":
                result.append(f"(?:{converted_body})?")
            elif c == "*":
                result.append(f"(?:{converted_body})*")
            elif c == "+":
                result.append(f"(?:{converted_body})+")
            elif c == "!":
                # !(pat) - match anything that doesn't match
                # Use negative lookahead anchored to end
                result.append(f"(?!(?:{converted_body})$).*")
            i = j
            continue
        if c == "*":
            if greedy:
                result.append(".*")
            else:
                result.append(".*?")
        elif c == "?":
            result.append(".")
        elif c == "[":
            # Character class - check if it's a valid bracket expression
            # Look for closing ']'
            close_pos = pattern.find("]", i + 1)
            # Allow ']' as first char in class: []] or [!]]
            if i + 1 < len(pattern) and pattern[i + 1] in ("!", "^"):
                close_pos2 = pattern.find("]", i + 3)
                if close_pos == i + 2 and close_pos2 != -1:
                    close_pos = close_pos2
            elif i + 1 < len(pattern) and pattern[i + 1] == "]":
                close_pos2 = pattern.find("]", i + 2)
                if close_pos2 != -1:
                    close_pos = close_pos2
            if close_pos == -1:
                # No closing ']' - treat '[' as literal
                result.append("\\[")
            else:
                j = i + 1
                if j < len(pattern) and pattern[j] == "!":
                    result.append("[^")
                    j += 1
                else:
                    result.append("[")
                while j < len(pattern) and pattern[j] != "]":
                    # Check for POSIX character classes like [:alpha:]
                    if pattern[j] == "[" and j + 1 < len(pattern) and pattern[j + 1] == ":":
                        # Find the closing :]
                        end = pattern.find(":]", j + 2)
                        if end != -1:
                            posix_name = pattern[j:end + 2]
                            if posix_name in posix_classes:
                                result.append(posix_classes[posix_name])
                                j = end + 2
                                continue
                    result.append(pattern[j])
                    j += 1
                result.append("]")
                i = j
        elif c == "\\":
            # Backslash escape in glob pattern - next char is literal
            if i + 1 < len(pattern):
                i += 1
                result.append(re.escape(pattern[i]))
            else:
                result.append("\\\\")
        elif c in r"^$.|+(){}":
            result.append("\\" + c)
        else:
            result.append(c)
        i += 1
    return "".join(result)


def _find_brace_in_literal_parts(parts: list) -> tuple[int, int, int, str] | None:
    """Find a valid brace expansion pattern within a single LiteralPart node.

    Returns (part_index, brace_start, brace_end, content) or None.
    Only finds patterns entirely within a single LiteralPart.
    """
    for idx, part in enumerate(parts):
        if not isinstance(part, LiteralPart):
            continue
        text = part.value
        i = 0
        while i < len(text):
            if text[i] == '\\' and i + 1 < len(text):
                i += 2
                continue
            if text[i] == '{':
                depth = 1
                j = i + 1
                has_comma = False
                has_dotdot = False
                while j < len(text) and depth > 0:
                    if text[j] == '\\' and j + 1 < len(text):
                        j += 2
                        continue
                    if text[j] == '{':
                        depth += 1
                    elif text[j] == '}':
                        depth -= 1
                    elif depth == 1 and text[j] == ',':
                        has_comma = True
                    elif depth == 1 and j + 1 < len(text) and text[j:j+2] == '..':
                        has_dotdot = True
                    j += 1
                if depth == 0 and (has_comma or has_dotdot):
                    return (idx, i, j, text[i+1:j-1])
            i += 1
    return None


def _find_brace_across_parts(parts: tuple) -> dict | None:
    """Find the leftmost brace expansion pattern, possibly spanning multiple word parts.

    Only LiteralPart characters can be brace metacharacters ({, }, comma, ..).
    Quoted parts (SingleQuotedPart, DoubleQuotedPart, EscapedPart) and expansion
    parts (ParameterExpansionPart, etc.) are treated as opaque content - they
    contribute to the brace expansion alternatives but cannot contain metacharacters.

    Returns a dict with:
      - open_part, open_char: position of '{'
      - close_part, close_char: position of '}'
      - comma_positions: list of (part_idx, char_idx) for top-level commas
      - has_dotdot: whether '..' was found at depth 1
      - single_part: True if pattern is entirely within one LiteralPart
    Or None if no valid brace expansion found.
    """
    # Walk through parts looking for '{' in LiteralParts
    for start_pidx, start_part in enumerate(parts):
        if not isinstance(start_part, LiteralPart):
            continue
        text = start_part.value
        ci = 0
        while ci < len(text):
            if text[ci] == '\\' and ci + 1 < len(text):
                ci += 2
                continue
            if text[ci] != '{':
                ci += 1
                continue

            # Found a '{'. Scan forward across parts to find matching '}'
            depth = 1
            commas = []
            has_dotdot = False
            found_close = False
            close_pidx = -1
            close_ci = -1

            # Continue scanning from next char in current part
            scan_pidx = start_pidx
            scan_ci = ci + 1

            while scan_pidx < len(parts) and depth > 0:
                scan_part = parts[scan_pidx]
                if isinstance(scan_part, LiteralPart):
                    scan_text = scan_part.value
                    while scan_ci < len(scan_text) and depth > 0:
                        ch = scan_text[scan_ci]
                        if ch == '\\' and scan_ci + 1 < len(scan_text):
                            scan_ci += 2
                            continue
                        if ch == '{':
                            depth += 1
                        elif ch == '}':
                            depth -= 1
                            if depth == 0:
                                found_close = True
                                close_pidx = scan_pidx
                                close_ci = scan_ci
                                break
                        elif depth == 1 and ch == ',':
                            commas.append((scan_pidx, scan_ci))
                        elif depth == 1 and ch == '.':
                            if scan_ci + 1 < len(scan_text) and scan_text[scan_ci + 1] == '.':
                                has_dotdot = True
                        scan_ci += 1
                else:
                    # Non-literal part: skip (content at current depth, no metacharacters)
                    pass

                if found_close:
                    break
                scan_pidx += 1
                scan_ci = 0

            if found_close and (commas or has_dotdot):
                single_part = (start_pidx == close_pidx) and not any(
                    not isinstance(parts[p], LiteralPart)
                    for p in range(start_pidx + 1, close_pidx + 1)
                    if p < len(parts)
                )
                return {
                    'open_part': start_pidx,
                    'open_char': ci,
                    'close_part': close_pidx,
                    'close_char': close_ci,
                    'comma_positions': commas,
                    'has_dotdot': has_dotdot,
                    'single_part': single_part,
                }
            ci += 1
    return None


def _extract_parts_between(parts: tuple, start_pidx: int, start_ci: int,
                           end_pidx: int, end_ci: int) -> list:
    """Extract word parts between two positions (exclusive of both endpoints).

    Positions refer to characters in LiteralParts. Everything between (start_pidx,
    start_ci) and (end_pidx, end_ci) is extracted, with LiteralParts sliced as needed.
    """
    result = []

    if start_pidx == end_pidx:
        # Same LiteralPart - extract substring
        part = parts[start_pidx]
        text = part.value[start_ci + 1:end_ci]
        if text:
            result.append(LiteralPart(value=text))
        return result

    # Remainder of start part (after start_ci)
    start_text = parts[start_pidx].value[start_ci + 1:]
    if start_text:
        result.append(LiteralPart(value=start_text))

    # All parts between start and end (exclusive)
    for i in range(start_pidx + 1, end_pidx):
        result.append(parts[i])

    # Beginning of end part (before end_ci)
    end_text = parts[end_pidx].value[:end_ci]
    if end_text:
        result.append(LiteralPart(value=end_text))

    return result


def _parts_before(parts: tuple, pidx: int, ci: int) -> list:
    """Get all parts before position (pidx, ci)."""
    result = list(parts[:pidx])
    text = parts[pidx].value[:ci]
    if text:
        result.append(LiteralPart(value=text))
    return result


def _parts_after(parts: tuple, pidx: int, ci: int) -> list:
    """Get all parts after position (pidx, ci)."""
    result = []
    text = parts[pidx].value[ci + 1:]
    if text:
        result.append(LiteralPart(value=text))
    result.extend(parts[pidx + 1:])
    return result


def _apply_array_operation_list(
    ctx: "InterpreterContext",
    arr_name: str,
    operation,
    is_star: bool,
) -> Optional[list[str]]:
    """Apply an operation to array elements and return as list (for [@]) or joined (for [*]).

    Returns None if the operation isn't one that we handle specially (e.g., DefaultValue).
    For [@], returns list of separate values.
    For [*], returns list with single IFS-joined value.
    """
    # Only handle operations we support: None (no op), Substring, PatternRemoval,
    # PatternReplacement, CaseModification. For others (DefaultValue, UseAlternative,
    # Transform, etc.), return None so normal expansion code handles them.
    if operation is not None and operation.type not in (
        "Substring", "PatternRemoval", "PatternReplacement", "CaseModification"
    ):
        return None

    elements = get_array_elements(ctx, arr_name)
    values = [v for _, v in elements]
    ifs = ctx.state.env.get("IFS", " \t\n")
    sep = ifs[0] if ifs else ""

    if operation is None:
        # No operation, just return the values
        if not elements:
            return [] if not is_star else [""]
        if is_star:
            return [sep.join(values)]
        return values

    # For operations we handle, empty array returns empty
    if not elements:
        return [] if not is_star else [""]

    if operation.type == "Substring":
        # Evaluate offset/length
        if hasattr(operation, 'offset_str') and operation.offset_str is not None:
            offset = _eval_array_subscript(ctx, operation.offset_str)
        else:
            offset = operation.offset if hasattr(operation, 'offset') else 0
        if hasattr(operation, 'length_str') and operation.length_str is not None:
            length = _eval_array_subscript(ctx, operation.length_str)
        else:
            length = operation.length if hasattr(operation, 'length') else None

        # Handle negative offset
        if offset < 0:
            offset = max(0, len(values) + offset)

        if length is not None:
            if length < 0:
                # Negative length in array slices is an error (bash 4.2+)
                raise ExitError(1, "", f"bash: {arr_name}[@]: bad substring expression\n")
            else:
                sliced = values[offset:offset + length]
        else:
            sliced = values[offset:]

        if is_star:
            return [sep.join(sliced)]
        return sliced

    elif operation.type == "PatternRemoval":
        pattern = expand_word_for_pattern(ctx, operation.pattern) if operation.pattern else ""
        greedy = operation.greedy
        from_end = operation.side == "suffix"
        extglob_on = ctx.state.env.get("__shopt_extglob__", "0") == "1"
        regex_pat = glob_to_regex(pattern, greedy=True, from_end=from_end, extglob=extglob_on)

        results = []
        for val in values:
            results.append(_apply_pattern_removal(val, regex_pat, pattern, greedy, from_end))

        if is_star:
            return [sep.join(results)]
        return results

    elif operation.type == "PatternReplacement":
        pattern = expand_word_for_pattern(ctx, operation.pattern) if operation.pattern else ""
        replacement = expand_word(ctx, operation.replacement) if operation.replacement else ""
        replace_all = operation.all
        anchor = getattr(operation, 'anchor', None)
        extglob_on = ctx.state.env.get("__shopt_extglob__", "0") == "1"

        # Empty pattern handling
        if not pattern:
            if anchor == "start":
                results = [replacement + v for v in values]
            elif anchor == "end":
                results = [v + replacement for v in values]
            else:
                results = values
        else:
            regex_pattern = glob_to_regex(pattern, greedy=True, extglob=extglob_on)
            results = []
            for val in values:
                results.append(_apply_pattern_replacement(val, regex_pattern, pattern, replacement, replace_all, anchor))

        if is_star:
            return [sep.join(results)]
        return results

    elif operation.type == "CaseModification":
        results = []
        for val in values:
            if operation.direction == "upper":
                if operation.all:
                    results.append(val.upper())
                else:
                    results.append(val[0].upper() + val[1:] if val else "")
            else:
                if operation.all:
                    results.append(val.lower())
                else:
                    results.append(val[0].lower() + val[1:] if val else "")

        if is_star:
            return [sep.join(results)]
        return results

    # Operation not handled specially
    return None


async def expand_word_with_glob(
    ctx: "InterpreterContext",
    word: WordNode,
    no_split: bool = False,
    no_glob: bool = False,
) -> dict:
    """Expand a word with glob expansion support.

    Returns dict with 'values' (list of strings) and 'quoted' (bool).
    If no_split is True, skip IFS word splitting (used for declaration
    builtin assignment values like 'export x=$var').
    If no_glob is True, skip glob expansion (used for declaration
    builtin assignment values like 'declare x=*').
    """
    # Check if word contains any quoted parts
    has_quoted = any(
        isinstance(p, (SingleQuotedPart, DoubleQuotedPart, EscapedPart))
        for p in word.parts
    )

    # Parts-level brace expansion: find leftmost brace pattern (may span parts)
    if not getattr(ctx.state.options, 'nobraceexpand', False):
        brace_info = _find_brace_across_parts(word.parts)
        if brace_info is not None:
            open_pidx = brace_info['open_part']
            open_ci = brace_info['open_char']
            close_pidx = brace_info['close_part']
            close_ci = brace_info['close_char']
            comma_positions = brace_info['comma_positions']
            is_single_part = brace_info['single_part']

            if is_single_part:
                # Pattern is entirely within a single LiteralPart - use string-based expansion
                # which handles both comma lists and sequences (like {1..10})
                lit_part = word.parts[open_pidx]
                content = lit_part.value[open_ci + 1:close_ci]

                before_parts = list(word.parts[:open_pidx])
                after_parts = list(word.parts[open_pidx + 1:])
                prefix_text = lit_part.value[:open_ci]
                suffix_text = lit_part.value[close_ci + 1:]
                if prefix_text:
                    before_parts.append(LiteralPart(value=prefix_text))
                if suffix_text:
                    after_parts.insert(0, LiteralPart(value=suffix_text))

                expansions = _expand_brace_content(content)

                # If the expansion returns the original {content} unchanged,
                # it means this wasn't a valid expansion - skip brace expansion
                original = '{' + content + '}'
                if len(expansions) == 1 and expansions[0] == original:
                    pass  # Fall through to normal expansion
                else:
                    all_results = []
                    # Check if suffix has quoted parts (preserves empty alternatives)
                    has_quoted_suffix = any(
                        isinstance(p, (SingleQuotedPart, DoubleQuotedPart, EscapedPart))
                        for p in after_parts
                    )
                    for exp_text in expansions:
                        new_parts = before_parts + [LiteralPart(value=exp_text)] + after_parts
                        new_word = WordNode(parts=tuple(new_parts))
                        sub_result = await expand_word_with_glob(ctx, new_word)
                        if sub_result["values"]:
                            all_results.extend(sub_result["values"])
                        elif has_quoted_suffix or before_parts:
                            # Preserve empty alternatives when there are quoted parts
                            all_results.append("")
                    return {"values": all_results, "quoted": False}
            else:
                # Cross-part brace expansion: braces span across quoted/expansion parts
                prefix_parts = _parts_before(word.parts, open_pidx, open_ci)
                suffix_parts = _parts_after(word.parts, close_pidx, close_ci)

                # Split content at top-level commas into alternatives
                split_points = [(open_pidx, open_ci)] + comma_positions + [(close_pidx, close_ci)]
                alternatives = []
                for k in range(len(split_points) - 1):
                    s_pidx, s_ci = split_points[k]
                    e_pidx, e_ci = split_points[k + 1]
                    alt_parts = _extract_parts_between(word.parts, s_pidx, s_ci, e_pidx, e_ci)
                    alternatives.append(alt_parts)

                all_results = []
                for alt_parts in alternatives:
                    new_parts = prefix_parts + alt_parts + suffix_parts
                    if not new_parts:
                        new_parts = [LiteralPart(value="")]
                    new_word = WordNode(parts=tuple(new_parts))
                    sub_result = await expand_word_with_glob(ctx, new_word)
                    if sub_result["values"]:
                        all_results.extend(sub_result["values"])
                    else:
                        all_results.append("")
                return {"values": all_results, "quoted": False}

    # Special handling for unquoted $@ and $* (and ${arr[@]} / ${arr[*]})
    # When unquoted, these produce individual elements, then each is IFS-split
    if len(word.parts) == 1 and isinstance(word.parts[0], ParameterExpansionPart):
        param_part = word.parts[0]
        if param_part.parameter in ("@", "*") and param_part.operation is None:
            params = _get_positional_params(ctx)
            if not params:
                return {"values": [], "quoted": False}
            ifs = ctx.state.env.get("IFS", " \t\n")
            result = []
            for p in params:
                if ifs:
                    split_words = _split_on_ifs(p, ifs)
                    result.extend(split_words)
                else:
                    result.append(p)
            return {"values": result, "quoted": False}
        # ${arr[@]} or ${arr[*]} unquoted
        array_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[[@*]\]$', param_part.parameter)
        if array_match and param_part.operation is None:
            arr_name = array_match.group(1)
            elements = get_array_elements(ctx, arr_name)
            if not elements:
                return {"values": [], "quoted": False}
            ifs = ctx.state.env.get("IFS", " \t\n")
            result = []
            for _, val in elements:
                if ifs:
                    split_words = _split_on_ifs(val, ifs)
                    result.extend(split_words)
                else:
                    result.append(val)
            return {"values": result, "quoted": False}

    # Special handling for "$@" and "$*" in double quotes
    # (check BEFORE segment expansion to avoid double command substitution)
    # "$@" expands to multiple words (one per positional parameter)
    # "$*" expands to single word (params joined by IFS)
    if len(word.parts) == 1 and isinstance(word.parts[0], DoubleQuotedPart):
        dq = word.parts[0]
        if len(dq.parts) == 1 and isinstance(dq.parts[0], ParameterExpansionPart):
            param_part = dq.parts[0]
            if param_part.parameter == "@" and param_part.operation is None:
                # "$@" - return each positional parameter as separate word
                params = _get_positional_params(ctx)
                if not params:
                    return {"values": [], "quoted": True}
                return {"values": params, "quoted": True}
            elif param_part.parameter == "*" and param_part.operation is None:
                # "$*" - return all params joined by first char of IFS
                params = _get_positional_params(ctx)
                ifs = ctx.state.env.get("IFS", " \t\n")
                sep = ifs[0] if ifs else ""
                return {"values": [sep.join(params)] if params else [""], "quoted": True}

            # "${arr[@]}" - return each array element as separate word
            # Also handle operations like ${arr[@]:1:2}, ${arr[@]#pat}, etc.
            array_at_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[@\]$', param_part.parameter)
            if array_at_match:
                arr_name = array_at_match.group(1)
                result = _apply_array_operation_list(ctx, arr_name, param_part.operation, is_star=False)
                if result is not None:
                    return {"values": result, "quoted": True}

            # "${arr[*]}" - join with first char of IFS
            # Also handle operations like ${arr[*]:1:2}, ${arr[*]#pat}, etc.
            array_star_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[\*\]$', param_part.parameter)
            if array_star_match:
                arr_name = array_star_match.group(1)
                result = _apply_array_operation_list(ctx, arr_name, param_part.operation, is_star=True)
                if result is not None:
                    return {"values": result, "quoted": True}

            # "${!arr[@]}" / "${!arr[*]}" - return array keys as separate words or joined
            if param_part.parameter.startswith("!") and param_part.operation is None:
                indirect = param_part.parameter[1:]
                array_keys_at = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[@\]$', indirect)
                if array_keys_at:
                    arr_name = array_keys_at.group(1)
                    keys = get_array_keys(ctx, arr_name)
                    if not keys:
                        return {"values": [], "quoted": True}
                    return {"values": keys, "quoted": True}
                array_keys_star = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[\*\]$', indirect)
                if array_keys_star:
                    arr_name = array_keys_star.group(1)
                    keys = get_array_keys(ctx, arr_name)
                    ifs = ctx.state.env.get("IFS", " \t\n")
                    sep = ifs[0] if ifs else ""
                    return {"values": [sep.join(keys)] if keys else [""], "quoted": True}

    # Handle more complex cases with "$@" embedded in other content
    # e.g., "prefix$@suffix" -> ["prefix$1", "$2", ..., "$nsuffix"]
    values = await _expand_word_with_at(ctx, word)
    if values is not None:
        return {"values": values, "quoted": True}

    # Expand word to segments (primary expansion, handles command substitution etc.)
    segments = await expand_word_segments(ctx, word)
    value = _segments_to_string(segments)
    # A word is "all quoted" if:
    # 1. Every segment is quoted AND there's at least one segment, OR
    # 2. The word was syntactically quoted (has_quoted) and the expansion is empty
    #    This handles cases like "${unset_var+alt}" where unset_var is unset - the
    #    double quotes should still preserve an empty argument.
    all_quoted = (bool(segments) and all(seg.quoted for seg in segments)) or (has_quoted and not segments)

    # For words with unquoted parts, perform glob expansion and IFS word splitting
    if not all_quoted:
        # Check for glob patterns in unquoted segments (unless noglob is set)
        noglob = getattr(ctx.state.options, 'noglob', False) or no_glob
        if not noglob and _segments_has_unquoted_glob(segments):
            # Build glob pattern from segments, escaping quoted parts
            glob_pattern = _segments_to_glob_pattern(segments)
            matches = await glob_expand(ctx, glob_pattern)
            if matches:
                return {"values": matches, "quoted": False}
            # No matches - check nullglob/failglob
            env = ctx.state.env
            if env.get("__shopt_nullglob__") == "1":
                return {"values": [], "quoted": False}
            if env.get("__shopt_failglob__") == "1":
                ctx.state.expansion_stderr = f"bash: no match: {value}\n"
                ctx.state.expansion_exit_code = 1
                return {"values": [], "quoted": False}

        # Perform IFS word splitting
        # Check if the word contained parameter/command expansion that should be split
        has_expansion = any(
            isinstance(p, (ParameterExpansionPart, CommandSubstitutionPart, ArithmeticExpansionPart))
            for p in word.parts
        )
        if has_expansion and not no_split:
            ifs = ctx.state.env.get("IFS", " \t\n")
            if ifs:
                # Split on IFS characters using segment-aware splitting
                words = _split_segments_on_ifs(segments, ifs)
                # After word splitting, glob-expand each word
                noglob = getattr(ctx.state.options, 'noglob', False) or no_glob
                if not noglob:
                    expanded_words = []
                    for w in words:
                        if any(c in w for c in "*?["):
                            matches = await glob_expand(ctx, w)
                            if matches:
                                expanded_words.extend(matches)
                            else:
                                # No match - check nullglob/failglob
                                env = ctx.state.env
                                if env.get("__shopt_nullglob__") == "1":
                                    pass  # Skip this word
                                elif env.get("__shopt_failglob__") == "1":
                                    ctx.state.expansion_stderr = f"bash: no match: {w}\n"
                                    ctx.state.expansion_exit_code = 1
                                else:
                                    expanded_words.append(w)  # Keep pattern literally
                        else:
                            expanded_words.append(w)
                    return {"values": expanded_words, "quoted": False}
                return {"values": words, "quoted": False}

        # Empty unquoted value produces no words
        if value == "":
            return {"values": [], "quoted": False}

    return {"values": [value], "quoted": all_quoted}


def _split_on_ifs(value: str, ifs: str) -> list[str]:
    """Split a string on IFS characters.

    IFS whitespace (space, tab, newline) is treated specially:
    - Leading/trailing IFS whitespace is trimmed
    - Consecutive IFS whitespace is treated as one delimiter
    Non-whitespace IFS characters produce empty fields.
    """
    if not value:
        return []

    # Empty IFS: no splitting at all
    if not ifs:
        return [value]

    # Identify which IFS chars are whitespace
    ifs_whitespace = "".join(c for c in ifs if c in " \t\n")
    ifs_nonws = "".join(c for c in ifs if c not in " \t\n")

    # If all IFS chars are whitespace, simple split
    if not ifs_nonws:
        return value.split()

    # Complex case: mix of whitespace and non-whitespace IFS
    # Whitespace adjacent to non-whitespace IFS chars forms composite delimiters
    result = []
    current = []
    i = 0

    # Skip leading IFS whitespace
    while i < len(value) and value[i] in ifs_whitespace:
        i += 1

    while i < len(value):
        c = value[i]
        if c in ifs_whitespace:
            # Whitespace delimiter
            if current:
                saved = "".join(current)
                current = []
            else:
                saved = None
            # Skip consecutive whitespace
            while i < len(value) and value[i] in ifs_whitespace:
                i += 1
            # Check if followed by non-ws IFS char (composite delimiter)
            if i < len(value) and value[i] in ifs_nonws:
                # Composite: ws + nonws counted as one delimiter
                if saved is not None:
                    result.append(saved)
                i += 1  # consume the nonws char
                # Skip trailing whitespace after nonws
                while i < len(value) and value[i] in ifs_whitespace:
                    i += 1
            else:
                if saved is not None:
                    result.append(saved)
        elif c in ifs_nonws:
            # Non-whitespace delimiter produces field
            result.append("".join(current))
            current = []
            i += 1
            # Skip trailing IFS whitespace after non-ws delimiter
            while i < len(value) and value[i] in ifs_whitespace:
                i += 1
        else:
            current.append(c)
            i += 1

    if current:
        result.append("".join(current))

    return result


def _get_word_raw_text(word: WordNode) -> str:
    """Get the raw text of a word (for brace expansion detection).

    Returns the literal text from all unquoted literal parts.
    """
    result = []
    for part in word.parts:
        if isinstance(part, LiteralPart):
            result.append(part.value)
        elif isinstance(part, SingleQuotedPart):
            # Quoted content doesn't participate in brace expansion
            result.append("'" + part.value + "'")
        elif isinstance(part, DoubleQuotedPart):
            # Quoted content doesn't participate in brace expansion
            result.append('"' + _get_parts_raw_text(part.parts) + '"')
        elif isinstance(part, EscapedPart):
            result.append('\\' + part.value)
        elif isinstance(part, ParameterExpansionPart):
            # Keep parameter expansion as-is for later expansion
            if part.operation:
                result.append("${" + part.parameter + "}")
            else:
                result.append("$" + part.parameter)
        elif isinstance(part, CommandSubstitutionPart):
            result.append("$()")  # Placeholder
        elif isinstance(part, ArithmeticExpansionPart):
            result.append("$(())")  # Placeholder
        else:
            # For other parts, use empty string
            pass
    return "".join(result)


def _get_parts_raw_text(parts: tuple) -> str:
    """Get raw text from a tuple of parts."""
    result = []
    for part in parts:
        if isinstance(part, LiteralPart):
            result.append(part.value)
        elif isinstance(part, ParameterExpansionPart):
            if part.operation:
                result.append("${" + part.parameter + "}")
            else:
                result.append("$" + part.parameter)
    return "".join(result)


async def _expand_word_without_braces(
    ctx: "InterpreterContext",
    word: WordNode,
) -> dict:
    """Expand a word without brace expansion (to avoid infinite recursion)."""
    # Check if word contains any quoted parts
    has_quoted = any(
        isinstance(p, (SingleQuotedPart, DoubleQuotedPart, EscapedPart))
        for p in word.parts
    )

    # Expand the word
    value = await expand_word_async(ctx, word)

    # For unquoted words, perform IFS word splitting and glob expansion
    if not has_quoted:
        # Check for glob patterns first (including extglob)
        if any(c in value for c in "*?[") or re.search(r'[@?*+!]\(', value):
            matches = await glob_expand(ctx, value)
            if matches:
                return {"values": matches, "quoted": False}

        # Perform IFS word splitting
        if value == "":
            return {"values": [], "quoted": False}

        # Check if the word contained parameter/command expansion that should be split
        has_expansion = any(
            isinstance(p, (ParameterExpansionPart, CommandSubstitutionPart, ArithmeticExpansionPart))
            for p in word.parts
        )
        if has_expansion:
            ifs = ctx.state.env.get("IFS", " \t\n")
            if ifs:
                # Split on IFS characters
                words = _split_on_ifs(value, ifs)
                return {"values": words, "quoted": False}

    return {"values": [value], "quoted": has_quoted}


def _get_positional_params(ctx: "InterpreterContext") -> list[str]:
    """Get all positional parameters ($1, $2, ...) as a list."""
    params = []
    i = 1
    while str(i) in ctx.state.env:
        params.append(ctx.state.env[str(i)])
        i += 1
    return params


async def _expand_word_with_at(ctx: "InterpreterContext", word: WordNode) -> list[str] | None:
    """Expand a word that may contain $@ in double quotes.

    Returns None if the word doesn't contain $@ in double quotes.
    Returns list of expanded values if it does.
    """
    # Check if any part contains $@ in double quotes
    has_at_in_quotes = False
    for part in word.parts:
        if isinstance(part, DoubleQuotedPart):
            for inner in part.parts:
                if (isinstance(inner, ParameterExpansionPart) and
                    inner.parameter == "@" and inner.operation is None):
                    has_at_in_quotes = True
                    break

    if not has_at_in_quotes:
        return None

    # Get positional parameters
    params = _get_positional_params(ctx)
    if not params:
        # No positional params - expand without $@
        result = []
        for part in word.parts:
            if isinstance(part, DoubleQuotedPart):
                inner_result = []
                for inner in part.parts:
                    if (isinstance(inner, ParameterExpansionPart) and
                        inner.parameter == "@" and inner.operation is None):
                        pass  # Skip $@ - produces nothing
                    else:
                        inner_result.append(await expand_part(ctx, inner, in_double_quotes=True))
                result.append("".join(inner_result))
            else:
                result.append(await expand_part(ctx, part))
        return ["".join(result)] if "".join(result) else []

    # Complex case: expand $@ to multiple words
    # For "prefix$@suffix", produce ["prefix$1", "$2", ..., "$n-1", "$nsuffix"]
    # Build prefix (everything before $@) and suffix (everything after $@)
    prefix_parts = []
    suffix_parts = []
    found_at = False

    for part in word.parts:
        if isinstance(part, DoubleQuotedPart):
            for inner in part.parts:
                if (isinstance(inner, ParameterExpansionPart) and
                    inner.parameter == "@" and inner.operation is None):
                    found_at = True
                elif not found_at:
                    prefix_parts.append(await expand_part(ctx, inner, in_double_quotes=True))
                else:
                    suffix_parts.append(await expand_part(ctx, inner, in_double_quotes=True))
        elif not found_at:
            prefix_parts.append(await expand_part(ctx, part))
        else:
            suffix_parts.append(await expand_part(ctx, part))

    prefix = "".join(prefix_parts)
    suffix = "".join(suffix_parts)

    # Build result: first param gets prefix, last param gets suffix
    if len(params) == 1:
        return [prefix + params[0] + suffix]
    else:
        result = [prefix + params[0]]
        result.extend(params[1:-1])
        result.append(params[-1] + suffix)
        return result


async def glob_expand(ctx: "InterpreterContext", pattern: str) -> list[str]:
    """Expand a glob pattern against the filesystem."""
    import os

    cwd = ctx.state.cwd
    fs = ctx.fs
    env = ctx.state.env

    # Check shopt options
    dotglob = env.get("__shopt_dotglob__") == "1"
    globstar = env.get("__shopt_globstar__") == "1"

    # Handle absolute vs relative paths
    original_pattern = pattern
    if pattern.startswith("/"):
        base_dir = "/"
        pattern = pattern[1:]
    else:
        base_dir = cwd

    # Split pattern into parts
    parts = pattern.split("/")

    def _should_include(entry: str, pattern_part: str) -> bool:
        """Check if an entry should be included (dotfile filtering)."""
        if entry.startswith("."):
            # Dotfiles only match if: dotglob is on, or pattern starts with '.'
            if not dotglob and not pattern_part.startswith("."):
                return False
        return True

    async def _recurse_dirs(current_dir: str) -> list[str]:
        """Recursively list all directories for globstar."""
        dirs = [current_dir]
        try:
            entries = await fs.readdir(current_dir)
        except (FileNotFoundError, NotADirectoryError):
            return dirs
        for entry in entries:
            if entry.startswith(".") and not dotglob:
                continue
            path = os.path.join(current_dir, entry)
            if await fs.is_directory(path):
                dirs.extend(await _recurse_dirs(path))
        return dirs

    async def expand_parts(current_dir: str, remaining_parts: list[str]) -> list[str]:
        if not remaining_parts:
            return [current_dir]

        part = remaining_parts[0]
        rest = remaining_parts[1:]

        # Handle globstar (**)
        if part == "**" and globstar:
            all_dirs = await _recurse_dirs(current_dir)
            results = []
            for d in all_dirs:
                if rest:
                    results.extend(await expand_parts(d, rest))
                else:
                    # ** alone matches everything recursively
                    try:
                        entries = await fs.readdir(d)
                        for entry in entries:
                            if _should_include(entry, "*"):
                                results.append(os.path.join(d, entry))
                    except (FileNotFoundError, NotADirectoryError):
                        pass
                    results.append(d)
            return sorted(set(results))

        # Check if this part has glob characters (including extglob)
        has_glob = any(c in part for c in "*?[")
        has_extglob = bool(re.search(r'[@?*+!]\(', part))
        if not has_glob and not has_extglob:
            # No glob - just check if path exists
            new_path = os.path.join(current_dir, part)
            if await fs.exists(new_path):
                return await expand_parts(new_path, rest)
            return []

        # Glob expansion needed
        try:
            entries = await fs.readdir(current_dir)
        except (FileNotFoundError, NotADirectoryError):
            return []

        # Use regex matching for extglob patterns, fnmatch for standard globs
        if has_extglob:
            regex_pat = "^" + glob_to_regex(part) + "$"
            try:
                compiled = re.compile(regex_pat)
            except re.error:
                compiled = None
        else:
            compiled = None

        matches = []
        for entry in entries:
            if not _should_include(entry, part):
                continue
            if compiled:
                matched = compiled.match(entry) is not None
            else:
                matched = fnmatch.fnmatch(entry, part)
            if matched:
                new_path = os.path.join(current_dir, entry)
                if rest:
                    # More parts to match - entry must be a directory
                    if await fs.is_directory(new_path):
                        matches.extend(await expand_parts(new_path, rest))
                else:
                    matches.append(new_path)

        return sorted(matches)

    results = await expand_parts(base_dir, parts)

    # Return relative paths if pattern was relative
    if not original_pattern.startswith("/") and results:
        results = [os.path.relpath(r, cwd) if r.startswith(cwd) else r for r in results]

    return results


def _parse_base_n_value(value_str: str, base: int) -> int:
    """Parse a value in base N (2-64).

    Digits:
    - 0-9 = values 0-9
    - a-z = values 10-35
    - A-Z = values 36-61 (or 10-35 if base <= 36)
    - @ = 62, _ = 63
    """
    result = 0
    for char in value_str:
        if char.isdigit():
            digit = int(char)
        elif 'a' <= char <= 'z':
            digit = ord(char) - ord('a') + 10
        elif 'A' <= char <= 'Z':
            if base <= 36:
                # Case insensitive for bases <= 36
                digit = ord(char.lower()) - ord('a') + 10
            else:
                # A-Z are 36-61 for bases > 36
                digit = ord(char) - ord('A') + 36
        elif char == '@':
            digit = 62
        elif char == '_':
            digit = 63
        else:
            raise ValueError(f"Invalid digit {char} for base {base}")

        if digit >= base:
            raise ValueError(f"Digit {char} out of range for base {base}")

        result = result * base + digit
    return result


def _parse_arith_value(val: str) -> int:
    """Parse a string value as an arithmetic integer.

    Handles octal (0NNN), hex (0xNNN), and base-N (N#NNN) constants
    like bash does when evaluating variable values in arithmetic context.
    """
    if not val:
        return 0
    val = val.strip()
    if not val:
        return 0
    # Handle negative numbers
    if val.startswith("-"):
        rest = val[1:].strip()
        if rest:
            return -_parse_arith_value(rest)
    if val.startswith("+"):
        val = val[1:].strip()
    # Hex
    if val.startswith("0x") or val.startswith("0X"):
        try:
            return int(val, 16)
        except ValueError:
            return 0
    # Base-N: N#value
    if "#" in val:
        parts = val.split("#", 1)
        try:
            base = int(parts[0])
            if 2 <= base <= 64:
                return _parse_base_n_value(parts[1], base)
        except (ValueError, TypeError):
            pass
        return 0
    # Octal (starts with 0 and has more digits)
    if val.startswith("0") and len(val) > 1 and val[1:].isdigit():
        try:
            return int(val, 8)
        except ValueError:
            return 0
    # Regular integer
    try:
        return int(val)
    except ValueError:
        return 0


# Thread-local recursion guard for arithmetic variable resolution
_arith_resolve_depth = 0
_MAX_ARITH_DEPTH = 32


def _resolve_arith_variable(ctx: "InterpreterContext", val: str) -> int:
    """Resolve a variable value in arithmetic context with recursive evaluation.

    In bash, variable values in arithmetic are recursively evaluated:
    - If val is "y" and y=3, evaluates to 3
    - If val is "1+2", evaluates to 3
    """
    global _arith_resolve_depth

    if not val:
        return 0
    val = val.strip()
    if not val:
        return 0

    # Try as a plain number first (most common case)
    plain = _parse_arith_value(val)
    try:
        int(val.strip().lstrip("+-"))  # Check if it's truly numeric
        return plain
    except ValueError:
        pass

    # Check for hex/octal/base-N that _parse_arith_value handles
    stripped = val.strip().lstrip("+-")
    if stripped.startswith("0x") or stripped.startswith("0X"):
        return plain
    if "#" in stripped:
        return plain
    if stripped.startswith("0") and len(stripped) > 1 and stripped[1:].isdigit():
        return plain

    # Guard against infinite recursion
    _arith_resolve_depth += 1
    if _arith_resolve_depth > _MAX_ARITH_DEPTH:
        _arith_resolve_depth -= 1
        return 0

    try:
        # If val is a valid identifier, try looking it up as a variable
        import re as _re
        if _re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', val):
            var_val = get_variable(ctx, val, False)
            if var_val and var_val != val:
                return _resolve_arith_variable(ctx, var_val)
            return 0

        # Try parsing as an arithmetic expression
        from ..parser.parser import Parser
        from ..parser.lexer import Lexer
        try:
            lexer = Lexer(val)
            parser = Parser(lexer)
            arith_node = parser.parse_arithmetic_expression()
            if arith_node:
                return evaluate_arithmetic_sync(ctx, arith_node)
        except Exception:
            pass

        return 0
    finally:
        _arith_resolve_depth -= 1


def evaluate_arithmetic_sync(ctx: "InterpreterContext", expr) -> int:
    """Evaluate an arithmetic expression synchronously."""
    # Simple implementation for basic arithmetic
    if hasattr(expr, 'type'):
        if expr.type == "ArithNumber":
            return expr.value
        elif expr.type == "ArithVariable":
            name = expr.name
            # Detect floating point numbers - bash doesn't support them in arithmetic
            if "." in name and not name.startswith("$"):
                # Check if it looks like a float (digits around a dot)
                dot_pos = name.index(".")
                before_dot = name[:dot_pos]
                after_dot = name[dot_pos:]
                if before_dot.isdigit() or (not before_dot and after_dot[1:].isdigit()):
                    raise ValueError(
                        f"{name}: syntax error: invalid arithmetic operator (error token is \"{after_dot}\")"
                    )
            # Handle dynamic base constants like $base#value or base#value where base is a variable
            if "#" in name and not name.startswith("$"):
                hash_pos = name.index("#")
                base_part = name[:hash_pos]
                value_part = name[hash_pos + 1:]
                # Check if base_part is a variable reference
                if base_part.startswith("$"):
                    base_var = base_part[1:]
                    if base_var.startswith("{") and base_var.endswith("}"):
                        base_var = base_var[1:-1]
                    base_str = get_variable(ctx, base_var, False)
                else:
                    # Try treating base_part as a variable name
                    base_str = get_variable(ctx, base_part, False)
                    if not base_str:
                        # Fall back to treating as literal
                        base_str = base_part
                try:
                    base = int(base_str)
                    if 2 <= base <= 64:
                        return _parse_base_n_value(value_part, base)
                except (ValueError, TypeError):
                    pass
            # Handle ${...} parameter expansion that parser fell back to ArithVariable
            if name.startswith("${") and name.endswith("}"):
                inner = name[2:-1]
                val = _expand_braced_param_sync(ctx, inner)
                return _resolve_arith_variable(ctx, val)
            # Handle $var simple variable reference
            if name.startswith("$") and not name.startswith("$("):
                var_name = name[1:]
                if var_name.startswith("{") and var_name.endswith("}"):
                    var_name = var_name[1:-1]
                val = get_variable(ctx, var_name, False)
                return _resolve_arith_variable(ctx, val)
            # Bare variable name - resolve recursively (x → y → 3)
            val = get_variable(ctx, name, False)
            return _resolve_arith_variable(ctx, val)
        elif expr.type == "ArithBinary":
            op = expr.operator
            # Short-circuit for && and ||
            if op == "&&":
                left = evaluate_arithmetic_sync(ctx, expr.left)
                if not left:
                    return 0
                right = evaluate_arithmetic_sync(ctx, expr.right)
                return 1 if right else 0
            elif op == "||":
                left = evaluate_arithmetic_sync(ctx, expr.left)
                if left:
                    return 1
                right = evaluate_arithmetic_sync(ctx, expr.right)
                return 1 if right else 0
            elif op == ",":
                # Comma operator: evaluate both, return right
                evaluate_arithmetic_sync(ctx, expr.left)
                return evaluate_arithmetic_sync(ctx, expr.right)
            else:
                left = evaluate_arithmetic_sync(ctx, expr.left)
                right = evaluate_arithmetic_sync(ctx, expr.right)
            if op == "+":
                return left + right
            elif op == "-":
                return left - right
            elif op == "*":
                return left * right
            elif op == "/":
                if right == 0:
                    raise ValueError("division by 0")
                # C-style truncation toward zero (not Python floor division)
                return int(left / right)
            elif op == "%":
                if right == 0:
                    raise ValueError("division by 0")
                # C-style modulo: sign follows dividend
                return int(left - int(left / right) * right)
            elif op == "**":
                if right < 0:
                    raise ValueError("exponent less than 0")
                return left ** right
            elif op == "<":
                return 1 if left < right else 0
            elif op == ">":
                return 1 if left > right else 0
            elif op == "<=":
                return 1 if left <= right else 0
            elif op == ">=":
                return 1 if left >= right else 0
            elif op == "==":
                return 1 if left == right else 0
            elif op == "!=":
                return 1 if left != right else 0
            elif op == "&":
                return left & right
            elif op == "|":
                return left | right
            elif op == "^":
                return left ^ right
            elif op == "<<":
                return left << right
            elif op == ">>":
                return left >> right
        elif expr.type == "ArithUnary":
            op = expr.operator
            # Handle increment/decrement specially (need variable name)
            if op in ("++", "--"):
                if hasattr(expr.operand, 'name'):
                    var_name = expr.operand.name
                    val = get_variable(ctx, var_name, False)
                    try:
                        current = int(val) if val else 0
                    except ValueError:
                        current = 0
                    new_val = current + 1 if op == "++" else current - 1

                    # Handle array element syntax: arr[idx]
                    array_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[(.+)\]$', var_name)
                    if array_match:
                        arr_name = array_match.group(1)
                        subscript = array_match.group(2)
                        idx = _eval_array_subscript(ctx, subscript)
                        ctx.state.env[f"{arr_name}_{idx}"] = str(new_val)
                    else:
                        ctx.state.env[var_name] = str(new_val)

                    # Prefix returns new value, postfix returns old value
                    return new_val if expr.prefix else current
                else:
                    # Operand is not a variable - just evaluate
                    operand = evaluate_arithmetic_sync(ctx, expr.operand)
                    return operand + 1 if op == "++" else operand - 1
            operand = evaluate_arithmetic_sync(ctx, expr.operand)
            if op == "-":
                return -operand
            elif op == "+":
                return operand
            elif op == "!":
                return 0 if operand else 1
            elif op == "~":
                return ~operand
        elif expr.type == "ArithTernary":
            cond = evaluate_arithmetic_sync(ctx, expr.condition)
            if cond:
                return evaluate_arithmetic_sync(ctx, expr.consequent)
            else:
                return evaluate_arithmetic_sync(ctx, expr.alternate)
        elif expr.type == "ArithAssignment":
            # Handle compound assignments: = += -= *= /= %= <<= >>= &= |= ^=
            op = getattr(expr, 'operator', '=')
            var_name = getattr(expr, 'variable', None) or getattr(expr, 'name', None)
            subscript = getattr(expr, 'subscript', None)
            string_key = getattr(expr, 'string_key', None)
            rhs = evaluate_arithmetic_sync(ctx, expr.value)

            # Determine the storage key (for arrays, use arr_idx format)
            store_key = var_name
            if subscript is not None and var_name:
                idx = evaluate_arithmetic_sync(ctx, subscript)
                store_key = f"{var_name}_{idx}"
                # Mark as array if not already
                if f"{var_name}__is_array" not in ctx.state.env:
                    ctx.state.env[f"{var_name}__is_array"] = "indexed"
            elif string_key is not None and var_name:
                store_key = f"{var_name}_{string_key}"
                if f"{var_name}__is_array" not in ctx.state.env:
                    ctx.state.env[f"{var_name}__is_array"] = "assoc"

            if op == '=':
                value = rhs
            else:
                # Get current value for compound operators
                current = 0
                if store_key:
                    val = ctx.state.env.get(store_key, "")
                    if not val and var_name and subscript is None and string_key is None:
                        val = get_variable(ctx, var_name, False)
                    try:
                        current = int(val) if val else 0
                    except ValueError:
                        current = 0

                if op == '+=':
                    value = current + rhs
                elif op == '-=':
                    value = current - rhs
                elif op == '*=':
                    value = current * rhs
                elif op == '/=':
                    if rhs == 0:
                        raise ValueError("division by 0")
                    value = int(current / rhs)
                elif op == '%=':
                    if rhs == 0:
                        raise ValueError("division by 0")
                    value = int(current - int(current / rhs) * rhs)
                elif op == '<<=':
                    value = current << rhs
                elif op == '>>=':
                    value = current >> rhs
                elif op == '&=':
                    value = current & rhs
                elif op == '|=':
                    value = current | rhs
                elif op == '^=':
                    value = current ^ rhs
                else:
                    value = rhs

            if store_key:
                ctx.state.env[store_key] = str(value)
            return value
        elif expr.type == "ArithGroup":
            return evaluate_arithmetic_sync(ctx, expr.expression)
        elif expr.type == "ArithNested":
            # Nested arithmetic expansion: $((expr)) within arithmetic
            if expr.expression:
                return evaluate_arithmetic_sync(ctx, expr.expression)
            return 0
        elif expr.type == "ArithArrayElement":
            # Array element access: arr[idx]
            arr_name = expr.array
            if expr.string_key is not None:
                # Associative array
                val = ctx.state.env.get(f"{arr_name}_{expr.string_key}", "")
            elif expr.index is not None:
                idx = evaluate_arithmetic_sync(ctx, expr.index)
                val = ctx.state.env.get(f"{arr_name}_{idx}", "")
            else:
                val = ""
            return _parse_arith_value(val)
        elif expr.type == "ArithConcat":
            # Concatenation of parts forming a single numeric value
            result_str = ""
            for part in expr.parts:
                result_str += str(evaluate_arithmetic_sync(ctx, part))
            return _parse_arith_value(result_str)
        elif expr.type == "ArithDynamicBase":
            # Dynamic base constant: ${base}#value
            base_str = get_variable(ctx, expr.base_expr, False)
            try:
                base = int(base_str)
                if 2 <= base <= 64:
                    return _parse_base_n_value(expr.value, base)
            except (ValueError, TypeError):
                pass
            return 0
        elif expr.type == "ArithDynamicNumber":
            # Dynamic number prefix: ${zero}11 or ${zero}xAB
            prefix = get_variable(ctx, expr.prefix, False)
            full = prefix + expr.suffix
            return _parse_arith_value(full)
        elif expr.type in ("ArithBracedExpansion", "ArithCommandSubst"):
            # These need async handling - in sync mode, try basic resolution
            if expr.type == "ArithBracedExpansion":
                content = expr.content
                val = _expand_braced_param_sync(ctx, content)
                return _parse_arith_value(val)
            # Command substitution can't be done synchronously
            return 0
        elif expr.type in ("ArithDoubleSubscript", "ArithNumberSubscript"):
            # Invalid syntax
            return 0
    return 0


async def evaluate_arithmetic(ctx: "InterpreterContext", expr) -> int:
    """Evaluate an arithmetic expression asynchronously.

    Handles command substitution and parameter expansion within arithmetic.
    """
    if not expr or not hasattr(expr, 'type'):
        return 0

    if expr.type == "ArithNumber":
        return expr.value
    elif expr.type == "ArithVariable":
        name = expr.name
        # Detect floating point numbers - bash doesn't support them in arithmetic
        if "." in name and not name.startswith("$"):
            dot_pos = name.index(".")
            before_dot = name[:dot_pos]
            after_dot = name[dot_pos:]
            if before_dot.isdigit() or (not before_dot and after_dot[1:].isdigit()):
                raise ValueError(
                    f"{name}: syntax error: invalid arithmetic operator (error token is \"{after_dot}\")"
                )
        # Handle dynamic base constants
        if "#" in name and not name.startswith("$"):
            hash_pos = name.index("#")
            base_part = name[:hash_pos]
            value_part = name[hash_pos + 1:]
            if base_part.startswith("$"):
                base_var = base_part[1:]
                if base_var.startswith("{") and base_var.endswith("}"):
                    base_var = base_var[1:-1]
                base_str = get_variable(ctx, base_var, False)
            else:
                base_str = get_variable(ctx, base_part, False)
                if not base_str:
                    base_str = base_part
            try:
                base = int(base_str)
                if 2 <= base <= 64:
                    return _parse_base_n_value(value_part, base)
            except (ValueError, TypeError):
                pass
        # Handle $((expr)) nested arithmetic in variable name
        if name.startswith("$((") and name.endswith("))"):
            inner = name[3:-2]
            from ..parser.parser import Parser
            parser = Parser()
            inner_expr = parser._parse_arithmetic_expression(inner)
            return await evaluate_arithmetic(ctx, inner_expr)
        # Handle $(cmd) command substitution in variable name
        if name.startswith("$(") and name.endswith(")") and not name.startswith("$(("):
            cmd = name[2:-1]
            if ctx.exec_fn:
                result = await ctx.exec_fn(cmd, None, None)
                val = result.stdout.rstrip("\n")
                return _parse_arith_value(val)
            return 0
        # Handle ${...} parameter expansion
        if name.startswith("${") and name.endswith("}"):
            inner = name[2:-1]
            val = _expand_braced_param_sync(ctx, inner)
            return _resolve_arith_variable(ctx, val)
        # Handle $var
        if name.startswith("$") and not name.startswith("$("):
            var_name = name[1:]
            if var_name.startswith("{") and var_name.endswith("}"):
                var_name = var_name[1:-1]
            val = get_variable(ctx, var_name, False)
            return _resolve_arith_variable(ctx, val)
        # Bare variable name - resolve recursively
        val = get_variable(ctx, name, False)
        return _resolve_arith_variable(ctx, val)
    elif expr.type == "ArithBinary":
        op = expr.operator
        if op == "&&":
            left = await evaluate_arithmetic(ctx, expr.left)
            if not left:
                return 0
            right = await evaluate_arithmetic(ctx, expr.right)
            return 1 if right else 0
        elif op == "||":
            left = await evaluate_arithmetic(ctx, expr.left)
            if left:
                return 1
            right = await evaluate_arithmetic(ctx, expr.right)
            return 1 if right else 0
        elif op == ",":
            await evaluate_arithmetic(ctx, expr.left)
            return await evaluate_arithmetic(ctx, expr.right)
        else:
            left = await evaluate_arithmetic(ctx, expr.left)
            right = await evaluate_arithmetic(ctx, expr.right)
        if op == "+":
            return left + right
        elif op == "-":
            return left - right
        elif op == "*":
            return left * right
        elif op == "/":
            if right == 0:
                raise ValueError("division by 0")
            return int(left / right)
        elif op == "%":
            if right == 0:
                raise ValueError("division by 0")
            return int(left - int(left / right) * right)
        elif op == "**":
            if right < 0:
                raise ValueError("exponent less than 0")
            return left ** right
        elif op == "<":
            return 1 if left < right else 0
        elif op == ">":
            return 1 if left > right else 0
        elif op == "<=":
            return 1 if left <= right else 0
        elif op == ">=":
            return 1 if left >= right else 0
        elif op == "==":
            return 1 if left == right else 0
        elif op == "!=":
            return 1 if left != right else 0
        elif op == "&":
            return left & right
        elif op == "|":
            return left | right
        elif op == "^":
            return left ^ right
        elif op == "<<":
            return left << right
        elif op == ">>":
            return left >> right
    elif expr.type == "ArithUnary":
        op = expr.operator
        if op in ("++", "--"):
            if hasattr(expr.operand, 'name'):
                var_name = expr.operand.name
                val = get_variable(ctx, var_name, False)
                try:
                    current = int(val) if val else 0
                except ValueError:
                    current = 0
                new_val = current + 1 if op == "++" else current - 1
                array_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[(.+)\]$', var_name)
                if array_match:
                    arr_name = array_match.group(1)
                    subscript = array_match.group(2)
                    idx = _eval_array_subscript(ctx, subscript)
                    ctx.state.env[f"{arr_name}_{idx}"] = str(new_val)
                else:
                    ctx.state.env[var_name] = str(new_val)
                return new_val if expr.prefix else current
            else:
                operand = await evaluate_arithmetic(ctx, expr.operand)
                return operand + 1 if op == "++" else operand - 1
        operand = await evaluate_arithmetic(ctx, expr.operand)
        if op == "-":
            return -operand
        elif op == "+":
            return operand
        elif op == "!":
            return 0 if operand else 1
        elif op == "~":
            return ~operand
    elif expr.type == "ArithTernary":
        cond = await evaluate_arithmetic(ctx, expr.condition)
        if cond:
            return await evaluate_arithmetic(ctx, expr.consequent)
        else:
            return await evaluate_arithmetic(ctx, expr.alternate)
    elif expr.type == "ArithAssignment":
        op = getattr(expr, 'operator', '=')
        var_name = getattr(expr, 'variable', None) or getattr(expr, 'name', None)
        subscript = getattr(expr, 'subscript', None)
        string_key = getattr(expr, 'string_key', None)
        rhs = await evaluate_arithmetic(ctx, expr.value)

        store_key = var_name
        if subscript is not None and var_name:
            idx = await evaluate_arithmetic(ctx, subscript)
            store_key = f"{var_name}_{idx}"
            if f"{var_name}__is_array" not in ctx.state.env:
                ctx.state.env[f"{var_name}__is_array"] = "indexed"
        elif string_key is not None and var_name:
            store_key = f"{var_name}_{string_key}"
            if f"{var_name}__is_array" not in ctx.state.env:
                ctx.state.env[f"{var_name}__is_array"] = "assoc"

        if op == '=':
            value = rhs
        else:
            current = 0
            if store_key:
                val = ctx.state.env.get(store_key, "")
                if not val and var_name and subscript is None and string_key is None:
                    val = get_variable(ctx, var_name, False)
                try:
                    current = int(val) if val else 0
                except ValueError:
                    current = 0
            if op == '+=':
                value = current + rhs
            elif op == '-=':
                value = current - rhs
            elif op == '*=':
                value = current * rhs
            elif op == '/=':
                if rhs == 0:
                    raise ValueError("division by 0")
                value = int(current / rhs)
            elif op == '%=':
                if rhs == 0:
                    raise ValueError("division by 0")
                value = int(current - int(current / rhs) * rhs)
            elif op == '<<=':
                value = current << rhs
            elif op == '>>=':
                value = current >> rhs
            elif op == '&=':
                value = current & rhs
            elif op == '|=':
                value = current | rhs
            elif op == '^=':
                value = current ^ rhs
            else:
                value = rhs

        if store_key:
            ctx.state.env[store_key] = str(value)
        return value
    elif expr.type == "ArithGroup":
        return await evaluate_arithmetic(ctx, expr.expression)
    elif expr.type == "ArithNested":
        if expr.expression:
            return await evaluate_arithmetic(ctx, expr.expression)
        return 0
    elif expr.type == "ArithCommandSubst":
        # Execute command and parse result as integer
        if ctx.exec_fn:
            result = await ctx.exec_fn(expr.command, None, None)
            val = result.stdout.rstrip("\n")
            return _parse_arith_value(val)
        return 0
    elif expr.type == "ArithBracedExpansion":
        val = _expand_braced_param_sync(ctx, expr.content)
        return _parse_arith_value(val)
    elif expr.type == "ArithArrayElement":
        arr_name = expr.array
        if expr.string_key is not None:
            val = ctx.state.env.get(f"{arr_name}_{expr.string_key}", "")
        elif expr.index is not None:
            idx = await evaluate_arithmetic(ctx, expr.index)
            val = ctx.state.env.get(f"{arr_name}_{idx}", "")
        else:
            val = ""
        return _parse_arith_value(val)
    elif expr.type == "ArithConcat":
        result_str = ""
        for part in expr.parts:
            result_str += str(await evaluate_arithmetic(ctx, part))
        return _parse_arith_value(result_str)
    elif expr.type == "ArithDynamicBase":
        base_str = get_variable(ctx, expr.base_expr, False)
        try:
            base = int(base_str)
            if 2 <= base <= 64:
                return _parse_base_n_value(expr.value, base)
        except (ValueError, TypeError):
            pass
        return 0
    elif expr.type == "ArithDynamicNumber":
        prefix = get_variable(ctx, expr.prefix, False)
        full = prefix + expr.suffix
        return _parse_arith_value(full)
    elif expr.type in ("ArithDoubleSubscript", "ArithNumberSubscript"):
        return 0
    return 0
