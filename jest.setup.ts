import "@testing-library/jest-dom";
import { toHaveNoViolations } from "jest-axe";
import { resetTestObjectStore } from "@/test/storeHelpers";
expect.extend(toHaveNoViolations);

beforeEach(() => {
  resetTestObjectStore();
});

// Silence noisy error logs during tests
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

jest.mock("next/server", () => ({
  NextRequest: jest.fn().mockImplementation((url) => ({
    url,
    headers: new Headers(),
    cookies: new Map(),
    nextUrl: new URL(url),
    page: {},
    ua: {},
    geo: {},
    ip: "127.0.0.1",
  })),
  NextResponse: {
    json: jest.fn().mockImplementation((data, init) => ({
      status: init?.status || 200,
      headers: new Headers(init?.headers),
      json: async () => data,
    })),
  },
}));
