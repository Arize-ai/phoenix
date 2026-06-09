"""Tests for yq --front-matter functionality.

The --front-matter flag extracts YAML front matter from markdown files.
Front matter is YAML content between --- markers at the start of a file.
"""

import pytest
from just_bash.commands.yq.yq import YqCommand
from just_bash.types import CommandContext
from just_bash.fs import InMemoryFs


class TestYqFrontMatter:
    """Tests for yq --front-matter flag."""

    @pytest.mark.asyncio
    async def test_yq_front_matter_basic(self):
        """Extract basic front matter from markdown."""
        fs = InMemoryFs()
        content = """---
title: My Post
date: 2024-01-15
---

# My Post

This is the content of my blog post.
"""
        await fs.write_file("/post.md", content)

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="")
        cmd = YqCommand()
        result = await cmd.execute(["--front-matter", ".", "/post.md"], ctx)

        assert result.exit_code == 0
        assert "title" in result.stdout
        assert "My Post" in result.stdout
        assert "date" in result.stdout

    @pytest.mark.asyncio
    async def test_yq_front_matter_query(self):
        """Query specific field from front matter."""
        fs = InMemoryFs()
        content = """---
title: Test Title
author: John Doe
tags:
  - python
  - testing
---

Content here.
"""
        await fs.write_file("/doc.md", content)

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="")
        cmd = YqCommand()
        result = await cmd.execute(["--front-matter", ".title", "/doc.md"], ctx)

        assert result.exit_code == 0
        assert "Test Title" in result.stdout

    @pytest.mark.asyncio
    async def test_yq_front_matter_array(self):
        """Query array from front matter."""
        fs = InMemoryFs()
        content = """---
title: Tagged Post
tags:
  - javascript
  - web
  - tutorial
---

# Content
"""
        await fs.write_file("/tagged.md", content)

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="")
        cmd = YqCommand()
        result = await cmd.execute(["--front-matter", ".tags", "/tagged.md"], ctx)

        assert result.exit_code == 0
        assert "javascript" in result.stdout
        assert "web" in result.stdout
        assert "tutorial" in result.stdout

    @pytest.mark.asyncio
    async def test_yq_front_matter_to_json(self):
        """Convert front matter to JSON output."""
        fs = InMemoryFs()
        content = """---
name: project
version: 1.0.0
---

README content.
"""
        await fs.write_file("/README.md", content)

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="")
        cmd = YqCommand()
        result = await cmd.execute(["--front-matter", "-o", "json", ".", "/README.md"], ctx)

        assert result.exit_code == 0
        assert '"name"' in result.stdout
        assert '"project"' in result.stdout
        assert '"version"' in result.stdout

    @pytest.mark.asyncio
    async def test_yq_front_matter_no_front_matter(self):
        """Handle file with no front matter."""
        fs = InMemoryFs()
        content = """# Just a Heading

This file has no front matter.
"""
        await fs.write_file("/no_fm.md", content)

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="")
        cmd = YqCommand()
        result = await cmd.execute(["--front-matter", ".", "/no_fm.md"], ctx)

        # Should return null/empty or error gracefully
        assert result.exit_code == 0
        assert result.stdout.strip() in ("null", "{}", "")

    @pytest.mark.asyncio
    async def test_yq_front_matter_stdin(self):
        """Read front matter from stdin."""
        fs = InMemoryFs()
        stdin_content = """---
key: value
number: 42
---

Body content.
"""

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin=stdin_content)
        cmd = YqCommand()
        result = await cmd.execute(["--front-matter", ".key", "-"], ctx)

        assert result.exit_code == 0
        assert "value" in result.stdout

    @pytest.mark.asyncio
    async def test_yq_front_matter_short_flag(self):
        """Short flag -f for front-matter."""
        fs = InMemoryFs()
        content = """---
title: Short Flag Test
---

Content.
"""
        await fs.write_file("/short.md", content)

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="")
        cmd = YqCommand()
        result = await cmd.execute(["-f", ".title", "/short.md"], ctx)

        assert result.exit_code == 0
        assert "Short Flag Test" in result.stdout

    @pytest.mark.asyncio
    async def test_yq_front_matter_nested(self):
        """Query nested fields in front matter."""
        fs = InMemoryFs()
        content = """---
metadata:
  author: Jane Smith
  published: true
  stats:
    views: 1000
    likes: 50
---

Article content.
"""
        await fs.write_file("/nested.md", content)

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="")
        cmd = YqCommand()
        result = await cmd.execute(["--front-matter", ".metadata.author", "/nested.md"], ctx)

        assert result.exit_code == 0
        assert "Jane Smith" in result.stdout

    @pytest.mark.asyncio
    async def test_yq_front_matter_empty_front_matter(self):
        """Handle empty front matter block."""
        fs = InMemoryFs()
        content = """---
---

Content with empty front matter.
"""
        await fs.write_file("/empty_fm.md", content)

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="")
        cmd = YqCommand()
        result = await cmd.execute(["--front-matter", ".", "/empty_fm.md"], ctx)

        # Should return null/empty gracefully
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_yq_front_matter_with_body_containing_dashes(self):
        """Front matter extraction handles dashes in body correctly."""
        fs = InMemoryFs()
        content = """---
title: Code Example
---

Here's some code:

```
---
this is not front matter
---
```

More content.
"""
        await fs.write_file("/code.md", content)

        ctx = CommandContext(fs=fs, cwd="/", env={}, stdin="")
        cmd = YqCommand()
        result = await cmd.execute(["--front-matter", ".title", "/code.md"], ctx)

        assert result.exit_code == 0
        assert "Code Example" in result.stdout
        # Should NOT include the fake front matter from the code block
        assert "this is not front matter" not in result.stdout
