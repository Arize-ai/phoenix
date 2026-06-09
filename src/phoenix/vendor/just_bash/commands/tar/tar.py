"""Tar command implementation."""

import io
import tarfile
import gzip
import bz2
import lzma
from datetime import datetime
from fnmatch import fnmatch

from ...types import CommandContext, ExecResult


class TarCommand:
    """The tar command - manipulate tape archives."""

    name = "tar"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the tar command."""
        if "--help" in args:
            return ExecResult(
                stdout=(
                    "Usage: tar [options] [file...]\n"
                    "Create, extract, or list contents of tar archives.\n\n"
                    "Options:\n"
                    "  -c, --create     create a new archive\n"
                    "  -x, --extract    extract files from an archive\n"
                    "  -t, --list       list contents of an archive\n"
                    "  -f FILE          use archive file FILE\n"
                    "  -z, --gzip       filter archive through gzip\n"
                    "  -v, --verbose    verbosely list files processed\n"
                    "  -C DIR           change to directory DIR\n"
                    "  --help           display this help\n"
                ),
                stderr="",
                exit_code=0,
            )

        # Parse options
        create = False
        extract = False
        list_mode = False
        append_mode = False
        update_mode = False
        archive_file = ""
        use_gzip = False
        use_bzip2 = False
        use_xz = False
        auto_compress = False
        verbose = False
        directory = ""
        exclude_patterns: list[str] = []
        strip_components = 0
        to_stdout = False
        keep_old_files = False
        no_mtime = False
        preserve_permissions = False
        files_from: str = ""
        exclude_from: str = ""
        files: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]

            # Handle combined short options (e.g., -cvzf)
            if arg.startswith("-") and not arg.startswith("--") and len(arg) > 2:
                j = 1
                while j < len(arg):
                    char = arg[j]
                    if char == "c":
                        create = True
                    elif char == "x":
                        extract = True
                    elif char == "t":
                        list_mode = True
                    elif char == "z":
                        use_gzip = True
                    elif char == "j":
                        use_bzip2 = True
                    elif char == "J":
                        use_xz = True
                    elif char == "a":
                        auto_compress = True
                    elif char == "v":
                        verbose = True
                    elif char == "O":
                        to_stdout = True
                    elif char == "k":
                        keep_old_files = True
                    elif char == "m":
                        no_mtime = True
                    elif char == "p":
                        preserve_permissions = True
                    elif char == "r":
                        append_mode = True
                    elif char == "u":
                        update_mode = True
                    elif char == "f":
                        # -f requires a value
                        if j < len(arg) - 1:
                            archive_file = arg[j + 1:]
                            j = len(arg)
                        else:
                            i += 1
                            if i >= len(args):
                                return ExecResult(
                                    stdout="",
                                    stderr="tar: option requires an argument -- 'f'\n",
                                    exit_code=2,
                                )
                            archive_file = args[i]
                    elif char == "C":
                        if j < len(arg) - 1:
                            directory = arg[j + 1:]
                            j = len(arg)
                        else:
                            i += 1
                            if i >= len(args):
                                return ExecResult(
                                    stdout="",
                                    stderr="tar: option requires an argument -- 'C'\n",
                                    exit_code=2,
                                )
                            directory = args[i]
                    elif char == "T":
                        # -T requires a value
                        if j < len(arg) - 1:
                            files_from = arg[j + 1:]
                            j = len(arg)
                        else:
                            i += 1
                            if i >= len(args):
                                return ExecResult(
                                    stdout="",
                                    stderr="tar: option requires an argument -- 'T'\n",
                                    exit_code=2,
                                )
                            files_from = args[i]
                    elif char == "X":
                        # -X requires a value
                        if j < len(arg) - 1:
                            exclude_from = arg[j + 1:]
                            j = len(arg)
                        else:
                            i += 1
                            if i >= len(args):
                                return ExecResult(
                                    stdout="",
                                    stderr="tar: option requires an argument -- 'X'\n",
                                    exit_code=2,
                                )
                            exclude_from = args[i]
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"tar: invalid option -- '{char}'\n",
                            exit_code=2,
                        )
                    j += 1
                i += 1
                continue

            # Long options and single short options
            if arg in ("-c", "--create"):
                create = True
            elif arg in ("-x", "--extract", "--get"):
                extract = True
            elif arg in ("-t", "--list"):
                list_mode = True
            elif arg in ("-z", "--gzip", "--gunzip"):
                use_gzip = True
            elif arg in ("-j", "--bzip2"):
                use_bzip2 = True
            elif arg in ("-J", "--xz"):
                use_xz = True
            elif arg in ("-a", "--auto-compress"):
                auto_compress = True
            elif arg in ("-v", "--verbose"):
                verbose = True
            elif arg in ("-O", "--to-stdout"):
                to_stdout = True
            elif arg in ("-k", "--keep-old-files"):
                keep_old_files = True
            elif arg in ("-m", "--touch"):
                no_mtime = True
            elif arg in ("-p", "--preserve-permissions", "--same-permissions"):
                preserve_permissions = True
            elif arg in ("-r", "--append"):
                append_mode = True
            elif arg in ("-u", "--update"):
                update_mode = True
            elif arg == "-f" or arg == "--file":
                i += 1
                if i >= len(args):
                    return ExecResult(
                        stdout="",
                        stderr="tar: option requires an argument -- 'f'\n",
                        exit_code=2,
                    )
                archive_file = args[i]
            elif arg.startswith("--file="):
                archive_file = arg[7:]
            elif arg in ("-C", "--directory"):
                i += 1
                if i >= len(args):
                    return ExecResult(
                        stdout="",
                        stderr="tar: option requires an argument -- 'C'\n",
                        exit_code=2,
                    )
                directory = args[i]
            elif arg.startswith("--directory="):
                directory = arg[12:]
            elif arg.startswith("--exclude="):
                exclude_patterns.append(arg[10:])
            elif arg == "--exclude":
                i += 1
                if i >= len(args):
                    return ExecResult(
                        stdout="",
                        stderr="tar: option requires an argument -- 'exclude'\n",
                        exit_code=2,
                    )
                exclude_patterns.append(args[i])
            elif arg.startswith("--strip-components="):
                try:
                    strip_components = int(arg[19:])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"tar: {arg}: invalid argument\n",
                        exit_code=2,
                    )
            elif arg == "--strip-components":
                i += 1
                if i >= len(args):
                    return ExecResult(
                        stdout="",
                        stderr="tar: option requires an argument -- 'strip-components'\n",
                        exit_code=2,
                    )
                try:
                    strip_components = int(args[i])
                except ValueError:
                    return ExecResult(
                        stdout="",
                        stderr=f"tar: {args[i]}: invalid argument\n",
                        exit_code=2,
                    )
            elif arg == "-T" or arg == "--files-from":
                i += 1
                if i >= len(args):
                    return ExecResult(
                        stdout="",
                        stderr="tar: option requires an argument -- 'T'\n",
                        exit_code=2,
                    )
                files_from = args[i]
            elif arg.startswith("--files-from="):
                files_from = arg[13:]
            elif arg == "-X" or arg == "--exclude-from":
                i += 1
                if i >= len(args):
                    return ExecResult(
                        stdout="",
                        stderr="tar: option requires an argument -- 'X'\n",
                        exit_code=2,
                    )
                exclude_from = args[i]
            elif arg.startswith("--exclude-from="):
                exclude_from = arg[15:]
            elif arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("-"):
                return ExecResult(
                    stdout="",
                    stderr=f"tar: invalid option -- '{arg}'\n",
                    exit_code=2,
                )
            else:
                files.append(arg)
            i += 1

        # Validate operation mode
        op_count = sum([create, extract, list_mode, append_mode, update_mode])
        if op_count == 0:
            return ExecResult(
                stdout="",
                stderr="tar: You must specify one of -c, -x, -t, -r, or -u\n",
                exit_code=2,
            )
        if op_count > 1:
            return ExecResult(
                stdout="",
                stderr="tar: You may not specify more than one of -c, -x, -t, -r, -u\n",
                exit_code=2,
            )

        # Determine work directory
        work_dir = ctx.fs.resolve_path(ctx.cwd, directory) if directory else ctx.cwd

        # Read files-from if specified
        if files_from:
            files_from_path = ctx.fs.resolve_path(ctx.cwd, files_from)
            try:
                content = await ctx.fs.read_file(files_from_path)
                for line in content.strip().split("\n"):
                    line = line.strip()
                    if line:
                        files.append(line)
            except FileNotFoundError:
                return ExecResult(
                    stdout="",
                    stderr=f"tar: {files_from}: Cannot open: No such file or directory\n",
                    exit_code=2,
                )

        # Read exclude-from if specified
        if exclude_from:
            exclude_from_path = ctx.fs.resolve_path(ctx.cwd, exclude_from)
            try:
                content = await ctx.fs.read_file(exclude_from_path)
                for line in content.strip().split("\n"):
                    line = line.strip()
                    if line:
                        exclude_patterns.append(line)
            except FileNotFoundError:
                return ExecResult(
                    stdout="",
                    stderr=f"tar: {exclude_from}: Cannot open: No such file or directory\n",
                    exit_code=2,
                )

        if create:
            return await self._create_archive(
                ctx, archive_file, files, work_dir,
                use_gzip=use_gzip, use_bzip2=use_bzip2, use_xz=use_xz,
                auto_compress=auto_compress, verbose=verbose,
                exclude_patterns=exclude_patterns
            )
        elif append_mode:
            return await self._append_archive(
                ctx, archive_file, files, work_dir,
                verbose=verbose, exclude_patterns=exclude_patterns
            )
        elif update_mode:
            return await self._update_archive(
                ctx, archive_file, files, work_dir,
                verbose=verbose, exclude_patterns=exclude_patterns
            )
        elif extract:
            return await self._extract_archive(
                ctx, archive_file, files, work_dir,
                use_gzip=use_gzip, use_bzip2=use_bzip2, use_xz=use_xz,
                verbose=verbose, strip_components=strip_components,
                to_stdout=to_stdout, keep_old_files=keep_old_files,
                no_mtime=no_mtime, preserve_permissions=preserve_permissions
            )
        else:  # list_mode
            return await self._list_archive(
                ctx, archive_file, files,
                use_gzip=use_gzip, use_bzip2=use_bzip2, use_xz=use_xz,
                verbose=verbose
            )

    def _detect_compression_from_filename(self, filename: str) -> str | None:
        """Detect compression type from filename extension."""
        if filename.endswith(".tar.gz") or filename.endswith(".tgz"):
            return "gz"
        elif filename.endswith(".tar.bz2") or filename.endswith(".tbz2"):
            return "bz2"
        elif filename.endswith(".tar.xz") or filename.endswith(".txz"):
            return "xz"
        elif filename.endswith(".tar"):
            return None
        return None

    async def _create_archive(
        self,
        ctx: CommandContext,
        archive_file: str,
        files: list[str],
        work_dir: str,
        use_gzip: bool = False,
        use_bzip2: bool = False,
        use_xz: bool = False,
        auto_compress: bool = False,
        verbose: bool = False,
        exclude_patterns: list[str] | None = None,
    ) -> ExecResult:
        """Create a tar archive."""
        if exclude_patterns is None:
            exclude_patterns = []

        if not files:
            return ExecResult(
                stdout="",
                stderr="tar: Cowardly refusing to create an empty archive\n",
                exit_code=2,
            )

        # Handle auto-compress: detect compression from filename
        if auto_compress and archive_file and archive_file != "-":
            detected = self._detect_compression_from_filename(archive_file)
            if detected == "gz":
                use_gzip = True
            elif detected == "bz2":
                use_bzip2 = True
            elif detected == "xz":
                use_xz = True

        # Create archive in memory - first as uncompressed tar
        buffer = io.BytesIO()
        # For bz2 and xz, we create uncompressed tar first then compress
        if use_bzip2 or use_xz:
            mode = "w"
        elif use_gzip:
            mode = "w:gz"
        else:
            mode = "w"

        try:
            tar = tarfile.open(fileobj=buffer, mode=mode)
        except Exception as e:
            return ExecResult(
                stdout="",
                stderr=f"tar: error opening archive: {e}\n",
                exit_code=2,
            )

        verbose_output = ""
        errors: list[str] = []

        for file_path in files:
            try:
                added = await self._add_to_archive(
                    ctx, tar, work_dir, file_path, verbose, errors, exclude_patterns
                )
                if verbose:
                    verbose_output += added
            except Exception as e:
                errors.append(f"tar: {file_path}: {e}")

        tar.close()

        # Write archive to file or stdout
        archive_data = buffer.getvalue()

        # Apply bz2 or xz compression if needed
        if use_bzip2:
            archive_data = bz2.compress(archive_data)
        elif use_xz:
            archive_data = lzma.compress(archive_data)

        if archive_file and archive_file != "-":
            archive_path = ctx.fs.resolve_path(ctx.cwd, archive_file)
            try:
                await ctx.fs.write_file(archive_path, archive_data)
            except Exception as e:
                return ExecResult(
                    stdout="",
                    stderr=f"tar: {archive_file}: {e}\n",
                    exit_code=2,
                )
            stdout = ""
        else:
            # Output binary to stdout
            stdout = archive_data.decode("latin-1")

        # Verbose output always goes to stderr (matching real tar behavior)
        stderr = verbose_output
        if errors:
            stderr = "\n".join(errors) + "\n"
        return ExecResult(
            stdout=stdout,
            stderr=stderr,
            exit_code=2 if errors else 0,
        )

    async def _add_to_archive(
        self,
        ctx: CommandContext,
        tar: tarfile.TarFile,
        base_path: str,
        relative_path: str,
        verbose: bool,
        errors: list[str],
        exclude_patterns: list[str],
    ) -> str:
        """Add a file or directory to the archive. Returns verbose output."""
        full_path = ctx.fs.resolve_path(base_path, relative_path)
        verbose_output = ""

        # Check exclusion patterns
        for pattern in exclude_patterns:
            if fnmatch(relative_path, pattern) or fnmatch(relative_path.split("/")[-1], pattern):
                return ""

        try:
            stat = await ctx.fs.stat(full_path)
        except FileNotFoundError:
            errors.append(f"tar: {relative_path}: No such file or directory")
            return ""

        # Get mtime - handle both float and datetime
        mtime = stat.mtime
        if hasattr(mtime, 'timestamp'):
            mtime = int(mtime.timestamp())
        elif isinstance(mtime, (int, float)):
            mtime = int(mtime)
        else:
            mtime = 0

        if stat.is_directory:
            # Add directory entry
            info = tarfile.TarInfo(name=relative_path)
            info.type = tarfile.DIRTYPE
            info.mode = stat.mode
            info.mtime = mtime
            tar.addfile(info)
            if verbose:
                verbose_output += f"{relative_path}\n"

            # Add contents recursively
            items = await ctx.fs.readdir(full_path)
            for item in items:
                child_path = f"{relative_path}/{item}" if relative_path else item
                verbose_output += await self._add_to_archive(
                    ctx, tar, base_path, child_path, verbose, errors, exclude_patterns
                )

        elif stat.is_file:
            content = await ctx.fs.read_file_bytes(full_path)
            info = tarfile.TarInfo(name=relative_path)
            info.size = len(content)
            info.mode = stat.mode
            info.mtime = mtime
            tar.addfile(info, io.BytesIO(content))
            if verbose:
                verbose_output += f"{relative_path}\n"

        elif stat.is_symlink:
            target = await ctx.fs.readlink(full_path)
            info = tarfile.TarInfo(name=relative_path)
            info.type = tarfile.SYMTYPE
            info.linkname = target
            info.mode = stat.mode
            tar.addfile(info)
            if verbose:
                verbose_output += f"{relative_path}\n"

        return verbose_output

    def _is_bzip2(self, data: bytes) -> bool:
        """Check if data is bzip2 compressed."""
        return len(data) >= 2 and data[0:2] == b"BZ"

    def _is_xz(self, data: bytes) -> bool:
        """Check if data is xz compressed."""
        return len(data) >= 6 and data[0:6] == b"\xfd7zXZ\x00"

    def _decompress_data(
        self, data: bytes, use_gzip: bool, use_bzip2: bool, use_xz: bool
    ) -> bytes:
        """Decompress data based on flags or auto-detection."""
        # Try explicit flags first
        if use_bzip2:
            return bz2.decompress(data)
        if use_xz:
            return lzma.decompress(data)
        if use_gzip:
            return gzip.decompress(data)

        # Auto-detect compression
        if self._is_bzip2(data):
            return bz2.decompress(data)
        if self._is_xz(data):
            return lzma.decompress(data)
        if self._is_gzip(data):
            return gzip.decompress(data)

        return data  # No compression detected

    async def _extract_archive(
        self,
        ctx: CommandContext,
        archive_file: str,
        specific_files: list[str],
        work_dir: str,
        use_gzip: bool = False,
        use_bzip2: bool = False,
        use_xz: bool = False,
        verbose: bool = False,
        strip_components: int = 0,
        to_stdout: bool = False,
        keep_old_files: bool = False,
        no_mtime: bool = False,
        preserve_permissions: bool = False,
    ) -> ExecResult:
        """Extract a tar archive."""
        # Read archive
        if archive_file and archive_file != "-":
            archive_path = ctx.fs.resolve_path(ctx.cwd, archive_file)
            try:
                archive_data = await ctx.fs.read_file_bytes(archive_path)
            except FileNotFoundError:
                return ExecResult(
                    stdout="",
                    stderr=f"tar: {archive_file}: Cannot open: No such file or directory\n",
                    exit_code=2,
                )
        else:
            archive_data = ctx.stdin.encode("latin-1")

        # Decompress if needed
        try:
            decompressed = self._decompress_data(
                archive_data, use_gzip, use_bzip2, use_xz
            )
        except Exception as e:
            return ExecResult(
                stdout="",
                stderr=f"tar: error decompressing archive: {e}\n",
                exit_code=2,
            )

        # Open archive
        buffer = io.BytesIO(decompressed)
        try:
            tar = tarfile.open(fileobj=buffer, mode="r")
        except Exception as e:
            return ExecResult(
                stdout="",
                stderr=f"tar: error opening archive: {e}\n",
                exit_code=2,
            )

        verbose_output = ""
        stdout_content = ""
        errors: list[str] = []

        # Create work directory if needed (unless extracting to stdout)
        if not to_stdout:
            try:
                await ctx.fs.mkdir(work_dir, recursive=True)
            except Exception:
                pass

        for member in tar.getmembers():
            name = member.name

            # Apply strip-components
            if strip_components > 0:
                parts = name.split("/")
                if len(parts) <= strip_components:
                    continue  # Skip if not enough components
                name = "/".join(parts[strip_components:])
                if not name:
                    continue

            # Check if specific files requested
            if specific_files:
                if not any(
                    name == f or name.startswith(f"{f}/") or fnmatch(name, f)
                    for f in specific_files
                ):
                    continue

            target_path = ctx.fs.resolve_path(work_dir, name)

            try:
                if to_stdout:
                    # Extract file contents to stdout
                    if member.isfile():
                        f = tar.extractfile(member)
                        if f:
                            content = f.read()
                            try:
                                stdout_content += content.decode("utf-8")
                            except UnicodeDecodeError:
                                stdout_content += content.decode("latin-1")
                elif member.isdir():
                    if not keep_old_files or not await ctx.fs.exists(target_path):
                        await ctx.fs.mkdir(target_path, recursive=True)
                elif member.isfile():
                    # Check if file exists and -k flag is set
                    if keep_old_files and await ctx.fs.exists(target_path):
                        # Skip this file, keep the existing one
                        if verbose:
                            verbose_output += f"{name}\n"
                        continue

                    # Ensure parent directory exists
                    parent = target_path.rsplit("/", 1)[0]
                    if parent:
                        try:
                            await ctx.fs.mkdir(parent, recursive=True)
                        except Exception:
                            pass

                    f = tar.extractfile(member)
                    if f:
                        content = f.read()
                        await ctx.fs.write_file(target_path, content)

                        # Preserve permissions if requested
                        if preserve_permissions:
                            await ctx.fs.chmod(target_path, member.mode)

                elif member.issym():
                    if keep_old_files and await ctx.fs.exists(target_path):
                        if verbose:
                            verbose_output += f"{name}\n"
                        continue

                    parent = target_path.rsplit("/", 1)[0]
                    if parent:
                        try:
                            await ctx.fs.mkdir(parent, recursive=True)
                        except Exception:
                            pass
                    try:
                        await ctx.fs.symlink(member.linkname, target_path)
                    except Exception:
                        pass

                if verbose:
                    verbose_output += f"{name}\n"

            except Exception as e:
                errors.append(f"tar: {name}: {e}")

        tar.close()

        stderr = verbose_output
        if errors:
            stderr += "\n".join(errors) + "\n"
        return ExecResult(
            stdout=stdout_content,
            stderr=stderr,
            exit_code=2 if errors else 0,
        )

    async def _list_archive(
        self,
        ctx: CommandContext,
        archive_file: str,
        specific_files: list[str],
        use_gzip: bool = False,
        use_bzip2: bool = False,
        use_xz: bool = False,
        verbose: bool = False,
    ) -> ExecResult:
        """List contents of a tar archive."""
        # Read archive
        if archive_file and archive_file != "-":
            archive_path = ctx.fs.resolve_path(ctx.cwd, archive_file)
            try:
                archive_data = await ctx.fs.read_file_bytes(archive_path)
            except FileNotFoundError:
                return ExecResult(
                    stdout="",
                    stderr=f"tar: {archive_file}: Cannot open: No such file or directory\n",
                    exit_code=2,
                )
        else:
            archive_data = ctx.stdin.encode("latin-1")

        # Decompress if needed
        try:
            decompressed = self._decompress_data(
                archive_data, use_gzip, use_bzip2, use_xz
            )
        except Exception as e:
            return ExecResult(
                stdout="",
                stderr=f"tar: error decompressing archive: {e}\n",
                exit_code=2,
            )

        # Open archive
        buffer = io.BytesIO(decompressed)
        try:
            tar = tarfile.open(fileobj=buffer, mode="r")
        except Exception as e:
            return ExecResult(
                stdout="",
                stderr=f"tar: error opening archive: {e}\n",
                exit_code=2,
            )

        stdout = ""

        for member in tar.getmembers():
            name = member.name

            # Check if specific files requested
            if specific_files:
                if not any(
                    name == f or name.startswith(f"{f}/") or fnmatch(name, f)
                    for f in specific_files
                ):
                    continue

            if verbose:
                # Verbose format
                mode_str = self._format_mode(member.mode, member.isdir())
                owner = f"{member.uid}/{member.gid}"
                size = str(member.size).rjust(8)
                mtime = datetime.fromtimestamp(member.mtime)
                date_str = mtime.strftime("%b %d %H:%M")
                line = f"{mode_str} {owner:<10} {size} {date_str} {name}"
                if member.issym():
                    line += f" -> {member.linkname}"
                stdout += f"{line}\n"
            else:
                stdout += f"{name}\n"

        tar.close()
        return ExecResult(stdout=stdout, stderr="", exit_code=0)

    async def _append_archive(
        self,
        ctx: CommandContext,
        archive_file: str,
        files: list[str],
        work_dir: str,
        verbose: bool = False,
        exclude_patterns: list[str] | None = None,
    ) -> ExecResult:
        """Append files to an existing tar archive."""
        if exclude_patterns is None:
            exclude_patterns = []

        if not archive_file:
            return ExecResult(
                stdout="",
                stderr="tar: -r requires an archive file\n",
                exit_code=2,
            )

        # Read existing archive
        archive_path = ctx.fs.resolve_path(ctx.cwd, archive_file)
        try:
            archive_data = await ctx.fs.read_file_bytes(archive_path)
        except FileNotFoundError:
            return ExecResult(
                stdout="",
                stderr=f"tar: {archive_file}: Cannot open: No such file or directory\n",
                exit_code=2,
            )

        # Open existing archive
        buffer = io.BytesIO(archive_data)
        try:
            existing_tar = tarfile.open(fileobj=buffer, mode="r")
            existing_members = list(existing_tar.getmembers())
            existing_contents: dict[str, bytes] = {}
            for member in existing_members:
                if member.isfile():
                    f = existing_tar.extractfile(member)
                    if f:
                        existing_contents[member.name] = f.read()
            existing_tar.close()
        except Exception as e:
            return ExecResult(
                stdout="",
                stderr=f"tar: error opening archive: {e}\n",
                exit_code=2,
            )

        # Create new archive with existing + new files
        new_buffer = io.BytesIO()
        try:
            tar = tarfile.open(fileobj=new_buffer, mode="w")
        except Exception as e:
            return ExecResult(
                stdout="",
                stderr=f"tar: error creating archive: {e}\n",
                exit_code=2,
            )

        # Add existing members
        for member in existing_members:
            if member.isfile() and member.name in existing_contents:
                tar.addfile(member, io.BytesIO(existing_contents[member.name]))
            else:
                tar.addfile(member)

        verbose_output = ""
        errors: list[str] = []

        # Add new files
        for file_path in files:
            try:
                added = await self._add_to_archive(
                    ctx, tar, work_dir, file_path, verbose, errors, exclude_patterns
                )
                if verbose:
                    verbose_output += added
            except Exception as e:
                errors.append(f"tar: {file_path}: {e}")

        tar.close()

        # Write back the archive
        archive_data = new_buffer.getvalue()
        try:
            await ctx.fs.write_file(archive_path, archive_data)
        except Exception as e:
            return ExecResult(
                stdout="",
                stderr=f"tar: {archive_file}: {e}\n",
                exit_code=2,
            )

        stderr = verbose_output
        if errors:
            stderr = "\n".join(errors) + "\n"
        return ExecResult(
            stdout="",
            stderr=stderr,
            exit_code=2 if errors else 0,
        )

    async def _update_archive(
        self,
        ctx: CommandContext,
        archive_file: str,
        files: list[str],
        work_dir: str,
        verbose: bool = False,
        exclude_patterns: list[str] | None = None,
    ) -> ExecResult:
        """Update archive with files that are newer or don't exist in archive."""
        if exclude_patterns is None:
            exclude_patterns = []

        if not archive_file:
            return ExecResult(
                stdout="",
                stderr="tar: -u requires an archive file\n",
                exit_code=2,
            )

        # Read existing archive
        archive_path = ctx.fs.resolve_path(ctx.cwd, archive_file)
        try:
            archive_data = await ctx.fs.read_file_bytes(archive_path)
        except FileNotFoundError:
            return ExecResult(
                stdout="",
                stderr=f"tar: {archive_file}: Cannot open: No such file or directory\n",
                exit_code=2,
            )

        # Open existing archive and get member info
        buffer = io.BytesIO(archive_data)
        try:
            existing_tar = tarfile.open(fileobj=buffer, mode="r")
            existing_members = list(existing_tar.getmembers())
            existing_contents: dict[str, bytes] = {}
            existing_mtimes: dict[str, float] = {}
            for member in existing_members:
                existing_mtimes[member.name] = member.mtime
                if member.isfile():
                    f = existing_tar.extractfile(member)
                    if f:
                        existing_contents[member.name] = f.read()
            existing_tar.close()
        except Exception as e:
            return ExecResult(
                stdout="",
                stderr=f"tar: error opening archive: {e}\n",
                exit_code=2,
            )

        # Create new archive
        new_buffer = io.BytesIO()
        try:
            tar = tarfile.open(fileobj=new_buffer, mode="w")
        except Exception as e:
            return ExecResult(
                stdout="",
                stderr=f"tar: error creating archive: {e}\n",
                exit_code=2,
            )

        # Add existing members first
        for member in existing_members:
            if member.isfile() and member.name in existing_contents:
                tar.addfile(member, io.BytesIO(existing_contents[member.name]))
            else:
                tar.addfile(member)

        verbose_output = ""
        errors: list[str] = []

        # Add new/updated files
        for file_path in files:
            full_path = ctx.fs.resolve_path(work_dir, file_path)
            try:
                stat = await ctx.fs.stat(full_path)
                mtime = stat.mtime
                if hasattr(mtime, 'timestamp'):
                    mtime = mtime.timestamp()

                # Check if file needs updating
                if file_path in existing_mtimes:
                    if mtime <= existing_mtimes[file_path]:
                        continue  # Skip, archive version is not older

                # Add the file
                added = await self._add_to_archive(
                    ctx, tar, work_dir, file_path, verbose, errors, exclude_patterns
                )
                if verbose:
                    verbose_output += added
            except FileNotFoundError:
                errors.append(f"tar: {file_path}: No such file or directory")
            except Exception as e:
                errors.append(f"tar: {file_path}: {e}")

        tar.close()

        # Write back the archive
        archive_data = new_buffer.getvalue()
        try:
            await ctx.fs.write_file(archive_path, archive_data)
        except Exception as e:
            return ExecResult(
                stdout="",
                stderr=f"tar: {archive_file}: {e}\n",
                exit_code=2,
            )

        stderr = verbose_output
        if errors:
            stderr = "\n".join(errors) + "\n"
        return ExecResult(
            stdout="",
            stderr=stderr,
            exit_code=2 if errors else 0,
        )

    def _is_gzip(self, data: bytes) -> bool:
        """Check if data is gzip compressed."""
        return len(data) >= 2 and data[0] == 0x1F and data[1] == 0x8B

    def _format_mode(self, mode: int, is_dir: bool) -> str:
        """Format file mode like ls -l."""
        chars = "d" if is_dir else "-"
        perms = [
            "r" if mode & 0o400 else "-",
            "w" if mode & 0o200 else "-",
            "x" if mode & 0o100 else "-",
            "r" if mode & 0o040 else "-",
            "w" if mode & 0o020 else "-",
            "x" if mode & 0o010 else "-",
            "r" if mode & 0o004 else "-",
            "w" if mode & 0o002 else "-",
            "x" if mode & 0o001 else "-",
        ]
        return chars + "".join(perms)
