import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseStructured } from '../src/index.ts';
import { RepairExhaustedError, type Attempt } from '../src/errors.ts';

interface Invoice {
  readonly total: number;
}

function requireInvoice(value: unknown): Invoice {
  const total = (value as { total?: unknown }).total;
  if (typeof total !== 'number') {
    throw new Error('Field "total" must be a number.');
  }
  return { total };
}

/** A model that returns the given responses in order, one per call. */
function scriptedModel(responses: readonly string[]) {
  const seen: (string | null)[] = [];
  let index = 0;

  return {
    seen,
    async call(repair: string | null): Promise<string> {
      seen.push(repair);
      const response = responses[index];
      index += 1;
      if (response === undefined) {
        throw new Error('The model was called more times than the script allows.');
      }
      return response;
    },
  };
}

test('returns the validated value on the first attempt', async () => {
  const model = scriptedModel(['{"total":42}']);

  const invoice = await parseStructured({ call: model.call, validate: requireInvoice });

  assert.deepEqual(invoice, { total: 42 });
  assert.deepEqual(model.seen, [null], 'the first call carries no repair instruction');
});

test('repairs once and then succeeds', async () => {
  const model = scriptedModel(['{"total":"forty two"}', '{"total":42}']);
  const rejected: Attempt[] = [];

  const invoice = await parseStructured({
    call: model.call,
    validate: requireInvoice,
    onAttempt: (attempt) => rejected.push(attempt),
  });

  assert.deepEqual(invoice, { total: 42 });
  assert.equal(rejected.length, 1);
  assert.match(rejected[0]!.error.message, /must be a number/);
  assert.match(model.seen[1] ?? '', /must be a number/);
});

test('gives up after the allowed attempts and reports each one', async () => {
  const model = scriptedModel(['not json', '{"total":"x"}', '{"total":null}']);

  await assert.rejects(
    parseStructured({ call: model.call, validate: requireInvoice, maxAttempts: 3 }),
    (thrown: unknown) => {
      assert.ok(thrown instanceof RepairExhaustedError);
      assert.equal(thrown.attempts.length, 3);
      assert.equal(thrown.attempts[0]!.output, 'not json');
      return true;
    },
  );
});

test('maxAttempts of 1 never sends a repair', async () => {
  const model = scriptedModel(['nope']);

  await assert.rejects(
    parseStructured({ call: model.call, validate: requireInvoice, maxAttempts: 1 }),
    RepairExhaustedError,
  );
  assert.deepEqual(model.seen, [null]);
});

test('rejects a nonsense attempt count without calling the model', async () => {
  const model = scriptedModel([]);

  await assert.rejects(
    parseStructured({ call: model.call, validate: requireInvoice, maxAttempts: 0 }),
    RangeError,
  );
  assert.equal(model.seen.length, 0);
});

test('a validator that throws a non-Error still produces a usable message', async () => {
  const model = scriptedModel(['{"total":1}', '{"total":1}']);

  await assert.rejects(
    parseStructured({
      call: model.call,
      validate: () => {
        throw 'totals must be in minor units';
      },
      maxAttempts: 2,
    }),
    (thrown: unknown) => {
      assert.ok(thrown instanceof RepairExhaustedError);
      assert.match(thrown.attempts[0]!.error.message, /minor units/);
      return true;
    },
  );
});
