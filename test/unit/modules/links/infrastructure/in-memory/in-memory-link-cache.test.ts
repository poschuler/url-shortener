import { InMemoryLinkCache } from "#src/modules/links/infrastructure/in-memory/in-memory-link-cache.js";

import { describeLinkCacheContract } from "../../../../../contract/modules/links/infrastructure/link-cache.contract.js";

describeLinkCacheContract(() => new InMemoryLinkCache());
