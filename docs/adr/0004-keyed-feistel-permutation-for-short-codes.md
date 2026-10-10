# Keyed Feistel permutation for Short Codes

Short Codes are derived from sequential numbers, so the number is scrambled before encoding to stop Short Codes from being enumerable. The original plan, `(n × P) mod 62⁷`, is linear: the codes of two consecutive Links differ by exactly P, so anyone who shortens twice can recover P and walk every Link. Instead, the number goes through a four-round Feistel network over 42 bits with a secret key and a non-cryptographic integer mixer as the round function, using cycle-walking to stay within 62⁷. This remains a bijection, so no two numbers ever share a Short Code, and it is pure arithmetic, so it lives in the domain with no imports.

## Considered Options

- **Multiplicative permutation**: trivial, but recoverable from two samples.
- **Feistel with HMAC-SHA256 as the round function**: cryptographically strong, but needs `node:crypto`, which would push the permutation behind a port for a threat this project doesn't face.

## Consequences

The key, the round function (its constants and shifts), the number of rounds and the base62 alphabet order are immutable once Links exist: changing any of them remaps every number and can produce Short Codes that collide with stored ones. This is obfuscation, not access control: a Link is still reachable by anyone who has its Short URL.
