"""Awk command implementation.

Usage: awk [OPTIONS] 'program' [file ...]

Pattern scanning and processing language.

Options:
  -F fs         field separator (default: whitespace)
  -v var=value  assign variable before execution
  -f progfile   read program from file

Program structure:
  pattern { action }
  BEGIN { action }
  END { action }

Variables:
  $0            entire line
  $1, $2, ...   fields
  NF            number of fields
  NR            record number
  FS            field separator
  OFS           output field separator
  ORS           output record separator
  RSTART        start of match (set by match())
  RLENGTH       length of match (set by match())

Built-in functions:
  length(s)     string length
  substr(s,i,n) substring
  index(s,t)    position of t in s
  split(s,a,fs) split s into array a
  sub(r,s)      substitute first match
  gsub(r,s)     substitute all matches
  match(s,r)    find regex r in s, set RSTART/RLENGTH
  tolower(s)    convert to lowercase
  toupper(s)    convert to uppercase
  sprintf(fmt,args...)  return formatted string
  printf(fmt,args...)   formatted print
  print         print current line

Math functions:
  int(x)        truncate to integer
  sqrt(x)       square root
  sin(x)        sine
  cos(x)        cosine
  log(x)        natural logarithm
  exp(x)        exponential
  atan2(y,x)    arctangent of y/x

Random functions:
  rand()        random number 0 <= n < 1
  srand([seed]) seed random generator

Time functions:
  systime()     current epoch timestamp
  strftime(fmt,ts)  format timestamp
"""

import math
import random
import re
import time
from dataclasses import dataclass, field
from typing import Any
from ...types import CommandContext, ExecResult


@dataclass
class AwkRule:
    """An awk pattern-action rule."""

    pattern: str | None  # None means always match, "BEGIN", "END", or pattern
    action: str
    is_regex: bool = False
    regex: re.Pattern | None = None
    negate: bool = False  # ! pattern negation


@dataclass
class AwkState:
    """Execution state for awk."""

    variables: dict[str, Any] = field(default_factory=dict)
    output: str = ""
    next_record: bool = False
    exit_program: bool = False
    rng: random.Random = field(default_factory=random.Random)


class AwkCommand:
    """The awk command."""

    name = "awk"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the awk command."""
        field_sep = None
        program = None
        pre_vars: list[tuple[str, str]] = []
        files: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "-F":
                if i + 1 < len(args):
                    i += 1
                    field_sep = self._unescape_field_sep(args[i])
                else:
                    return ExecResult(
                        stdout="",
                        stderr="awk: option requires an argument -- 'F'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-F"):
                field_sep = self._unescape_field_sep(arg[2:])
            elif arg == "-v":
                if i + 1 < len(args):
                    i += 1
                    var_assign = args[i]
                    if "=" in var_assign:
                        name, val = var_assign.split("=", 1)
                        pre_vars.append((name, val))
                else:
                    return ExecResult(
                        stdout="",
                        stderr="awk: option requires an argument -- 'v'\n",
                        exit_code=1,
                    )
            elif arg == "-f":
                if i + 1 < len(args):
                    i += 1
                    try:
                        path = ctx.fs.resolve_path(ctx.cwd, args[i])
                        program = await ctx.fs.read_file(path)
                    except FileNotFoundError:
                        return ExecResult(
                            stdout="",
                            stderr=f"awk: can't open file {args[i]}\n",
                            exit_code=1,
                        )
                else:
                    return ExecResult(
                        stdout="",
                        stderr="awk: option requires an argument -- 'f'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-") and len(arg) > 1:
                return ExecResult(
                    stdout="",
                    stderr=f"awk: unknown option '{arg}'\n",
                    exit_code=1,
                )
            elif program is None:
                program = arg
            else:
                files.append(arg)
            i += 1

        if program is None:
            return ExecResult(
                stdout="",
                stderr="awk: no program given\n",
                exit_code=1,
            )

        # Parse program
        try:
            rules = self._parse_program(program)
        except ValueError as e:
            return ExecResult(
                stdout="",
                stderr=f"awk: {e}\n",
                exit_code=1,
            )

        # Initialize state
        state = AwkState(
            variables={
                "FS": field_sep or " ",
                "OFS": " ",
                "ORS": "\n",
                "NR": 0,
                "NF": 0,
                "FILENAME": "",
            }
        )

        # Set pre-assigned variables
        for name, val in pre_vars:
            state.variables[name] = self._parse_value(val)

        # Execute BEGIN rules
        for rule in rules:
            if rule.pattern == "BEGIN":
                self._execute_action(rule.action, state, [])

        # Default to stdin
        if not files:
            files = ["-"]

        stderr = ""

        # Process files
        for fname in files:
            if state.exit_program:
                break

            try:
                if fname == "-":
                    content = ctx.stdin
                    state.variables["FILENAME"] = ""
                else:
                    path = ctx.fs.resolve_path(ctx.cwd, fname)
                    content = await ctx.fs.read_file(path)
                    state.variables["FILENAME"] = fname

                lines = content.split("\n")
                if lines and lines[-1] == "":
                    lines = lines[:-1]

                for line in lines:
                    if state.exit_program:
                        break

                    state.variables["NR"] = state.variables.get("NR", 0) + 1
                    state.next_record = False

                    # Split into fields
                    fs = state.variables.get("FS", " ")
                    if fs == " ":
                        fields = line.split()
                    else:
                        fields = line.split(fs)

                    state.variables["NF"] = len(fields)

                    # Execute matching rules
                    for rule in rules:
                        if state.next_record or state.exit_program:
                            break

                        if rule.pattern in ("BEGIN", "END"):
                            continue

                        if self._pattern_matches(rule, line, state):
                            self._execute_action(rule.action, state, fields, line)

            except FileNotFoundError:
                stderr += f"awk: can't open file {fname}\n"

        # Execute END rules
        for rule in rules:
            if rule.pattern == "END":
                self._execute_action(rule.action, state, [])

        if stderr:
            return ExecResult(stdout=state.output, stderr=stderr, exit_code=1)

        return ExecResult(stdout=state.output, stderr="", exit_code=0)

    def _parse_program(self, program: str) -> list[AwkRule]:
        """Parse an awk program into rules."""
        rules: list[AwkRule] = []

        # Simple parser for pattern { action } blocks
        program = program.strip()
        pos = 0

        while pos < len(program):
            # Skip whitespace and comments
            while pos < len(program) and program[pos] in " \t\n":
                pos += 1

            if pos >= len(program):
                break

            # Check for comment
            if program[pos] == "#":
                while pos < len(program) and program[pos] != "\n":
                    pos += 1
                continue

            # Parse pattern
            pattern = None
            is_regex = False
            regex = None

            negate_pattern = False

            if program[pos:].startswith("BEGIN"):
                pattern = "BEGIN"
                pos += 5
            elif program[pos:].startswith("END"):
                pattern = "END"
                pos += 3
            elif program[pos] == "!" and pos + 1 < len(program) and program[pos + 1] == "/":
                # Negated regex pattern
                negate_pattern = True
                pos += 1  # skip '!', now pos is at '/'
                end = self._find_regex_end(program, pos + 1)
                if end != -1:
                    pattern = program[pos + 1:end]
                    is_regex = True
                    try:
                        regex = re.compile(pattern)
                    except re.error as e:
                        raise ValueError(f"invalid regex: {e}")
                    pos = end + 1
            elif program[pos] == "/":
                # Regex pattern
                end = self._find_regex_end(program, pos + 1)
                if end != -1:
                    pattern = program[pos + 1:end]
                    is_regex = True
                    try:
                        regex = re.compile(pattern)
                    except re.error as e:
                        raise ValueError(f"invalid regex: {e}")
                    pos = end + 1
            elif program[pos] == "{":
                # No pattern, always match
                pass
            else:
                # Expression pattern (simplified: just match literal or variable comparison)
                expr_end = pos
                while expr_end < len(program) and program[expr_end] not in "{\n":
                    expr_end += 1
                pattern = program[pos:expr_end].strip()
                if pattern:
                    pos = expr_end
                else:
                    pattern = None

            # Skip whitespace
            while pos < len(program) and program[pos] in " \t\n":
                pos += 1

            if pos >= len(program):
                break

            # Parse action
            if program[pos] == "{":
                brace_count = 1
                start = pos + 1
                pos += 1
                while pos < len(program) and brace_count > 0:
                    if program[pos] == "{":
                        brace_count += 1
                    elif program[pos] == "}":
                        brace_count -= 1
                    elif program[pos] == '"':
                        # Skip string
                        pos += 1
                        while pos < len(program) and program[pos] != '"':
                            if program[pos] == "\\":
                                pos += 1
                            pos += 1
                    elif program[pos] == "'":
                        pos += 1
                        while pos < len(program) and program[pos] != "'":
                            pos += 1
                    pos += 1

                action = program[start:pos - 1].strip()
                rules.append(AwkRule(pattern=pattern, action=action, is_regex=is_regex, regex=regex, negate=negate_pattern))
            else:
                # Default action is print $0
                rules.append(AwkRule(pattern=pattern, action="print", is_regex=is_regex, regex=regex, negate=negate_pattern))

        return rules

    def _find_regex_end(self, s: str, start: int) -> int:
        """Find the end of a regex pattern."""
        pos = start
        while pos < len(s):
            if s[pos] == "\\":
                pos += 2
            elif s[pos] == "/":
                return pos
            else:
                pos += 1
        return -1

    def _pattern_matches(self, rule: AwkRule, line: str, state: AwkState) -> bool:
        """Check if a pattern matches the current line."""
        if rule.pattern is None:
            return True

        if rule.is_regex and rule.regex:
            result = bool(rule.regex.search(line))
            return not result if rule.negate else result

        # Expression pattern
        pattern = rule.pattern

        # Simple expression evaluation
        if "~" in pattern:
            # Regex match
            parts = pattern.split("~", 1)
            left = self._eval_expr(parts[0].strip(), state, line)
            right = parts[1].strip().strip("/")
            try:
                return bool(re.search(right, str(left)))
            except re.error:
                return False

        if "==" in pattern:
            parts = pattern.split("==", 1)
            left = self._eval_expr(parts[0].strip(), state, line)
            right = self._eval_expr(parts[1].strip(), state, line)
            return left == right

        if "!=" in pattern:
            parts = pattern.split("!=", 1)
            left = self._eval_expr(parts[0].strip(), state, line)
            right = self._eval_expr(parts[1].strip(), state, line)
            return left != right

        if ">" in pattern:
            parts = pattern.split(">", 1)
            left = self._eval_expr(parts[0].strip(), state, line)
            right = self._eval_expr(parts[1].strip(), state, line)
            try:
                return float(left) > float(right)
            except ValueError:
                return str(left) > str(right)

        if "<" in pattern:
            parts = pattern.split("<", 1)
            left = self._eval_expr(parts[0].strip(), state, line)
            right = self._eval_expr(parts[1].strip(), state, line)
            try:
                return float(left) < float(right)
            except ValueError:
                return str(left) < str(right)

        # Just evaluate as truthy
        result = self._eval_expr(pattern, state, line)
        if isinstance(result, str):
            return len(result) > 0
        return bool(result)

    def _execute_action(
        self, action: str, state: AwkState, fields: list[str], line: str = ""
    ) -> None:
        """Execute an awk action."""
        # Split action into statements
        statements = self._split_statements(action)

        for stmt in statements:
            if state.next_record or state.exit_program:
                break

            stmt = stmt.strip()
            if not stmt:
                continue

            self._execute_statement(stmt, state, fields, line)

    def _split_statements(self, action: str) -> list[str]:
        """Split action into individual statements."""
        statements = []
        current = ""
        brace_depth = 0
        paren_depth = 0
        in_string = False
        escape = False

        for char in action:
            if escape:
                current += char
                escape = False
                continue

            if char == "\\":
                escape = True
                current += char
                continue

            if char == '"' and not in_string:
                in_string = True
                current += char
            elif char == '"' and in_string:
                in_string = False
                current += char
            elif in_string:
                current += char
            elif char == "{":
                brace_depth += 1
                current += char
            elif char == "}":
                brace_depth -= 1
                current += char
            elif char == "(":
                paren_depth += 1
                current += char
            elif char == ")":
                paren_depth -= 1
                current += char
            elif char in ";\n" and brace_depth == 0 and paren_depth == 0:
                if current.strip():
                    statements.append(current.strip())
                current = ""
            else:
                current += char

        if current.strip():
            statements.append(current.strip())

        # Merge 'else' parts back into their preceding 'if' statement
        merged = []
        for stmt in statements:
            if stmt.startswith("else") and merged and merged[-1].lstrip().startswith("if"):
                merged[-1] = merged[-1] + "; " + stmt
            else:
                merged.append(stmt)

        return merged

    def _execute_statement(
        self, stmt: str, state: AwkState, fields: list[str], line: str
    ) -> None:
        """Execute a single awk statement."""
        stmt = stmt.strip()

        # Handle next
        if stmt == "next":
            state.next_record = True
            return

        # Handle exit
        if stmt.startswith("exit"):
            state.exit_program = True
            return

        # Handle print
        if stmt == "print" or stmt == "print $0":
            # Use modified line if gsub/sub was called
            current_line = state.variables.get("__line__", line)
            state.output += current_line + state.variables.get("ORS", "\n")
            return

        if stmt.startswith("print "):
            args = stmt[6:].strip()
            values = self._parse_print_args(args, state, fields, line)
            ofs = state.variables.get("OFS", " ")
            ors = state.variables.get("ORS", "\n")
            state.output += ofs.join(self._format_number(v) for v in values) + ors
            return

        # Handle printf
        if stmt.startswith("printf"):
            match = re.match(r"printf\s*\(?\s*(.+?)\s*\)?$", stmt)
            if match:
                args_str = match.group(1)
                self._execute_printf(args_str, state, fields, line)
            return

        # Handle if statement
        if stmt.startswith("if"):
            self._execute_if(stmt, state, fields, line)
            return

        # Handle for statement
        if stmt.startswith("for"):
            self._execute_for(stmt, state, fields, line)
            return

        # Handle while statement
        if stmt.startswith("while"):
            self._execute_while(stmt, state, fields, line)
            return

        # Handle gsub (global substitution)
        if stmt.startswith("gsub("):
            match = re.match(r"gsub\s*\((.+)\)", stmt)
            if match:
                args = self._split_args(match.group(1))
                if len(args) >= 2:
                    pattern = args[0].strip()
                    if pattern.startswith("/") and pattern.endswith("/"):
                        pattern = pattern[1:-1]
                    replacement = str(self._eval_expr(args[1], state, line, fields))
                    # Default target is $0 (the line)
                    if len(args) >= 3:
                        target_var = args[2].strip()
                    else:
                        target_var = None
                    try:
                        if target_var:
                            original = str(state.variables.get(target_var, ""))
                            new_val = re.sub(pattern, replacement, original)
                            state.variables[target_var] = new_val
                        else:
                            # Modify $0 - need to update fields array
                            new_line = re.sub(pattern, replacement, line)
                            # Update fields based on new line
                            fs = state.variables.get("FS", " ")
                            if fs == " ":
                                new_fields = new_line.split()
                            else:
                                new_fields = new_line.split(fs)
                            fields.clear()
                            fields.extend(new_fields)
                            state.variables["NF"] = len(new_fields)
                            # Store the modified line for later use
                            state.variables["__line__"] = new_line
                    except re.error:
                        pass
            return

        # Handle sub (single substitution)
        if stmt.startswith("sub("):
            match = re.match(r"sub\s*\((.+)\)", stmt)
            if match:
                args = self._split_args(match.group(1))
                if len(args) >= 2:
                    pattern = args[0].strip()
                    if pattern.startswith("/") and pattern.endswith("/"):
                        pattern = pattern[1:-1]
                    replacement = str(self._eval_expr(args[1], state, line, fields))
                    if len(args) >= 3:
                        target_var = args[2].strip()
                    else:
                        target_var = None
                    try:
                        if target_var:
                            original = str(state.variables.get(target_var, ""))
                            new_val = re.sub(pattern, replacement, original, count=1)
                            state.variables[target_var] = new_val
                        else:
                            new_line = re.sub(pattern, replacement, line, count=1)
                            fs = state.variables.get("FS", " ")
                            if fs == " ":
                                new_fields = new_line.split()
                            else:
                                new_fields = new_line.split(fs)
                            fields.clear()
                            fields.extend(new_fields)
                            state.variables["NF"] = len(new_fields)
                            state.variables["__line__"] = new_line
                    except re.error:
                        pass
            return

        # Handle delete statement
        if stmt.startswith("delete "):
            target = stmt[7:].strip()
            match = re.match(r"(\w+)\[(.+)\]", target)
            if match:
                arr_name = match.group(1)
                idx = self._eval_expr(match.group(2).strip(), state, line, fields)
                key = f"{arr_name}[{idx}]"
                state.variables.pop(key, None)
            return

        # Handle match() as a statement (for side effects on RSTART/RLENGTH)
        if stmt.startswith("match("):
            # Just evaluate it - _eval_expr will set RSTART/RLENGTH
            self._eval_expr(stmt, state, line, fields)
            return

        # Handle srand() as a statement
        if stmt.startswith("srand(") or stmt == "srand()":
            self._eval_expr(stmt, state, line, fields)
            return

        # Handle assignment
        if "=" in stmt and not stmt.startswith("if") and "==" not in stmt and "!=" not in stmt:
            # Handle += -= *= /=
            for op in ["+=", "-=", "*=", "/="]:
                if op in stmt:
                    parts = stmt.split(op, 1)
                    var = parts[0].strip()
                    val = self._eval_expr(parts[1].strip(), state, line, fields)
                    current = state.variables.get(var, 0)
                    try:
                        current = float(current)
                        val = float(val)
                    except (ValueError, TypeError):
                        current = 0
                        val = 0
                    if op == "+=":
                        state.variables[var] = current + val
                    elif op == "-=":
                        state.variables[var] = current - val
                    elif op == "*=":
                        state.variables[var] = current * val
                    elif op == "/=":
                        state.variables[var] = current / val if val != 0 else 0
                    return

            # Array element assignment: arr[idx] = val
            match = re.match(r"(\w+)\[(.+?)\]\s*=\s*(.+)", stmt)
            if match:
                arr_name = match.group(1)
                idx = self._eval_expr(match.group(2).strip(), state, line, fields)
                val = self._eval_expr(match.group(3).strip(), state, line, fields)
                key = f"{arr_name}[{idx}]"
                state.variables[key] = val
                return

            # Simple assignment
            match = re.match(r"(\w+)\s*=\s*(.+)", stmt)
            if match:
                var = match.group(1)
                val = self._eval_expr(match.group(2).strip(), state, line, fields)
                state.variables[var] = val
                return

            # Field assignment ($N = val)
            match = re.match(r"\$(\d+)\s*=\s*(.+)", stmt)
            if match:
                field_num = int(match.group(1))
                val = self._eval_expr(match.group(2).strip(), state, line, fields)
                # Extend fields if necessary
                while len(fields) < field_num:
                    fields.append("")
                if field_num > 0:
                    fields[field_num - 1] = str(val)
                # Reconstruct $0 from modified fields
                ofs = state.variables.get("OFS", " ")
                state.variables["__line__"] = ofs.join(fields)
                state.variables["NF"] = len(fields)
                return

        # Handle increment/decrement
        if stmt.endswith("++"):
            var = stmt[:-2].strip()
            current = state.variables.get(var, 0)
            try:
                state.variables[var] = float(current) + 1
            except (ValueError, TypeError):
                state.variables[var] = 1
            return

        if stmt.endswith("--"):
            var = stmt[:-2].strip()
            current = state.variables.get(var, 0)
            try:
                state.variables[var] = float(current) - 1
            except (ValueError, TypeError):
                state.variables[var] = -1
            return

    def _eval_expr(
        self, expr: str, state: AwkState, line: str, fields: list[str] | None = None
    ) -> Any:
        """Evaluate an awk expression."""
        expr = expr.strip()

        if fields is None:
            fields = []

        # String literal
        if expr.startswith('"') and expr.endswith('"'):
            return self._unescape_string(expr[1:-1])

        # Number
        try:
            if "." in expr:
                return float(expr)
            return int(expr)
        except ValueError:
            pass

        # Field reference
        if expr.startswith("$"):
            rest = expr[1:]
            if rest == "0":
                return line
            try:
                idx = int(rest)
                if 0 < idx <= len(fields):
                    return fields[idx - 1]
                return ""
            except ValueError:
                # Could be $NF or $(expr)
                if rest == "NF":
                    nf = len(fields)
                    if nf > 0:
                        return fields[nf - 1]
                    return ""

        # Built-in variables
        if expr in ("NR", "NF", "FS", "OFS", "ORS", "FILENAME"):
            return state.variables.get(expr, "")

        # Array element access (arr[idx])
        array_match = re.match(r"^([a-zA-Z_]\w*)\[(.+)\]$", expr)
        if array_match:
            arr_name = array_match.group(1)
            idx = self._eval_expr(array_match.group(2), state, line, fields)
            key = f"{arr_name}[{idx}]"
            return state.variables.get(key, "")

        # User variables
        if re.match(r"^[a-zA-Z_]\w*$", expr):
            return state.variables.get(expr, "")

        # Built-in functions
        if expr.startswith("length("):
            match = re.match(r"length\((.+)\)", expr)
            if match:
                arg = self._eval_expr(match.group(1), state, line, fields)
                return len(str(arg))

        if expr.startswith("substr("):
            match = re.match(r"substr\((.+)\)", expr)
            if match:
                args = self._split_args(match.group(1))
                if len(args) >= 2:
                    s = str(self._eval_expr(args[0], state, line, fields))
                    start = int(self._eval_expr(args[1], state, line, fields)) - 1
                    if len(args) >= 3:
                        length = int(self._eval_expr(args[2], state, line, fields))
                        return s[start:start + length]
                    return s[start:]
            return ""

        if expr.startswith("index("):
            match = re.match(r"index\((.+)\)", expr)
            if match:
                args = self._split_args(match.group(1))
                if len(args) >= 2:
                    s = str(self._eval_expr(args[0], state, line, fields))
                    t = str(self._eval_expr(args[1], state, line, fields))
                    idx = s.find(t)
                    return idx + 1 if idx >= 0 else 0
            return 0

        if expr.startswith("tolower("):
            match = re.match(r"tolower\((.+)\)", expr)
            if match:
                arg = self._eval_expr(match.group(1), state, line, fields)
                return str(arg).lower()
            return ""

        if expr.startswith("toupper("):
            match = re.match(r"toupper\((.+)\)", expr)
            if match:
                arg = self._eval_expr(match.group(1), state, line, fields)
                return str(arg).upper()
            return ""

        if expr.startswith("int("):
            match = re.match(r"int\((.+)\)", expr)
            if match:
                arg = self._eval_expr(match.group(1), state, line, fields)
                try:
                    return int(float(arg))
                except (ValueError, TypeError):
                    return 0
            return 0

        if expr.startswith("sqrt("):
            match = re.match(r"sqrt\((.+)\)", expr)
            if match:
                arg = self._eval_expr(match.group(1), state, line, fields)
                try:
                    return math.sqrt(float(arg))
                except (ValueError, TypeError):
                    return 0
            return 0

        if expr.startswith("sin("):
            match = re.match(r"sin\((.+)\)", expr)
            if match:
                arg = self._eval_expr(match.group(1), state, line, fields)
                try:
                    return math.sin(float(arg))
                except (ValueError, TypeError):
                    return 0
            return 0

        if expr.startswith("cos("):
            match = re.match(r"cos\((.+)\)", expr)
            if match:
                arg = self._eval_expr(match.group(1), state, line, fields)
                try:
                    return math.cos(float(arg))
                except (ValueError, TypeError):
                    return 0
            return 0

        if expr.startswith("log("):
            match = re.match(r"log\((.+)\)", expr)
            if match:
                arg = self._eval_expr(match.group(1), state, line, fields)
                try:
                    return math.log(float(arg))
                except (ValueError, TypeError):
                    return 0
            return 0

        if expr.startswith("exp("):
            match = re.match(r"exp\((.+)\)", expr)
            if match:
                arg = self._eval_expr(match.group(1), state, line, fields)
                try:
                    return math.exp(float(arg))
                except (ValueError, TypeError):
                    return 0
            return 0

        if expr.startswith("split("):
            match = re.match(r"split\((.+)\)", expr)
            if match:
                args = self._split_args(match.group(1))
                if len(args) >= 2:
                    s = str(self._eval_expr(args[0], state, line, fields))
                    arr_name = args[1].strip()
                    sep = state.variables.get("FS", " ")
                    if len(args) >= 3:
                        sep = str(self._eval_expr(args[2], state, line, fields))
                    if sep == " ":
                        parts = s.split()
                    else:
                        parts = s.split(sep)
                    # Store array elements
                    for i, part in enumerate(parts):
                        state.variables[f"{arr_name}[{i+1}]"] = part
                    return len(parts)
            return 0

        # rand() - return random number 0 <= n < 1
        if expr == "rand()":
            return state.rng.random()

        # srand([seed]) - seed the random number generator
        if expr.startswith("srand(") or expr == "srand()":
            match = re.match(r"srand\(([^)]*)\)", expr)
            if match:
                seed_str = match.group(1).strip()
                if seed_str:
                    seed = self._eval_expr(seed_str, state, line, fields)
                    try:
                        state.rng.seed(int(float(seed)))
                    except (ValueError, TypeError):
                        state.rng.seed(int(time.time()))
                else:
                    state.rng.seed(int(time.time()))
                return 0  # srand returns previous seed, but we just return 0

        # sprintf(fmt, args...) - return formatted string
        if expr.startswith("sprintf("):
            match = re.match(r"sprintf\((.+)\)", expr)
            if match:
                args = self._split_args(match.group(1))
                if args:
                    fmt = str(self._eval_expr(args[0], state, line, fields))
                    values = [self._eval_expr(a, state, line, fields) for a in args[1:]]
                    return self._format_string(fmt, values)
            return ""

        # match(s, r) - return position of regex match, set RSTART and RLENGTH
        if expr.startswith("match("):
            match_call = re.match(r"match\((.+)\)", expr)
            if match_call:
                args = self._split_args(match_call.group(1))
                if len(args) >= 2:
                    s = str(self._eval_expr(args[0], state, line, fields))
                    pattern = args[1].strip()
                    # Handle /regex/ syntax
                    if pattern.startswith("/") and pattern.endswith("/"):
                        pattern = pattern[1:-1]
                    try:
                        regex_match = re.search(pattern, s)
                        if regex_match:
                            pos = regex_match.start() + 1  # 1-based
                            length = regex_match.end() - regex_match.start()
                            state.variables["RSTART"] = pos
                            state.variables["RLENGTH"] = length
                            return pos
                        else:
                            state.variables["RSTART"] = 0
                            state.variables["RLENGTH"] = -1
                            return 0
                    except re.error:
                        state.variables["RSTART"] = 0
                        state.variables["RLENGTH"] = -1
                        return 0
            return 0

        # atan2(y, x) - arctangent of y/x
        if expr.startswith("atan2("):
            match = re.match(r"atan2\((.+)\)", expr)
            if match:
                args = self._split_args(match.group(1))
                if len(args) >= 2:
                    y = self._eval_expr(args[0], state, line, fields)
                    x = self._eval_expr(args[1], state, line, fields)
                    try:
                        return math.atan2(float(y), float(x))
                    except (ValueError, TypeError):
                        return 0
            return 0

        # systime() - return current epoch timestamp
        if expr == "systime()":
            return int(time.time())

        # strftime(fmt, timestamp) - format timestamp as string
        if expr.startswith("strftime("):
            match = re.match(r"strftime\((.+)\)", expr)
            if match:
                args = self._split_args(match.group(1))
                if args:
                    fmt = str(self._eval_expr(args[0], state, line, fields))
                    if len(args) >= 2:
                        timestamp = self._eval_expr(args[1], state, line, fields)
                        try:
                            timestamp = int(float(timestamp))
                        except (ValueError, TypeError):
                            timestamp = int(time.time())
                    else:
                        timestamp = int(time.time())
                    try:
                        return time.strftime(fmt, time.localtime(timestamp))
                    except (ValueError, OSError):
                        return ""
            return ""

        # Arithmetic - check for operators (including with spaces like "2 + 3")
        for op in ["+", "-", "*", "/", "%"]:
            if op in expr:
                # Find the operator not in a function call
                depth = 0
                in_str = False
                for i, c in enumerate(expr):
                    if c == '"' and (i == 0 or expr[i-1] != '\\'):
                        in_str = not in_str
                    elif not in_str:
                        if c == "(":
                            depth += 1
                        elif c == ")":
                            depth -= 1
                        elif c == op and depth == 0 and i > 0:
                            left = self._eval_expr(expr[:i].strip(), state, line, fields)
                            right = self._eval_expr(expr[i + 1:].strip(), state, line, fields)
                            try:
                                left = float(left)
                                right = float(right)
                                if op == "+":
                                    return left + right
                                elif op == "-":
                                    return left - right
                                elif op == "*":
                                    return left * right
                                elif op == "/":
                                    return left / right if right != 0 else 0
                                elif op == "%":
                                    return left % right if right != 0 else 0
                            except (ValueError, TypeError):
                                return 0

        # String concatenation (spaces between expressions - no operators)
        if " " in expr and not expr.startswith('"'):
            parts = expr.split()
            result = ""
            for part in parts:
                val = self._eval_expr(part, state, line, fields)
                result += str(val)
            return result

        return expr

    def _split_args(self, args_str: str) -> list[str]:
        """Split function arguments."""
        args = []
        current = ""
        depth = 0
        in_string = False

        for char in args_str:
            if char == '"' and not in_string:
                in_string = True
                current += char
            elif char == '"' and in_string:
                in_string = False
                current += char
            elif in_string:
                current += char
            elif char == "(":
                depth += 1
                current += char
            elif char == ")":
                depth -= 1
                current += char
            elif char == "," and depth == 0:
                args.append(current.strip())
                current = ""
            else:
                current += char

        if current.strip():
            args.append(current.strip())

        return args

    def _parse_print_args(
        self, args: str, state: AwkState, fields: list[str], line: str
    ) -> list[Any]:
        """Parse arguments to print."""
        result = []

        # Split by comma
        parts = self._split_args(args)
        for part in parts:
            val = self._eval_expr(part.strip(), state, line, fields)
            result.append(val)

        return result

    def _execute_printf(
        self, args_str: str, state: AwkState, fields: list[str], line: str
    ) -> None:
        """Execute printf statement."""
        args = self._split_args(args_str)
        if not args:
            return

        fmt = self._eval_expr(args[0], state, line, fields)
        fmt = str(fmt)

        values = [self._eval_expr(a, state, line, fields) for a in args[1:]]

        # Convert format specifiers
        result = ""
        i = 0
        val_idx = 0

        while i < len(fmt):
            if fmt[i] == "\\" and i + 1 < len(fmt):
                c = fmt[i + 1]
                if c == "n":
                    result += "\n"
                elif c == "t":
                    result += "\t"
                elif c == "\\":
                    result += "\\"
                else:
                    result += c
                i += 2
            elif fmt[i] == "%" and i + 1 < len(fmt):
                # Parse format spec
                j = i + 1
                while j < len(fmt) and fmt[j] in "-+0 #":
                    j += 1
                while j < len(fmt) and fmt[j].isdigit():
                    j += 1
                if j < len(fmt) and fmt[j] == ".":
                    j += 1
                    while j < len(fmt) and fmt[j].isdigit():
                        j += 1
                if j < len(fmt):
                    spec = fmt[i:j + 1]
                    conv = fmt[j]
                    if val_idx < len(values):
                        val = values[val_idx]
                        val_idx += 1
                        try:
                            if conv in "diouxX":
                                result += spec % int(float(val))
                            elif conv in "eEfFgG":
                                result += spec % float(val)
                            elif conv == "s":
                                result += spec % str(val)
                            elif conv == "%":
                                result += "%"
                            else:
                                result += spec % val
                        except (ValueError, TypeError):
                            result += str(val)
                    i = j + 1
                else:
                    result += fmt[i]
                    i += 1
            else:
                result += fmt[i]
                i += 1

        state.output += result

    def _execute_if(
        self, stmt: str, state: AwkState, fields: list[str], line: str
    ) -> None:
        """Execute an if statement."""
        # Find the condition by matching balanced parentheses
        if not stmt.startswith("if"):
            return

        # Find opening paren
        paren_start = stmt.find("(")
        if paren_start == -1:
            return

        # Find matching closing paren
        depth = 1
        pos = paren_start + 1
        while pos < len(stmt) and depth > 0:
            if stmt[pos] == "(":
                depth += 1
            elif stmt[pos] == ")":
                depth -= 1
            pos += 1

        if depth != 0:
            return

        condition = stmt[paren_start + 1:pos - 1]
        rest = stmt[pos:].strip()

        # Check for braced then-action
        if rest.startswith("{"):
            # Find matching closing brace
            brace_depth = 1
            brace_pos = 1
            while brace_pos < len(rest) and brace_depth > 0:
                if rest[brace_pos] == "{":
                    brace_depth += 1
                elif rest[brace_pos] == "}":
                    brace_depth -= 1
                brace_pos += 1

            then_action = rest[1:brace_pos - 1]
            after_then = rest[brace_pos:].strip()

            # Check for else
            else_action = None
            if after_then.startswith("else"):
                else_rest = after_then[4:].strip()
                if else_rest.startswith("{"):
                    # Find matching brace for else
                    brace_depth = 1
                    brace_pos = 1
                    while brace_pos < len(else_rest) and brace_depth > 0:
                        if else_rest[brace_pos] == "{":
                            brace_depth += 1
                        elif else_rest[brace_pos] == "}":
                            brace_depth -= 1
                        brace_pos += 1
                    else_action = else_rest[1:brace_pos - 1]

            if self._eval_condition(condition, state, fields, line):
                self._execute_action(then_action, state, fields, line)
            elif else_action:
                self._execute_action(else_action, state, fields, line)
        else:
            # No braces - check for else clause separated by ;
            then_action = rest
            else_action = None

            # Look for "; else" pattern (not inside strings)
            else_idx = -1
            in_str = False
            esc = False
            for ci in range(len(rest)):
                if esc:
                    esc = False
                    continue
                if rest[ci] == "\\":
                    esc = True
                    continue
                if rest[ci] == '"':
                    in_str = not in_str
                    continue
                if not in_str and rest[ci] == ";" and rest[ci + 1:].lstrip().startswith("else"):
                    else_idx = ci
                    break

            if else_idx != -1:
                then_action = rest[:else_idx].strip()
                else_part = rest[else_idx + 1:].strip()
                if else_part.startswith("else"):
                    else_action = else_part[4:].strip()

            if self._eval_condition(condition, state, fields, line):
                self._execute_statement(then_action, state, fields, line)
            elif else_action:
                self._execute_statement(else_action, state, fields, line)

    def _execute_for(
        self, stmt: str, state: AwkState, fields: list[str], line: str
    ) -> None:
        """Execute a for statement."""
        # Parse: for (var in array) body
        match = re.match(r"for\s*\(\s*(\w+)\s+in\s+(\w+)\s*\)\s*(.*)", stmt, re.DOTALL)
        if match:
            var = match.group(1)
            arr_name = match.group(2)
            body = match.group(3).strip()
            if body.startswith("{") and body.endswith("}"):
                body = body[1:-1]

            # Find all keys for this array
            keys = []
            prefix = f"{arr_name}["
            for k in state.variables:
                if isinstance(k, str) and k.startswith(prefix) and k.endswith("]"):
                    keys.append(k[len(prefix):-1])

            for key in keys:
                state.variables[var] = key
                self._execute_action(body, state, fields, line)
            return

        # Parse: for (init; condition; update) { action }
        match = re.match(r"for\s*\((.+?);(.+?);(.+?)\)\s*\{(.+?)\}", stmt, re.DOTALL)
        if not match:
            # Try without braces: for (init; condition; update) statement
            match = re.match(r"for\s*\((.+?);(.+?);(.+?)\)\s*(.*)", stmt, re.DOTALL)
        if match:
            init = match.group(1).strip()
            condition = match.group(2).strip()
            update = match.group(3).strip()
            action = match.group(4).strip()
            if action.startswith("{") and action.endswith("}"):
                action = action[1:-1]

            # Execute init
            self._execute_statement(init, state, fields, line)

            # Loop
            max_iter = 10000
            for _ in range(max_iter):
                if not self._eval_condition(condition, state, fields, line):
                    break
                self._execute_action(action, state, fields, line)
                self._execute_statement(update, state, fields, line)

    def _execute_while(
        self, stmt: str, state: AwkState, fields: list[str], line: str
    ) -> None:
        """Execute a while statement."""
        match = re.match(r"while\s*\((.+?)\)\s*\{(.+?)\}", stmt, re.DOTALL)
        if match:
            condition = match.group(1)
            action = match.group(2)

            max_iter = 10000
            for _ in range(max_iter):
                if not self._eval_condition(condition, state, fields, line):
                    break
                self._execute_action(action, state, fields, line)

    def _eval_condition(
        self, condition: str, state: AwkState, fields: list[str], line: str
    ) -> bool:
        """Evaluate a condition."""
        condition = condition.strip()

        # Comparison operators
        for op in ["==", "!=", ">=", "<=", ">", "<"]:
            if op in condition:
                parts = condition.split(op, 1)
                left = self._eval_expr(parts[0].strip(), state, line, fields)
                right = self._eval_expr(parts[1].strip(), state, line, fields)

                try:
                    left = float(left)
                    right = float(right)
                except (ValueError, TypeError):
                    left = str(left) if left else ""
                    right = str(right) if right else ""

                if op == "==":
                    return left == right
                elif op == "!=":
                    return left != right
                elif op == ">=":
                    return left >= right
                elif op == "<=":
                    return left <= right
                elif op == ">":
                    return left > right
                elif op == "<":
                    return left < right

        # Just evaluate as truthy
        result = self._eval_expr(condition, state, line, fields)
        if isinstance(result, str):
            return len(result) > 0
        try:
            return float(result) != 0
        except (ValueError, TypeError):
            return bool(result)

    def _unescape_string(self, s: str) -> str:
        """Unescape a string literal."""
        result = ""
        i = 0
        while i < len(s):
            if s[i] == "\\" and i + 1 < len(s):
                c = s[i + 1]
                if c == "n":
                    result += "\n"
                elif c == "t":
                    result += "\t"
                elif c == "r":
                    result += "\r"
                elif c == "\\":
                    result += "\\"
                elif c == '"':
                    result += '"'
                else:
                    result += c
                i += 2
            else:
                result += s[i]
                i += 1
        return result

    def _parse_value(self, s: str) -> Any:
        """Parse a value (for -v option)."""
        try:
            if "." in s:
                return float(s)
            return int(s)
        except ValueError:
            return s

    def _unescape_field_sep(self, s: str) -> str:
        """Unescape field separator (handle \\t, \\n, etc.)."""
        result = ""
        i = 0
        while i < len(s):
            if s[i] == "\\" and i + 1 < len(s):
                c = s[i + 1]
                if c == "t":
                    result += "\t"
                elif c == "n":
                    result += "\n"
                elif c == "r":
                    result += "\r"
                elif c == "\\":
                    result += "\\"
                else:
                    result += c
                i += 2
            else:
                result += s[i]
                i += 1
        return result

    def _format_number(self, n: Any) -> str:
        """Format a number for output - integers without decimal point."""
        if isinstance(n, float):
            if n == int(n):
                return str(int(n))
            return str(n)
        return str(n)

    def _format_string(self, fmt: str, values: list[Any]) -> str:
        """Format a string using printf-style format specifiers."""
        result = ""
        i = 0
        val_idx = 0

        while i < len(fmt):
            if fmt[i] == "\\" and i + 1 < len(fmt):
                c = fmt[i + 1]
                if c == "n":
                    result += "\n"
                elif c == "t":
                    result += "\t"
                elif c == "\\":
                    result += "\\"
                else:
                    result += c
                i += 2
            elif fmt[i] == "%" and i + 1 < len(fmt):
                # Parse format spec
                j = i + 1
                while j < len(fmt) and fmt[j] in "-+0 #":
                    j += 1
                while j < len(fmt) and fmt[j].isdigit():
                    j += 1
                if j < len(fmt) and fmt[j] == ".":
                    j += 1
                    while j < len(fmt) and fmt[j].isdigit():
                        j += 1
                if j < len(fmt):
                    spec = fmt[i:j + 1]
                    conv = fmt[j]
                    if conv == "%":
                        result += "%"
                    elif val_idx < len(values):
                        val = values[val_idx]
                        val_idx += 1
                        try:
                            if conv in "diouxX":
                                result += spec % int(float(val))
                            elif conv in "eEfFgG":
                                result += spec % float(val)
                            elif conv == "s":
                                result += spec % str(val)
                            else:
                                result += spec % val
                        except (ValueError, TypeError):
                            result += str(val)
                    i = j + 1
                else:
                    result += fmt[i]
                    i += 1
            else:
                result += fmt[i]
                i += 1

        return result
