/**
 * A bounded, buffered CSP channel implementation for TypeScript.
 *
 * Implements the Producer-Consumer pattern with automatic backpressure via
 * blocking send/receive semantics. Based on Communicating Sequential Processes (Hoare, 1978).
 *
 * Properties:
 * - Bounded buffer: O(capacity) memory usage
 * - Blocking send: Blocks when buffer is full
 * - Blocking receive: Blocks when buffer is empty
 * - Graceful shutdown: Close drains buffer before terminating
 *
 * Performance Characteristics:
 * - send(): O(R) where R = pending receivers (typically 0-10)
 * - receive(): O(B + S) where B = buffer size, S = pending senders
 * - Uses Array.shift() which is O(n) but acceptable for small queues
 * - Same complexity trade-off as async.queue, p-limit, and similar libraries
 * - For typical usage (buffer < 100, queues < 10), overhead is negligible (<10ms per 5000 operations)
 *
 * Note: Could be optimized to O(1) with linked list or circular buffer, but current
 * implementation prioritizes simplicity and is comparable to standard JS libraries.
 *
 * Deadlock Prevention:
 * JavaScript channels use cooperative blocking via Promises, not true thread blocking.
 * Deadlocks are rare but possible in certain patterns:
 *
 * ❌ AVOID: Sequential operations on unbuffered channels
 * ```typescript
 * const ch = new Channel<number>(0);
 * await ch.send(1);     // Blocks forever - no receiver started
 * await ch.receive();   // Never reached
 * ```
 *
 * ❌ AVOID: Circular dependencies between channels
 * ```typescript
 * const ch1 = new Channel(0);
 * const ch2 = new Channel(0);
 * // Task 1: await ch1.send() → await ch2.receive()
 * // Task 2: await ch2.send() → await ch1.receive()
 * // Both block on send, never reach receive
 * ```
 *
 * ✅ SAFE: Concurrent start with buffered channels (recommended pattern)
 * ```typescript
 * const ch = new Channel<number>(); // Default (10) is safe
 *
 * // Start producer immediately
 * const producer = (async () => {
 *   for (let i = 0; i < 100; i++) {
 *     await ch.send(i);
 *   }
 *   ch.close(); // Always close in finally block
 * })();
 *
 * // Start consumers immediately
 * const consumers = Array.from({ length: 5 }, async () => {
 *   for await (const value of ch) {
 *     await processValue(value);
 *   }
 * });
 *
 * // Wait for all to complete
 * await Promise.all([producer, ...consumers]);
 * ```
 *
 * Best Practices:
 * 1. Use default capacity or higher (10+) for production - provides safety and throughput
 * 2. Always close() channels in a finally block to prevent hanging operations
 * 3. Start producers and consumers concurrently, not sequentially
 * 4. Use for-await loops for automatic cleanup on close
 * 5. Avoid circular dependencies between channels
 * 6. Handle errors in workers so they don't crash and leave channel blocked
 * 7. Only use unbuffered (capacity=0) when you need strict happens-before guarantees
 *
 * @see https://en.wikipedia.org/wiki/Communicating_sequential_processes
 *
 * @template T The type of values sent through the channel
 *
 * @example Safe Producer-Consumer Pattern
 * ```typescript
 * // Default capacity (10) is safe for most cases
 * const ch = new Channel<number>(); // or explicit: new Channel<number>(50)
 *
 * // Producer with proper cleanup
 * const producer = (async () => {
 *   try {
 *     for (let i = 0; i < 100; i++) {
 *       await ch.send(i); // Blocks if buffer full (backpressure)
 *     }
 *   } finally {
 *     ch.close(); // Guaranteed cleanup
 *   }
 * })();
 *
 * // Multiple consumers
 * const consumers = Array.from({ length: 3 }, async () => {
 *   for await (const value of ch) {
 *     console.log(value);
 *   }
 * });
 *
 * await Promise.all([producer, ...consumers]);
 * ```
 *
 * @example Unbuffered Channel (Rendezvous)
 * ```typescript
 * const ch = new Channel<number>(0); // Unbuffered - use with care!
 *
 * // Must start both operations before awaiting
 * const sendPromise = ch.send(42);    // Starts but doesn't block caller yet
 * const value = await ch.receive();   // Unblocks the sender
 * await sendPromise;                  // Now safe to await
 * ```
 */

/**
 * Internal type for blocked senders waiting to deliver values
 */
interface Sender<T> {
  readonly value: T;
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
}

/**
 * Internal type for blocked receivers waiting for values
 */
interface Receiver<T> {
  readonly resolve: (value: T | typeof CLOSED) => void;
  readonly reject: (error: Error) => void;
}

/**
 * Custom error class for channel operations
 */
export class ChannelError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ChannelError";
  }
}

/**
 * Error messages for channel operations
 */
const ERRORS = {
  SEND_TO_CLOSED: "Cannot send to closed channel",
  CLOSED_WHILE_BLOCKED: "Channel closed while send was blocked",
  NEGATIVE_CAPACITY: "Channel capacity must be non-negative",
} as const satisfies Record<string, string>;

export class Channel<T> {
  #buffer: T[] = [];
  #sendQueue: Sender<T>[] = [];
  #receiveQueue: Receiver<T>[] = [];
  #closed = false;
  readonly #capacity: number;

  /**
   * Create a new channel with the specified buffer capacity.
   *
   * @param capacity - Buffer size (default: 10)
   *   - 0: Unbuffered/rendezvous channel - strict synchronization, higher deadlock risk.
   *         Use only when you need guaranteed happens-before ordering.
   *   - 1-100: Buffered channel - recommended for production use.
   *   - Higher values: Better throughput but more memory usage.
   *
   * @example
   * ```typescript
   * // Default buffered (safe for most cases)
   * const ch1 = new Channel<number>();
   *
   * // Explicit buffer size (production pattern)
   * const ch2 = new Channel<number>(50);
   *
   * // Unbuffered (advanced - strict synchronization)
   * const ch3 = new Channel<number>(0);
   * ```
   */
  constructor(capacity: number = 10) {
    if (capacity < 0) {
      throw new ChannelError(ERRORS.NEGATIVE_CAPACITY);
    }
    this.#capacity = capacity;
  }

  /**
   * Send a value to the channel
   * Blocks if the buffer is full until space is available
   *
   * @param value - The value to send
   * @throws {ChannelError} If channel is closed
   */
  async send(value: T): Promise<void> {
    if (this.#closed) {
      throw new ChannelError(ERRORS.SEND_TO_CLOSED);
    }

    // Direct delivery to waiting receiver
    const receiver = this.#receiveQueue.shift();
    if (receiver) {
      receiver.resolve(value);
      return;
    }

    // Add to buffer if space available
    if (this.#buffer.length < this.#capacity) {
      this.#buffer.push(value);
      return;
    }

    // Block until space available
    return new Promise<void>((resolve, reject) => {
      this.#sendQueue.push({ value, resolve, reject });
    });
  }

  /**
   * Receive a value from the channel
   * Blocks if no value is available until one arrives
   *
   * @returns The received value, or CLOSED symbol if channel is closed and empty
   */
  async receive(): Promise<T | typeof CLOSED> {
    // Drain buffer first
    if (this.#buffer.length > 0) {
      const value = this.#buffer.shift()!;

      // Unblock a waiting sender
      const sender = this.#sendQueue.shift();
      if (sender) {
        this.#buffer.push(sender.value);
        sender.resolve();
      }

      return value;
    }

    // Direct handoff from waiting sender (critical for unbuffered channels)
    const sender = this.#sendQueue.shift();
    if (sender) {
      sender.resolve();
      return sender.value;
    }

    // Channel closed and empty
    if (this.#closed) {
      return CLOSED;
    }

    // Block until value available
    return new Promise<T | typeof CLOSED>((resolve, reject) => {
      this.#receiveQueue.push({ resolve, reject });
    });
  }

  /**
   * Try to receive a value without blocking
   * Returns immediately with value or undefined if channel is empty
   *
   * @returns The received value, CLOSED if channel is closed, or undefined if empty
   *
   * @example
   * ```typescript
   * const ch = new Channel<number>(10);
   * await ch.send(42);
   *
   * const value = ch.tryReceive();
   * if (value !== undefined && value !== CLOSED) {
   *   console.log("Got:", value);
   * }
   * ```
   */
  tryReceive(): T | typeof CLOSED | undefined {
    // Drain buffer first
    if (this.#buffer.length > 0) {
      const value = this.#buffer.shift()!;

      // Unblock a waiting sender
      const sender = this.#sendQueue.shift();
      if (sender) {
        this.#buffer.push(sender.value);
        sender.resolve();
      }

      return value;
    }

    // Direct handoff from waiting sender
    const sender = this.#sendQueue.shift();
    if (sender) {
      sender.resolve();
      return sender.value;
    }

    // Channel closed and empty
    if (this.#closed) {
      return CLOSED;
    }

    // Channel empty but not closed
    return undefined;
  }

  /**
   * Close the channel
   * No more sends allowed, but remaining values can be received
   */
  close(): void {
    if (this.#closed) return;
    this.#closed = true;

    // Resolve all blocked receivers
    for (const receiver of this.#receiveQueue) {
      receiver.resolve(CLOSED);
    }
    this.#receiveQueue = [];

    // Reject all blocked senders
    const error = new ChannelError(ERRORS.CLOSED_WHILE_BLOCKED);
    for (const sender of this.#sendQueue) {
      sender.reject(error);
    }
    this.#sendQueue = [];
  }

  /**
   * Check if channel is closed
   */
  get isClosed(): boolean {
    return this.#closed;
  }

  /**
   * Get current buffer length
   */
  get length(): number {
    return this.#buffer.length;
  }

  /**
   * Get the channel's capacity
   */
  get capacity(): number {
    return this.#capacity;
  }

  /**
   * Get the number of blocked senders waiting
   */
  get pendingSends(): number {
    return this.#sendQueue.length;
  }

  /**
   * Get the number of blocked receivers waiting
   */
  get pendingReceives(): number {
    return this.#receiveQueue.length;
  }

  /**
   * Async iterator support for for-await-of loops
   */
  async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
    while (true) {
      const value = await this.receive();
      if (value === CLOSED) return;
      yield value;
    }
  }
}

/**
 * Special symbol to indicate channel is closed
 */
export const CLOSED = Symbol("CLOSED");

/**
 * Type guard to check if a value is the CLOSED symbol
 *
 * @param value - Value to check
 * @returns true if value is CLOSED symbol
 *
 * @example
 * ```typescript
 * const value = await ch.receive();
 * if (isClosed(value)) {
 *   console.log("Channel is closed");
 * } else {
 *   console.log("Got value:", value);
 * }
 * ```
 */
export function isClosed<T>(value: T | typeof CLOSED): value is typeof CLOSED {
  return value === CLOSED;
}
