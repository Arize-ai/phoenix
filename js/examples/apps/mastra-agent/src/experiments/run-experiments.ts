
import { runExperiment } from "@arizeai/phoenix-client/experiments";
import { dataset } from "./configure-experiments";
import { task } from "./configure-experiments";
import { recommendationRelevanceEvaluator } from "./configure-experiments";

//Step 4: Run the experiment
await runExperiment({
    experimentName: "movie-rec-experiment",
    experimentDescription: "Evaluate the relevancy of movie recommendations from the agent",
    dataset: dataset,
    task: task,
    evaluators: [recommendationRelevanceEvaluator],
  });