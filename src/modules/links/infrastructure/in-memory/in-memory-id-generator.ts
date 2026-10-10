import type { IdGenerator } from "../../application/ports.js";

export class InMemoryIdGenerator implements IdGenerator {
  private nextId: bigint;

  public constructor(firstId = 0n) {
    this.nextId = firstId;
  }

  public next(): Promise<bigint> {
    const id = this.nextId;
    this.nextId += 1n;
    return Promise.resolve(id);
  }
}
