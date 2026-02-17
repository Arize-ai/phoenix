---
name: mintlify
description: Build and maintain documentation sites with Mintlify. Use when
  creating docs pages, configuring navigation, adding components, or setting up
  API references.
license: MIT
compatibility: Requires Node.js for CLI. Works with any Git-based workflow.
metadata:
  author: mintlify
  version: "1.0"
  mintlify-proj: mintlify
  internal: true
---

# Mintlify best practices

**Always consult [mintlify.com/docs](https://mintlify.com/docs) for components, configuration, and latest features.**

If you are not already connected to the Mintlify MCP server, [https://mintlify.com/docs/mcp](https://mintlify.com/docs/mcp), add it so that you can search more efficiently.

Mintlify is a documentation platform that transforms MDX files into documentation sites. Configure site-wide settings in the `docs.json` file, write content in MDX with YAML frontmatter, and favor built-in components over custom components.

Full schema at [mintlify.com/docs.json](https://mintlify.com/docs.json).

## Quick reference

### CLI commands

* `npm i -g mint` - Install the Mintlify CLI
* `mint dev` - Local preview at localhost:3000
* `mint broken-links` - Check internal links
* `mint a11y` - Check for accessibility issues in content
* `mint rename` - Rename/move files and update references
* `mint validate` - Validate documentation builds

### Required files

* `docs.json` - Site configuration (navigation, theme, integrations, etc.). See [global settings](https://mintlify.com/docs/settings/global) for all options.
* `*.mdx` files - Documentation pages with YAML frontmatter

### Example file structure

```
project/
├── docs.json           # Site configuration
├── introduction.mdx
├── quickstart.mdx
├── guides/
│   └── example.mdx
├── openapi.yml         # API specification
├── images/             # Static assets
│   └── example.png
└── snippets/           # Reusable components
    └── component.jsx
```

## Organize content

When a user asks about anything related to site-wide configurations, start by understanding the [global settings](https://www.mintlify.com/docs/organize/settings). See if a setting in the `docs.json` file can be updated to achieve what the user wants.

### Navigation

The `navigation` property in `docs.json` controls site structure. Choose one primary pattern at the root level, then nest others within it.

**Choose your primary pattern:**

| Pattern       | When to use                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------- |
| **Groups**    | Default. Single audience, straightforward hierarchy                                            |
| **Tabs**      | Distinct sections with different audiences (Guides vs API Reference) or content types          |
| **Anchors**   | Want persistent section links at sidebar top. Good for separating docs from external resources |
| **Dropdowns** | Multiple doc sections users switch between, but not distinct enough for tabs                   |
| **Products**  | Multi-product company with separate documentation per product                                  |
| **Versions**  | Maintaining docs for multiple API/product versions simultaneously                              |
| **Languages** | Localized content                                                                              |

**Within your primary pattern:**

* **Groups** - Organize related pages. Can nest groups within groups, but keep hierarchy shallow
* **Menus** - Add dropdown navigation within tabs for quick jumps to specific pages
* **`expanded: false`** - Collapse nested groups by default. Use for reference sections users browse selectively
* **`openapi`** - Auto-generate pages from OpenAPI spec. Add at group/tab level to inherit

**Common combinations:**

* Tabs containing groups (most common for docs with API reference)
* Products containing tabs (multi-product SaaS)
* Versions containing tabs (versioned API docs)
* Anchors containing groups (simple docs with external resource links)

### Links and paths

* **Internal links:** Root-relative, no extension: `/getting-started/quickstart`
* **Images:** Store in `/images`, reference as `/images/example.png`
* **External links:** Use full URLs, they open in new tabs automatically

## Customize docs sites

**What to customize where:**

* **Brand colors, fonts, logo** → `docs.json`. See [global settings](https://mintlify.com/docs/settings/global)
* **Component styling, layout tweaks** → `custom.css` at project root
* **Dark mode** → Enabled by default. Only disable with `"appearance": "light"` in `docs.json` if brand requires it

Start with `docs.json`. Only add `custom.css` when you need styling that config doesn't support.

## Write content

### Components

The [components overview](https://mintlify.com/docs/components) organizes all components by purpose: structure content, draw attention, show/hide content, document APIs, link to pages, and add visual context. Start there to find the right component.

**Common decision points:**

| Need                       | Use                     |
| -------------------------- | ----------------------- |
| Hide optional details      | `<Accordion>`           |
| Long code examples         | `<Expandable>`          |
| User chooses one option    | `<Tabs>`                |
| Linked navigation cards    | `<Card>` in `<Columns>` |
| Sequential instructions    | `<Steps>`               |
| Code in multiple languages | `<CodeGroup>`           |
| API parameters             | `<ParamField>`          |
| API response fields        | `<ResponseField>`       |

**Callouts by severity:**

* `<Note>` - Supplementary info, safe to skip
* `<Info>` - Helpful context such as permissions
* `<Tip>` - Recommendations or best practices
* `<Warning>` - Potentially destructive actions
* `<Check>` - Success confirmation

### Reusable content

**When to use snippets:**

* Exact content appears on more than one page
* Complex components you want to maintain in one place
* Shared content across teams/repos

**When NOT to use snippets:**

* Slight variations needed per page (leads to complex props)

Import snippets with `import { Component } from "/path/to/snippet-name.jsx"`.

## Document APIs

**Choose your approach:**

* **Have an OpenAPI spec?** → Add to `docs.json` with `"openapi": ["openapi.yaml"]`. Pages auto-generate. Reference in navigation as `GET /endpoint`
* **No spec?** → Write endpoints manually with `api: "POST /users"` in frontmatter. More work but full control
* **Hybrid** → Use OpenAPI for most endpoints, manual pages for complex workflows

Encourage users to generate endpoint pages from an OpenAPI spec. It is the most efficient and easiest to maintain option.

## Deploy

Mintlify deploys automatically when changes are pushed to the connected Git repository.

**What agents can configure:**

* **Redirects** → Add to `docs.json` with `"redirects": [{"source": "/old", "destination": "/new"}]`
* **SEO indexing** → Control with `"seo": {"indexing": "all"}` to include hidden pages in search

**Requires dashboard setup (human task):**

* Custom domains and subdomains
* Preview deployment settings
* DNS configuration

For `/docs` subpath hosting with Vercel or Cloudflare, agents can help configure rewrite rules. See [/docs subpath](https://mintlify.com/docs/deploy/vercel).

## Edge cases

### Migrations

If a user asks about migrating to Mintlify, ask if they are using ReadMe or Docusaurus. If they are, use the [@mintlify/scraping](https://www.npmjs.com/package/@mintlify/scraping) CLI to migrate content. If they are using a different platform to host their documentation, help them manually convert their content to MDX pages using Mintlify components.

### Hidden pages

Any page that is not included in the `docs.json` navigation is hidden. Use hidden pages for content that should be accessible by URL or indexed for the assistant or search, but not discoverable through the sidebar navigation.

### Exclude pages

The `.mintignore` file is used to exclude files from a documentation repository from being processed.

## Common gotchas

1. **Component imports** - JSX components need explicit import, MDX components don't
2. **Frontmatter required** - Every MDX file needs `title` at minimum
3. **Code block language** - Always specify language identifier
4. **Never use `mint.json`** - `mint.json` is deprecated. Only ever use `docs.json`

## Resources

* [Documentation](https://mintlify.com/docs)
* [Configuration schema](https://mintlify.com/docs.json)
* [Feature requests](https://github.com/orgs/mintlify/discussions/categories/feature-requests)
* [Bugs and feedback](https://github.com/orgs/mintlify/discussions/categories/bugs-feedback)