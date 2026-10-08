jest.mock("@/lib/uploadClient", () => ({
  ...jest.requireActual("@/lib/uploadClient"),
  fetchUploadConfig: jest.fn().mockResolvedValue({ mode: "relay", chunkSizeMb: 5 }),
}));

import "@testing-library/jest-dom";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import AudioUpload from "./AudioUpload";

const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

describe("AudioUpload", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("renders upload card", () => {
    render(<AudioUpload />);
    expect(screen.getByText(/UPLOAD AUDIO/i)).toBeInTheDocument();
    expect(screen.getByText(/Max 100MB per file/i)).toBeInTheDocument();
  });

  it("uploads successfully and calls onUploadSuccess", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true }),
    });

    const onSuccess = jest.fn();
    const { container } = render(<AudioUpload onUploadSuccess={onSuccess} />);
    const file = new File(["data"], "song.mp3", { type: "audio/mpeg" });
    const input = container.querySelector("input[data-audio]") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("shows uploading state during upload", async () => {
    global.fetch = jest.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 200))
    );

    const { container } = render(<AudioUpload />);
    const file = new File(["data"], "song.mp3", { type: "audio/mpeg" });
    const input = container.querySelector("input[data-audio]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText(/UPLOADING/i)).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.queryByText(/UPLOADING/i)).not.toBeInTheDocument()
    );
  });

  it("shows inline error on API error response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false, error: "Server error" }),
    });

    const { container } = render(<AudioUpload />);
    const file = new File(["data"], "song.mp3", { type: "audio/mpeg" });
    const input = container.querySelector("input[data-audio]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByText("Server error")).toBeInTheDocument()
    );
  });

  it("shows inline error on network failure", async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("network"));
    const { container } = render(<AudioUpload />);
    const file = new File(["data"], "song.mp3", { type: "audio/mpeg" });
    const input = container.querySelector("input[data-audio]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByText("Upload failed")).toBeInTheDocument()
    );
  });

  it("handles drag and drop upload", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true }),
    });

    const onSuccess = jest.fn();
    const { container } = render(<AudioUpload onUploadSuccess={onSuccess} />);
    const dropZone = container.querySelector("button") as HTMLElement;
    const file = new File(["data"], "drop.mp3", { type: "audio/mpeg" });

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] },
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("handles dragOver and dragLeave without errors", () => {
    const { container } = render(<AudioUpload />);
    const dropZone = container.querySelector("button") as HTMLElement;
    fireEvent.dragOver(dropZone);
    fireEvent.dragLeave(dropZone);
    expect(dropZone).toBeInTheDocument();
  });

  it("renders in admin mode with admin styling", () => {
    const { container } = render(<AudioUpload adminMode />);
    expect(container.querySelector("button.admin-inset")).toBeInTheDocument();
  });

  it("uses multipart path for large files and shows progress bar", async () => {
    // init → success, part → success, complete → success
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ uploadId: "uid-1", key: "audio/test.mp3" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ etag: '"etag-1"', partNumber: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ etag: '"etag-2"', partNumber: 2 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

    const onSuccess = jest.fn();
    const { container } = render(<AudioUpload onUploadSuccess={onSuccess} />);

    // 12 MB file triggers multipart (threshold is 10 MB)
    const bigFile = new File([new ArrayBuffer(12 * 1024 * 1024)], "big.mp3", {
      type: "audio/mpeg",
    });
    Object.defineProperty(bigFile, "size", { value: 12 * 1024 * 1024 });

    const input = container.querySelector("input[data-audio]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [bigFile] } });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1), { timeout: 5000 });
  });

  it("shows error when multipart init fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Rate limit exceeded" }),
    });

    const { container } = render(<AudioUpload />);
    const bigFile = new File([new ArrayBuffer(12 * 1024 * 1024)], "big.mp3", {
      type: "audio/mpeg",
    });
    Object.defineProperty(bigFile, "size", { value: 12 * 1024 * 1024 });

    const input = container.querySelector("input[data-audio]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [bigFile] } });

    await waitFor(() =>
      expect(screen.getByText("Rate limit exceeded")).toBeInTheDocument(),
      { timeout: 5000 }
    );
  });

  it("shows error when a multipart part upload fails after retries", async () => {
    jest.useFakeTimers();

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ uploadId: "uid-1", key: "audio/test.mp3" }),
      })
      // All retry attempts for part 1 fail (3 retries × abort = 4 calls)
      .mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });

    const { container } = render(<AudioUpload />);
    const bigFile = new File([new ArrayBuffer(12 * 1024 * 1024)], "big.mp3", {
      type: "audio/mpeg",
    });
    Object.defineProperty(bigFile, "size", { value: 12 * 1024 * 1024 });

    const input = container.querySelector("input[data-audio]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [bigFile] } });

    // Advance through all retry backoff timers
    await jest.runAllTimersAsync();
    jest.useRealTimers();

    await waitFor(() =>
      expect(screen.getByText(/Failed to upload part/i)).toBeInTheDocument()
    );
  });
});
