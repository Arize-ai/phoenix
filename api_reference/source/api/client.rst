client
======
API reference for phoenix.Client, which helps you upload and download data to and from local or remote Phoenix servers.

phoenix.client.AsyncClient
--------------------------
.. autoclass:: client.client::AsyncClient
   :members:
   :special-members: __init__

phoenix.client.Client
---------------------
.. autoclass:: client.client::Client
   :members:
   :special-members: __init__

.. autoclass:: client.client::Client
   :members: get_spans_dataframe, get_evaluations, get_trace_dataset
   :noindex:

phoenix.Client
--------------
.. automodule:: session.client
   :members:
   :special-members: __init__
   :exclude-members: DatasetUploadError

