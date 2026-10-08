import { render, screen } from "@testing-library/react";
import { homePageImageCheckboxLabel } from "./imageSelectionLabel";

describe("homePageImageCheckboxLabel", () => {
  it("names the checkbox so it can be found by accessible name", () => {
    const key = "images/1764265678912-d.jpeg";
    const label = homePageImageCheckboxLabel(key);
    render(<input type="checkbox" aria-label={label} />);
    expect(screen.getByRole("checkbox", { name: label })).toBeInTheDocument();
    expect(label).toBe("Show 1764265678912-d.jpeg on the home page");
  });

  it("uses a fallback when the key has no filename segment", () => {
    expect(homePageImageCheckboxLabel("images/")).toBe("Show photo on the home page");
  });
});
