# DDD only at the tactical level, kept small

The project takes a few tactical patterns from domain-driven design and stops there. The words of the domain are defined once in `CONTEXT.md` and used the same way in code, tests and docs. `ShortCode` and `TargetUrl` are value objects that check their rules when they are created, so an invalid one cannot exist. `Link` is the only entity and its own aggregate: it holds a Short Code, a Target URL and a creation date, and never changes (ADR-0001). The domain reports expected failures, such as an invalid Target URL, as typed errors in a `Result` instead of throwing, so the signature of a use case says what can go wrong. There is a repository for writing Links; Resolve reads plain data through a query port instead (ADR-0008).

The rest is left out on purpose. There are no domain events, because nothing else reacts to a new Link. There are no aggregates with several entities, no factories to rebuild a Link from storage, and no strategic design: the system is one bounded context, so there is no context map to draw.

In the API and the database, the field that holds a Short Code is named `code`. `CONTEXT.md` avoids "code" in prose, where it is ambiguous; a field name sits next to its value and its description, so the short name stays.

## Considered Options

- **DDD in full**, with domain events, application services per aggregate and a context map: they solve problems of systems with several contexts and teams, and this one has neither.
- **No DDD**, validating in the route handlers: the rules of a Target URL would be spread across handlers and checked again wherever a URL is used.
- **Exceptions for domain errors**: they would leave the return types silent about what can fail, and every caller would need to know which errors to catch.

## Consequences

The domain stays small and has no I/O, so its tests cover it completely, and the coverage threshold for `domain/` is 100%. When authentication arrives (ADR-0003), accounts may become a second bounded context, and Links may need events or a rebuilding factory; they are added then, not ahead of time.
