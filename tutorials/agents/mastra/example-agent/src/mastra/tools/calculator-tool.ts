import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const calculatorTool = createTool({
  id: "calculator",
  description:
    "Perform mathematical calculations including basic arithmetic, conversions, and advanced operations",
  inputSchema: z.object({
    expression: z
      .string()
      .describe(
        'Mathematical expression to evaluate (e.g., "2 + 3 * 4", "sqrt(16)", "celsius_to_fahrenheit(25)")',
      ),
  }),
  outputSchema: z.object({
    result: z.number(),
    expression: z.string(),
    explanation: z.string().optional(),
  }),
  execute: async ({ context }) => {
    return await calculate(context.expression);
  },
});

const calculate = async (expression: string) => {
  try {
    // Handle common unit conversions
    if (expression.includes("celsius_to_fahrenheit")) {
      const match = expression.match(/celsius_to_fahrenheit\(([^)]+)\)/);
      if (match) {
        const celsius = parseFloat(match[1]);
        const fahrenheit = (celsius * 9) / 5 + 32;
        return {
          result: fahrenheit,
          expression: expression,
          explanation: `${celsius}°C = ${fahrenheit}°F`,
        };
      }
    }

    if (expression.includes("fahrenheit_to_celsius")) {
      const match = expression.match(/fahrenheit_to_celsius\(([^)]+)\)/);
      if (match) {
        const fahrenheit = parseFloat(match[1]);
        const celsius = ((fahrenheit - 32) * 5) / 9;
        return {
          result: celsius,
          expression: expression,
          explanation: `${fahrenheit}°F = ${celsius.toFixed(1)}°C`,
        };
      }
    }

    if (expression.includes("mph_to_kmh")) {
      const match = expression.match(/mph_to_kmh\(([^)]+)\)/);
      if (match) {
        const mph = parseFloat(match[1]);
        const kmh = mph * 1.60934;
        return {
          result: kmh,
          expression: expression,
          explanation: `${mph} mph = ${kmh.toFixed(1)} km/h`,
        };
      }
    }

    if (expression.includes("kmh_to_mph")) {
      const match = expression.match(/kmh_to_mph\(([^)]+)\)/);
      if (match) {
        const kmh = parseFloat(match[1]);
        const mph = kmh / 1.60934;
        return {
          result: mph,
          expression: expression,
          explanation: `${kmh} km/h = ${mph.toFixed(1)} mph`,
        };
      }
    }

    // Handle basic math functions
    const sanitizedExpression = expression
      .replace(/\s+/g, "")
      .replace(/sqrt\(([^)]+)\)/g, "Math.sqrt($1)")
      .replace(/pow\(([^,]+),([^)]+)\)/g, "Math.pow($1,$2)")
      .replace(/abs\(([^)]+)\)/g, "Math.abs($1)")
      .replace(/round\(([^)]+)\)/g, "Math.round($1)")
      .replace(/floor\(([^)]+)\)/g, "Math.floor($1)")
      .replace(/ceil\(([^)]+)\)/g, "Math.ceil($1)")
      .replace(/sin\(([^)]+)\)/g, "Math.sin($1)")
      .replace(/cos\(([^)]+)\)/g, "Math.cos($1)")
      .replace(/tan\(([^)]+)\)/g, "Math.tan($1)")
      .replace(/log\(([^)]+)\)/g, "Math.log($1)")
      .replace(/pi/g, "Math.PI")
      .replace(/e/g, "Math.E");

    // Validate that the expression only contains safe characters and patterns
    // Fixed regex: must contain only safe math characters AND optionally Math functions
    const safeCharPattern = /^[0-9+\-*/.(),\s]*$/;
    const mathFunctionPattern = /^[0-9+\-*/.(),\s]*(?:Math\.[a-zA-Z]+\([^)]*\)[0-9+\-*/.(),\s]*)*$/;
    
    if (!safeCharPattern.test(sanitizedExpression.replace(/Math\.[a-zA-Z]+\([^)]*\)/g, '')) ||
        !mathFunctionPattern.test(sanitizedExpression)) {
      throw new Error("Invalid mathematical expression - contains unsafe characters");
    }

    // Additional validation: check for dangerous patterns
    const dangerousPatterns = [
      /constructor/i,
      /prototype/i,
      /__proto__/i,
      /eval/i,
      /function/i,
      /return/i,
      /import/i,
      /require/i,
      /process/i,
      /global/i,
      /window/i,
      /document/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(sanitizedExpression)) {
        throw new Error("Invalid mathematical expression - contains forbidden keywords");
      }
    }

    // Evaluate the expression safely using a more secure approach
    const result = Function(`"use strict"; return (${sanitizedExpression})`)();

    if (typeof result !== "number" || !isFinite(result)) {
      throw new Error("Result is not a valid number");
    }

    return {
      result: Math.round(result * 1000000) / 1000000, // Round to 6 decimal places
      expression: expression,
    };
  } catch (error) {
    throw new Error(
      `Calculation error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};
