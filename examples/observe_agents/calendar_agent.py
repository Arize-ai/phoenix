"""Calendar Agent implemented using the openai-agents Python SDK.

This script defines an Agent equipped with Google Calendar-related
tools such as `list_availability`, `create_event`, `update_event`, `delete_event`.
When the Agent decides to call one of these tools the corresponding local
function is executed.

Run the script and interact over stdio, e.g.:

    >>> Check my availability tomorrow
    >>> Create a meeting at 2pm tomorrow for 1 hour
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, List

from agents import Agent, Runner, function_tool
from dotenv import load_dotenv
from openai import OpenAI

import phoenix as px

# ---------------------------------------------------------------------------
# Environment & instrumentation
# ---------------------------------------------------------------------------

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY must be set")
client = OpenAI(api_key=OPENAI_API_KEY)

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
phoenix_client = px.Client(endpoint=os.getenv("PHOENIX_BASE_URL"))

# ---------------------------------------------------------------------------
# Google Calendar helpers
# ---------------------------------------------------------------------------

SCOPES = [
    "https://www.googleapis.com/auth/calendar",
]


def get_calendar_service() -> Any:
    """Get the Google Calendar service."""
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build  # type: ignore

    token_path = os.getenv("GMAIL_TOKEN_JSON")
    client_secret = os.getenv("GMAIL_CLIENT_SECRET_JSON")
    if not token_path or not client_secret:
        raise RuntimeError("GMAIL_TOKEN_JSON and GMAIL_CLIENT_SECRET_JSON must be set")
    creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    return build("calendar", "v3", credentials=creds)


def _get_busy_periods(
    time_min: str, time_max: str, calendar_id: str = "primary"
) -> List[Dict[str, str]]:
    """Helper function to get busy periods from Google Calendar."""
    service = get_calendar_service()

    try:
        # Query free/busy information
        body = {"timeMin": time_min, "timeMax": time_max, "items": [{"id": calendar_id}]}

        result = service.freebusy().query(body=body).execute()

        # Extract busy periods
        busy_periods = []
        calendar_data = result.get("calendars", {}).get(calendar_id, {})
        busy_times = calendar_data.get("busy", [])

        for busy_time in busy_times:
            busy_periods.append({"start": busy_time["start"], "end": busy_time["end"]})

        return busy_periods

    except Exception as e:
        print(f"❌ Failed to get busy periods: {str(e)}")
        return []


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------


@function_tool
def list_availability(
    time_min: str, time_max: str, calendar_id: str = "primary"
) -> List[Dict[str, str]]:
    """List busy time blocks between time_min and time_max (ISO format) for a Google Calendar.

    Args:
        time_min: ISO8601 start time (e.g., "2024-01-15T09:00:00-08:00")
        time_max: ISO8601 end time (e.g., "2024-01-15T17:00:00-08:00")
        calendar_id: Calendar ID (defaults to "primary")

    Returns:
        List of busy time blocks with start and end times
    """
    busy_periods = _get_busy_periods(time_min, time_max, calendar_id)
    print(f"📅 Found {len(busy_periods)} busy time blocks")
    return busy_periods


@function_tool
def create_event(
    summary: str,
    start_time: str,
    end_time: str,
    description: str | None = None,
    attendees: List[str] | None = None,
    location: str | None = None,
    calendar_id: str = "primary",
) -> str:
    """Create a calendar event and return its ID.

    Args:
        summary: Event title/summary
        start_time: ISO8601 start time (e.g., "2024-01-15T14:00:00-08:00")
        end_time: ISO8601 end time (e.g., "2024-01-15T15:00:00-08:00")
        description: Optional event description
        attendees: Optional list of attendee email addresses
        location: Optional event location
        calendar_id: Calendar ID (defaults to "primary")

    Returns:
        The created event ID
    """
    service = get_calendar_service()

    try:
        # Build event object
        event = {
            "summary": summary,
            "start": {"dateTime": start_time},
            "end": {"dateTime": end_time},
        }

        if description:
            event["description"] = description

        if location:
            event["location"] = location

        if attendees:
            event["attendees"] = [{"email": email} for email in attendees]

        # Create the event
        created_event = service.events().insert(calendarId=calendar_id, body=event).execute()

        event_id = created_event["id"]
        print(f"✅ Created event '{summary}' with ID: {event_id}")
        return event_id

    except Exception as e:
        print(f"❌ Failed to create event: {str(e)}")
        raise


@function_tool
def update_event(
    event_id: str,
    summary: str | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
    description: str | None = None,
    attendees: List[str] | None = None,
    location: str | None = None,
    calendar_id: str = "primary",
) -> str:
    """Update an existing calendar event.

    Args:
        event_id: ID of the event to update
        summary: New event title/summary
        start_time: New ISO8601 start time
        end_time: New ISO8601 end time
        description: New event description
        attendees: New list of attendee email addresses
        location: New event location
        calendar_id: Calendar ID (defaults to "primary")

    Returns:
        The updated event ID
    """
    service = get_calendar_service()

    try:
        # Get the existing event
        event = service.events().get(calendarId=calendar_id, eventId=event_id).execute()

        # Update fields if provided
        if summary is not None:
            event["summary"] = summary
        if start_time is not None:
            event["start"] = {"dateTime": start_time}
        if end_time is not None:
            event["end"] = {"dateTime": end_time}
        if description is not None:
            event["description"] = description
        if location is not None:
            event["location"] = location
        if attendees is not None:
            event["attendees"] = [{"email": email} for email in attendees]

        # Update the event
        updated_event = (
            service.events().update(calendarId=calendar_id, eventId=event_id, body=event).execute()
        )

        print(f"✅ Updated event '{event.get('summary', 'Unknown')}' with ID: {event_id}")
        return updated_event["id"]

    except Exception as e:
        print(f"❌ Failed to update event: {str(e)}")
        raise


@function_tool
def delete_event(event_id: str, calendar_id: str = "primary") -> str:
    """Delete an existing calendar event.

    Args:
        event_id: ID of the event to delete
        calendar_id: Calendar ID (defaults to "primary")

    Returns:
        Confirmation message
    """
    service = get_calendar_service()

    try:
        # Get event details before deletion for confirmation
        event = service.events().get(calendarId=calendar_id, eventId=event_id).execute()

        event_title = event.get("summary", "Unknown Event")

        # Delete the event
        service.events().delete(calendarId=calendar_id, eventId=event_id).execute()

        print(f"✅ Deleted event '{event_title}' with ID: {event_id}")
        return f"Successfully deleted event '{event_title}'"

    except Exception as e:
        print(f"❌ Failed to delete event: {str(e)}")
        raise


@function_tool
def list_upcoming_events(
    max_results: int = 10, calendar_id: str = "primary"
) -> List[Dict[str, Any]]:
    """List upcoming events from the calendar.

    Args:
        max_results: Maximum number of events to return
        calendar_id: Calendar ID (defaults to "primary")

    Returns:
        List of upcoming events with details
    """
    service = get_calendar_service()

    try:
        # Get current time in ISO format
        now = datetime.utcnow().isoformat() + "Z"

        # Call the Calendar API
        events_result = (
            service.events()
            .list(
                calendarId=calendar_id,
                timeMin=now,
                maxResults=max_results,
                singleEvents=True,
                orderBy="startTime",
            )
            .execute()
        )

        events = events_result.get("items", [])

        upcoming_events = []
        for event in events:
            event_info = {
                "id": event["id"],
                "summary": event.get("summary", "No Title"),
                "start": event["start"].get("dateTime", event["start"].get("date")),
                "end": event["end"].get("dateTime", event["end"].get("date")),
                "description": event.get("description", ""),
                "location": event.get("location", ""),
                "attendees": [attendee.get("email", "") for attendee in event.get("attendees", [])],
            }
            upcoming_events.append(event_info)

        print(f"📅 Found {len(upcoming_events)} upcoming events")
        return upcoming_events

    except Exception as e:
        print(f"❌ Failed to list upcoming events: {str(e)}")
        return []


@function_tool
def find_free_time(
    duration_minutes: int, time_min: str, time_max: str, calendar_id: str = "primary"
) -> List[Dict[str, str]]:
    """Find free time slots of specified duration within a time range.

    Args:
        duration_minutes: Required duration in minutes
        time_min: ISO8601 start time for search range
        time_max: ISO8601 end time for search range
        calendar_id: Calendar ID (defaults to "primary")

    Returns:
        List of available time slots
    """
    # Get busy periods using the helper function
    busy_periods = _get_busy_periods(time_min, time_max, calendar_id)

    # Parse time bounds
    start_dt = datetime.fromisoformat(time_min.replace("Z", "+00:00"))
    end_dt = datetime.fromisoformat(time_max.replace("Z", "+00:00"))

    # Convert busy periods to datetime objects
    busy_times = []
    for period in busy_periods:
        busy_start = datetime.fromisoformat(period["start"].replace("Z", "+00:00"))
        busy_end = datetime.fromisoformat(period["end"].replace("Z", "+00:00"))
        busy_times.append((busy_start, busy_end))

    # Sort busy times
    busy_times.sort(key=lambda x: x[0])

    # Find free slots
    free_slots = []
    current_time = start_dt

    for busy_start, busy_end in busy_times:
        # Check if there's a free slot before this busy period
        if current_time < busy_start:
            slot_duration = (busy_start - current_time).total_seconds() / 60
            if slot_duration >= duration_minutes:
                free_slots.append(
                    {"start": current_time.isoformat(), "end": busy_start.isoformat()}
                )
        current_time = max(current_time, busy_end)

    # Check for free time after the last busy period
    if current_time < end_dt:
        slot_duration = (end_dt - current_time).total_seconds() / 60
        if slot_duration >= duration_minutes:
            free_slots.append({"start": current_time.isoformat(), "end": end_dt.isoformat()})

    print(f"📅 Found {len(free_slots)} free time slots of {duration_minutes}+ minutes")
    return free_slots


# ---------------------------------------------------------------------------
# Agent definition
# ---------------------------------------------------------------------------


def get_calendar_agent_prompt():
    """Load the calendar agent prompt from Phoenix with production tag."""
    try:
        prompt_version = phoenix_client.prompts.get(
            prompt_identifier="calendar-agent-prompt", tag="production"
        )
        # Format the prompt to get the OpenAI format
        formatted_prompt = prompt_version.format()

        # Extract the system message content from the formatted prompt
        if hasattr(formatted_prompt, "messages") and len(formatted_prompt.messages) > 0:
            return formatted_prompt.messages[0]["content"]
        else:
            # Fallback instructions if prompt format not recognized
            return (
                "You are a calendar assistant with access to Google Calendar. "
                "Use the provided tools to manage calendar events, check availability, "
                "and help with scheduling. Always provide clear confirmations when "
                "creating, updating, or deleting events."
            )
    except Exception as e:
        print(f"⚠️  Failed to load prompt from Phoenix: {e}")
        # Fallback instructions
        return (
            "You are a calendar assistant with access to Google Calendar. "
            "Use the provided tools to manage calendar events, check availability, "
            "and help with scheduling. Always provide clear confirmations when "
            "creating, updating, or deleting events."
        )


CALENDAR_AGENT = Agent(
    name="Calendar Agent",
    instructions=get_calendar_agent_prompt(),
    tools=[
        list_availability,
        create_event,
        update_event,
        delete_event,
        list_upcoming_events,
        find_free_time,
    ],
)

# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(
        "📅 Calendar Agent (openai-agents) ready. Type your calendar-related request ('exit' to quit)."
    )
    while True:
        try:
            user_input = input(">>> ").strip()
        except (KeyboardInterrupt, EOFError):
            print()
            break
        if user_input.lower() in {"exit", "quit"}:
            break
        if user_input:
            result = Runner.run_sync(CALENDAR_AGENT, user_input)
            print("🤖:", result.final_output)
