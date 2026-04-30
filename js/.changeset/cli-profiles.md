---
"@arizeai/phoenix-cli": minor
---

Add named profiles to the Phoenix CLI: `px profile list|show|create|edit|use|delete`. Profiles persist to `~/.px/settings.json` (or `$XDG_CONFIG_HOME/px/settings.json`, mode `0600`) and feed into config resolution as a new tier between built-in defaults and environment variables. `px auth status` displays the active profile and accepts `--profile <name>` to scope the call. Other commands honour the stored active profile.

The settings file is JSON-Schema validated; the schema is committed to `schemas/phoenix-cli-settings.json` and can be referenced via the `$schema` field on `settings.json` for editor autocomplete.
