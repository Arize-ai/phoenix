import { Channel, CLOSED, isClosed } from "../../src/utils/channel";

import { describe, expect, it } from "vitest";

/**
 * Test utilities and constants
 */
const ASYNC_SETTLE_TIME_MS = 10 as const; // Time for async operations to settle
const STRESS_TEST_COUNT = 1000 as const; // Item count for stress tests

/**
 * Wait for async operations to settle.
 * Used to verify blocking behavior before unblocking operations.
 */
const waitForSettle = (ms: number = ASYNC_SETTLE_TIME_MS): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe("Channel", () => {
  describe("Basic Operations", () => {
    it("should send and receive values", async () => {
      // Verifies basic FIFO semantics work correctly
      const ch = new Channel<number>(2);
      await ch.send(1);
      await ch.send(2);

      expect(await ch.receive()).toBe(1);
      expect(await ch.receive()).toBe(2);
    });

    it("should block when buffer is full", async () => {
      // Critical for backpressure: prevents producer from overwhelming consumer
      // When buffer is full, send() must block until space is available
      const ch = new Channel<number>(1);
      await ch.send(1); // Fills buffer

      let sendResolved = false;
      const sendPromise = ch.send(2).then(() => {
        sendResolved = true;
      });

      // Verify send is blocked (backpressure active)
      await waitForSettle();
      expect(sendResolved).toBe(false);

      // Receive unblocks the sender (backpressure released)
      expect(await ch.receive()).toBe(1);
      await sendPromise;
      expect(sendResolved).toBe(true);
    });

    it("should return CLOSED when closed and empty", async () => {
      // Fundamental contract: closed + empty channel = CLOSED signal
      // Critical for for-await loops to terminate cleanly
      const ch = new Channel<number>(1);
      ch.close();
      expect(await ch.receive()).toBe(CLOSED);
    });
  });

  describe("Close Behavior", () => {
    it("should reject blocked senders when closed", async () => {
      // Graceful shutdown: blocked senders must be notified of closure
      // This prevents memory leaks from hanging promises
      const ch = new Channel<number>(1);
      await ch.send(1); // Fill buffer

      // Start a send that will block (buffer full)
      const sendPromise = ch.send(2);

      // Close the channel - must reject blocked senders
      ch.close();

      // The blocked send should reject immediately
      await expect(sendPromise).rejects.toThrow(
        "Channel closed while send was blocked"
      );
    });

    it("should resolve blocked receivers with CLOSED when closed", async () => {
      // Graceful shutdown: blocked receivers must be notified of closure
      // This allows for-await loops to terminate cleanly
      const ch = new Channel<number>(1);

      // Start a receive that will block (channel is empty)
      const receivePromise = ch.receive();

      // Close the channel - must resolve blocked receivers
      ch.close();

      // The blocked receive should resolve with CLOSED symbol
      expect(await receivePromise).toBe(CLOSED);
    });

    it("should error on send to closed channel", async () => {
      // Safety: prevent accidental sends after close
      // Helps catch bugs where shutdown order is wrong
      const ch = new Channel<number>(1);
      ch.close();

      await expect(ch.send(1)).rejects.toThrow("Cannot send to closed channel");
    });

    it("should drain remaining buffer after close", async () => {
      // Graceful shutdown: buffered values must be delivered before CLOSED
      // Critical: prevents data loss during shutdown
      const ch = new Channel<number>(2);
      await ch.send(1);
      await ch.send(2);
      ch.close();

      expect(await ch.receive()).toBe(1);
      expect(await ch.receive()).toBe(2);
      expect(await ch.receive()).toBe(CLOSED);
    });
  });

  describe("Async Iteration", () => {
    it("should iterate over values until closed", async () => {
      // AsyncIterator protocol: channels support for-await-of
      // Most ergonomic way to consume channels in JavaScript
      const ch = new Channel<number>(10);
      const values: number[] = [];

      // Producer
      (async () => {
        for (let i = 1; i <= 5; i++) {
          await ch.send(i);
        }
        ch.close();
      })();

      // Consumer using for await
      for await (const value of ch) {
        values.push(value);
      }

      expect(values).toEqual([1, 2, 3, 4, 5]);
    });

    it("should handle errors gracefully in iterator", async () => {
      // Iterator must complete cleanly when channel closes mid-iteration
      // Prevents hanging async loops
      const ch = new Channel<number>(1);
      const values: number[] = [];

      // Consumer
      const consumer = (async () => {
        for await (const value of ch) {
          values.push(value);
        }
      })();

      await ch.send(1);
      ch.close();

      await consumer;
      expect(values).toEqual([1]);
    });
  });

  describe("Producer-Consumer Pattern", () => {
    it("should handle multiple producers and consumers", async () => {
      // Real-world pattern: M producers → channel → N consumers
      // Critical: verifies work distribution across multiple workers
      // No data loss, no duplicates despite concurrent access
      const ch = new Channel<number>(10);
      const results: number[] = [];

      // 2 Producers
      const producers = [
        (async () => {
          for (let i = 0; i < 5; i++) {
            await ch.send(i);
          }
        })(),
        (async () => {
          for (let i = 5; i < 10; i++) {
            await ch.send(i);
          }
        })(),
      ];

      // 2 Consumers
      const consumers = [
        (async () => {
          for await (const value of ch) {
            results.push(value);
          }
        })(),
        (async () => {
          for await (const value of ch) {
            results.push(value);
          }
        })(),
      ];

      // Wait for producers to finish, then close
      await Promise.all(producers);
      ch.close();

      // Wait for consumers to finish
      await Promise.all(consumers);

      // All values should be consumed
      expect(results.sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });

  describe("Unbuffered Channels (Capacity 0)", () => {
    // Unbuffered channels are a fundamental CSP pattern for synchronous handoff
    // Producer and consumer must rendezvous - neither can proceed without the other
    // This is critical for strict flow control where buffering is undesirable

    it("should support unbuffered channels where send blocks until receive", async () => {
      // With capacity=0, send and receive must synchronize (rendezvous pattern)
      // This ensures 1:1 producer-consumer coupling with zero buffering
      const ch = new Channel<number>(0);

      let sendResolved = false;
      const sendPromise = ch.send(42).then(() => {
        sendResolved = true;
      });

      // Send must block immediately (no buffer space)
      await waitForSettle();
      expect(sendResolved).toBe(false);

      // Receive unblocks sender (direct handoff, no buffering)
      expect(await ch.receive()).toBe(42);
      await sendPromise;
      expect(sendResolved).toBe(true);
    });

    it("should handle multiple blocked sends on unbuffered channel", async () => {
      const ch = new Channel<number>(0);

      // Block multiple sends
      const send1 = ch.send(1);
      const send2 = ch.send(2);
      const send3 = ch.send(3);

      // Receive them one by one
      expect(await ch.receive()).toBe(1);
      expect(await ch.receive()).toBe(2);
      expect(await ch.receive()).toBe(3);

      await Promise.all([send1, send2, send3]);
    });

    it("should work with for-await on unbuffered channel", async () => {
      const ch = new Channel<number>(0);
      const results: number[] = [];

      // Producer
      const producer = (async () => {
        for (let i = 1; i <= 5; i++) {
          await ch.send(i);
        }
        ch.close();
      })();

      // Consumer
      for await (const value of ch) {
        results.push(value);
      }

      await producer;
      expect(results).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("FIFO Order Guarantees", () => {
    // Channels must preserve insertion order (First-In-First-Out)
    // This is a fundamental requirement for correctness in producer-consumer patterns

    it("should preserve FIFO order for sends and receives", async () => {
      // Basic FIFO test: values must be received in the exact order sent
      const ch = new Channel<number>(100);
      const sent = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

      // Send all values
      for (const n of sent) {
        await ch.send(n);
      }

      // Receive all values - order must match
      const received: number[] = [];
      for (let i = 0; i < sent.length; i++) {
        received.push(await ch.receive());
      }

      expect(received).toEqual([...sent]); // Must preserve exact order
    });

    it("should preserve FIFO order even with backpressure", async () => {
      // FIFO must hold even when producer is blocked (critical for correctness)
      const ch = new Channel<number>(2); // Small buffer forces backpressure
      const sent = [1, 2, 3, 4, 5] as const;
      const received: number[] = [];

      // Producer that will experience backpressure
      const producer = (async () => {
        for (const n of sent) {
          await ch.send(n); // Will block when buffer is full
        }
        ch.close();
      })();

      // Consumer that receives slower (causes backpressure)
      for await (const value of ch) {
        received.push(value);
        await waitForSettle(5); // Simulate slow processing
      }

      await producer;
      expect(received).toEqual([...sent]); // Order must be preserved despite blocking
    });
  });

  describe("Concurrent Operations", () => {
    // Concurrent operations test race conditions and thread safety
    // These verify that interleaved sends/receives don't corrupt state

    it("should handle concurrent sends and receives without data loss", async () => {
      // Race condition test: producer and consumer run simultaneously
      // Must not lose data or allow duplicates despite concurrent access
      const ch = new Channel<number>(5);
      const results: number[] = [];
      const count = 100;

      // Start receiving immediately
      const consumer = (async () => {
        for (let i = 0; i < count; i++) {
          results.push(await ch.receive());
        }
      })();

      // Send concurrently
      const producer = (async () => {
        for (let i = 0; i < count; i++) {
          await ch.send(i);
        }
      })();

      await Promise.all([producer, consumer]);

      // All values should be received (order may vary due to concurrency)
      expect(results.sort((a, b) => a - b)).toEqual(
        Array.from({ length: count }, (_, i) => i)
      );
    });

    it("should handle interleaved sends and receives", async () => {
      const ch = new Channel<number>(2);
      const results: number[] = [];

      // Interleave sends and receives
      await ch.send(1);
      results.push(await ch.receive());

      await ch.send(2);
      await ch.send(3);
      results.push(await ch.receive());
      results.push(await ch.receive());

      await ch.send(4);
      results.push(await ch.receive());

      expect(results).toEqual([1, 2, 3, 4]);
    });
  });

  describe("Async Iteration Edge Cases", () => {
    it("should allow breaking out of for-await loop early", async () => {
      const ch = new Channel<number>(10);

      // Producer sends many values
      (async () => {
        for (let i = 0; i < 100; i++) {
          await ch.send(i);
        }
        ch.close();
      })();

      // Consumer breaks early
      const values: number[] = [];
      for await (const value of ch) {
        values.push(value);
        if (value === 5) break;
      }

      expect(values).toEqual([0, 1, 2, 3, 4, 5]);
      expect(values.length).toBe(6);
    });

    it("should handle empty channel with immediate close in for-await", async () => {
      const ch = new Channel<number>(10);
      ch.close();

      const values: number[] = [];
      for await (const value of ch) {
        values.push(value);
      }

      expect(values).toEqual([]);
    });
  });

  describe("Close with Pending Operations", () => {
    it("should handle close with mixed blocked senders and receivers", async () => {
      // Complex shutdown scenario: some operations complete, others are notified of closure
      const ch = new Channel<number>(2);

      // Setup: Fill buffer and block a sender
      await ch.send(1);
      await ch.send(2);
      const blockedSend = ch.send(3); // Blocks because buffer full

      await waitForSettle();
      expect(ch.pendingSends).toBe(1);

      // Start receivers - some will get values, others will block
      const recv1 = ch.receive(); // Gets 1 from buffer
      const recv2 = ch.receive(); // Gets 2 from buffer
      const recv3 = ch.receive(); // Gets 3 from blocked sender (unblocks it)

      await waitForSettle();

      const recv4 = ch.receive(); // Will block (empty)
      const recv5 = ch.receive(); // Also blocks

      await waitForSettle();
      expect(ch.pendingReceives).toBe(2);

      // Close: blocked receivers get CLOSED, but values in flight are delivered
      ch.close();

      // Values that were already being transferred complete successfully
      expect(await recv1).toBe(1);
      expect(await recv2).toBe(2);
      expect(await recv3).toBe(3);

      // Blocked receivers get CLOSED
      expect(await recv4).toBe(CLOSED);
      expect(await recv5).toBe(CLOSED);

      // Blocked send was unblocked by recv3 before close
      await expect(blockedSend).resolves.toBeUndefined();
    });

    it("should reject blocked senders immediately when closed", async () => {
      const ch = new Channel<number>(1);
      await ch.send(1); // Fill buffer

      // Block a sender
      const blockedSend = ch.send(2);

      // Close without consuming - sender should reject
      ch.close();

      await expect(blockedSend).rejects.toThrow(
        "Channel closed while send was blocked"
      );

      // Can still drain buffer
      expect(await ch.receive()).toBe(1);
      expect(await ch.receive()).toBe(CLOSED);
    });

    it("should prevent new operations after close", async () => {
      const ch = new Channel<number>(10);
      ch.close();

      // Send should reject
      await expect(ch.send(1)).rejects.toThrow("Cannot send to closed channel");

      // Receive should return CLOSED
      expect(await ch.receive()).toBe(CLOSED);
    });
  });

  describe("High-Throughput Stress Test", () => {
    // Stress tests verify correctness under load and catch race conditions
    // These tests process thousands of items to expose edge cases

    it("should handle high-throughput scenarios without data loss", async () => {
      // Process 1000 items without losing data or violating invariants
      // Verifies: no data loss, no duplicates, correct count
      const ch = new Channel<number>(10);
      const results: number[] = [];

      const producer = (async () => {
        for (let i = 0; i < STRESS_TEST_COUNT; i++) {
          await ch.send(i);
        }
        ch.close();
      })();

      for await (const value of ch) {
        results.push(value);
      }

      await producer;

      expect(results.length).toBe(STRESS_TEST_COUNT);
      expect(results.sort((a, b) => a - b)).toEqual(
        Array.from({ length: STRESS_TEST_COUNT }, (_, i) => i)
      );
    });

    it("should handle multiple producers under load", async () => {
      const ch = new Channel<number>(20);
      const producerCount = 5;
      const itemsPerProducer = 100;
      const results: number[] = [];

      // Start multiple producers
      const producers = Array.from({ length: producerCount }, (_, producerId) =>
        (async () => {
          for (let i = 0; i < itemsPerProducer; i++) {
            await ch.send(producerId * itemsPerProducer + i);
          }
        })()
      );

      // Single consumer
      const consumer = (async () => {
        for (let i = 0; i < producerCount * itemsPerProducer; i++) {
          results.push(await ch.receive());
        }
      })();

      await Promise.all([...producers, consumer]);

      // Verify all values received (order doesn't matter with multiple producers)
      expect(results.length).toBe(producerCount * itemsPerProducer);
      expect(results.sort((a, b) => a - b)).toEqual(
        Array.from({ length: producerCount * itemsPerProducer }, (_, i) => i)
      );
    });
  });

  describe("Edge Cases", () => {
    it("should validate negative capacity", () => {
      expect(() => new Channel<number>(-1)).toThrow(
        "Channel capacity must be non-negative"
      );
    });

    it("should be idempotent when closing multiple times", () => {
      const ch = new Channel<number>(1);
      ch.close();
      ch.close(); // Should not throw
      ch.close(); // Still should not throw
      expect(ch.isClosed).toBe(true);
    });

    it("should report correct state when channel is full", async () => {
      const ch = new Channel<number>(2);
      await ch.send(1);
      await ch.send(2);

      expect(ch.length).toBe(2);
      expect(ch.capacity).toBe(2);

      // Next send should block
      let sendBlocked = false;
      const sendPromise = ch.send(3).then(() => {
        sendBlocked = true;
      });

      await waitForSettle();
      expect(sendBlocked).toBe(false);
      expect(ch.pendingSends).toBe(1);

      // Unblock
      await ch.receive();
      await sendPromise;
    });

    it("should handle receives on empty channel correctly", async () => {
      const ch = new Channel<number>(10);

      // Receive on empty channel should block
      let receiveResolved = false;
      const receivePromise = ch.receive().then((val) => {
        receiveResolved = true;
        return val;
      });

      await waitForSettle();
      expect(receiveResolved).toBe(false);
      expect(ch.pendingReceives).toBe(1);

      // Send to unblock
      await ch.send(42);
      expect(await receivePromise).toBe(42);
      expect(receiveResolved).toBe(true);
    });
  });

  describe("Introspection", () => {
    // Introspection APIs allow monitoring channel state for debugging/metrics
    // These are not core functionality but useful for observability

    it("should report capacity correctly", () => {
      // Capacity is the maximum buffer size (set at construction)
      const ch = new Channel<number>(42);
      expect(ch.capacity).toBe(42);
    });

    it("should report buffer length correctly", async () => {
      // Length is the current number of buffered items
      const ch = new Channel<number>(10);
      expect(ch.length).toBe(0);

      await ch.send(1);
      await ch.send(2);
      expect(ch.length).toBe(2);

      await ch.receive();
      expect(ch.length).toBe(1);

      await ch.receive();
      expect(ch.length).toBe(0);
    });

    it("should report pending sends", async () => {
      // pendingSends counts senders blocked on full buffer
      // Useful for monitoring backpressure
      const ch = new Channel<number>(1);
      await ch.send(1); // Fill buffer

      // Start blocked sends
      const send1 = ch.send(2);
      const send2 = ch.send(3);

      // Verify both are blocked
      await waitForSettle();
      expect(ch.pendingSends).toBe(2);

      // Unblock them
      await ch.receive();
      await ch.receive();
      await Promise.all([send1, send2]);

      expect(ch.pendingSends).toBe(0);
    });

    it("should report pending receives", async () => {
      // pendingReceives counts receivers blocked on empty buffer
      // Useful for detecting consumer starvation
      const ch = new Channel<number>(1);

      // Start blocked receives (channel is empty)
      const recv1 = ch.receive();
      const recv2 = ch.receive();

      // Verify both are blocked
      await waitForSettle();
      expect(ch.pendingReceives).toBe(2);

      // Unblock them
      await ch.send(1);
      await ch.send(2);
      await Promise.all([recv1, recv2]);

      expect(ch.pendingReceives).toBe(0);
    });
  });

  describe("Fairness Guarantees (CSP Property)", () => {
    // CSP requires fairness: operations should be serviced in FIFO order
    // This prevents starvation where some operations never complete

    it("should unblock senders in FIFO order (fairness)", async () => {
      // First blocked sender should be first unblocked (no starvation)
      const ch = new Channel<number>(1);
      await ch.send(0); // Fill buffer

      const results: number[] = [];

      // Block multiple senders in order
      const send1 = ch.send(1).then(() => results.push(1));
      const send2 = ch.send(2).then(() => results.push(2));
      const send3 = ch.send(3).then(() => results.push(3));

      await waitForSettle();

      // Unblock them one by one - must complete in FIFO order
      await ch.receive(); // Unblocks send1
      await ch.receive(); // Unblocks send2
      await ch.receive(); // Unblocks send3
      await ch.receive(); // Get last value

      await Promise.all([send1, send2, send3]);

      // Verify FIFO fairness: senders completed in order they blocked
      expect(results).toEqual([1, 2, 3]);
    });

    it("should unblock receivers in FIFO order (fairness)", async () => {
      const ch = new Channel<number>(1);
      const results: number[] = [];

      // Block multiple receivers in order
      const recv1 = ch.receive().then((v) => {
        results.push(v as number);
        return v;
      });
      const recv2 = ch.receive().then((v) => {
        results.push(v as number);
        return v;
      });
      const recv3 = ch.receive().then((v) => {
        results.push(v as number);
        return v;
      });

      await waitForSettle();

      // Send values - receivers should unblock in FIFO order
      await ch.send(1);
      await ch.send(2);
      await ch.send(3);

      await Promise.all([recv1, recv2, recv3]);

      // Verify FIFO fairness
      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe("Non-Determinism (CSP SELECT semantics)", () => {
    // CSP explicitly models non-determinism in concurrent operations
    // Test what happens when operations race

    it("should handle race between send and close without corruption", async () => {
      // When send and close happen simultaneously, either send completes OR
      // it rejects, but never partial state
      const ch = new Channel<number>(10);
      const results: Array<"sent" | "rejected"> = [];

      // Start 100 concurrent sends
      const sends = Array.from({ length: 100 }, (_, i) =>
        ch
          .send(i)
          .then(() => results.push("sent"))
          .catch(() => results.push("rejected"))
      );

      // Close "immediately" (races with sends)
      await waitForSettle(1);
      ch.close();

      await Promise.allSettled(sends);

      // Verify: all sends either completed or rejected (no hung promises)
      expect(results.length).toBe(100);

      // Drain buffer - should match number of successful sends
      const received: number[] = [];
      for await (const value of ch) {
        received.push(value);
      }

      const sentCount = results.filter((r) => r === "sent").length;
      expect(received.length).toBe(sentCount);
    });

    it("should handle simultaneous sends to unbuffered channel", async () => {
      // With capacity=0, multiple sends race for the same receiver
      // All sends should either complete or remain blocked (no lost values)
      const ch = new Channel<number>(0);
      const received: number[] = [];

      // Start 5 concurrent sends (all will block)
      const sends = [1, 2, 3, 4, 5].map((n) => ch.send(n));

      await waitForSettle();

      // Receive them all
      for (let i = 0; i < 5; i++) {
        received.push(await ch.receive());
      }

      await Promise.all(sends);

      // All values received (regardless of order)
      expect(received.sort()).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("CSP Communication Patterns", () => {
    // Real-world CSP patterns used in concurrent systems

    it("should support pipeline pattern (chaining channels)", async () => {
      // Pipeline: ch1 -> transform -> ch2 -> transform -> results
      // Classic CSP pattern for stream processing
      const ch1 = new Channel<number>(5);
      const ch2 = new Channel<number>(5);
      const results: number[] = [];

      // Stage 1: Producer
      const producer = (async () => {
        for (let i = 1; i <= 10; i++) {
          await ch1.send(i);
        }
        ch1.close();
      })();

      // Stage 2: Transformer (multiply by 2)
      const transformer = (async () => {
        for await (const value of ch1) {
          await ch2.send(value * 2);
        }
        ch2.close();
      })();

      // Stage 3: Consumer
      for await (const value of ch2) {
        results.push(value);
      }

      await Promise.all([producer, transformer]);

      expect(results).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    });

    it("should support fan-out pattern (one producer, multiple consumers)", async () => {
      // Fan-out: distribute work across multiple workers
      const ch = new Channel<number>(10);
      const worker1Results: number[] = [];
      const worker2Results: number[] = [];
      const worker3Results: number[] = [];

      // Producer
      const producer = (async () => {
        for (let i = 0; i < 30; i++) {
          await ch.send(i);
        }
        ch.close();
      })();

      // Three workers competing for work
      const workers = [
        (async () => {
          for await (const value of ch) {
            worker1Results.push(value);
          }
        })(),
        (async () => {
          for await (const value of ch) {
            worker2Results.push(value);
          }
        })(),
        (async () => {
          for await (const value of ch) {
            worker3Results.push(value);
          }
        })(),
      ];

      await Promise.all([producer, ...workers]);

      // All 30 items distributed across workers (order doesn't matter)
      const allResults = [
        ...worker1Results,
        ...worker2Results,
        ...worker3Results,
      ].sort((a, b) => a - b);

      expect(allResults).toEqual(Array.from({ length: 30 }, (_, i) => i));

      // Verify work distribution (no worker got everything)
      expect(worker1Results.length).toBeGreaterThan(0);
      expect(worker2Results.length).toBeGreaterThan(0);
      expect(worker3Results.length).toBeGreaterThan(0);
    });

    it("should support fan-in pattern (multiple producers, one consumer)", async () => {
      // Fan-in: merge results from multiple sources
      const ch = new Channel<number>(20);
      const results: number[] = [];

      // Three producers
      const producers = [
        (async () => {
          for (let i = 0; i < 10; i++) await ch.send(i);
        })(),
        (async () => {
          for (let i = 100; i < 110; i++) await ch.send(i);
        })(),
        (async () => {
          for (let i = 200; i < 210; i++) await ch.send(i);
        })(),
      ];

      // Consumer
      const consumer = (async () => {
        for (let i = 0; i < 30; i++) {
          results.push(await ch.receive());
        }
      })();

      await Promise.all([...producers, consumer]);

      // All 30 values received (order may vary)
      expect(results.length).toBe(30);
      expect(results.filter((n) => n < 10).length).toBe(10);
      expect(results.filter((n) => n >= 100 && n < 110).length).toBe(10);
      expect(results.filter((n) => n >= 200 && n < 210).length).toBe(10);
    });
  });

  describe("Memory Safety (Resource Cleanup)", () => {
    // Ensure channels don't leak memory from blocked operations

    it("should clean up references when channel is closed", async () => {
      const ch = new Channel<number>(2);

      // Test blocked senders cleanup
      await ch.send(1);
      await ch.send(2);
      const blockedSenders = Array.from({ length: 50 }, () => ch.send(999));

      await waitForSettle();
      expect(ch.pendingSends).toBe(50);

      // Close should reject all blocked senders and clear the queue
      ch.close();
      await Promise.allSettled(blockedSenders);
      expect(ch.pendingSends).toBe(0);

      // Test blocked receivers cleanup
      const ch2 = new Channel<number>(2);
      const blockedReceivers = Array.from({ length: 50 }, () => ch2.receive());

      await waitForSettle();
      expect(ch2.pendingReceives).toBe(50);

      // Close should resolve all blocked receivers with CLOSED and clear the queue
      ch2.close();
      await Promise.allSettled(blockedReceivers);
      expect(ch2.pendingReceives).toBe(0);
    });

    it("should not leak memory with repeated send/receive cycles", async () => {
      const ch = new Channel<number>(5);

      // Simulate high-churn usage (many short-lived operations)
      for (let cycle = 0; cycle < 100; cycle++) {
        await ch.send(cycle);
        const value = await ch.receive();
        expect(value).toBe(cycle);
      }

      // Channel should be in clean state
      expect(ch.length).toBe(0);
      expect(ch.pendingSends).toBe(0);
      expect(ch.pendingReceives).toBe(0);
    });
  });

  describe("Deadlock Prevention (Liveness)", () => {
    // Verify channels don't cause unintended deadlocks in system

    it("should not deadlock with circular wait", async () => {
      // Anti-pattern: circular dependency between channels
      // This WILL deadlock the tasks but shouldn't hang the test
      const ch1 = new Channel<number>(0);
      const ch2 = new Channel<number>(0);

      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Deadlock detected")), 100)
      );

      // This creates a circular wait condition
      const task1 = (async () => {
        await ch1.send(1);
        return await ch2.receive();
      })();

      const task2 = (async () => {
        await ch2.send(2);
        return await ch1.receive();
      })();

      // Verify this times out (expected deadlock)
      await expect(
        Promise.race([Promise.all([task1, task2]), timeout])
      ).rejects.toThrow("Deadlock detected");

      // Cleanup: close channels to release blocked operations
      ch1.close();
      ch2.close();
    });

    it("should handle graceful shutdown to prevent deadlock", async () => {
      // Proper pattern: close channels to signal shutdown
      const ch = new Channel<number>(5);

      // Start consumer that might block waiting for data
      const consumer = (async () => {
        const results: number[] = [];
        for await (const value of ch) {
          results.push(value);
        }
        return results;
      })();

      // Producer sends some data then closes
      await ch.send(1);
      await ch.send(2);
      ch.close();

      // Consumer should complete without deadlock
      const results = await consumer;
      expect(results).toEqual([1, 2]);
    });
  });

  describe("Non-blocking Operations", () => {
    // tryReceive() allows polling without blocking
    // Essential for event loops, game loops, and select-like patterns

    it("should return value immediately with tryReceive when available", () => {
      // Polling pattern: check for data without blocking
      // Use case: event loop that processes channel data when available
      const ch = new Channel<number>(10);
      ch.send(42);
      ch.send(43);

      const value1 = ch.tryReceive();
      expect(value1).toBe(42);

      const value2 = ch.tryReceive();
      expect(value2).toBe(43);
    });

    it("should return undefined with tryReceive when channel is empty", () => {
      // Critical: distinguish between "no data" (undefined) vs "channel closed" (CLOSED)
      // Allows polling loop to continue waiting
      const ch = new Channel<number>(10);

      const value = ch.tryReceive();
      expect(value).toBe(undefined);
    });

    it("should return CLOSED with tryReceive when channel is closed", () => {
      // Terminal state: closed channel returns CLOSED, not undefined
      // Allows polling loop to terminate
      const ch = new Channel<number>(10);
      ch.close();

      const value = ch.tryReceive();
      expect(value).toBe(CLOSED);
    });

    it("should drain buffer before returning CLOSED", () => {
      // Graceful shutdown: buffered data delivered before CLOSED signal
      // Same behavior as async receive() for consistency
      const ch = new Channel<number>(10);
      ch.send(1);
      ch.send(2);
      ch.close();

      expect(ch.tryReceive()).toBe(1);
      expect(ch.tryReceive()).toBe(2);
      expect(ch.tryReceive()).toBe(CLOSED);
    });

    it("should work with for-await after tryReceive", async () => {
      // Mixed pattern: peek with tryReceive, then consume with for-await
      // Useful for conditional processing based on first value
      const ch = new Channel<number>(10);
      await ch.send(1);
      await ch.send(2);
      await ch.send(3);

      // Try receive first item
      expect(ch.tryReceive()).toBe(1);

      // Then use for-await for rest
      const remaining: number[] = [];
      const consumer = (async () => {
        for await (const value of ch) {
          remaining.push(value);
        }
      })();

      await waitForSettle();
      ch.close();
      await consumer;

      expect(remaining).toEqual([2, 3]);
    });
  });

  describe("Type Guards", () => {
    // isClosed() provides type narrowing
    // Eliminates need for type assertions, improves type safety

    it("should narrow types with isClosed type guard", async () => {
      // TypeScript type narrowing: isClosed() refines union type
      // Critical: eliminates `as` assertions and makes code type-safe
      const ch = new Channel<number>(1);
      await ch.send(42);
      ch.close();

      const value1 = await ch.receive();
      if (isClosed(value1)) {
        // Type narrowing: value1 is typeof CLOSED here
        expect(value1).toBe(CLOSED);
      } else {
        // Type narrowing: value1 is number here
        expect(value1).toBe(42);
        const doubled: number = value1 * 2; // Type-safe, no assertion needed
        expect(doubled).toBe(84);
      }

      const value2 = await ch.receive();
      if (!isClosed(value2)) {
        // This branch won't execute
        throw new Error("Should be closed");
      }
      expect(value2).toBe(CLOSED);
    });

    it("should work with tryReceive and type narrowing", () => {
      // Combined guards: check undefined AND CLOSED before using value
      // Demonstrates proper type narrowing with tryReceive's triple return
      const ch = new Channel<number>(10);
      ch.send(123);

      const value = ch.tryReceive();

      if (value !== undefined && !isClosed(value)) {
        // Type narrowed to number (not undefined, not CLOSED)
        const result: number = value + 1;
        expect(result).toBe(124);
      } else {
        throw new Error("Should have received value");
      }
    });
  });
});
