import type { SessionFilterVocabularyTerm } from "@phoenix/pages/project/sessionFilterDSL";
import type { TraceFilterVocabularyTerm } from "@phoenix/pages/project/traceFilterDSL";

type FilterVocabulary = {
  session: readonly SessionFilterVocabularyTerm[];
  trace: readonly TraceFilterVocabularyTerm[];
};

type FilterVocabularyResponse = {
  data?: {
    projects?: {
      edges: ReadonlyArray<{
        node: {
          sessionFilterVocabulary?: readonly SessionFilterVocabularyTerm[];
          traceFilterVocabulary?: readonly TraceFilterVocabularyTerm[];
        };
      }>;
    };
  };
  errors?: ReadonlyArray<{ message: string }>;
};

const query = `
  query AIQueryEvalFilterVocabulary {
    projects(first: 1) {
      edges {
        node {
          sessionFilterVocabulary {
            name
            type
            description
            category
            iterableName
          }
          traceFilterVocabulary {
            name
            type
            description
            category
            iterableName
          }
        }
      }
    }
  }
`;

let vocabularyPromise: Promise<FilterVocabulary> | undefined;

export function loadFilterVocabulary(): Promise<FilterVocabulary> {
  vocabularyPromise ??= fetchFilterVocabulary();
  return vocabularyPromise;
}

async function fetchFilterVocabulary(): Promise<FilterVocabulary> {
  const phoenixHost = process.env.PHOENIX_HOST ?? "http://localhost:6006";
  const headers = new Headers({ "Content-Type": "application/json" });
  const apiKey = process.env.PHOENIX_API_KEY;
  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }
  const response = await fetch(new URL("/graphql", phoenixHost), {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    throw new Error(
      `Could not load filter vocabulary from Phoenix: ${response.status} ${response.statusText}`
    );
  }
  const payload = (await response.json()) as FilterVocabularyResponse;
  if (payload.errors?.length) {
    throw new Error(
      `Could not load filter vocabulary from Phoenix: ${payload.errors.map(({ message }) => message).join("; ")}`
    );
  }
  const project = payload.data?.projects?.edges[0]?.node;
  if (!project) {
    throw new Error(
      "AI query filter evals require at least one project in Phoenix."
    );
  }
  return {
    session: project.sessionFilterVocabulary ?? [],
    trace: project.traceFilterVocabulary ?? [],
  };
}
