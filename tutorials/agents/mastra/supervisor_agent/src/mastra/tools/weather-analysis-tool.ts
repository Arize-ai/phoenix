import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const weatherAnalysisTool = createTool({
  id: 'weather-analysis-agent-tool',
  description: 'Calls the weather analysis agent to analyze weather conditions and patterns.',
  inputSchema: z.object({
    weatherData: z.string().describe('Raw weather data to be analyzed'),
    location: z.string().describe('Location name for context')
  }),
  outputSchema: z.object({
    analysis: z.string().describe('Detailed weather analysis and forecast interpretation')
  }),
  execute: async ({ context, mastra }) => {
    const { weatherData, location } = context;

    const agent = mastra!.getAgent('weatherAnalysisAgent');
    if (!agent) {
      throw new Error('Weather analysis agent not found');
    }

    const result = await agent.generate(`Analyze the following weather data for ${location} and provide detailed insights:

${weatherData}

Please provide:
1. Current conditions analysis and what they mean for different activities
2. Weather pattern trends and forecast insights
3. Optimal timing windows throughout the day
4. Any weather risks or special considerations
5. Overall assessment of weather suitability for outdoor vs indoor activities`);

    return {
      analysis: result.text
    };
  }
});
