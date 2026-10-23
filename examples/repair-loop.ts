/**
 * Runs the repair loop against a stub model that gets it wrong twice before
 * getting it right. Run with: node --experimental-strip-types examples/repair-loop.ts
 */
import { parseStructured } from '../src/index.ts';

const responses = [
  'Sure! Here is the invoice:\n```json\n{"total": "1 240 kr", "currency": "SEK"}\n```',
  '{"total": 1240.5, "currency": "SEK"}',
  '{"total": 124050, "currency": "SEK"}',
];

let next = 0;

interface Invoice {
  readonly total: number;
  readonly currency: string;
}

function requireInvoice(value: unknown): Invoice {
  const { total, currency } = value as { total?: unknown; currency?: unknown };

  if (!Number.isInteger(total)) {
    throw new Error('Field "total" must be an integer number of minor units, for example 124050.');
  }
  if (currency !== 'SEK' && currency !== 'EUR') {
    throw new Error('Field "currency" must be either "SEK" or "EUR".');
  }

  return { total, currency };
}

const invoice = await parseStructured({
  call: async () => responses[next++]!,
  validate: requireInvoice,
  onAttempt: (attempt) => console.log('rejected:', attempt.error.message),
});

console.log('accepted:', invoice);
