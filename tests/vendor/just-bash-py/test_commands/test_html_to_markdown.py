"""Tests for html-to-markdown command."""

import pytest

from just_bash import Bash


class TestHtmlToMarkdownBasic:
    """Test basic HTML to Markdown conversion."""

    @pytest.mark.asyncio
    async def test_basic_heading(self):
        """Convert h1 heading."""
        bash = Bash()
        result = await bash.exec('echo "<h1>Title</h1>" | html-to-markdown')
        assert result.exit_code == 0
        assert result.stdout.strip() == "# Title"

    @pytest.mark.asyncio
    async def test_h2_heading(self):
        """Convert h2 heading."""
        bash = Bash()
        result = await bash.exec('echo "<h2>Subtitle</h2>" | html-to-markdown')
        assert result.exit_code == 0
        assert result.stdout.strip() == "## Subtitle"

    @pytest.mark.asyncio
    async def test_paragraph(self):
        """Convert paragraph."""
        bash = Bash()
        result = await bash.exec('echo "<p>Hello world</p>" | html-to-markdown')
        assert result.exit_code == 0
        assert result.stdout.strip() == "Hello world"

    @pytest.mark.asyncio
    async def test_link(self):
        """Convert anchor tag to markdown link."""
        html = '<a href="https://example.com">Example</a>'
        bash = Bash(files={"/test.html": html})
        result = await bash.exec("html-to-markdown /test.html")
        assert result.exit_code == 0
        assert result.stdout.strip() == "[Example](https://example.com)"

    @pytest.mark.asyncio
    async def test_bold_text(self):
        """Convert bold/strong text."""
        bash = Bash()
        result = await bash.exec('echo "<strong>bold</strong>" | html-to-markdown')
        assert result.exit_code == 0
        assert result.stdout.strip() == "**bold**"

    @pytest.mark.asyncio
    async def test_italic_text(self):
        """Convert italic/em text."""
        bash = Bash()
        result = await bash.exec('echo "<em>italic</em>" | html-to-markdown')
        assert result.exit_code == 0
        assert result.stdout.strip() == "*italic*"


class TestHtmlToMarkdownStripping:
    """Test stripping of script, style, and footer elements."""

    @pytest.mark.asyncio
    async def test_strips_script(self):
        """Strip script tags."""
        bash = Bash()
        result = await bash.exec('echo "<p>Content</p><script>bad()</script>" | html-to-markdown')
        assert result.exit_code == 0
        assert "bad" not in result.stdout
        assert "Content" in result.stdout

    @pytest.mark.asyncio
    async def test_strips_style(self):
        """Strip style tags."""
        html = "<style>.red{color:red}</style><p>Text</p>"
        bash = Bash(files={"/test.html": html})
        result = await bash.exec("html-to-markdown /test.html")
        assert result.exit_code == 0
        assert "red" not in result.stdout
        assert "Text" in result.stdout

    @pytest.mark.asyncio
    async def test_strips_footer(self):
        """Strip footer tags."""
        html = "<main>Main</main><footer>Footer</footer>"
        bash = Bash(files={"/test.html": html})
        result = await bash.exec("html-to-markdown /test.html")
        assert result.exit_code == 0
        assert "Footer" not in result.stdout
        assert "Main" in result.stdout


class TestHtmlToMarkdownFileInput:
    """Test reading from files."""

    @pytest.mark.asyncio
    async def test_file_input(self):
        """Read HTML from file."""
        bash = Bash(files={"/test.html": "<h2>Hello</h2>"})
        result = await bash.exec("html-to-markdown /test.html")
        assert result.exit_code == 0
        assert result.stdout.strip() == "## Hello"

    @pytest.mark.asyncio
    async def test_file_not_found(self):
        """Error on non-existent file."""
        bash = Bash()
        result = await bash.exec("html-to-markdown /nonexistent.html")
        assert result.exit_code == 1
        assert "No such file" in result.stderr

    @pytest.mark.asyncio
    async def test_stdin_dash(self):
        """Read from stdin when file is -."""
        bash = Bash()
        result = await bash.exec('echo "<p>From stdin</p>" | html-to-markdown -')
        assert result.exit_code == 0
        assert "From stdin" in result.stdout


class TestHtmlToMarkdownOptions:
    """Test command options."""

    @pytest.mark.asyncio
    async def test_bullet_option(self):
        """Set bullet character with -b."""
        bash = Bash()
        result = await bash.exec('echo "<ul><li>Item</li></ul>" | html-to-markdown -b "+"')
        assert result.exit_code == 0
        assert "+" in result.stdout

    @pytest.mark.asyncio
    async def test_bullet_option_long(self):
        """Set bullet character with --bullet."""
        bash = Bash()
        result = await bash.exec('echo "<ul><li>Item</li></ul>" | html-to-markdown --bullet="*"')
        assert result.exit_code == 0
        assert "*" in result.stdout

    @pytest.mark.asyncio
    async def test_code_fence_option(self):
        """Set code fence style with -c."""
        bash = Bash()
        result = await bash.exec('echo "<pre><code>code</code></pre>" | html-to-markdown -c "~~~"')
        assert result.exit_code == 0
        assert "~~~" in result.stdout

    @pytest.mark.asyncio
    async def test_hr_option(self):
        """Set horizontal rule with -r."""
        bash = Bash()
        result = await bash.exec('echo "<hr/>" | html-to-markdown -r "---"')
        assert result.exit_code == 0
        assert "---" in result.stdout

    @pytest.mark.asyncio
    async def test_heading_style_atx(self):
        """Set heading style to atx."""
        bash = Bash()
        result = await bash.exec('echo "<h1>Title</h1>" | html-to-markdown --heading-style=atx')
        assert result.exit_code == 0
        assert result.stdout.strip() == "# Title"

    @pytest.mark.asyncio
    async def test_help(self):
        """Show help with --help."""
        bash = Bash()
        result = await bash.exec("html-to-markdown --help")
        assert result.exit_code == 0
        assert "Usage:" in result.stdout


class TestHtmlToMarkdownLists:
    """Test list conversion."""

    @pytest.mark.asyncio
    async def test_unordered_list(self):
        """Convert unordered list."""
        bash = Bash()
        result = await bash.exec('echo "<ul><li>One</li><li>Two</li></ul>" | html-to-markdown')
        assert result.exit_code == 0
        assert "One" in result.stdout
        assert "Two" in result.stdout

    @pytest.mark.asyncio
    async def test_ordered_list(self):
        """Convert ordered list."""
        bash = Bash()
        result = await bash.exec('echo "<ol><li>First</li><li>Second</li></ol>" | html-to-markdown')
        assert result.exit_code == 0
        assert "1." in result.stdout
        assert "First" in result.stdout


class TestHtmlToMarkdownCode:
    """Test code conversion."""

    @pytest.mark.asyncio
    async def test_inline_code(self):
        """Convert inline code."""
        bash = Bash()
        result = await bash.exec('echo "<code>var x = 1</code>" | html-to-markdown')
        assert result.exit_code == 0
        assert "`var x = 1`" in result.stdout

    @pytest.mark.asyncio
    async def test_code_block(self):
        """Convert code block."""
        bash = Bash()
        result = await bash.exec('echo "<pre><code>line1\\nline2</code></pre>" | html-to-markdown')
        assert result.exit_code == 0
        assert "```" in result.stdout or "line1" in result.stdout


class TestHtmlToMarkdownComplex:
    """Test complex HTML structures."""

    @pytest.mark.asyncio
    async def test_nested_structure(self):
        """Convert nested HTML structure."""
        html = "<div><h1>Title</h1><p>Paragraph with <strong>bold</strong> text.</p></div>"
        bash = Bash(files={"/test.html": html})
        result = await bash.exec("html-to-markdown /test.html")
        assert result.exit_code == 0
        assert "# Title" in result.stdout
        assert "**bold**" in result.stdout

    @pytest.mark.asyncio
    async def test_empty_input(self):
        """Handle empty input."""
        bash = Bash()
        result = await bash.exec('echo "" | html-to-markdown')
        assert result.exit_code == 0
        # Empty input should produce empty or whitespace-only output
