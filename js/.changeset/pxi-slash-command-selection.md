---
"@arizeai/phoenix-cli": patch
---

PXI slash-command hints now have a highlighted row: arrow keys move it (wrapping at either end), Tab completes it, and Enter runs it, so `/he` runs `/help`. A bare `/` lists every command, and `/help` is listed first so `/` + Enter is harmless.
