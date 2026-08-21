# Application profiles

An application profile is the generation boundary for one domain and one recorder archetype. It keeps the tools, corpus documents, personas, scenarios, quality choices, turn counts, and adversarial seeds that may appear together in one versioned directory.

A profile-set manifest explicitly selects the profile directories used by a run. The loader validates every selected profile, fills in the sampling defaults, sorts profiles by ID, and emits canonical snapshot bytes. New runs copy those bytes to `profiles.json`; resumed runs use that immutable copy.

## Directory layout

```text
profiles/
  profile-set.json
  <domain>/
    <archetype>/
      profile.json
      <profile-relative corpus files>
```

`profile-set.json` has `schema_version: 1`, a `profiles` array of POSIX-relative paths, and an optional `sampling` object. Sampling defaults to a targeted-cell fraction of `0.10` and a beta intensity distribution with `alpha: 2.0` and `beta: 8.0`.

Each `profile.json` has `schema_version: 1` and a `profile_id` equal to `<domain>/<archetype>`. It defines `tool_surface`, `corpus_documents`, weighted `personas`, weighted `registers`, weighted `scenarios`, weighted `quality_tiers`, weighted `turn_counts`, and `adversarial_seeds`. Scenario seed IDs must resolve in the same profile. All weights are finite and greater than zero, and paths cannot be absolute or contain parent traversal.
