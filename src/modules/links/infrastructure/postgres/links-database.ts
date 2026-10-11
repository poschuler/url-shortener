// The tables of the links module, as Kysely sees them.
export type LinksDatabase = {
  "links.links": LinksTable;
};

export type LinksTable = {
  code: string;
  url: string;
  created_at: Date;
};
