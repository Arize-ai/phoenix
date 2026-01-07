/* eslint-disable no-console */
import { createDataset } from "@arizeai/phoenix-client/datasets";
import {
  asExperimentEvaluator,
  getExperiment,
  runExperiment,
} from "@arizeai/phoenix-client/experiments";
import type { ExperimentTask } from "@arizeai/phoenix-client/types/experiments";
import { createCorrectnessEvaluator } from "@arizeai/phoenix-evals";

import { openai } from "@ai-sdk/openai";

const correctnessEvaluator = createCorrectnessEvaluator({
  model: openai("gpt-4o-mini"),
});

// Examples designed to test the boundary conditions of the correctness rubric
const examples = [
  // === FACTUAL ACCURACY BOUNDARY ===
  {
    input: "What is the boiling point of water at sea level?",
    correct_answer:
      "The boiling point of water at sea level is 100 degrees Celsius (212 degrees Fahrenheit).",
    incorrect_answer:
      "The boiling point of water at sea level is around 100 degrees Celsius, give or take a few degrees depending on conditions.",
    category: "factual_accuracy",
  },
  {
    input: "How many planets are in our solar system?",
    correct_answer:
      "There are 8 planets in our solar system: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune.",
    incorrect_answer:
      "There are 9 planets in our solar system, including Pluto.",
    category: "factual_accuracy",
  },

  // === COMPLETENESS BOUNDARY ===
  {
    input:
      "What are the three branches of the United States government and their primary functions?",
    correct_answer:
      "The three branches are: 1) Legislative (Congress) - makes laws, 2) Executive (President) - enforces laws, and 3) Judicial (Supreme Court) - interprets laws.",
    incorrect_answer:
      "The three branches are the Legislative, Executive, and Judicial branches.",
    category: "completeness",
  },
  {
    input: "Explain the water cycle.",
    correct_answer:
      "The water cycle consists of evaporation (water turns to vapor), condensation (vapor forms clouds), precipitation (water falls as rain/snow), and collection (water gathers in bodies of water). This cycle repeats continuously.",
    incorrect_answer: "Water evaporates, forms clouds, and then rains down.",
    category: "completeness",
  },

  // === LOGICAL CONSISTENCY BOUNDARY ===
  {
    input: "Is a tomato a fruit or a vegetable?",
    correct_answer:
      "Botanically, a tomato is a fruit because it develops from the flower's ovary and contains seeds. However, it is commonly used as a vegetable in culinary contexts.",
    incorrect_answer:
      "A tomato is definitely a vegetable because it's used in salads, but scientifically it's also classified as a fruit, so it's both and neither at the same time.",
    category: "logical_consistency",
  },
  {
    input: "Can something be both hot and cold at the same time?",
    correct_answer:
      "An object cannot be both hot and cold at the same time in the same location. However, an object can have different temperatures in different regions, such as a metal rod heated at one end.",
    incorrect_answer:
      "Yes, something can be hot and cold simultaneously. For example, ice cream is cold but also hot because it contains calories which are a measure of heat energy.",
    category: "logical_consistency",
  },

  // === PRECISE TERMINOLOGY BOUNDARY ===
  {
    input: "What is the difference between mass and weight?",
    correct_answer:
      "Mass is the amount of matter in an object, measured in kilograms, and remains constant regardless of location. Weight is the gravitational force acting on that mass, measured in Newtons, and varies based on gravitational field strength.",
    incorrect_answer:
      "Mass and weight are basically the same thing - they both tell you how heavy something is. Mass is just the scientific word for weight.",
    category: "precise_terminology",
  },
  {
    input: "What is the difference between weather and climate?",
    correct_answer:
      "Weather refers to short-term atmospheric conditions (temperature, precipitation, wind) at a specific time and place. Climate is the average of weather patterns over a long period (typically 30+ years) in a region.",
    incorrect_answer:
      "Weather is what happens outside day-to-day, while climate is kind of like the overall mood of the weather in general.",
    category: "precise_terminology",
  },

  // === MISLEADING STATEMENTS BOUNDARY ===
  {
    input: "Is sugar addictive?",
    correct_answer:
      "While sugar can trigger reward pathways in the brain similar to some addictive substances, the scientific consensus does not classify sugar as addictive in the same way as drugs. Excessive sugar consumption can lead to cravings and health issues, but this is different from clinical addiction.",
    incorrect_answer:
      "Sugar is highly addictive - studies show it's more addictive than cocaine and causes the same brain changes as hard drugs.",
    category: "misleading",
  },
  {
    input: "Do humans only use 10% of their brain?",
    correct_answer:
      "No, this is a myth. Neuroimaging studies show that humans use virtually all parts of their brain, and most of the brain is active almost all the time. Different regions are responsible for different functions.",
    incorrect_answer:
      "While we use most of our brain for basic functions, the 10% myth has some truth - we only consciously access about 10% of our brain's potential at any given moment.",
    category: "misleading",
  },

  // === MISSING KEY INFORMATION BOUNDARY ===
  {
    input: "How does a vaccine work?",
    correct_answer:
      "A vaccine works by introducing a weakened, killed, or partial form of a pathogen (or instructions to make it) into the body. This trains the immune system to recognize and produce antibodies against the pathogen without causing the disease, providing immunity for future exposure.",
    incorrect_answer:
      "Vaccines help your body fight diseases by making it stronger.",
    category: "missing_key_info",
  },
  {
    input: "Why do we have seasons?",
    correct_answer:
      "Seasons occur because Earth's axis is tilted at about 23.5 degrees relative to its orbital plane around the Sun. This tilt causes different parts of Earth to receive varying amounts of direct sunlight throughout the year, creating seasonal temperature and daylight variations.",
    incorrect_answer:
      "We have seasons because the Earth orbits the Sun once a year.",
    category: "missing_key_info",
  },

  // === AMBIGUOUS LANGUAGE BOUNDARY ===
  {
    input: "What causes inflation?",
    correct_answer:
      "Inflation is caused by multiple factors including: increased money supply, demand-pull (demand exceeds supply), cost-push (rising production costs), and built-in expectations. Central banks monitor these factors and use monetary policy tools like interest rates to control inflation.",
    incorrect_answer:
      "Inflation happens when things cost more. It's usually caused by various economic factors and stuff happening in the market.",
    category: "ambiguous_language",
  },
  {
    input: "What is machine learning?",
    correct_answer:
      "Machine learning is a subset of artificial intelligence where computer systems learn patterns from data and improve their performance on specific tasks without being explicitly programmed. It uses algorithms to build mathematical models from training data to make predictions or decisions.",
    incorrect_answer:
      "Machine learning is when computers learn things on their own, kind of like how humans learn but with data and algorithms and stuff.",
    category: "ambiguous_language",
  },

  // === EDGE CASES: PARTIALLY CORRECT ===
  {
    input: "What is the speed of sound?",
    correct_answer:
      "The speed of sound varies by medium: approximately 343 meters per second (767 mph) in dry air at 20°C. It travels faster in liquids (~1,480 m/s in water) and solids (~5,120 m/s in steel).",
    incorrect_answer: "The speed of sound is about 343 meters per second.",
    category: "partial_correctness",
  },
  {
    input: "What is DNA?",
    correct_answer:
      "DNA (deoxyribonucleic acid) is a double-helix molecule that carries the genetic instructions for the development, functioning, growth, and reproduction of all known organisms. It consists of nucleotides containing four bases: adenine, thymine, guanine, and cytosine.",
    incorrect_answer:
      "DNA is the genetic material found in cells that determines hereditary traits.",
    category: "partial_correctness",
  },

  // === NUANCED ACCURACY ===
  {
    input: "Is glass a liquid or a solid?",
    correct_answer:
      "Glass is an amorphous solid, not a liquid. While glass lacks the crystalline structure of typical solids, it does not flow at room temperature. The myth that old windows are thicker at the bottom due to flowing glass is false - this was due to historical manufacturing techniques.",
    incorrect_answer:
      "Glass is technically a very slow-moving liquid. That's why old church windows are thicker at the bottom - the glass has flowed downward over centuries.",
    category: "nuanced_accuracy",
  },
  {
    input: "Do we lose most body heat through our head?",
    correct_answer:
      "No, we do not lose a disproportionate amount of heat through our head. Heat loss is proportional to exposed surface area. The head represents about 10% of body surface and loses about 10% of body heat. This myth likely originated from military studies where subjects wore insulated suits but not hats.",
    incorrect_answer:
      "Yes, we lose about 40-50% of our body heat through our head, which is why wearing a hat in cold weather is so important.",
    category: "nuanced_accuracy",
  },

  // === TECHNICAL PRECISION ===
  {
    input:
      "What is the difference between accuracy and precision in measurements?",
    correct_answer:
      "Accuracy refers to how close a measured value is to the true or accepted value. Precision refers to how close repeated measurements are to each other, regardless of whether they are correct. A measurement can be precise but not accurate, accurate but not precise, both, or neither.",
    incorrect_answer:
      "Accuracy and precision mean essentially the same thing - how correct your measurements are.",
    category: "technical_precision",
  },
];

type TaskOutput = {
  expected_label: "correct" | "incorrect";
  label: "correct" | "incorrect";
  score: number;
  explanation: string;
  category: string;
};

const accuracyEvaluator = asExperimentEvaluator({
  name: "accuracy",
  kind: "CODE",
  evaluate: async (args) => {
    const output = args.output as TaskOutput;
    const score = output.expected_label === output.label ? 1 : 0;
    const label =
      output.expected_label === output.label ? "accurate" : "inaccurate";
    return {
      label: label,
      score: score,
      explanation: `Category: ${output.category}. The evaluator labeled the answer as "${output.label}". Expected: "${output.expected_label}"`,
      metadata: { category: output.category },
    };
  },
});

async function main() {
  const dataset = await createDataset({
    name: "correctness-rubric-boundary-test-" + Date.now(),
    description:
      "Benchmark testing boundary conditions of the correctness evaluator rubric: factual accuracy, completeness, logical consistency, precise terminology, misleading statements, missing info, and ambiguity",
    examples: examples.map((example) => ({
      input: { question: example.input },
      output: {
        correct_answer: example.correct_answer,
        incorrect_answer: example.incorrect_answer,
      },
      metadata: { category: example.category },
      splits: [example.category], // Add category as a dataset split
    })),
  });

  const task: ExperimentTask = async (example) => {
    const useIncorrect = Math.random() < 0.5; // 50% chance to use incorrect answer
    const answer = useIncorrect
      ? example.output?.incorrect_answer
      : example.output?.correct_answer;

    const evalResult = await correctnessEvaluator.evaluate({
      input: example.input.question as string,
      output: answer as string,
    });

    return {
      expected_label: useIncorrect ? "incorrect" : "correct",
      category: example.metadata?.category,
      ...evalResult,
    };
  };

  const experiment = await runExperiment({
    experimentName: "correctness-rubric-boundary-test",
    experimentDescription:
      "Testing the correctness evaluator against rubric boundary conditions",
    concurrency: 8,
    dataset: dataset,
    task,
    evaluators: [accuracyEvaluator],
  });

  // Fetch full experiment details including runs
  const experimentResult = await getExperiment({
    experimentId: experiment.id,
  });

  // Print experiment summary
  console.log("\n" + "=".repeat(60));
  console.log("EXPERIMENT RESULTS SUMMARY");
  console.log("=".repeat(60));
  console.log(`Experiment ID: ${experimentResult.id}`);
  console.log(`Dataset ID: ${experimentResult.datasetId}`);
  console.log(`Total Examples: ${experimentResult.exampleCount}`);
  console.log(`Successful Runs: ${experimentResult.successfulRunCount}`);
  console.log(`Failed Runs: ${experimentResult.failedRunCount}`);
  console.log(`Missing Runs: ${experimentResult.missingRunCount}`);

  // Analyze runs by category
  const runsByCategory: Record<
    string,
    { correct: number; incorrect: number; errors: number }
  > = {};

  for (const run of Object.values(experimentResult.runs)) {
    const output = run.output as TaskOutput | null;
    const category = output?.category || "unknown";

    if (!runsByCategory[category]) {
      runsByCategory[category] = { correct: 0, incorrect: 0, errors: 0 };
    }

    if (run.error) {
      runsByCategory[category].errors++;
    } else if (output?.expected_label === output?.label) {
      runsByCategory[category].correct++;
    } else {
      runsByCategory[category].incorrect++;
    }
  }

  console.log("\n" + "-".repeat(60));
  console.log("ACCURACY BY CATEGORY");
  console.log("-".repeat(60));

  let totalCorrect = 0;
  let totalIncorrect = 0;
  let totalErrors = 0;

  for (const [category, stats] of Object.entries(runsByCategory).sort()) {
    const total = stats.correct + stats.incorrect + stats.errors;
    const accuracy =
      total > 0 ? ((stats.correct / total) * 100).toFixed(1) : "N/A";
    console.log(
      `  ${category.padEnd(25)} | Accuracy: ${accuracy}% (${stats.correct}/${total}) | Errors: ${stats.errors}`
    );
    totalCorrect += stats.correct;
    totalIncorrect += stats.incorrect;
    totalErrors += stats.errors;
  }

  const overallTotal = totalCorrect + totalIncorrect + totalErrors;
  const overallAccuracy =
    overallTotal > 0 ? ((totalCorrect / overallTotal) * 100).toFixed(1) : "N/A";

  console.log("-".repeat(60));
  console.log(
    `  ${"OVERALL".padEnd(25)} | Accuracy: ${overallAccuracy}% (${totalCorrect}/${overallTotal}) | Errors: ${totalErrors}`
  );
  console.log("=".repeat(60) + "\n");
}

main();
