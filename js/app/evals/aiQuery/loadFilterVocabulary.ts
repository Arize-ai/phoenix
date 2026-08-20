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
          name: string;
          sessionFilterVocabulary?: readonly SessionFilterVocabularyTerm[];
          traceFilterVocabulary?: readonly TraceFilterVocabularyTerm[];
        };
      }>;
    };
  };
  errors?: ReadonlyArray<{ message: string }>;
};

const DEFAULT_PROJECT_NAME = "default";

const query = `
  query AIQueryEvalFilterVocabulary($filter: ProjectFilter) {
    projects(first: 10, filter: $filter) {
      edges {
        node {
          name
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
  const projectName =
    process.env.PHOENIX_EVAL_VOCABULARY_PROJECT ?? DEFAULT_PROJECT_NAME;
  const headers = new Headers({ "Content-Type": "application/json" });
  const apiKey = process.env.PHOENIX_API_KEY;
  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }
  const response = await fetch(new URL("/graphql", phoenixHost), {
    method: "POST",
    headers,
    body: JSON.stringify({
      query,
      variables: { filter: { col: "name", value: projectName } },
    }),
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
  // The server's project name filter is a substring match, so narrow to the
  // exact project client-side.
  const project = payload.data?.projects?.edges
    .map(({ node }) => node)
    .find(({ name }) => name === projectName);
  if (!project) {
    throw new Error(
      `AI query filter evals require a Phoenix project named "${projectName}" (set PHOENIX_EVAL_VOCABULARY_PROJECT to target a different one).`
    );
  }
  return {
    session: project.sessionFilterVocabulary ?? [],
    trace: project.traceFilterVocabulary ?? [],
  };
}
