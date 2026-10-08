import { apiDocsEnabled } from "./apiDocs";

describe("apiDocsEnabled", () => {
  it.each([
    [{ NODE_ENV: "development" }, true],
    [{ NODE_ENV: "test" }, true],
    [{}, true],
    [{ NODE_ENV: "production" }, false],
    [{ NODE_ENV: "production", ENABLE_API_DOCS: "false" }, false],
    [{ NODE_ENV: "production", ENABLE_API_DOCS: "true" }, true],
  ])("should return %p -> %p", (env, expected) => {
    expect(apiDocsEnabled(env)).toBe(expected);
  });
});
