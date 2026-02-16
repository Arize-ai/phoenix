---
name: phoenix-skill-development
description: Develop, refine, and maintain skills in the skills/ directory. Use when creating a new skill, updating an existing skill, adding rule files, or improving skill quality and consistency.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
---

# Skill Development

Guide for creating and refining skills in the `skills/` directory of this repository. Skills are packaged instructions that teach AI agents how to work with Phoenix features.

## Directory Structure

```
skills/
  {skill-name}/           # kebab-case, prefixed with "phoenix-" for Phoenix features
    SKILL.md              # Required: skill definition and index
    README.md             # Optional: human-oriented overview
    rules/                # Optional: detailed rule files
      {prefix}-{topic}.md
      {prefix}-{topic}-{lang}.md
```

### Existing Skills

| Skill | Purpose | Has Rules |
| ----- | ------- | --------- |
| `phoenix-tracing` | OpenInference instrumentation and span types | Yes (31 files) |
| `phoenix-evals` | Evaluator development and validation | Yes (33 files) |
| `phoenix-cli` | CLI debugging and analysis | No (single SKILL.md) |

## Creating a New Skill

### 1. Plan the Scope

Determine whether the skill needs rule files:

- **Single SKILL.md** (like `phoenix-cli`): Self-contained topics, command references, single-workflow tools
- **SKILL.md + rules/** (like `phoenix-tracing`, `phoenix-evals`): Multi-faceted topics with language-specific guides, multiple workflows, or extensive reference material

### 2. Create SKILL.md

Every skill requires a `SKILL.md` with YAML frontmatter:

```yaml
---
name: {skill-name}
description: {What it does. When to use it. Include trigger phrases.}
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
  languages: Python, TypeScript  # omit if language-agnostic
---
```

**Frontmatter rules:**
- `name`: kebab-case, match directory name
- `description`: Third person, specific, includes trigger terms
- `license`: Always `Apache-2.0`
- `metadata.author`: Use `oss@arize.com` for Phoenix skills
- `metadata.version`: Semver string (e.g., `"1.0.0"`)
- `metadata.languages`: Only include if skill has language-specific content

### 3. Structure the SKILL.md Body

SKILL.md serves as the **index and entry point**. The agent reads this first and navigates to rule files as needed.

**Required sections:**

| Section | Purpose |
| ------- | ------- |
| Title (`# Name`) | Skill name with brief description |
| Quick Reference | Table mapping tasks to rule files |
| Rule Categories | Table of prefix patterns |

**Optional sections (include as relevant):**

| Section | Purpose |
| ------- | ------- |
| When to Apply | Trigger scenarios |
| Workflows | Step-by-step paths through rules |
| Key Principles | Core decision-making guidance |
| Common Attributes | Reference tables |
| How to Use | Navigation guidance |
| References | External docs and API links |

### 4. Organize Rule Files

#### Naming Conventions

**Pattern:** `{prefix}-{topic}[-{language}].md`

**Prefix categories (reuse these across skills):**

| Prefix | Purpose | Example |
| ------ | ------- | ------- |
| `setup-*` | Installation, configuration | `setup-python.md` |
| `fundamentals-*` | Core concepts, reference | `fundamentals-overview.md` |
| `instrumentation-*` | Auto/manual setup | `instrumentation-auto-python.md` |
| `span-*` | Span type specifications | `span-llm.md` |
| `evaluators-*` | Evaluator types, patterns | `evaluators-code-python.md` |
| `experiments-*` | Datasets, running experiments | `experiments-running-typescript.md` |
| `production-*` | Deployment, monitoring | `production-python.md` |
| `annotations-*` | Feedback, scoring | `annotations-overview.md` |
| `validation-*` | Calibration, testing | `validation-calibration-python.md` |

**Language suffixes:**
- `-python.md` — Python-specific content
- `-typescript.md` — TypeScript-specific content
- No suffix — Language-agnostic or overview (e.g., `span-llm.md`, `evaluators-overview.md`)

**Overview files:** Use `-overview.md` suffix for conceptual introductions (e.g., `fundamentals-overview.md`, `production-overview.md`).

#### Flat Structure

All rule files go directly in `rules/` — no subdirectories. Use prefixes for organization, not folders.

```
rules/
  setup-python.md            # Good: flat with prefix
  setup-typescript.md
  span-llm.md                # Good: no language suffix (language-agnostic)
  evaluators-code-python.md  # Good: prefix-topic-language
```

### 5. Write Rule Files

#### Standard Structure

```markdown
# Title

Brief description of what this rule covers.

## Metadata (optional)

| Field | Value |
| ----- | ----- |
| Priority | 1 (Critical) |
| Setup Time | 5 minutes |

## Quick Start / Basic Pattern

Minimal working example.

## Detailed Sections

Expanded content with examples.

## See Also

- `related-rule.md` — Brief description
- [External docs](https://docs.arize.com/phoenix)
```

#### Code Examples

- Always use fenced blocks with language tags: `python`, `typescript`, `bash`, `json`
- Show **working, copy-pasteable** examples
- Include both minimal and production-ready patterns when relevant

#### Cross-References

- Reference other rule files by filename: `setup-python.md`, `span-llm.md`
- Reference external docs with full URLs
- Keep references one level deep (SKILL.md → rule file, not rule → rule → rule)

## Refining Existing Skills

### Adding a Rule File

1. Choose the correct prefix from the table above (or establish a new one)
2. Follow the naming convention: `{prefix}-{topic}[-{language}].md`
3. Add an entry in `SKILL.md` under Quick Reference and Rule Categories
4. Cross-reference related rules in the new file's "See Also" section

### Updating SKILL.md

When adding content to SKILL.md, keep it as an **index** — move detailed content to rule files. SKILL.md should stay under 500 lines.

### Improving Consistency

Common issues to fix when refining:

| Issue | Fix |
| ----- | --- |
| Missing metadata table | Add Priority, Setup Time if applicable |
| Inconsistent headings | Standardize to `## Quick Start`, `## See Also` |
| Inline code dumps | Extract to rule files, link from SKILL.md |
| Missing cross-references | Add `## See Also` with related rules |
| Vague descriptions | Make frontmatter description specific with trigger terms |

## Quality Checklist

### SKILL.md

- [ ] Frontmatter has all required fields (`name`, `description`, `license`, `metadata`)
- [ ] Description is third person, specific, includes trigger terms
- [ ] Quick Reference table maps tasks to rule files
- [ ] Rule Categories table lists all prefixes used
- [ ] Under 500 lines
- [ ] No detailed content that belongs in rule files

### Rule Files

- [ ] Follow `{prefix}-{topic}[-{language}].md` naming
- [ ] Have a clear `# Title` and brief description
- [ ] Include working code examples with language tags
- [ ] Cross-reference related rules in `## See Also`
- [ ] Use consistent heading structure

### Overall Skill

- [ ] Flat `rules/` directory (no subdirectories)
- [ ] Consistent terminology throughout all files
- [ ] Language-specific content split into `-python.md` / `-typescript.md` files
- [ ] Language-agnostic content has no language suffix
- [ ] No time-sensitive information (no dates, version caveats)

## Anti-Patterns

**Putting too much in SKILL.md.** SKILL.md is an index. If a section exceeds ~30 lines of content, extract it to a rule file.

**Deep reference chains.** Rule files should not require reading other rule files to be useful. Each rule should be self-contained enough to act on independently.

**Generic rule names.** Use `evaluators-code-python.md` not `code-eval.md`. Prefixes enable discovery via `ls rules/{prefix}-*`.

**Mixing languages in one file.** Split into `-python.md` and `-typescript.md` unless the content is truly language-agnostic.

**Forgetting SKILL.md updates.** Every new rule file must be reflected in the SKILL.md Quick Reference and Rule Categories tables.

## Workflow Summary

```
1. Plan scope → single SKILL.md or SKILL.md + rules/?
2. Create directory: skills/{skill-name}/
3. Write SKILL.md with frontmatter and index
4. Create rules/ directory (if needed)
5. Write rule files following naming conventions
6. Update SKILL.md index to reference all rules
7. Run quality checklist
```
