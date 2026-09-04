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

type Frame =
  | { mode: "code"; templateExprDepth: number | null }
  | { mode: "template" };

class NonCodeMasker {
  private readonly chars: string[];
  private readonly length: number;
  private readonly stack: Frame[] = [{ mode: "code", templateExprDepth: null }];
  private lastSignificant = "";
  private index = 0;

  constructor(source: string) {
    this.chars = Array.from(source);
    this.length = this.chars.length;
  }

  mask(): string {
    while (this.index < this.length) {
      const frame = this.stack[this.stack.length - 1];
      if (frame.mode === "template") this.processTemplate();
      else this.processCode(frame);
    }
    return this.chars.join("");
  }

  private maskAt(index: number): void {
    if (this.chars[index] !== "\n") this.chars[index] = " ";
  }

  private maskRange(start: number, endExclusive: number): void {
    for (
      let rangeIndex = start;
      rangeIndex < endExclusive && rangeIndex < this.length;
      rangeIndex++
    ) {
      this.maskAt(rangeIndex);
    }
  }

  private processTemplate(): void {
    const char = this.chars[this.index];
    if (char === "\\") {
      this.maskRange(this.index, this.index + 2);
      this.index += 2;
      return;
    }
    if (char === "`") {
      this.maskAt(this.index);
      this.stack.pop();
      this.index++;
      this.lastSignificant = "`";
      return;
    }
    if (char === "$" && this.chars[this.index + 1] === "{") {
      this.maskRange(this.index, this.index + 2);
      this.stack.push({ mode: "code", templateExprDepth: 0 });
      this.index += 2;
      this.lastSignificant = "(";
      return;
    }
    this.maskAt(this.index);
    this.index++;
  }

  private processCode(frame: Extract<Frame, { mode: "code" }>): void {
    const char = this.chars[this.index];
    const pair = char + (this.chars[this.index + 1] ?? "");
    if (pair === "//") return this.maskLineComment();
    if (pair === "/*") return this.maskBlockComment();
    if (char === "'" || char === '"') return this.maskQuotedString(char);
    if (char === "`") return this.openTemplate();
    if (char === "/") return this.processSlash();
    if (this.processTemplateExpressionBrace(frame, char)) return;
    if (/[A-Za-z0-9_$]/.test(char)) return this.processWord();
    if (!/\s/.test(char)) this.lastSignificant = char;
    this.index++;
  }

  private maskLineComment(): void {
    let end = this.index;
    while (end < this.length && this.chars[end] !== "\n") end++;
    this.maskRange(this.index, end);
    this.index = end;
  }

  private maskBlockComment(): void {
    let end = this.index + 2;
    while (
      end < this.length &&
      !(this.chars[end] === "*" && this.chars[end + 1] === "/")
    ) {
      end++;
    }
    end = Math.min(end + 2, this.length);
    this.maskRange(this.index, end);
    this.index = end;
  }

  private maskQuotedString(quote: string): void {
    let end = this.index + 1;
    while (
      end < this.length &&
      this.chars[end] !== quote &&
      this.chars[end] !== "\n"
    ) {
      end += this.chars[end] === "\\" ? 2 : 1;
    }
    end = Math.min(end + 1, this.length);
    this.maskRange(this.index, end);
    this.index = end;
    this.lastSignificant = quote;
  }

  private openTemplate(): void {
    this.maskAt(this.index);
    this.stack.push({ mode: "template" });
    this.index++;
  }

  private processSlash(): void {
    const next = this.chars[this.index + 1];
    if (next === "/" || next === "*") {
      this.lastSignificant = "/";
      this.index++;
      return;
    }
    const opensRegex =
      this.lastSignificant === "" ||
      REGEX_PREFIX_CHARS.has(this.lastSignificant) ||
      REGEX_PREFIX_WORDS.has(this.lastSignificant);
    if (opensRegex) this.maskRegexLiteral();
    else {
      this.lastSignificant = "/";
      this.index++;
    }
  }

  private maskRegexLiteral(): void {
    let end = this.index + 1;
    let isInCharacterClass = false;
    while (end < this.length && this.chars[end] !== "\n") {
      const char = this.chars[end];
      if (char === "\\") {
        end += 2;
        continue;
      }
      if (char === "[") isInCharacterClass = true;
      else if (char === "]") isInCharacterClass = false;
      else if (char === "/" && !isInCharacterClass) break;
      end++;
    }
    end = Math.min(end + 1, this.length);
    while (end < this.length && /[a-z]/.test(this.chars[end])) end++;
    this.maskRange(this.index, end);
    this.index = end;
    this.lastSignificant = "/";
  }

  private processTemplateExpressionBrace(
    frame: Extract<Frame, { mode: "code" }>,
    char: string
  ): boolean {
    if (frame.templateExprDepth == null) return false;
    if (char === "{") {
      frame.templateExprDepth++;
      return false;
    }
    if (char !== "}") return false;
    if (frame.templateExprDepth > 0) {
      frame.templateExprDepth--;
      return false;
    }
    this.maskAt(this.index);
    this.stack.pop();
    this.index++;
    this.lastSignificant = "`";
    return true;
  }

  private processWord(): void {
    let end = this.index;
    while (end < this.length && /[A-Za-z0-9_$]/.test(this.chars[end])) end++;
    this.lastSignificant = this.chars.slice(this.index, end).join("");
    this.index = end;
  }
}

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
  return new NonCodeMasker(source).mask();
}
