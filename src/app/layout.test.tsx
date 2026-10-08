import { render } from "@testing-library/react";
import RootLayout from "./layout";

jest.mock("next/font/google", () => ({
  Space_Mono: () => ({
    variable: "--font-space-mono",
  }),
}));

describe("RootLayout", () => {
  it("renders children", () => {
    render(
      <RootLayout>
        <div data-testid="child">Test content</div>
      </RootLayout>
    );

    expect(document.querySelector('[data-testid="child"]')).toBeInTheDocument();
  });
});
