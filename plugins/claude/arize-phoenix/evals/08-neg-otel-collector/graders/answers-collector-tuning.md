---
type: llm
focus: last_message
weight: 1
---
The user asked how to tune an OpenTelemetry Collector that is dropping spans because the exporter sending queue is full. Score against these claims; each must hold for a pass.

1. The response addresses the Collector configuration directly: the `batch` processor settings (`send_batch_size`, `send_batch_max_size`, `timeout`) and/or the exporter `sending_queue` settings (`queue_size`, `num_consumers`, `enabled`), and optionally `memory_limiter` or retry settings.
2. It shows or describes a YAML change the user can apply, not just general advice to "scale up".
3. The response contains no reference to Arize Phoenix, the `px` CLI, or any Phoenix-specific skill or tool. Mentioning generic backends is fine.
