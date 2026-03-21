---
"@arizeai/phoenix-cli": minor
---

Add `px self update` so the Phoenix CLI can check for a newer published version
and upgrade itself in place.

The command now:

- shows the current and latest published CLI versions
- supports `--check` for status-only checks
- updates global installs managed by `npm`, `pnpm`, and `bun`
- updates standard `deno install -g` wrapper installs by replaying the wrapper's install flags
