---
description: A detailed description of the phoenix.Session API
---

# phoenix.Session

## class [phoenix.Session](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/session/session.py)

**(**\
&#x20;       **primary:** [phoenix.Dataset](../datasets-and-schemas/phoenix.dataset.md),\
&#x20;       **reference:** Optional\[[phoenix.Dataset](../datasets-and-schemas/phoenix.dataset.md)],\
&#x20;       **port:** int,\
**)**

A session that maintains the state of the Phoenix app.

### Parameters

* **primary** ([phoenix.Dataset](../datasets-and-schemas/phoenix.dataset.md)): The primary dataset.
* **reference** (Optional\[[phoenix.Dataset](../datasets-and-schemas/phoenix.dataset.md)]): The reference dataset, if one exists.
* **port** (int): The port on which to run the Phoenix server.

### Methods

* **view(**\
  &#x20;       **height:** int = 1000,\
  **)  ->**  IPython.display.IFrame\
  \
  Displays the Phoenix UI for a running session within an inline frame in the notebook.\
  \
  **Parameters**
  * **height** (int = 1000): The height in pixels of the inline frame element displaying the Phoenix UI within the notebook. Used to adjust the height of the inline frame to the desired height.

### Attributes

* **url** (str): The URL of the running Phoenix session. Can be copied and pasted to open the Phoenix UI in a new browser tab or window.

### Notes

Phoenix users should not instantiate their own `phoenix.Session` instances. They interact with this API only when an instance of the class is returned by [phoenix.launch\_app](phoenix.launch\_app.md) or [phoenix.active\_session](phoenix.active\_session.md).

### Usage

Launch Phoenix with primary and reference datasets `prim_ds` and `ref_ds`, both instances of [phoenix.Dataset](../datasets-and-schemas/phoenix.dataset.md), with

```python
session = px.launch_app(prim_ds, ref_ds)
```

Alternatively, launch Phoenix with a single dataset `ds`, an instance of [phoenix.Dataset](../datasets-and-schemas/phoenix.dataset.md), with

```python
session = px.launch_app(ds)
```

Open the Phoenix UI in an inline frame within your notebook with

```python
session.view()
```

You can adjust the height of the inline frame by passing the desired height (number of pixels) to the `height` parameter. For example, instead of the line above, run

```python
session.view(height=1200)
```

to open an inline frame of height 1200 pixels.

As an alternative to an inline frame within your notebook, you can open the Phoenix UI in a new browser tab or window by running

```python
session.url
```

and copying and pasting the URL.
