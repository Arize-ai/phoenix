# Contributor skills

Skills in this folder are for people working on Phoenix itself and never ship to users.

- **Phoenix contributor skills** are marked in their `SKILL.md` frontmatter with `metadata.internal: true`, which keeps the skills CLI from offering them. `make skills` adds the flag to any that lack it.
- **Vendored third-party skills** are listed in the root [`skills-lock.json`](../../skills-lock.json) and refreshed by the daily skills update. Do not edit them here.
- **Symlinks** to the public skills in [`skills/`](../../skills/) let contributors use those too. `make skills` writes them.

Public skills live in [`skills/`](../../skills/); see its README for how a skill chooses where it ships.
