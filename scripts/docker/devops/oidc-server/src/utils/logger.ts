/**
 * Simple structured logging utility
 * Maintains comprehensive debug information without repetition
 */

export class Logger {
  /**
   * Log a structured event with timestamp and additional data
   */
  static logEvent(event: string, data: Record<string, any> = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      ...data,
    };
    console.log(JSON.stringify(logEntry));
  }

  /**
   * Log an error event with consistent structure
   */
  static logError(
    event: string,
    error: string,
    data: Record<string, any> = {}
  ) {
    this.logEvent(event, {
      error,
      ...data,
    });
  }

  /**
   * Log a request start event with timing information
   */
  static logRequestStart(
    event: string,
    requestId: string,
    data: Record<string, any> = {}
  ) {
    this.logEvent(event, {
      request_id: requestId,
      ...data,
    });
  }

  /**
   * Log token generation events with consistent format
   */
  static logTokenEvent(
    event: string,
    tokenType: string,
    data: Record<string, any> = {}
  ) {
    this.logEvent(event, {
      token_type: tokenType,
      ...data,
    });
  }
}
