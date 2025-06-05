# What is the difference between GRPC and HTTP?

gRPC and HTTP are communication protocols used to transfer data between client and server applications.

* **HTTP (Hypertext Transfer Protocol)** is a stateless protocol primarily used for website and web application requests over the internet.
* **gRPC (gRemote Procedure Call)** is a modern, open-source communication protocol from Google that uses HTTP/2 for transport, protocol buffers as the interface description language, and provides features like bi-directional streaming, multiplexing, and flow control.&#x20;

gRPC is more efficient in a tracing context than HTTP, but HTTP is more widely supported.

Phoenix can send traces over either HTTP or gRPC.
