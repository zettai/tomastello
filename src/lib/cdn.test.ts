/**
 * @jest-environment node
 */
import { purgeCache } from "@netlify/functions";
import { PAGE_CACHE_TAG, purgePublicPages } from "./cdn";

jest.mock("@netlify/functions", () => ({
  purgeCache: jest.fn(),
}));

const purgeCacheMock = purgeCache as jest.MockedFunction<typeof purgeCache>;

describe("purgePublicPages", () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetModules();
    purgeCacheMock.mockReset();
    process.env = { ...env };
    delete process.env.NETLIFY;
    delete process.env.NETLIFY_PURGE_API_TOKEN;
    delete process.env.SITE_ID;
  });

  afterAll(() => {
    process.env = env;
  });

  it("skips when not on Netlify", async () => {
    expect(await purgePublicPages()).toBe("skipped");
    expect(purgeCacheMock).not.toHaveBeenCalled();
  });

  it("purges the page tag when NETLIFY is set", async () => {
    process.env.NETLIFY = "true";
    purgeCacheMock.mockResolvedValueOnce(undefined);
    expect(await purgePublicPages()).toBe("purged");
    expect(purgeCacheMock).toHaveBeenCalledWith({ tags: [PAGE_CACHE_TAG] });
  });

  it("returns failed when purge throws", async () => {
    process.env.SITE_ID = "site-id";
    purgeCacheMock.mockRejectedValueOnce(new Error("api down"));
    expect(await purgePublicPages()).toBe("failed");
  });
});
