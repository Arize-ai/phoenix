import { 
  createDataset, 
  getDatasetInfo, 
  appendDatasetExamples 
} from '@arizeai/phoenix-client/datasets';
import type { Example } from '@arizeai/phoenix-client/types/datasets';

export interface HallucinationExample {
  context: string;
  response: string;
  isHallucination: boolean;
  explanation?: string;
}

export class HallucinationDataset {
  private examples: HallucinationExample[] = [
    {
      context: "The capital of France is Paris. It is known for its iconic Eiffel Tower.",
      response: "The capital of France is Paris, which is famous for the Eiffel Tower.",
      isHallucination: false,
      explanation: "Accurate information about France's capital and landmark"
    },
    {
      context: "The capital of France is Paris. It is known for its iconic Eiffel Tower.",
      response: "The capital of France is Berlin, which is famous for the Brandenburg Gate.",
      isHallucination: true,
      explanation: "Incorrectly states Berlin as France's capital"
    },
    {
      context: "Python is a programming language created by Guido van Rossum in 1991.",
      response: "Python was created by Guido van Rossum and first released in 1991.",
      isHallucination: false,
      explanation: "Correct information about Python's creator and release year"
    },
    {
      context: "Python is a programming language created by Guido van Rossum in 1991.",
      response: "Python was created by Bill Gates in 1995 and is primarily used for web development.",
      isHallucination: true,
      explanation: "Wrong creator and year for Python"
    },
    {
      context: "The Great Wall of China was built over many centuries, primarily during the Ming Dynasty.",
      response: "The Great Wall of China was constructed mainly during the Ming Dynasty period.",
      isHallucination: false,
      explanation: "Accurate historical information about the Great Wall"
    },
    {
      context: "The Great Wall of China was built over many centuries, primarily during the Ming Dynasty.",
      response: "The Great Wall of China was completed in a single year by aliens from Mars.",
      isHallucination: true,
      explanation: "Completely fabricated claim about alien construction"
    },
    {
      context: "Shakespeare wrote Romeo and Juliet, a tragedy about star-crossed lovers.",
      response: "Romeo and Juliet is a tragic play by Shakespeare about two young lovers.",
      isHallucination: false,
      explanation: "Correct attribution and description of the play"
    },
    {
      context: "Shakespeare wrote Romeo and Juliet, a tragedy about star-crossed lovers.",
      response: "Romeo and Juliet is a comedy by Charles Dickens about business partners.",
      isHallucination: true,
      explanation: "Wrong author, genre, and plot description"
    },
    {
      context: "Water boils at 100 degrees Celsius at sea level atmospheric pressure.",
      response: "At standard atmospheric pressure, water boils at 100°C.",
      isHallucination: false,
      explanation: "Correct scientific fact about water's boiling point"
    },
    {
      context: "Water boils at 100 degrees Celsius at sea level atmospheric pressure.",
      response: "Water boils at 50 degrees Celsius and freezes at 100 degrees Celsius.",
      isHallucination: true,
      explanation: "Reversed and incorrect temperature values"
    }
  ];

  getExamples(): HallucinationExample[] {
    return this.examples;
  }

  private convertToPhoenixExamples(): Example[] {
    return this.examples.map((example) => ({
      input: {
        context: example.context
      },
      output: {
        response: example.response
      },
      metadata: {
        isHallucination: example.isHallucination,
        explanation: example.explanation || ''
      }
    }));
  }

  async ensureDatasetExists(datasetName: string = 'hallucination-benchmark'): Promise<string> {
    try {
      const datasetInfo = await getDatasetInfo({
        dataset: { datasetName }
      });
      console.log(`Dataset '${datasetName}' already exists with ID: ${datasetInfo.id}`);
      return datasetInfo.id;
    } catch (error) {
      console.log(`Dataset '${datasetName}' does not exist, creating...`);
      
      const phoenixExamples = this.convertToPhoenixExamples();
      
      const response = await createDataset({
        name: datasetName,
        description: 'Dataset for benchmarking hallucination detection evaluators',
        examples: phoenixExamples
      });

      console.log(`Created dataset '${datasetName}' with ID: ${response.datasetId}`);
      console.log(`Stored ${phoenixExamples.length} hallucination examples`);
      
      return response.datasetId;
    }
  }

  async addExamples(datasetName: string, additionalExamples: HallucinationExample[]) {
    const phoenixExamples = additionalExamples.map((example) => ({
      input: {
        context: example.context
      },
      output: {
        response: example.response
      },
      metadata: {
        isHallucination: example.isHallucination,
        explanation: example.explanation || ''
      }
    }));

    await appendDatasetExamples({
      dataset: { datasetName },
      examples: phoenixExamples
    });

    console.log(`Added ${additionalExamples.length} examples to dataset '${datasetName}'`);
  }
}