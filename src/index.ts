import {
  RepairExhaustedError,
  StructuredOutputError,
  ValidationError,
  type Attempt,
} from './errors.ts';
import { DEFAULT_MAX_OUTPUT_CHARACTERS, parseJsonFromText } from './parse.ts';
import { buildRepairMessage } from './repair.ts';

export interface StructuredRequest<T> {
  /**
   * Sends one request to the model and resolves with its raw text.
   *
   * On the first attempt `repair` is null. On later attempts it holds the
   * instruction describing what was wrong. Conversation history stays with the
   * caller, so this works the same against a chat API, a completion API or a
   * local model.
   */
  call(repair: string | null): Promise<string>;

  /**
   * Returns the typed value, or throws to reject the response. Any schema
   * library works here; what matters is that the thrown message says what was
   * wrong, because that message is what the model is asked to fix.
   */
  validate(value: unknown): T;

  /** Total model calls allowed, including the first. Defaults to 3. */
  maxAttempts?: number;

  /** Rejects any single response longer than this. */
  maxOutputCharacters?: number;

  /** Called once per rejected response, before the next attempt. */
  onAttempt?(attempt: Attempt): void;
}

/**
 * Asks the model for a value, and keeps asking until the value validates or
 * the attempts run out.
 *
 * Throws RepairExhaustedError with every attempt attached rather than
 * returning a partially valid object.
 */
export async function parseStructured<T>(request: StructuredRequest<T>): Promise<T> {
  const maxAttempts = request.maxAttempts ?? 3;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError('maxAttempts must be an integer of at least 1.');
  }

  const maxCharacters = request.maxOutputCharacters ?? DEFAULT_MAX_OUTPUT_CHARACTERS;
  const attempts: Attempt[] = [];
  let repair: string | null = null;

  for (let n = 0; n < maxAttempts; n += 1) {
    const output = await request.call(repair);

    try {
      return request.validate(parseJsonFromText(output, maxCharacters));
    } catch (thrown) {
      const error = asStructuredError(thrown);
      const attempt: Attempt = { output, error };
      attempts.push(attempt);
      request.onAttempt?.(attempt);
      repair = buildRepairMessage(error);
    }
  }

  throw new RepairExhaustedError(attempts);
}

function asStructuredError(thrown: unknown): StructuredOutputError {
  if (thrown instanceof StructuredOutputError) {
    return thrown;
  }
  if (thrown instanceof Error) {
    return new ValidationError(thrown.message);
  }
  return new ValidationError(String(thrown));
}

export { parseJsonFromText, DEFAULT_MAX_OUTPUT_CHARACTERS } from './parse.ts';
export { extractJsonText } from './extract.ts';
export { buildRepairMessage } from './repair.ts';
export {
  StructuredOutputError,
  OutputTooLargeError,
  NoJsonFoundError,
  UnterminatedJsonError,
  MalformedJsonError,
  RepairExhaustedError,
  ValidationError,
  type Attempt,
} from './errors.ts';
