# Links are immutable and permanent

Once created, a Link's Target URL never changes and its Short Code is never deleted or reassigned. This keeps the read path trivially cacheable (positive cache entries never need invalidation) and guarantees that a shared Short URL never silently starts pointing somewhere else. Editing and deletion are out of scope; if they are ever added, deleted Short Codes must stay retired rather than be reused.
