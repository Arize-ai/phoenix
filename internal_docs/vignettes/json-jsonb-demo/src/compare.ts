/**
 * Key Order Comparison Demo: JSON vs JSONB
 *
 * This script demonstrates how JSON and JSONB differ in key ordering behavior:
 * - JSON preserves the exact order of keys as provided in the input
 * - JSONB stores keys in a sorted lexicographical order
 */
import dbService from "./services/db-service.js";

interface ComparisonResult {
  id: number;
  document_json: Record<string, number>;
  document_jsonb: Record<string, number>;
}

interface StorageInfo {
  json_size: number;
  jsonb_size: number;
}

/**
 * Generate a random uppercase string of specified length
 * @param {number} length - The length of the string to generate
 * @returns {string} A random uppercase string of the specified length
 */
function generateRandomUppercaseString(length: number): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Fisher-Yates shuffle algorithm to randomize the order of keys
 * This helps demonstrate the key ordering behavior in JSON vs JSONB
 */
function shuffle<T>(array: T[]): T[] {
  let currentIndex = array.length;
  let randomIndex;

  // While there remain elements to shuffle
  while (currentIndex != 0) {
    // Pick a remaining element
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

async function main(): Promise<void> {
  try {
    // Initialize the database service
    await dbService.initialize();

    // First, let's check if the table already exists and drop it to start fresh
    await dbService.query("DROP TABLE IF EXISTS json_comparison;");

    // Create a table with JSON and JSONB columns using descriptive names
    await dbService.query(`
      CREATE TABLE json_comparison (
                                     id SERIAL PRIMARY KEY,
                                     document_json JSON,
                                     document_jsonb JSONB
      );
    `);
    console.log(
      "Created table with document_json (JSON) and document_jsonb (JSONB) columns"
    );

    // Create keys with random uppercase characters of increasing lengths from 1 to 10
    const keys: string[] = [];
    for (let i = 1; i <= 10; i++) {
      keys.push(generateRandomUppercaseString(i));
    }

    // Shuffle the keys using Fisher-Yates algorithm
    const shuffledKeys = shuffle([...keys]);

    // Create the dictionary with shuffled keys
    // JavaScript objects maintain insertion order for non-numeric keys in modern JS engines
    const randomDict: Record<string, number> = {};
    for (const key of shuffledKeys) {
      randomDict[key] = key.length; // Value is the length of the key
    }

    // Log the original order of keys (before JSON stringification)
    console.log("Original key order after shuffle:", shuffledKeys);
    console.log("Original dictionary:", randomDict);

    // Convert the dictionary to a JSON string for database insertion
    // Note: We need to stringify since database drivers require JSON as string
    const jsonString = JSON.stringify(randomDict);
    console.log("JSON string to insert:", jsonString);

    // Insert the same data into both JSON and JSONB columns
    await dbService.query(
      `
      INSERT INTO json_comparison (document_json, document_jsonb)
      VALUES ($1, $2);
    `,
      [jsonString, jsonString]
    );
    console.log(
      "Data inserted into both document_json and document_jsonb columns"
    );

    // Query to get the data back from the database
    const result = await dbService.query<ComparisonResult>(
      "SELECT id, document_json, document_jsonb FROM json_comparison;"
    );

    // Print the document_json and document_jsonb values with proper JSON formatting
    if (result.rows && result.rows.length > 0) {
      // ---- JSON Output ----
      console.log("\ndocument_json (JSON):");
      console.log(JSON.stringify(result.rows[0].document_json, null, 2));

      // ---- JSONB Output ----
      console.log("\ndocument_jsonb (JSONB):");
      console.log(JSON.stringify(result.rows[0].document_jsonb, null, 2));

      // ---- Key Order Comparison ----
      // This clearly demonstrates one of the main differences between JSON and JSONB
      console.log("\nKey order comparison:");
      console.log("Original keys order:", shuffledKeys);
      console.log(
        "JSON keys order:",
        Object.keys(result.rows[0].document_json)
      );
      console.log(
        "JSONB keys order:",
        Object.keys(result.rows[0].document_jsonb)
      );

      // ---- Results Analysis ----
      console.log("\nAnalysis of Results:");

      // Check if JSON preserves the original order
      const jsonKeysOrder = Object.keys(result.rows[0].document_json);
      const jsonOrderMatches =
        JSON.stringify(jsonKeysOrder) === JSON.stringify(shuffledKeys);
      console.log(`1. JSON preserves original key order: ${jsonOrderMatches}`);

      // Check if JSONB sorts the keys
      const jsonbKeysOrder = Object.keys(result.rows[0].document_jsonb);
      const jsonbOrderDiffers =
        JSON.stringify(jsonbKeysOrder) !== JSON.stringify(shuffledKeys);
      console.log(
        `2. JSONB reorders keys (does not preserve original order): ${jsonbOrderDiffers}`
      );

      // Check if JSONB specifically sorts lexicographically
      const sortedKeys = [...shuffledKeys].sort();
      const jsonbLexicographical =
        JSON.stringify(jsonbKeysOrder) === JSON.stringify(sortedKeys);
      console.log(
        `3. JSONB sorts keys lexicographically: ${jsonbLexicographical}`
      );

      // Check storage size differences
      const storageInfo = await dbService.query<StorageInfo>(`
        SELECT
          pg_column_size(document_json) AS json_size,
          pg_column_size(document_jsonb) AS jsonb_size
        FROM json_comparison;
      `);

      if (storageInfo.rows && storageInfo.rows.length > 0) {
        console.log("\nStorage size comparison:");
        console.log(`JSON column size: ${storageInfo.rows[0].json_size} bytes`);
        console.log(
          `JSONB column size: ${storageInfo.rows[0].jsonb_size} bytes`
        );

        const sizeDiff =
          storageInfo.rows[0].json_size - storageInfo.rows[0].jsonb_size;
        if (sizeDiff > 0) {
          console.log(
            `JSONB uses ${sizeDiff} bytes less storage (${((sizeDiff / storageInfo.rows[0].json_size) * 100).toFixed(2)}% smaller)`
          );
        } else if (sizeDiff < 0) {
          console.log(
            `JSON uses ${-sizeDiff} bytes less storage (${((-sizeDiff / storageInfo.rows[0].jsonb_size) * 100).toFixed(2)}% smaller)`
          );
        } else {
          console.log("Both formats use the same amount of storage");
        }
      }

      console.log(`
When to use JSON vs JSONB:

- Use JSON when:
  * You need to preserve exact document format including whitespace and key order
  * The data is write-heavy with minimal querying
  * Input validation is more important than query performance

- Use JSONB when:
  * You need to query the JSON data frequently
  * You need indexing capabilities
  * You need better query performance
  * Storage space is a concern
  * Key order preservation is not required
`);
    } else {
      console.log("No results found or unexpected result structure");
    }

    // Close the database connection
    await dbService.close();
  } catch (error) {
    console.error("Error in comparison demo:", error);
    // Make sure to close the connection in case of error
    await dbService.close();
  }
}

// Run the main function
main();
