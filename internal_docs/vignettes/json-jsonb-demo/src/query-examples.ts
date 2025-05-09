/**
 * Query Examples: Demonstrating JSON vs JSONB operators
 *
 * This script shows:
 * 1. Basic queries that work with both JSON and JSONB
 * 2. JSONB-specific operators that don't work with JSON
 * 3. Error cases when trying to use JSONB operators with JSON
 */
import dbService from "./services/db-service.js";

async function main(): Promise<void> {
  try {
    // Initialize the database service
    await dbService.initialize();

    // Drop existing table if it exists
    await dbService.query("DROP TABLE IF EXISTS json_operators;");

    // Create a table with both JSON and JSONB columns
    await dbService.query(`
      CREATE TABLE json_operators (
        id SERIAL PRIMARY KEY,
        data_json JSON,
        data_jsonb JSONB
      );
    `);
    console.log("Created table with JSON and JSONB columns");

    // Sample data
    const sampleData = {
      name: "John Doe",
      age: 30,
      preferences: {
        theme: "dark",
        notifications: true,
      },
    };

    // Insert the same data into both columns
    await dbService.query(
      `INSERT INTO json_operators (data_json, data_jsonb) 
       VALUES ($1::json, $1::jsonb)`,
      [JSON.stringify(sampleData)]
    );
    console.log("Inserted sample data into both columns");

    console.log(
      "\n----- ERROR DEMONSTRATION: JSONB-SPECIFIC OPERATORS WITH JSON -----"
    );
    console.log(
      "Attempting to use JSONB operators on both JSON and JSONB columns...\n"
    );

    // 1. Containment operator (@>)
    console.log("1. Testing containment operator (@>):");
    try {
      await dbService.query(`
        SELECT * FROM json_operators 
        WHERE data_json @> '{"preferences": {"theme": "dark"}}'::jsonb;
      `);
    } catch (error: any) {
      console.log("JSON column error:", error.message);
    }

    const jsonbResult = await dbService.query(`
      SELECT * FROM json_operators 
      WHERE data_jsonb @> '{"preferences": {"theme": "dark"}}'::jsonb;
    `);
    console.log(
      "JSONB column success:",
      jsonbResult.rows.length > 0 ? "Match found" : "No match"
    );

    // 2. Existence operator (?)
    console.log("\n2. Testing existence operator (?):");
    try {
      await dbService.query(`
        SELECT * FROM json_operators 
        WHERE data_json ? 'name';
      `);
    } catch (error: any) {
      console.log("JSON column error:", error.message);
    }

    const jsonbExistsResult = await dbService.query(`
      SELECT * FROM json_operators 
      WHERE data_jsonb ? 'name';
    `);
    console.log(
      "JSONB column success:",
      jsonbExistsResult.rows.length > 0 ? "Key exists" : "Key not found"
    );

    // 3. Path exists operator (?|)
    console.log("\n3. Testing path exists operator (?|):");
    try {
      await dbService.query(`
        SELECT * FROM json_operators 
        WHERE data_json ?| array['name', 'age'];
      `);
    } catch (error: any) {
      console.log("JSON column error:", error.message);
      console.log(
        "  This error is expected because the ?| operator is JSONB-specific and cannot be used with JSON columns."
      );
      console.log(
        "  The error demonstrates a key difference between JSON and JSONB in PostgreSQL."
      );
    }

    const jsonbPathResult = await dbService.query(`
      SELECT * FROM json_operators 
      WHERE data_jsonb ?| array['name', 'age'];
    `);
    console.log(
      "JSONB column success:",
      jsonbPathResult.rows.length > 0 ? "Paths exist" : "Paths not found"
    );

    console.log("\nSummary of JSONB vs JSON Operator Support:");
    console.log("✓ JSONB supports special operators like @>, ?, ?|, etc.");
    console.log("✗ JSON does not support these operators");
    console.log(
      "✗ Attempting to use JSONB operators with JSON will raise an error"
    );
    console.log(
      "\nRecommendation: Use JSONB when you need to use these powerful operators for querying JSON data."
    );
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await dbService.close();
  }
}

main();
