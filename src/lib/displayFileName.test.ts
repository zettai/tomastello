import { displayFileName } from "./displayFileName";

describe("displayFileName", () => {
  it("should prefer originalName when present", () => {
    expect(displayFileName("images/1700-shot.jpg", "My Shot.jpg")).toBe(
      "My Shot.jpg"
    );
  });

  it("should strip storage prefix when originalName is missing", () => {
    expect(displayFileName("images/1700123456789-e2e-pixel.png")).toBe(
      "e2e-pixel.png"
    );
  });

  it("should return the bare key when there is no slash or timestamp", () => {
    expect(displayFileName("plain.jpg")).toBe("plain.jpg");
  });
});
