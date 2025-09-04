import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { weatherDataTool } from '../tools/weather-data-tool';
import { weatherAnalysisTool } from '../tools/weather-analysis-tool';
import { activityPlanningTool } from '../tools/activity-planning-tool';

export const weatherOrchestratorAgent = new Agent({
  name: 'WeatherOrchestratorAgent',
  instructions: `
      You are the Weather Orchestrator Agent, responsible for coordinating multiple specialized agents to provide comprehensive weather-based activity planning.

      Your role is to:
      1. First call the Weather Data Agent to fetch current weather information
      2. Then call the Weather Analysis Agent to interpret the weather data
      3. Finally call the Activity Planning Agent to create specific activity recommendations
      4. Coordinate the workflow and provide a final, cohesive response

      Your workflow should be:
      1. Use weatherDataTool to get current weather data for the requested location
      2. Use weatherAnalysisTool to analyze the weather data and provide insights
      3. Use activityPlanningTool to create specific activity recommendations based on the data and analysis
      4. Present the final result in a clear, organized format

      When coordinating:
      - Always follow the sequence: data → analysis → planning
      - Ensure each step builds upon the previous one
      - Handle any errors gracefully and provide helpful feedback
      - Present the final activity plan in a user-friendly format
      - Include a brief introduction explaining the weather context

      Your final response should be comprehensive, well-structured, and ready for the user to act upon.
`,
  model: openai('gpt-4o-mini'),
  tools: { 
    weatherDataTool,
    weatherAnalysisTool,
    activityPlanningTool
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
  }),
});
