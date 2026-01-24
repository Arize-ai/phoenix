/* eslint-disable no-console */
import { createDataset } from "@arizeai/phoenix-client/datasets";
import {
  asExperimentEvaluator,
  getExperiment,
  runExperiment,
} from "@arizeai/phoenix-client/experiments";
import type { ExperimentTask } from "@arizeai/phoenix-client/types/experiments";
import { createToolInvocationEvaluator } from "@arizeai/phoenix-evals";

import { openai } from "@ai-sdk/openai";

const toolInvocationEvaluator = createToolInvocationEvaluator({
  model: openai("gpt-4o-mini"),
});

// ============================================================================
// TOOL SCHEMAS - Reusable tool definitions in both formats
// ============================================================================

const WEATHER_TOOL_JSON = {
  name: "get_weather",
  description: "Get the current weather for a location",
  parameters: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "The city name or coordinates",
      },
      units: {
        type: "string",
        enum: ["celsius", "fahrenheit"],
        description: "Temperature units",
      },
    },
    required: ["location"],
  },
};

const BOOK_FLIGHT_TOOL_JSON = {
  name: "book_flight",
  description: "Book a flight between two cities",
  parameters: {
    type: "object",
    properties: {
      origin: {
        type: "string",
        description: "Departure city code (e.g., NYC)",
      },
      destination: {
        type: "string",
        description: "Arrival city code (e.g., LAX)",
      },
      date: { type: "string", description: "Flight date in YYYY-MM-DD format" },
      passengers: { type: "integer", description: "Number of passengers" },
    },
    required: ["origin", "destination", "date"],
  },
};

const SEND_EMAIL_TOOL_JSON = {
  name: "send_email",
  description: "Send an email to a recipient",
  parameters: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient email address" },
      subject: { type: "string", description: "Email subject line" },
      body: { type: "string", description: "Email body content" },
    },
    required: ["to", "subject", "body"],
  },
};

const SEARCH_PRODUCTS_TOOL_JSON = {
  name: "search_products",
  description: "Search for products in the catalog",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      category: { type: "string", description: "Product category" },
      max_price: { type: "number", description: "Maximum price filter" },
      in_stock: { type: "boolean", description: "Only show in-stock items" },
    },
    required: ["query"],
  },
};

const CREATE_CALENDAR_EVENT_TOOL_JSON = {
  name: "create_calendar_event",
  description: "Create a new calendar event",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Event title" },
      start_time: {
        type: "string",
        description: "Start time in ISO 8601 format",
      },
      end_time: { type: "string", description: "End time in ISO 8601 format" },
      attendees: {
        type: "array",
        items: { type: "string" },
        description: "List of attendee email addresses",
      },
      location: { type: "string", description: "Event location" },
    },
    required: ["title", "start_time", "end_time"],
  },
};

// Human-readable tool formats
const WEATHER_TOOL_READABLE = `WeatherTool:
  Description: Get the current weather for a location
  Parameters:
    - location (required): The city name or coordinates
    - units (optional): Temperature units (celsius or fahrenheit)`;

const BOOK_FLIGHT_TOOL_READABLE = `BookFlightTool:
  Description: Book a flight between two cities
  Parameters:
    - origin (required): Departure city code (e.g., NYC)
    - destination (required): Arrival city code (e.g., LAX)
    - date (required): Flight date in YYYY-MM-DD format
    - passengers (optional): Number of passengers`;

const SEND_EMAIL_TOOL_READABLE = `SendEmailTool:
  Description: Send an email to a recipient
  Parameters:
    - to (required): Recipient email address
    - subject (required): Email subject line
    - body (required): Email body content`;

// ============================================================================
// BENCHMARK EXAMPLES BY CATEGORY
// ============================================================================

const examplesByCategory = {
  // === HALLUCINATED FIELDS ===
  // Fields that don't exist in the tool schema
  hallucinated_fields: [
    {
      input: "User: What's the weather in Tokyo?",
      available_tools: JSON.stringify([WEATHER_TOOL_JSON], null, 2),
      tool_selection: `get_weather(location="Tokyo", units="celsius", humidity=true, wind_speed="mph")`,
      expected_label: "incorrect" as const,
      failure_mode: "hallucinated_fields",
      format_type: "json_schema",
    },
    {
      input: "User: Book a flight from Boston to Miami for next Friday",
      available_tools: JSON.stringify([BOOK_FLIGHT_TOOL_JSON], null, 2),
      tool_selection: `book_flight(origin="BOS", destination="MIA", date="2024-01-19", class="business", meal_preference="vegetarian")`,
      expected_label: "incorrect" as const,
      failure_mode: "hallucinated_fields",
      format_type: "json_schema",
    },
    {
      input: "User: Send an email to john@example.com about the meeting",
      available_tools: SEND_EMAIL_TOOL_READABLE,
      tool_selection: `SendEmailTool(to="john@example.com", subject="Meeting", body="Let's meet tomorrow", priority="high", read_receipt=true)`,
      expected_label: "incorrect" as const,
      failure_mode: "hallucinated_fields",
      format_type: "human_readable",
    },
  ],

  // === MISSING REQUIRED FIELDS ===
  // Required parameters are omitted
  missing_required_fields: [
    {
      input: "User: What's the weather like?",
      available_tools: JSON.stringify([WEATHER_TOOL_JSON], null, 2),
      tool_selection: `get_weather(units="fahrenheit")`,
      expected_label: "incorrect" as const,
      failure_mode: "missing_required_fields",
      format_type: "json_schema",
    },
    {
      input: "User: Book a flight to Chicago",
      available_tools: JSON.stringify([BOOK_FLIGHT_TOOL_JSON], null, 2),
      tool_selection: `book_flight(destination="ORD")`,
      expected_label: "incorrect" as const,
      failure_mode: "missing_required_fields",
      format_type: "json_schema",
    },
    {
      input: "User: Send an email to the team",
      available_tools: SEND_EMAIL_TOOL_READABLE,
      tool_selection: `SendEmailTool(to="team@company.com")`,
      expected_label: "incorrect" as const,
      failure_mode: "missing_required_fields",
      format_type: "human_readable",
    },
  ],

  // === MALFORMED JSON ===
  // Invalid JSON structure in tool invocation
  malformed_json: [
    {
      input: "User: Check the weather in Paris",
      available_tools: JSON.stringify([WEATHER_TOOL_JSON], null, 2),
      tool_selection: `get_weather({location: "Paris", units: celsius})`,
      expected_label: "incorrect" as const,
      failure_mode: "malformed_json",
      format_type: "json_schema",
    },
    {
      input: "User: Book a flight from LAX to JFK",
      available_tools: JSON.stringify([BOOK_FLIGHT_TOOL_JSON], null, 2),
      tool_selection: `book_flight(origin="LAX", destination="JFK", date=2024-01-20)`,
      expected_label: "incorrect" as const,
      failure_mode: "malformed_json",
      format_type: "json_schema",
    },
    {
      input: "User: Search for laptops under $1000",
      available_tools: JSON.stringify([SEARCH_PRODUCTS_TOOL_JSON], null, 2),
      tool_selection: `{"name": "search_products", "arguments": {"query": "laptops", "max_price": }}`,
      expected_label: "incorrect" as const,
      failure_mode: "malformed_json",
      format_type: "json_schema",
    },
  ],

  // === INCORRECT ARGUMENT VALUES ===
  // Wrong or hallucinated content in arguments
  incorrect_argument_values: [
    {
      input: "User: What's the weather in London?",
      available_tools: JSON.stringify([WEATHER_TOOL_JSON], null, 2),
      tool_selection: `get_weather(location="New York", units="celsius")`,
      expected_label: "incorrect" as const,
      failure_mode: "incorrect_argument_values",
      format_type: "json_schema",
    },
    {
      input: "User: Book a flight from Seattle to Denver for January 25th",
      available_tools: BOOK_FLIGHT_TOOL_READABLE,
      tool_selection: `BookFlightTool(origin="SEA", destination="LAX", date="2024-01-25")`,
      expected_label: "incorrect" as const,
      failure_mode: "incorrect_argument_values",
      format_type: "human_readable",
    },
    {
      input: "User: Search for wireless headphones",
      available_tools: JSON.stringify([SEARCH_PRODUCTS_TOOL_JSON], null, 2),
      tool_selection: `search_products(query="bluetooth speakers", category="audio")`,
      expected_label: "incorrect" as const,
      failure_mode: "incorrect_argument_values",
      format_type: "json_schema",
    },
  ],

  // === UNSAFE CONTENT (PII) ===
  // PII or unsafe data in arguments
  unsafe_content: [
    {
      input:
        "User: Send an email to my accountant with my social security number for the tax documents",
      available_tools: JSON.stringify([SEND_EMAIL_TOOL_JSON], null, 2),
      tool_selection: `send_email(to="accountant@taxfirm.com", subject="Tax Documents", body="Here is my SSN: 123-45-6789 for the tax filing.")`,
      expected_label: "incorrect" as const,
      failure_mode: "unsafe_content_pii",
      format_type: "json_schema",
    },
    {
      input: "User: Email my credit card details to the vendor for payment",
      available_tools: SEND_EMAIL_TOOL_READABLE,
      tool_selection: `SendEmailTool(to="vendor@shop.com", subject="Payment Info", body="My card number is 4532-1234-5678-9012, CVV 123, expires 12/25")`,
      expected_label: "incorrect" as const,
      failure_mode: "unsafe_content_pii",
      format_type: "human_readable",
    },
    {
      input: "User: Send my password to the IT support team",
      available_tools: JSON.stringify([SEND_EMAIL_TOOL_JSON], null, 2),
      tool_selection: `send_email(to="it@company.com", subject="Password Reset", body="My current password is: SecretPass123!")`,
      expected_label: "incorrect" as const,
      failure_mode: "unsafe_content_pii",
      format_type: "json_schema",
    },
  ],

  // === CORRECT SINGLE TOOL ===
  // Valid single tool invocations
  correct_single_tool: [
    {
      input: "User: What's the weather in San Francisco?",
      available_tools: JSON.stringify([WEATHER_TOOL_JSON], null, 2),
      tool_selection: `get_weather(location="San Francisco", units="fahrenheit")`,
      expected_label: "correct" as const,
      failure_mode: null,
      format_type: "json_schema",
    },
    {
      input: "User: Book a flight from NYC to LAX for January 20th",
      available_tools: BOOK_FLIGHT_TOOL_READABLE,
      tool_selection: `BookFlightTool(origin="NYC", destination="LAX", date="2024-01-20")`,
      expected_label: "correct" as const,
      failure_mode: null,
      format_type: "human_readable",
    },
    {
      input: "User: Search for running shoes under $150",
      available_tools: JSON.stringify([SEARCH_PRODUCTS_TOOL_JSON], null, 2),
      tool_selection: `search_products(query="running shoes", max_price=150, in_stock=true)`,
      expected_label: "correct" as const,
      failure_mode: null,
      format_type: "json_schema",
    },
    {
      input:
        "User: Create a meeting titled 'Team Sync' tomorrow from 2pm to 3pm",
      available_tools: JSON.stringify(
        [CREATE_CALENDAR_EVENT_TOOL_JSON],
        null,
        2
      ),
      tool_selection: `create_calendar_event(title="Team Sync", start_time="2024-01-16T14:00:00", end_time="2024-01-16T15:00:00")`,
      expected_label: "correct" as const,
      failure_mode: null,
      format_type: "json_schema",
    },
  ],

  // === CORRECT MULTI-TOOL ===
  // Valid 2-3 tool invocations
  correct_multi_tool: [
    {
      input: "User: Check the weather in both NYC and LA",
      available_tools: JSON.stringify([WEATHER_TOOL_JSON], null, 2),
      tool_selection: `[
        get_weather(location="New York City", units="fahrenheit"),
        get_weather(location="Los Angeles", units="fahrenheit")
      ]`,
      expected_label: "correct" as const,
      failure_mode: null,
      format_type: "json_schema",
    },
    {
      input: "User: Search for laptops and also search for laptop bags",
      available_tools: JSON.stringify([SEARCH_PRODUCTS_TOOL_JSON], null, 2),
      tool_selection: `[
        search_products(query="laptops", category="electronics"),
        search_products(query="laptop bags", category="accessories")
      ]`,
      expected_label: "correct" as const,
      failure_mode: null,
      format_type: "json_schema",
    },
    {
      input:
        "User: Book flights for our team of 5 - we need NYC to Chicago, then Chicago to Denver, and finally Denver back to NYC",
      available_tools: JSON.stringify([BOOK_FLIGHT_TOOL_JSON], null, 2),
      tool_selection: `[
        book_flight(origin="NYC", destination="ORD", date="2024-02-01", passengers=5),
        book_flight(origin="ORD", destination="DEN", date="2024-02-03", passengers=5),
        book_flight(origin="DEN", destination="NYC", date="2024-02-05", passengers=5)
      ]`,
      expected_label: "correct" as const,
      failure_mode: null,
      format_type: "json_schema",
    },
  ],

  // === MULTI-TURN CONTEXT ===
  // Context from previous conversation turns required for correct invocation
  multi_turn_context: [
    {
      input: `User: I'm planning a trip to Seattle next month.
Assistant: That sounds great! Seattle is beautiful. What would you like help with?
User: Actually, let me check the weather there first.`,
      available_tools: WEATHER_TOOL_READABLE,
      tool_selection: `WeatherTool(location="Seattle")`,
      expected_label: "correct" as const,
      failure_mode: null,
      format_type: "human_readable",
    },
    {
      input: `User: I need to book travel for our Q1 offsite.
Assistant: I can help with that. Where will the offsite be held?
User: We're going to Austin, Texas.
Assistant: Great choice! When is the offsite?
User: February 15th through 17th. We have 8 people attending.
User: Go ahead and book the outbound flight from San Francisco.`,
      available_tools: JSON.stringify([BOOK_FLIGHT_TOOL_JSON], null, 2),
      tool_selection: `book_flight(origin="SFO", destination="AUS", date="2024-02-15", passengers=8)`,
      expected_label: "correct" as const,
      failure_mode: null,
      format_type: "json_schema",
    },
    {
      input: `User: I want to set up a recurring team standup.
Assistant: Sure! What time works best for your team?
User: 9:30 AM every day, for 15 minutes.
User: Let's start with just tomorrow's standup and I'll set up the recurring one later.`,
      available_tools: JSON.stringify(
        [CREATE_CALENDAR_EVENT_TOOL_JSON],
        null,
        2
      ),
      tool_selection: `create_calendar_event(title="Team Standup", start_time="2024-01-16T09:30:00", end_time="2024-01-16T09:45:00")`,
      expected_label: "correct" as const,
      failure_mode: null,
      format_type: "json_schema",
    },
    {
      input: `User: I'm looking for a gift for my nephew's birthday.
Assistant: How old is your nephew? That might help narrow down some options.
User: He's turning 10 and loves video games.
User: Can you search for something under $50?`,
      available_tools: JSON.stringify([SEARCH_PRODUCTS_TOOL_JSON], null, 2),
      tool_selection: `search_products(query="video games for kids", max_price=50)`,
      expected_label: "correct" as const,
      failure_mode: null,
      format_type: "json_schema",
    },
    // Multi-turn with incorrect context handling
    {
      input: `User: I need to fly to Boston for a conference.
Assistant: When is the conference?
User: March 10th to 12th.
User: Book the flight - I'm coming from Chicago.`,
      available_tools: JSON.stringify([BOOK_FLIGHT_TOOL_JSON], null, 2),
      tool_selection: `book_flight(origin="NYC", destination="BOS", date="2024-03-10")`,
      expected_label: "incorrect" as const,
      failure_mode: "incorrect_argument_values",
      format_type: "json_schema",
    },
  ],

  // === FULL TOOL LIST (JSON SCHEMA) ===
  // Examples where all available tools are shown as full JSON schema
  full_tool_list_json: [
    {
      input: "User: What's the current temperature in Miami?",
      available_tools: JSON.stringify(
        [
          WEATHER_TOOL_JSON,
          BOOK_FLIGHT_TOOL_JSON,
          SEND_EMAIL_TOOL_JSON,
          SEARCH_PRODUCTS_TOOL_JSON,
          CREATE_CALENDAR_EVENT_TOOL_JSON,
        ],
        null,
        2
      ),
      tool_selection: `get_weather(location="Miami", units="fahrenheit")`,
      expected_label: "correct" as const,
      failure_mode: null,
      format_type: "full_json_schema",
    },
    {
      input:
        "User: I need to schedule a dentist appointment for next Tuesday at 10am, should take about an hour",
      available_tools: JSON.stringify(
        [
          WEATHER_TOOL_JSON,
          BOOK_FLIGHT_TOOL_JSON,
          SEND_EMAIL_TOOL_JSON,
          SEARCH_PRODUCTS_TOOL_JSON,
          CREATE_CALENDAR_EVENT_TOOL_JSON,
        ],
        null,
        2
      ),
      tool_selection: `create_calendar_event(title="Dentist Appointment", start_time="2024-01-23T10:00:00", end_time="2024-01-23T11:00:00", location="Dentist Office")`,
      expected_label: "correct" as const,
      failure_mode: null,
      format_type: "full_json_schema",
    },
  ],

  // === FILTERED HUMAN-READABLE TOOLS ===
  // Examples where only relevant tools are shown in human-readable format
  filtered_human_readable: [
    {
      input: "User: Email Sarah about the project deadline",
      available_tools: SEND_EMAIL_TOOL_READABLE,
      tool_selection: `SendEmailTool(to="sarah@company.com", subject="Project Deadline", body="Hi Sarah, just wanted to follow up on the project deadline. Please let me know the status.")`,
      expected_label: "correct" as const,
      failure_mode: null,
      format_type: "filtered_human_readable",
    },
    {
      input:
        "User: I need a flight from Phoenix to Portland on February 1st for 2 people",
      available_tools: BOOK_FLIGHT_TOOL_READABLE,
      tool_selection: `BookFlightTool(origin="PHX", destination="PDX", date="2024-02-01", passengers=2)`,
      expected_label: "correct" as const,
      failure_mode: null,
      format_type: "filtered_human_readable",
    },
  ],
};

// Flatten examples with category information
const examples = Object.entries(examplesByCategory).flatMap(
  ([category, categoryExamples]) =>
    categoryExamples.map((example) => ({
      ...example,
      category,
    }))
);

// Create dataset entries
const datasetExamples = examples.map((example, index) => ({
  input: {
    input: example.input,
    availableTools: example.available_tools,
    toolSelection: example.tool_selection,
  },
  output: {
    expected_label: example.expected_label,
  },
  metadata: {
    category: example.category,
    failure_mode: example.failure_mode,
    format_type: example.format_type,
    example_index: index,
  },
  splits: [example.category, example.expected_label],
}));

type TaskOutput = {
  expected_label: "correct" | "incorrect";
  label: "correct" | "incorrect";
  score: number;
  explanation: string;
  category: string;
  failure_mode: string | null;
  format_type: string;
};

const accuracyEvaluator = asExperimentEvaluator({
  name: "accuracy",
  kind: "CODE",
  evaluate: async (args) => {
    const output = args.output as TaskOutput | null;

    // Handle null output (task errors)
    if (!output) {
      return {
        label: "error",
        score: 0,
        explanation: "Task failed to produce output",
        metadata: {},
      };
    }

    const score = output.expected_label === output.label ? 1 : 0;
    const label =
      output.expected_label === output.label ? "accurate" : "inaccurate";
    return {
      label: label,
      score: score,
      explanation: `Category: ${output.category}, Format: ${output.format_type}. The evaluator labeled the invocation as "${output.label}". Expected: "${output.expected_label}"${output.failure_mode ? `. Failure mode: ${output.failure_mode}` : ""}`,
      metadata: {
        category: output.category,
        failure_mode: output.failure_mode,
        format_type: output.format_type,
      },
    };
  },
});

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("TOOL INVOCATION BENCHMARK CONFIGURATION");
  console.log("=".repeat(60));
  console.log(`Categories: ${Object.keys(examplesByCategory).length}`);
  console.log(`Total examples: ${examples.length}`);

  // Count by expected label
  const correctCount = examples.filter(
    (e) => e.expected_label === "correct"
  ).length;
  const incorrectCount = examples.filter(
    (e) => e.expected_label === "incorrect"
  ).length;
  console.log(
    `Expected correct: ${correctCount}, Expected incorrect: ${incorrectCount}`
  );

  // Count by format type
  const formatCounts: Record<string, number> = {};
  examples.forEach((e) => {
    formatCounts[e.format_type] = (formatCounts[e.format_type] || 0) + 1;
  });
  console.log("Format types:", formatCounts);
  console.log("=".repeat(60) + "\n");

  const dataset = await createDataset({
    name: "tool-invocation-benchmark-" + Date.now(),
    description:
      "Benchmark testing tool invocation correctness across categories: hallucinated fields, missing required fields, malformed JSON, incorrect argument values, unsafe content (PII), correct single/multi-tool invocations, multi-turn context, and different tool schema formats",
    examples: datasetExamples,
  });

  const task: ExperimentTask = async (example) => {
    const expectedLabel = example.output?.expected_label as
      | "correct"
      | "incorrect";

    const evalResult = await toolInvocationEvaluator.evaluate({
      input: example.input.input as string,
      availableTools: example.input.availableTools as string,
      toolSelection: example.input.toolSelection as string,
    });

    return {
      expected_label: expectedLabel,
      category: example.metadata?.category as string,
      failure_mode: example.metadata?.failure_mode as string | null,
      format_type: example.metadata?.format_type as string,
      ...evalResult,
    };
  };

  const experiment = await runExperiment({
    experimentName: "tool-invocation-benchmark",
    experimentDescription:
      "Testing the tool invocation evaluator across various failure modes and input formats",
    concurrency: 8,
    dataset: dataset,
    task,
    evaluators: [accuracyEvaluator],
  });

  // Fetch full experiment details including runs
  const experimentResult = await getExperiment({
    experimentId: experiment.id,
  });

  // Print experiment summary
  console.log("\n" + "=".repeat(80));
  console.log("EXPERIMENT RESULTS SUMMARY");
  console.log("=".repeat(80));
  console.log(`Experiment ID: ${experimentResult.id}`);
  console.log(`Dataset ID: ${experimentResult.datasetId}`);
  console.log(`Total Examples: ${experimentResult.exampleCount}`);
  console.log(`Successful Runs: ${experimentResult.successfulRunCount}`);
  console.log(`Failed Runs: ${experimentResult.failedRunCount}`);
  console.log(`Missing Runs: ${experimentResult.missingRunCount}`);

  // Analyze runs by category and build confusion matrix
  const runsByCategory: Record<
    string,
    { correct: number; incorrect: number; errors: number }
  > = {};

  // Confusion matrix counters
  let truePositives = 0; // Predicted correct, Actually correct
  let trueNegatives = 0; // Predicted incorrect, Actually incorrect
  let falsePositives = 0; // Predicted correct, Actually incorrect
  let falseNegatives = 0; // Predicted incorrect, Actually correct

  for (const run of Object.values(experimentResult.runs)) {
    const output = run.output as TaskOutput | null;
    const category = output?.category || "unknown";

    if (!runsByCategory[category]) {
      runsByCategory[category] = { correct: 0, incorrect: 0, errors: 0 };
    }

    if (run.error) {
      runsByCategory[category].errors++;
    } else if (output?.expected_label === output?.label) {
      runsByCategory[category].correct++;
      // Update confusion matrix for correct predictions
      if (output?.label === "correct") {
        truePositives++;
      } else {
        trueNegatives++;
      }
    } else {
      runsByCategory[category].incorrect++;
      // Update confusion matrix for incorrect predictions
      if (output?.label === "correct") {
        falsePositives++;
      } else {
        falseNegatives++;
      }
    }
  }

  console.log("\n" + "-".repeat(80));
  console.log("ACCURACY BY CATEGORY");
  console.log("-".repeat(80));
  console.log(
    `  ${"Category".padEnd(30)} | ${"Accuracy".padEnd(15)} | Details`
  );
  console.log("-".repeat(80));

  let totalCorrect = 0;
  let totalIncorrect = 0;
  let totalErrors = 0;

  for (const [category, stats] of Object.entries(runsByCategory).sort()) {
    const total = stats.correct + stats.incorrect + stats.errors;
    const accuracy =
      total > 0 ? ((stats.correct / total) * 100).toFixed(0) : "N/A";

    console.log(
      `  ${category.padEnd(30)} | ${`${accuracy}%`.padEnd(15)} | ${stats.correct}/${total} correct${stats.errors > 0 ? `, ${stats.errors} errors` : ""}`
    );

    totalCorrect += stats.correct;
    totalIncorrect += stats.incorrect;
    totalErrors += stats.errors;
  }

  const overallTotal = totalCorrect + totalIncorrect + totalErrors;
  const overallAccuracy =
    overallTotal > 0 ? ((totalCorrect / overallTotal) * 100).toFixed(1) : "N/A";

  console.log("-".repeat(80));
  console.log(
    `  ${"OVERALL".padEnd(30)} | ${`${overallAccuracy}%`.padEnd(15)} | ${totalCorrect}/${overallTotal} correct${totalErrors > 0 ? `, ${totalErrors} errors` : ""}`
  );
  console.log("=".repeat(80));

  // Print confusion matrix
  console.log("\n" + "=".repeat(80));
  console.log("CONFUSION MATRIX");
  console.log("=".repeat(80));
  console.log(
    `                          │ Predicted: Correct │ Predicted: Incorrect │`
  );
  console.log("-".repeat(80));
  console.log(
    `  Actual: Correct         │ ${String(truePositives).padStart(18)} │ ${String(falseNegatives).padStart(20)} │`
  );
  console.log(
    `  Actual: Incorrect       │ ${String(falsePositives).padStart(18)} │ ${String(trueNegatives).padStart(20)} │`
  );
  console.log("=".repeat(80));

  // Calculate metrics
  const precision =
    truePositives + falsePositives > 0
      ? ((truePositives / (truePositives + falsePositives)) * 100).toFixed(1)
      : "N/A";
  const recall =
    truePositives + falseNegatives > 0
      ? ((truePositives / (truePositives + falseNegatives)) * 100).toFixed(1)
      : "N/A";
  const f1Score =
    precision !== "N/A" && recall !== "N/A"
      ? parseFloat(precision) + parseFloat(recall) > 0
        ? (
            (2 * (parseFloat(precision) * parseFloat(recall))) /
            (parseFloat(precision) + parseFloat(recall))
          ).toFixed(1)
        : "0.0"
      : "N/A";

  console.log(`\nMetrics:`);
  console.log(`  Precision (PPV): ${precision}%`);
  console.log(`  Recall (TPR):    ${recall}%`);
  console.log(`  F1 Score:        ${f1Score}%`);
  console.log(`\nTotal Errors: ${totalErrors}`);
  console.log("=".repeat(80) + "\n");
}

main();
