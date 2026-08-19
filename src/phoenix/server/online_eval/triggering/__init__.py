"""Persist trigger demand across restarts as counters fed by durable event occurrences.

A leased drain prevents replicas from serving an occurrence twice. It answers demand
later under quiet-delay, filter, and capacity conditions that ingestion does not own,
which is why this subsystem does not reuse the ingest path's in-memory queues.
"""

