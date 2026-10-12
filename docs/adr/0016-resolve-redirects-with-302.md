# Resolve redirects with 302

`GET /:code` answers with a `302 Found` to the Target URL, not a `301 Moved Permanently`, even though Links never change (ADR-0001). Browsers cache a 301 with no expiry and follow it from then on without asking the service again. That would take two things away for good: disabling a Link that turns out to be abusive (phishing, malware) for Visitors who already followed it, and counting visits, which the metrics phase needs. A 302 keeps every visit going through the service, and the Redis cache keeps that cheap (ADR-0017).

## Considered Options

- **301 Moved Permanently**: fewer requests, since repeat Visitors skip the service. But nothing can undo it once a browser has cached it, and those visits are never seen.
- **307 Temporary Redirect**: the same as a 302 for a `GET`; it only differs in keeping the method and body of other methods, which Resolve does not accept.
- **301 with a short `Cache-Control: max-age`**: limits how long browsers keep it, but every cache along the way has to honour the header, and a 301 cached without it still cannot be undone. A 302 gets the same control without depending on that.

## Consequences

Every visit costs a request to `read-api`, so the read path has to be fast and cached. Search engines treat the Short URL as temporary and keep indexing it instead of the Target URL, which suits a shortener. Switching to 301 later is easy, but switching back does not help the browsers that already cached a 301.
