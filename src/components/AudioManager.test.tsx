import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AudioManager from "./AudioManager";
import type { AudioMetadata } from "@/types/audio";
import { renderWithToast } from "@/test/adminToast";

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
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  async function confirmDeleteInModal(): Promise<void> {
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  }

  it("shows loading state initially", () => {
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));
    renderWithToast(<AudioManager refreshTrigger={0} />);
    expect(screen.getByText(/LOADING AUDIO/i)).toBeInTheDocument();
  });

  it("shows empty state when no audio", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, audio: [] }),
    });
    renderWithToast(<AudioManager refreshTrigger={0} />);
    await waitFor(() =>
      expect(screen.getByText(/NO AUDIO FILES/i)).toBeInTheDocument()
    );
  });

  it("renders audio list with title and size", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, audio: mockAudio }),
    });
    renderWithToast(<AudioManager refreshTrigger={0} />);
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
    renderWithToast(<AudioManager refreshTrigger={0} />);
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

    renderWithToast(<AudioManager refreshTrigger={0} />);
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
    renderWithToast(<AudioManager refreshTrigger={0} />);
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

    renderWithToast(<AudioManager refreshTrigger={0} />);
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
    renderWithToast(<AudioManager refreshTrigger={0} />);
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

    renderWithToast(<AudioManager refreshTrigger={0} />);
    await waitFor(() =>
      expect(screen.getByText("Song A")).toBeInTheDocument()
    );

    fireEvent.click(screen.getAllByText("DEL")[0]);
    await confirmDeleteInModal();

    await waitFor(() =>
      expect(screen.queryByText("Song A")).not.toBeInTheDocument()
    );
  });

  it("does not delete if user cancels confirmation modal", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, audio: mockAudio }),
    });
    renderWithToast(<AudioManager refreshTrigger={0} />);
    await waitFor(() =>
      expect(screen.getByText("Song A")).toBeInTheDocument()
    );

    fireEvent.click(screen.getAllByText("DEL")[0]);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Song A")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should show error toast when delete fetch fails", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, audio: mockAudio }),
      })
      .mockRejectedValueOnce(new Error("network"));

    renderWithToast(<AudioManager refreshTrigger={0} />);
    await waitFor(() =>
      expect(screen.getByText("Song A")).toBeInTheDocument()
    );

    fireEvent.click(screen.getAllByText("DEL")[0]);
    await confirmDeleteInModal();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("network")
    );
  });

  it("should show success toast when order saves", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, audio: mockAudio }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, audio: mockAudio }),
      });

    renderWithToast(<AudioManager refreshTrigger={0} />);
    await waitFor(() =>
      expect(screen.getByText("Song A")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText(/SAVE ORDER/i));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/Audio order saved/i)
    );
  });

  it("should show error toast with API body when reorder returns 409", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, audio: mockAudio }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () =>
          Promise.resolve({
            error: "Someone else saved at the same moment. Reload and try again.",
          }),
      });

    renderWithToast(<AudioManager refreshTrigger={0} />);
    await waitFor(() =>
      expect(screen.getByText("Song A")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText(/SAVE ORDER/i));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Someone else saved/i)
    );
  });

  it("should show success toast when rename succeeds", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, audio: mockAudio }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            audio: { ...mockAudio[0], title: "Renamed" },
          }),
      });

    renderWithToast(<AudioManager refreshTrigger={0} />);
    await waitFor(() =>
      expect(screen.getByText("Song A")).toBeInTheDocument()
    );

    fireEvent.click(screen.getAllByText("REN")[0]);
    fireEvent.change(screen.getByLabelText(/new title/i), {
      target: { value: "Renamed" },
    });
    fireEvent.click(screen.getByText("OK"));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/Track renamed/i)
    );
  });

  it("should show error toast with API body when rename returns 409", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, audio: mockAudio }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: false,
            error: "Someone else saved at the same moment. Reload and try again.",
          }),
      });

    renderWithToast(<AudioManager refreshTrigger={0} />);
    await waitFor(() =>
      expect(screen.getByText("Song A")).toBeInTheDocument()
    );

    fireEvent.click(screen.getAllByText("REN")[0]);
    fireEvent.change(screen.getByLabelText(/new title/i), {
      target: { value: "Renamed" },
    });
    fireEvent.click(screen.getByText("OK"));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Someone else saved/i)
    );
  });
});
