---
description: 'Moving your application to production: steps for reliability and scale'
---

# Production Guide

Moving your Phoenix deployment from development to production requires additional configuration for reliability, performance, and scalability. This page outlines the key steps and considerations to prepare your Phoenix instance for production workloads.

## Configuration

### Enable Batch Processing

Turn on the [batch processor](https://github.com/open-telemetry/opentelemetry-collector/blob/main/processor/batchprocessor/README.md) for spans, metrics, and logs. Batching improves data compression and reduces the number of outgoing connections required to transmit data efficiently. This is critical for stable ingestion at higher volumes.

The batch processor supports:

* **Size-based batching** (batch emits when a max number of items is reached)
* **Time-based batching** (batch emits after a configurable timeout)

### **Use gRPC Transport**

Switch your exporters to use gRPC wherever possible to maximize payload compression and reduce network overhead in production environments.

### **Scaling Facilities**

Plan for scaling resources to match your workload, including:

* **Memory scaling** for high-cardinality workloads or long retention windows.
* **Disk scaling** for log and trace ingestion, especially if retaining high volumes.
* **Horizontal scaling** if your deployment needs to handle increased concurrency.

### Enable Database Backups

Ensure that automated backups are enabled for your Postgres instance. This protects your data and allows recovery in the event of failures or data corruption.

## Resourcing Guidelines

Depending on your workload, you might need to provision your Phoenix instance with varying memory and data resources.&#x20;

### Memory Sizing

Memory requirements depend on several factors:

* **Ingestion volume:** Higher volumes of traces and logs increase memory needs for processing and indexing.
* **Variety of labels and attributes:** Workloads with many unique labels and attributes require additional memory for tracking and querying.
* **Retention settings:** Longer retention windows increase memory requirements for in-memory caching and indexing.

Monitor memory usage under expected production load and adjust resources to maintain your application performance.

### Database Sizing

For production and scalable deployments, Phoenix supports PostgreSQL. The database size will depend on:

* **Ingestion rate:** Higher data ingestion will increase storage usage.
* **Retention periods:** Longer data retention requires additional storage capacity.
* **Variety of labels and attributes:** Workloads with many unique values consume more database space for indexing and storage.

Regularly monitor disk utilization to plan for scaling and ensure stable, reliable operation.

### Backups

A solid backup plan protects your data and supports disaster recovery. Implement a Postgres backup strategy that considers:

* **Backup frequency:** How often backups occur.
* **Backup methods:** Such as point-in-time recovery (PITR) and full backups.
* **Test restores:** Regularly verify backups by restoring data.
