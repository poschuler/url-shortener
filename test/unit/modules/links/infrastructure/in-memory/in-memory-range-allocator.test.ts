import { InMemoryRangeAllocator } from "#src/modules/links/infrastructure/in-memory/in-memory-range-allocator.js";

import { describeRangeAllocatorContract } from "../../../../../contract/modules/links/infrastructure/range-allocator.contract.js";

describeRangeAllocatorContract(() => new InMemoryRangeAllocator());
