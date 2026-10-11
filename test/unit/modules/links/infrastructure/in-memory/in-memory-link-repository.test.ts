import { InMemoryLinkRepository } from "#src/modules/links/infrastructure/in-memory/in-memory-link-repository.js";

import { describeLinkRepositoryContract } from "../../../../../contract/modules/links/infrastructure/link-repository.contract.js";

describeLinkRepositoryContract(() => new InMemoryLinkRepository());
