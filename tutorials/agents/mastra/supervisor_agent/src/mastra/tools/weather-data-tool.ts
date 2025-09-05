import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const weatherDataTool = createTool({
  id: 'weather-data-agent-tool',
  description: 'Calls the weather data agent to fetch current weather information for a location.',
  inputSchema: z.object({
    location: z.string().describe('City or location name to get weather data for')
  }),
  outputSchema: z.object({
    weatherData: z.string().describe('Structured weather data from the weather data agent')
  }),
  execute: async ({ context, mastra }) => {
    const { location } = context;

    const agent = mastra!.getAgent('weatherDataAgent');
    if (!agent) {
      throw new Error('Weather data agent not found');
    }

    const result = await agent.generate(`Get the current weather data for ${location}. Provide a comprehensive summary of all weather metrics including temperature, humidity, wind conditions, and current weather conditions.`);

    return {
      weatherData: result.text
    };
  }
});
