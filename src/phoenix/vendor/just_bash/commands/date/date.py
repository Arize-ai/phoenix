"""Date command implementation.

Usage: date [OPTION]... [+FORMAT]

Display the current time in the given FORMAT.

Options:
  -d, --date=STRING   display time described by STRING
  -u, --utc           print Coordinated Universal Time (UTC)
  -I, --iso-8601      output date/time in ISO 8601 format
  -R, --rfc-email     output date and time in RFC 5322 format

FORMAT controls the output. Common sequences:
  %a  abbreviated weekday name (Sun..Sat)
  %A  full weekday name (Sunday..Saturday)
  %b  abbreviated month name (Jan..Dec)
  %B  full month name (January..December)
  %d  day of month (01..31)
  %H  hour (00..23)
  %I  hour (01..12)
  %j  day of year (001..366)
  %m  month (01..12)
  %M  minute (00..59)
  %p  AM or PM
  %S  second (00..60)
  %Y  year
  %Z  timezone name
  %z  +hhmm numeric timezone
  %F  full date; same as %Y-%m-%d
  %T  time; same as %H:%M:%S
  %s  seconds since 1970-01-01 00:00:00 UTC
  %%  a literal %
"""

from datetime import datetime, timezone
from ...types import CommandContext, ExecResult


class DateCommand:
    """The date command."""

    name = "date"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the date command."""
        date_string = None
        use_utc = False
        iso_format = False
        rfc_format = False
        format_str = None

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg.startswith("--"):
                if arg == "--utc" or arg == "--universal":
                    use_utc = True
                elif arg.startswith("--date="):
                    date_string = arg[7:]
                elif arg == "--iso-8601":
                    iso_format = True
                elif arg == "--rfc-email" or arg == "--rfc-2822":
                    rfc_format = True
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"date: unrecognized option '{arg}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-") and arg != "-":
                j = 1
                while j < len(arg):
                    c = arg[j]
                    if c == "u":
                        use_utc = True
                    elif c == "d":
                        # -d requires a value
                        if j + 1 < len(arg):
                            date_string = arg[j + 1:]
                            break
                        elif i + 1 < len(args):
                            i += 1
                            date_string = args[i]
                            break
                        else:
                            return ExecResult(
                                stdout="",
                                stderr="date: option requires an argument -- 'd'\n",
                                exit_code=1,
                            )
                    elif c == "I":
                        iso_format = True
                    elif c == "R":
                        rfc_format = True
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"date: invalid option -- '{c}'\n",
                            exit_code=1,
                        )
                    j += 1
            elif arg.startswith("+"):
                format_str = arg[1:]
            else:
                return ExecResult(
                    stdout="",
                    stderr=f"date: invalid date '{arg}'\n",
                    exit_code=1,
                )
            i += 1

        # Get the datetime
        try:
            if date_string:
                dt = self._parse_date_string(date_string)
            else:
                dt = datetime.now()

            if use_utc:
                dt = dt.astimezone(timezone.utc)
        except ValueError as e:
            return ExecResult(
                stdout="",
                stderr=f"date: invalid date '{date_string}'\n",
                exit_code=1,
            )

        # Format output
        if iso_format:
            output = dt.strftime("%Y-%m-%dT%H:%M:%S%z")
            if not output.endswith("Z") and len(output) > 5 and output[-5] in "+-":
                # Insert colon in timezone offset
                output = output[:-2] + ":" + output[-2:]
        elif rfc_format:
            output = dt.strftime("%a, %d %b %Y %H:%M:%S %z")
        elif format_str:
            output = self._format_date(dt, format_str)
        else:
            # Default format
            output = dt.strftime("%a %b %d %H:%M:%S %Z %Y")
            if not output.strip():
                output = dt.strftime("%a %b %d %H:%M:%S UTC %Y")

        return ExecResult(stdout=output + "\n", stderr="", exit_code=0)

    def _parse_date_string(self, s: str) -> datetime:
        """Parse a date string."""
        s = s.strip()

        # Handle special keywords
        if s.lower() == "now":
            return datetime.now()
        if s.lower() == "today":
            return datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        if s.lower() == "yesterday":
            from datetime import timedelta
            return (datetime.now() - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        if s.lower() == "tomorrow":
            from datetime import timedelta
            return (datetime.now() + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)

        # Try ISO format
        for fmt in [
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%m/%d/%Y",
            "%d %b %Y",
            "%b %d %Y",
        ]:
            try:
                return datetime.strptime(s, fmt)
            except ValueError:
                continue

        # Try parsing as Unix timestamp
        try:
            ts = float(s)
            return datetime.fromtimestamp(ts)
        except ValueError:
            pass

        raise ValueError(f"Unable to parse date: {s}")

    def _format_date(self, dt: datetime, fmt: str) -> str:
        """Format a date using strftime-like codes."""
        result = ""
        i = 0
        while i < len(fmt):
            if fmt[i] == "%" and i + 1 < len(fmt):
                code = fmt[i + 1]
                if code == "%":
                    result += "%"
                elif code == "a":
                    result += dt.strftime("%a")
                elif code == "A":
                    result += dt.strftime("%A")
                elif code == "b":
                    result += dt.strftime("%b")
                elif code == "B":
                    result += dt.strftime("%B")
                elif code == "d":
                    result += dt.strftime("%d")
                elif code == "D":
                    result += dt.strftime("%m/%d/%y")
                elif code == "e":
                    result += f"{dt.day:2d}"
                elif code == "F":
                    result += dt.strftime("%Y-%m-%d")
                elif code == "H":
                    result += dt.strftime("%H")
                elif code == "I":
                    result += dt.strftime("%I")
                elif code == "j":
                    result += dt.strftime("%j")
                elif code == "m":
                    result += dt.strftime("%m")
                elif code == "M":
                    result += dt.strftime("%M")
                elif code == "n":
                    result += "\n"
                elif code == "p":
                    result += dt.strftime("%p")
                elif code == "P":
                    result += dt.strftime("%p").lower()
                elif code == "S":
                    result += dt.strftime("%S")
                elif code == "s":
                    result += str(int(dt.timestamp()))
                elif code == "t":
                    result += "\t"
                elif code == "T":
                    result += dt.strftime("%H:%M:%S")
                elif code == "u":
                    # Day of week (1=Monday, 7=Sunday)
                    result += str(dt.isoweekday())
                elif code == "w":
                    # Day of week (0=Sunday, 6=Saturday)
                    result += str((dt.weekday() + 1) % 7)
                elif code == "W":
                    result += dt.strftime("%W")
                elif code == "Y":
                    result += dt.strftime("%Y")
                elif code == "y":
                    result += dt.strftime("%y")
                elif code == "z":
                    result += dt.strftime("%z") or "+0000"
                elif code == "Z":
                    result += dt.strftime("%Z") or "UTC"
                else:
                    result += "%" + code
                i += 2
            else:
                result += fmt[i]
                i += 1
        return result
