import { render, screen } from "@testing-library/react";
import React from "react";

const pushMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    prefetch: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => "/swagger",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock fetch to simulate authenticated user
beforeAll(() => {
  global.fetch = jest.fn().mockImplementation((url) => {
    if (url === "/api/auth/profile") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ user: { email: "test@example.com" } }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});

afterAll(() => {
  jest.resetAllMocks();
});

import SwaggerPage from "./page";

// swagger-ui-react is a heavy dynamic import: the self-hosted CI runner needs more than 5 s.
jest.setTimeout(20000);

describe("SwaggerPage", () => {
  it("renders the Swagger UI heading", async () => {
    render(<SwaggerPage />);
    expect(await screen.findByText(/API Documentation/i)).toBeInTheDocument();
  });

  it("renders the Swagger UI loading spinner", async () => {
    render(<SwaggerPage />);
    expect(
      await screen.findByText(/Loading Swagger UI.../i)
    ).toBeInTheDocument();
  });

  it("shows redirect message if not authenticated", async () => {
    pushMock.mockClear();
    (global.fetch as jest.Mock).mockImplementationOnce((url) => {
      if (url === "/api/auth/profile") {
        return Promise.resolve({ ok: false });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    render(<SwaggerPage />);
    await screen.findByText(/Redirecting to login/i);
    expect(pushMock).toHaveBeenCalledWith("/login?redirect=/swagger");
  });

  it("shows error message if swagger spec fails to load", async () => {
    // Mock authenticated user
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url === "/api/auth/profile") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ user: { email: "test@example.com" } }),
        });
      }
      if (url === "/api/swagger") {
        return Promise.reject(new Error("Failed to load"));
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    render(<SwaggerPage />);
    expect(
      await screen.findByText(/Failed to load API specification/i)
    ).toBeInTheDocument();
    expect(await screen.findByText(/Return to Home/i)).toBeInTheDocument();
  });
});
