---
description: A detailed description of the phoenix.active_session API
---

# phoenix.active\_session

## function [phoenix.active\_session](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/session/session.py)

**()  ->**  Optional\[[phoenix.Session](phoenix.session.md)]

Returns the active Phoenix session if one exists, otherwise, returns None.

### Notes

Use this function when you need access to an existing Phoenix session.

### Usage

Suppose you previously ran

```python
px.launch_app()
```

without assigning the returned [phoenix.Session](phoenix.session.md) instance to a variable. If you later find that you need access to the running session object, run

```python
session = px.active_session()
```

Then `session` is an instance of [phoenix.Session](phoenix.session.md) that can be used to open the Phoenix UI in an inline frame within your notebook or in a separate browser tab or window.
