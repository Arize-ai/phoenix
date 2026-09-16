---
max_turns: 6
timeout_seconds: 180
allowed_tools: [Skill, Read]
runs: 3
---
My OpenTelemetry Collector is dropping spans under load. The exporter logs say the sending queue is full. How should I tune the batch processor and the queue settings in the collector config so it stops dropping?
