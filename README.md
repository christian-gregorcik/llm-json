# llm-json

Takes the text a language model gives you, finds the JSON in it, validates it
with your own schema, and asks the model to fix what it got wrong. Gives up
loudly after a set number of attempts instead of handing you a half-valid
object.

No runtime dependencies.

## Why this exists

A model asked for JSON usually returns JSON. The trouble is the rest of the
time. It wraps the value in a code fence, or in a sentence, or it returns a
string where you wanted a number. Retrying the whole prompt tends to produce
the same answer again, because the model has no idea which part you rejected.

So the retry here carries one thing: the message your validator threw. In
practice that is what changes the answer.

## Install

```
npm install llm-json
```

Node 22.6 or later.

## Use

You supply two functions. `call` sends one request to your model and returns
its raw text. `validate` returns the typed value or throws with a message
explaining the problem.

```ts
import { parseStructured } from 'llm-json';

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
  call: (repair) => askTheModel(repair),
  validate: requireInvoice,
  onAttempt: (attempt) => console.log('rejected:', attempt.error.message),
});
```

`examples/repair-loop.ts` runs this against a stub model that answers badly
twice:

```
rejected: Field "total" must be an integer number of minor units, for example 124050.
rejected: Field "total" must be an integer number of minor units, for example 124050.
accepted: { total: 124050, currency: 'SEK' }
```

On the first call `repair` is `null`. On every call after that it holds the
instruction to send back to the model.

## What happens to the output

**Extraction.** The first balanced object or array is taken, from inside a
fenced block if there is one. Brackets inside strings are ignored, so a value
such as `{"note":"} not the end {"}` survives.

**`__proto__`.** The key is dropped during parsing. `JSON.parse` gives it an
own property rather than touching the prototype, so parsing alone is safe; the
problem appears later, when the object is merged into another one by code that
does not expect the key. A key named `constructor` is left alone, because that
is ordinary data.

**Size.** Anything past `maxOutputCharacters` is rejected before parsing. The
default is a million.

## Choices worth knowing about

*The conversation stays yours.* This package never builds a message array. It
hands you a repair string and takes back text, so it works the same against a
chat API, a completion endpoint or a local model.

*Any schema library.* `validate` is a plain function. Zod, Valibot, Ajv or
twenty lines of hand-written checks all work. The only thing that matters is
that the thrown message is specific, because the model is being asked to act
on it.

*Failure is loud.* When the attempts run out you get a `RepairExhaustedError`
carrying every response and every rejection, so the whole exchange can go
straight into a log.

## Errors

All of them extend `StructuredOutputError`.

| Error | Raised when |
| --- | --- |
| `OutputTooLargeError` | the response is longer than the configured limit |
| `NoJsonFoundError` | the response contains no object or array |
| `UnterminatedJsonError` | a value starts but never closes |
| `MalformedJsonError` | the extracted text is not valid JSON |
| `ValidationError` | wraps whatever your validator threw |
| `RepairExhaustedError` | the attempts ran out |

## Limits

Streaming responses are not handled; pass the finished text. Several JSON
values in one response are not handled either, only the first is read. Both
would change the shape of the API and neither has come up in use yet.

## Development

```
npm run check    # types
npm test         # tests
npm run build    # dist
```

## License

MIT
