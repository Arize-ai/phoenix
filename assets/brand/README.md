# Arize Phoenix brand

The canonical Arize Phoenix logo. Use these files instead of copying the logo into other folders.

| File | Use on |
|---|---|
| `arize-phoenix-logo-light.svg` | White or light backgrounds |
| `arize-phoenix-logo-dark.svg` | Black or dark backgrounds |
| `arize-phoenix-banner-light.svg` | The README banner in light mode: the logo centered on a transparent 1600×400 canvas |
| `arize-phoenix-banner-dark.svg` | The README banner in dark mode |

The mark is `#009DD2` in both versions. The wordmark is `#454554` on light backgrounds and
`#E6E6EB` on dark ones.

- Keep clear space of at least half the mark's height on every side.
- Do not recolor, stretch, outline, or add effects to the logo.
- Switch between the light and dark files with `prefers-color-scheme`, as `README.md` does:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix/main/assets/brand/arize-phoenix-banner-dark.svg">
  <img alt="Arize Phoenix" src="https://raw.githubusercontent.com/Arize-ai/phoenix/main/assets/brand/arize-phoenix-banner-light.svg" width="100%">
</picture>
```
