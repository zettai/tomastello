import { render, screen } from "@testing-library/react";
import { Footer } from "./Footer";
import { usePathname } from "next/navigation";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

describe("Footer", () => {
  const mockUsePathname = usePathname as jest.Mock;
  const currentYear = new Date().getFullYear();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders footer on home page", () => {
    mockUsePathname.mockReturnValue("/");

    render(<Footer />);

    expect(screen.getByText(/COPYRIGHT.TXT/i)).toBeInTheDocument();
    expect(
      screen.getByText(`© ${currentYear} Tomás Tello. All rights reserved.`)
    ).toBeInTheDocument();
  });

  it("displays current year dynamically", () => {
    mockUsePathname.mockReturnValue("/");

    render(<Footer />);

    const copyrightText = screen.getByText(
      new RegExp(`© ${currentYear} Tomás Tello`)
    );
    expect(copyrightText).toBeInTheDocument();
  });

  it.each(["/admin", "/admin/settings", "/login", "/register"])(
    "does not render on %s",
    (path) => {
      mockUsePathname.mockReturnValue(path);

      const { container } = render(<Footer />);

      expect(container.firstChild).toBeNull();
    }
  );

  it("renders on other pages", () => {
    mockUsePathname.mockReturnValue("/about");

    render(<Footer />);

    expect(screen.getByText(/COPYRIGHT.TXT/i)).toBeInTheDocument();
  });

  it("handles null pathname gracefully", () => {
    mockUsePathname.mockReturnValue(null);

    render(<Footer />);

    // Should render footer when pathname is null (default case)
    expect(screen.getByText(/COPYRIGHT.TXT/i)).toBeInTheDocument();
  });

  it("has correct footer structure with retro styling", () => {
    mockUsePathname.mockReturnValue("/");

    render(<Footer />);

    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveClass("mt-8", "py-6", "border-t", "border-border");

    const titleBar = screen.getByText(/COPYRIGHT.TXT/i);
    expect(titleBar).toHaveClass("retro-title-bar");
  });
});
