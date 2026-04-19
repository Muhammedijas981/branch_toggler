/**
 * Input validation helpers.
 * All validators return true (valid) or false (invalid).
 */

// Vercel project/deployment IDs: alphanumeric with underscores and hyphens
const VALID_ID = /^[a-zA-Z0-9_-]{1,100}$/;

// Git branch names: allow letters, digits, dots, hyphens, underscores, forward slashes
const VALID_BRANCH = /^[a-zA-Z0-9._\-/]{1,255}$/;

// Webhook URLs must be HTTPS
const VALID_HTTPS_URL = /^https:\/\/.+/;

export function validateProjectId(id) {
  return typeof id === 'string' && VALID_ID.test(id);
}

export function validateBranchName(branch) {
  return typeof branch === 'string' && VALID_BRANCH.test(branch.trim());
}

/**
 * Validates a webhook URL — must be HTTPS and ≤ 500 chars.
 * Returns true for empty/null (field is optional).
 */
export function validateWebhookUrl(url) {
  if (!url) return true; // optional
  return typeof url === 'string' && VALID_HTTPS_URL.test(url) && url.length <= 500;
}

/**
 * Validates that a scheduled datetime string is valid and in the future.
 */
export function validateScheduledAt(dateStr) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  return date > new Date(); // must be in the future
}
