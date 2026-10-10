# Shortening is not idempotent

Shortening the same Target URL twice creates two different Links instead of returning the existing one. Deduplicating would require an index on Target URL and an extra lookup on every Shorten, and it would leak information: a caller could learn that someone else had already shortened a given URL. Reversing this later means reconciling the duplicate Links already stored.
