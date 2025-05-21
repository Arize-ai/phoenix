# How can I configure the backend to send the data to the phoenix UI in another container?

_If you are working on an API whose endpoints perform RAG, but would like the phoenix server not to be launched as another thread._

You can do this by configuring the following the [environment](https://docs.arize.com/phoenix/environments) variable PHOENIX\_COLLECTOR\_ENDPOINT to point to the server running in a different process or container.&#x20;
