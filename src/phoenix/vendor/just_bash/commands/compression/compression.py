"""Compression command implementations (gzip, gunzip, zcat)."""

import gzip
import struct
from ...types import CommandContext, ExecResult


class GzipCommand:
    """The gzip command - compress files."""

    name = "gzip"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the gzip command."""
        decompress = False
        keep_original = False
        force = False
        stdout_mode = False
        verbose = False
        quiet = False
        list_mode = False
        test_mode = False
        recursive = False
        suffix = ".gz"
        level = 6
        files: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg in ("-d", "--decompress", "--uncompress"):
                decompress = True
            elif arg in ("-k", "--keep"):
                keep_original = True
            elif arg in ("-f", "--force"):
                force = True
            elif arg in ("-c", "--stdout", "--to-stdout"):
                stdout_mode = True
            elif arg in ("-v", "--verbose"):
                verbose = True
            elif arg in ("-q", "--quiet"):
                quiet = True
            elif arg in ("-l", "--list"):
                list_mode = True
            elif arg in ("-t", "--test"):
                test_mode = True
            elif arg in ("-r", "--recursive"):
                recursive = True
            elif arg in ("-S", "--suffix"):
                i += 1
                if i < len(args):
                    suffix = args[i]
                    if not suffix.startswith("."):
                        suffix = "." + suffix
            elif arg.startswith("--suffix="):
                suffix = arg[9:]
                if not suffix.startswith("."):
                    suffix = "." + suffix
            elif arg in ("-1", "--fast"):
                level = 1
            elif arg in ("-9", "--best"):
                level = 9
            elif arg.startswith("-") and len(arg) == 2 and arg[1].isdigit():
                level = int(arg[1])
            elif arg == "--help":
                return ExecResult(
                    stdout="Usage: gzip [OPTION]... [FILE]...\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("-"):
                # Handle combined short options
                for c in arg[1:]:
                    if c == "d":
                        decompress = True
                    elif c == "k":
                        keep_original = True
                    elif c == "f":
                        force = True
                    elif c == "c":
                        stdout_mode = True
                    elif c == "v":
                        verbose = True
                    elif c == "q":
                        quiet = True
                    elif c == "l":
                        list_mode = True
                    elif c == "t":
                        test_mode = True
                    elif c == "r":
                        recursive = True
                    elif c.isdigit():
                        level = int(c)
            else:
                files.append(arg)
            i += 1

        # Read from stdin if no files
        if not files:
            if ctx.stdin:
                return await self._process_stdin(ctx, decompress, level)
            return ExecResult(
                stdout="",
                stderr="gzip: missing operand\n",
                exit_code=1,
            )

        # Expand files if recursive
        if recursive:
            files = await self._expand_recursive(ctx, files)

        stdout_parts = []
        stderr_parts = []
        exit_code = 0

        # List mode
        if list_mode:
            stdout_parts.append(f"{'compressed':>12} {'uncompressed':>12} {'ratio':>6}  name\n")
            total_compressed = 0
            total_uncompressed = 0

            for file in files:
                try:
                    path = ctx.fs.resolve_path(ctx.cwd, file)
                    content = await ctx.fs.read_file_bytes(path)
                    compressed_size = len(content)

                    try:
                        decompressed = gzip.decompress(content)
                        uncompressed_size = len(decompressed)
                        ratio = (1.0 - compressed_size / uncompressed_size) * 100 if uncompressed_size > 0 else 0
                        stdout_parts.append(f"{compressed_size:>12} {uncompressed_size:>12} {ratio:>5.1f}%  {file}\n")
                        total_compressed += compressed_size
                        total_uncompressed += uncompressed_size
                    except Exception:
                        if not quiet:
                            stderr_parts.append(f"gzip: {file}: not in gzip format\n")
                        exit_code = 1
                except FileNotFoundError:
                    if not quiet:
                        stderr_parts.append(f"gzip: {file}: No such file or directory\n")
                    exit_code = 1

            if len(files) > 1 and total_uncompressed > 0:
                total_ratio = (1.0 - total_compressed / total_uncompressed) * 100
                stdout_parts.append(f"{total_compressed:>12} {total_uncompressed:>12} {total_ratio:>5.1f}%  (totals)\n")

            return ExecResult(stdout="".join(stdout_parts), stderr="".join(stderr_parts), exit_code=exit_code)

        # Test mode
        if test_mode:
            for file in files:
                try:
                    path = ctx.fs.resolve_path(ctx.cwd, file)
                    content = await ctx.fs.read_file_bytes(path)
                    try:
                        gzip.decompress(content)
                        if verbose and not quiet:
                            stderr_parts.append(f"{file}:\tOK\n")
                    except Exception as e:
                        if not quiet:
                            stderr_parts.append(f"gzip: {file}: {e}\n")
                        exit_code = 1
                except FileNotFoundError:
                    if not quiet:
                        stderr_parts.append(f"gzip: {file}: No such file or directory\n")
                    exit_code = 1

            return ExecResult(stdout="", stderr="".join(stderr_parts), exit_code=exit_code)

        for file in files:
            try:
                path = ctx.fs.resolve_path(ctx.cwd, file)
                content = await ctx.fs.read_file_bytes(path)
                original_size = len(content)

                if decompress:
                    if not file.endswith(suffix) and not force:
                        if not quiet:
                            stderr_parts.append(f"gzip: {file}: unknown suffix -- ignored\n")
                        continue
                    try:
                        result = gzip.decompress(content)
                    except Exception as e:
                        if not quiet:
                            stderr_parts.append(f"gzip: {file}: {e}\n")
                        exit_code = 1
                        continue

                    if stdout_mode:
                        stdout_parts.append(result.decode("utf-8", errors="replace"))
                    else:
                        # Remove suffix to get output path
                        if path.endswith(suffix):
                            new_path = path[:-len(suffix)]
                        else:
                            new_path = path + ".out"
                        await ctx.fs.write_file(new_path, result)
                        if not keep_original:
                            await ctx.fs.rm(path)

                    if verbose and not quiet:
                        ratio = (1.0 - original_size / len(result)) * 100 if len(result) > 0 else 0
                        stderr_parts.append(f"{file}:\t{ratio:.1f}% -- replaced with {new_path if not stdout_mode else 'stdout'}\n")
                else:
                    result = gzip.compress(content, compresslevel=level)

                    if stdout_mode:
                        # Can't output binary to stdout in text mode
                        stdout_parts.append(f"<binary gzip data, {len(result)} bytes>")
                    else:
                        new_path = path + suffix
                        await ctx.fs.write_file(new_path, result)
                        if not keep_original:
                            await ctx.fs.rm(path)

                    if verbose and not quiet:
                        ratio = (1.0 - len(result) / original_size) * 100 if original_size > 0 else 0
                        stderr_parts.append(f"{file}:\t{ratio:.1f}% -- replaced with {new_path if not stdout_mode else 'stdout'}\n")

            except FileNotFoundError:
                if not quiet:
                    stderr_parts.append(f"gzip: {file}: No such file or directory\n")
                exit_code = 1
            except IsADirectoryError:
                if not quiet:
                    stderr_parts.append(f"gzip: {file}: Is a directory\n")
                exit_code = 1

        stdout = "".join(stdout_parts)
        stderr = "".join(stderr_parts)
        return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)

    async def _expand_recursive(self, ctx: CommandContext, paths: list[str]) -> list[str]:
        """Expand directories recursively to list of files."""
        result = []
        for path in paths:
            full_path = ctx.fs.resolve_path(ctx.cwd, path)
            try:
                stat = await ctx.fs.stat(full_path)
                if stat.is_directory:
                    # List directory contents
                    entries = await ctx.fs.readdir(full_path)
                    sub_paths = [f"{path}/{e}" for e in entries]
                    result.extend(await self._expand_recursive(ctx, sub_paths))
                else:
                    result.append(path)
            except Exception:
                result.append(path)  # Let the main loop handle errors
        return result

    async def _process_stdin(
        self, ctx: CommandContext, decompress: bool, level: int
    ) -> ExecResult:
        """Process stdin."""
        try:
            content = ctx.stdin.encode("utf-8")
            if decompress:
                result = gzip.decompress(content)
                return ExecResult(
                    stdout=result.decode("utf-8", errors="replace"),
                    stderr="",
                    exit_code=0,
                )
            else:
                result = gzip.compress(content, compresslevel=level)
                return ExecResult(
                    stdout=f"<binary gzip data, {len(result)} bytes>",
                    stderr="",
                    exit_code=0,
                )
        except Exception as e:
            return ExecResult(stdout="", stderr=f"gzip: {e}\n", exit_code=1)


class GunzipCommand:
    """The gunzip command - decompress files."""

    name = "gunzip"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute gunzip (gzip -d)."""
        gzip_cmd = GzipCommand()
        return await gzip_cmd.execute(["-d"] + args, ctx)


class ZcatCommand:
    """The zcat command - decompress to stdout."""

    name = "zcat"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute zcat (gzip -dc)."""
        gzip_cmd = GzipCommand()
        return await gzip_cmd.execute(["-dc"] + args, ctx)
