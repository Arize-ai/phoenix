"""Set and shift builtin implementations.

set - Set or unset shell options and positional parameters.

Usage: set [options] [-- arg ...]
       set +o
       set -o [option]

Options:
  -e  errexit    Exit immediately if a command exits with non-zero status
  -u  nounset    Treat unset variables as an error when substituting
  -x  xtrace     Print commands and their arguments as they are executed
  -v  verbose    Print shell input lines as they are read
  -o pipefail    Return exit status of last failing command in pipeline

shift - Shift positional parameters.

Usage: shift [n]

Shift positional parameters to the left by n (default 1).
"""

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..types import InterpreterContext
    from ...types import ExecResult

_SAFE_VALUE_RE = re.compile(r'^[a-zA-Z0-9_/.,:@%^+=~-]+$')


def _shell_quote_value(value: str) -> str:
    """Quote a value for set output, matching bash behavior.

    Simple values (alphanumeric etc.) are unquoted.
    Empty values become ''.
    Values with special chars are single-quoted with embedded
    single quotes escaped as '\\''."""
    if not value:
        return "''"
    if _SAFE_VALUE_RE.match(value):
        return value
    return "'" + value.replace("'", "'\\''") + "'"


async def handle_set(ctx: "InterpreterContext", args: list[str]) -> "ExecResult":
    """Execute the set builtin."""
    from ...types import ExecResult

    # No arguments: print all variables
    if not args:
        lines = []
        for k, v in sorted(ctx.state.env.items()):
            # Skip internal variables
            if k.startswith("PIPESTATUS_") or k == "?":
                continue
            lines.append(f"{k}={_shell_quote_value(v)}")
        return ExecResult(stdout="\n".join(lines) + "\n", stderr="", exit_code=0)

    i = 0
    while i < len(args):
        arg = args[i]

        # Handle -- which starts positional parameters
        if arg == "--":
            # Set positional parameters from remaining args
            new_params = args[i + 1:]
            _set_positional_params(ctx, new_params)
            return ExecResult(stdout="", stderr="", exit_code=0)

        # Handle bare `-`: stops option processing, remaining args are positional params.
        # Also turns off -x and -v (bash behavior).
        if arg == "-":
            ctx.state.options.xtrace = False
            ctx.state.options.verbose = False
            # Remaining args become positional parameters
            if i + 1 < len(args):
                _set_positional_params(ctx, args[i + 1:])
            return ExecResult(stdout="", stderr="", exit_code=0)

        # Handle bare `+`: ignored as a flag (no-op), continue processing
        if arg == "+":
            i += 1
            continue

        # Handle -o option
        if arg == "-o":
            if i + 1 < len(args):
                i += 1
                opt_name = args[i]
                result = _set_option(ctx, opt_name, True)
                if result:
                    return result
            else:
                # List all options
                stdout = _list_options(ctx)
                return ExecResult(stdout=stdout, stderr="", exit_code=0)

        # Handle +o option
        elif arg == "+o":
            if i + 1 < len(args):
                i += 1
                opt_name = args[i]
                result = _set_option(ctx, opt_name, False)
                if result:
                    return result
            else:
                # List all options in a format that can be re-input
                stdout = _list_options_script(ctx)
                return ExecResult(stdout=stdout, stderr="", exit_code=0)

        # Handle short options like -e, -u, -x, -v
        # Also handle -euo pipefail where 'o' consumes the next argument
        elif arg.startswith("-") and len(arg) > 1 and arg[1] != "-":
            chars = arg[1:]
            j = 0
            while j < len(chars):
                c = chars[j]
                if c == "o":
                    # -o requires an option name: either remaining chars or next arg
                    if j + 1 < len(chars):
                        # Option name is rest of this arg (e.g., -opipefail)
                        opt_name = chars[j + 1:]
                        result = _set_option(ctx, opt_name, True)
                        if result:
                            return result
                        break  # Done with this arg
                    elif i + 1 < len(args):
                        # Option name is next arg (e.g., -euo pipefail)
                        i += 1
                        opt_name = args[i]
                        result = _set_option(ctx, opt_name, True)
                        if result:
                            return result
                        break  # Done with this arg
                    else:
                        # No option name provided, list options
                        stdout = _list_options(ctx)
                        return ExecResult(stdout=stdout, stderr="", exit_code=0)
                else:
                    result = _set_short_option(ctx, c, True)
                    if result:
                        return result
                j += 1

        elif arg.startswith("+") and len(arg) > 1:
            chars = arg[1:]
            j = 0
            while j < len(chars):
                c = chars[j]
                if c == "o":
                    # +o requires an option name
                    if j + 1 < len(chars):
                        opt_name = chars[j + 1:]
                        result = _set_option(ctx, opt_name, False)
                        if result:
                            return result
                        break
                    elif i + 1 < len(args):
                        i += 1
                        opt_name = args[i]
                        result = _set_option(ctx, opt_name, False)
                        if result:
                            return result
                        break
                    else:
                        stdout = _list_options_script(ctx)
                        return ExecResult(stdout=stdout, stderr="", exit_code=0)
                else:
                    result = _set_short_option(ctx, c, False)
                    if result:
                        return result
                j += 1

        # Treat as positional parameter
        else:
            new_params = args[i:]
            _set_positional_params(ctx, new_params)
            return ExecResult(stdout="", stderr="", exit_code=0)

        i += 1

    return ExecResult(stdout="", stderr="", exit_code=0)


def _set_positional_params(ctx: "InterpreterContext", params: list[str]) -> None:
    """Set positional parameters $1, $2, etc."""
    # Clear existing positional parameters
    i = 1
    while str(i) in ctx.state.env:
        del ctx.state.env[str(i)]
        i += 1

    # Set new positional parameters
    for i, param in enumerate(params, start=1):
        ctx.state.env[str(i)] = param

    # Update $# (number of positional parameters)
    ctx.state.env["#"] = str(len(params))


def _set_option(ctx: "InterpreterContext", name: str, enable: bool) -> "ExecResult | None":
    """Set a named option. Returns error result if invalid option."""
    from ...types import ExecResult

    options = ctx.state.options
    if name == "errexit":
        options.errexit = enable
    elif name == "nounset":
        options.nounset = enable
    elif name == "xtrace":
        options.xtrace = enable
    elif name == "verbose":
        options.verbose = enable
    elif name == "pipefail":
        options.pipefail = enable
    elif name == "noglob":
        options.noglob = enable
    elif name == "noclobber":
        options.noclobber = enable
    elif name == "braceexpand":
        options.nobraceexpand = not enable
    elif name == "allexport":
        options.allexport = enable
    elif name == "emacs":
        options.emacs = enable
        if enable:
            options.vi = False  # Mutually exclusive
    elif name == "vi":
        options.vi = enable
        if enable:
            options.emacs = False  # Mutually exclusive
    elif name in (
        "hashall", "histexpand", "history",
        "interactive-comments", "keyword", "monitor", "notify",
        "onecmd", "physical", "posix", "privileged",
    ):
        # Accepted but ignored options
        pass
    else:
        return ExecResult(
            stdout="",
            stderr=f"bash: set: {name}: invalid option name\n",
            exit_code=1,
        )
    return None


def _set_short_option(ctx: "InterpreterContext", char: str, enable: bool) -> "ExecResult | None":
    """Set a short option like -e. Returns error result if invalid."""
    from ...types import ExecResult

    options = ctx.state.options
    if char == "e":
        options.errexit = enable
    elif char == "u":
        options.nounset = enable
    elif char == "x":
        options.xtrace = enable
    elif char == "v":
        options.verbose = enable
    elif char == "f":
        options.noglob = enable
    elif char == "C":
        options.noclobber = enable
    elif char == "B":
        options.nobraceexpand = not enable
    elif char == "a":
        options.allexport = enable
    elif char in ("h", "H", "b", "m", "n", "p", "t"):
        # Accepted but ignored short options
        pass
    else:
        return ExecResult(
            stdout="",
            stderr=f"bash: set: -{char}: invalid option\n",
            exit_code=1,
        )
    return None


def _list_options(ctx: "InterpreterContext") -> str:
    """List all options in human-readable format (bash canonical order)."""
    options = ctx.state.options
    opt_list = [
        ("allexport", options.allexport),
        ("braceexpand", not options.nobraceexpand),
        ("emacs", options.emacs),
        ("errexit", options.errexit),
        ("errtrace", False),
        ("functrace", False),
        ("hashall", True),
        ("histexpand", False),
        ("history", False),
        ("interactive-comments", True),
        ("keyword", False),
        ("monitor", False),
        ("noclobber", options.noclobber),
        ("noexec", False),
        ("noglob", options.noglob),
        ("nolog", False),
        ("notify", False),
        ("nounset", options.nounset),
        ("onecmd", False),
        ("physical", False),
        ("pipefail", options.pipefail),
        ("posix", False),
        ("privileged", False),
        ("verbose", options.verbose),
        ("vi", options.vi),
        ("xtrace", options.xtrace),
    ]
    lines = []
    for name, enabled in opt_list:
        pad = " " * (15 - len(name))
        lines.append(f"{name}{pad} {'on' if enabled else 'off'}")
    return "\n".join(lines) + "\n"


def _list_options_script(ctx: "InterpreterContext") -> str:
    """List options in re-inputable script format."""
    options = ctx.state.options
    opt_list = [
        ("allexport", options.allexport),
        ("braceexpand", not options.nobraceexpand),
        ("emacs", options.emacs),
        ("errexit", options.errexit),
        ("errtrace", False),
        ("functrace", False),
        ("hashall", True),
        ("histexpand", False),
        ("history", False),
        ("interactive-comments", True),
        ("keyword", False),
        ("monitor", False),
        ("noclobber", options.noclobber),
        ("noexec", False),
        ("noglob", options.noglob),
        ("nolog", False),
        ("notify", False),
        ("nounset", options.nounset),
        ("onecmd", False),
        ("physical", False),
        ("pipefail", options.pipefail),
        ("posix", False),
        ("privileged", False),
        ("verbose", options.verbose),
        ("vi", options.vi),
        ("xtrace", options.xtrace),
    ]
    lines = []
    for name, enabled in opt_list:
        lines.append(f"set {'-' if enabled else '+'}o {name}")
    return "\n".join(lines) + "\n"


async def handle_shift(ctx: "InterpreterContext", args: list[str]) -> "ExecResult":
    """Execute the shift builtin."""
    from ...types import ExecResult

    # Default shift count is 1
    n = 1
    if args:
        if len(args) > 1:
            return ExecResult(
                stdout="",
                stderr=f"bash: shift: too many arguments\n",
                exit_code=1,
            )
        try:
            n = int(args[0])
        except ValueError:
            return ExecResult(
                stdout="",
                stderr=f"bash: shift: {args[0]}: numeric argument required\n",
                exit_code=1,
            )

    if n < 0:
        return ExecResult(
            stdout="",
            stderr=f"bash: shift: {n}: shift count out of range\n",
            exit_code=1,
        )

    # Get current positional parameters
    param_count = int(ctx.state.env.get("#", "0"))

    if n > param_count:
        return ExecResult(
            stdout="",
            stderr=f"bash: shift: {n}: shift count out of range\n",
            exit_code=1,
        )

    # Collect remaining parameters
    new_params = []
    for i in range(n + 1, param_count + 1):
        new_params.append(ctx.state.env.get(str(i), ""))

    # Set new positional parameters
    _set_positional_params(ctx, new_params)

    return ExecResult(stdout="", stderr="", exit_code=0)
