/**
 * Determines if the current description can be auto-replaced without confirmation.
 *
 * Returns true if:
 * - description is empty or whitespace-only
 * - description exactly matches the last template inserted by the plugin
 */
export function isAutoReplace(
  description: string,
  lastInsertedTemplate: string | null,
): boolean {
  if (!description.trim()) return true;
  if (lastInsertedTemplate && description === lastInsertedTemplate) return true;
  return false;
}
