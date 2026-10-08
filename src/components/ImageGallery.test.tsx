import "@testing-library/jest-dom";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import ImageGallery from "./ImageGallery";

const mockImages = [
  {
    id: "1",
    fileName: "img1.jpg",
    originalName: "Image 1",
    url: "/img1.jpg",
    size: 1024,
    type: "image/jpeg",
    uploadedAt: new Date().toISOString(),
    uploadedBy: "user1",
    tags: ["tag1", "tag2"],
    description: "desc1",
    alt: "alt1",
  },
];

describe("ImageGallery", () => {
  let originalFetch: typeof global.fetch;
  let originalAlert: typeof global.alert;
  let originalConfirm: typeof global.confirm;
  let clipboardSpy: jest.SpyInstance;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalAlert = global.alert;
    originalConfirm = global.confirm;
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: jest.fn() },
        writable: true,
      });
    }
    clipboardSpy = jest
      .spyOn(navigator.clipboard, "writeText")
      .mockImplementation(jest.fn());
    originalConsoleError = console.error;
    global.alert = jest.fn();
    global.confirm = jest.fn(() => true);
    console.error = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.alert = originalAlert;
    global.confirm = originalConfirm;
    clipboardSpy.mockRestore();
    console.error = originalConsoleError;
    jest.clearAllMocks();
  });

  it("shows loading state", () => {
    global.fetch = jest.fn(() => new Promise(() => {}));
    render(<ImageGallery />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, metadata: [] }),
    });
    render(<ImageGallery />);
    await waitFor(() =>
      expect(screen.getByText("No images uploaded yet")).toBeInTheDocument()
    );
  });

  it("renders images", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, metadata: mockImages }),
    });
    render(<ImageGallery />);
    await waitFor(() =>
      expect(screen.getByText("Image 1")).toBeInTheDocument()
    );
    expect(screen.getByText("desc1")).toBeInTheDocument();
    expect(screen.getByText("tag1")).toBeInTheDocument();
    expect(screen.getByText("tag2")).toBeInTheDocument();
  });

  it("opens and closes image modal", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, metadata: mockImages }),
    });
    render(<ImageGallery />);
    await waitFor(() =>
      expect(screen.getByText("Image 1")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("Image 1"));
    const buttons = screen.getAllByRole("button");
    const closeBtn = buttons[buttons.length - 1];
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(screen.getByText("Image 1")).toBeInTheDocument();
  });

  it("copies image URL", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, metadata: mockImages }),
    });
    render(<ImageGallery />);
    await waitFor(() =>
      expect(screen.getByText("Copy URL")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("Copy URL"));
    expect(clipboardSpy).toHaveBeenCalledWith("/img1.jpg");
  });

  it("opens and cancels edit modal", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, metadata: mockImages }),
    });
    render(<ImageGallery />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByText("Edit Image Metadata")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Edit Image Metadata")).not.toBeInTheDocument();
  });

  it("submits edit form", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, metadata: mockImages }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, metadata: mockImages[0] }),
      });
    render(<ImageGallery />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(screen.getByPlaceholderText("Add a description..."), {
      target: { value: "new desc" },
    });
    fireEvent.click(screen.getByText("Save Changes"));
    await waitFor(() =>
      expect(screen.queryByText("Edit Image Metadata")).not.toBeInTheDocument()
    );
  });

  it("deletes image with confirm", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, metadata: mockImages }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      });
    render(<ImageGallery />);
    await waitFor(() => expect(screen.getByText("Delete")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() =>
      expect(screen.queryByText("Image 1")).not.toBeInTheDocument()
    );
  });

  it("does not delete image if confirm is false", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, metadata: mockImages }),
    });
    global.confirm = jest.fn(() => false);
    render(<ImageGallery />);
    await waitFor(() => expect(screen.getByText("Delete")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Delete"));
    expect(screen.getByText("Image 1")).toBeInTheDocument();
  });

  it("alerts on delete error", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, metadata: mockImages }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false }),
      });
    render(<ImageGallery />);
    await waitFor(() => expect(screen.getByText("Delete")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() =>
      expect(global.alert).toHaveBeenCalledWith("Failed to delete image")
    );
  });

  it("alerts on update error", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, metadata: mockImages }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false }),
      });
    render(<ImageGallery />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Save Changes"));
    await waitFor(() =>
      expect(global.alert).toHaveBeenCalledWith("Failed to update metadata")
    );
  });

  it("handles fetch error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("fail"));
    render(<ImageGallery />);
    await waitFor(() => expect(console.error).toHaveBeenCalled());
  });

  it("handles delete error", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, metadata: mockImages }),
      })
      .mockRejectedValueOnce(new Error("fail"));
    render(<ImageGallery />);
    await waitFor(() => expect(screen.getByText("Delete")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    await waitFor(() =>
      expect(global.alert).toHaveBeenCalledWith("Failed to delete image")
    );
  });

  it("handles update error", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, metadata: mockImages }),
      })
      .mockRejectedValueOnce(new Error("fail"));
    render(<ImageGallery />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Save Changes"));
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    await waitFor(() =>
      expect(global.alert).toHaveBeenCalledWith("Failed to update metadata")
    );
  });
});
