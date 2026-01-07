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
// Each category has exactly 4 examples for even benchmarking
const examplesByCategory = {
  // === FACTUAL ACCURACY ===
  factual_accuracy: [
    {
      input: "What is the boiling point of water at sea level?",
      correct_answer:
        "The boiling point of water at sea level is 100 degrees Celsius (212 degrees Fahrenheit).",
      incorrect_answer:
        "The boiling point of water at sea level is around 100 degrees Celsius, give or take a few degrees depending on conditions.",
    },
    {
      input: "How many planets are in our solar system?",
      correct_answer:
        "There are 8 planets in our solar system: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune.",
      incorrect_answer:
        "There are 9 planets in our solar system, including Pluto.",
    },
    {
      input: "What is the chemical formula for water?",
      correct_answer:
        "The chemical formula for water is H₂O, meaning each molecule consists of two hydrogen atoms bonded to one oxygen atom.",
      incorrect_answer:
        "The chemical formula for water is H₂O₂, which represents two hydrogen and two oxygen atoms.",
    },
    {
      input: "Who wrote Romeo and Juliet?",
      correct_answer:
        "Romeo and Juliet was written by William Shakespeare, first published in 1597.",
      incorrect_answer:
        "Romeo and Juliet was written by Christopher Marlowe, Shakespeare's contemporary.",
    },
  ],

  // === COMPLETENESS ===
  completeness: [
    {
      input:
        "What are the three branches of the United States government and their primary functions?",
      correct_answer:
        "The three branches are: 1) Legislative (Congress) - makes laws, 2) Executive (President) - enforces laws, and 3) Judicial (Supreme Court) - interprets laws.",
      incorrect_answer:
        "The three branches are the Legislative, Executive, and Judicial branches.",
    },
    {
      input: "Explain the water cycle.",
      correct_answer:
        "The water cycle consists of evaporation (water turns to vapor), condensation (vapor forms clouds), precipitation (water falls as rain/snow), and collection (water gathers in bodies of water). This cycle repeats continuously.",
      incorrect_answer: "Water evaporates, forms clouds, and then rains down.",
    },
    {
      input: "What are the primary colors and why are they called primary?",
      correct_answer:
        "The primary colors are red, blue, and yellow (in traditional color theory) or red, green, and blue (in light/additive color). They are called primary because they cannot be created by mixing other colors, and all other colors can be derived from combinations of these.",
      incorrect_answer: "The primary colors are red, blue, and yellow.",
    },
    {
      input: "What is photosynthesis?",
      correct_answer:
        "Photosynthesis is the process by which plants, algae, and some bacteria convert light energy (usually from the sun), carbon dioxide from the air, and water into glucose and oxygen. This occurs in chloroplasts using chlorophyll, the green pigment that captures light energy.",
      incorrect_answer:
        "Photosynthesis is how plants make food using sunlight.",
    },
  ],

  // === LOGICAL CONSISTENCY ===
  logical_consistency: [
    {
      input: "Is a tomato a fruit or a vegetable?",
      correct_answer:
        "Botanically, a tomato is a fruit because it develops from the flower's ovary and contains seeds. However, it is commonly used as a vegetable in culinary contexts.",
      incorrect_answer:
        "A tomato is definitely a vegetable because it's used in salads, but scientifically it's also classified as a fruit, so it's both and neither at the same time.",
    },
    {
      input: "Can something be both hot and cold at the same time?",
      correct_answer:
        "An object cannot be both hot and cold at the same time in the same location. However, an object can have different temperatures in different regions, such as a metal rod heated at one end.",
      incorrect_answer:
        "Yes, something can be hot and cold simultaneously. For example, ice cream is cold but also hot because it contains calories which are a measure of heat energy.",
    },
    {
      input: "If all birds can fly, and penguins are birds, can penguins fly?",
      correct_answer:
        "The premise is flawed - not all birds can fly. Penguins are flightless birds that have evolved flippers for swimming instead of wings for flying. Other flightless birds include ostriches, emus, and kiwis.",
      incorrect_answer:
        "Yes, penguins can fly because all birds can fly. They just choose not to because they prefer swimming.",
    },
    {
      input: "Is zero an even or odd number?",
      correct_answer:
        "Zero is an even number. By definition, an even number is any integer that is divisible by 2 with no remainder. Since 0 ÷ 2 = 0 with no remainder, zero is even.",
      incorrect_answer:
        "Zero is neither even nor odd because it's nothing - it doesn't have any value to be divided.",
    },
  ],

  // === PRECISE TERMINOLOGY ===
  precise_terminology: [
    {
      input: "What is the difference between mass and weight?",
      correct_answer:
        "Mass is the amount of matter in an object, measured in kilograms, and remains constant regardless of location. Weight is the gravitational force acting on that mass, measured in Newtons, and varies based on gravitational field strength.",
      incorrect_answer:
        "Mass and weight are basically the same thing - they both tell you how heavy something is. Mass is just the scientific word for weight.",
    },
    {
      input: "What is the difference between weather and climate?",
      correct_answer:
        "Weather refers to short-term atmospheric conditions (temperature, precipitation, wind) at a specific time and place. Climate is the average of weather patterns over a long period (typically 30+ years) in a region.",
      incorrect_answer:
        "Weather is what happens outside day-to-day, while climate is kind of like the overall mood of the weather in general.",
    },
    {
      input: "What is the difference between a virus and bacteria?",
      correct_answer:
        "Bacteria are single-celled living organisms that can reproduce independently and are treated with antibiotics. Viruses are non-living particles containing genetic material that require a host cell to replicate and are treated with antivirals, not antibiotics.",
      incorrect_answer:
        "Viruses and bacteria are both tiny germs that make you sick. Viruses are just smaller versions of bacteria.",
    },
    {
      input: "What is the difference between velocity and speed?",
      correct_answer:
        "Speed is a scalar quantity measuring how fast an object moves (distance/time), without regard to direction. Velocity is a vector quantity that includes both the speed and the direction of motion. An object can have constant speed but changing velocity if its direction changes.",
      incorrect_answer:
        "Velocity and speed are the same thing - they both measure how fast something is moving.",
    },
  ],

  // === MISLEADING STATEMENTS ===
  misleading: [
    {
      input: "Is sugar addictive?",
      correct_answer:
        "While sugar can trigger reward pathways in the brain similar to some addictive substances, the scientific consensus does not classify sugar as addictive in the same way as drugs. Excessive sugar consumption can lead to cravings and health issues, but this is different from clinical addiction.",
      incorrect_answer:
        "Sugar is highly addictive - studies show it's more addictive than cocaine and causes the same brain changes as hard drugs.",
    },
    {
      input: "Do humans only use 10% of their brain?",
      correct_answer:
        "No, this is a myth. Neuroimaging studies show that humans use virtually all parts of their brain, and most of the brain is active almost all the time. Different regions are responsible for different functions.",
      incorrect_answer:
        "While we use most of our brain for basic functions, the 10% myth has some truth - we only consciously access about 10% of our brain's potential at any given moment.",
    },
    {
      input: "Does cracking your knuckles cause arthritis?",
      correct_answer:
        "No, cracking your knuckles does not cause arthritis. The sound comes from gas bubbles collapsing in the synovial fluid. Multiple studies, including a 60-year self-experiment by a doctor, have found no link between knuckle cracking and arthritis.",
      incorrect_answer:
        "Yes, cracking your knuckles damages the cartilage over time and significantly increases your risk of developing arthritis later in life.",
    },
    {
      input: "Do carrots improve your eyesight?",
      correct_answer:
        "Carrots contain vitamin A, which is essential for eye health, but eating carrots won't improve vision beyond normal levels. The myth originated from WWII British propaganda to hide their use of radar technology. Severe vitamin A deficiency can cause vision problems, but excess vitamin A doesn't enhance vision.",
      incorrect_answer:
        "Yes, eating carrots significantly improves your eyesight and can help you see better in the dark. That's why rabbits have such good vision.",
    },
  ],

  // === MISSING KEY INFORMATION ===
  missing_key_info: [
    {
      input: "How does a vaccine work?",
      correct_answer:
        "A vaccine works by introducing a weakened, killed, or partial form of a pathogen (or instructions to make it) into the body. This trains the immune system to recognize and produce antibodies against the pathogen without causing the disease, providing immunity for future exposure.",
      incorrect_answer:
        "Vaccines help your body fight diseases by making it stronger.",
    },
    {
      input: "Why do we have seasons?",
      correct_answer:
        "Seasons occur because Earth's axis is tilted at about 23.5 degrees relative to its orbital plane around the Sun. This tilt causes different parts of Earth to receive varying amounts of direct sunlight throughout the year, creating seasonal temperature and daylight variations.",
      incorrect_answer:
        "We have seasons because the Earth orbits the Sun once a year.",
    },
    {
      input: "How do airplanes fly?",
      correct_answer:
        "Airplanes fly due to the interaction of four forces: lift (generated by air flowing over curved wings, creating lower pressure above), weight (gravity pulling down), thrust (from engines pushing forward), and drag (air resistance). When lift exceeds weight and thrust exceeds drag, the plane can fly.",
      incorrect_answer:
        "Airplanes fly because their engines push them forward.",
    },
    {
      input: "What causes thunder?",
      correct_answer:
        "Thunder is caused by lightning. When lightning strikes, it superheats the air to about 30,000 Kelvin in a fraction of a second. This rapid heating causes the air to expand explosively, creating a shockwave that we hear as thunder. The rolling sound occurs because sound from different parts of the lightning bolt reaches us at different times.",
      incorrect_answer:
        "Thunder is the sound of clouds bumping into each other.",
    },
  ],

  // === AMBIGUOUS LANGUAGE ===
  ambiguous_language: [
    {
      input: "What causes inflation?",
      correct_answer:
        "Inflation is caused by multiple factors including: increased money supply, demand-pull (demand exceeds supply), cost-push (rising production costs), and built-in expectations. Central banks monitor these factors and use monetary policy tools like interest rates to control inflation.",
      incorrect_answer:
        "Inflation happens when things cost more. It's usually caused by various economic factors and stuff happening in the market.",
    },
    {
      input: "What is machine learning?",
      correct_answer:
        "Machine learning is a subset of artificial intelligence where computer systems learn patterns from data and improve their performance on specific tasks without being explicitly programmed. It uses algorithms to build mathematical models from training data to make predictions or decisions.",
      incorrect_answer:
        "Machine learning is when computers learn things on their own, kind of like how humans learn but with data and algorithms and stuff.",
    },
    {
      input: "How does encryption work?",
      correct_answer:
        "Encryption transforms readable data (plaintext) into an unreadable format (ciphertext) using mathematical algorithms and keys. Symmetric encryption uses the same key for encryption and decryption, while asymmetric encryption uses a public key to encrypt and a private key to decrypt. Only those with the correct key can decrypt and read the data.",
      incorrect_answer:
        "Encryption scrambles your data so hackers can't read it. It uses some math stuff to make things secure.",
    },
    {
      input: "What is blockchain technology?",
      correct_answer:
        "Blockchain is a distributed ledger technology where data is stored in blocks that are cryptographically linked in chronological order. Each block contains a hash of the previous block, transaction data, and a timestamp. This structure makes it tamper-resistant because altering any block would invalidate all subsequent blocks. Consensus mechanisms validate new blocks across the network.",
      incorrect_answer:
        "Blockchain is the technology behind Bitcoin. It's basically a really secure way of storing data online that can't be hacked.",
    },
  ],

  // === PARTIAL CORRECTNESS ===
  partial_correctness: [
    {
      input: "What is the speed of sound?",
      correct_answer:
        "The speed of sound varies by medium: approximately 343 meters per second (767 mph) in dry air at 20°C. It travels faster in liquids (~1,480 m/s in water) and solids (~5,120 m/s in steel).",
      incorrect_answer: "The speed of sound is about 343 meters per second.",
    },
    {
      input: "What is DNA?",
      correct_answer:
        "DNA (deoxyribonucleic acid) is a double-helix molecule that carries the genetic instructions for the development, functioning, growth, and reproduction of all known organisms. It consists of nucleotides containing four bases: adenine, thymine, guanine, and cytosine.",
      incorrect_answer: "DNA is the genetic material",
    },
    {
      input: "What is the Great Wall of China?",
      correct_answer:
        "The Great Wall of China is a series of fortifications built across northern China over many centuries, starting in the 7th century BC, with most of the current wall built during the Ming Dynasty (1368-1644). It stretches over 13,000 miles and was built to protect against invasions. Contrary to popular belief, it is not visible from space with the naked eye.",
      incorrect_answer: "It is a ancient wall",
    },
    {
      input: "What causes tides?",
      correct_answer:
        "Tides are caused primarily by the gravitational pull of the Moon on Earth's oceans, with the Sun also contributing about 46% as much tidal force. The Moon's gravity creates a bulge of water on the side of Earth closest to it, and inertia creates a corresponding bulge on the opposite side, resulting in two high tides per day.",
      incorrect_answer:
        "Tides are caused by the Moon's gravity pulling on water.",
    },
  ],

  // === NUANCED ACCURACY ===
  nuanced_accuracy: [
    {
      input: "Is glass a liquid or a solid?",
      correct_answer:
        "Glass is an amorphous solid, not a liquid. While glass lacks the crystalline structure of typical solids, it does not flow at room temperature. The myth that old windows are thicker at the bottom due to flowing glass is false - this was due to historical manufacturing techniques.",
      incorrect_answer:
        "Glass is technically a very slow-moving liquid. That's why old church windows are thicker at the bottom - the glass has flowed downward over centuries.",
    },
    {
      input: "Do we lose most body heat through our head?",
      correct_answer:
        "No, we do not lose a disproportionate amount of heat through our head. Heat loss is proportional to exposed surface area. The head represents about 10% of body surface and loses about 10% of body heat. This myth likely originated from military studies where subjects wore insulated suits but not hats.",
      incorrect_answer:
        "Yes, we lose about 40-50% of our body heat through our head, which is why wearing a hat in cold weather is so important.",
    },
    {
      input: "Is a brontosaurus a real dinosaur?",
      correct_answer:
        "The Brontosaurus was once considered the same species as Apatosaurus and was removed as a separate genus in 1903. However, a 2015 scientific study analyzed more specimens and concluded that Brontosaurus is indeed a distinct genus, officially reinstating it as a valid dinosaur name.",
      incorrect_answer:
        "No, the Brontosaurus never existed. Scientists made a mistake and it was actually an Apatosaurus all along.",
    },
    {
      input: "Is Pluto a planet?",
      correct_answer:
        "Pluto was reclassified as a 'dwarf planet' by the International Astronomical Union in 2006 because it hasn't cleared its orbital neighborhood of other debris. While it orbits the Sun and is spherical due to its own gravity, it doesn't meet all three criteria for a full planet. Some scientists still debate this classification.",
      incorrect_answer:
        "No, Pluto is not and never was a planet. It's just a small rock in the Kuiper Belt.",
    },
  ],

  // === TECHNICAL PRECISION ===
  technical_precision: [
    {
      input:
        "What is the difference between accuracy and precision in measurements?",
      correct_answer:
        "Accuracy refers to how close a measured value is to the true or accepted value. Precision refers to how close repeated measurements are to each other, regardless of whether they are correct. A measurement can be precise but not accurate, accurate but not precise, both, or neither.",
      incorrect_answer:
        "Accuracy and precision mean essentially the same thing - how correct your measurements are.",
    },
    {
      input: "What is the difference between RAM and storage?",
      correct_answer:
        "RAM (Random Access Memory) is volatile, high-speed memory used for temporary data storage while programs are running - it's cleared when power is lost. Storage (HDD/SSD) is non-volatile, slower memory for permanent data storage that persists without power. RAM is measured in gigabytes (8-64GB typical), while storage is measured in hundreds of gigabytes to terabytes.",
      incorrect_answer:
        "RAM and storage are both types of memory in your computer. RAM is just faster storage.",
    },
    {
      input: "What is the difference between HTTP and HTTPS?",
      correct_answer:
        "HTTP (Hypertext Transfer Protocol) transmits data in plain text, making it vulnerable to interception. HTTPS (HTTP Secure) encrypts data using TLS/SSL protocols, providing authentication of the website and protection of data privacy and integrity during transmission. HTTPS is identified by a padlock icon in browsers.",
      incorrect_answer:
        "HTTPS is just the secure version of HTTP. The 'S' stands for secure and means the website is safe to use.",
    },
    {
      input: "What is the difference between a compiler and an interpreter?",
      correct_answer:
        "A compiler translates entire source code into machine code before execution, creating an executable file that runs independently. An interpreter translates and executes code line by line at runtime, without creating a separate executable. Compiled programs typically run faster, while interpreted programs are more portable and easier to debug.",
      incorrect_answer:
        "Compilers and interpreters both run your code. Compilers are for languages like C++ and interpreters are for languages like Python.",
    },
  ],
};

// Flatten examples with category information
const examples = Object.entries(examplesByCategory).flatMap(
  ([category, categoryExamples]) =>
    categoryExamples.map((example) => ({
      ...example,
      category,
    }))
);

// Create dataset entries with deterministic correct/incorrect split
// For each example, we create TWO entries: one with correct answer, one with incorrect
const datasetExamples = examples.flatMap((example, index) => [
  {
    input: { question: example.input },
    output: {
      answer: example.correct_answer,
      expected_label: "correct" as const,
    },
    metadata: {
      category: example.category,
      variant: "correct",
      example_index: index,
    },
    splits: [example.category, "correct_answer"],
  },
  {
    input: { question: example.input },
    output: {
      answer: example.incorrect_answer,
      expected_label: "incorrect" as const,
    },
    metadata: {
      category: example.category,
      variant: "incorrect",
      example_index: index,
    },
    splits: [example.category, "incorrect_answer"],
  },
]);

type TaskOutput = {
  expected_label: "correct" | "incorrect";
  label: "correct" | "incorrect";
  score: number;
  explanation: string;
  category: string;
  variant: string;
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
      explanation: `Category: ${output.category}, Variant: ${output.variant}. The evaluator labeled the answer as "${output.label}". Expected: "${output.expected_label}"`,
      metadata: { category: output.category, variant: output.variant },
    };
  },
});

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("BENCHMARK CONFIGURATION");
  console.log("=".repeat(60));
  console.log(`Categories: ${Object.keys(examplesByCategory).length}`);
  console.log(
    `Examples per category: ${Object.values(examplesByCategory)[0]?.length ?? 0}`
  );
  console.log(`Total base examples: ${examples.length}`);
  console.log(
    `Total dataset entries (2 per example): ${datasetExamples.length}`
  );
  console.log(
    `Split: 50% correct answers, 50% incorrect answers (deterministic)`
  );
  console.log("=".repeat(60) + "\n");

  const dataset = await createDataset({
    name: "correctness-rubric-boundary-test-" + Date.now(),
    description:
      "Benchmark testing boundary conditions of the correctness evaluator rubric with deterministic 50/50 correct/incorrect split across 10 categories: factual accuracy, completeness, logical consistency, precise terminology, misleading statements, missing info, ambiguity, partial correctness, nuanced accuracy, and technical precision",
    examples: datasetExamples,
  });

  const task: ExperimentTask = async (example) => {
    const answer = example.output?.answer as string;
    const expectedLabel = example.output?.expected_label as
      | "correct"
      | "incorrect";

    const evalResult = await correctnessEvaluator.evaluate({
      input: example.input.question as string,
      output: answer,
    });

    return {
      expected_label: expectedLabel,
      category: example.metadata?.category as string,
      variant: example.metadata?.variant as string,
      ...evalResult,
    };
  };

  const experiment = await runExperiment({
    experimentName: "correctness-rubric-boundary-test",
    experimentDescription:
      "Testing the correctness evaluator against rubric boundary conditions with deterministic 50/50 split",
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
  console.log("\n" + "=".repeat(80));
  console.log("EXPERIMENT RESULTS SUMMARY");
  console.log("=".repeat(80));
  console.log(`Experiment ID: ${experimentResult.id}`);
  console.log(`Dataset ID: ${experimentResult.datasetId}`);
  console.log(`Total Examples: ${experimentResult.exampleCount}`);
  console.log(`Successful Runs: ${experimentResult.successfulRunCount}`);
  console.log(`Failed Runs: ${experimentResult.failedRunCount}`);
  console.log(`Missing Runs: ${experimentResult.missingRunCount}`);

  // Analyze runs by category and variant
  const runsByCategory: Record<
    string,
    {
      correct_variant: { correct: number; incorrect: number; errors: number };
      incorrect_variant: { correct: number; incorrect: number; errors: number };
    }
  > = {};

  for (const run of Object.values(experimentResult.runs)) {
    const output = run.output as TaskOutput | null;
    const category = output?.category || "unknown";
    const variant = output?.variant || "unknown";

    if (!runsByCategory[category]) {
      runsByCategory[category] = {
        correct_variant: { correct: 0, incorrect: 0, errors: 0 },
        incorrect_variant: { correct: 0, incorrect: 0, errors: 0 },
      };
    }

    const variantKey =
      variant === "correct" ? "correct_variant" : "incorrect_variant";

    if (run.error) {
      runsByCategory[category][variantKey].errors++;
    } else if (output?.expected_label === output?.label) {
      runsByCategory[category][variantKey].correct++;
    } else {
      runsByCategory[category][variantKey].incorrect++;
    }
  }

  console.log("\n" + "-".repeat(80));
  console.log("ACCURACY BY CATEGORY AND VARIANT");
  console.log("-".repeat(80));
  console.log(
    `  ${"Category".padEnd(25)} | ${"Correct Answers".padEnd(20)} | ${"Incorrect Answers".padEnd(20)} | Overall`
  );
  console.log("-".repeat(80));

  let totalCorrect = 0;
  let totalIncorrect = 0;
  let totalErrors = 0;
  let totalCorrectVariantCorrect = 0;
  let totalCorrectVariantTotal = 0;
  let totalIncorrectVariantCorrect = 0;
  let totalIncorrectVariantTotal = 0;

  for (const [category, stats] of Object.entries(runsByCategory).sort()) {
    const correctTotal =
      stats.correct_variant.correct +
      stats.correct_variant.incorrect +
      stats.correct_variant.errors;
    const incorrectTotal =
      stats.incorrect_variant.correct +
      stats.incorrect_variant.incorrect +
      stats.incorrect_variant.errors;
    const overallTotal = correctTotal + incorrectTotal;

    const correctAcc =
      correctTotal > 0
        ? ((stats.correct_variant.correct / correctTotal) * 100).toFixed(0)
        : "N/A";
    const incorrectAcc =
      incorrectTotal > 0
        ? ((stats.incorrect_variant.correct / incorrectTotal) * 100).toFixed(0)
        : "N/A";
    const overallAcc =
      overallTotal > 0
        ? (
            ((stats.correct_variant.correct + stats.incorrect_variant.correct) /
              overallTotal) *
            100
          ).toFixed(0)
        : "N/A";

    console.log(
      `  ${category.padEnd(25)} | ${`${correctAcc}% (${stats.correct_variant.correct}/${correctTotal})`.padEnd(20)} | ${`${incorrectAcc}% (${stats.incorrect_variant.correct}/${incorrectTotal})`.padEnd(20)} | ${overallAcc}%`
    );

    totalCorrect +=
      stats.correct_variant.correct + stats.incorrect_variant.correct;
    totalIncorrect +=
      stats.correct_variant.incorrect + stats.incorrect_variant.incorrect;
    totalErrors +=
      stats.correct_variant.errors + stats.incorrect_variant.errors;
    totalCorrectVariantCorrect += stats.correct_variant.correct;
    totalCorrectVariantTotal += correctTotal;
    totalIncorrectVariantCorrect += stats.incorrect_variant.correct;
    totalIncorrectVariantTotal += incorrectTotal;
  }

  const overallTotal = totalCorrect + totalIncorrect + totalErrors;
  const overallAccuracy =
    overallTotal > 0 ? ((totalCorrect / overallTotal) * 100).toFixed(1) : "N/A";
  const correctVariantAccuracy =
    totalCorrectVariantTotal > 0
      ? ((totalCorrectVariantCorrect / totalCorrectVariantTotal) * 100).toFixed(
          0
        )
      : "N/A";
  const incorrectVariantAccuracy =
    totalIncorrectVariantTotal > 0
      ? (
          (totalIncorrectVariantCorrect / totalIncorrectVariantTotal) *
          100
        ).toFixed(0)
      : "N/A";

  console.log("-".repeat(80));
  console.log(
    `  ${"OVERALL".padEnd(25)} | ${`${correctVariantAccuracy}% (${totalCorrectVariantCorrect}/${totalCorrectVariantTotal})`.padEnd(20)} | ${`${incorrectVariantAccuracy}% (${totalIncorrectVariantCorrect}/${totalIncorrectVariantTotal})`.padEnd(20)} | ${overallAccuracy}%`
  );
  console.log("=".repeat(80));
  console.log(`\nTotal Errors: ${totalErrors}`);
  console.log("=".repeat(80) + "\n");
}

main();
