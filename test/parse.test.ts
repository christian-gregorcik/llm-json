import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseJsonFromText } from '../src/parse.ts';
import { MalformedJsonError, OutputTooLargeError } from '../src/errors.ts';

test('parses a value wrapped in prose', () => {
  assert.deepEqual(parseJsonFromText('Here: {"a":1}'), { a: 1 });
});

test('drops __proto__ instead of carrying it to the caller', () => {
  const value = parseJsonFromText('{"__proto__":{"polluted":true},"a":1}') as Record<
    string,
    unknown
  >;

  assert.deepEqual(value, { a: 1 });
  assert.equal(Object.prototype.hasOwnProperty.call(value, '__proto__'), false);
  assert.equal(({} as Record<string, unknown>)['polluted'], undefined);
});

test('keeps a key named constructor, which is ordinary data', () => {
  assert.deepEqual(parseJsonFromText('{"constructor":"Bosch"}'), { constructor: 'Bosch' });
});

test('rejects text that looks like JSON but is not', () => {
  assert.throws(() => parseJsonFromText("{'a':1}"), MalformedJsonError);
});

test('rejects output past the character limit before parsing', () => {
  const long = `{"a":"${'x'.repeat(50)}"}`;
  assert.throws(() => parseJsonFromText(long, 10), OutputTooLargeError);
});

test('accepts output exactly at the limit', () => {
  const source = '{"a":1}';
  assert.deepEqual(parseJsonFromText(source, source.length), { a: 1 });
});
