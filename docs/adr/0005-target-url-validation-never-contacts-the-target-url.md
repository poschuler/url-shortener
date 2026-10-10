# Target URL validation never contacts the Target URL

A Target URL is accepted after local checks only: it parses as an absolute http or https URL, carries no user credentials, its canonical form fits within the configured maximum length, and its hostname differs from the hostname of the service's public base URL. That last rule stops a Link from pointing at another Link on this service. A Link to another shortener whose Short URL points back here is still accepted: detecting it would mean following third-party redirects while shortening, which adds network I/O to the write path and turns the write API into an SSRF vector, and browsers already abort such loops after about 20 redirects. For the same reason, blocking localhost, private IP ranges or known-malicious domains is not a domain rule: it only matters to a service that visits URLs, and this one only answers with a redirect.

## Considered Options

- **Follow redirects when shortening**: catches loops through other shorteners, at the cost of latency, external I/O and SSRF exposure.
- **Resolve the host and reject private addresses**: protects nothing here, since the service never connects to the Target URL.

## Consequences

A redirect loop through a third-party shortener remains possible. Abuse such as phishing links is not filtered by validation; it is contained by rate limiting (ADR-0003) and can be handled by a separate filtering layer if ever needed.
