import type { StructuredOutputError } from './errors.ts';

/**
 * The follow-up instruction sent after a rejected response.
 *
 * It carries the validation message and nothing else. Resending the schema or
 * the original task tends to make the model restate its first answer; naming
 * the single thing that was wrong gets it corrected.
 */
export function buildRepairMessage(error: StructuredOutputError): string {
  return [
    `Your previous response could not be used: ${error.message}`,
    'Send the corrected value as JSON only, with no explanation and no code fence.',
  ].join('\n');
}
