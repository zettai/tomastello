jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
jest.mock("@/lib/apiDocs", () => ({ apiDocsEnabled: jest.fn() }));

import { notFound } from "next/navigation";
import { apiDocsEnabled } from "@/lib/apiDocs";
import SwaggerLayout from "./layout";

describe("SwaggerLayout", () => {
  it("should render the page when API docs are enabled", () => {
    (apiDocsEnabled as jest.Mock).mockReturnValue(true);
    expect(SwaggerLayout({ children: "docs" })).toBe("docs");
    expect(notFound).not.toHaveBeenCalled();
  });

  it("should answer 404 when API docs are disabled", () => {
    (apiDocsEnabled as jest.Mock).mockReturnValue(false);
    expect(() => SwaggerLayout({ children: "docs" })).toThrow("NEXT_NOT_FOUND");
  });
});
