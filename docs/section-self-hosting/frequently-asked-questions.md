## FAQs

### Permission denied writing to disc

Some phoenix containers run as nonroot and therefore must be granted explicit write permissions to the mounted disc (see [https://kubernetes.io/docs/tasks/configure-pod-container/security-context/](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/)). Phoenix 4.1.3 and above run as root by default to avoid this. However there are `debug` and `nonroot` variants of the image as well.