client
======

.. contents:: :local:

Client
------
.. autoclass:: phoenix.client.Client
   :members:
   :show-inheritance:

AsyncClient
-----------
.. autoclass:: phoenix.client.AsyncClient
   :members:
   :show-inheritance:

Resources
---------

Projects
~~~~~~~~
.. autoclass:: phoenix.client.resources.projects.Projects
   :members:
   :show-inheritance:

AsyncProjects
~~~~~~~~~~~~~
.. autoclass:: phoenix.client.resources.projects.AsyncProjects
   :members:
   :show-inheritance:

Prompts
~~~~~~~
.. autoclass:: phoenix.client.resources.prompts.Prompts
   :members:
   :show-inheritance:

AsyncPrompts
~~~~~~~~~~~~
.. autoclass:: phoenix.client.resources.prompts.AsyncPrompts
   :members:
   :show-inheritance:

Spans
~~~~~
.. autoclass:: phoenix.client.resources.spans.Spans
   :members:
   :show-inheritance:

.. rubric:: Data extraction

.. automethod:: phoenix.client.resources.spans.Spans.get_spans_dataframe
   :no-index:

.. automethod:: phoenix.client.resources.spans.Spans.get_span_annotations_dataframe
   :no-index:

.. rubric:: Main phoenix compatibility methods

For compatibility with the main phoenix package API:

.. automethod:: phoenix.session.client.Client.get_spans_dataframe
   :no-index:

.. automethod:: phoenix.session.client.Client.get_evaluations
   :no-index:

.. automethod:: phoenix.session.client.Client.get_trace_dataset
   :no-index:

.. note::
   In phoenix-client, evaluations are represented as annotations. Use
   ``get_spans_dataframe`` together with
   ``get_span_annotations_dataframe`` to assemble analysis-ready data.

.. rubric:: Example: build a trace dataset (spans + evaluations)

.. code-block:: python

   from phoenix.client import Client
   from phoenix.client.types.spans import SpanQuery

   client = Client()

   # Get spans
   spans_df = client.spans.get_spans_dataframe(
       query=SpanQuery(),
       project_identifier="default",
       limit=1000,
   )

   # Get evaluations (annotations) for those spans
   evals_df = client.spans.get_span_annotations_dataframe(
       spans_dataframe=spans_df,
       project_identifier="default",
   )

   # Merge spans and evaluations on span id
   merged = spans_df.set_index("context.span_id").join(evals_df, how="left")


AsyncSpans
~~~~~~~~~~
.. autoclass:: phoenix.client.resources.spans.AsyncSpans
   :members:
   :show-inheritance:

Annotations
~~~~~~~~~~~
.. autoclass:: phoenix.client.resources.annotations.Annotations
   :members:
   :show-inheritance:

AsyncAnnotations
~~~~~~~~~~~~~~~~
.. autoclass:: phoenix.client.resources.annotations.AsyncAnnotations
   :members:
   :show-inheritance:

Module Contents
---------------

.. automodule:: phoenix.client
   :members:
   :exclude-members: Client, AsyncClient
   :no-undoc-members: 