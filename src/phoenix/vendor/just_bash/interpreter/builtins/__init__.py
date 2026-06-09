"""Builtin commands for the shell.

These are shell builtins that need direct access to InterpreterContext
to modify interpreter state (environment, cwd, options, etc.).
"""

from typing import TYPE_CHECKING, Optional, Callable, Awaitable

from .test import handle_test, handle_bracket
from .cd import handle_cd
from .export import handle_export
from .set import handle_set, handle_shift
from .unset import handle_unset
from .local import handle_local
from .source import handle_source, handle_eval
from .control import handle_break, handle_continue, handle_return, handle_exit
from .declare import handle_declare
from .mapfile import handle_mapfile
from .let import handle_let
from .readonly import handle_readonly
from .shopt import handle_shopt
from .alias import handle_alias, handle_unalias
from .getopts import handle_getopts
from .dirs import handle_pushd, handle_popd, handle_dirs
from .hash import handle_hash
from .misc import (
    handle_colon,
    handle_true,
    handle_false,
    handle_type,
    handle_command,
    handle_builtin,
    handle_exec,
    handle_wait,
)

if TYPE_CHECKING:
    from ..types import InterpreterContext
    from ...types import ExecResult


# Map of builtin names to their handler functions
BUILTINS: dict[str, Callable[["InterpreterContext", list[str]], Awaitable["ExecResult"]]] = {
    "test": handle_test,
    "[": handle_bracket,
    "cd": handle_cd,
    "export": handle_export,
    "set": handle_set,
    "shift": handle_shift,
    "unset": handle_unset,
    "local": handle_local,
    "source": handle_source,
    ".": handle_source,
    "eval": handle_eval,
    "break": handle_break,
    "continue": handle_continue,
    "return": handle_return,
    "exit": handle_exit,
    "declare": handle_declare,
    "typeset": handle_declare,  # typeset is alias for declare
    "mapfile": handle_mapfile,
    "readarray": handle_mapfile,  # readarray is alias for mapfile
    "let": handle_let,
    "readonly": handle_readonly,
    "shopt": handle_shopt,
    "alias": handle_alias,
    "unalias": handle_unalias,
    "getopts": handle_getopts,
    "pushd": handle_pushd,
    "popd": handle_popd,
    "dirs": handle_dirs,
    ":": handle_colon,
    "true": handle_true,
    "false": handle_false,
    "type": handle_type,
    "command": handle_command,
    "builtin": handle_builtin,
    "exec": handle_exec,
    "wait": handle_wait,
    "hash": handle_hash,
}


__all__ = [
    "BUILTINS",
    "handle_test",
    "handle_cd",
    "handle_export",
    "handle_set",
    "handle_shift",
    "handle_unset",
    "handle_local",
    "handle_source",
    "handle_eval",
    "handle_break",
    "handle_continue",
    "handle_return",
    "handle_exit",
    "handle_declare",
]
