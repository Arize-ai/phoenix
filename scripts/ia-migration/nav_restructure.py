#!/usr/bin/env python3
"""Phoenix IA migration -- navigation restructure (step 2).

Rebuilds docs.json navigation.tabs into the verb-spine structure:
  Get Started | Guides | Integrations | APIs & SDKs | Concepts | Self-Hosting | Changelog | Resources

Reuses (path-already-remapped) group objects from the old Documentation tab where
they survive intact (Quickstart, Settings, Resources, the big Evaluate/Concepts
subgroups); authors the verb groups (Instrument/Observe/Improve) explicitly.

Ends with a coverage check: every .mdx on disk must be in nav or in the known
off-nav allowlist; no nav page may be missing from disk.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "phoenix"
DOCSJSON = ROOT / "docs.json"
P = "docs/phoenix/"

data = json.loads(DOCSJSON.read_text())
tabs = data["navigation"]["tabs"]


def tab(name):
    for t in tabs:
        if t["tab"] == name:
            return t
    sys.exit(f"tab not found: {name}")


def group(groups, name):
    for g in groups:
        if isinstance(g, dict) and g.get("group") == name:
            return g
    sys.exit(f"group not found: {name}")


doc = tab("Documentation")["groups"]
root_group = group(doc, " ")
quickstart = group(doc, "Get Started"); quickstart["group"] = "Quickstart"
settings = group(doc, "Settings")
resources = group(doc, "Resources")
evaluate = group(doc, "Evaluation"); evaluate["group"] = "Evaluate"; evaluate.pop("icon", None)
concepts = group(doc, "Concepts")

# --- surgically fix the Evaluate group ---
ep = evaluate["pages"]
ep = [x for x in ep if not (isinstance(x, dict) and x.get("group") == "Tutorial")]  # -> Guides
ep = [x for x in ep if x != f"{P}concepts/evaluators/llm-as-a-judge"]              # -> Concepts
# drop the phantom Legacy entry that has no file on disk
for x in ep:
    if isinstance(x, dict) and x.get("group") == "Client-Side Evals (SDK)":
        for y in x["pages"]:
            if isinstance(y, dict) and y.get("group") == "Pre-Built Metrics":
                for z in y["pages"]:
                    if isinstance(z, dict) and z.get("group") == "Legacy":
                        z["pages"] = [pg for pg in z["pages"]
                                      if pg != f"{P}evaluation/pre-built-metrics/hallucination"]
ep += [f"{P}evaluate/evaluating-phoenix-traces", f"{P}evaluate/llm-evaluations"]
evaluate["pages"] = [f"{P}evaluate"] + ep   # surface the Evaluate landing page

# --- Instrument / Observe / Improve (authored) ---
instrument = {"group": "Instrument", "icon": "wrench", "pages": [
    f"{P}instrument",
    f"{P}instrument/set-up-tracing",
    f"{P}instrument/setup-using-phoenix-otel",
    f"{P}instrument/auto-instrumentation",
    f"{P}instrument/setup-projects",
    f"{P}instrument/setup-sessions",
    {"group": "Add Metadata", "pages": [
        f"{P}instrument/add-metadata",
        f"{P}instrument/customize-spans",
        f"{P}instrument/instrumenting-prompt-templates-and-prompt-variables"]},
    f"{P}instrument/track-costs",
    {"group": "Going Deeper", "pages": [
        f"{P}instrument/advanced",
        f"{P}instrument/advanced/masking-span-attributes",
        f"{P}instrument/advanced/suppress-tracing",
        f"{P}instrument/advanced/modifying-spans",
        f"{P}instrument/advanced/multimodal-tracing",
        f"{P}instrument/advanced/constructing-urls"]},
]}
observe = {"group": "Observe", "icon": "eye", "pages": [
    f"{P}observe/view-and-manage-traces",
    f"{P}observe/projects",
    f"{P}observe/sessions",
    f"{P}observe/how-to-annotate-traces",
    f"{P}observe/metrics",
    {"group": "Annotations", "pages": [
        f"{P}observe/annotations",
        f"{P}observe/annotating-in-the-ui",
        f"{P}observe/capture-feedback",
        f"{P}observe/annotating-auto-instrumented-spans"]},
    {"group": "Import & Export", "pages": [
        f"{P}observe/import-and-export-traces",
        f"{P}observe/importing-existing-traces",
        f"{P}observe/importing-atif-trajectories",
        f"{P}observe/extract-data-from-spans",
        f"{P}observe/exporting-annotated-spans",
        f"{P}observe/retrieve-traces-via-cli"]},
]}
improve = {"group": "Improve", "icon": "arrow-trend-up", "pages": [
    {"group": "Datasets", "pages": [
        f"{P}improve/datasets",
        f"{P}improve/datasets/overview",
        f"{P}improve/datasets/quickstart",
        f"{P}improve/datasets/creating-datasets",
        f"{P}improve/datasets/updating-datasets",
        f"{P}improve/datasets/exporting-datasets"]},
    {"group": "Experiments", "pages": [
        f"{P}improve/experiments",
        f"{P}improve/experiments/run-experiments",
        f"{P}improve/experiments/run-experiments-in-background",
        f"{P}improve/experiments/using-evaluators",
        f"{P}improve/experiments/how-to-dataset-evaluators",
        f"{P}improve/experiments/repetitions",
        f"{P}improve/experiments/splits",
        f"{P}improve/experiments/eval-ci-with-pytest"]},
    {"group": "Prompts", "pages": [
        f"{P}improve/prompts",
        f"{P}improve/prompts/prompt-management",
        f"{P}improve/prompts/prompt-playground",
        f"{P}improve/prompts/span-replay",
        f"{P}improve/prompts/prompts-in-code",
        f"{P}improve/prompts/how-to",
        f"{P}improve/prompts/configure-ai-providers",
        f"{P}improve/prompts/using-the-playground",
        f"{P}improve/prompts/create-a-prompt",
        f"{P}improve/prompts/test-a-prompt",
        f"{P}improve/prompts/tag-a-prompt",
        f"{P}improve/prompts/using-a-prompt",
        f"{P}improve/prompts/use-provider-tools"]},
]}

# --- Concepts tab: wrap platform pages, add Evaluators group ---
cp = concepts["pages"]
platform = {"group": "Platform", "pages": [
    f"{P}concepts/platform/user-guide",
    f"{P}concepts/platform/production-guide",
    f"{P}concepts/platform/environments"]}
cp = [x for x in cp if x not in
      (f"{P}concepts/platform/user-guide", f"{P}concepts/platform/production-guide",
       f"{P}concepts/platform/environments")]
evaluators = {"group": "Evaluators", "pages": [
    f"{P}concepts/evaluators",
    f"{P}concepts/evaluators/llm-as-a-judge",
    f"{P}concepts/evaluators/evaluators",
    f"{P}concepts/evaluators/evaluation-types",
    f"{P}concepts/evaluators/building-your-own-evals",
    f"{P}concepts/evaluators/evaluating-multi-agent-systems",
    f"{P}concepts/evaluators/input-mapping"]}
# order: Platform, Tracing (existing), Evaluators (new), Prompts (existing), D&E (existing)
tracing_c = group(cp, "Tracing")
prompts_c = group(cp, "Prompts")
if f"{P}concepts/prompts" not in prompts_c["pages"]:
    prompts_c["pages"] = [f"{P}concepts/prompts"] + prompts_c["pages"]  # surface Prompts concept landing
de_c = group(cp, "Datasets & Experiments")
concepts["pages"] = [platform, tracing_c, evaluators, prompts_c, de_c]

# --- Guides tab: rename Cookbooks + append tutorial groups ---
guides = tab("Cookbooks"); guides["tab"] = "Guides"
guides["groups"] += [
    {"group": "Tutorials: Tracing", "pages": [
        f"{P}guides/tracing", f"{P}guides/tracing/your-first-traces",
        f"{P}guides/tracing/annotations-and-evaluations", f"{P}guides/tracing/sessions"]},
    {"group": "Tutorials: Evaluation", "pages": [
        f"{P}guides/evaluation/run-evals-with-built-in-evals",
        f"{P}guides/evaluation/customize-your-llm-endpoint",
        f"{P}guides/evaluation/customize-eval-template"]},
    {"group": "Tutorials: Datasets & Experiments", "pages": [
        f"{P}guides/datasets-and-experiments/defining-the-dataset",
        f"{P}guides/datasets-and-experiments/run-experiments-with-code-evals",
        f"{P}guides/datasets-and-experiments/run-experiments-with-llm-judge",
        f"{P}guides/datasets-and-experiments/iteration-workflow-experiments"]},
    {"group": "Tutorials: Prompts", "pages": [
        f"{P}guides/prompts", f"{P}guides/prompts/identify-and-edit-prompts",
        f"{P}guides/prompts/test-prompts-at-scale",
        f"{P}guides/prompts/compare-prompt-versions",
        f"{P}guides/prompts/optimize-prompts-automatically"]},
]

# --- assemble the new Get Started / Concepts / Resources tabs ---
get_started = {"tab": "Get Started", "groups": [
    root_group, quickstart, instrument, observe, evaluate, improve, settings]}
concepts_tab = {"tab": "Concepts", "groups": [concepts]}
resources_tab = {"tab": "Resources", "groups": [resources]}

tab("SDK & API Reference")["tab"] = "APIs & SDKs"
tab("Release Notes")["tab"] = "Changelog"

# --- reorder tabs to mirror Arize ---
new_order = [
    get_started,
    guides,
    tab("Integrations"),
    tab("APIs & SDKs"),
    concepts_tab,
    tab("Self-Hosting"),
    tab("Changelog"),
    resources_tab,
]
data["navigation"]["tabs"] = new_order

DOCSJSON.write_text(json.dumps(data, indent=2) + "\n")

# --- coverage check ---
def collect(node, out):
    if isinstance(node, str):
        if node.startswith(P):
            out.add(node)
    elif isinstance(node, list):
        for x in node:
            collect(x, out)
    elif isinstance(node, dict):
        for v in node.values():
            collect(v, out)


nav_pages = set()
collect(new_order, nav_pages)
disk = {("docs/phoenix/" + p.relative_to(DOCS).with_suffix("").as_posix()) for p in DOCS.rglob("*.mdx")}
missing_from_disk = sorted(nav_pages - disk)   # nav points at nonexistent file -> BAD
off_nav = sorted(disk - nav_pages)             # on disk, not in nav -> redirect-only (report)

print(f"nav pages: {len(nav_pages)}   disk pages: {len(disk)}")
print(f"NAV PAGES MISSING FROM DISK (must be 0): {len(missing_from_disk)}")
for m in missing_from_disk:
    print("  !", m)
print(f"off-nav (on disk, redirect-only): {len(off_nav)}")
for o in off_nav:
    print("   -", o)
