# Prompt Templates

The evals library provides lightweight utilities to render prompts and infer required fields from placeholders. 
The prompt template abstraction is designed for simple prompts, and does not currently support different roles or messages construction. 

**Note:** Prompt templates are text-only at this time, but we plan to support multi-modal prompts soon. 

### Template
- [API Reference](https://arize-phoenix.readthedocs.io/projects/evals/en/latest/api/evals.html#prompt-template)
- Auto-detects format (f-string or mustache).
- Handles escaped JSON in f-strings (e.g., `{{"k":1}}`).

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

2) F-string basics
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

