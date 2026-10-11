import type { NumberSequence } from "../../application/ports.js";

export class InMemoryNumberSequence implements NumberSequence {
  private nextNumber: bigint;

  public constructor(first = 0n) {
    this.nextNumber = first;
  }

  public next(): Promise<bigint> {
    const number = this.nextNumber;
    this.nextNumber += 1n;
    return Promise.resolve(number);
  }
}
