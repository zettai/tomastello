import { mapWithConcurrency } from "./uploadQueue";

describe("mapWithConcurrency", () => {
  it("should process every item and never drop results", async () => {
    const items = [1, 2, 3, 4, 5];
    const seen: number[] = [];
    const results = await mapWithConcurrency(items, 2, async (n) => {
      seen.push(n);
      await new Promise((r) => setTimeout(r, 5));
      return n * 2;
    });
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(seen.sort((a, b) => a - b)).toEqual(items);
  });

  it("should keep going when one worker rejects if the caller catches", async () => {
    const results = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) return "fail";
      return `ok-${n}`;
    });
    expect(results).toEqual(["ok-1", "fail", "ok-3"]);
  });
});
