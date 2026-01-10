/**
 * Progress indicators for Phoenix Insight CLI
 */
import ora, { type Ora } from "ora";

/**
 * Progress indicator for snapshot operations
 */
export class SnapshotProgress {
  private spinner: Ora | null = null;
  private enabled: boolean;
  private currentPhase: string | null = null;
  private totalSteps = 6;
  private currentStep = 0;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  /**
   * Start the progress indicator
   */
  start(message: string = "Creating Phoenix data snapshot") {
    if (!this.enabled) return;

    this.currentStep = 0;
    this.spinner = ora({
      text: message,
      spinner: "dots",
      color: "blue",
    }).start();
  }

  /**
   * Update progress with a new phase
   */
  update(phase: string, detail?: string) {
    if (!this.enabled || !this.spinner) return;

    this.currentStep++;
    this.currentPhase = phase;

    const progress = Math.round((this.currentStep / this.totalSteps) * 100);
    const progressBar = this.createProgressBar(progress);

    const message = detail
      ? `${progressBar} ${phase}: ${detail}`
      : `${progressBar} ${phase}`;

    this.spinner.text = message;
  }

  /**
   * Complete a phase successfully
   */
  succeed(message?: string) {
    if (!this.enabled || !this.spinner) return;

    const finalMessage =
      message || `✓ ${this.currentPhase || "Snapshot"} complete`;
    this.spinner.succeed(finalMessage);
    this.spinner = null;
  }

  /**
   * Fail with an error
   */
  fail(message?: string) {
    if (!this.enabled || !this.spinner) return;

    const finalMessage =
      message || `✗ ${this.currentPhase || "Snapshot"} failed`;
    this.spinner.fail(finalMessage);
    this.spinner = null;
  }

  /**
   * Stop without success/fail status
   */
  stop() {
    if (!this.enabled || !this.spinner) return;

    this.spinner.stop();
    this.spinner = null;
  }

  /**
   * Create a progress bar string
   */
  private createProgressBar(percentage: number): string {
    const width = 20;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;

    const bar = "█".repeat(filled) + "░".repeat(empty);
    return `[${bar}] ${percentage}%`;
  }
}

/**
 * Progress indicator for agent thinking
 */
export class AgentProgress {
  private spinner: Ora | null = null;
  private enabled: boolean;
  private stepCount = 0;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  /**
   * Start thinking indicator
   */
  startThinking() {
    if (!this.enabled) return;

    this.stepCount = 0;
    this.spinner = ora({
      text: "🤔 Analyzing...",
      spinner: "dots",
      color: "cyan",
    }).start();
  }

  /**
   * Update with current tool usage
   */
  updateTool(toolName: string, detail?: string) {
    if (!this.enabled || !this.spinner) return;

    this.stepCount++;
    const message = detail
      ? `🔧 Using ${toolName}: ${detail}`
      : `🔧 Using ${toolName} (step ${this.stepCount})`;

    this.spinner.text = message;
  }

  /**
   * Stop the thinking indicator
   */
  stop() {
    if (!this.enabled || !this.spinner) return;

    this.spinner.stop();
    this.spinner = null;
  }

  /**
   * Complete with a success message
   */
  succeed(message: string = "✨ Analysis complete") {
    if (!this.enabled || !this.spinner) return;

    this.spinner.succeed(message);
    this.spinner = null;
  }
}

/**
 * Simple progress logger for when spinners aren't appropriate
 */
export class SimpleProgress {
  private enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  log(message: string) {
    if (!this.enabled) return;
    console.log(`[Phoenix Insight] ${message}`);
  }

  info(message: string) {
    if (!this.enabled) return;
    console.log(`ℹ️  ${message}`);
  }

  success(message: string) {
    if (!this.enabled) return;
    console.log(`✅ ${message}`);
  }

  warning(message: string) {
    if (!this.enabled) return;
    console.log(`⚠️  ${message}`);
  }

  error(message: string) {
    if (!this.enabled) return;
    console.log(`❌ ${message}`);
  }
}
