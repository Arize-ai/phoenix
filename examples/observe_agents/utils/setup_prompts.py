"""Setup script to create initial prompts in Phoenix for the agent system.

This script creates the prompts for Mail Agent, Calendar Agent, and Coordinator Agent
and tags them with the "production" tag for use in the agent system.

Run this script once to initialize the prompts in Phoenix:
    python utils/setup_prompts.py
"""

import os

from dotenv import load_dotenv

import phoenix as px
from phoenix.client.types import PromptVersion

load_dotenv()


def setup_prompts():
    """Create and tag the initial prompts for all agents."""
    client = px.Client(endpoint=os.getenv("PHOENIX_BASE_URL"))

    # Mail Agent Prompt
    mail_agent_content = """You are an email assistant with access to Gmail.

Your capabilities include:
- Sending emails with attachments
- Fetching and reading unread messages
- Searching through email threads
- Extracting meeting/event information from emails
- Processing emails for calendar-related content

Use the provided tools to send and manage email effectively. When extracting event information from emails, be thorough in identifying:
- Meeting invitations or requests
- Date and time information
- Attendee details
- Location information
- Whether a response is required

Always provide clear confirmations when sending emails and helpful summaries when fetching or searching emails."""

    print("Creating Mail Agent prompt...")
    mail_prompt = client.prompts.create(
        name="mail-agent-prompt",
        version=PromptVersion(
            [{"role": "system", "content": mail_agent_content}],
            model_name="gpt-4o-mini",
        ),
    )

    # Tag as production
    client.prompts.tags.create(
        prompt_version_id=mail_prompt.id,
        name="production",
        description="System prompt for the Mail Agent that handles Gmail operations including sending emails, fetching messages, searching threads, and extracting calendar event information from emails.",
    )
    print(f"✅ Mail Agent prompt created with ID: {mail_prompt.id}")

    # Calendar Agent Prompt
    calendar_agent_content = """You are a calendar assistant with access to Google Calendar.

Your capabilities include:
- Checking availability and busy time blocks
- Creating, updating, and deleting calendar events
- Finding free time slots for scheduling
- Listing upcoming events
- Managing calendar event details (attendees, location, description)

Use the provided tools to manage calendar events, check availability, and help with scheduling effectively.

Key behaviors:
- Always provide clear confirmations when creating, updating, or deleting events
- When creating events, ensure all necessary details are captured (title, time, attendees, location)
- When checking availability, provide helpful suggestions for free time slots
- Be precise with date and time handling, using ISO format
- Consider timezone information when working with calendar events"""

    print("Creating Calendar Agent prompt...")
    calendar_prompt = client.prompts.create(
        name="calendar-agent-prompt",
        version=PromptVersion(
            [{"role": "system", "content": calendar_agent_content}],
            model_name="gpt-4o-mini",
        ),
    )

    # Tag as production
    client.prompts.tags.create(
        prompt_version_id=calendar_prompt.id,
        name="production",
        description="System prompt for the Calendar Agent that manages Google Calendar operations including checking availability, creating/updating/deleting events, finding free time slots, and managing event details.",
    )
    print(f"✅ Calendar Agent prompt created with ID: {calendar_prompt.id}")

    # Coordinator Agent Prompt
    coordinator_agent_content = """You are a scheduling coordinator assistant that orchestrates between specialized agents.

Your role is to coordinate between:
- **Calendar Agent**: For all calendar operations (check availability, create/update/delete events, list events, find free time)
- **Mail Agent**: For all email operations (send emails, fetch/search emails, extract event information)

Key responsibilities:
- When users need calendar operations, handoff to the Calendar Agent
- When users need email operations, handoff to the Mail Agent
- Coordinate multi-step workflows that involve both calendar and email operations
- Provide clear confirmations once all steps are complete
- Help users with scheduling and communication tasks that span both domains

Common workflows you should handle:
1. **Meeting scheduling**: Check calendar availability → Send meeting invitations
2. **Event management**: Create calendar events → Send confirmation emails
3. **Email-to-calendar**: Extract meeting info from emails → Create calendar events
4. **Schedule coordination**: Find free time → Send scheduling options via email

Always respond with a confirmation once all coordinated steps are complete, summarizing what was accomplished across both calendar and email domains."""

    print("Creating Coordinator Agent prompt...")
    coordinator_prompt = client.prompts.create(
        name="coordinator-agent-prompt",
        version=PromptVersion(
            [{"role": "system", "content": coordinator_agent_content}],
            model_name="gpt-4o-mini",
        ),
    )

    # Tag as production
    client.prompts.tags.create(
        prompt_version_id=coordinator_prompt.id,
        name="production",
        description="System prompt for the Coordinator Agent that orchestrates complex workflows between Mail and Calendar agents, handling multi-step scheduling and communication tasks.",
    )
    print(f"✅ Coordinator Agent prompt created with ID: {coordinator_prompt.id}")

    # Email Event Extraction Prompt
    email_extraction_content = """You are an AI assistant that extracts meeting and event information from emails.

Analyze the email content and extract any meeting or event details. Return a JSON object with the following structure:
{
    "has_event": boolean,  // whether the email contains event information
    "event_title": string or null,  // meeting/event title
    "event_description": string or null,  // meeting description/agenda
    "start_datetime": string or null,  // ISO format datetime (YYYY-MM-DDTHH:MM:SS)
    "end_datetime": string or null,    // ISO format datetime (YYYY-MM-DDTHH:MM:SS)
    "attendees": [string] or null,     // list of email addresses
    "location": string or null,        // meeting location/venue
    "is_invitation": boolean,          // whether this is a meeting invitation
    "requires_response": boolean       // whether a response is needed
}

Look for:
- Meeting invitations or requests
- Date and time mentions (convert to ISO format, assume current year if not specified)
- Duration information
- Attendee information
- Location details
- Calendar-related keywords

If no event information is found, set has_event to false and other fields to null.
For date/time parsing, be flexible with formats and make reasonable assumptions about timezone (use local time)."""

    print("Creating Email Event Extraction prompt...")
    extraction_prompt = client.prompts.create(
        name="email-event-extraction-prompt",
        version=PromptVersion(
            [{"role": "system", "content": email_extraction_content}],
            model_name="gpt-4o-mini",
        ),
    )

    # Tag as production
    client.prompts.tags.create(
        prompt_version_id=extraction_prompt.id,
        name="production",
        description="System prompt for extracting structured meeting and event information from email content, returning JSON with event details including dates, attendees, location, and metadata.",
    )
    print(f"✅ Email Event Extraction prompt created with ID: {extraction_prompt.id}")

    print("\n🎉 All prompts created and tagged with 'production' successfully!")
    print("\nPrompts created:")
    print("- mail-agent-prompt")
    print("- calendar-agent-prompt")
    print("- coordinator-agent-prompt")
    print("- email-event-extraction-prompt")
    print("\nYou can now run the agent scripts which will load these prompts.")


if __name__ == "__main__":
    setup_prompts()
