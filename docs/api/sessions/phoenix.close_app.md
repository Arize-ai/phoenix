---
description: A detailed description of the phoenix.close_app API
---

# phoenix.close\_app

## function [phoenix.close\_app](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/session/session.py)

**()  ->**  None

Closes the running Phoenix session, if it exists.

### Notes

The Phoenix server will continue running in the background until it is explicitly closed, even if the Jupyter server and kernel are stopped.

### Usage

Suppose you previously launched a Phoenix session with [phoenix.launch\_app](phoenix.launch\_app.md). You can close the running session with

```python
px.close_app()
```
