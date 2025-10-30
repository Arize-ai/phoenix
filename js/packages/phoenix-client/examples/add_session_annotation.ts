import { createClient } from "../src/client";
import { addSessionAnnotation, logSessionAnnotations } from "../src/sessions";

/**
 * Example of how to log session annotations
 */
async function main() {
  const client = createClient({
    options: {
      baseUrl: "http://localhost:6006",
    },
  });

  await addSessionAnnotation({
    client,
    sessionAnnotation: {
      sessionId: "ab5b6c07-f29e-44ec-94f3-5c418b47e288",
      name: "session-annotation",
      label: "annotation-value-1",
      score: 1,
      identifier: Math.random().toString(),
    },
  });

  await logSessionAnnotations({
    client,
    sessionAnnotations: [
      {
        sessionId: "ab5b6c07-f29e-44ec-94f3-5c418b47e288",
        name: "session-annotation",
        label: "annotation-value-2",
        score: 0,
        identifier: Math.random().toString(), // Makes the annotation distinct from above
      },
    ],
  });
}

main();
