/**
 * Base for every failure this package raises. Catching this one catches them all.
 */
export class StructuredOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class OutputTooLargeError extends StructuredOutputError {
  readonly characters: number;
  readonly limit: number;

  constructor(characters: number, limit: number) {
    super(`Model output is ${characters} characters, limit is ${limit}.`);
    this.characters = characters;
    this.limit = limit;
  }
}

export class NoJsonFoundError extends StructuredOutputError {
  readonly source: string;

  constructor(source: string) {
    super('Model output contains no object or array.');
    this.source = source;
  }
}

export class UnterminatedJsonError extends StructuredOutputError {
  readonly source: string;

  constructor(source: string) {
    super('Model output starts a JSON value but never closes it.');
    this.source = source;
  }
}

export class MalformedJsonError extends StructuredOutputError {
  readonly source: string;

  constructor(source: string, cause: unknown) {
    super(`Extracted text is not valid JSON: ${describe(cause)}`);
    this.source = source;
    this.cause = cause;
  }
}

/** One pass through the model: what came back, and why it was rejected. */
export interface Attempt {
  readonly output: string;
  readonly error: StructuredOutputError;
}

/**
 * Raised when every allowed attempt was spent without producing a value the
 * caller's validator accepted. The attempts are attached so the caller can log
 * the whole exchange rather than guess at it.
 */
export class RepairExhaustedError extends StructuredOutputError {
  readonly attempts: readonly Attempt[];

  constructor(attempts: readonly Attempt[]) {
    const last = attempts[attempts.length - 1];
    super(
      `Gave up after ${attempts.length} attempt(s). ` +
        `Last failure: ${last?.error.message ?? 'none recorded'}`,
    );
    this.attempts = attempts;
  }
}

/** Wraps whatever the caller's validator threw. */
export class ValidationError extends StructuredOutputError {}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
