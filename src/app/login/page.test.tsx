import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import LoginPage from "./page";
import { useSearchParams } from "next/navigation";

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
}));

global.fetch = jest.fn();

describe("LoginPage", () => {
  const mockSearchParams = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
    (global.fetch as jest.Mock).mockClear();
  });

  it("has no accessibility violations on initial render", async () => {
    const { container } = render(<LoginPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("user@example.com")).toBeInTheDocument();
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders magic-link sign-in form", async () => {
    render(<LoginPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("user@example.com")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /EMAIL ME A SIGN-IN LINK/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("••••••••")).not.toBeInTheDocument();
  });

  it("requests a magic sign-in link", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, message: "Check your email." }),
    });

    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("user@example.com")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("user@example.com"), {
      target: { value: "luisszkl@gmail.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /EMAIL ME A SIGN-IN LINK/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "luisszkl@gmail.com", next: "/admin" }),
      });
      expect(screen.getByText(/Check your email/i)).toBeInTheDocument();
    });
  });

  it("shows expired link error from query string", async () => {
    (mockSearchParams.get as jest.Mock).mockImplementation((key: string) =>
      key === "error" ? "expired" : null,
    );

    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByText(/Sign-in link expired or invalid/i)).toBeInTheDocument();
    });
  });
});
