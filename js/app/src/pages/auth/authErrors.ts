/**
 * Authentication message handling utilities.
 *
 * SECURITY: Only displays messages for codes in the allowed lists.
 * This prevents social engineering attacks via manipulated query parameters.
 */

const AUTH_SUCCESS_MESSAGES: Record<string, string> = {
  password_reset: "Password has been reset.",
};

/**
 * Returns a safe error message for the given code, or null if invalid.
 * Error messages are provided by the backend via window.Config.
 */
export function getAuthErrorMessage(errorCode: string | null): string | null {
  return errorCode
    ? (window.Config.authErrorMessages?.[errorCode] ?? null)
    : null;
}

/**
 * Returns a safe success message for the given code, or null if invalid.
 * Success messages are frontend-only.
 */
export function getAuthSuccessMessage(
  successCode: string | null
): string | null {
  return successCode ? (AUTH_SUCCESS_MESSAGES[successCode] ?? null) : null;
}
