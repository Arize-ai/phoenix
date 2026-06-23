# Resize SVG Logo Assets

Add provider or integration logo SVGs to the Phoenix frontend. Accepts raw
SVGs, deterministically rescales them, converts to JSX, and inserts into the
appropriate TSX file.

## Targets

| Target        | Canvas | File                                                               | Component style                            |
|---------------|--------|--------------------------------------------------------------------|--------------------------------------------|
| `provider`    | 24x24  | `app/src/components/generative/GenerativeProviderIcon.tsx`         | Private const, accepts `{ height }` prop   |
| `integration` | 32x32  | `app/src/components/project/IntegrationIcons.tsx`                  | Named export, no props, fixed 32x32        |

If the user does not specify a target, **ask before proceeding**.

## Workflow

### Step 1 — Collect SVGs

Accept input as:
- A single SVG file path
- A list of SVG file paths
- A directory containing `.svg` files
- Raw SVG markup pasted in the conversation (write to a temp file first)

### Step 2 — Resize with the deterministic script

Use the helper script at `.agents/skills/phoenix-frontend/scripts/scale-svg.py`.

**Single file:**
```bash
uvx --with svgpathtools python .agents/skills/phoenix-frontend/scripts/scale-svg.py <target_size> <input.svg> <output.svg>
```

**Batch (directory):**
```bash
uvx --with svgpathtools python .agents/skills/phoenix-frontend/scripts/scale-svg.py --batch <target_size> <input_dir> <output_dir>
```

Target sizes:
- `provider` → `24`
- `integration` → `32`

### Step 3 — Convert SVG to JSX

After resizing, read each output SVG and convert to a JSX component. Apply
these attribute transformations:

| SVG attribute       | JSX attribute    |
|---------------------|------------------|
| `class`             | `className`      |
| `clip-path`         | `clipPath`       |
| `clip-rule`         | `clipRule`       |
| `fill-rule`         | `fillRule`       |
| `fill-opacity`      | `fillOpacity`    |
| `stop-color`        | `stopColor`      |
| `stop-opacity`      | `stopOpacity`    |
| `stroke-width`      | `strokeWidth`    |
| `stroke-linecap`    | `strokeLinecap`  |
| `stroke-linejoin`   | `strokeLinejoin` |
| `stroke-dasharray`  | `strokeDasharray`|
| `stroke-dashoffset` | `strokeDashoffset`|
| `stroke-opacity`    | `strokeOpacity`  |
| `xmlns:xlink`       | *(remove)*       |

Also:
- Remove the `xmlns` attribute from the root `<svg>` element (React adds it automatically).
- Self-close elements with no children (e.g., `<path ... />`).
- Keep the `viewBox` attribute as-is (it is already camelCase).

### Step 4 — Apply color rules

- If the logo is exclusively one dark color (black, near-black, dark gray), replace the fill with `currentColor` so it follows Phoenix theme in light/dark mode.
- If the logo has explicit brand colors (multicolor), preserve them.

### Step 5 — Insert into TSX file
Before adding to the file, confirm that the logos do not conflict with any existing entries. If there are similar logos already in place, list them and **ask for confirmation before overwriting**.

#### Provider icons (`GenerativeProviderIcon.tsx`)

1. Add the SVG as a private component following this pattern:

```tsx
const NewProviderSVG = ({ height }: { height: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={height}
    height={height}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* scaled paths here */}
  </svg>
);
```

2. Add an entry to the `PROVIDER_ICONS` record:

```tsx
NEW_PROVIDER: NewProviderSVG,
```

Note: The key must match a value in the `ModelProvider` type. If the provider
doesn't exist in the type yet, flag this to the user — the type may need
updating upstream.

#### Integration icons (`IntegrationIcons.tsx`)

Add as a named export following this pattern:

```tsx
export const NewIntegrationSVG = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* scaled paths here */}
  </svg>
);
```

### Step 6 — Derive component name from filename

When the SVG filename follows the `icon=Name.svg` convention, derive the
component name as `NameSVG`. For example:
- `icon=LlamaIndex.svg` → `LlamaIndexSVG`
- `icon=Cerebras.svg` → `CerebrasSVG`
- `icon=LiveKit Agents.svg` → `LiveKitAgentsSVG`

Strip the `icon=` prefix, remove spaces, and append `SVG`.

### Step 7 — Verify

- Read the modified TSX file to confirm the new component compiles with
  surrounding code.
- If the user provides a list of expected icon names, confirm each was added.

## Workflow efficiency

- **Work file-by-file, not in bulk.** Scale an SVG, read the output, edit the
  TSX — then move to the next. Do not dump all SVG contents into context or
  agent prompts as a batch.
- **Don't marshal file contents through conversation.** The scaled files are on
  disk — read them directly when needed instead of buffering them into a message.
- **Replace whole components when updating.** If an existing SVG component needs
  replacing, delete the old one entirely and write the new one fresh. Don't try
  to patch parts of it.

## Safety

- **Never hand-edit SVG path data.** All coordinate changes must go through the
  scale script.
- **Never guess or approximate path geometry.**
- If the scale script fails on a particular SVG, report the error to the user
  rather than attempting a manual fix.
- Do not modify existing icons in the file unless explicitly asked.
