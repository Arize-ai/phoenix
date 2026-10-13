/**
 * A lexical guard, not a JSON parser: call only after JSON validation. Strings
 * (including quoted keys and escaped quotes) are skipped. Each number must have
 * the same mathematical decimal value as its JavaScript display representation.
 * Work is linear in the validated text length; no big integers or exponent-sized
 * strings are constructed. The caller bounds the total scanned input.
 */
export function hasLosslessJSONNumbers(text: string): boolean {
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (character === '"') {
      index += 1;
      while (index < text.length) {
        if (text[index] === "\\") {
          index += 2;
        } else if (text[index++] === '"') {
          break;
        }
      }
    } else if (character === "-" || isDigit(character)) {
      const start = index++;
      while (index < text.length && isNumberCharacter(text[index])) index += 1;
      const token = text.slice(start, index);
      const value = Number(token);
      if (!Number.isFinite(value) || Object.is(value, -0)) return false;
      const decimal = normalizeDecimal(token);
      if (
        decimal === undefined ||
        decimal !== normalizeDecimal(String(value))
      ) {
        return false;
      }
    } else {
      index += 1;
    }
  }
  return true;
}

function isDigit(character: string): boolean {
  return character >= "0" && character <= "9";
}

function isNumberCharacter(character: string): boolean {
  return (
    isDigit(character) ||
    character === "." ||
    character === "e" ||
    character === "E" ||
    character === "+" ||
    character === "-"
  );
}

/** Canonical coefficient × 10^exponent, ignoring insignificant decimal zeros. */
function normalizeDecimal(token: string): string | undefined {
  const isNegative = token[0] === "-";
  const exponentIndex = token.search(/[eE]/);
  const coefficientEnd = exponentIndex < 0 ? token.length : exponentIndex;
  const pointIndex = token.indexOf(".");
  const fractionLength = pointIndex < 0 ? 0 : coefficientEnd - pointIndex - 1;
  const digits = token
    .slice(isNegative ? 1 : 0, coefficientEnd)
    .replace(".", "");
  let first = 0;
  while (first < digits.length && digits[first] === "0") first += 1;
  // Zero stays zero even with an arbitrarily long exponent. Negative zero has
  // already been rejected by the caller before normalization.
  if (first === digits.length) return "0";
  let last = digits.length - 1;
  while (digits[last] === "0") last -= 1;
  const exponent =
    (exponentIndex < 0 ? 0 : Number(token.slice(exponentIndex + 1))) -
    fractionLength +
    digits.length -
    1 -
    last;
  // Conservative fallback for exponents whose arithmetic cannot be exact.
  if (!Number.isSafeInteger(exponent)) return undefined;
  return `${isNegative ? "-" : ""}${digits.slice(first, last + 1)}e${exponent}`;
}
