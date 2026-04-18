# WS-level Photon fixtures

One JSON file per handler scenario, consumed by Vitest tests under
`web/scripts/handlers/*.test.js`.

## Schema

```json
{
  "scenario": "<file name>",
  "handler": "<handler key>",
  "messages": [
    { "kind": "event",    "parameters": { "252": 27, "0": 12345 } },
    { "kind": "request",  "parameters": { "253": 22, "1": [10.5, 20.5] } },
    { "kind": "response", "parameters": { "253": 2, "8": 1337 }, "returnCode": 0 }
  ]
}
```

- `kind` maps to `EventRouter.onEvent | onRequest | onResponse` dispatch.
- `parameters` keys are decimal strings to survive JSON; tests coerce keys to
  numeric before feeding the router / handler.
- `returnCode` is optional and only meaningful for responses.

## Generation

Fixtures are produced by `tools/photon-dump`. Hand-written fixtures carry a
`synthetic` marker in the consuming test header comment; extracted fixtures
carry `pcap-derived <fragment-path>`.
