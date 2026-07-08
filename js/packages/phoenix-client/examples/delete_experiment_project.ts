/* eslint-disable no-console */
import { createClient } from "../src/client";
import { createDataset } from "../src/datasets/createDataset";
import { createExperiment } from "../src/experiments/createExperiment";
import { deleteExperiment } from "../src/experiments/deleteExperiment";

/**
 * Demonstrates the delete_project flag on experiment deletion.
 *
 * Run with:
 *   cd js/packages/phoenix-client
 *   npx tsx examples/delete_experiment_project.ts
 *
 * Optional env vars:
 *   PHOENIX_BASE_URL  (default: http://localhost:6006)
 *   PHOENIX_API_KEY
 */

async function listProjectNames(
  client: ReturnType<typeof createClient>
): Promise<string[]> {
  const resp = await client.GET("/v1/projects", {});
  if (resp.error)
    throw new Error(`Failed to list projects: ${JSON.stringify(resp.error)}`);
  return (resp.data?.data ?? []).map((p: { name: string }) => p.name);
}

async function main() {
  // createClient reads PHOENIX_BASE_URL and PHOENIX_API_KEY from the environment automatically
  const client = createClient();

  // --- Setup: one shared dataset for both experiments ---
  console.log("\nCreating dataset...");
  const { datasetId } = await createDataset({
    client,
    name: `delete-project-demo-${Date.now()}`,
    description: "Demo dataset for delete_project flag",
    examples: [{ input: { q: "hello" }, output: { a: "world" }, metadata: {} }],
  });
  console.log(`  dataset id: ${datasetId}`);

  // --- Case 1: delete WITHOUT deleteProject (default false) ---
  console.log("\n--- Case 1: delete experiment, keep project (default) ---");
  const exp1 = await createExperiment({ client, datasetId });
  const project1 = exp1.projectName;
  console.log(`  created experiment: ${exp1.id}`);
  console.log(`  project name: ${project1}`);

  // Before deletion: experiment projects are excluded from the projects list
  const before = await listProjectNames(client);
  console.log(
    `  project visible before deletion: ${before.includes(project1 ?? "")}`
  );

  await deleteExperiment({ client, experimentId: exp1.id });
  console.log("  experiment deleted (deleteProject not set)");

  // After deletion: orphaned project now appears in the projects list (the bug)
  const after1 = await listProjectNames(client);
  console.log(
    `  project visible after deletion:  ${after1.includes(project1 ?? "")} ← orphaned project appears`
  );

  // --- Case 2: delete WITH deleteProject: true ---
  console.log("\n--- Case 2: delete experiment AND project ---");
  const exp2 = await createExperiment({ client, datasetId });
  const project2 = exp2.projectName;
  console.log(`  created experiment: ${exp2.id}`);
  console.log(`  project name: ${project2}`);

  await deleteExperiment({
    client,
    experimentId: exp2.id,
    deleteProject: true,
  });
  console.log("  experiment deleted (deleteProject: true)");

  const after2 = await listProjectNames(client);
  console.log(
    `  project visible after deletion:  ${after2.includes(project2 ?? "")} ← project was also deleted`
  );

  // --- Cleanup ---
  console.log("\nCleaning up...");
  await client.DELETE("/v1/datasets/{id}", {
    params: { path: { id: datasetId } },
  });
  // Clean up the orphaned project left by Case 1
  if (project1) {
    await client.DELETE("/v1/projects/{project_identifier}", {
      params: { path: { project_identifier: project1 } },
    });
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
