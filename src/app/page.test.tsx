import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "jest-axe";
import PhotoGalleryClient from "@/components/PhotoGalleryClient";

jest.mock("@/components/SongPlayer", () => () => null);

const mockPhotos = [
  { id: "1", url: "http://example.com/photo1.jpg" },
  { id: "2", url: "http://example.com/photo2.jpg" },
];

describe("PhotoGalleryClient", () => {
  it("has no accessibility violations on initial render", async () => {
    const { container } = render(<PhotoGalleryClient photos={mockPhotos} />);
    expect(screen.getByText("[ IMAGES.DIR ]")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("opens photo modal when clicking a photo", async () => {
    render(<PhotoGalleryClient photos={mockPhotos} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    const closeButtons = screen.getAllByRole("button", { name: "Close photo preview" });
    expect(closeButtons.find((btn) => btn.textContent === "[X]")).toBeInTheDocument();
  });

  it("closes photo modal when pressing escape key", async () => {
    render(<PhotoGalleryClient photos={mockPhotos} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Close photo preview" })).not.toBeInTheDocument();
  });

  it("should show gallery caption without filename", async () => {
    render(<PhotoGalleryClient photos={mockPhotos} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(
      screen.getByText("Photo 1 of 2 from Tomás Tello's gallery")
    ).toBeInTheDocument();
    expect(screen.queryByText(/photo1\.jpg/i)).not.toBeInTheDocument();
  });
});
