import { MalformedJsonError, OutputTooLargeError } from './errors.ts';
import { extractJsonText } from './extract.ts';

/**
 * Upper bound on a single model response. A runaway generation should fail
 * fast rather than be handed to JSON.parse.
 */
export const DEFAULT_MAX_OUTPUT_CHARACTERS = 1_000_000;

/**
 * JSON.parse gives `__proto__` an own property rather than touching the
 * prototype, so parsing alone is safe. The danger appears later, when the
 * result is merged into another object by code that does not expect the key.
 * Dropping it here means callers cannot inherit that problem from us.
 */
function dropPrototypeKey(key: string, value: unknown): unknown {
  return key === '__proto__' ? undefined : value;
}

export function parseJsonFromText(
  source: string,
  maxCharacters: number = DEFAULT_MAX_OUTPUT_CHARACTERS,
): unknown {
  if (source.length > maxCharacters) {
    throw new OutputTooLargeError(source.length, maxCharacters);
  }

  const json = extractJsonText(source);

  try {
    return JSON.parse(json, dropPrototypeKey) as unknown;
  } catch (cause) {
    throw new MalformedJsonError(json, cause);
  }
}
