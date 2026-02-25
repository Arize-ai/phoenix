export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_REQUIREMENTS_MESSAGE =
  `Password must be at least ${MIN_PASSWORD_LENGTH} characters ` +
  "with uppercase, lowercase, digit, and special character (!@#$%^&*()_+)";

/**
 * Validates password complexity requirements.
 * Returns an error message string if validation fails, or true if valid.
 * Compatible with react-hook-form's validate function signature.
 */
export function validatePasswordComplexity(value: string): string | true {
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (!/[a-z]/.test(value)) {
    return "Password must contain at least one lowercase letter";
  }
  if (!/[A-Z]/.test(value)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/[0-9]/.test(value)) {
    return "Password must contain at least one digit";
  }
  if (!/[!@#$%^&*()_+]/.test(value)) {
    return "Password must contain at least one special character (!@#$%^&*()_+)";
  }
  return true;
}
