# Shortening is open without authentication

Anyone who can reach the write API can Shorten; there are no accounts, API keys or Link owners. Abuse is contained by per-IP rate limiting and Target URL validation, and because the write and read APIs run as separate processes, a deployment can keep the write API off the public network without code changes. A half-measure such as a shared API key was rejected: if authentication is ever needed, it should be done properly (OIDC, for example), and no domain rule depends on who shortened a Link.
