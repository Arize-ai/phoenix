"""Tr command implementation.

Usage: tr [OPTION]... SET1 [SET2]

Translate, squeeze, and/or delete characters from standard input,
writing to standard output.

Options:
  -c, -C, --complement   use the complement of SET1
  -d, --delete           delete characters in SET1, do not translate
  -s, --squeeze-repeats  replace each sequence of a repeated character
                         that is listed in SET1 with a single occurrence

SETs are specified as strings of characters. Interpreted sequences include:
  \\NNN     character with octal value NNN (1 to 3 octal digits)
  \\\\      backslash
  \\a       audible BEL
  \\b       backspace
  \\f       form feed
  \\n       newline
  \\r       carriage return
  \\t       horizontal tab
  \\v       vertical tab
  CHAR1-CHAR2  all characters from CHAR1 to CHAR2 in ascending order
  [:alnum:]  all letters and digits
  [:alpha:]  all letters
  [:blank:]  all horizontal whitespace
  [:cntrl:]  all control characters
  [:digit:]  all digits
  [:lower:]  all lowercase letters
  [:print:]  all printable characters
  [:punct:]  all punctuation characters
  [:space:]  all horizontal or vertical whitespace
  [:upper:]  all uppercase letters
"""

import string
from ...types import CommandContext, ExecResult


class TrCommand:
    """The tr command."""

    name = "tr"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the tr command."""
        complement = False
        delete = False
        squeeze = False
        sets: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--":
                sets.extend(args[i + 1:])
                break
            elif arg.startswith("--"):
                if arg == "--complement":
                    complement = True
                elif arg == "--delete":
                    delete = True
                elif arg == "--squeeze-repeats":
                    squeeze = True
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"tr: unrecognized option '{arg}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-") and arg != "-":
                j = 1
                while j < len(arg):
                    c = arg[j]
                    if c == "c" or c == "C":
                        complement = True
                    elif c == "d":
                        delete = True
                    elif c == "s":
                        squeeze = True
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"tr: invalid option -- '{c}'\n",
                            exit_code=1,
                        )
                    j += 1
            else:
                sets.append(arg)
            i += 1

        # Validate arguments
        if delete:
            if len(sets) < 1:
                return ExecResult(
                    stdout="",
                    stderr="tr: missing operand\n",
                    exit_code=1,
                )
            if len(sets) > 1 and not squeeze:
                return ExecResult(
                    stdout="",
                    stderr="tr: extra operand\n",
                    exit_code=1,
                )
        else:
            if len(sets) < 2 and not squeeze:
                return ExecResult(
                    stdout="",
                    stderr="tr: missing operand after SET1\n",
                    exit_code=1,
                )

        # Expand sets
        try:
            set1 = self._expand_set(sets[0]) if sets else ""
            set2 = self._expand_set(sets[1]) if len(sets) > 1 else ""
        except ValueError as e:
            return ExecResult(
                stdout="",
                stderr=f"tr: {e}\n",
                exit_code=1,
            )

        # Apply complement
        if complement:
            # Create set of all characters not in set1
            all_chars = set(chr(i) for i in range(256))
            set1_chars = set(set1)
            set1 = "".join(sorted(all_chars - set1_chars, key=ord))

        # Process input
        content = ctx.stdin
        result = []

        if delete and not squeeze:
            # Delete characters in set1
            delete_set = set(set1)
            for c in content:
                if c not in delete_set:
                    result.append(c)
        elif delete and squeeze:
            # Delete set1, squeeze set2
            delete_set = set(set1)
            squeeze_set = set(set2)
            prev_char = None
            for c in content:
                if c in delete_set:
                    continue
                if c in squeeze_set and c == prev_char:
                    continue
                result.append(c)
                prev_char = c
        elif squeeze and not set2:
            # Squeeze only
            squeeze_set = set(set1)
            prev_char = None
            for c in content:
                if c in squeeze_set and c == prev_char:
                    continue
                result.append(c)
                prev_char = c
        else:
            # Translate
            trans_map = self._create_translation_map(set1, set2)

            if squeeze:
                squeeze_set = set(set2)
                prev_char = None
                for c in content:
                    translated = trans_map.get(c, c)
                    if translated in squeeze_set and translated == prev_char:
                        continue
                    result.append(translated)
                    prev_char = translated
            else:
                for c in content:
                    result.append(trans_map.get(c, c))

        return ExecResult(stdout="".join(result), stderr="", exit_code=0)

    def _expand_set(self, s: str) -> str:
        """Expand a character set specification."""
        result = []
        i = 0

        while i < len(s):
            # Check for character classes like [:digit:]
            if s[i:].startswith("[:") and ":]" in s[i + 2:]:
                end = s.index(":]", i + 2)
                class_name = s[i + 2:end]
                result.extend(self._get_char_class(class_name))
                i = end + 2
                continue

            # Check for escape sequences
            if s[i] == "\\" and i + 1 < len(s):
                c = s[i + 1]
                if c == "a":
                    result.append("\a")
                elif c == "b":
                    result.append("\b")
                elif c == "f":
                    result.append("\f")
                elif c == "n":
                    result.append("\n")
                elif c == "r":
                    result.append("\r")
                elif c == "t":
                    result.append("\t")
                elif c == "v":
                    result.append("\v")
                elif c == "\\":
                    result.append("\\")
                elif c.isdigit():
                    # Octal escape
                    octal = ""
                    j = i + 1
                    while j < len(s) and s[j].isdigit() and len(octal) < 3:
                        if s[j] in "01234567":
                            octal += s[j]
                            j += 1
                        else:
                            break
                    if octal:
                        result.append(chr(int(octal, 8)))
                        i = j
                        continue
                    else:
                        result.append(c)
                else:
                    result.append(c)
                i += 2
                continue

            # Check for range
            if i + 2 < len(s) and s[i + 1] == "-":
                start = s[i]
                end = s[i + 2]
                if ord(start) <= ord(end):
                    for c in range(ord(start), ord(end) + 1):
                        result.append(chr(c))
                    i += 3
                    continue

            result.append(s[i])
            i += 1

        return "".join(result)

    def _get_char_class(self, name: str) -> list[str]:
        """Get characters in a character class."""
        if name == "alnum":
            return list(string.ascii_letters + string.digits)
        elif name == "alpha":
            return list(string.ascii_letters)
        elif name == "blank":
            return [" ", "\t"]
        elif name == "cntrl":
            return [chr(i) for i in range(32)] + [chr(127)]
        elif name == "digit":
            return list(string.digits)
        elif name == "graph":
            return [chr(i) for i in range(33, 127)]
        elif name == "lower":
            return list(string.ascii_lowercase)
        elif name == "print":
            return [chr(i) for i in range(32, 127)]
        elif name == "punct":
            return list(string.punctuation)
        elif name == "space":
            return list(string.whitespace)
        elif name == "upper":
            return list(string.ascii_uppercase)
        elif name == "xdigit":
            return list(string.hexdigits)
        else:
            raise ValueError(f"invalid character class '{name}'")

    def _create_translation_map(self, set1: str, set2: str) -> dict[str, str]:
        """Create a translation map from set1 to set2."""
        trans_map = {}

        # If set2 is shorter, extend with its last character
        if set2:
            last_char = set2[-1]
            set2_extended = set2 + last_char * (len(set1) - len(set2))
        else:
            set2_extended = ""

        for i, c in enumerate(set1):
            if i < len(set2_extended):
                trans_map[c] = set2_extended[i]

        return trans_map
