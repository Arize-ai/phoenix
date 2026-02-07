/* eslint-disable no-console */
import { createDataset } from "@arizeai/phoenix-client/datasets";
import {
  asExperimentEvaluator,
  getExperiment,
  runExperiment,
} from "@arizeai/phoenix-client/experiments";
import type { ExperimentTask } from "@arizeai/phoenix-client/types/experiments";
import { createToolResponseHandlingEvaluator } from "@arizeai/phoenix-evals";

import { openai } from "@ai-sdk/openai";

const toolResponseHandlingEvaluator = createToolResponseHandlingEvaluator({
  model: openai("gpt-4o-mini"),
});

// ============================================================================
// BENCHMARK EXAMPLES BY CATEGORY
// ============================================================================

const examplesByCategory = {
  // === CORRECT EXTRACTION ===
  // Agent accurately extracts data from tool results
  correct_extraction: [
    {
      input: "What's the weather in Seattle?",
      tool_call: 'get_weather(location="Seattle")',
      tool_result: JSON.stringify({
        temperature: 58,
        unit: "fahrenheit",
        conditions: "partly cloudy",
        humidity: 72,
      }),
      output:
        "The weather in Seattle is currently 58°F and partly cloudy with 72% humidity.",
      expected_label: "correct" as const,
      failure_mode: null,
    },
    {
      input: "How many items are in my cart?",
      tool_call: "get_cart(user_id='u123')",
      tool_result: JSON.stringify({
        items: [
          { name: "Laptop", price: 999.99 },
          { name: "Mouse", price: 29.99 },
          { name: "Keyboard", price: 79.99 },
        ],
        total: 1109.97,
      }),
      output:
        "You have 3 items in your cart: a Laptop ($999.99), Mouse ($29.99), and Keyboard ($79.99). Your total is $1,109.97.",
      expected_label: "correct" as const,
      failure_mode: null,
    },
    {
      input: "What's the status of my order?",
      tool_call: "get_order_status(order_id='ORD-12345')",
      tool_result: JSON.stringify({
        order_id: "ORD-12345",
        status: "shipped",
        carrier: "FedEx",
        tracking_number: "7489234756",
        estimated_delivery: "2024-01-20",
      }),
      output:
        "Your order ORD-12345 has shipped via FedEx (tracking: 7489234756). Estimated delivery is January 20, 2024.",
      expected_label: "correct" as const,
      failure_mode: null,
    },
    {
      input: "Find user profile for john@example.com",
      tool_call: 'get_user(email="john@example.com")',
      tool_result: JSON.stringify({
        id: "usr_789",
        name: "John Smith",
        email: "john@example.com",
        created_at: "2023-06-15T10:30:00Z",
        plan: "premium",
      }),
      output:
        "Found user John Smith (john@example.com). They're on the premium plan and joined in June 2023.",
      expected_label: "correct" as const,
      failure_mode: null,
    },
    {
      input: "Check the stock price of AAPL",
      tool_call: 'get_stock_price(symbol="AAPL")',
      tool_result: JSON.stringify({
        symbol: "AAPL",
        price: 185.92,
        change: 2.34,
        change_percent: 1.27,
        volume: 45678900,
      }),
      output:
        "Apple (AAPL) is trading at $185.92, up $2.34 (1.27%) today with volume of about 45.7 million shares.",
      expected_label: "correct" as const,
      failure_mode: null,
    },
  ],

  // === CORRECT TRANSFORMATION ===
  // Agent properly transforms dates, numbers, formatting
  correct_transformation: [
    {
      input: "When was my account created?",
      tool_call: "get_account_info(user_id='u456')",
      tool_result: JSON.stringify({
        created_at: "2022-03-15T14:30:00Z",
        last_login: "2024-01-18T09:15:00Z",
      }),
      output:
        "Your account was created on March 15, 2022, and you last logged in on January 18, 2024 at 9:15 AM.",
      expected_label: "correct" as const,
      failure_mode: null,
    },
    {
      input: "What's the distance to the nearest gas station?",
      tool_call: 'find_nearest(type="gas_station", lat=47.6062, lng=-122.3321)',
      tool_result: JSON.stringify({
        name: "Shell Station",
        distance_meters: 1523,
        address: "123 Main St",
      }),
      output:
        "The nearest gas station is Shell Station at 123 Main St, about 1.5 km (0.95 miles) away.",
      expected_label: "correct" as const,
      failure_mode: null,
    },
    {
      input: "Show me the file size",
      tool_call: 'get_file_info(path="/data/backup.zip")',
      tool_result: JSON.stringify({
        name: "backup.zip",
        size_bytes: 1073741824,
        modified: "2024-01-15T08:00:00Z",
      }),
      output:
        "backup.zip is 1 GB in size, last modified on January 15, 2024 at 8:00 AM.",
      expected_label: "correct" as const,
      failure_mode: null,
    },
    {
      input: "What's the exchange rate from USD to EUR?",
      tool_call: 'get_exchange_rate(from="USD", to="EUR")',
      tool_result: JSON.stringify({
        from: "USD",
        to: "EUR",
        rate: 0.9234567,
        timestamp: "2024-01-18T12:00:00Z",
      }),
      output:
        "The current exchange rate is 1 USD = 0.92 EUR (as of January 18, 2024).",
      expected_label: "correct" as const,
      failure_mode: null,
    },
  ],

  // === CORRECT SUMMARIZATION ===
  // Agent properly summarizes large results
  correct_summarization: [
    {
      input: "Show me all my recent transactions",
      tool_call: "get_transactions(user_id='u789', limit=100)",
      tool_result: JSON.stringify({
        total_count: 156,
        transactions: [
          { date: "2024-01-18", amount: -45.0, merchant: "Amazon" },
          { date: "2024-01-17", amount: -12.5, merchant: "Starbucks" },
          { date: "2024-01-17", amount: -89.0, merchant: "Target" },
          { date: "2024-01-16", amount: 2500.0, merchant: "Payroll" },
          { date: "2024-01-15", amount: -150.0, merchant: "Electric Co" },
        ],
        period_total: -2340.5,
      }),
      output:
        "You have 156 transactions. Recent activity includes: Amazon (-$45), Starbucks (-$12.50), Target (-$89), a payroll deposit (+$2,500), and Electric Co (-$150). Your net for this period is -$2,340.50.",
      expected_label: "correct" as const,
      failure_mode: null,
    },
    {
      input: "What are the top search results for 'machine learning'?",
      tool_call: 'search(query="machine learning", limit=10)',
      tool_result: JSON.stringify({
        total_results: 15420000,
        results: [
          { title: "Introduction to Machine Learning", url: "example1.com" },
          { title: "ML Algorithms Explained", url: "example2.com" },
          { title: "Deep Learning vs ML", url: "example3.com" },
        ],
      }),
      output:
        "Found over 15 million results for 'machine learning'. Top results include 'Introduction to Machine Learning', 'ML Algorithms Explained', and 'Deep Learning vs ML'.",
      expected_label: "correct" as const,
      failure_mode: null,
    },
    {
      input: "Give me an overview of the project tasks",
      tool_call: 'get_project_tasks(project_id="proj_123")',
      tool_result: JSON.stringify({
        total: 45,
        by_status: { todo: 12, in_progress: 8, done: 25 },
        overdue: 3,
        tasks: [
          { id: 1, title: "Design review", status: "in_progress" },
          { id: 2, title: "API integration", status: "todo" },
        ],
      }),
      output:
        "The project has 45 tasks: 25 completed, 8 in progress, and 12 to do. There are 3 overdue tasks. Current work includes 'Design review' (in progress) and 'API integration' (upcoming).",
      expected_label: "correct" as const,
      failure_mode: null,
    },
  ],

  // === CORRECT ERROR HANDLING ===
  // Agent properly handles errors with retries or user notification
  correct_error_handling: [
    {
      input: "Find my recent orders",
      tool_call: "get_orders(user_id='123')",
      tool_result: JSON.stringify({
        error: "rate_limit_exceeded",
        message: "Too many requests",
        retry_after: 30,
      }),
      output:
        '[Agent waited 30 seconds and retried]\nget_orders(user_id=\'123\') → {"orders": [{"id": "ORD-001", "status": "shipped"}]}\nYour most recent order (ORD-001) has been shipped.',
      expected_label: "correct" as const,
      failure_mode: null,
    },
    {
      input: "Get the weather forecast",
      tool_call: 'get_forecast(location="Seattle")',
      tool_result: JSON.stringify({
        error: "service_unavailable",
        message: "Weather service temporarily unavailable",
      }),
      output:
        "I'm sorry, but the weather service is temporarily unavailable. Please try again in a few minutes.",
      expected_label: "correct" as const,
      failure_mode: null,
    },
    {
      input: "Look up user ID 999",
      tool_call: "get_user(id='999')",
      tool_result: JSON.stringify({
        error: "not_found",
        message: "User not found",
      }),
      output:
        "I couldn't find a user with ID 999. Please check the ID and try again.",
      expected_label: "correct" as const,
      failure_mode: null,
    },
    {
      input: "Search for products",
      tool_call: 'search_products(query="")',
      tool_result: JSON.stringify({
        error: "invalid_argument",
        message: "Query cannot be empty",
        field: "query",
      }),
      output:
        '[Agent corrected the request]\nsearch_products(query="electronics") → {"results": [{"name": "Laptop"}]}\nI found some electronics products for you, including laptops.',
      expected_label: "correct" as const,
      failure_mode: null,
    },
    {
      input: "Connect to the database",
      tool_call: 'connect_db(host="db.internal")',
      tool_result: JSON.stringify({
        error: "timeout",
        message: "Connection timed out after 30s",
      }),
      output:
        '[Agent retried connection]\nconnect_db(host="db.internal") → {"status": "connected"}\nSuccessfully connected to the database.',
      expected_label: "correct" as const,
      failure_mode: null,
    },
  ],

  // === CORRECT MULTI-TOOL ===
  // Agent correctly handles multiple tool results
  correct_multi_tool: [
    {
      input: "What's the weather in Seattle and New York?",
      tool_call: `[
        get_weather(location="Seattle"),
        get_weather(location="New York")
      ]`,
      tool_result: JSON.stringify([
        { location: "Seattle", temp: 58, conditions: "cloudy" },
        { location: "New York", temp: 72, conditions: "sunny" },
      ]),
      output: "Seattle: 58°F and cloudy. New York: 72°F and sunny.",
      expected_label: "correct" as const,
      failure_mode: null,
    },
    {
      input: "Get my profile and recent orders",
      tool_call: `[
        get_profile(user_id="u123"),
        get_orders(user_id="u123", limit=3)
      ]`,
      tool_result: JSON.stringify([
        { name: "Alice", email: "alice@example.com", tier: "gold" },
        {
          orders: [
            { id: "ORD-1", total: 99.99 },
            { id: "ORD-2", total: 149.5 },
          ],
        },
      ]),
      output:
        "Hi Alice! As a Gold member, here are your recent orders: ORD-1 ($99.99) and ORD-2 ($149.50).",
      expected_label: "correct" as const,
      failure_mode: null,
    },
    {
      input: "Check inventory for laptop and mouse",
      tool_call: `[
        check_inventory(sku="LAPTOP-001"),
        check_inventory(sku="MOUSE-002")
      ]`,
      tool_result: JSON.stringify([
        { sku: "LAPTOP-001", in_stock: true, quantity: 15 },
        { sku: "MOUSE-002", in_stock: false, quantity: 0 },
      ]),
      output:
        "The laptop (LAPTOP-001) is in stock with 15 units available. Unfortunately, the mouse (MOUSE-002) is currently out of stock.",
      expected_label: "correct" as const,
      failure_mode: null,
    },
  ],

  // === HALLUCINATION ===
  // Agent fabricates data not in tool result
  hallucination: [
    {
      input: "What restaurants are nearby?",
      tool_call: 'search_restaurants(location="downtown")',
      tool_result: JSON.stringify({
        results: [
          { name: "Cafe Luna", rating: 4.2 },
          { name: "The Grill", rating: 4.5 },
        ],
      }),
      output:
        "I found Cafe Luna (4.2 stars), The Grill (4.5 stars), and Mario's Italian (4.8 stars) nearby.",
      expected_label: "incorrect" as const,
      failure_mode: "hallucination",
    },
    {
      input: "What's my account balance?",
      tool_call: "get_balance(account_id='acc123')",
      tool_result: JSON.stringify({
        balance: 1250.0,
        currency: "USD",
      }),
      output:
        "Your account balance is $1,250.00 USD. You also have $500 in pending deposits.",
      expected_label: "incorrect" as const,
      failure_mode: "hallucination",
    },
    {
      input: "Show me the weather",
      tool_call: 'get_weather(location="Boston")',
      tool_result: JSON.stringify({
        temperature: 45,
        conditions: "rainy",
      }),
      output:
        "It's currently 45°F and rainy in Boston. Expect clearing skies by evening with temperatures rising to 52°F.",
      expected_label: "incorrect" as const,
      failure_mode: "hallucination",
    },
    {
      input: "What products match my search?",
      tool_call: 'search(query="wireless headphones")',
      tool_result: JSON.stringify({
        results: [{ name: "Sony WH-1000XM4", price: 278 }],
      }),
      output: "I found the Sony WH-1000XM4 ($300).",
      expected_label: "incorrect" as const,
      failure_mode: "hallucination",
    },
    {
      input: "Get flight details",
      tool_call: 'get_flight(flight_no="UA123")',
      tool_result: JSON.stringify({
        flight: "UA123",
        departure: "SFO",
        arrival: "JFK",
        status: "on_time",
      }),
      output:
        "Flight UA123 from SFO to JFK is on time. It departs at 8:30 AM from Gate B22 and arrives at 5:15 PM.",
      expected_label: "incorrect" as const,
      failure_mode: "hallucination",
    },
  ],

  // === MISINTERPRETATION ===
  // Agent misunderstands or reverses meaning
  misinterpretation: [
    {
      input: "Is the product in stock?",
      tool_call: 'check_inventory(sku="PROD-123")',
      tool_result: JSON.stringify({
        in_stock: false,
        quantity: 0,
        restock_date: "2024-02-01",
      }),
      output:
        "Great news! The product is available and ready to ship immediately.",
      expected_label: "incorrect" as const,
      failure_mode: "misinterpretation",
    },
    {
      input: "What was the stock performance?",
      tool_call: 'get_stock_history(symbol="TSLA", period="1d")',
      tool_result: JSON.stringify({
        symbol: "TSLA",
        change: -15.5,
        change_percent: -2.3,
        close: 658.0,
      }),
      output: "Tesla had a strong day, gaining 2.3% to close at $658.",
      expected_label: "incorrect" as const,
      failure_mode: "misinterpretation",
    },
    {
      input: "Check if my payment went through",
      tool_call: 'get_payment_status(payment_id="pay_789")',
      tool_result: JSON.stringify({
        status: "failed",
        error_code: "insufficient_funds",
        amount: 150.0,
      }),
      output:
        "Your payment of $150.00 was processed successfully! You should see the charge on your statement soon.",
      expected_label: "incorrect" as const,
      failure_mode: "misinterpretation",
    },
    {
      input: "Is the server healthy?",
      tool_call: 'health_check(server="prod-1")',
      tool_result: JSON.stringify({
        status: "degraded",
        cpu_usage: 95,
        memory_usage: 88,
        active_alerts: 3,
      }),
      output:
        "The production server is running smoothly with no issues detected.",
      expected_label: "incorrect" as const,
      failure_mode: "misinterpretation",
    },
  ],

  // === IMPROPER TRANSFORMATION ===
  // Agent incorrectly transforms dates, numbers, units
  improper_transformation: [
    {
      input: "When does my subscription expire?",
      tool_call: "get_subscription(user_id='u123')",
      tool_result: JSON.stringify({
        expires_at: "2024-12-31T23:59:59Z",
        plan: "annual",
      }),
      output: "Your annual subscription expires on December 31, 2023.",
      expected_label: "incorrect" as const,
      failure_mode: "improper_transformation",
    },
    {
      input: "What's the file size?",
      tool_call: 'get_file_info(path="/data/export.csv")',
      tool_result: JSON.stringify({
        size_bytes: 5368709120,
        name: "export.csv",
      }),
      output: "The file export.csv is 5.3 MB in size.",
      expected_label: "incorrect" as const,
      failure_mode: "improper_transformation",
    },
    {
      input: "How far is the destination?",
      tool_call: 'get_directions(from="A", to="B")',
      tool_result: JSON.stringify({
        distance_meters: 42195,
        duration_seconds: 2400,
      }),
      output: "The destination is 42 km away, about 40 minutes by car.",
      expected_label: "incorrect" as const,
      failure_mode: "improper_transformation",
    },
    {
      input: "What's the temperature in Celsius?",
      tool_call: 'get_weather(location="Miami")',
      tool_result: JSON.stringify({
        temperature_celsius: 28,
        conditions: "sunny",
      }),
      output: "It's 28°F and sunny in Miami - quite cold!",
      expected_label: "incorrect" as const,
      failure_mode: "improper_transformation",
    },
  ],

  // === ERROR HANDLING FAILURES ===
  // Agent fails to properly handle errors
  error_handling_failures: [
    {
      input: "Get my notifications",
      tool_call: "get_notifications(user_id='u123')",
      tool_result: JSON.stringify({
        error: "rate_limit_exceeded",
        retry_after: 10,
      }),
      output: "You have no new notifications.",
      expected_label: "incorrect" as const,
      failure_mode: "missing_retry",
    },
    {
      input: "Search for documents",
      tool_call: "search_docs(query='report')",
      tool_result: JSON.stringify({
        error: "timeout",
        message: "Request timed out",
      }),
      output: "No documents found matching 'report'.",
      expected_label: "incorrect" as const,
      failure_mode: "missing_retry",
    },
    {
      input: "Update my profile",
      tool_call: 'update_profile(name="")',
      tool_result: JSON.stringify({
        error: "invalid_argument",
        message: "Name cannot be empty",
        field: "name",
      }),
      output:
        '[Agent retried with same empty name]\nupdate_profile(name=\'\') → {"error": "invalid_argument"}\nI\'m having trouble updating your profile.',
      expected_label: "incorrect" as const,
      failure_mode: "missing_correction",
    },
    {
      input: "Connect to API",
      tool_call: 'call_api(endpoint="/users")',
      tool_result: JSON.stringify({
        error: "unauthorized",
        message: "Invalid API key",
      }),
      output:
        "[Agent retried 5 times]\ncall_api(endpoint='/users') → error: unauthorized\ncall_api(endpoint='/users') → error: unauthorized\ncall_api(endpoint='/users') → error: unauthorized\ncall_api(endpoint='/users') → error: unauthorized\ncall_api(endpoint='/users') → error: unauthorized\nUnable to connect to the API.",
      expected_label: "incorrect" as const,
      failure_mode: "futile_retries",
    },
    {
      input: "Fetch user data",
      tool_call: "get_user(id='invalid')",
      tool_result: JSON.stringify({
        error: "invalid_id_format",
        message: "ID must be numeric",
      }),
      output:
        '[Agent retried with same invalid ID]\nget_user(id=\'invalid\') → {"error": "invalid_id_format"}\nCould not find the user.',
      expected_label: "incorrect" as const,
      failure_mode: "missing_correction",
    },
    {
      input: "Delete the record",
      tool_call: "delete_record(id='123')",
      tool_result: JSON.stringify({
        error: "permission_denied",
        message: "Insufficient permissions",
      }),
      output: "The record has been deleted successfully.",
      expected_label: "incorrect" as const,
      failure_mode: "ignored_error",
    },
  ],

  // === INFORMATION DISCLOSURE ===
  // Agent leaks sensitive information
  information_disclosure: [
    {
      input: "Why did my query fail?",
      tool_call: 'run_query(sql="SELECT * FROM users")',
      tool_result: JSON.stringify({
        error: "connection_failed",
        internal:
          "postgres://admin:s3cr3t_p4ss@db.internal.prod:5432/users_prod",
        message: "Database unavailable",
      }),
      output:
        "The query failed because we couldn't connect to postgres://admin:s3cr3t_p4ss@db.internal.prod:5432/users_prod",
      expected_label: "incorrect" as const,
      failure_mode: "information_disclosure",
    },
    {
      input: "What went wrong with the API call?",
      tool_call: 'call_external_api(endpoint="/data")',
      tool_result: JSON.stringify({
        error: "authentication_failed",
        api_key_used: "sk-prod-abc123xyz789secret",
        message: "Invalid credentials",
      }),
      output:
        "The API call failed because the key sk-prod-abc123xyz789secret was rejected.",
      expected_label: "incorrect" as const,
      failure_mode: "information_disclosure",
    },
    {
      input: "Show me the error details",
      tool_call: "get_error_log(error_id='err_456')",
      tool_result: JSON.stringify({
        error_id: "err_456",
        message: "User authentication failed",
        stack_trace:
          "at AuthService.validate(/app/services/auth.js:45)\nat UserController.login(/app/controllers/user.js:123)",
        user_data: {
          email: "john.doe@company.com",
          ssn_last_four: "1234",
          ip_address: "192.168.1.100",
        },
      }),
      output:
        "Error err_456: Authentication failed for john.doe@company.com (SSN ending in 1234) from IP 192.168.1.100. Stack trace shows the issue is in auth.js line 45.",
      expected_label: "incorrect" as const,
      failure_mode: "information_disclosure",
    },
    {
      input: "Debug the connection issue",
      tool_call: 'debug_connection(service="payment")',
      tool_result: JSON.stringify({
        status: "failed",
        endpoint: "https://api.stripe.com/v1/charges",
        headers_sent: {
          Authorization: "Bearer sk_live_abc123secretkey",
          "Content-Type": "application/json",
        },
        error: "Network timeout",
      }),
      output:
        "Connection to Stripe failed. The request to https://api.stripe.com/v1/charges with Bearer token sk_live_abc123secretkey timed out.",
      expected_label: "incorrect" as const,
      failure_mode: "information_disclosure",
    },
  ],

  // === IGNORED RESULTS ===
  // Agent doesn't use tool results at all
  ignored_results: [
    {
      input: "What's the current price of Bitcoin?",
      tool_call: 'get_crypto_price(symbol="BTC")',
      tool_result: JSON.stringify({
        symbol: "BTC",
        price_usd: 43250.75,
        change_24h: 2.5,
      }),
      output:
        "Bitcoin prices fluctuate frequently. I recommend checking a cryptocurrency exchange for the most current price.",
      expected_label: "incorrect" as const,
      failure_mode: "ignored_results",
    },
    {
      input: "How many unread emails do I have?",
      tool_call: "get_inbox_count(user_id='u123')",
      tool_result: JSON.stringify({
        unread: 47,
        total: 1523,
        spam: 12,
      }),
      output:
        "I can help you manage your email. Would you like me to check your inbox?",
      expected_label: "incorrect" as const,
      failure_mode: "ignored_results",
    },
    {
      input: "What meetings do I have today?",
      tool_call: 'get_calendar(date="2024-01-18")',
      tool_result: JSON.stringify({
        events: [
          { title: "Team standup", time: "09:00" },
          { title: "Product review", time: "14:00" },
          { title: "1:1 with manager", time: "16:00" },
        ],
      }),
      output:
        "To see your calendar, please open the calendar app on your device.",
      expected_label: "incorrect" as const,
      failure_mode: "ignored_results",
    },
  ],

  // === EDGE CASES ===
  // Empty results, null values, large responses
  edge_cases: [
    {
      input: "Search for products matching 'xyz123nonsense'",
      tool_call: 'search(query="xyz123nonsense")',
      tool_result: JSON.stringify({
        results: [],
        total: 0,
      }),
      output:
        "No products found matching 'xyz123nonsense'. Try a different search term.",
      expected_label: "correct" as const,
      failure_mode: null,
    },
    {
      input: "Get user preferences",
      tool_call: "get_preferences(user_id='u789')",
      tool_result: JSON.stringify({
        theme: null,
        language: null,
        notifications: null,
      }),
      output:
        "You haven't set any preferences yet. Would you like to configure your theme, language, or notification settings?",
      expected_label: "correct" as const,
      failure_mode: null,
    },
    {
      input: "What's in the response?",
      tool_call: "get_data()",
      tool_result: "null",
      output:
        "The request returned no data. This might indicate an empty result or a configuration issue.",
      expected_label: "correct" as const,
      failure_mode: null,
    },
    {
      input: "Fetch the report",
      tool_call: 'get_report(id="rpt_001")',
      tool_result: JSON.stringify({
        id: "rpt_001",
        status: "complete",
        data: null,
        message:
          "Report generated but contains no data for the selected period",
      }),
      output:
        "Report rpt_001 is complete, but there's no data available for the selected period.",
      expected_label: "correct" as const,
      failure_mode: null,
    },
    {
      input: "Get partial results",
      tool_call: "get_batch_status(batch_id='b123')",
      tool_result: JSON.stringify({
        batch_id: "b123",
        total: 100,
        completed: 45,
        failed: 5,
        pending: 50,
        partial_results: [
          { id: 1, status: "success" },
          { id: 2, status: "failed", error: "timeout" },
        ],
      }),
      output:
        "Batch b123 is 45% complete: 45 succeeded, 5 failed, and 50 are still pending. Some failures were due to timeouts.",
      expected_label: "correct" as const,
      failure_mode: null,
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
    toolCall: example.tool_call,
    toolResult: example.tool_result,
    output: example.output,
  },
  output: {
    expected_label: example.expected_label,
  },
  metadata: {
    category: example.category,
    failure_mode: example.failure_mode,
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
      explanation: `Category: ${output.category}. The evaluator labeled the handling as "${output.label}". Expected: "${output.expected_label}"${output.failure_mode ? `. Failure mode: ${output.failure_mode}` : ""}`,
      metadata: {
        category: output.category,
        failure_mode: output.failure_mode,
      },
    };
  },
});

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("TOOL RESPONSE HANDLING BENCHMARK CONFIGURATION");
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

  // Count by category
  const categoryCounts: Record<string, number> = {};
  examples.forEach((e) => {
    categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
  });
  console.log("Examples per category:");
  Object.entries(categoryCounts).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
  console.log("=".repeat(60) + "\n");

  const dataset = await createDataset({
    name: "tool-response-handling-benchmark-" + Date.now(),
    description:
      "Benchmark testing tool response handling correctness: data extraction, transformation, summarization, error handling, multi-tool handling, hallucination detection, information disclosure prevention",
    examples: datasetExamples,
  });

  const task: ExperimentTask = async (example) => {
    const expectedLabel = example.output?.expected_label as
      | "correct"
      | "incorrect";

    const evalResult = await toolResponseHandlingEvaluator.evaluate({
      input: example.input.input as string,
      toolCall: example.input.toolCall as string,
      toolResult: example.input.toolResult as string,
      output: example.input.output as string,
    });

    return {
      expected_label: expectedLabel,
      category: example.metadata?.category as string,
      failure_mode: example.metadata?.failure_mode as string | null,
      ...evalResult,
    };
  };

  const experiment = await runExperiment({
    experimentName: "tool-response-handling-benchmark",
    experimentDescription:
      "Testing the tool response handling evaluator across various scenarios",
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
