"""Expr command implementation.

Usage: expr EXPRESSION

Print the value of EXPRESSION to standard output.

EXPRESSION may be:
  ARG1 | ARG2       ARG1 if it is neither null nor 0, otherwise ARG2
  ARG1 & ARG2       ARG1 if neither argument is null or 0, otherwise 0
  ARG1 < ARG2       ARG1 is less than ARG2
  ARG1 <= ARG2      ARG1 is less than or equal to ARG2
  ARG1 = ARG2       ARG1 is equal to ARG2
  ARG1 != ARG2      ARG1 is not equal to ARG2
  ARG1 >= ARG2      ARG1 is greater than or equal to ARG2
  ARG1 > ARG2       ARG1 is greater than ARG2
  ARG1 + ARG2       arithmetic sum of ARG1 and ARG2
  ARG1 - ARG2       arithmetic difference of ARG1 and ARG2
  ARG1 * ARG2       arithmetic product of ARG1 and ARG2
  ARG1 / ARG2       arithmetic quotient of ARG1 divided by ARG2
  ARG1 % ARG2       arithmetic remainder of ARG1 divided by ARG2
  STRING : REGEXP   anchored pattern match of REGEXP in STRING
  match STRING REGEXP  same as STRING : REGEXP
  substr STRING POS LENGTH  substring of STRING, POS counted from 1
  index STRING CHARS  index in STRING where any CHARS is found, or 0
  length STRING    length of STRING
  + TOKEN          interpret TOKEN as a string
  ( EXPRESSION )   value of EXPRESSION
"""

import re
from ...types import CommandContext, ExecResult


class ExprCommand:
    """The expr command."""

    name = "expr"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the expr command."""
        if not args:
            return ExecResult(
                stdout="",
                stderr="expr: missing operand\n",
                exit_code=2,
            )

        try:
            result, _ = self._evaluate(args, 0)
            # Exit code is 1 if result is empty or 0
            exit_code = 1 if result == "" or result == "0" else 0
            return ExecResult(stdout=str(result) + "\n", stderr="", exit_code=exit_code)
        except ValueError as e:
            return ExecResult(stdout="", stderr=f"expr: {e}\n", exit_code=2)
        except ZeroDivisionError:
            return ExecResult(stdout="", stderr="expr: division by zero\n", exit_code=2)

    def _evaluate(self, args: list[str], pos: int) -> tuple[str, int]:
        """Evaluate expression starting at position."""
        return self._parse_or(args, pos)

    def _parse_or(self, args: list[str], pos: int) -> tuple[str, int]:
        """Parse OR expression: ARG1 | ARG2."""
        left, pos = self._parse_and(args, pos)

        while pos < len(args) and args[pos] == "|":
            pos += 1
            right, pos = self._parse_and(args, pos)
            if left != "" and left != "0":
                pass  # keep left
            else:
                left = right

        return left, pos

    def _parse_and(self, args: list[str], pos: int) -> tuple[str, int]:
        """Parse AND expression: ARG1 & ARG2."""
        left, pos = self._parse_comparison(args, pos)

        while pos < len(args) and args[pos] == "&":
            pos += 1
            right, pos = self._parse_comparison(args, pos)
            if (left == "" or left == "0") or (right == "" or right == "0"):
                left = "0"
            # else keep left

        return left, pos

    def _parse_comparison(self, args: list[str], pos: int) -> tuple[str, int]:
        """Parse comparison: <, <=, =, !=, >=, >."""
        left, pos = self._parse_additive(args, pos)

        if pos < len(args) and args[pos] in ("<", "<=", "=", "!=", ">=", ">"):
            op = args[pos]
            pos += 1
            right, pos = self._parse_additive(args, pos)

            # Try numeric comparison first
            try:
                l_num = int(left)
                r_num = int(right)
                if op == "<":
                    result = l_num < r_num
                elif op == "<=":
                    result = l_num <= r_num
                elif op == "=":
                    result = l_num == r_num
                elif op == "!=":
                    result = l_num != r_num
                elif op == ">=":
                    result = l_num >= r_num
                elif op == ">":
                    result = l_num > r_num
            except ValueError:
                # String comparison
                if op == "<":
                    result = left < right
                elif op == "<=":
                    result = left <= right
                elif op == "=":
                    result = left == right
                elif op == "!=":
                    result = left != right
                elif op == ">=":
                    result = left >= right
                elif op == ">":
                    result = left > right

            left = "1" if result else "0"

        return left, pos

    def _parse_additive(self, args: list[str], pos: int) -> tuple[str, int]:
        """Parse additive: + and -."""
        left, pos = self._parse_multiplicative(args, pos)

        while pos < len(args) and args[pos] in ("+", "-"):
            op = args[pos]
            pos += 1
            right, pos = self._parse_multiplicative(args, pos)

            try:
                l_num = int(left)
                r_num = int(right)
                if op == "+":
                    left = str(l_num + r_num)
                else:
                    left = str(l_num - r_num)
            except ValueError:
                raise ValueError("non-integer argument")

        return left, pos

    def _parse_multiplicative(self, args: list[str], pos: int) -> tuple[str, int]:
        """Parse multiplicative: *, /, %."""
        left, pos = self._parse_match(args, pos)

        while pos < len(args) and args[pos] in ("*", "/", "%"):
            op = args[pos]
            pos += 1
            right, pos = self._parse_match(args, pos)

            try:
                l_num = int(left)
                r_num = int(right)
                if op == "*":
                    left = str(l_num * r_num)
                elif op == "/":
                    left = str(l_num // r_num)
                else:
                    left = str(l_num % r_num)
            except ValueError:
                raise ValueError("non-integer argument")

        return left, pos

    def _parse_match(self, args: list[str], pos: int) -> tuple[str, int]:
        """Parse match expression: STRING : REGEXP."""
        left, pos = self._parse_primary(args, pos)

        if pos < len(args) and args[pos] == ":":
            pos += 1
            right, pos = self._parse_primary(args, pos)
            # Anchored match at start
            pattern = "^(" + right + ")"
            try:
                match = re.match(pattern, left)
                if match:
                    if match.groups():
                        left = match.group(1)
                    else:
                        left = str(len(match.group(0)))
                else:
                    left = ""
            except re.error as e:
                raise ValueError(f"invalid pattern: {e}")

        return left, pos

    def _parse_primary(self, args: list[str], pos: int) -> tuple[str, int]:
        """Parse primary expression."""
        if pos >= len(args):
            raise ValueError("missing operand")

        token = args[pos]

        # Parentheses
        if token == "(":
            pos += 1
            result, pos = self._evaluate(args, pos)
            if pos >= len(args) or args[pos] != ")":
                raise ValueError("unmatched '('")
            pos += 1
            return result, pos

        # Built-in functions
        if token == "match" and pos + 2 < len(args):
            pos += 1
            string = args[pos]
            pos += 1
            pattern = args[pos]
            pos += 1
            # Anchored match
            try:
                match = re.match("^(" + pattern + ")", string)
                if match:
                    if match.groups():
                        return match.group(1), pos
                    return str(len(match.group(0))), pos
                return "", pos
            except re.error as e:
                raise ValueError(f"invalid pattern: {e}")

        if token == "substr" and pos + 3 < len(args):
            pos += 1
            string = args[pos]
            pos += 1
            try:
                start = int(args[pos]) - 1  # 1-indexed
                pos += 1
                length = int(args[pos])
                pos += 1
                if start < 0:
                    start = 0
                return string[start:start + length], pos
            except ValueError:
                raise ValueError("non-integer argument")

        if token == "index" and pos + 2 < len(args):
            pos += 1
            string = args[pos]
            pos += 1
            chars = args[pos]
            pos += 1
            for i, c in enumerate(string):
                if c in chars:
                    return str(i + 1), pos  # 1-indexed
            return "0", pos

        if token == "length" and pos + 1 < len(args):
            pos += 1
            string = args[pos]
            pos += 1
            return str(len(string)), pos

        # Quote next token as string
        if token == "+":
            pos += 1
            if pos >= len(args):
                raise ValueError("missing operand after '+'")
            return args[pos], pos + 1

        return token, pos + 1
