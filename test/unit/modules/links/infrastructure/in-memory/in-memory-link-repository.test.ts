import { InMemoryLinkRepository } from "#src/modules/links/infrastructure/in-memory/in-memory-link-repository.js";

import { describeLinkRepositoryContract } from "../../../../../contract/modules/links/infrastructure/link-repository.contract.js";
import { describeTargetUrlLookupContract } from "../../../../../contract/modules/links/infrastructure/target-url-lookup.contract.js";

describeLinkRepositoryContract(() => new InMemoryLinkRepository());

describeTargetUrlLookupContract(() => {
  const repository = new InMemoryLinkRepository();
  return { repository, lookup: repository };
});
