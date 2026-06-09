"""Getopts builtin implementation.

Usage: getopts optstring name [args]

Parse positional parameters as options.

The optstring contains the option letters to be recognized.
If a letter is followed by a colon, the option requires an argument.
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..types import InterpreterContext
    from ...types import ExecResult


async def handle_getopts(ctx: "InterpreterContext", args: list[str]) -> "ExecResult":
    """Execute the getopts builtin."""
    from ...types import ExecResult

    if len(args) < 2:
        return ExecResult(
            stdout="",
            stderr="bash: getopts: usage: getopts optstring name [arg ...]\n",
            exit_code=2,
        )

    optstring = args[0]
    name = args[1]

    # Validate variable name
    import re
    valid_name = bool(re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', name))

    # Get the arguments to parse (from args[2:] or positional params)
    if len(args) > 2:
        parse_args = args[2:]
    else:
        # Use positional parameters
        parse_args = []
        i = 1
        while str(i) in ctx.state.env:
            parse_args.append(ctx.state.env[str(i)])
            i += 1

    # Get current OPTIND (1-based)
    try:
        optind = int(ctx.state.env.get("OPTIND", "1"))
    except ValueError:
        optind = 1

    # Check if we've exhausted all arguments
    if optind > len(parse_args):
        ctx.state.env[name] = "?"
        return ExecResult(stdout="", stderr="", exit_code=1)

    current_arg = parse_args[optind - 1]

    # Check if current arg is an option
    if not current_arg.startswith("-") or current_arg == "-" or current_arg == "--":
        ctx.state.env[name] = "?"
        if current_arg == "--":
            ctx.state.env["OPTIND"] = str(optind + 1)
        return ExecResult(stdout="", stderr="", exit_code=1)

    # Get the option character
    # Handle multi-character processing within a single -abc argument
    optchar_idx_key = "__getopts_charpos"
    try:
        charpos = int(ctx.state.env.get(optchar_idx_key, "1"))
    except ValueError:
        charpos = 1

    if charpos >= len(current_arg):
        # Move to next argument
        optind += 1
        charpos = 1
        if optind > len(parse_args):
            ctx.state.env[name] = "?"
            ctx.state.env["OPTIND"] = str(optind)
            ctx.state.env.pop(optchar_idx_key, None)
            return ExecResult(stdout="", stderr="", exit_code=1)
        current_arg = parse_args[optind - 1]
        if not current_arg.startswith("-") or current_arg == "-" or current_arg == "--":
            ctx.state.env[name] = "?"
            ctx.state.env["OPTIND"] = str(optind + (1 if current_arg == "--" else 0))
            ctx.state.env.pop(optchar_idx_key, None)
            return ExecResult(stdout="", stderr="", exit_code=1)

    opt_char = current_arg[charpos]

    # Check if this option is valid
    opt_idx = optstring.find(opt_char)
    stderr = ""

    if opt_idx == -1:
        # Invalid option
        ctx.state.env[name] = "?"
        if optstring.startswith(":"):
            # Silent mode: OPTARG = the invalid option character
            ctx.state.env["OPTARG"] = opt_char
        else:
            # Normal mode: OPTARG is unset, print error
            ctx.state.env.pop("OPTARG", None)
            stderr = f"bash: getopts: illegal option -- {opt_char}\n"

        # Advance position
        if charpos + 1 < len(current_arg):
            ctx.state.env[optchar_idx_key] = str(charpos + 1)
        else:
            ctx.state.env["OPTIND"] = str(optind + 1)
            ctx.state.env.pop(optchar_idx_key, None)

        return ExecResult(stdout="", stderr=stderr, exit_code=0)

    # Valid option - check if it requires an argument
    needs_arg = opt_idx + 1 < len(optstring) and optstring[opt_idx + 1] == ":"

    if needs_arg:
        # Check for argument
        if charpos + 1 < len(current_arg):
            # Argument is the rest of this token
            ctx.state.env["OPTARG"] = current_arg[charpos + 1:]
            ctx.state.env["OPTIND"] = str(optind + 1)
            ctx.state.env.pop(optchar_idx_key, None)
        elif optind < len(parse_args):
            # Argument is the next token
            ctx.state.env["OPTARG"] = parse_args[optind]
            ctx.state.env["OPTIND"] = str(optind + 2)
            ctx.state.env.pop(optchar_idx_key, None)
        else:
            # Missing argument
            if optstring.startswith(":"):
                ctx.state.env[name] = ":"
                ctx.state.env["OPTARG"] = opt_char
            else:
                ctx.state.env[name] = "?"
                ctx.state.env.pop("OPTARG", None)
                stderr = f"bash: getopts: option requires an argument -- {opt_char}\n"
            ctx.state.env["OPTIND"] = str(optind + 1)
            ctx.state.env.pop(optchar_idx_key, None)
            return ExecResult(stdout="", stderr=stderr, exit_code=0)
    else:
        # No argument needed
        ctx.state.env.pop("OPTARG", None)
        if charpos + 1 < len(current_arg):
            # More options in this token
            ctx.state.env[optchar_idx_key] = str(charpos + 1)
        else:
            # Move to next argument
            ctx.state.env["OPTIND"] = str(optind + 1)
            ctx.state.env.pop(optchar_idx_key, None)

    if valid_name:
        ctx.state.env[name] = opt_char
        return ExecResult(stdout="", stderr=stderr, exit_code=0)
    else:
        return ExecResult(
            stdout="",
            stderr=stderr + f"bash: getopts: `{name}': not a valid identifier\n",
            exit_code=1,
        )
