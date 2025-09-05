import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const activityPlanningTool = createTool({
  id: 'activity-planning-agent-tool',
  description: 'Calls the activity planning agent to suggest activities based on weather analysis.',
  inputSchema: z.object({
    weatherData: z.string().describe('Raw weather data'),
    weatherAnalysis: z.string().describe('Weather analysis and insights'),
    location: z.string().describe('Location name for activity suggestions')
  }),
  outputSchema: z.object({
    activityPlan: z.string().describe('Detailed activity recommendations and schedule')
  }),
  execute: async ({ context, mastra }) => {
    const { weatherData, weatherAnalysis, location } = context;

    const agent = mastra!.getAgent('activityPlanningAgent');
    if (!agent) {
      throw new Error('Activity planning agent not found');
    }

    const result = await agent.generate(`Based on the weather data and analysis for ${location}, create a detailed activity plan:

WEATHER DATA:
${weatherData}

WEATHER ANALYSIS:
${weatherAnalysis}

Please create a structured activity plan with the following format:

📅 TODAY - ${location}
═══════════════════════════

🌡️ WEATHER SUMMARY
[Include key weather highlights]

🌅 MORNING ACTIVITIES (8 AM - 12 PM)
Outdoor:
• [Specific Activity] - [Location/venue details]
  Best timing: [time range]
  Note: [weather considerations]

🌞 AFTERNOON ACTIVITIES (12 PM - 6 PM)  
Outdoor:
• [Specific Activity] - [Location/venue details]
  Best timing: [time range]
  Note: [weather considerations]

🌆 EVENING ACTIVITIES (6 PM - 10 PM)
Outdoor:
• [Specific Activity] - [Location/venue details]
  Best timing: [time range]
  Note: [weather considerations]

🏠 INDOOR ALTERNATIVES
• [Activity] - [Specific venue]
  Ideal for: [weather condition]

⚠️ SPECIAL CONSIDERATIONS
• [Weather warnings, gear recommendations, etc.]

Guidelines followed:
- All activities are specific to ${location}
- Include specific venues, parks, trails, or locations
- Consider weather conditions for activity selection
- Provide backup indoor options
- Include timing recommendations`);

    return {
      activityPlan: result.text
    };
  }
});
