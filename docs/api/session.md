---
description: Detailed descriptions of classes and methods related to Phoenix sessions
---

# Session

## phoenix.launch\_app

```python
def launch_app(primary: Dataset, reference: Optional[Dataset] = None) -> Session
```

Launches and returns a new Phoenix session.

This function accepts one or two [phoenix.Dataset](dataset-and-schema.md#phoenix.dataset) instances as arguments. If the app is launched with a single dataset, Phoenix provides model performance and data quality metrics, but not drift metrics. If the app is launched with two datasets, Phoenix provides drift metrics in addition to model performance and data quality metrics. When two datasets are provided, the reference dataset serves as a baseline against which to compare the primary dataset. Common examples of primary and reference datasets include production vs. training or challenger vs. champion.

**\[**[**source**](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/session/session.py)**]**

### Parameters

* **primary** ([phoenix.Dataset](dataset-and-schema.md#phoenix.dataset)): The dataset that is of primary interest as the subject of investigation or evaluation.
* **reference** (Optional\[[phoenix.Dataset](dataset-and-schema.md#phoenix.dataset)]): If provided, the reference dataset serves as a baseline against which to compare the primary dataset.

### Returns

The newly launched session as an instance of [phoenix.Session](session.md#phoenix.session).

### Usage

Launch Phoenix with primary and reference datasets `prim_ds` and `ref_ds`, both instances of [phoenix.Dataset](dataset-and-schema.md#phoenix.dataset), with

```python
session = px.launch_app(prim_ds, ref_ds)
```

Alternatively, launch Phoenix with a single dataset `ds`, an instance of [phoenix.Dataset](dataset-and-schema.md#phoenix.dataset), with

```python
session = px.launch_app(ds)
```

Then `session` is an instance of [phoenix.Session](session.md#phoenix.session) that can be used to open the Phoenix UI in an inline frame within the notebook or in a separate browser tab or window.

## phoenix.active\_session

```python
def active_session() -> Optional[Session]
```

Returns the active Phoenix session if one exists, otherwise, returns None.

**\[**[**session**](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/session/session.py)**]**

### Usage

Suppose you previously ran

```python
px.launch_app()
```

without assigning the returned [phoenix.Session](session.md#phoenix.session) instance to a variable. If you later find that you need access to the running session object, run

```python
session = px.active_session()
```

Then `session` is an instance of [phoenix.Session](session.md#phoenix.session) that can be used to open the Phoenix UI in an inline frame within your notebook or in a separate browser tab or window.

## phoenix.close\_app

```python
def close_app() -> None
```

Closes the running Phoenix session, if it exists.

{% hint style="warning" %}
The Phoenix server will continue running in the background until it is explicitly closed, even if the Jupyter server and kernel are stopped.
{% endhint %}

**\[**[**source**](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/session/session.py)**]**

### Usage

Suppose you previously launched a Phoenix session with [phoenix.launch\_app](session.md#phoenix.launch\_app). You can close the running session with

```python
px.close_app()
```

## phoenix.Session

```python
class Session(
    primary: Dataset,
    reference: Optional[Dataset],
    port: int,
)
```

A session that maintains the state of the Phoenix app.

**\[**[**source**](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/session/session.py)**]**

### Parameters

* **primary** ([phoenix.Dataset](dataset-and-schema.md#phoenix.dataset)): The primary dataset.
* **reference** (Optional\[[phoenix.Dataset](dataset-and-schema.md#phoenix.dataset)]): The reference dataset, if one exists.
* **port** (int): The port on which to run the Phoenix server.

### Methods

* **view**(height: int = 1000) -> IPython.display.IFrame\
  \
  Displays the Phoenix UI for a running session within an inline frame in the notebook.\
  \
  **Parameters**
  * **height** (int = 1000): The height in pixels of the inline frame element displaying the Phoenix UI within the notebook. Used to adjust the height of the inline frame to the desired height.

### Attributes

* **url** (str): The URL of the running Phoenix session. Can be copied and pasted to open the Phoenix UI in a new browser tab or window.
* **exports** (List\[pandas.DataFrame]): A list of pandas DataFrames containing exported data, sorted in chronological order.

### Usage

{% hint style="warning" %}
Phoenix users should not instantiate their own phoenix.Session instances. They interact with this API only when an instance of the class is returned by [phoenix.launch\_app](session.md#phoenix.launch\_app) or [phoenix.active\_session](session.md#phoenix.active\_session).
{% endhint %}

Launch Phoenix with primary and reference datasets `prim_ds` and `ref_ds`, both instances of [phoenix.Dataset](dataset-and-schema.md#phoenix.dataset), with

```python
session = px.launch_app(prim_ds, ref_ds)
```

Alternatively, launch Phoenix with a single dataset `ds`, an instance of [phoenix.Dataset](dataset-and-schema.md#phoenix.dataset), with

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

Once a cluster or subset of your data is selected in the UI, it can be saved by clicking the "Export" button. You can then access your exported data in your notebook via the `exports` property on your `session` object, which returns a list of DataFrames containing each export.

```python
session.exports
```

Exported DataFrames are listed in chronological order. To access your most recent export, run

```python
session.exports[-1]
```
