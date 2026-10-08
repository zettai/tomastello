import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import SongPlayer from "./SongPlayer";
import type { AudioMetadata } from "@/types/audio";

const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

const mockSongs: AudioMetadata[] = [
  {
    id: "1",
    title: "Track One",
    fileName: "audio/t1.mp3",
    url: "https://x/t1.mp3",
    size: 1000,
    mimeType: "audio/mpeg",
    order: 1,
    uploadedAt: "",
    uploadedBy: "",
  },
  {
    id: "2",
    title: "Track Two",
    fileName: "audio/t2.mp3",
    url: "https://x/t2.mp3",
    size: 2000,
    mimeType: "audio/mpeg",
    order: 2,
    uploadedAt: "",
    uploadedBy: "",
  },
];

describe("SongPlayer", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("renders nothing when no songs", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, audio: [] }),
    });

    const { container } = render(<SongPlayer />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("renders MUSIC.DIR title when songs present", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, audio: mockSongs }),
    });

    render(<SongPlayer />);

    await waitFor(() => {
      expect(screen.getByText(/MUSIC\.DIR/i)).toBeInTheDocument();
    });
  });

  it("renders each song title", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, audio: mockSongs }),
    });

    render(<SongPlayer />);

    await waitFor(() => {
      expect(screen.getByText("Track One")).toBeInTheDocument();
      expect(screen.getByText("Track Two")).toBeInTheDocument();
    });
  });

  it("renders audio elements with correct src", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, audio: mockSongs }),
    });

    const { container } = render(<SongPlayer />);

    await waitFor(() => {
      const audioElements = container.querySelectorAll("audio");
      expect(audioElements).toHaveLength(2);
      expect(audioElements[0].getAttribute("src")).toBe("https://x/t1.mp3");
      expect(audioElements[1].getAttribute("src")).toBe("https://x/t2.mp3");
    });
  });

  it("handles fetch error gracefully (no crash)", async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("net"));

    const { container } = render(<SongPlayer />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("handles non-success API response gracefully", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false }),
    });

    const { container } = render(<SongPlayer />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
