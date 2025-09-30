# Prompt Templates

Lightweight utilities to render prompts and infer required fields. We plan to support multimodal prompts, but right now templates only work with text.  

### Abstractions
- TemplateFormat: `"mustache" | "f-string"`
- TemplateFormatter: strategy interface implemented by Mustache and f-string formatters
- Template: detects format, extracts variables, and renders prompts
- detect_template_format(template: str) -> TemplateFormat
- FormatterFactory: create formatter explicitly or via auto-detect

### Template
- Constructor: `Template(template: str, template_format: TemplateFormat | None = None)`
- Properties: `template_format`, `variables: list[str]`
- Methods: `render(variables: dict) -> str`
- Auto-detects format using heuristics that handle escaped JSON in f-strings (e.g., `{{"k":1}}`).

### Formatters
- MustacheFormatter: `{{var}}` placeholders via pystache
- FStringFormatter: `{var}` placeholders via Python `string.Formatter`

## Examples
1) Mustache basics
```python
from phoenix.evals.templating import Template, TemplateFormat

template = Template(template="Hello {{name}}, welcome to {{place}}", template_format=TemplateFormat.MUSTACHE)
assert template.variables == ["name", "place"] or set(template.variables) == {"name", "place"}
text = template.render({"name": "Alice", "place": "Phoenix"})
assert text == "Hello Alice, welcome to Phoenix"
```

2) f-string basics
```python
from phoenix.evals.templating import Template, TemplateFormat

template = Template(template="Hello {name}, welcome to {place}", template_format=TemplateFormat.F_STRING)
assert set(template.variables) == {"name", "place"}
text = template.render({"name": "Alice", "place": "Phoenix"})
```

3) Escaped JSON in f-strings
```python
from phoenix.evals.templating import Template, TemplateFormat

template = Template(
    template='Config: {{"debug": true, "timeout": 30}} for {environment} and {user}',
    template_format=TemplateFormat.F_STRING,
)

rendered = template.render({"environment": "prod", "user": "alice"})
assert 'Config: {"debug": true, "timeout": 30} for prod and alice' in rendered
```

