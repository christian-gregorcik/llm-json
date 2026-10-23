import { NoJsonFoundError, UnterminatedJsonError } from './errors.ts';

const FENCED_BLOCK = /```[a-zA-Z0-9_-]*\r?\n([\s\S]*?)```/;

/**
 * Pull the first complete JSON object or array out of a model response.
 *
 * Models wrap JSON in prose, in code fences, or in both, and they do it
 * inconsistently across runs. Scanning for a balanced value is more reliable
 * than instructing the model to stop doing it.
 */
export function extractJsonText(source: string): string {
  const fenced = FENCED_BLOCK.exec(source)?.[1];
  const haystack = fenced ?? source;

  const start = findValueStart(haystack);
  if (start === -1) {
    throw new NoJsonFoundError(source);
  }

  const end = findValueEnd(haystack, start);
  if (end === -1) {
    throw new UnterminatedJsonError(source);
  }

  return haystack.slice(start, end + 1);
}

function findValueStart(text: string): number {
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i);
    if (ch === '{' || ch === '[') {
      return i;
    }
  }
  return -1;
}

/**
 * Walk forward tracking nesting depth, ignoring brackets that sit inside
 * strings. Without the string tracking, a value such as {"note":"}"} ends the
 * scan three characters early.
 */
function findValueEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text.charAt(i);

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{' || ch === '[') {
      depth += 1;
    } else if (ch === '}' || ch === ']') {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}
