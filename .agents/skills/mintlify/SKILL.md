---
name: mintlify
description: Set up, write, and publish documentation sites with Mintlify, and work on existing Mintlify projects. Use when the user wants to create a docs site for a repo or product, turn a docs/ folder or README into a hosted docs site, document an API from an OpenAPI spec, migrate docs from Docusaurus, GitBook, ReadMe, Fern, or another platform, preview docs locally, or publish docs to a shareable URL. Also use when editing a project with docs.json, including pages, navigation, components, API references, and customizing appearance or browser behavior with CSS, JavaScript, React, and snippets.
metadata:
  generated-from: "mintlify/docs/agent-context. Edit the canonical source, not this copy."
---

# Mintlify reference

Reference for working on Mintlify projects. This file covers essentials that apply to every task. For detailed reference on specific topics, read the files listed in the reference index below.

## Reference index

Read these **only when your task requires them**. Each links to a Mintlify documentation page or, for agent workflow guidance, the source file on GitHub.

| Reference | When to read |
|------|-------------|
| [Components](https://mintlify.com/docs/components.md) | Adding or modifying components (callouts, cards, steps, tabs, accordions, code groups, fields, frames, icons, tooltips, badges, trees, mermaid, MDX, panels, prompts, colors, tiles, updates, views). Also covers table column widths. |
| [Global settings](https://mintlify.com/docs/organize/settings.md) | Changing docs.json settings (theme, colors, logo, fonts, appearance, navbar, footer, banner, redirects, SEO, integrations, API config). Also covers snippets, hidden pages, .mintignore, custom CSS/JS, and the complete frontmatter fields table. |
| [Navigation](https://mintlify.com/docs/organize/navigation.md) | Modifying site navigation structure (groups, tabs, anchors, dropdowns, products, versions, languages, OpenAPI, and SDK references in nav). |
| [API playground](https://mintlify.com/docs/api-playground/overview.md) | Setting up API documentation (OpenAPI, AsyncAPI, MDX manual API pages, extensions, playground config). |
| [CLI commands](https://mintlify.com/docs/cli/commands.md) | Running common CLI commands (dev, validate, add-domain, analytics, score, broken-links, a11y, format, and config) and their key flags. |
| [Product context](https://raw.githubusercontent.com/mintlify/docs/main/agent-context/context/skills/mintlify/reference/product-context.md) | Before substantial content work (new site, broad restructure, first-time section setup) — check for and maintain `.mintlify/product-brief.md`. |
| [Custom scripts](https://mintlify.com/docs/customize/custom-scripts.md) | Customizing appearance or browser behavior with CSS, JavaScript, React snippets, selectors, or CSS variables. |
| [Writing pages](https://raw.githubusercontent.com/mintlify/docs/main/agent-context/context/skills/mintlify/reference/writing.md) | Before creating a page or writing more than a sentence or two: the no-invention rule, page creation and editing steps, quality bar, audience, titles and descriptions, links. |
| [Publishing and review](https://raw.githubusercontent.com/mintlify/docs/main/agent-context/context/skills/mintlify/reference/publishing-and-review.md) | Publishing, branches and pull requests, "is this live" questions, undoing changes, and reviewing a page with suggestions and comments. |
| [Project settings](https://raw.githubusercontent.com/mintlify/docs/main/agent-context/context/skills/mintlify/reference/project-settings.md) | Reading or changing dashboard settings (domains, git sources, auth, members, workflows, search, add-ons), settings no tool covers, and analytics questions. |
| [Widgets](https://raw.githubusercontent.com/mintlify/docs/main/agent-context/context/skills/mintlify/reference/widgets.md) | Before you write or rewrite a page that explains a value that depends on inputs, a process, a structure, a comparison, or a UI: build live React widgets instead of screenshots, recordings or Mermaid. Covers when to build one and the exact limits. |
| [Site building](https://raw.githubusercontent.com/mintlify/docs/main/agent-context/context/skills/mintlify/reference/site-building.md) | Building or migrating a whole site, a section, or more than a handful of pages: research sizing, generation order, landing page, structure for common kinds of site, porting rules. |

## Starting a new docs site

If the user wants a new docs site, wants to publish docs, or has no `docs.json` yet, run this workflow yourself. Ask the user only for information or approvals you cannot supply. Recommend CLI onboarding. If the user prefers to onboard in the browser, or you cannot run terminal commands, send them to [mintlify.com/start](https://mintlify.com/start).

1. Check `node --version` (v20.17.0 or newer). Run `mint --version`; if missing, install with `npm i -g mint`. If it's installed, run `mint update`.
2. Run `mint status`. If it shows an organization, use that account and follow **Existing account**. If the user has an account but isn't logged in, run `mint login`. If the user has no account, follow **No account**. Don't run `mint signup` yourself: from an agent or any non-interactive shell, it only prints https://mintlify.com/auth.md and creates no account.

**Existing account:**

3. Run `mint status` to confirm an organization and subdomain. If no subdomain appears, ask the user to finish onboarding in the browser by selecting or connecting a GitHub repository, then retry.
4. Unless you're already working in it, ask the user for the URL of the connected repository (`mint status` doesn't show it) and clone it. If the user connected their own docs repository, preserve its content, and add a `docs.json` if it has none. If Mintlify created the repository, it contains starter content; replace that with the user's existing Markdown docs instead of writing placeholder pages. Use `mint new <directory> --name <name> --theme <theme>` only if the user wants a different theme than the starter, and scaffold into a new, empty directory. Never use `--force` on a directory with user files.
5. Run `mint dev --no-open` as a background process from the directory containing `docs.json`. Report the local URL so the user can preview. Run `mint validate` and `mint broken-links` and fix issues you caused.
6. Commit and push to the connected repository to deploy.
7. Verify that `https://<subdomain>.mintlify.site` loads before you report the URL.

**No account:** create the site without an account, then hand it to the user.

3. Prepare the docs in a directory with a `docs.json`: the user's existing Markdown docs, or `mint new <directory> --name <name> --theme <theme>` in a new, empty directory. Run `mint dev --no-open` as a background process to preview, then run `mint validate` and `mint broken-links` and fix issues you caused.
4. From that directory, run `mint deploy --subdomain <subdomain>` and follow the Git commands it prints: clone the hosted repository into a separate directory, copy `docs.json`, pages, and assets to its root, commit, and push to `main`. Never print, commit, or save the write token in a remote URL.
5. Verify that `https://<subdomain>.mintlify.site` loads before you report the URL.
6. The site expires unless someone claims it. Ask the user which email should own it (never invent one) and run `mint claim --email <email>`. Have the user open the link, sign in or create an account, and read back the code, then run `mint claim --code <code>`. Run both commands from the `mint deploy` directory.
7. If the docs live in a GitHub repository and the user wants a deploy on every push, run `mint deploy --github --subdomain <subdomain>` before claiming and commit the `.github/workflows/mintlify.yml` it writes. It needs a GitHub `origin` remote and a signed-in GitHub CLI, and only works for unclaimed sites.

The user only needs the browser for OAuth approval, connecting GitHub, and claiming a site.

### No local repository

When you have no local checkout and no CLI (for example, editing through the Mintlify Admin MCP server or inside the Mintlify editor), skip the `mint`, `git` and file-system steps in this skill:

- Read and change pages, navigation and `docs.json` with the Admin MCP tools on a `branch`.
- Create pages with `create_node`; `write_page` only replaces an existing page.
- Preview with the `editorUrl` the tools return instead of `mint dev`. Validation runs on every write, so fix any error a write returns instead of running `mint validate`.
- Publish with `publish` instead of pushing, and only when the user asks.
- Keep the product brief from [Product context](https://raw.githubusercontent.com/mintlify/docs/main/agent-context/context/skills/mintlify/reference/product-context.md) in the conversation instead of writing `.mintlify/product-brief.md`.
- For a new site, follow [Site building](https://raw.githubusercontent.com/mintlify/docs/main/agent-context/context/skills/mintlify/reference/site-building.md) against the existing project.

### Migrating from another platform

For Docusaurus, GitBook, ReadMe, Fern, or Document360, follow the matching guide at `https://mintlify.com/docs/migration/<platform>.md` (for example `docusaurus.md`), using the Mintlify Search MCP server to read it. For any other platform, follow `https://mintlify.com/docs/migration/manual.md`. The scraper only handles simple public sites. Complex sites migrate from source files. Porting rules are in [Site building](https://raw.githubusercontent.com/mintlify/docs/main/agent-context/context/skills/mintlify/reference/site-building.md).

## MCP servers

Two Mintlify MCP servers are available. Use them alongside the reference files in this skill.

### Mintlify Search

Read-only access to Mintlify's published documentation. Use it when the reference files don't cover a specific detail, when you need an up-to-date component signature, or to verify an unfamiliar config option.

Tools:
- `search_mintlify` — Search the Mintlify knowledge base by query. Good for finding guides, examples, and API references.
- `query_docs_filesystem_mintlify` — Browse the docs file tree (`ls`, `cat`, `grep`, `find`, etc.). Good for reading a specific docs page.
- `submit_feedback` — Report a docs page that is incorrect, outdated, confusing, or incomplete. The path (relative path or full URL) must match a published page or a redirect source; otherwise the tool returns an error and records nothing.

### Mintlify Admin

Write access to a Mintlify project. Requires OAuth on first use. Complete authentication in the browser when prompted.

Use this server when the user wants to edit their Mintlify content, restructure navigation, or open a pull request. Every content tool takes a `branch` argument: required on edits, `publish`, `discard` and comment writes, optional on reads (defaults to the deploy branch). Nothing is remembered between calls, so pass `branch` every time. Edits on the deploy branch land as unpublished changes until you call `publish`. Edits on any other branch go through a pull request. Project management tool changes apply immediately to the live project without a branch or pull request.

Workflow: use `read`/`search`/`edit_page`/`write_page`/`list_nodes`/`create_node`/`update_node`/`move_node`/`delete_node`/`update_config` with a `branch` to make changes, then call `publish` with the `branch` and a `title` to publish (or `discard` to abandon). Pass the deploy branch to edit it directly. If the project requires a pull request (**Push directly to your deploy branch** is off, branch protection requires pull requests, deploy branch editing is locked, or the connection uses a client or machine-to-machine token), edits to the deploy branch are refused with the reason and change nothing. Call `create_branch` and pass its `branchName` as `branch` instead. Projects with auto publish turned on have no branches: pass the deploy branch, where edits are committed automatically. `create_branch` and other branches are refused there, and pull request requirements don't apply.

Key tools:
- **`create_branch`** — Start a new branch off the deploy branch with a `title` that also names its pull request. Returns `branchName` and a branch-level `editorUrl` to preview changes live. On a branch, Mintlify commits edits automatically about 15 seconds after the last change, and the first commit opens a pull request.
- **`list_branches`** — List existing branches; pass any of them as `branch`. Branches that don't exist are refused.
- **`list_deployments`** — Discover which project(s) this connection can access.
- **`read`** / **`search`**: Fetch a page's MDX or search across pages. `read`, `edit_page` and `write_page` take a page path (such as `guides/setup`) or the last segment of an editor URL, which is the page ID with an optional title in front of it. With a page ID from an editor URL, pass that URL's branch as `branch`. `read` returns a `filePath` to pass as `path` to `edit_page` and `write_page`.
- **`edit_page`** / **`write_page`**: Apply targeted edits or overwrite a page. Change frontmatter with `update_node`, not `edit_page`. `edit_page` takes `oldString` and `newString` for one replacement, or an `edits` list of up to 100 replacements applied in order; if any edit fails, none apply. Both return `notRendered` for markup the editor drops (such as `<script>`, `<style>`, event handlers or JavaScript expressions), with what to use `instead`.
- **`read_page_history`**: List a page's saved versions on `branch` (newest first, paginate with `cursor`), or pass `versionId` to read that version's MDX. Read-only; to restore a version, pass its `content` to `write_page`.
- **`read_comments`** / **`add_comment`** / **`suggest_edit`** / **`reply_to_comment`** / **`resolve_comment`**: Read open editor comment threads on a page, start a thread on exact text, propose a tracked-changes suggestion (`oldString` to `newString`; an empty `newString` suggests a deletion; an optional `comment` explains why and is posted as the agent's reply in the suggestion thread) that someone accepts or rejects in the editor, reply as the agent, or resolve threads. Adding, suggesting, replying and resolving require an OAuth session and act on the threads of `branch`; they work on the deploy branch even when edits to it require a pull request.
- **`read_inbox`**: List the connected user's dashboard inbox on a project (comments and mentions, suggested edits, private pages and folders shared with the user), newest activity first and open items by default. Narrow with `state`, `section`, `filter`, `dateFrom` and `dateTo`; pass `nextCursor` as `cursor` for older items. For an item whose `target.thread` is unresolved and not on a private page, call `read_comments` on `target.thread.filePath` and `reply_to_comment`, both on `target.thread.branch`. Read-only; requires an OAuth session.
- **`list_nodes`** / **`create_node`** / **`update_node`** / **`move_node`** / **`delete_node`**: Manage the navigation tree. If a `create_node`, `update_node`, `move_node`, or `delete_node` call leaves the navigation invalid (for example, a page at the root next to tabs), the response includes a `navigationErrors` field. Fix these errors before `publish`, because Mintlify can drop invalid nodes from the published navigation. If a page already exists at the `path` on `branch`, `create_node` writes the new content into it, keeps its navigation position, and returns `updated: true`.
- **`update_config`** — Change top-level `docs.json` fields (theme, colors, logo, navbar, footer, redirects, integrations, SEO). It can't set `navigation`; use the node tools. An invalid config is rejected whole.
- **`upload_file`** / **`finalize_file_upload`**: Upload a local file. To add an image to `branch`, call `upload_file` with the destination `path` (for example, `images/dashboard.png`), `contentType`, and exact `size` in bytes. `PUT` the file bytes to the returned `uploadUrl` with the returned `headers`, then call `finalize_file_upload` with the `uploadId` and the same `path`. Use the returned `src` in MDX or in the `docs.json` `logo` or `favicon` fields. Uploading to an existing `path` replaces the image. Only logo and favicon uploads may be SVG: for a `docs.json` `logo` or `favicon`, pass `purpose: "logo"` to both tools. Page images can't be SVG. Images publish with your other edits on `publish`. To write a large page from a local file, call `upload_file` with a `.md` or `.mdx` `path` and `contentType: "text/markdown"` (no `branch` needed), `PUT` the file, then pass the `uploadId` in place of `content` to `write_page` or as `data.uploadId` to `create_node` within 10 minutes; skip `finalize_file_upload`. Each `uploadId` works once.
- **Project management tools** — Read with `get_deployment_settings`, `get_analytics_report`, `get_analytics_schema`, `query_analytics`, `get_workflows`, and `list_repos_and_prs`. Write with `update_deployment_settings`, `manage_custom_domain`, `manage_git_source`, `manage_access_auth`, `manage_workflow`, `manage_workflow_prs`, and `manage_members_sharing`. Pass `subdomain` (required on org-wide connections; read tools also accept `subdomains`, up to 25) and a `request` object whose `action` (or `report`) selects the operation. Writes apply immediately to the live project and return the updated `state`, so confirm the intended change first.

- **`diff`** — See all changes on `branch` relative to the deploy branch.
- **`status`** — List unpublished edited files, `docs.json` keys and nav changes on `branch`. On the deploy branch, lists only your changes.
- **`publish`** — Publish `branch` with a `title`. Call it only when the user asks to publish, ship, or merge, never on your own after an edit. On the deploy branch, commits only your pending changes. On a branch, commits anything pending and returns the branch's pull request, opening one if none exists. Pass `merge: true` to also merge that pull request, only when the user asks and deploy-branch edits are allowed; otherwise it returns `merge_not_allowed` and leaves the pull request open. `publish` ignores `mode`. Returns `no_pending_changes` when there is nothing to commit and no pull request. The response includes an `editorUrl` that opens the first created or updated page. When the changes reach the deploy branch, it also returns a `commitSha` and a `deployment` object.
- **`deployment_status`** — Check whether published changes are live. Pass the `commitSha` from `publish`, or omit it for the latest deploy. Returns a `state` (`pending`, `queued`, `building`, `live`, `not_live`, `failed`, or `skipped`), a `live` boolean, and a `message`. Changes aren't live until `live` is `true`. Check again about every 30 seconds, and report the `message` if the state is `failed`, `not_live` (the site still serves an earlier version), or `skipped`.
- **`discard`** — On the deploy branch, reverts only your pending changes. On another branch, deletes the branch and closes its pull request, but only if you created it; otherwise changes nothing.

Private pages (workspace projects only; other projects return `private_pages_unavailable`): `list_nodes` accepts `visibility: "private"` to list the private pages and folders the OAuth user can access (ignores other filters, returns each node's `role`). `read`, `edit_page`, `write_page`, `update_node`, and `delete_node` accept `private-page-<uuid>` or `private-folder-<uuid>` node ids; `create_node` accepts `visibility: "private"` with `data.type: "page"` or `"group"`. Private-page operations require an OAuth session (the admin MCP rejects client and machine-to-machine tokens), need no `branch`, and enforce role requirements: read for reads, editor or higher for writes and updates, manager for deletes. The caller becomes the manager of any node they create.

Keep each branch focused on one change. Smaller branches produce easier-to-review PRs. Open the `editorUrl` to watch changes render live. Prefer the page-level `editorUrl` from `create_node` or `publish` over the one from `create_branch`.

## Before you start

Mintlify changes often, so don't rely on what you remember about it. When a detail isn't in this skill, check the current documentation with the Mintlify Search MCP server or at `https://mintlify.com/docs`. Every docs page has a Markdown version at its URL plus `.md` (for example `https://mintlify.com/docs/organize/navigation.md`), and `https://mintlify.com/docs/llms.txt` lists them all; fetch those instead of the HTML pages.

Before substantial content work, read [Product context](https://raw.githubusercontent.com/mintlify/docs/main/agent-context/context/skills/mintlify/reference/product-context.md) and check for `.mintlify/product-brief.md`.

Read the project's `docs.json` file first. It defines the site's navigation, theme, colors, and configuration.

For appearance or browser behavior changes, read [Custom scripts](https://mintlify.com/docs/customize/custom-scripts.md).

Search for existing content before creating new pages. You may need to update an existing page, add a section, or link to existing content rather than duplicating.

Read 2-3 similar pages to match the site's voice, structure, and formatting.

## File format

Mintlify uses MDX files (`.mdx` or `.md`) with YAML frontmatter.

```
project/
├── docs.json           # Site configuration (required)
├── index.mdx
├── quickstart.mdx
├── guides/
│   └── example.mdx
├── openapi.yml         # API specification (optional)
├── images/             # Static assets
│   └── example.png
└── snippets/           # Reusable components
    └── component.jsx
```

### File naming

- Match existing patterns in the directory
- If no existing files or mixed file naming patterns, use kebab-case: `getting-started.mdx`
- Add new pages to `docs.json` navigation or they won't appear in the sidebar

### Internal links

- Use root-relative paths without file extensions: `/getting-started/quickstart`
- Do not use relative paths (`../`) or absolute URLs for internal pages

### Images

Store images in an `images/` directory. Reference with root-relative paths. All images require descriptive alt text.

Mintlify automatically optimizes images stored in the repository and referenced with root-relative paths: it serves AVIF or WebP when supported, compresses them, generates resized versions up to 2500px wide, and adds width and height. Don't convert or resize these images yourself. GIFs, SVG and ICO files, images referenced by absolute URL, and images on authenticated pages are served unoptimized, so compress GIFs and externally hosted images before adding them.

```mdx
![Dashboard showing analytics overview](/images/dashboard.png)
```

## Page frontmatter

Include `title`, `description`, and `keywords` in frontmatter. `title` is technically optional (Mintlify generates one from the file path if omitted), but set it explicitly for clarity and SEO.

```yaml
---
title: "Clear, descriptive title"
description: "Concise summary for SEO and navigation."
keywords: ["relevant", "search", "terms"]
---
```

### Common frontmatter fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Page title in navigation and browser tabs. Auto-generated from the path if omitted. |
| `description` | string | Brief description for SEO. Displays under the title. |
| `sidebarTitle` | string | Short title for sidebar navigation. |
| `icon` | string | Lucide, Font Awesome, or Tabler icon name. Also accepts a single emoji, a URL, or a file path. |
| `tag` | string | Label next to page title in sidebar (e.g., "NEW"). |
| `hidden` | boolean | Remove from sidebar. Page still accessible by URL. |
| `mode` | string | Page layout: `default`, `wide`, `custom`, `frame`, `center`, `assistant`. |
| `keywords` | array | Search terms for internal search and SEO. |
| `api` | string | API endpoint for interactive playground (e.g., `"POST /users"`). |
| `openapi` | string | OpenAPI endpoint reference (e.g., `"GET /endpoint"`). |

For the complete list including `searchable`, `boost`, `deprecated`, `related`, `groups`, and more, read [Pages](https://mintlify.com/docs/organize/pages.md).

## Quick component reference

Below are the most commonly used components. For full props and all 26 components, read [Components](https://mintlify.com/docs/components.md).

### Callouts

```mdx
<Note>Supplementary information, safe to skip.</Note>
<Info>Helpful context such as permissions or prerequisites.</Info>
<Tip>Recommendations or best practices.</Tip>
<Warning>Potentially destructive actions or important caveats.</Warning>
<Check>Success confirmation or completed status.</Check>
<Danger>Critical warnings about data loss or breaking changes.</Danger>
```

### Steps

```mdx
<Steps>
  <Step title="First step">
    Instructions for step one.
  </Step>
  <Step title="Second step">
    Instructions for step two.
  </Step>
</Steps>
```

### Tabs and code groups

````mdx
<Tabs>
  <Tab title="npm">
    ```bash
    npm install package-name
    ```
  </Tab>
  <Tab title="yarn">
    ```bash
    yarn add package-name
    ```
  </Tab>
</Tabs>
````

````mdx
<CodeGroup>

```javascript example.js
const greeting = "Hello, world!";
```

```python example.py
greeting = "Hello, world!"
```

</CodeGroup>
````

### Cards and columns

```mdx
<Columns cols={2}>
  <Card title="First card" icon="rocket" href="/quickstart">
    Card description text.
  </Card>
  <Card title="Second card" icon="book" href="/guides">
    Card description text.
  </Card>
</Columns>
```

Use `<Columns>` to arrange cards (or other content) in a grid. `cols` accepts 1-4.

### Accordions

```mdx
<AccordionGroup>
  <Accordion title="First section">Content one.</Accordion>
  <Accordion title="Second section">Content two.</Accordion>
</AccordionGroup>
```

## CLI commands

Install with `npm i -g mint`. Key commands: `mint dev` (local preview), `mint validate`, `mint broken-links`, `mint a11y`, `mint score`, `mint analytics` (traffic, search, feedback, and assistant conversations; Pro and Enterprise plans), `mint new`, `mint signup`. Read [CLI commands](https://mintlify.com/docs/cli/commands.md) for full flags and subcommands.

After you edit pages, run `mint validate --no-build --format json` for a fast check and `mint validate --fix` to apply automatic fixes. Run a full `mint validate` before you push.

## Writing standards

- Second-person voice ("you").
- Active voice, direct language.
- Sentence case for headings ("Getting started", not "Getting Started").
- Sentence case for code block titles.
- All code blocks must have language tags.
- All images must have descriptive alt text.
- No marketing language, filler phrases, or emoji.
- Keep code examples simple, practical, and tested.

## Common mistakes

- Using `mint.json` — it is deprecated. The config file is always `docs.json`.
- Missing language tag on a code block (use ` ```python `, not ` ``` `).
- Using relative paths (`../page`) instead of root-relative (`/section/page`).
- Forgetting to add new pages to `docs.json` navigation.
- Images without alt text.
- Adding file extensions to internal links (`/page.mdx` instead of `/page`).
