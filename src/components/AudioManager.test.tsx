import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AudioManager from "./AudioManager";
import type { AudioMetadata } from "@/types/audio";

const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

const mockAudio: AudioMetadata[] = [
  {
    id: "1",
    title: "Song A",
    fileName: "audio/a.mp3",
    url: "https://x/a.mp3",
    size: 1024 * 1024,
    mimeType: "audio/mpeg",
    order: 1,
    uploadedAt: "",
    uploadedBy: "",
  },
  {
    id: "2",
    title: "Song B",
    fileName: "audio/b.mp3",
    url: "https://x/b.mp3",
    size: 512 * 1024,
    mimeType: "audio/mpeg",
    order: 2,
    uploadedAt: "",
    uploadedBy: "",
  },
];

describe("AudioManager", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.confirm = jest.fn(() => true);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("shows loading state initially", () => {
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));
    render(<AudioManager refreshTrigger={0} setError={jest.fn()} />);
    expect(screen.getByText(/LOADING AUDIO/i)).toBeInTheDocument();
  });

  it("shows empty state when no audio", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, audio: [] }),
    });
    render(<AudioManager refreshTrigger={0} setError={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/NO AUDIO FILES/i)).toBeInTheDocument()
    );
  });

  it("renders audio list with title and size", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, audio: mockAudio }),
    });
    render(<AudioManager refreshTrigger={0} setError={jest.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Song A")).toBeInTheDocument();
      expect(screen.getByText("Song B")).toBeInTheDocument();
      expect(screen.getByText(/1\.0 MB/)).toBeInTheDocument();
    });
  });

  it("moves audio up and down", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, audio: mockAudio }),
    });
    render(<AudioManager refreshTrigger={0} setError={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByText("Song A")).toBeInTheDocument()
    );

    const downButtons = screen.getAllByText("↓");
    fireEvent.click(downButtons[0]); // move Song A down

    await waitFor(() => {
      const titles = screen
        .getAllByText(/Song [AB]/)
        .map((el) => el.textContent);
      expect(titles[0]).toBe("Song B");
      expect(titles[1]).toBe("Song A");
    });
  });

  it("saves order via PUT /api/audio/reorder", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, audio: mockAudio }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, audio: mockAudio }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, audio: mockAudio }),
      });

    render(<AudioManager refreshTrigger={0} setError={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByText("Song A")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText(/SAVE ORDER/i));

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      const reorderCall = calls.find(
        ([url, opts]) =>
          url === "/api/audio/reorder" && opts?.method === "PUT"
      );
      expect(reorderCall).toBeDefined();
    });
  });

  it("shows rename input on REN click", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, audio: mockAudio }),
    });
    render(<AudioManager refreshTrigger={0} setError={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByText("Song A")).toBeInTheDocument()
    );

    const renButtons = screen.getAllByText("REN");
    fireEvent.click(renButtons[0]);

    expect(screen.getByLabelText(/new title/i)).toBeInTheDocument();
  });

  it("renames audio on OK click", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, audio: mockAudio }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, audio: { ...mockAudio[0], title: "Renamed" } }),
      });

    render(<AudioManager refreshTrigger={0} setError={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByText("Song A")).toBeInTheDocument()
    );

    fireEvent.click(screen.getAllByText("REN")[0]);
    const input = screen.getByLabelText(/new title/i);
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.click(screen.getByText("OK"));

    await waitFor(() =>
      expect(screen.getByText("Renamed")).toBeInTheDocument()
    );
  });

  it("cancels rename on X click", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, audio: mockAudio }),
    });
    render(<AudioManager refreshTrigger={0} setError={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByText("Song A")).toBeInTheDocument()
    );

    fireEvent.click(screen.getAllByText("REN")[0]);
    expect(screen.getByLabelText(/new title/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText("X"));
    expect(screen.queryByLabelText(/new title/i)).not.toBeInTheDocument();
  });

  it("deletes audio after confirm", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, audio: mockAudio }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      });

    render(<AudioManager refreshTrigger={0} setError={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByText("Song A")).toBeInTheDocument()
    );

    fireEvent.click(screen.getAllByText("DEL")[0]);

    await waitFor(() =>
      expect(screen.queryByText("Song A")).not.toBeInTheDocument()
    );
  });

  it("does not delete if confirm returns false", async () => {
    global.confirm = jest.fn(() => false);
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, audio: mockAudio }),
    });
    render(<AudioManager refreshTrigger={0} setError={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByText("Song A")).toBeInTheDocument()
    );

    fireEvent.click(screen.getAllByText("DEL")[0]);
    expect(screen.getByText("Song A")).toBeInTheDocument();
  });

  it("calls setError on fetch failure during delete", async () => {
    const setError = jest.fn();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, audio: mockAudio }),
      })
      .mockRejectedValueOnce(new Error("network"));

    render(<AudioManager refreshTrigger={0} setError={setError} />);
    await waitFor(() =>
      expect(screen.getByText("Song A")).toBeInTheDocument()
    );

    fireEvent.click(screen.getAllByText("DEL")[0]);

    await waitFor(() => expect(setError).toHaveBeenCalledWith("network"));
  });

  it("calls setError on reorder failure", async () => {
    const setError = jest.fn();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, audio: mockAudio }),
      })
      .mockRejectedValueOnce(new Error("reorder fail"));

    render(<AudioManager refreshTrigger={0} setError={setError} />);
    await waitFor(() =>
      expect(screen.getByText("Song A")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText(/SAVE ORDER/i));

    await waitFor(() =>
      expect(setError).toHaveBeenCalledWith("reorder fail")
    );
  });
});
