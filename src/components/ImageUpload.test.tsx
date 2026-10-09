jest.mock("@/lib/uploadClient", () => ({
  ...jest.requireActual("@/lib/uploadClient"),
  fetchUploadConfig: jest.fn().mockResolvedValue({ mode: "relay", chunkSizeMb: 5 }),
}));

import "@testing-library/jest-dom";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import ImageUpload from "./ImageUpload";

const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe("ImageUpload", () => {
  let originalFetch: typeof global.fetch;
  let originalAlert: typeof global.alert;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalAlert = global.alert;
    global.alert = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.alert = originalAlert;
    jest.clearAllMocks();
  });

  it("renders upload button", () => {
    render(<ImageUpload onUploadSuccess={() => {}} />);
    expect(screen.getByText(/UPLOAD IMAGE/i)).toBeInTheDocument();
  });

  it("handles file selection", async () => {
    const mockOnUploadSuccess = jest.fn();
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, url: "test.jpg" }),
    });

    const { container } = render(<ImageUpload onUploadSuccess={mockOnUploadSuccess} />);
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const input = container.querySelector("input[data-image]") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockOnUploadSuccess).toHaveBeenCalledWith({
        success: true,
        url: "test.jpg",
      });
    });
  });

  it("shows loading state during upload", async () => {
    const { container } = render(<ImageUpload onUploadSuccess={() => {}} />);
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const input = container.querySelector("input[data-image]") as HTMLInputElement;

    global.fetch = jest
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText(/UPLOADING/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/UPLOADING/i)).not.toBeInTheDocument();
    });
  });

  it("handles upload error", async () => {
    const mockOnUploadSuccess = jest.fn();
    const alertMock = jest.spyOn(window, "alert").mockImplementation(() => {});
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("network"));

    const { container } = render(<ImageUpload onUploadSuccess={mockOnUploadSuccess} />);
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const input = container.querySelector("input[data-image]") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockOnUploadSuccess).not.toHaveBeenCalled();
      expect(alertMock).toHaveBeenCalledWith("test.jpg: Upload failed");
    });

    alertMock.mockRestore();
  });

  it("rejects non-image files", async () => {
    const alertMock = jest.spyOn(window, "alert").mockImplementation(() => {});
    const { container } = render(<ImageUpload onUploadSuccess={() => {}} />);
    const file = new File(["test"], "test.txt", { type: "text/plain" });
    const input = container.querySelector("input[data-image]") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect(alertMock).toHaveBeenCalledWith(
      "test.txt: Please select an image file"
    );
    alertMock.mockRestore();
  });

  it("shows drag over style", () => {
    const { container } = render(<ImageUpload />);
    const dropZone = container.querySelector("button.retro-inset") as HTMLElement;
    fireEvent.dragOver(dropZone);
    expect(dropZone.className).toMatch("retro-inset w-full p-8 text-center transition-all");
  });

  it("resets drag over style on drag leave", () => {
    const { container } = render(<ImageUpload />);
    const dropZone = container.querySelector("button.retro-inset") as HTMLElement;
    fireEvent.dragOver(dropZone);
    expect(dropZone.className).toMatch("retro-inset w-full p-8 text-center transition-all");
    fireEvent.dragLeave(dropZone);
    expect(dropZone.className).toMatch("retro-inset w-full p-8 text-center transition-all");
  });

  it("alerts on upload error with no error message", async () => {
    const mockResponse = { success: false };
    global.fetch = jest
      .fn()
      .mockResolvedValue({ json: () => Promise.resolve(mockResponse) });
    const { container } = render(<ImageUpload />);
    const input = container.querySelector("input[data-image]") as HTMLInputElement;
    const file = new File(["dummy"], "test.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(global.alert).toHaveBeenCalledWith("test.jpg: Upload failed")
    );
  });

  it("alerts on network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network"));
    const { container } = render(<ImageUpload />);
    const input = container.querySelector("input[data-image]") as HTMLInputElement;
    const file = new File(["dummy"], "test.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(global.alert).toHaveBeenCalledWith("test.jpg: Upload failed")
    );
  });

  it("shows uploading state", async () => {
    global.fetch = jest.fn(() => new Promise(() => {})); // never resolves
    const { container } = render(<ImageUpload />);
    const input = container.querySelector("input[data-image]") as HTMLInputElement;
    const file = new File(["dummy"], "test.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/UPLOADING/i)).toBeInTheDocument());
  });
});
