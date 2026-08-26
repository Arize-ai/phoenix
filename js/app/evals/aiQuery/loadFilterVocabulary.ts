import type { SessionFilterVocabularyTerm } from "@phoenix/pages/project/sessionFilterDSL";
import type { TraceFilterVocabularyTerm } from "@phoenix/pages/project/traceFilterDSL";

type FilterVocabulary = {
  session: readonly SessionFilterVocabularyTerm[];
  trace: readonly TraceFilterVocabularyTerm[];
};

type FilterVocabularyResponse = {
  data?: {
    project?: {
      sessionFilterVocabulary?: readonly SessionFilterVocabularyTerm[];
      traceFilterVocabulary?: readonly TraceFilterVocabularyTerm[];
    } | null;
  };
  errors?: ReadonlyArray<{ message: string }>;
};

const DEFAULT_PROJECT_NAME = "default";

const query = `
  query AIQueryEvalFilterVocabulary($name: String!) {
    project: getProjectByName(name: $name) {
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
`;

let vocabularyPromise: Promise<FilterVocabulary> | undefined;

export function loadFilterVocabulary(): Promise<FilterVocabulary> {
  // A rejection is not cached: a transient fetch failure in one suite should
  // not doom every later suite in the same run to the stale error.
  vocabularyPromise ??= fetchFilterVocabulary().catch((error) => {
    vocabularyPromise = undefined;
    throw error;
  });
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
  // Appended rather than resolved with `new URL("/graphql", host)`, which
  // would drop the path prefix of a subpath-deployed Phoenix.
  const graphqlUrl = `${phoenixHost.replace(/\/+$/, "")}/graphql`;
  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables: { name: projectName } }),
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
  const project = payload.data?.project;
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
