import assert from 'node:assert/strict';
import { test } from 'node:test';

import { extractJsonText } from '../src/extract.ts';
import { NoJsonFoundError, UnterminatedJsonError } from '../src/errors.ts';

test('returns a bare object unchanged', () => {
  assert.equal(extractJsonText('{"a":1}'), '{"a":1}');
});

test('ignores prose on both sides of the value', () => {
  const source = 'Sure, here you go:\n{"a":1}\nLet me know if you need more.';
  assert.equal(extractJsonText(source), '{"a":1}');
});

test('reads inside a fenced block', () => {
  const source = 'Result:\n```json\n{"a":1}\n```\n';
  assert.equal(extractJsonText(source), '{"a":1}');
});

test('reads inside a fenced block with no language tag', () => {
  assert.equal(extractJsonText('```\n[1,2]\n```'), '[1,2]');
});

test('keeps brackets that appear inside strings', () => {
  const source = '{"note":"} not the end {","a":1}';
  assert.equal(extractJsonText(source), source);
});

test('keeps escaped quotes inside strings', () => {
  const source = '{"note":"he said \\"}\\" out loud","a":1}';
  assert.equal(extractJsonText(source), source);
});

test('handles a value nested several levels deep', () => {
  const source = '{"a":{"b":[{"c":1}]}}';
  assert.equal(extractJsonText(source), source);
});

test('stops at the first complete value', () => {
  assert.equal(extractJsonText('{"a":1} {"b":2}'), '{"a":1}');
});

test('rejects output with no structure at all', () => {
  assert.throws(() => extractJsonText('I am afraid I cannot do that.'), NoJsonFoundError);
});

test('rejects a value that is cut off', () => {
  assert.throws(() => extractJsonText('{"a":1'), UnterminatedJsonError);
});

test('rejects a value cut off inside a string', () => {
  assert.throws(() => extractJsonText('{"a":"unclosed'), UnterminatedJsonError);
});
