# Links

Shortens Target URLs into Short URLs and resolves Short Codes so Visitors are redirected to the matching Target URL.

## Language

**Link**:
The association between a Short Code and a Target URL, identified by its Short Code. Once created, a Link never changes and never disappears.
_Avoid_: short link, shortened URL, alias

**Short Code**:
The seven-character, case-sensitive base62 identifier of a Link, unique across all Links and never reassigned.
_Avoid_: code, slug, token, ID

**Target URL**:
The http or https URL a Link redirects to, kept in canonical form. It never carries user credentials, and its hostname is never the hostname of the service's public base URL.
_Avoid_: long URL, original URL, destination

**Short URL**:
The public URL a Visitor follows: the service's public base URL followed by a Short Code.
_Avoid_: short link, tiny URL

**Visitor**:
Anyone who follows a Short URL and is redirected to its Target URL.
_Avoid_: user, client

### Operations

**Shorten**:
Creating a new Link for a Target URL. Shortening the same Target URL twice yields two different Links.
_Avoid_: create short link, generate

**Resolve**:
Finding the Target URL of a Short Code.
_Avoid_: lookup, expand, redirect
