# Application profiles

An application profile is the generation boundary for one domain and one recorder archetype. Every profile seed is part of the application's ambient world: its authored effects apply to every matrix cell. A targeted cell exposes one selected variant's natural conversational route, while an ambient cell exposes no route and otherwise uses the same materialized application state.

Profiles keep the tools, corpus documents, personas, scenarios, quality choices, turn counts, and adversarial conditions that may appear together in one versioned directory.

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

Every adversarial seed requires `mechanics` with non-empty `subtle`, `moderate`, and `strong` variant arrays. Each variant has a natural `route` and effects permitted by its category:

- `corpus` uses `corpus_edits`. `replace_once` declares `source` and `replacement`; `append` declares `text`. Each edit references a profile `document_id`.
- `tool_data` uses `tool_overlays`. An overlay references `tool_name`, optionally matches an exact argument subset with `match_arguments`, and contains JSON Pointer `operations` using `add`, `replace`, or `remove`.
- `user` and `dynamics` use `simulator_traits` that describe character or behavior.
- `pressure` requires `simulator_traits` and may also include corpus edits or tool overlays.

Intensity selects a strength without disabling the seed: values below `0.2` select subtle, values below `0.5` select moderate, and values from `0.5` through `1.0` select strong. Variant choice is deterministic for the cell, seed, and intensity. Tool operations cannot alter `invocation_id`, corpus replacements must match exactly once, and overlapping tool operations on the same successful result path are rejected before generation.
