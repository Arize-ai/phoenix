"""Jq command implementation.

Usage: jq [OPTIONS] FILTER [FILE...]

JSON processor using jq-style expressions.

Options:
  -r, --raw-output     output strings without quotes
  -c, --compact        compact output (no pretty printing)
  -s, --slurp          read all inputs into an array
  -e                   exit with 1 if last output is false or null
  -n, --null-input     don't read any input
  -R, --raw-input      read each line as a string
  -j, --join-output    no newlines between outputs
  -S, --sort-keys      sort object keys alphabetically
  --tab                use tabs for indentation
  -a, --ascii-output   escape non-ASCII characters

Filters:
  .                   identity (output input unchanged)
  .foo                object field access
  .foo.bar            nested field access
  .[N]                array index access
  .[]                 array/object iterator
  .[N:M]              array slice
  |                   pipe (chain filters)
  ,                   output multiple values
  select(expr)        filter values
  map(expr)           apply expression to each element
  keys                get object keys
  values              get object values
  length              get length
  type                get type name
  empty               output nothing
  add                 sum/concatenate
  first, last         first/last element
  reverse             reverse array
  sort                sort array
  unique              unique elements
  flatten             flatten nested arrays
  group_by(expr)      group by expression
  min, max            minimum/maximum
  has(key)            check if key exists
  in(object)          check if key is in object
  contains(x)         check if contains x
  split(s)            split string by s
  join(s)             join array by s
  ascii_downcase      lowercase
  ascii_upcase        uppercase
  ltrimstr(s)         remove prefix
  rtrimstr(s)         remove suffix
  startswith(s)       check prefix
  endswith(s)         check suffix
  test(regex)         regex match
  @base64             encode to base64
  @base64d            decode from base64
  @uri                URI encode
  @csv                CSV format
  @json               JSON encode
  @text               convert to text
"""

import json
from typing import Any
from ...types import CommandContext, ExecResult
from ...query_engine import parse, evaluate, EvalContext


class JqCommand:
    """The jq command."""

    name = "jq"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the jq command."""
        raw_output = False
        compact = False
        slurp = False
        exit_on_false = False
        null_input = False
        raw_input = False
        join_output = False
        sort_keys = False
        use_tabs = False
        ascii_output = False
        filter_str: str | None = None
        files: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg in ("-r", "--raw-output"):
                raw_output = True
            elif arg in ("-c", "--compact"):
                compact = True
            elif arg in ("-s", "--slurp"):
                slurp = True
            elif arg == "-e":
                exit_on_false = True
            elif arg in ("-n", "--null-input"):
                null_input = True
            elif arg in ("-R", "--raw-input"):
                raw_input = True
            elif arg in ("-j", "--join-output"):
                join_output = True
            elif arg in ("-S", "--sort-keys"):
                sort_keys = True
            elif arg == "--tab":
                use_tabs = True
            elif arg in ("-a", "--ascii-output"):
                ascii_output = True
            elif arg.startswith("-") and len(arg) > 1 and not (filter_str is None and (arg[1:2].isdigit() or arg[1:2] == ".")):
                # Combined flags (but not if it looks like a negative number/expression and no filter set)
                for c in arg[1:]:
                    if c == "r":
                        raw_output = True
                    elif c == "c":
                        compact = True
                    elif c == "s":
                        slurp = True
                    elif c == "e":
                        exit_on_false = True
                    elif c == "n":
                        null_input = True
                    elif c == "R":
                        raw_input = True
                    elif c == "j":
                        join_output = True
                    elif c == "S":
                        sort_keys = True
                    elif c == "a":
                        ascii_output = True
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"jq: Unknown option: -{c}\n",
                            exit_code=2,
                        )
            elif filter_str is None:
                # First positional argument is the filter
                filter_str = arg
            else:
                files.append(arg)
            i += 1

        # Default filter if none provided
        if filter_str is None:
            filter_str = "."

        # Parse the filter using query engine
        try:
            ast = parse(filter_str)
        except ValueError as e:
            return ExecResult(
                stdout="",
                stderr=f"jq: {e}\n",
                exit_code=2,
            )

        # Get input
        inputs: list[Any] = []
        stderr = ""

        if null_input:
            inputs = [None]
        elif not files:
            files = ["-"]

        for f in files:
            try:
                if f == "-":
                    content = ctx.stdin
                else:
                    path = ctx.fs.resolve_path(ctx.cwd, f)
                    content = await ctx.fs.read_file(path)

                if raw_input:
                    # Each line is a string
                    for line in content.split("\n"):
                        if line:
                            inputs.append(line)
                else:
                    # Parse JSON
                    content = content.strip()
                    if content:
                        # Handle multiple JSON objects
                        decoder = json.JSONDecoder()
                        pos = 0
                        while pos < len(content):
                            # Skip whitespace
                            while pos < len(content) and content[pos] in " \t\n\r":
                                pos += 1
                            if pos >= len(content):
                                break
                            try:
                                obj, end = decoder.raw_decode(content, pos)
                                inputs.append(obj)
                                pos = end
                            except json.JSONDecodeError as e:
                                stderr += f"jq: parse error: {e}\n"
                                break

            except FileNotFoundError:
                stderr += f"jq: error: {f}: No such file or directory\n"

        if stderr:
            return ExecResult(stdout="", stderr=stderr, exit_code=2)

        # Apply slurp
        if slurp and not null_input:
            inputs = [inputs]

        # Create evaluation context
        eval_ctx = EvalContext(env=dict(ctx.env))

        # Apply filter using query engine
        outputs: list[Any] = []
        for inp in inputs:
            try:
                results = evaluate(inp, ast, eval_ctx)
                outputs.extend(results)
            except Exception as e:
                stderr += f"jq: error: {e}\n"

        # Format output
        output = ""
        for val in outputs:
            formatted = self._format_value(
                val, raw_output, compact, sort_keys, use_tabs, ascii_output
            )
            if join_output:
                output += formatted
            else:
                output += formatted + "\n"

        # Determine exit code
        exit_code = 0
        if exit_on_false and outputs:
            last = outputs[-1]
            if last is None or last is False:
                exit_code = 1

        if stderr:
            return ExecResult(stdout=output, stderr=stderr, exit_code=2)

        return ExecResult(stdout=output, stderr="", exit_code=exit_code)

    def _format_value(
        self,
        value: Any,
        raw: bool,
        compact: bool,
        sort_keys: bool = False,
        use_tabs: bool = False,
        ascii_output: bool = False,
    ) -> str:
        """Format a value for output."""
        if value is None:
            return "null"
        elif isinstance(value, bool):
            return "true" if value else "false"
        elif isinstance(value, str):
            if raw:
                return value
            return json.dumps(value, ensure_ascii=ascii_output)
        elif isinstance(value, (int, float)):
            return json.dumps(value)
        else:
            indent_val = "\t" if use_tabs else (None if compact else 2)
            return json.dumps(
                value,
                indent=indent_val,
                separators=(",", ":") if compact else None,
                sort_keys=sort_keys,
                ensure_ascii=ascii_output,
            )
