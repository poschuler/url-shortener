import type { Link } from "./link.js";

export interface LinkRepository {
  save(link: Link): Promise<void>;
}
