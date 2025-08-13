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

phoenix.Client
--------------
.. automodule:: session.client
   :members:
   :special-members: __init__
   :inherited-members:
   :exclude-members: DatasetUploadError

.. automethod:: session.client.Client.get_spans_dataframe
   :noindex:

.. automethod:: session.client.Client.get_trace_dataset
   :noindex:
