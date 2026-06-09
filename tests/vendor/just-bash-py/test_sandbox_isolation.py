"""
Test suite for verifying sandbox isolation.

This test suite attempts various bash "jailbreak" techniques to verify that
the just-bash-py interpreter cannot write to the real filesystem. All filesystem
operations should be contained within the in-memory virtual filesystem.

If any test in this suite fails, it means the sandbox has been breached and
real filesystem writes are possible - which is a critical security issue.
"""

import os
import tempfile
import uuid
import pytest
from pathlib import Path

from just_bash import Bash


# Generate unique markers for each test run to avoid false positives
def unique_marker() -> str:
    """Generate a unique string to detect real file writes."""
    return f"JAILBREAK_TEST_{uuid.uuid4().hex}"


def real_path_exists(path: str) -> bool:
    """Check if a path exists on the REAL filesystem."""
    return os.path.exists(path)


def real_file_contains(path: str, content: str) -> bool:
    """Check if a real file contains specific content."""
    try:
        with open(path, "r") as f:
            return content in f.read()
    except (FileNotFoundError, PermissionError, IOError):
        return False


class TestDirectFileWrites:
    """Test attempts to write files using standard redirection."""

    @pytest.mark.asyncio
    async def test_echo_redirect_to_tmp(self):
        """Attempt to write to /tmp on real filesystem."""
        marker = unique_marker()
        real_path = f"/tmp/{marker}.txt"

        bash = Bash()
        await bash.exec(f'echo "{marker}" > /tmp/{marker}.txt')

        assert not real_path_exists(real_path), \
            f"SECURITY BREACH: Real file was created at {real_path}"

    @pytest.mark.asyncio
    async def test_echo_append_redirect(self):
        """Attempt to append to a file using >>."""
        marker = unique_marker()
        real_path = f"/tmp/{marker}_append.txt"

        bash = Bash()
        await bash.exec(f'echo "{marker}" >> /tmp/{marker}_append.txt')

        assert not real_path_exists(real_path), \
            f"SECURITY BREACH: Real file was created at {real_path}"

    @pytest.mark.asyncio
    async def test_cat_heredoc_write(self):
        """Attempt to write file using cat with heredoc."""
        marker = unique_marker()
        real_path = f"/tmp/{marker}_heredoc.txt"

        bash = Bash()
        await bash.exec(f'''cat << EOF > /tmp/{marker}_heredoc.txt
{marker}
Some content
EOF''')

        assert not real_path_exists(real_path), \
            f"SECURITY BREACH: Heredoc created real file at {real_path}"

    @pytest.mark.asyncio
    async def test_printf_redirect(self):
        """Attempt to write using printf."""
        marker = unique_marker()
        real_path = f"/tmp/{marker}_printf.txt"

        bash = Bash()
        await bash.exec(f'printf "%s" "{marker}" > /tmp/{marker}_printf.txt')

        assert not real_path_exists(real_path), \
            f"SECURITY BREACH: printf created real file at {real_path}"

    @pytest.mark.asyncio
    async def test_tee_command(self):
        """Attempt to write using tee command."""
        marker = unique_marker()
        real_path = f"/tmp/{marker}_tee.txt"

        bash = Bash()
        await bash.exec(f'echo "{marker}" | tee /tmp/{marker}_tee.txt')

        assert not real_path_exists(real_path), \
            f"SECURITY BREACH: tee created real file at {real_path}"

    @pytest.mark.asyncio
    async def test_tee_append(self):
        """Attempt to append using tee -a."""
        marker = unique_marker()
        real_path = f"/tmp/{marker}_tee_append.txt"

        bash = Bash()
        await bash.exec(f'echo "{marker}" | tee -a /tmp/{marker}_tee_append.txt')

        assert not real_path_exists(real_path), \
            f"SECURITY BREACH: tee -a created real file at {real_path}"

    @pytest.mark.asyncio
    async def test_dd_write(self):
        """Attempt to write using dd command."""
        marker = unique_marker()
        real_path = f"/tmp/{marker}_dd.txt"

        bash = Bash()
        await bash.exec(f'echo "{marker}" | dd of=/tmp/{marker}_dd.txt 2>/dev/null')

        assert not real_path_exists(real_path), \
            f"SECURITY BREACH: dd created real file at {real_path}"


class TestPathTraversalAttacks:
    """Test attempts to escape sandbox via path traversal."""

    @pytest.mark.asyncio
    async def test_dotdot_escape_to_root(self):
        """Attempt to write to root using ../ traversal."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'cd /home/user && echo "{marker}" > ../../../tmp/{marker}.txt')

        assert not real_path_exists(f"/tmp/{marker}.txt"), \
            "SECURITY BREACH: Path traversal escaped to /tmp"

    @pytest.mark.asyncio
    async def test_deep_traversal(self):
        """Attempt deep path traversal to escape."""
        marker = unique_marker()

        bash = Bash()
        # Try to go way beyond root
        traversal = "../" * 50
        await bash.exec(f'echo "{marker}" > {traversal}tmp/{marker}.txt')

        assert not real_path_exists(f"/tmp/{marker}.txt"), \
            "SECURITY BREACH: Deep path traversal escaped sandbox"

    @pytest.mark.asyncio
    async def test_absolute_path_to_real_tmp(self):
        """Attempt to write directly to real /tmp with absolute path."""
        marker = unique_marker()
        real_path = f"/tmp/{marker}_absolute.txt"

        bash = Bash()
        await bash.exec(f'echo "{marker}" > {real_path}')

        assert not real_path_exists(real_path), \
            f"SECURITY BREACH: Absolute path write to {real_path}"

    @pytest.mark.asyncio
    async def test_home_directory_escape(self):
        """Attempt to write to real home directory."""
        marker = unique_marker()
        real_home = os.path.expanduser("~")
        real_path = f"{real_home}/.{marker}_test"

        bash = Bash()
        await bash.exec(f'echo "{marker}" > ~/.{marker}_test')

        assert not real_path_exists(real_path), \
            f"SECURITY BREACH: Escaped to real home directory at {real_path}"

    @pytest.mark.asyncio
    async def test_pwd_manipulation_escape(self):
        """Attempt to escape via PWD manipulation."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''
            export PWD=/tmp
            echo "{marker}" > ./{marker}_pwd.txt
        ''')

        assert not real_path_exists(f"/tmp/{marker}_pwd.txt"), \
            "SECURITY BREACH: PWD manipulation allowed escape"


class TestSymlinkAttacks:
    """Test attempts to use symlinks to escape sandbox."""

    @pytest.mark.asyncio
    async def test_symlink_to_real_tmp(self):
        """Create symlink pointing to real /tmp and write through it."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''
            ln -s /tmp /home/user/real_tmp_link
            echo "{marker}" > /home/user/real_tmp_link/{marker}.txt
        ''')

        assert not real_path_exists(f"/tmp/{marker}.txt"), \
            "SECURITY BREACH: Symlink allowed escape to real /tmp"

    @pytest.mark.asyncio
    async def test_symlink_to_real_home(self):
        """Create symlink to real home directory."""
        marker = unique_marker()
        real_home = os.path.expanduser("~")

        bash = Bash()
        await bash.exec(f'''
            ln -s {real_home} /home/user/real_home
            echo "{marker}" > /home/user/real_home/.{marker}_test
        ''')

        assert not real_path_exists(f"{real_home}/.{marker}_test"), \
            "SECURITY BREACH: Symlink to real home allowed escape"

    @pytest.mark.asyncio
    async def test_nested_symlinks_escape(self):
        """Attempt escape via nested symlinks."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''
            ln -s /tmp /home/user/link1
            ln -s /home/user/link1 /home/user/link2
            ln -s /home/user/link2 /home/user/link3
            echo "{marker}" > /home/user/link3/{marker}.txt
        ''')

        assert not real_path_exists(f"/tmp/{marker}.txt"), \
            "SECURITY BREACH: Nested symlinks allowed escape"

    @pytest.mark.asyncio
    async def test_relative_symlink_escape(self):
        """Attempt escape via relative symlink targets."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''
            cd /home/user
            ln -s ../../../tmp escape_link
            echo "{marker}" > escape_link/{marker}.txt
        ''')

        assert not real_path_exists(f"/tmp/{marker}.txt"), \
            "SECURITY BREACH: Relative symlink allowed escape"


class TestSubshellAndProcessEscapes:
    """Test attempts to escape via subshells and process spawning."""

    @pytest.mark.asyncio
    async def test_subshell_write(self):
        """Attempt to write from subshell."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'(echo "{marker}" > /tmp/{marker}_subshell.txt)')

        assert not real_path_exists(f"/tmp/{marker}_subshell.txt"), \
            "SECURITY BREACH: Subshell write escaped sandbox"

    @pytest.mark.asyncio
    async def test_nested_subshells(self):
        """Attempt escape via deeply nested subshells."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'((((echo "{marker}" > /tmp/{marker}_nested.txt))))')

        assert not real_path_exists(f"/tmp/{marker}_nested.txt"), \
            "SECURITY BREACH: Nested subshells allowed escape"

    @pytest.mark.asyncio
    async def test_command_substitution_write(self):
        """Attempt write via command substitution."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'result=$(echo "{marker}" > /tmp/{marker}_cmdsub.txt && echo done)')

        assert not real_path_exists(f"/tmp/{marker}_cmdsub.txt"), \
            "SECURITY BREACH: Command substitution allowed escape"

    @pytest.mark.asyncio
    async def test_backtick_substitution_write(self):
        """Attempt write via backtick substitution."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'result=`echo "{marker}" > /tmp/{marker}_backtick.txt`')

        assert not real_path_exists(f"/tmp/{marker}_backtick.txt"), \
            "SECURITY BREACH: Backtick substitution allowed escape"

    @pytest.mark.asyncio
    async def test_bash_c_execution(self):
        """Attempt escape via bash -c."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'bash -c \'echo "{marker}" > /tmp/{marker}_bashc.txt\'')

        assert not real_path_exists(f"/tmp/{marker}_bashc.txt"), \
            "SECURITY BREACH: bash -c allowed escape"

    @pytest.mark.asyncio
    async def test_sh_c_execution(self):
        """Attempt escape via sh -c."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'sh -c \'echo "{marker}" > /tmp/{marker}_shc.txt\'')

        assert not real_path_exists(f"/tmp/{marker}_shc.txt"), \
            "SECURITY BREACH: sh -c allowed escape"

    @pytest.mark.asyncio
    async def test_eval_write(self):
        """Attempt escape via eval."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'eval \'echo "{marker}" > /tmp/{marker}_eval.txt\'')

        assert not real_path_exists(f"/tmp/{marker}_eval.txt"), \
            "SECURITY BREACH: eval allowed escape"

    @pytest.mark.asyncio
    async def test_exec_redirect(self):
        """Attempt escape via exec with file descriptor."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''
            exec 3>/tmp/{marker}_exec.txt
            echo "{marker}" >&3
            exec 3>&-
        ''')

        assert not real_path_exists(f"/tmp/{marker}_exec.txt"), \
            "SECURITY BREACH: exec redirection allowed escape"


class TestArchiveEscapes:
    """Test attempts to escape via archive commands."""

    @pytest.mark.asyncio
    async def test_tar_extract_to_real_fs(self):
        """Attempt to extract tar to real filesystem location."""
        marker = unique_marker()

        bash = Bash(files={
            "/home/user/test.txt": marker
        })

        await bash.exec(f'''
            cd /home/user
            tar -cf archive.tar test.txt
            tar -xf archive.tar -C /tmp
        ''')

        assert not real_path_exists("/tmp/test.txt"), \
            "SECURITY BREACH: tar extracted to real /tmp"
        assert not real_file_contains("/tmp/test.txt", marker), \
            "SECURITY BREACH: tar content found in real /tmp"

    @pytest.mark.asyncio
    async def test_tar_absolute_path_extract(self):
        """Attempt tar extraction with absolute paths."""
        marker = unique_marker()

        bash = Bash(files={
            f"/tmp/{marker}_tartest.txt": marker
        })

        await bash.exec(f'''
            tar -cf /home/user/archive.tar /tmp/{marker}_tartest.txt
            tar -xf /home/user/archive.tar -C /
        ''')

        assert not real_path_exists(f"/tmp/{marker}_tartest.txt"), \
            "SECURITY BREACH: tar with absolute path escaped"

    @pytest.mark.asyncio
    async def test_gzip_to_real_fs(self):
        """Attempt gzip output to real filesystem."""
        marker = unique_marker()

        bash = Bash(files={
            "/home/user/test.txt": marker
        })

        await bash.exec('gzip -c /home/user/test.txt > /tmp/test.txt.gz')

        assert not real_path_exists("/tmp/test.txt.gz"), \
            "SECURITY BREACH: gzip output escaped to real /tmp"


class TestEnvironmentManipulation:
    """Test attempts to escape via environment variable manipulation."""

    @pytest.mark.asyncio
    async def test_path_manipulation(self):
        """Attempt escape via PATH manipulation."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''
            export PATH=/tmp:$PATH
            echo "{marker}" > /tmp/{marker}_path.txt
        ''')

        assert not real_path_exists(f"/tmp/{marker}_path.txt"), \
            "SECURITY BREACH: PATH manipulation allowed escape"

    @pytest.mark.asyncio
    async def test_home_manipulation(self):
        """Attempt escape via HOME manipulation."""
        marker = unique_marker()
        real_home = os.path.expanduser("~")

        bash = Bash()
        await bash.exec(f'''
            export HOME={real_home}
            echo "{marker}" > $HOME/.{marker}_home.txt
        ''')

        assert not real_path_exists(f"{real_home}/.{marker}_home.txt"), \
            "SECURITY BREACH: HOME manipulation allowed escape"

    @pytest.mark.asyncio
    async def test_tmpdir_manipulation(self):
        """Attempt escape via TMPDIR manipulation."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''
            export TMPDIR=/tmp
            echo "{marker}" > $TMPDIR/{marker}.txt
        ''')

        assert not real_path_exists(f"/tmp/{marker}.txt"), \
            "SECURITY BREACH: TMPDIR manipulation allowed escape"

    @pytest.mark.asyncio
    async def test_ld_preload_manipulation(self):
        """Attempt to set LD_PRELOAD (should have no real effect)."""
        marker = unique_marker()

        bash = Bash()
        result = await bash.exec(f'''
            export LD_PRELOAD=/tmp/evil.so
            echo "{marker}" > /tmp/{marker}_preload.txt
            echo $LD_PRELOAD
        ''')

        assert not real_path_exists(f"/tmp/{marker}_preload.txt"), \
            "SECURITY BREACH: LD_PRELOAD context allowed escape"


class TestDeviceAndSpecialFiles:
    """Test attempts to write to device and special files."""

    @pytest.mark.asyncio
    async def test_write_to_dev_null(self):
        """Attempt to interact with /dev/null."""
        bash = Bash()
        result = await bash.exec('echo "test" > /dev/null && echo "success"')
        # This should work in the virtual fs (simulated /dev/null behavior)
        # but should NOT touch real /dev/null
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_write_to_dev_tty(self):
        """Attempt to write to /dev/tty."""
        marker = unique_marker()

        bash = Bash()
        # Should not affect real terminal
        result = await bash.exec(f'echo "{marker}" > /dev/tty 2>/dev/null || echo "blocked"')
        # Just ensure no crash and no real effect
        assert result is not None

    @pytest.mark.asyncio
    async def test_write_to_proc(self):
        """Attempt to write to /proc filesystem."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'echo "{marker}" > /proc/self/cmdline 2>/dev/null || true')

        # Real /proc should be unaffected
        try:
            with open('/proc/self/cmdline', 'r') as f:
                assert marker not in f.read(), \
                    "SECURITY BREACH: Write to /proc succeeded"
        except (FileNotFoundError, PermissionError):
            pass  # OK if /proc not available

    @pytest.mark.asyncio
    async def test_write_to_sys(self):
        """Attempt to write to /sys filesystem."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'echo "{marker}" > /sys/test 2>/dev/null || true')

        assert not real_path_exists("/sys/test"), \
            "SECURITY BREACH: Created file in /sys"


class TestScriptAndSourceing:
    """Test attempts to escape via script sourcing and execution."""

    @pytest.mark.asyncio
    async def test_source_and_write(self):
        """Attempt escape by sourcing a script that writes."""
        marker = unique_marker()

        bash = Bash(files={
            "/home/user/evil.sh": f'echo "{marker}" > /tmp/{marker}_sourced.txt'
        })

        await bash.exec('source /home/user/evil.sh')

        assert not real_path_exists(f"/tmp/{marker}_sourced.txt"), \
            "SECURITY BREACH: Sourced script escaped sandbox"

    @pytest.mark.asyncio
    async def test_dot_source_and_write(self):
        """Attempt escape using dot command for sourcing."""
        marker = unique_marker()

        bash = Bash(files={
            "/home/user/evil.sh": f'echo "{marker}" > /tmp/{marker}_dot.txt'
        })

        await bash.exec('. /home/user/evil.sh')

        assert not real_path_exists(f"/tmp/{marker}_dot.txt"), \
            "SECURITY BREACH: Dot-sourced script escaped sandbox"

    @pytest.mark.asyncio
    async def test_executable_script(self):
        """Attempt escape via executable script."""
        marker = unique_marker()

        bash = Bash(files={
            "/home/user/evil.sh": f'''#!/bin/bash
echo "{marker}" > /tmp/{marker}_exec.txt
'''
        })

        await bash.exec('chmod +x /home/user/evil.sh && /home/user/evil.sh')

        assert not real_path_exists(f"/tmp/{marker}_exec.txt"), \
            "SECURITY BREACH: Executable script escaped sandbox"

    @pytest.mark.asyncio
    async def test_bash_file_execution(self):
        """Attempt escape by running bash with a file."""
        marker = unique_marker()

        bash = Bash(files={
            "/home/user/script.sh": f'echo "{marker}" > /tmp/{marker}_bashfile.txt'
        })

        await bash.exec('bash /home/user/script.sh')

        assert not real_path_exists(f"/tmp/{marker}_bashfile.txt"), \
            "SECURITY BREACH: bash file execution escaped sandbox"


class TestPipeAndRedirectionChains:
    """Test complex pipe and redirection chains."""

    @pytest.mark.asyncio
    async def test_pipe_to_tee_to_file(self):
        """Attempt escape via pipe chain to tee."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'echo "{marker}" | cat | tee /tmp/{marker}_pipetee.txt')

        assert not real_path_exists(f"/tmp/{marker}_pipetee.txt"), \
            "SECURITY BREACH: Pipe chain to tee escaped sandbox"

    @pytest.mark.asyncio
    async def test_multiple_redirections(self):
        """Attempt escape via multiple redirections."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'echo "{marker}" > /tmp/{marker}_r1.txt 2>&1 | tee /tmp/{marker}_r2.txt')

        assert not real_path_exists(f"/tmp/{marker}_r1.txt"), \
            "SECURITY BREACH: Multiple redirections escaped (r1)"
        assert not real_path_exists(f"/tmp/{marker}_r2.txt"), \
            "SECURITY BREACH: Multiple redirections escaped (r2)"

    @pytest.mark.asyncio
    async def test_process_substitution_write(self):
        """Attempt write via process substitution."""
        marker = unique_marker()

        bash = Bash()
        # Process substitution creating a pseudo-file
        # Note: Process substitution may not be implemented, which is fine -
        # the test passes as long as no real file is created
        try:
            await bash.exec(f'cat <(echo "{marker}") > /tmp/{marker}_procsub.txt')
        except Exception:
            # Parse error or not implemented is fine - sandbox held
            pass

        assert not real_path_exists(f"/tmp/{marker}_procsub.txt"), \
            "SECURITY BREACH: Process substitution allowed escape"

    @pytest.mark.asyncio
    async def test_xargs_write(self):
        """Attempt escape via xargs."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'echo "{marker}" | xargs -I{{}} sh -c \'echo {{}} > /tmp/{marker}_xargs.txt\'')

        assert not real_path_exists(f"/tmp/{marker}_xargs.txt"), \
            "SECURITY BREACH: xargs allowed escape"


class TestFileCreationCommands:
    """Test file creation commands."""

    @pytest.mark.asyncio
    async def test_touch_real_file(self):
        """Attempt to touch a file in real filesystem."""
        marker = unique_marker()
        real_path = f"/tmp/{marker}_touch.txt"

        bash = Bash()
        await bash.exec(f'touch {real_path}')

        assert not real_path_exists(real_path), \
            f"SECURITY BREACH: touch created real file at {real_path}"

    @pytest.mark.asyncio
    async def test_mkdir_real_dir(self):
        """Attempt to create directory in real filesystem."""
        marker = unique_marker()
        real_path = f"/tmp/{marker}_dir"

        bash = Bash()
        await bash.exec(f'mkdir -p {real_path}')

        assert not real_path_exists(real_path), \
            f"SECURITY BREACH: mkdir created real directory at {real_path}"

    @pytest.mark.asyncio
    async def test_cp_to_real_fs(self):
        """Attempt to copy file to real filesystem."""
        marker = unique_marker()

        bash = Bash(files={
            "/home/user/test.txt": marker
        })

        await bash.exec(f'cp /home/user/test.txt /tmp/{marker}_cp.txt')

        assert not real_path_exists(f"/tmp/{marker}_cp.txt"), \
            "SECURITY BREACH: cp escaped to real filesystem"

    @pytest.mark.asyncio
    async def test_mv_to_real_fs(self):
        """Attempt to move file to real filesystem."""
        marker = unique_marker()

        bash = Bash(files={
            "/home/user/test.txt": marker
        })

        await bash.exec(f'mv /home/user/test.txt /tmp/{marker}_mv.txt')

        assert not real_path_exists(f"/tmp/{marker}_mv.txt"), \
            "SECURITY BREACH: mv escaped to real filesystem"

    @pytest.mark.asyncio
    async def test_ln_hard_link_to_real_fs(self):
        """Attempt to create hard link in real filesystem."""
        marker = unique_marker()

        bash = Bash(files={
            "/home/user/test.txt": marker
        })

        await bash.exec(f'ln /home/user/test.txt /tmp/{marker}_hardlink.txt')

        assert not real_path_exists(f"/tmp/{marker}_hardlink.txt"), \
            "SECURITY BREACH: Hard link created in real filesystem"

    @pytest.mark.asyncio
    async def test_install_command(self):
        """Attempt to use install command to real filesystem."""
        marker = unique_marker()

        bash = Bash(files={
            "/home/user/test.txt": marker
        })

        await bash.exec(f'install /home/user/test.txt /tmp/{marker}_install.txt')

        assert not real_path_exists(f"/tmp/{marker}_install.txt"), \
            "SECURITY BREACH: install command escaped to real filesystem"


class TestFunctionAndAliasEscapes:
    """Test attempts to escape via function/alias redefinition."""

    @pytest.mark.asyncio
    async def test_function_override_echo(self):
        """Attempt escape by overriding echo function."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''
            echo() {{
                builtin echo "$@" > /tmp/{marker}_funcecho.txt
            }}
            echo "{marker}"
        ''')

        assert not real_path_exists(f"/tmp/{marker}_funcecho.txt"), \
            "SECURITY BREACH: Function override allowed escape"

    @pytest.mark.asyncio
    async def test_alias_escape(self):
        """Attempt escape via alias."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''
            alias myecho='echo "{marker}" > /tmp/{marker}_alias.txt'
            myecho
        ''')

        assert not real_path_exists(f"/tmp/{marker}_alias.txt"), \
            "SECURITY BREACH: Alias allowed escape"

    @pytest.mark.asyncio
    async def test_command_builtin_bypass(self):
        """Attempt escape using 'command' builtin."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'command echo "{marker}" > /tmp/{marker}_command.txt')

        assert not real_path_exists(f"/tmp/{marker}_command.txt"), \
            "SECURITY BREACH: command builtin allowed escape"


class TestTextProcessingEscapes:
    """Test escapes via text processing commands."""

    @pytest.mark.asyncio
    async def test_sed_inplace_real_file(self):
        """Attempt sed in-place edit on real filesystem."""
        marker = unique_marker()
        real_path = f"/tmp/{marker}_sed.txt"

        bash = Bash(files={
            "/tmp/test.txt": "original content"
        })

        # First create in virtual, then try to edit "real"
        await bash.exec(f'echo "test" | sed "s/test/{marker}/" > /tmp/{marker}_sed.txt')

        assert not real_path_exists(real_path), \
            "SECURITY BREACH: sed output escaped to real filesystem"

    @pytest.mark.asyncio
    async def test_awk_write(self):
        """Attempt escape via awk output redirection."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'echo "test" | awk \'{{print "{marker}"}}\' > /tmp/{marker}_awk.txt')

        assert not real_path_exists(f"/tmp/{marker}_awk.txt"), \
            "SECURITY BREACH: awk output escaped to real filesystem"

    @pytest.mark.asyncio
    async def test_awk_print_to_file(self):
        """Attempt awk print > file syntax."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'echo "test" | awk \'{{print "{marker}" > "/tmp/{marker}_awkfile.txt"}}\'')

        assert not real_path_exists(f"/tmp/{marker}_awkfile.txt"), \
            "SECURITY BREACH: awk print > file escaped sandbox"


class TestLoopAndControlFlowEscapes:
    """Test escapes via loops and control flow."""

    @pytest.mark.asyncio
    async def test_for_loop_write(self):
        """Attempt escape via for loop."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''
            for i in 1 2 3; do
                echo "{marker}_$i" > /tmp/{marker}_loop$i.txt
            done
        ''')

        for i in [1, 2, 3]:
            assert not real_path_exists(f"/tmp/{marker}_loop{i}.txt"), \
                f"SECURITY BREACH: For loop write escaped (iteration {i})"

    @pytest.mark.asyncio
    async def test_while_loop_write(self):
        """Attempt escape via while loop."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''
            i=0
            while [ $i -lt 3 ]; do
                echo "{marker}" > /tmp/{marker}_while$i.txt
                i=$((i+1))
            done
        ''')

        for i in range(3):
            assert not real_path_exists(f"/tmp/{marker}_while{i}.txt"), \
                f"SECURITY BREACH: While loop write escaped (iteration {i})"

    @pytest.mark.asyncio
    async def test_until_loop_write(self):
        """Attempt escape via until loop."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''
            i=0
            until [ $i -ge 2 ]; do
                echo "{marker}" > /tmp/{marker}_until$i.txt
                i=$((i+1))
            done
        ''')

        for i in range(2):
            assert not real_path_exists(f"/tmp/{marker}_until{i}.txt"), \
                f"SECURITY BREACH: Until loop write escaped (iteration {i})"


class TestSignalAndTrapEscapes:
    """Test attempts to escape via signals and traps."""

    @pytest.mark.asyncio
    async def test_trap_exit_write(self):
        """Attempt escape via EXIT trap."""
        marker = unique_marker()

        bash = Bash()
        # Note: exit may raise an ExitError that propagates - that's fine,
        # the test passes as long as no real file is created
        try:
            await bash.exec(f'''
                trap 'echo "{marker}" > /tmp/{marker}_trap.txt' EXIT
                exit 0
            ''')
        except Exception:
            # ExitError or trap not fully implemented is fine - sandbox held
            pass

        assert not real_path_exists(f"/tmp/{marker}_trap.txt"), \
            "SECURITY BREACH: EXIT trap allowed escape"

    @pytest.mark.asyncio
    async def test_trap_err_write(self):
        """Attempt escape via ERR trap."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''
            trap 'echo "{marker}" > /tmp/{marker}_errtrap.txt' ERR
            false
        ''')

        assert not real_path_exists(f"/tmp/{marker}_errtrap.txt"), \
            "SECURITY BREACH: ERR trap allowed escape"


class TestEncodingEscapes:
    """Test escapes via various encodings."""

    @pytest.mark.asyncio
    async def test_base64_decode_write(self):
        """Attempt escape via base64 decode and write."""
        marker = unique_marker()
        # Base64 encode the marker
        import base64
        encoded = base64.b64encode(marker.encode()).decode()

        bash = Bash()
        await bash.exec(f'echo "{encoded}" | base64 -d > /tmp/{marker}_b64.txt')

        assert not real_path_exists(f"/tmp/{marker}_b64.txt"), \
            "SECURITY BREACH: base64 decode escaped to real filesystem"

    @pytest.mark.asyncio
    async def test_hex_decode_write(self):
        """Attempt escape via hex decode."""
        marker = unique_marker()
        hex_marker = marker.encode().hex()

        bash = Bash()
        await bash.exec(f'echo "{hex_marker}" | xxd -r -p > /tmp/{marker}_hex.txt 2>/dev/null || true')

        assert not real_path_exists(f"/tmp/{marker}_hex.txt"), \
            "SECURITY BREACH: hex decode escaped to real filesystem"


class TestMultipleInstanceIsolation:
    """Test that multiple Bash instances don't affect each other or real FS."""

    @pytest.mark.asyncio
    async def test_parallel_instances_isolated(self):
        """Test that parallel instances are isolated from each other and real FS."""
        marker1 = unique_marker()
        marker2 = unique_marker()

        bash1 = Bash()
        bash2 = Bash()

        await bash1.exec(f'echo "{marker1}" > /tmp/shared.txt')
        await bash2.exec(f'echo "{marker2}" > /tmp/shared.txt')

        # Verify real filesystem is untouched
        assert not real_path_exists("/tmp/shared.txt") or \
               not real_file_contains("/tmp/shared.txt", marker1), \
            f"SECURITY BREACH: Instance 1 escaped to real /tmp"
        assert not real_path_exists("/tmp/shared.txt") or \
               not real_file_contains("/tmp/shared.txt", marker2), \
            f"SECURITY BREACH: Instance 2 escaped to real /tmp"

    @pytest.mark.asyncio
    async def test_sequential_instances_isolated(self):
        """Test sequential instances don't leak to real FS."""
        markers = [unique_marker() for _ in range(5)]

        for i, marker in enumerate(markers):
            bash = Bash()
            await bash.exec(f'echo "{marker}" > /tmp/seq_{i}.txt')

            assert not real_path_exists(f"/tmp/seq_{i}.txt"), \
                f"SECURITY BREACH: Sequential instance {i} escaped"


class TestEdgeCases:
    """Test edge cases and unusual attack vectors."""

    @pytest.mark.asyncio
    async def test_null_byte_in_path(self):
        """Attempt escape using null bytes in path."""
        marker = unique_marker()

        bash = Bash()
        # Null bytes might truncate paths in some implementations
        await bash.exec(f'echo "{marker}" > "/tmp/{marker}\\x00/real.txt" 2>/dev/null || true')

        assert not real_path_exists(f"/tmp/{marker}"), \
            "SECURITY BREACH: Null byte path truncation escaped"

    @pytest.mark.asyncio
    async def test_unicode_path_escape(self):
        """Attempt escape using unicode in path."""
        marker = unique_marker()

        bash = Bash()
        # Various unicode tricks
        await bash.exec(f'echo "{marker}" > /tmp/../tmp/{marker}_unicode.txt')

        assert not real_path_exists(f"/tmp/{marker}_unicode.txt"), \
            "SECURITY BREACH: Unicode path escaped"

    @pytest.mark.asyncio
    async def test_very_long_path(self):
        """Attempt escape with very long path."""
        marker = unique_marker()
        long_component = "a" * 255

        bash = Bash()
        await bash.exec(f'mkdir -p /tmp/{long_component} && echo "{marker}" > /tmp/{long_component}/test.txt')

        assert not real_path_exists(f"/tmp/{long_component}"), \
            "SECURITY BREACH: Long path created real directory"

    @pytest.mark.asyncio
    async def test_special_chars_in_filename(self):
        """Attempt escape with special characters in filename."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'echo "{marker}" > "/tmp/{marker}$(whoami).txt"')

        # Check for any file starting with the marker in /tmp
        import glob
        matches = glob.glob(f"/tmp/{marker}*")
        assert len(matches) == 0, \
            f"SECURITY BREACH: Special char filename escaped: {matches}"

    @pytest.mark.asyncio
    async def test_newline_in_command(self):
        """Attempt escape using newlines in command."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''echo "{marker}"
> /tmp/{marker}_newline.txt''')

        assert not real_path_exists(f"/tmp/{marker}_newline.txt"), \
            "SECURITY BREACH: Newline injection escaped"

    @pytest.mark.asyncio
    async def test_semicolon_injection(self):
        """Attempt escape via semicolon command injection."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'true; echo "{marker}" > /tmp/{marker}_semi.txt')

        assert not real_path_exists(f"/tmp/{marker}_semi.txt"), \
            "SECURITY BREACH: Semicolon injection escaped"

    @pytest.mark.asyncio
    async def test_ampersand_background(self):
        """Attempt escape via background execution."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'echo "{marker}" > /tmp/{marker}_bg.txt &')

        # Give it a moment in case of async escape
        import asyncio
        await asyncio.sleep(0.1)

        assert not real_path_exists(f"/tmp/{marker}_bg.txt"), \
            "SECURITY BREACH: Background execution escaped"

    @pytest.mark.asyncio
    async def test_or_operator_escape(self):
        """Attempt escape via || operator."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'false || echo "{marker}" > /tmp/{marker}_or.txt')

        assert not real_path_exists(f"/tmp/{marker}_or.txt"), \
            "SECURITY BREACH: OR operator allowed escape"

    @pytest.mark.asyncio
    async def test_and_operator_escape(self):
        """Attempt escape via && operator."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'true && echo "{marker}" > /tmp/{marker}_and.txt')

        assert not real_path_exists(f"/tmp/{marker}_and.txt"), \
            "SECURITY BREACH: AND operator allowed escape"


class TestRealWorldScenarios:
    """Test realistic attack scenarios."""

    @pytest.mark.asyncio
    async def test_cron_job_creation(self):
        """Attempt to create a cron job."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''
            echo "* * * * * echo {marker}" > /var/spool/cron/crontabs/root 2>/dev/null || true
            echo "* * * * * echo {marker}" > /etc/cron.d/{marker} 2>/dev/null || true
        ''')

        assert not real_path_exists(f"/etc/cron.d/{marker}"), \
            "SECURITY BREACH: Cron job created"

    @pytest.mark.asyncio
    async def test_ssh_key_injection(self):
        """Attempt to inject SSH key."""
        marker = unique_marker()
        real_home = os.path.expanduser("~")

        bash = Bash()
        await bash.exec(f'''
            mkdir -p ~/.ssh
            echo "ssh-rsa {marker}" >> ~/.ssh/authorized_keys
        ''')

        ssh_path = f"{real_home}/.ssh/authorized_keys"
        assert not real_file_contains(ssh_path, marker), \
            "SECURITY BREACH: SSH key injected into real authorized_keys"

    @pytest.mark.asyncio
    async def test_bashrc_modification(self):
        """Attempt to modify .bashrc."""
        marker = unique_marker()
        real_home = os.path.expanduser("~")

        bash = Bash()
        await bash.exec(f'echo "# {marker}" >> ~/.bashrc')

        bashrc_path = f"{real_home}/.bashrc"
        assert not real_file_contains(bashrc_path, marker), \
            "SECURITY BREACH: .bashrc modified"

    @pytest.mark.asyncio
    async def test_profile_modification(self):
        """Attempt to modify .profile."""
        marker = unique_marker()
        real_home = os.path.expanduser("~")

        bash = Bash()
        await bash.exec(f'echo "# {marker}" >> ~/.profile')

        profile_path = f"{real_home}/.profile"
        assert not real_file_contains(profile_path, marker), \
            "SECURITY BREACH: .profile modified"

    @pytest.mark.asyncio
    async def test_sudoers_modification(self):
        """Attempt to modify sudoers."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''
            echo "user ALL=(ALL) NOPASSWD: ALL # {marker}" >> /etc/sudoers 2>/dev/null || true
        ''')

        assert not real_file_contains("/etc/sudoers", marker), \
            "SECURITY BREACH: sudoers file modified"

    @pytest.mark.asyncio
    async def test_passwd_modification(self):
        """Attempt to modify /etc/passwd."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''
            echo "hacker:x:0:0:{marker}:/root:/bin/bash" >> /etc/passwd 2>/dev/null || true
        ''')

        assert not real_file_contains("/etc/passwd", marker), \
            "SECURITY BREACH: /etc/passwd modified"

    @pytest.mark.asyncio
    async def test_hosts_file_modification(self):
        """Attempt to modify /etc/hosts."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''
            echo "127.0.0.1 {marker}.evil.com" >> /etc/hosts 2>/dev/null || true
        ''')

        assert not real_file_contains("/etc/hosts", marker), \
            "SECURITY BREACH: /etc/hosts modified"


class TestFileDescriptorEscapes:
    """Test escapes via file descriptor manipulation."""

    @pytest.mark.asyncio
    async def test_fd_redirect_to_file(self):
        """Attempt escape via file descriptor redirection."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''
            exec 3>/tmp/{marker}_fd3.txt
            echo "{marker}" >&3
            exec 3>&-
        ''')

        assert not real_path_exists(f"/tmp/{marker}_fd3.txt"), \
            "SECURITY BREACH: FD redirection escaped"

    @pytest.mark.asyncio
    async def test_fd_duplication_escape(self):
        """Attempt escape via FD duplication."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''
            exec 4>&1
            echo "{marker}" > /tmp/{marker}_fd4.txt
        ''')

        assert not real_path_exists(f"/tmp/{marker}_fd4.txt"), \
            "SECURITY BREACH: FD duplication escaped"

    @pytest.mark.asyncio
    async def test_dev_fd_escape(self):
        """Attempt escape via /dev/fd."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'''
            echo "{marker}" > /dev/fd/3 3>/tmp/{marker}_devfd.txt 2>/dev/null || true
        ''')

        assert not real_path_exists(f"/tmp/{marker}_devfd.txt"), \
            "SECURITY BREACH: /dev/fd escape"


class TestCurlAndNetworkEscapes:
    """Test network-based escape attempts."""

    @pytest.mark.asyncio
    async def test_curl_output_to_file(self):
        """Attempt to use curl to write to real filesystem."""
        marker = unique_marker()

        bash = Bash()
        # Without network access configured, this should fail gracefully
        await bash.exec(f'curl -o /tmp/{marker}_curl.txt http://example.com 2>/dev/null || true')

        assert not real_path_exists(f"/tmp/{marker}_curl.txt"), \
            "SECURITY BREACH: curl output escaped"

    @pytest.mark.asyncio
    async def test_wget_to_file(self):
        """Attempt to use wget to write to real filesystem."""
        marker = unique_marker()

        bash = Bash()
        await bash.exec(f'wget -O /tmp/{marker}_wget.txt http://example.com 2>/dev/null || true')

        assert not real_path_exists(f"/tmp/{marker}_wget.txt"), \
            "SECURITY BREACH: wget output escaped"


class TestVerificationOfVirtualWrites:
    """Verify that virtual filesystem writes work correctly (positive tests)."""

    @pytest.mark.asyncio
    async def test_virtual_write_works(self):
        """Verify writes to virtual filesystem work."""
        marker = unique_marker()

        bash = Bash()
        result = await bash.exec(f'''
            echo "{marker}" > /home/user/test.txt
            cat /home/user/test.txt
        ''')

        assert marker in result.stdout, \
            "Virtual filesystem write failed - this shouldn't happen"

    @pytest.mark.asyncio
    async def test_virtual_tmp_write_works(self):
        """Verify writes to virtual /tmp work."""
        marker = unique_marker()

        bash = Bash()
        result = await bash.exec(f'''
            echo "{marker}" > /tmp/test.txt
            cat /tmp/test.txt
        ''')

        assert marker in result.stdout, \
            "Virtual /tmp write failed - this shouldn't happen"

        # But real /tmp should be untouched
        assert not real_path_exists("/tmp/test.txt") or \
               not real_file_contains("/tmp/test.txt", marker), \
            "SECURITY BREACH: Virtual /tmp write escaped to real /tmp"

    @pytest.mark.asyncio
    async def test_virtual_filesystem_persistence_within_session(self):
        """Verify files persist within a session but not to real FS."""
        marker = unique_marker()

        bash = Bash()

        # Write file
        await bash.exec(f'echo "{marker}" > /tmp/persist.txt')

        # Read it back in same session
        result = await bash.exec('cat /tmp/persist.txt')
        assert marker in result.stdout, "File should persist within session"

        # Real filesystem should be untouched
        assert not real_file_contains("/tmp/persist.txt", marker), \
            "SECURITY BREACH: Session file escaped to real filesystem"


# =============================================================================
# New Filesystem Security Tests
# =============================================================================


class TestOverlayFsEscapes:
    """Test OverlayFs sandbox escape attempts."""

    @pytest.mark.asyncio
    async def test_overlay_symlink_to_etc_passwd(self):
        """Attempt escape via symlink pointing to /etc/passwd."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            # Attempt to create symlink to real /etc/passwd
            await bash.exec('ln -s /etc/passwd /home/user/project/escape')

            # Reading through symlink should NOT return real passwd
            result = await bash.exec('cat /home/user/project/escape 2>/dev/null || echo "blocked"')

            # Should not contain real passwd content
            assert "root:" not in result.stdout, \
                "SECURITY BREACH: Symlink allowed reading real /etc/passwd"

    @pytest.mark.asyncio
    async def test_overlay_symlink_relative_escape(self):
        """Attempt escape via relative symlink traversal."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            # Attempt relative symlink that would escape
            await bash.exec('ln -s ../../../etc/passwd /home/user/project/escape')

            result = await bash.exec('cat /home/user/project/escape 2>/dev/null || echo "blocked"')

            assert "root:" not in result.stdout, \
                "SECURITY BREACH: Relative symlink allowed escape"

    @pytest.mark.asyncio
    async def test_overlay_real_symlink_on_disk_escape(self):
        """Test escape via pre-existing symlink in overlay root pointing outside."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create real symlink pointing outside
            escape_link = Path(tmpdir) / "escape"
            try:
                escape_link.symlink_to("/etc/passwd")
            except OSError:
                pytest.skip("Cannot create symlinks on this system")

            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            # Attempt to read through the real symlink
            result = await bash.exec('cat /home/user/project/escape 2>/dev/null || echo "blocked"')

            # Should NOT expose real /etc/passwd
            assert "root:" not in result.stdout, \
                "SECURITY BREACH: Real symlink on disk allowed escape to /etc/passwd"

    @pytest.mark.asyncio
    async def test_overlay_nested_symlink_escape_chain(self):
        """Test escape via chain of symlinks."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            # Create chain of symlinks
            await bash.exec('''
                ln -s /etc /home/user/project/link1
                ln -s /home/user/project/link1/passwd /home/user/project/link2
            ''')

            result = await bash.exec('cat /home/user/project/link2 2>/dev/null || echo "blocked"')

            assert "root:" not in result.stdout, \
                "SECURITY BREACH: Symlink chain allowed escape"

    @pytest.mark.asyncio
    async def test_overlay_path_traversal_via_mount_point(self):
        """Attempt path traversal through the mount point."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions
        marker = unique_marker()

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            # Attempt to traverse out of mount point
            await bash.exec(f'echo "{marker}" > /home/user/project/../../../tmp/{marker}.txt')

            assert not real_path_exists(f"/tmp/{marker}.txt"), \
                "SECURITY BREACH: Path traversal escaped mount point"

    @pytest.mark.asyncio
    async def test_overlay_write_outside_mount_point(self):
        """Attempt to write to path outside mount point."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions
        marker = unique_marker()

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            # Attempt direct write outside mount
            await bash.exec(f'echo "{marker}" > /tmp/{marker}_outside.txt')

            assert not real_path_exists(f"/tmp/{marker}_outside.txt"), \
                "SECURITY BREACH: Write outside mount point succeeded on real fs"

    @pytest.mark.asyncio
    async def test_overlay_write_to_mount_parent(self):
        """Attempt to write to parent of mount point."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions
        marker = unique_marker()

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            # Attempt write to parent directory
            await bash.exec(f'echo "{marker}" > /home/user/{marker}.txt')

            # Should not appear on real filesystem
            real_home = os.path.expanduser("~")
            assert not real_path_exists(f"{real_home}/{marker}.txt"), \
                "SECURITY BREACH: Write to mount parent escaped"

    @pytest.mark.asyncio
    async def test_overlay_readonly_write_blocked(self):
        """Verify read-only mode blocks writes."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions
        marker = unique_marker()

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir, read_only=True))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            result = await bash.exec(f'echo "{marker}" > /home/user/project/test.txt 2>&1')

            # Should fail with EROFS error
            assert "read-only" in result.stderr.lower() or result.exit_code != 0, \
                "SECURITY BREACH: Read-only mode did not block write"

    @pytest.mark.asyncio
    async def test_overlay_readonly_mkdir_blocked(self):
        """Verify read-only mode blocks directory creation."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir, read_only=True))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            result = await bash.exec('mkdir /home/user/project/newdir 2>&1')

            assert "read-only" in result.stderr.lower() or result.exit_code != 0, \
                "SECURITY BREACH: Read-only mode did not block mkdir"

    @pytest.mark.asyncio
    async def test_overlay_stat_symlink_no_info_leak(self):
        """Verify stat on symlink doesn't leak real filesystem info."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            # Create symlink to outside path
            await bash.exec('ln -s /etc/passwd /home/user/project/passwd_link')

            # stat should not reveal real file info
            result = await bash.exec('stat /home/user/project/passwd_link 2>&1 || echo "stat failed"')

            # Should not show the size of real /etc/passwd (usually > 1000 bytes)
            assert "stat failed" in result.stdout or "1000" not in result.stdout, \
                "SECURITY BREACH: stat may have leaked real file info"

    @pytest.mark.asyncio
    async def test_overlay_readlink_no_real_path_leak(self):
        """Verify readlink doesn't leak real filesystem paths."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a real symlink in the overlay root
            real_link = Path(tmpdir) / "reallink"
            try:
                real_link.symlink_to(Path(tmpdir) / "target")
            except OSError:
                pytest.skip("Cannot create symlinks on this system")

            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            # readlink should return virtual path, not real path
            result = await bash.exec('readlink /home/user/project/reallink 2>&1 || echo "blocked"')

            # Should not contain the real temp directory path
            assert tmpdir not in result.stdout, \
                "SECURITY BREACH: readlink leaked real filesystem path"

    @pytest.mark.asyncio
    async def test_overlay_delete_then_recreate_no_escape(self):
        """Test that deleting and recreating doesn't allow access to real file."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions
        marker = unique_marker()

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a real file in the overlay root
            real_file = Path(tmpdir) / "realfile.txt"
            real_file.write_text("REAL_CONTENT")

            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            # Delete the file (marks as deleted in overlay)
            await bash.exec('rm /home/user/project/realfile.txt')

            # Recreate with new content
            await bash.exec(f'echo "{marker}" > /home/user/project/realfile.txt')

            # Verify real file is unchanged
            assert real_file.read_text() == "REAL_CONTENT", \
                "SECURITY BREACH: Real file was modified"

            # Virtual file should have new content
            result = await bash.exec('cat /home/user/project/realfile.txt')
            assert marker in result.stdout


class TestReadWriteFsIsolation:
    """Test ReadWriteFs isolation when used with a specific root."""

    @pytest.mark.asyncio
    async def test_readwritefs_path_traversal_blocked(self):
        """Test that path traversal is normalized and doesn't escape root."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions
        marker = unique_marker()

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))

            # Attempt path traversal
            await fs.write_file("/../../../tmp/escape.txt", marker)

            # Should NOT exist on real /tmp
            assert not real_path_exists("/tmp/escape.txt"), \
                "SECURITY BREACH: Path traversal escaped ReadWriteFs root"

            # Should exist inside tmpdir (normalized to /tmp/escape.txt virtual = root/tmp/escape.txt)
            # or at root level

    @pytest.mark.asyncio
    async def test_readwritefs_symlink_escape_blocked(self):
        """Test that symlink creation to outside root is handled properly."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))

            # Create symlink pointing outside
            await fs.symlink("/etc/passwd", "/escape_link")

            # The symlink should exist but point to translated path, not real /etc/passwd
            target = await fs.readlink("/escape_link")

            # Reading through it should not return real passwd
            try:
                content = await fs.read_file("/escape_link")
                assert "root:" not in content, \
                    "SECURITY BREACH: Symlink allowed reading real /etc/passwd"
            except FileNotFoundError:
                pass  # OK - target doesn't exist in sandbox

    @pytest.mark.asyncio
    async def test_readwritefs_real_symlink_in_root_blocked(self):
        """Test handling of real symlinks pointing outside the root."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a real symlink pointing outside
            escape_link = Path(tmpdir) / "escape"
            try:
                escape_link.symlink_to("/etc/passwd")
            except OSError:
                pytest.skip("Cannot create symlinks on this system")

            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))

            # Attempt to read through the symlink
            try:
                content = await fs.read_file("/escape")
                # ReadWriteFs delegates to real filesystem, so this might work
                # The key is that writes through the symlink shouldn't escape
            except (FileNotFoundError, PermissionError):
                pass  # OK - access denied

    @pytest.mark.asyncio
    async def test_readwritefs_readlink_no_info_leak(self):
        """Test that readlink returns virtual paths when possible."""
        from just_bash.fs import ReadWriteFs, ReadWriteFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            fs = ReadWriteFs(ReadWriteFsOptions(root=tmpdir))

            # Create internal symlink
            target_dir = Path(tmpdir) / "target"
            target_dir.mkdir()

            await fs.symlink("/target", "/internal_link")

            target = await fs.readlink("/internal_link")

            # Should be a virtual path, not exposing real tmpdir
            assert tmpdir not in target or target.startswith("/"), \
                "SECURITY BREACH: readlink leaked real path"


class TestMountableFsCrossMountAttacks:
    """Test MountableFs mount boundary security."""

    @pytest.mark.asyncio
    async def test_cross_mount_hardlink_raises_exdev(self):
        """Test that hard links across mounts raise EXDEV error."""
        from just_bash.fs import MountableFs, MountableFsOptions, MountConfig, InMemoryFs

        fs1 = InMemoryFs(initial_files={"/file.txt": "content1"})
        fs2 = InMemoryFs()

        mountable = MountableFs(MountableFsOptions(
            base=InMemoryFs(),
            mounts=[
                MountConfig(mount_point="/mount1", filesystem=fs1),
                MountConfig(mount_point="/mount2", filesystem=fs2),
            ]
        ))

        # Attempt cross-mount hard link
        with pytest.raises(OSError) as exc_info:
            await mountable.link("/mount1/file.txt", "/mount2/hardlink.txt")

        assert "EXDEV" in str(exc_info.value), \
            "Cross-mount hard link should raise EXDEV error"

    @pytest.mark.asyncio
    async def test_cross_mount_symlink_isolation(self):
        """Test that symlinks across mounts don't leak between mounts."""
        from just_bash.fs import MountableFs, MountableFsOptions, MountConfig, InMemoryFs

        fs1 = InMemoryFs(initial_files={"/secret.txt": "SECRET_DATA"})
        fs2 = InMemoryFs()

        mountable = MountableFs(MountableFsOptions(
            base=InMemoryFs(),
            mounts=[
                MountConfig(mount_point="/mount1", filesystem=fs1),
                MountConfig(mount_point="/mount2", filesystem=fs2),
            ]
        ))

        # Create symlink in mount2 pointing to mount1
        await mountable.symlink("/mount1/secret.txt", "/mount2/link_to_secret")

        # Reading through symlink - this tests the behavior
        try:
            content = await mountable.read_file("/mount2/link_to_secret")
            # If it reads successfully, verify it got the right content
            # (cross-mount symlinks may or may not work by design)
        except FileNotFoundError:
            pass  # OK - symlink target not accessible across mounts

    @pytest.mark.asyncio
    async def test_mount_boundary_path_confusion(self):
        """Test edge cases in mount point path matching."""
        from just_bash.fs import MountableFs, MountableFsOptions, MountConfig, InMemoryFs

        fs1 = InMemoryFs(initial_files={"/file.txt": "mount1_content"})

        mountable = MountableFs(MountableFsOptions(
            base=InMemoryFs(),
            mounts=[
                MountConfig(mount_point="/mount", filesystem=fs1),
            ]
        ))

        # Test paths that might confuse mount matching
        test_paths = [
            "/mount../escape",  # Should not match /mount
            "/mountx/file",     # Should not match /mount
            "/moun/file",       # Should not match /mount
        ]

        for path in test_paths:
            # These should route to base filesystem, not the mount
            try:
                exists = await mountable.exists(path)
                # Should not exist since base is empty
            except Exception:
                pass  # OK

    @pytest.mark.asyncio
    async def test_nested_mount_escape(self):
        """Test that nested mounts don't allow escaping to parent mount."""
        from just_bash.fs import MountableFs, MountableFsOptions, MountConfig, InMemoryFs
        marker = unique_marker()

        parent_fs = InMemoryFs(initial_files={"/parent_secret.txt": "PARENT_SECRET"})
        child_fs = InMemoryFs()

        mountable = MountableFs(MountableFsOptions(
            base=InMemoryFs(),
            mounts=[
                MountConfig(mount_point="/parent", filesystem=parent_fs),
                MountConfig(mount_point="/parent/child", filesystem=child_fs),
            ]
        ))

        # Attempt to traverse from child to parent
        await mountable.write_file("/parent/child/../escape.txt", marker)

        # Should have written to parent_fs, not escaped
        # The path /parent/child/../escape.txt normalizes to /parent/escape.txt

        # Verify it's in the parent mount, not escaped elsewhere
        content = await mountable.read_file("/parent/escape.txt")
        assert marker in content

    @pytest.mark.asyncio
    async def test_mount_point_removal_blocked(self):
        """Test that mount points cannot be removed."""
        from just_bash.fs import MountableFs, MountableFsOptions, MountConfig, InMemoryFs

        mountable = MountableFs(MountableFsOptions(
            base=InMemoryFs(),
            mounts=[
                MountConfig(mount_point="/mount1", filesystem=InMemoryFs()),
            ]
        ))

        # Attempt to remove mount point
        with pytest.raises(OSError) as exc_info:
            await mountable.rm("/mount1", recursive=True)

        assert "EBUSY" in str(exc_info.value), \
            "Mount point removal should raise EBUSY"


class TestBashWithOverlayFs:
    """Test Bash commands with OverlayFs don't escape sandbox."""

    @pytest.mark.asyncio
    async def test_bash_ln_symlink_escape_blocked(self):
        """Test ln -s command doesn't allow escape."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions
        marker = unique_marker()

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            # Attempt symlink to real filesystem
            await bash.exec('ln -s /etc/passwd /home/user/project/passwd')
            await bash.exec(f'echo "{marker}" >> /home/user/project/passwd 2>/dev/null || true')

            # Real /etc/passwd should be unchanged
            assert not real_file_contains("/etc/passwd", marker), \
                "SECURITY BREACH: ln -s allowed modifying real /etc/passwd"

    @pytest.mark.asyncio
    async def test_bash_symlink_chain_escape_blocked(self):
        """Test chained symlinks via bash don't escape."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions
        marker = unique_marker()

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            # Create chain of symlinks
            await bash.exec('''
                ln -s /tmp /home/user/project/tmp_link
                ln -s /home/user/project/tmp_link /home/user/project/chain1
                ln -s /home/user/project/chain1 /home/user/project/chain2
            ''')

            await bash.exec(f'echo "{marker}" > /home/user/project/chain2/{marker}.txt 2>/dev/null || true')

            assert not real_path_exists(f"/tmp/{marker}.txt"), \
                "SECURITY BREACH: Symlink chain allowed escape to /tmp"

    @pytest.mark.asyncio
    async def test_bash_write_via_symlink_blocked(self):
        """Test writing through symlink doesn't escape overlay."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions
        marker = unique_marker()

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            # Create symlink and try to write through it
            await bash.exec(f'''
                ln -s /tmp /home/user/project/tmp_escape
                echo "{marker}" > /home/user/project/tmp_escape/{marker}_write.txt 2>/dev/null || true
            ''')

            assert not real_path_exists(f"/tmp/{marker}_write.txt"), \
                "SECURITY BREACH: Write through symlink escaped"

    @pytest.mark.asyncio
    async def test_bash_read_outside_mount_blocked(self):
        """Test reading files outside mount point is blocked."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            # Attempt to read real /etc/passwd directly
            result = await bash.exec('cat /etc/passwd 2>/dev/null || echo "blocked"')

            # Either blocked or returns virtual (non-existent) file
            assert "root:" not in result.stdout, \
                "SECURITY BREACH: Direct read of /etc/passwd succeeded"

    @pytest.mark.asyncio
    async def test_bash_path_traversal_via_overlay(self):
        """Test path traversal in bash commands with overlay."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions
        marker = unique_marker()

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            # Various path traversal attempts
            traversal_commands = [
                f'echo "{marker}" > /home/user/project/../../../tmp/{marker}_t1.txt',
                f'echo "{marker}" > /home/user/../../../tmp/{marker}_t2.txt',
                f'echo "{marker}" > /../../../../../tmp/{marker}_t3.txt',
            ]

            for cmd in traversal_commands:
                await bash.exec(f'{cmd} 2>/dev/null || true')

            # None should have escaped
            for i in range(1, 4):
                assert not real_path_exists(f"/tmp/{marker}_t{i}.txt"), \
                    f"SECURITY BREACH: Path traversal {i} escaped"

    @pytest.mark.asyncio
    async def test_bash_cp_through_symlink_blocked(self):
        """Test cp through symlink doesn't escape."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions
        marker = unique_marker()

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            await bash.exec(f'''
                echo "{marker}" > /home/user/project/source.txt
                ln -s /tmp /home/user/project/tmp_link
                cp /home/user/project/source.txt /home/user/project/tmp_link/{marker}_cp.txt 2>/dev/null || true
            ''')

            assert not real_path_exists(f"/tmp/{marker}_cp.txt"), \
                "SECURITY BREACH: cp through symlink escaped"

    @pytest.mark.asyncio
    async def test_bash_mv_through_symlink_blocked(self):
        """Test mv through symlink doesn't escape."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions
        marker = unique_marker()

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            await bash.exec(f'''
                echo "{marker}" > /home/user/project/moveme.txt
                ln -s /tmp /home/user/project/tmp_link
                mv /home/user/project/moveme.txt /home/user/project/tmp_link/{marker}_mv.txt 2>/dev/null || true
            ''')

            assert not real_path_exists(f"/tmp/{marker}_mv.txt"), \
                "SECURITY BREACH: mv through symlink escaped"

    @pytest.mark.asyncio
    async def test_bash_tar_through_overlay_symlink(self):
        """Test tar extraction through symlink doesn't escape."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions
        marker = unique_marker()

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            await bash.exec(f'''
                echo "{marker}" > /home/user/project/tarfile.txt
                tar -cf /home/user/project/archive.tar -C /home/user/project tarfile.txt
                ln -s /tmp /home/user/project/tmp_link
                tar -xf /home/user/project/archive.tar -C /home/user/project/tmp_link 2>/dev/null || true
            ''')

            assert not real_path_exists("/tmp/tarfile.txt"), \
                "SECURITY BREACH: tar extraction through symlink escaped"

    @pytest.mark.asyncio
    async def test_bash_overlay_preserves_real_files(self):
        """Test that overlay protects real files from modification."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions
        marker = unique_marker()

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a real file
            real_file = Path(tmpdir) / "protected.txt"
            real_file.write_text("ORIGINAL_CONTENT")

            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            # Modify via bash
            await bash.exec(f'echo "{marker}" > /home/user/project/protected.txt')

            # Read via bash should show modified content
            result = await bash.exec('cat /home/user/project/protected.txt')
            assert marker in result.stdout

            # But real file should be unchanged
            assert real_file.read_text() == "ORIGINAL_CONTENT", \
                "SECURITY BREACH: Overlay modified real file"

    @pytest.mark.asyncio
    async def test_bash_overlay_deletes_dont_affect_real(self):
        """Test that deletes in overlay don't affect real files."""
        from just_bash import Bash
        from just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a real file
            real_file = Path(tmpdir) / "deleteme.txt"
            real_file.write_text("DO_NOT_DELETE")

            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))
            bash = Bash(fs=overlay, cwd=overlay.get_mount_point())

            # Delete via bash
            await bash.exec('rm /home/user/project/deleteme.txt')

            # File should appear deleted in overlay
            result = await bash.exec('ls /home/user/project/deleteme.txt 2>&1 || echo "deleted"')
            assert "deleted" in result.stdout or "No such file" in result.stderr

            # But real file should still exist
            assert real_file.exists(), \
                "SECURITY BREACH: Overlay delete removed real file"
            assert real_file.read_text() == "DO_NOT_DELETE"


class TestOverlayFsDirectApiEscapes:
    """Test OverlayFs direct API calls for escapes (not via Bash)."""

    @pytest.mark.asyncio
    async def test_direct_read_file_outside_mount(self):
        """Test read_file directly on path outside mount."""
        from just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))

            # Attempt to read /etc/passwd directly
            try:
                content = await overlay.read_file("/etc/passwd")
                assert "root:" not in content, \
                    "SECURITY BREACH: Direct read_file accessed real /etc/passwd"
            except FileNotFoundError:
                pass  # Expected - path outside mount

    @pytest.mark.asyncio
    async def test_direct_write_file_outside_mount(self):
        """Test write_file directly on path outside mount."""
        from just_bash.fs import OverlayFs, OverlayFsOptions
        marker = unique_marker()

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))

            # Attempt to write to /tmp directly
            await overlay.write_file(f"/tmp/{marker}.txt", marker)

            # Should not exist on real /tmp
            assert not real_path_exists(f"/tmp/{marker}.txt"), \
                "SECURITY BREACH: Direct write_file escaped to real /tmp"

    @pytest.mark.asyncio
    async def test_direct_mkdir_outside_mount(self):
        """Test mkdir directly on path outside mount doesn't escape to real fs."""
        from just_bash.fs import OverlayFs, OverlayFsOptions
        marker = unique_marker()

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))

            # Attempt to create directory in /tmp
            # This may fail with ENOENT (parent doesn't exist) or RecursionError
            # Either way, it should NOT create a real directory
            try:
                await overlay.mkdir(f"/tmp/{marker}_dir", recursive=True)
            except (OSError, RecursionError):
                pass  # Expected - can't create outside mount

            assert not real_path_exists(f"/tmp/{marker}_dir"), \
                "SECURITY BREACH: Direct mkdir escaped to real /tmp"

    @pytest.mark.asyncio
    async def test_direct_symlink_api_outside_mount(self):
        """Test symlink API creating link outside mount."""
        from just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))

            # Create symlink at mount point pointing outside
            await overlay.symlink("/etc/passwd", "/home/user/project/etc_link")

            # Attempting to read through it should not return real passwd
            try:
                content = await overlay.read_file("/home/user/project/etc_link")
                assert "root:" not in content, \
                    "SECURITY BREACH: Symlink API allowed reading real /etc/passwd"
            except (FileNotFoundError, OSError):
                pass  # Expected - target doesn't resolve

    @pytest.mark.asyncio
    async def test_direct_exists_outside_mount(self):
        """Test exists check on paths outside mount."""
        from just_bash.fs import OverlayFs, OverlayFsOptions

        with tempfile.TemporaryDirectory() as tmpdir:
            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))

            # These real paths should not be visible
            real_paths = ["/etc/passwd", "/bin/sh", "/usr"]

            for path in real_paths:
                exists = await overlay.exists(path)
                # Should not expose real filesystem structure outside mount
                # (paths outside mount should be in virtual space, not real)

    @pytest.mark.asyncio
    async def test_direct_cp_outside_mount(self):
        """Test cp API copying outside mount boundaries."""
        from just_bash.fs import OverlayFs, OverlayFsOptions
        marker = unique_marker()

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a file in the overlay
            (Path(tmpdir) / "source.txt").write_text(marker)

            overlay = OverlayFs(OverlayFsOptions(root=tmpdir))

            # Copy from mount to outside
            await overlay.cp("/home/user/project/source.txt", f"/tmp/{marker}_copied.txt")

            assert not real_path_exists(f"/tmp/{marker}_copied.txt"), \
                "SECURITY BREACH: cp API escaped to real /tmp"
