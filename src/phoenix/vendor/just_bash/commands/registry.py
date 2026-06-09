"""Command registry with lazy loading.

Each command has an explicit loader function for import optimization.
"""

from dataclasses import dataclass
from typing import Callable, Awaitable

from ..types import Command, CommandContext, ExecResult


@dataclass
class LazyCommandDef:
    """Definition for a lazily-loaded command."""

    name: str
    load: Callable[[], Awaitable[Command]]


# Cache for loaded commands
_cache: dict[str, Command] = {}


class LazyCommand:
    """A command that loads its implementation on first execution."""

    def __init__(self, def_: LazyCommandDef):
        self._def = def_
        self.name = def_.name

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the command, loading it if necessary."""
        if self._def.name not in _cache:
            cmd = await self._def.load()
            _cache[self._def.name] = cmd
        return await _cache[self._def.name].execute(args, ctx)


# All available command names
COMMAND_NAMES = [
    # Basic I/O
    "echo",
    "cat",
    "printf",
    # File operations
    "ls",
    "mkdir",
    "touch",
    "rm",
    "cp",
    "mv",
    "ln",
    "chmod",
    # Navigation
    "pwd",
    "readlink",
    # File viewing
    "head",
    "tail",
    "wc",
    "stat",
    # Text processing
    "grep",
    "fgrep",
    "egrep",
    "rg",
    "sed",
    "awk",
    "sort",
    "uniq",
    "comm",
    "cut",
    "paste",
    "tr",
    "rev",
    "nl",
    "fold",
    "expand",
    "unexpand",
    "strings",
    "split",
    "column",
    "join",
    "tee",
    # Search
    "find",
    # Path utilities
    "basename",
    "dirname",
    # Directory utilities
    "tree",
    "du",
    # Environment
    "env",
    "printenv",
    "alias",
    "unalias",
    "history",
    # Utilities
    "xargs",
    "true",
    "false",
    "clear",
    # Shell
    "bash",
    "sh",
    # Data processing
    "jq",
    "base64",
    "diff",
    "date",
    "sleep",
    "timeout",
    "seq",
    "expr",
    "shuf",
    # Checksums
    "md5sum",
    "sha1sum",
    "sha256sum",
    # File type detection
    "file",
    # Help
    "help",
    "which",
    # Misc utilities
    "tac",
    "hostname",
    "od",
    "rmdir",
    "time",
    "whoami",
    # Testing utilities
    "argv.py",
    "printenv.py",
    # Builtins
    "read",
    # Compression
    "gzip",
    "gunzip",
    "zcat",
    "tar",
    # Data formats
    "yq",
    "xan",
    "sqlite3",
    # HTML conversion
    "html-to-markdown",
]

# Network command names
NETWORK_COMMAND_NAMES = [
    "curl",
]

# Command loaders - statically analyzable for bundlers
_command_loaders: list[LazyCommandDef] = [
    # Basic I/O
    LazyCommandDef(name="echo", load=lambda: _load_echo()),
    LazyCommandDef(name="cat", load=lambda: _load_cat()),
    # File operations
    LazyCommandDef(name="ls", load=lambda: _load_ls()),
    LazyCommandDef(name="mkdir", load=lambda: _load_mkdir()),
    LazyCommandDef(name="touch", load=lambda: _load_touch()),
    LazyCommandDef(name="rm", load=lambda: _load_rm()),
    LazyCommandDef(name="cp", load=lambda: _load_cp()),
    LazyCommandDef(name="mv", load=lambda: _load_mv()),
    LazyCommandDef(name="ln", load=lambda: _load_ln()),
    LazyCommandDef(name="chmod", load=lambda: _load_chmod()),
    # Navigation
    LazyCommandDef(name="pwd", load=lambda: _load_pwd()),
    # File viewing
    LazyCommandDef(name="head", load=lambda: _load_head()),
    LazyCommandDef(name="tail", load=lambda: _load_tail()),
    LazyCommandDef(name="wc", load=lambda: _load_wc()),
    # Text processing
    LazyCommandDef(name="grep", load=lambda: _load_grep()),
    LazyCommandDef(name="uniq", load=lambda: _load_uniq()),
    LazyCommandDef(name="cut", load=lambda: _load_cut()),
    LazyCommandDef(name="tr", load=lambda: _load_tr()),
    LazyCommandDef(name="sort", load=lambda: _load_sort()),
    LazyCommandDef(name="sed", load=lambda: _load_sed()),
    LazyCommandDef(name="awk", load=lambda: _load_awk()),
    # Search
    LazyCommandDef(name="find", load=lambda: _load_find()),
    # Utilities
    LazyCommandDef(name="true", load=lambda: _load_true()),
    LazyCommandDef(name="false", load=lambda: _load_false()),
    # Data processing
    LazyCommandDef(name="base64", load=lambda: _load_base64()),
    LazyCommandDef(name="date", load=lambda: _load_date()),
    LazyCommandDef(name="seq", load=lambda: _load_seq()),
    LazyCommandDef(name="expr", load=lambda: _load_expr()),
    LazyCommandDef(name="shuf", load=lambda: _load_shuf()),
    # JSON processing
    LazyCommandDef(name="jq", load=lambda: _load_jq()),
    # High priority commands
    LazyCommandDef(name="printf", load=lambda: _load_printf()),
    LazyCommandDef(name="tee", load=lambda: _load_tee()),
    LazyCommandDef(name="xargs", load=lambda: _load_xargs()),
    LazyCommandDef(name="basename", load=lambda: _load_basename()),
    LazyCommandDef(name="dirname", load=lambda: _load_dirname()),
    LazyCommandDef(name="readlink", load=lambda: _load_readlink()),
    LazyCommandDef(name="stat", load=lambda: _load_stat()),
    LazyCommandDef(name="diff", load=lambda: _load_diff()),
    # Text processing
    LazyCommandDef(name="tac", load=lambda: _load_tac()),
    LazyCommandDef(name="rev", load=lambda: _load_rev()),
    LazyCommandDef(name="nl", load=lambda: _load_nl()),
    LazyCommandDef(name="paste", load=lambda: _load_paste()),
    # Environment
    LazyCommandDef(name="env", load=lambda: _load_env()),
    LazyCommandDef(name="printenv", load=lambda: _load_printenv()),
    LazyCommandDef(name="hostname", load=lambda: _load_hostname()),
    # Timing
    LazyCommandDef(name="sleep", load=lambda: _load_sleep()),
    LazyCommandDef(name="timeout", load=lambda: _load_timeout()),
    # File utilities
    LazyCommandDef(name="tree", load=lambda: _load_tree()),
    LazyCommandDef(name="du", load=lambda: _load_du()),
    LazyCommandDef(name="file", load=lambda: _load_file()),
    LazyCommandDef(name="which", load=lambda: _load_which()),
    LazyCommandDef(name="help", load=lambda: _load_help()),
    # Search
    LazyCommandDef(name="rg", load=lambda: _load_rg()),
    # Grep variants
    LazyCommandDef(name="fgrep", load=lambda: _load_fgrep()),
    LazyCommandDef(name="egrep", load=lambda: _load_egrep()),
    # Checksums
    LazyCommandDef(name="md5sum", load=lambda: _load_md5sum()),
    LazyCommandDef(name="sha1sum", load=lambda: _load_sha1sum()),
    LazyCommandDef(name="sha256sum", load=lambda: _load_sha256sum()),
    # Compression
    LazyCommandDef(name="gzip", load=lambda: _load_gzip()),
    LazyCommandDef(name="gunzip", load=lambda: _load_gunzip()),
    LazyCommandDef(name="zcat", load=lambda: _load_zcat()),
    # Shell utilities
    LazyCommandDef(name="clear", load=lambda: _load_clear()),
    LazyCommandDef(name="alias", load=lambda: _load_alias()),
    LazyCommandDef(name="unalias", load=lambda: _load_unalias()),
    LazyCommandDef(name="history", load=lambda: _load_history()),
    # Text processing - additional
    LazyCommandDef(name="expand", load=lambda: _load_expand()),
    LazyCommandDef(name="unexpand", load=lambda: _load_unexpand()),
    LazyCommandDef(name="fold", load=lambda: _load_fold()),
    LazyCommandDef(name="column", load=lambda: _load_column()),
    LazyCommandDef(name="comm", load=lambda: _load_comm()),
    LazyCommandDef(name="strings", load=lambda: _load_strings()),
    LazyCommandDef(name="od", load=lambda: _load_od()),
    LazyCommandDef(name="rmdir", load=lambda: _load_rmdir()),
    LazyCommandDef(name="time", load=lambda: _load_time()),
    LazyCommandDef(name="whoami", load=lambda: _load_whoami()),
    # Testing utilities
    LazyCommandDef(name="argv.py", load=lambda: _load_argv()),
    LazyCommandDef(name="printenv.py", load=lambda: _load_printenv_py()),
    # Builtins
    LazyCommandDef(name="read", load=lambda: _load_read()),
    LazyCommandDef(name="split", load=lambda: _load_split()),
    LazyCommandDef(name="join", load=lambda: _load_join()),
    # Shell commands
    LazyCommandDef(name="bash", load=lambda: _load_bash()),
    LazyCommandDef(name="sh", load=lambda: _load_sh()),
    # Archive commands
    LazyCommandDef(name="tar", load=lambda: _load_tar()),
    # Data format commands
    LazyCommandDef(name="yq", load=lambda: _load_yq()),
    # CSV toolkit
    LazyCommandDef(name="xan", load=lambda: _load_xan()),
    # Database
    LazyCommandDef(name="sqlite3", load=lambda: _load_sqlite3()),
    # HTML conversion
    LazyCommandDef(name="html-to-markdown", load=lambda: _load_html_to_markdown()),
]


async def _load_echo() -> Command:
    """Load the echo command."""
    from .echo.echo import EchoCommand
    return EchoCommand()


async def _load_cat() -> Command:
    """Load the cat command."""
    from .cat.cat import CatCommand
    return CatCommand()


async def _load_ls() -> Command:
    """Load the ls command."""
    from .ls.ls import LsCommand
    return LsCommand()


async def _load_pwd() -> Command:
    """Load the pwd command."""
    from .pwd.pwd import PwdCommand
    return PwdCommand()


async def _load_head() -> Command:
    """Load the head command."""
    from .head.head import HeadCommand
    return HeadCommand()


async def _load_tail() -> Command:
    """Load the tail command."""
    from .tail.tail import TailCommand
    return TailCommand()


async def _load_wc() -> Command:
    """Load the wc command."""
    from .wc.wc import WcCommand
    return WcCommand()


async def _load_grep() -> Command:
    """Load the grep command."""
    from .grep.grep import GrepCommand
    return GrepCommand()


async def _load_true() -> Command:
    """Load the true command."""
    from .true.true import TrueCommand
    return TrueCommand()


async def _load_false() -> Command:
    """Load the false command."""
    from .true.true import FalseCommand
    return FalseCommand()


async def _load_mkdir() -> Command:
    """Load the mkdir command."""
    from .mkdir.mkdir import MkdirCommand
    return MkdirCommand()


async def _load_touch() -> Command:
    """Load the touch command."""
    from .touch.touch import TouchCommand
    return TouchCommand()


async def _load_rm() -> Command:
    """Load the rm command."""
    from .rm.rm import RmCommand
    return RmCommand()


async def _load_cp() -> Command:
    """Load the cp command."""
    from .cp.cp import CpCommand
    return CpCommand()


async def _load_mv() -> Command:
    """Load the mv command."""
    from .mv.mv import MvCommand
    return MvCommand()


async def _load_ln() -> Command:
    """Load the ln command."""
    from .ln.ln import LnCommand
    return LnCommand()


async def _load_chmod() -> Command:
    """Load the chmod command."""
    from .chmod.chmod import ChmodCommand
    return ChmodCommand()


async def _load_base64() -> Command:
    """Load the base64 command."""
    from .base64.base64 import Base64Command
    return Base64Command()


async def _load_date() -> Command:
    """Load the date command."""
    from .date.date import DateCommand
    return DateCommand()


async def _load_seq() -> Command:
    """Load the seq command."""
    from .seq.seq import SeqCommand
    return SeqCommand()


async def _load_expr() -> Command:
    """Load the expr command."""
    from .expr.expr import ExprCommand
    return ExprCommand()


async def _load_shuf() -> Command:
    """Load the shuf command."""
    from .shuf.shuf import ShufCommand
    return ShufCommand()


async def _load_uniq() -> Command:
    """Load the uniq command."""
    from .uniq.uniq import UniqCommand
    return UniqCommand()


async def _load_cut() -> Command:
    """Load the cut command."""
    from .cut.cut import CutCommand
    return CutCommand()


async def _load_tr() -> Command:
    """Load the tr command."""
    from .tr.tr import TrCommand
    return TrCommand()


async def _load_sort() -> Command:
    """Load the sort command."""
    from .sort.sort import SortCommand
    return SortCommand()


async def _load_sed() -> Command:
    """Load the sed command."""
    from .sed.sed import SedCommand
    return SedCommand()


async def _load_awk() -> Command:
    """Load the awk command."""
    from .awk.awk import AwkCommand
    return AwkCommand()


async def _load_find() -> Command:
    """Load the find command."""
    from .find.find import FindCommand
    return FindCommand()


async def _load_jq() -> Command:
    """Load the jq command."""
    from .jq.jq import JqCommand
    return JqCommand()


async def _load_printf() -> Command:
    """Load the printf command."""
    from .printf.printf import PrintfCommand
    return PrintfCommand()


async def _load_tee() -> Command:
    """Load the tee command."""
    from .tee.tee import TeeCommand
    return TeeCommand()


async def _load_xargs() -> Command:
    """Load the xargs command."""
    from .xargs.xargs import XargsCommand
    return XargsCommand()


async def _load_basename() -> Command:
    """Load the basename command."""
    from .basename.basename import BasenameCommand
    return BasenameCommand()


async def _load_dirname() -> Command:
    """Load the dirname command."""
    from .dirname.dirname import DirnameCommand
    return DirnameCommand()


async def _load_readlink() -> Command:
    """Load the readlink command."""
    from .readlink.readlink import ReadlinkCommand
    return ReadlinkCommand()


async def _load_stat() -> Command:
    """Load the stat command."""
    from .stat.stat import StatCommand
    return StatCommand()


async def _load_diff() -> Command:
    """Load the diff command."""
    from .diff.diff import DiffCommand
    return DiffCommand()


async def _load_tac() -> Command:
    """Load the tac command."""
    from .tac.tac import TacCommand
    return TacCommand()


async def _load_rev() -> Command:
    """Load the rev command."""
    from .rev.rev import RevCommand
    return RevCommand()


async def _load_nl() -> Command:
    """Load the nl command."""
    from .nl.nl import NlCommand
    return NlCommand()


async def _load_paste() -> Command:
    """Load the paste command."""
    from .paste.paste import PasteCommand
    return PasteCommand()


async def _load_env() -> Command:
    """Load the env command."""
    from .env.env import EnvCommand
    return EnvCommand()


async def _load_printenv() -> Command:
    """Load the printenv command."""
    from .env.env import PrintenvCommand
    return PrintenvCommand()


async def _load_hostname() -> Command:
    """Load the hostname command."""
    from .hostname.hostname import HostnameCommand
    return HostnameCommand()


async def _load_sleep() -> Command:
    """Load the sleep command."""
    from .sleep.sleep import SleepCommand
    return SleepCommand()


async def _load_timeout() -> Command:
    """Load the timeout command."""
    from .timeout.timeout import TimeoutCommand
    return TimeoutCommand()


async def _load_tree() -> Command:
    """Load the tree command."""
    from .tree.tree import TreeCommand
    return TreeCommand()


async def _load_du() -> Command:
    """Load the du command."""
    from .du.du import DuCommand
    return DuCommand()


async def _load_file() -> Command:
    """Load the file command."""
    from .file.file import FileCommand
    return FileCommand()


async def _load_which() -> Command:
    """Load the which command."""
    from .which.which import WhichCommand
    return WhichCommand()


async def _load_help() -> Command:
    """Load the help command."""
    from .help.help import HelpCommand
    return HelpCommand()


async def _load_rg() -> Command:
    """Load the rg command."""
    from .rg.rg import RgCommand
    return RgCommand()


async def _load_fgrep() -> Command:
    """Load the fgrep command."""
    from .grep.grep import FgrepCommand
    return FgrepCommand()


async def _load_egrep() -> Command:
    """Load the egrep command."""
    from .grep.grep import EgrepCommand
    return EgrepCommand()


async def _load_md5sum() -> Command:
    """Load the md5sum command."""
    from .checksum.checksum import Md5sumCommand
    return Md5sumCommand()


async def _load_sha1sum() -> Command:
    """Load the sha1sum command."""
    from .checksum.checksum import Sha1sumCommand
    return Sha1sumCommand()


async def _load_sha256sum() -> Command:
    """Load the sha256sum command."""
    from .checksum.checksum import Sha256sumCommand
    return Sha256sumCommand()


async def _load_gzip() -> Command:
    """Load the gzip command."""
    from .compression.compression import GzipCommand
    return GzipCommand()


async def _load_gunzip() -> Command:
    """Load the gunzip command."""
    from .compression.compression import GunzipCommand
    return GunzipCommand()


async def _load_zcat() -> Command:
    """Load the zcat command."""
    from .compression.compression import ZcatCommand
    return ZcatCommand()


async def _load_clear() -> Command:
    """Load the clear command."""
    from .shell.shell import ClearCommand
    return ClearCommand()


async def _load_alias() -> Command:
    """Load the alias command."""
    from .shell.shell import AliasCommand
    return AliasCommand()


async def _load_unalias() -> Command:
    """Load the unalias command."""
    from .shell.shell import UnaliasCommand
    return UnaliasCommand()


async def _load_history() -> Command:
    """Load the history command."""
    from .shell.shell import HistoryCommand
    return HistoryCommand()


async def _load_expand() -> Command:
    """Load the expand command."""
    from .expand.expand import ExpandCommand
    return ExpandCommand()


async def _load_unexpand() -> Command:
    """Load the unexpand command."""
    from .expand.expand import UnexpandCommand
    return UnexpandCommand()


async def _load_fold() -> Command:
    """Load the fold command."""
    from .fold.fold import FoldCommand
    return FoldCommand()


async def _load_column() -> Command:
    """Load the column command."""
    from .column.column import ColumnCommand
    return ColumnCommand()


async def _load_comm() -> Command:
    """Load the comm command."""
    from .comm.comm import CommCommand
    return CommCommand()


async def _load_strings() -> Command:
    """Load the strings command."""
    from .strings.strings import StringsCommand
    return StringsCommand()


async def _load_od() -> Command:
    """Load the od command."""
    from .od.od import OdCommand
    return OdCommand()


async def _load_rmdir() -> Command:
    """Load the rmdir command."""
    from .rmdir.rmdir import RmdirCommand
    return RmdirCommand()


async def _load_time() -> Command:
    """Load the time command."""
    from .time.time import TimeCommand
    return TimeCommand()


async def _load_whoami() -> Command:
    """Load the whoami command."""
    from .whoami.whoami import WhoamiCommand
    return WhoamiCommand()


async def _load_argv() -> Command:
    """Load the argv.py command."""
    from .argv.argv import ArgvCommand
    return ArgvCommand()


async def _load_printenv_py() -> Command:
    """Load the printenv.py test helper command."""
    from .printenv_py.printenv_py import PrintenvPyCommand
    return PrintenvPyCommand()


async def _load_read() -> Command:
    """Load the read command."""
    from .read.read import ReadCommand
    return ReadCommand()


async def _load_split() -> Command:
    """Load the split command."""
    from .split.split import SplitCommand
    return SplitCommand()


async def _load_join() -> Command:
    """Load the join command."""
    from .join.join import JoinCommand
    return JoinCommand()


async def _load_bash() -> Command:
    """Load the bash command."""
    from .bash.bash import BashCommand
    return BashCommand()


async def _load_sh() -> Command:
    """Load the sh command."""
    from .bash.bash import ShCommand
    return ShCommand()


async def _load_tar() -> Command:
    """Load the tar command."""
    from .tar.tar import TarCommand
    return TarCommand()


async def _load_curl() -> Command:
    """Load the curl command."""
    from .curl.curl import CurlCommand
    return CurlCommand()


async def _load_yq() -> Command:
    """Load the yq command."""
    from .yq.yq import YqCommand
    return YqCommand()


async def _load_xan() -> Command:
    """Load the xan command."""
    from .xan.xan import XanCommand
    return XanCommand()


async def _load_sqlite3() -> Command:
    """Load the sqlite3 command."""
    from .sqlite3.sqlite3_cmd import Sqlite3Command
    return Sqlite3Command()


async def _load_html_to_markdown() -> Command:
    """Load the html-to-markdown command."""
    from .html_to_markdown.html_to_markdown import HtmlToMarkdownCommand
    return HtmlToMarkdownCommand()


# Network command loaders
_network_command_loaders: list[LazyCommandDef] = [
    LazyCommandDef(name="curl", load=lambda: _load_curl()),
]


def get_command_names() -> list[str]:
    """Get all available command names (excludes network commands)."""
    return COMMAND_NAMES.copy()


def get_network_command_names() -> list[str]:
    """Get all network command names."""
    return NETWORK_COMMAND_NAMES.copy()


def create_lazy_commands(filter_names: list[str] | None = None) -> list[Command]:
    """Create all lazy commands for registration.

    Args:
        filter_names: Optional list of command names to include.
                     If not provided, all commands are created.

    Returns:
        List of Command objects (lazy-loaded).
    """
    loaders = _command_loaders
    if filter_names:
        loaders = [d for d in loaders if d.name in filter_names]
    return [LazyCommand(d) for d in loaders]


def create_network_lazy_commands(
    filter_names: list[str] | None = None,
) -> list[Command]:
    """Create all network lazy commands for registration.

    Args:
        filter_names: Optional list of command names to include.
                     If not provided, all network commands are created.

    Returns:
        List of Command objects (lazy-loaded).
    """
    loaders = _network_command_loaders
    if filter_names:
        loaders = [d for d in loaders if d.name in filter_names]
    return [LazyCommand(d) for d in loaders]


def create_command_registry(
    filter_names: list[str] | None = None, include_network: bool = False
) -> dict[str, Command]:
    """Create a command registry dictionary.

    Args:
        filter_names: Optional list of command names to include.
        include_network: Whether to include network commands.

    Returns:
        Dictionary mapping command names to Command objects.
    """
    commands = create_lazy_commands(filter_names)
    registry = {cmd.name: cmd for cmd in commands}

    if include_network:
        network_commands = create_network_lazy_commands(filter_names)
        for cmd in network_commands:
            registry[cmd.name] = cmd

    return registry


def clear_command_cache() -> None:
    """Clear the command cache (for testing)."""
    _cache.clear()


def get_loaded_command_count() -> int:
    """Get the number of loaded commands (for testing)."""
    return len(_cache)
