/* eslint-disable no-console */
import { createClient } from "../src/client";
import {
  addSpanAnnotation,
  addSpanNote,
  getSpanAnnotations,
  getSpans,
  logSpanAnnotations,
} from "../src/spans";

/**
 * Example: add notes and annotations to a span, then read them back
 */
async function main() {
  const client = createClient({
    options: {
      baseUrl: "http://localhost:6006",
    },
  });

  try {
    const { spans } = await getSpans({
      client,
      project: { projectName: "default" },
      limit: 1,
    });

    const span = spans[0];
    if (!span) {
      console.log(
        "No spans found. Create a trace first, then rerun this example."
      );
      return;
    }

    const spanId = span.context.span_id;

    await addSpanNote({
      client,
      spanNote: {
        spanId,
        note: "Reviewed by the Phoenix TypeScript example",
      },
    });

    await addSpanAnnotation({
      client,
      sync: true,
      spanAnnotation: {
        spanId,
        name: "quality-score",
        annotatorKind: "CODE",
        score: 1,
        label: "pass",
        explanation: "The span looks healthy.",
      },
    });

    await logSpanAnnotations({
      client,
      sync: true,
      spanAnnotations: [
        {
          spanId,
          name: "safety-check",
          annotatorKind: "CODE",
          score: 1,
          label: "clear",
        },
      ],
    });

    const annotations = await getSpanAnnotations({
      client,
      project: { projectName: "default" },
      spanIds: [spanId],
      includeAnnotationNames: ["quality-score", "safety-check", "note"],
    });

    console.log(JSON.stringify(annotations.annotations, null, 2));
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
