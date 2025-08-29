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

Module Contents
---------------

.. automodule:: client
   :members:
   :exclude-members: Client, AsyncClient
   :no-undoc-members: 