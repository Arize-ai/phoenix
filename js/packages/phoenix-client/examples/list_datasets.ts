import { createClient, Types } from "../src";

// baseUrl defaults to http://localhost:6006
const phoenix = createClient();

// Make GET request to /v1/datasets
// Available GET endpoints are available via auto-completion
// or by looking at Types["V1"]["paths"]
phoenix
  .GET("/v1/datasets", { params: { query: { limit: 100 } } })
  .then(({ data }) => data?.data ?? [])
  .then(listDatasets);

// Extract Dataset type from OpenAPI spec schema
type Dataset = Types["V1"]["components"]["schemas"]["Dataset"];

// Process each dataset, using TypeScript types
function listDatasets(datasets: Dataset[]) {
  datasets.forEach((dataset, index) => {
    // eslint-disable-next-line no-console
    console.log(`${index + 1}. ${dataset.name} (${dataset.id})`);
  });
}
