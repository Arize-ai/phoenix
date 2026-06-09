"""HTML to Markdown conversion command implementation."""

import re

from ...types import CommandContext, ExecResult


class HtmlToMarkdownCommand:
    """The html-to-markdown command - convert HTML to Markdown."""

    name = "html-to-markdown"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the html-to-markdown command."""
        try:
            from markdownify import markdownify
        except ImportError:
            return ExecResult(
                stdout="",
                stderr="html-to-markdown: markdownify package not installed\n",
                exit_code=1,
            )

        # Parse options
        bullet_char = "-"
        code_fence = "```"
        hr_style = "---"
        heading_style = "atx"
        file_path = None

        i = 0
        while i < len(args):
            arg = args[i]

            if arg == "--help" or arg == "-h":
                return ExecResult(
                    stdout=self._get_help(),
                    stderr="",
                    exit_code=0,
                )

            # Handle -b/--bullet
            if arg == "-b" and i + 1 < len(args):
                bullet_char = args[i + 1]
                i += 2
                continue
            if arg.startswith("--bullet="):
                bullet_char = arg[9:]
                i += 1
                continue

            # Handle -c/--code
            if arg == "-c" and i + 1 < len(args):
                code_fence = args[i + 1]
                i += 2
                continue
            if arg.startswith("--code="):
                code_fence = arg[7:]
                i += 1
                continue

            # Handle -r/--hr
            if arg == "-r" and i + 1 < len(args):
                hr_style = args[i + 1]
                i += 2
                continue
            if arg.startswith("--hr="):
                hr_style = arg[5:]
                i += 1
                continue

            # Handle --heading-style
            if arg.startswith("--heading-style="):
                heading_style = arg[16:]
                i += 1
                continue

            # Non-option argument is the file path
            if not arg.startswith("-") or arg == "-":
                file_path = arg
                i += 1
                continue

            i += 1

        # Get input content
        if file_path is None or file_path == "-":
            # Read from stdin
            html_content = ctx.stdin or ""
        else:
            # Read from file
            abs_path = self._resolve_path(file_path, ctx.cwd)
            if not await ctx.fs.exists(abs_path):
                return ExecResult(
                    stdout="",
                    stderr=f"html-to-markdown: {file_path}: No such file or directory\n",
                    exit_code=1,
                )
            stat = await ctx.fs.stat(abs_path)
            if stat and stat.is_directory:
                return ExecResult(
                    stdout="",
                    stderr=f"html-to-markdown: {file_path}: Is a directory\n",
                    exit_code=1,
                )
            html_content = await ctx.fs.read_file(abs_path)

        # Strip script, style, and footer elements before conversion
        html_content = self._strip_elements(html_content)

        # Convert HTML to Markdown
        try:
            # Configure markdownify options
            markdown = markdownify(
                html_content,
                bullets=bullet_char,
                code_language_callback=None,
                heading_style=heading_style.upper() if heading_style == "atx" else heading_style,
                strip=["script", "style", "footer"],
            )

            # Post-process: apply code fence style and hr style
            markdown = self._apply_code_fence(markdown, code_fence)
            markdown = self._apply_hr_style(markdown, hr_style)

            # Trim and ensure trailing newline
            result = markdown.strip()
            if result:
                result += "\n"

            return ExecResult(stdout=result, stderr="", exit_code=0)

        except Exception as e:
            return ExecResult(
                stdout="",
                stderr=f"html-to-markdown: conversion error: {e}\n",
                exit_code=1,
            )

    def _resolve_path(self, path: str, cwd: str) -> str:
        """Resolve a path relative to cwd."""
        if path.startswith("/"):
            return path
        if cwd.endswith("/"):
            return cwd + path
        return cwd + "/" + path

    def _strip_elements(self, html: str) -> str:
        """Strip script, style, and footer elements from HTML."""
        # Remove script tags and their content
        html = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
        # Remove style tags and their content
        html = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL | re.IGNORECASE)
        # Remove footer tags and their content
        html = re.sub(r"<footer[^>]*>.*?</footer>", "", html, flags=re.DOTALL | re.IGNORECASE)
        return html

    def _apply_code_fence(self, markdown: str, fence: str) -> str:
        """Replace default code fences with the specified style."""
        # Replace ``` with the specified fence
        if fence != "```":
            # Only replace fences that are on their own line
            markdown = re.sub(r"^```", fence, markdown, flags=re.MULTILINE)
        return markdown

    def _apply_hr_style(self, markdown: str, hr_style: str) -> str:
        """Replace default horizontal rules with the specified style."""
        # Markdownify uses ___ or --- or *** for hr
        # Replace common patterns
        markdown = re.sub(r"^___$", hr_style, markdown, flags=re.MULTILINE)
        markdown = re.sub(r"^\*\*\*$", hr_style, markdown, flags=re.MULTILINE)
        # Don't replace --- if it's already the style
        if hr_style != "---":
            markdown = re.sub(r"^---$", hr_style, markdown, flags=re.MULTILINE)
        return markdown

    def _get_help(self) -> str:
        """Return help text."""
        return """Usage: html-to-markdown [OPTIONS] [FILE]

Convert HTML to Markdown.

Options:
  -b, --bullet=CHAR     Bullet character for unordered lists (default: -)
  -c, --code=FENCE      Code fence style (default: ```)
  -r, --hr=STRING       Horizontal rule string (default: ---)
  --heading-style=STYLE Heading style: atx or setext (default: atx)
  -h, --help            Show this help message

If FILE is omitted or is -, read from standard input.
"""
