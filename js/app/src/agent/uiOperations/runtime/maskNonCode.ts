/**
 * Mask comments, string literals, and template-literal text with spaces so
 * that source scanning sees executable tokens only. Regex literals are masked
 * too (heuristically: a `/` starts a regex when the previous significant
 * token cannot end an expression). `${...}` interpolations inside template
 * literals are kept as code, recursively.
 *
 * Output preserves the input's length and line structure, so offsets in the
 * masked text line up with the original source.
 */
export function maskNonCode(source: string): string {
  const chars = Array.from(source);
  const length = chars.length;
  const maskAt = (index: number) => {
    if (chars[index] !== "\n") {
      chars[index] = " ";
    }
  };
  const maskRange = (start: number, endExclusive: number) => {
    for (let j = start; j < endExclusive && j < length; j++) {
      maskAt(j);
    }
  };
  // Chars that cannot end an expression — a `/` after one of these (or at the
  // start) opens a regex literal rather than dividing.
  const REGEX_PREFIX_CHARS = new Set([
    "(",
    ")",
    ",",
    "=",
    ":",
    "[",
    "]",
    "!",
    "&",
    "|",
    "?",
    "{",
    "}",
    "+",
    "-",
    "*",
    "%",
    "^",
    "~",
    "<",
    ">",
    ";",
  ]);
  const REGEX_PREFIX_WORDS = new Set([
    "return",
    "typeof",
    "case",
    "throw",
    "in",
    "of",
    "new",
    "delete",
    "void",
    "do",
    "else",
    "yield",
    "await",
    "instanceof",
  ]);
  // Stack of lexical modes. "code" frames nested inside `${...}` track their
  // own brace depth so a `}` at depth 0 closes the interpolation.
  type Frame =
    | { mode: "code"; templateExprDepth: number | null }
    | { mode: "template" };
  const stack: Frame[] = [{ mode: "code", templateExprDepth: null }];
  let lastSignificant = ""; // last unmasked char or word, for regex detection
  let i = 0;
  while (i < length) {
    const frame = stack[stack.length - 1];
    const c = chars[i];
    if (frame.mode === "template") {
      if (c === "\\") {
        maskRange(i, i + 2);
        i += 2;
        continue;
      }
      if (c === "`") {
        maskAt(i);
        stack.pop();
        i++;
        lastSignificant = "`";
        continue;
      }
      if (c === "$" && chars[i + 1] === "{") {
        maskRange(i, i + 2);
        stack.push({ mode: "code", templateExprDepth: 0 });
        i += 2;
        lastSignificant = "(";
        continue;
      }
      maskAt(i);
      i++;
      continue;
    }
    // code mode
    const two = c + (chars[i + 1] ?? "");
    if (two === "//") {
      let j = i;
      while (j < length && chars[j] !== "\n") {
        j++;
      }
      maskRange(i, j);
      i = j;
      continue;
    }
    if (two === "/*") {
      let j = i + 2;
      while (j < length && !(chars[j] === "*" && chars[j + 1] === "/")) {
        j++;
      }
      j = Math.min(j + 2, length);
      maskRange(i, j);
      i = j;
      continue;
    }
    if (c === "'" || c === '"') {
      const quote = c;
      let j = i + 1;
      while (j < length && chars[j] !== quote && chars[j] !== "\n") {
        j += chars[j] === "\\" ? 2 : 1;
      }
      j = Math.min(j + 1, length);
      maskRange(i, j);
      i = j;
      lastSignificant = quote;
      continue;
    }
    if (c === "`") {
      maskAt(i);
      stack.push({ mode: "template" });
      i++;
      continue;
    }
    if (c === "/" && chars[i + 1] !== "/" && chars[i + 1] !== "*") {
      const opensRegex =
        lastSignificant === "" ||
        REGEX_PREFIX_CHARS.has(lastSignificant) ||
        REGEX_PREFIX_WORDS.has(lastSignificant);
      if (opensRegex) {
        // mask through the closing unescaped `/`, honoring [...] classes
        let j = i + 1;
        let inClass = false;
        while (j < length && chars[j] !== "\n") {
          if (chars[j] === "\\") {
            j += 2;
            continue;
          }
          if (chars[j] === "[") {
            inClass = true;
          } else if (chars[j] === "]") {
            inClass = false;
          } else if (chars[j] === "/" && !inClass) {
            break;
          }
          j++;
        }
        j = Math.min(j + 1, length); // closing slash
        while (j < length && /[a-z]/.test(chars[j])) {
          j++; // flags
        }
        maskRange(i, j);
        i = j;
        lastSignificant = "/";
        continue;
      }
      lastSignificant = "/";
      i++;
      continue;
    }
    if (frame.templateExprDepth != null) {
      if (c === "{") {
        frame.templateExprDepth++;
      } else if (c === "}") {
        if (frame.templateExprDepth === 0) {
          maskAt(i);
          stack.pop();
          i++;
          lastSignificant = "`";
          continue;
        }
        frame.templateExprDepth--;
      }
    }
    if (/[A-Za-z0-9_$]/.test(c)) {
      let j = i;
      while (j < length && /[A-Za-z0-9_$]/.test(chars[j])) {
        j++;
      }
      lastSignificant = chars.slice(i, j).join("");
      i = j;
      continue;
    }
    if (!/\s/.test(c)) {
      lastSignificant = c;
    }
    i++;
  }
  return chars.join("");
}
