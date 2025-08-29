client
======

.. contents:: :local:

Client
------
.. autoclass:: client.Client
   :members:
   :show-inheritance:

AsyncClient
-----------
.. autoclass:: client.AsyncClient
   :members:
   :show-inheritance:

Resources
---------

Projects
~~~~~~~~
.. autoclass:: client.resources.projects.Projects
   :members:
   :show-inheritance:

AsyncProjects
~~~~~~~~~~~~~
.. autoclass:: client.resources.projects.AsyncProjects
   :members:
   :show-inheritance:

Prompts
~~~~~~~
.. autoclass:: client.resources.prompts.Prompts
   :members:
   :show-inheritance:

AsyncPrompts
~~~~~~~~~~~~
.. autoclass:: client.resources.prompts.AsyncPrompts
   :members:
   :show-inheritance:

Spans
~~~~~
.. autoclass:: client.resources.spans.Spans
   :members:
   :show-inheritance:

.. rubric:: Data extraction

.. automethod:: client.resources.spans.Spans.get_spans_dataframe
   :no-index:

.. automethod:: client.resources.spans.Spans.get_span_annotations_dataframe
   :no-index:

.. rubric:: Main phoenix compatibility methods

For compatibility with the main phoenix package API:

.. automethod:: phoenix.session.client.Client.get_spans_dataframe

.. automethod:: phoenix.session.client.Client.get_evaluations

.. automethod:: phoenix.session.client.Client.get_trace_dataset

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
.. autoclass:: client.resources.spans.AsyncSpans
   :members:
   :show-inheritance:

Datasets
~~~~~~~~
.. autoclass:: client.resources.datasets.Datasets
   :members:
   :show-inheritance:

AsyncDatasets
~~~~~~~~~~~~~
.. autoclass:: client.resources.datasets.AsyncDatasets
   :members:
   :show-inheritance:

Experiments
~~~~~~~~~~~
.. autoclass:: client.resources.experiments.Experiments
   :members:
   :show-inheritance:

AsyncExperiments
~~~~~~~~~~~~~~~~
.. autoclass:: client.resources.experiments.AsyncExperiments
   :members:
   :show-inheritance:

Annotations
~~~~~~~~~~~
.. autoclass:: client.resources.annotations.Annotations
   :members:
   :show-inheritance:

AsyncAnnotations
~~~~~~~~~~~~~~~~
.. autoclass:: client.resources.annotations.AsyncAnnotations
   :members:
   :show-inheritance:

Helpers
-------

Spans Helpers
~~~~~~~~~~~~~
.. automodule:: client.helpers.spans
   :members:
   :show-inheritance:

SDK Helpers
~~~~~~~~~~~

OpenAI
^^^^^^
.. automodule:: client.helpers.sdk.openai
   :members:
   :show-inheritance:

Anthropic
^^^^^^^^^
.. automodule:: client.helpers.sdk.anthropic
   :members:
   :show-inheritance:

Google Generative AI
^^^^^^^^^^^^^^^^^^^^
.. automodule:: client.helpers.sdk.google_generativeai
   :members:
   :show-inheritance:

Module Contents
---------------

.. automodule:: client
   :members:
   :exclude-members: Client, AsyncClient
   :no-undoc-members: 