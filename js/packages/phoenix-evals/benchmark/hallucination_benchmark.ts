import { createHallucinationEvaluator } from "../src/llm";
import { openai } from "@ai-sdk/openai";
import { createDataset } from "@arizeai/phoenix-client/datasets";
import {
  asEvaluator,
  runExperiment,
} from "@arizeai/phoenix-client/experiments";
const hallucinationEvaluator = createHallucinationEvaluator({
  model: openai("gpt-4o-mini"),
});

const examples = [
  {
    knowledge:
      "Arthur's Magazine (1844–1846) was an American literary periodical published in Philadelphia in the 19th century.First for Women is a woman's magazine published by Bauer Media Group in the USA.",
    question:
      "Which magazine was started first Arthur's Magazine or First for Women?",
    right_answer: "Arthur's Magazine",
    hallucinated_answer: "First for Women was started first.",
  },
  {
    knowledge:
      "The Oberoi family is an Indian family that is famous for its involvement in hotels, namely through The Oberoi Group.The Oberoi Group is a hotel company with its head office in Delhi.",
    question:
      "The Oberoi family is part of a hotel company that has a head office in what city?",
    right_answer: "Delhi",
    hallucinated_answer:
      "The Oberoi family's hotel company is based in Mumbai.",
  },
  {
    knowledge:
      'Allison Beth "Allie" Goertz (born March 2, 1991) is an American musician. Goertz is known for her satirical songs based on various pop culture topics. Her videos are posted on YouTube under the name of Cossbysweater.Milhouse Mussolini van Houten is a fictional character featured in the animated television series "The Simpsons", voiced by Pamela Hayden, and created by Matt Groening who named the character after President Richard Nixon\'s middle name.',
    question:
      'Musician and satirist Allie Goertz wrote a song about the "The Simpsons" character Milhouse, who Matt Groening named after who?',
    right_answer: "President Richard Nixon",
    hallucinated_answer:
      "Allie Goertz wrote a song about Milhouse, a popular TV character, named after an influential political figure.",
  },
  {
    knowledge:
      'Margaret "Peggy" Seeger (born June 17, 1935) is an American folksinger. She is also well known in Britain, where she has lived for more than 30 years, and was married to the singer and songwriter Ewan MacColl until his death in 1989.James Henry Miller (25 January 1915 – 22 October 1989), better known by his stage name Ewan MacColl, was an English folk singer, songwriter, communist, labour activist, actor, poet, playwright and record producer.',
    question: " What nationality was James Henry Miller's wife?",
    right_answer: "American",
    hallucinated_answer: "James Henry Miller's wife was British.",
  },
  {
    knowledge:
      " It is a hygroscopic solid that is highly soluble in water and slightly soluble in alcohol.Ethanol, also called alcohol, ethyl alcohol, and drinking alcohol, is a compound and simple alcohol with the chemical formula C2H5OH .",
    question:
      "Cadmium Chloride is slightly soluble in this chemical, it is also called what?",
    right_answer: "alcohol",
    hallucinated_answer: "water with a hint of alcohol",
  },
  {
    knowledge:
      "Jonathan Stark (born April 3, 1971) is a former professional tennis player from the United States. During his career he won two Grand Slam doubles titles (the 1994 French Open Men's Doubles and the 1995 Wimbledon Championships Mixed Doubles). He reached the men's singles final at the French Open in 1988, won the French Open men's doubles title in 1984, and helped France win the Davis Cup in 1991.",
    question:
      "Which tennis player won more Grand Slam titles, Henri Leconte or Jonathan Stark?",
    right_answer: "Jonathan Stark",
    hallucinated_answer: "Henri Leconte won more Grand Slam titles.",
  },
  {
    knowledge:
      'Indogrammodes is a genus of moths of the Crambidae family. It contains only one species, Indogrammodes pectinicornalis, which is found in India.India, officially the Republic of India ("Bhārat Gaṇarājya"), is a country in South Asia. It is the seventh-largest country by area, the second-most populous country (with over 1.2 billion people), and the most populous democracy in the world.',
    question:
      "Which genus of moth in the world's seventh-largest country contains only one species?",
    right_answer: "Crambidae",
    hallucinated_answer:
      "The Indogrammodes genus of moths found in India has only one species.",
  },
  {
    knowledge:
      ' Fighters from around world on the roster include Badr Hari, Peter Aerts, Peter Graham, Dewey Cooper, Zabit Samedov. It was considered as one of the biggest kickboxing and MMA promotion in Middle East.Badr Hari (Arabic: بدر هاري‎ ‎ ; born 8 December 1984) is a Moroccan-Dutch super heavyweight kickboxer from Amsterdam, fighting out of Mike\'s Gym in Oostzaan. Hari has been a prominent figure in the world of kickboxing and was once considered the best kickboxer in the world, however he has been involved in a number of controversies relating to his "unsportsmanlike conducts" in the sport and crimes of violence outside of the ring.',
    question:
      'Who was once considered the best kick boxer in the world, however he has been involved in a number of controversies relating to his "unsportsmanlike conducts" in the sport and crimes of violence outside of the ring.',
    right_answer: "Badr Hari",
    hallucinated_answer: "Badr Hari is a notorious kickboxer.",
  },
];

type TaskOutput = {
  expected_label: "hallucinated" | "factual";
  label: "hallucinated" | "factual";
  score: number;
  explanation: string;
};

const correctEvaluator = asEvaluator({
  name: "correctness",
  kind: "CODE",
  evaluate: async (args) => {
    const output = args.output as TaskOutput;
    const score = output.expected_label === output.label ? 1 : 0;
    const label =
      output.expected_label === "hallucinated" ? "hallucinated" : "factual";
    return {
      label: label,
      score: score,
      explanation: `The evaluator labeled the answer as ${label}. Expected: ${(output as unknown as { expected_label: string }).expected_label}`,
      metadata: {},
    };
  },
});

async function main() {
  const dataset = await createDataset({
    name: "hallucination-eval" + Math.random(),
    description: "Evaluate the hallucination of the model",
    examples: examples.map((example) => ({
      input: { question: example.question, context: example.knowledge },
      output: {
        answer: example.right_answer,
        hallucinated_answer: example.hallucinated_answer,
      },
      metadata: {
        knowledge: example.knowledge,
      },
    })),
  });

  const task = async (example) => {
    const useHalluination = Math.random() < 0.2;
    const answer = useHalluination
      ? example.output?.hallucinated_answer
      : example.output?.answer;

    const evalResult = await hallucinationEvaluator({
      input: example.input.question as string,
      context: example.input.context as string,
      output: answer as string,
    });

    return {
      expected_label: useHalluination ? "hallucinated" : "factual",
      ...evalResult,
    };
  };
  runExperiment({
    experimentName: "hallucination-eval",
    experimentDescription: "Evaluate the hallucination of the model",
    concurrency: 8,
    dataset: dataset,
    task,
    evaluators: [correctEvaluator],
  });
}

main();
