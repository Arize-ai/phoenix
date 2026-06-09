"""Checksum command implementations (md5sum, sha1sum, sha256sum)."""

import hashlib
from ...types import CommandContext, ExecResult


class ChecksumCommand:
    """Base class for checksum commands."""

    name = "checksum"
    algorithm = "md5"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the checksum command."""
        check_mode = False
        binary_mode = False
        quiet = False
        status_only = False
        files: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "-c" or arg == "--check":
                check_mode = True
            elif arg == "-b" or arg == "--binary":
                binary_mode = True
            elif arg == "-t" or arg == "--text":
                binary_mode = False
            elif arg == "--quiet":
                quiet = True
            elif arg == "--status":
                status_only = True
            elif arg == "--help":
                return ExecResult(
                    stdout=f"Usage: {self.name} [OPTION]... [FILE]...\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("-") and arg != "-":
                return ExecResult(
                    stdout="",
                    stderr=f"{self.name}: invalid option -- '{arg[1]}'\n",
                    exit_code=1,
                )
            else:
                files.append(arg)
            i += 1

        if not files:
            files = ["-"]

        if check_mode:
            return await self._check_sums(files, ctx, quiet, status_only)
        else:
            return await self._compute_sums(files, ctx, binary_mode)

    async def _compute_sums(
        self, files: list[str], ctx: CommandContext, binary_mode: bool
    ) -> ExecResult:
        """Compute checksums for files."""
        stdout_parts = []
        stderr = ""
        exit_code = 0

        for file in files:
            try:
                if file == "-":
                    content = ctx.stdin.encode("utf-8")
                else:
                    path = ctx.fs.resolve_path(ctx.cwd, file)
                    content = await ctx.fs.read_file_bytes(path)

                h = hashlib.new(self.algorithm)
                h.update(content)
                checksum = h.hexdigest()

                mode_char = "*" if binary_mode else " "
                stdout_parts.append(f"{checksum} {mode_char}{file}")

            except FileNotFoundError:
                stderr += f"{self.name}: {file}: No such file or directory\n"
                exit_code = 1
            except IsADirectoryError:
                stderr += f"{self.name}: {file}: Is a directory\n"
                exit_code = 1

        stdout = "\n".join(stdout_parts)
        if stdout:
            stdout += "\n"

        return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)

    async def _check_sums(
        self, files: list[str], ctx: CommandContext, quiet: bool, status_only: bool
    ) -> ExecResult:
        """Check checksums from files."""
        stdout_parts = []
        stderr = ""
        failed_count = 0
        total_count = 0

        for file in files:
            try:
                if file == "-":
                    content = ctx.stdin
                else:
                    path = ctx.fs.resolve_path(ctx.cwd, file)
                    content = await ctx.fs.read_file(path)

                for line in content.strip().split("\n"):
                    if not line:
                        continue

                    # Parse checksum line: "hash  filename" or "hash *filename"
                    parts = line.split(None, 1)
                    if len(parts) != 2:
                        continue

                    expected_hash = parts[0]
                    filename = parts[1].lstrip("* ")
                    total_count += 1

                    try:
                        file_path = ctx.fs.resolve_path(ctx.cwd, filename)
                        file_content = await ctx.fs.read_file_bytes(file_path)
                        h = hashlib.new(self.algorithm)
                        h.update(file_content)
                        actual_hash = h.hexdigest()

                        if actual_hash == expected_hash:
                            if not quiet and not status_only:
                                stdout_parts.append(f"{filename}: OK")
                        else:
                            failed_count += 1
                            if not status_only:
                                stdout_parts.append(f"{filename}: FAILED")

                    except FileNotFoundError:
                        failed_count += 1
                        if not status_only:
                            stderr += f"{self.name}: {filename}: No such file or directory\n"

            except FileNotFoundError:
                stderr += f"{self.name}: {file}: No such file or directory\n"

        if failed_count > 0 and not status_only:
            stderr += f"{self.name}: WARNING: {failed_count} computed checksum did NOT match\n"

        stdout = "\n".join(stdout_parts)
        if stdout:
            stdout += "\n"

        exit_code = 1 if failed_count > 0 else 0
        return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)


class Md5sumCommand(ChecksumCommand):
    """The md5sum command."""

    name = "md5sum"
    algorithm = "md5"


class Sha1sumCommand(ChecksumCommand):
    """The sha1sum command."""

    name = "sha1sum"
    algorithm = "sha1"


class Sha256sumCommand(ChecksumCommand):
    """The sha256sum command."""

    name = "sha256sum"
    algorithm = "sha256"
