
import { runExperiment } from "@arizeai/phoenix-client/experiments";
import { dataset } from "./configure-experiments";
import { task } from "./configure-experiments";
import { recommendationRelevanceEvaluator } from "./configure-experiments";

//Step 4: Run the experiment
await runExperiment({
    experimentName: "document-relevancy-experiment",
    experimentDescription: "Evaluate the relevancy of extracted context from the space knowledge base",
    dataset: dataset,
    task: task,
    evaluators: [recommendationRelevanceEvaluator],
  });