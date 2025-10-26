<h1 align="center" style="border-bottom: none">
    <div>
        <a href="https://phoenix.arize.com/?utm_medium=github&utm_content=header_img&utm_campaign=phoenix-client-ts">
            <picture>
                <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix.svg">
                <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix-white.svg">
                <img alt="Arize Phoenix logo" src="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix.svg" width="100" />
            </picture>
        </a>
        <br>
        @arizeai/phoenix-otel
    </div>
</h1>

A simple wrapper around OpenTelemetry for use with [Arize Phoenix](https://github.com/Arize-ai/phoenix). This package is still under active development and is subject to change.

## Installation

```bash
npm install @arizeai/phoenix-otel
```

## Usage

```typescript
import { register } from "@arizeai/phoenix-otel";

register({
  url: "http://localhost:6006/v1/traces",
});
```
