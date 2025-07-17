/**
 * Performance Comparison: JSON vs JSONB
 *
 * This script demonstrates the performance differences between JSON and JSONB columns:
 * - Insert performance
 * - Query performance
 * - Index impact on query performance
 */
import dbService from "./services/db-service.js";

/**
 * Function to measure execution time
 * @param {Function} fn - The function to measure
 * @returns {Promise<number>} Execution time in milliseconds
 */
async function measureExecutionTime(fn: () => Promise<void>): Promise<number> {
  const start = process.hrtime.bigint();
  await fn();
  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000; // Convert to milliseconds
}

/**
 * Function to run and display a performance test
 * @param {string} name - The name/description of the test
 * @param {Function} testFn - The test function to execute
 */
async function runPerformanceTest(
  name: string,
  testFn: () => Promise<void>
): Promise<number> {
  console.log(`\n--- ${name} ---`);
  const executionTime = await measureExecutionTime(testFn);
  console.log(`Execution time: ${executionTime.toFixed(2)}ms`);
  return executionTime;
}

async function main(): Promise<void> {
  try {
    // Initialize the database service
    await dbService.initialize();

    // First, let's check if the table already exists and drop it to start fresh
    await dbService.query("DROP TABLE IF EXISTS performance_test;");

    // Create a table with JSON and JSONB columns
    await dbService.query(`
      CREATE TABLE performance_test (
        id SERIAL PRIMARY KEY,
        data_json JSON,
        data_jsonb JSONB
      );
    `);
    console.log(
      "Created table with data_json (JSON) and data_jsonb (JSONB) columns"
    );

    // Generate sample data
    const sampleData = {
      user: {
        name: "John Doe",
        email: "john@example.com",
        address: {
          street: "123 Main St",
          city: "Boston",
          country: "USA",
        },
        roles: ["admin", "user", "editor"],
        preferences: {
          theme: "dark",
          language: "en",
          notifications: true,
        },
        stats: {
          logins: 42,
          last_active: "2024-03-15",
        },
      },
      metadata: {
        version: "1.0.0",
        created_at: "2024-01-01",
        updated_at: "2024-03-15",
      },
    };

    // Convert to JSON string for insertion
    const jsonString = JSON.stringify(sampleData);

    // Test 1: Insert Performance
    console.log("\n----- INSERT PERFORMANCE -----");

    // Insert into JSON column
    const jsonInsertTime = await runPerformanceTest(
      "Insert into JSON column",
      async () => {
        for (let i = 0; i < 1000; i++) {
          await dbService.query(
            "INSERT INTO performance_test (data_json) VALUES ($1)",
            [jsonString]
          );
        }
      }
    );

    // Insert into JSONB column
    const jsonbInsertTime = await runPerformanceTest(
      "Insert into JSONB column",
      async () => {
        for (let i = 0; i < 1000; i++) {
          await dbService.query(
            "INSERT INTO performance_test (data_jsonb) VALUES ($1)",
            [jsonString]
          );
        }
      }
    );

    console.log(
      `\nInsert Performance Summary:
      JSON:  ${jsonInsertTime.toFixed(2)}ms
      JSONB: ${jsonbInsertTime.toFixed(2)}ms
      Difference: ${(((jsonbInsertTime - jsonInsertTime) / jsonInsertTime) * 100).toFixed(2)}%`
    );

    // Test 2: Query Performance
    console.log("\n----- QUERY PERFORMANCE -----");

    // Query JSON column
    const jsonQueryTime = await runPerformanceTest(
      "Query JSON column (no index)",
      async () => {
        for (let i = 0; i < 100; i++) {
          await dbService.query(`
            SELECT * FROM performance_test
            WHERE data_json->'user'->>'name' = 'John Doe'
          `);
        }
      }
    );

    // Query JSONB column
    const jsonbQueryTime = await runPerformanceTest(
      "Query JSONB column (no index)",
      async () => {
        for (let i = 0; i < 100; i++) {
          await dbService.query(`
            SELECT * FROM performance_test
            WHERE data_jsonb->'user'->>'name' = 'John Doe'
          `);
        }
      }
    );

    console.log(
      `\nQuery Performance Summary (no index):
      JSON:  ${jsonQueryTime.toFixed(2)}ms
      JSONB: ${jsonbQueryTime.toFixed(2)}ms
      Difference: ${(((jsonbQueryTime - jsonQueryTime) / jsonQueryTime) * 100).toFixed(2)}%`
    );

    // Test 3: Index Impact
    console.log("\n----- INDEX IMPACT -----");

    // Create GIN index on JSONB column
    await runPerformanceTest("Create GIN index on JSONB column", async () => {
      await dbService.query(`
        CREATE INDEX idx_performance_test_jsonb
        ON performance_test USING GIN (data_jsonb);
      `);
    });

    // Query JSONB column with index
    const jsonbQueryWithIndexTime = await runPerformanceTest(
      "Query JSONB column (with GIN index)",
      async () => {
        for (let i = 0; i < 100; i++) {
          await dbService.query(`
            SELECT * FROM performance_test
            WHERE data_jsonb->'user'->>'name' = 'John Doe'
          `);
        }
      }
    );

    console.log(
      `\nQuery Performance Summary (with GIN index):
      JSON (no index):  ${jsonQueryTime.toFixed(2)}ms
      JSONB (no index): ${jsonbQueryTime.toFixed(2)}ms
      JSONB (with index): ${jsonbQueryWithIndexTime.toFixed(2)}ms
      Improvement: ${(((jsonbQueryTime - jsonbQueryWithIndexTime) / jsonbQueryTime) * 100).toFixed(2)}%`
    );

    // Test 4: JSONB-specific operators performance
    console.log("\n----- JSONB-SPECIFIC OPERATORS PERFORMANCE -----");

    // Query using containment operator
    const jsonbContainmentTime = await runPerformanceTest(
      "Query using JSONB containment operator @>",
      async () => {
        for (let i = 0; i < 100; i++) {
          await dbService.query(`
            SELECT * FROM performance_test
            WHERE data_jsonb->'user'->'preferences' @> '{"theme": "dark"}'
          `);
        }
      }
    );

    // Query using exists operator
    const jsonbExistsTime = await runPerformanceTest(
      "Query using JSONB exists operator ?",
      async () => {
        for (let i = 0; i < 100; i++) {
          await dbService.query(`
            SELECT * FROM performance_test
            WHERE data_jsonb->'metadata' ? 'version'
          `);
        }
      }
    );

    console.log(
      `\nJSONB-specific Operators Performance Summary:
      Containment (@>): ${jsonbContainmentTime.toFixed(2)}ms
      Exists (?):      ${jsonbExistsTime.toFixed(2)}ms`
    );

    console.log(`
\n----- Performance Comparison Summary -----

1. Insert Performance:
   ✓ JSON is generally faster for inserts
   ✓ JSONB requires additional processing (validation and binary conversion)

2. Query Performance (no index):
   ✓ JSONB is generally faster for queries
   ✓ JSONB's binary format is more efficient to process

3. Index Impact:
   ✓ JSONB supports GIN indexing
   ✓ GIN indexes significantly improve query performance
   ✓ JSON does not support indexing

4. JSONB-specific Operators:
   ✓ Containment (@>) and exists (?) operators are efficient
   ✓ These operators are not available for JSON

Recommendation:
- Use JSON when:
  * Insert performance is critical
  * You need to preserve exact format and key order
  * You don't need complex queries or indexing

- Use JSONB when:
  * Query performance is critical
  * You need to use JSONB-specific operators
  * You need to create indexes on JSON data
  * Storage space is a concern
  * You don't need to preserve key order
`);

    // Close the database connection
    await dbService.close();
  } catch (error) {
    console.error("Error in performance demo:", error);
    // Make sure to close the connection in case of error
    await dbService.close();
  }
}

// Run the main function
main();
