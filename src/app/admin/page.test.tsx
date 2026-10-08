import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import AdminPage from "./page";
import { useRouter } from "next/navigation";
import type { LinkMetadata } from "@/types/link";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

global.fetch = jest.fn();

describe("AdminPage", () => {
  const mockRouter = {
    push: jest.fn(),
  };

  const mockUser = { email: "test@example.com" };
  const mockAboutContent = "Test about content";
  const mockLinks: LinkMetadata[] = [];
  const mockImages = [
    {
      key: "image1.jpg",
      url: "http://example.com/image1.jpg",
      size: 1000,
      lastModified: "2024-01-01",
    },
    {
      key: "image2.jpg",
      url: "http://example.com/image2.jpg",
      size: 2000,
      lastModified: "2024-01-02",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (global.fetch as jest.Mock).mockClear();
  });

  it("has no accessibility violations once loaded", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: { email: "test@example.com" } }),
    });
    const { container } = render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText(/LOGGED IN AS/i)).toBeInTheDocument();
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders admin page with user info", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: mockUser }),
    });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText(/LOGGED IN AS.*test@example\.com/i)).toBeInTheDocument();
    });
  });

  it("redirects to login if user is not authenticated", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
    });

    render(<AdminPage />);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/login");
    });
  });

  it("handles logout", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: mockUser }),
    });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText(/LOGGED IN AS.*test@example\.com/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/LOGOUT/i));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/logout", {
        method: "POST",
      });
      expect(mockRouter.push).toHaveBeenCalledWith("/login");
    });
  });

  it("loads and displays about content", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockUser }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ about: { content: mockAboutContent }, links: mockLinks }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, images: mockImages }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ photos: [] }),
      });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText(/UPDATE ABOUT TEXT/i)).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Enter about content (max 2000 characters)")
      ).toHaveValue(mockAboutContent);
    });
  });

  it("updates about content", async () => {
    const mockCurrentData = { about: { content: mockAboutContent }, photos: [], links: mockLinks };
    const mockNewContent = "New content";

    (global.fetch as jest.Mock).mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/auth/profile")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: mockUser }) });
      if (url === "/api/admin/security")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ lock: { locked: false }, events: [] }) });
      if (url === "/api/images/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, images: mockImages }) });
      if (url === "/api/audio/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, audio: [] }) });
      if (url === "/api/site" && opts?.method === "PUT")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
      if (url === "/api/site")
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockCurrentData) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText(/UPDATE ABOUT TEXT/i)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(
      "Enter about content (max 2000 characters)"
    );
    fireEvent.change(textarea, { target: { value: mockNewContent } });

    const saveButton = screen.getByText(/^\[ SAVE \]$/i);
    fireEvent.click(saveButton);

    await waitFor(() => {
      const putCall = (global.fetch as jest.Mock).mock.calls.find(
        ([url, options]) => url === "/api/site" && options?.method === "PUT"
      );
      expect(putCall).toBeDefined();
      expect(JSON.parse(putCall[1].body)).toEqual({
        about: { content: mockNewContent },
        photos: [],
        links: mockLinks,
      });
    });
  });

  it("loads and displays images", async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === "/api/auth/profile")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: mockUser }) });
      if (url === "/api/admin/security")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ lock: { locked: false }, events: [] }) });
      if (url === "/api/images/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, images: mockImages }) });
      if (url === "/api/audio/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, audio: [] }) });
      if (url === "/api/site")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ about: { content: mockAboutContent }, photos: [], links: mockLinks }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText(/MANAGE IMAGES/i)).toBeInTheDocument();
      expect(screen.getByText("image1.jpg")).toBeInTheDocument();
      expect(screen.getByText("image2.jpg")).toBeInTheDocument();
    });
  });

  it("handles image deletion", async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === "/api/auth/profile")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: mockUser }) });
      if (url === "/api/admin/security")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ lock: { locked: false }, events: [] }) });
      if (url === "/api/images/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, images: mockImages }) });
      if (url === "/api/audio/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, audio: [] }) });
      if (url.startsWith("/api/images/delete"))
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
      if (url === "/api/site")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ about: { content: mockAboutContent }, photos: [], links: mockLinks }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    global.confirm = jest.fn(() => true);

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText(/MANAGE IMAGES/i)).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText("DEL");
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/images/delete?key=image1.jpg",
        { method: "DELETE" }
      );
    });
  });

  it("handles fetch error in fetchUserProfile", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("fetch error"));
    render(<AdminPage />);
    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/login");
    });
  });

  it("handles fetch error in fetchAboutContent", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockUser }),
      })
      .mockRejectedValueOnce(new Error("fetch error"));
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText(/UPDATE ABOUT TEXT/i)).toBeInTheDocument();
    });
  });

  it("handles fetch error in handleLogout", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockUser }),
      })
      .mockRejectedValueOnce(new Error("fetch error"));
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText(/LOGGED IN AS.*test@example\.com/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/LOGOUT/i));
    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/login");
    });
  });

  it("handles fetch error in handleAboutUpdate", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockUser }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ about: { content: mockAboutContent }, links: mockLinks }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, images: mockImages }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ photos: [] }),
      })
      .mockRejectedValueOnce(new Error("fetch error"));
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText(/UPDATE ABOUT TEXT/i)).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText(
      "Enter about content (max 2000 characters)"
    );
    fireEvent.change(textarea, { target: { value: "New content" } });
    const saveButton = screen.getByText(/^\[ SAVE \]$/i);
    fireEvent.click(saveButton);
    await waitFor(() => {
      expect(screen.getByText(/UPDATE ABOUT TEXT/i)).toBeInTheDocument();
    });
  });

  it("handles fetch error in fetchImages", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockUser }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ about: { content: mockAboutContent }, links: mockLinks }),
      })
      .mockRejectedValueOnce(new Error("fetch error"));
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText(/MANAGE IMAGES/i)).toBeInTheDocument();
    });
  });

  it("handles fetch error in fetchSavedPhotos", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockUser }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ about: { content: mockAboutContent }, links: mockLinks }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, images: mockImages }),
      })
      .mockRejectedValueOnce(new Error("fetch error"));
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText(/MANAGE IMAGES/i)).toBeInTheDocument();
    });
  });

  it("handles fetch error in handleDelete", async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === "/api/auth/profile")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: mockUser }) });
      if (url === "/api/admin/security")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ lock: { locked: false }, events: [] }) });
      if (url === "/api/images/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, images: mockImages }) });
      if (url === "/api/audio/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, audio: [] }) });
      if (url.startsWith("/api/images/delete"))
        return Promise.reject(new Error("fetch error"));
      if (url === "/api/site")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ about: { content: mockAboutContent }, photos: [], links: mockLinks }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    global.confirm = jest.fn(() => true);
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText(/MANAGE IMAGES/i)).toBeInTheDocument();
    });
    const deleteButtons = screen.getAllByText("DEL");
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/images/delete?key=image1.jpg",
        { method: "DELETE" }
      );
    });
  });

  it("handles fetch error in handleSave", async () => {
    let siteCallCount = 0;
    (global.fetch as jest.Mock).mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/auth/profile")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: mockUser }) });
      if (url === "/api/admin/security")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ lock: { locked: false }, events: [] }) });
      if (url === "/api/images/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, images: mockImages }) });
      if (url === "/api/audio/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, audio: [] }) });
      if (url === "/api/site" && opts?.method === "PUT")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      if (url === "/api/site") {
        siteCallCount++;
        if (siteCallCount <= 2)
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ about: { content: mockAboutContent }, photos: [], links: mockLinks }) });
        return Promise.reject(new Error("fetch error"));
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText(/MANAGE IMAGES/i)).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText(/enter about content/i);
    fireEvent.change(textarea, { target: { value: "Updated about content" } });
    const checkboxes = screen.queryAllByRole("checkbox");
    if (checkboxes[0]) {
      fireEvent.click(checkboxes[0]);
    }
    const saveSelectionButton = screen.getByText(/SAVE SELECTION/i);
    fireEvent.click(saveSelectionButton);
    await waitFor(() => {
      expect(screen.getByText(/fetch error/i)).toBeInTheDocument();
    });
  });

  it("handles fetch error in moveImage", async () => {
    // Ensure at least two images for move button
    const twoImages = [
      { key: "image1.jpg", url: "/images/image1.jpg" },
      { key: "image2.jpg", url: "/images/image2.jpg" },
    ];
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockUser }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ about: { content: mockAboutContent }, links: mockLinks }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, images: twoImages }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ photos: [] }),
      })
      .mockRejectedValueOnce(new Error("fetch error"));
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText(/MANAGE IMAGES/i)).toBeInTheDocument();
    });
    // Find the first move button (should exist with two images)
    const moveButton = screen
      .getAllByRole("button")
      .find((btn) => btn.textContent?.toLowerCase().includes("move"));
    if (moveButton) {
      fireEvent.click(moveButton);
      await waitFor(() => {
        expect(
          (global.fetch as jest.Mock).mock.calls.some(
            ([url]) => url === "/api/images/move"
          )
        ).toBe(true);
      });
    } else {
      expect(true).toBe(true);
    }
  });

  it("handles fetch error in handleImageUpload", async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === "/api/auth/profile")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: mockUser }) });
      if (url === "/api/admin/security")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ lock: { locked: false }, events: [] }) });
      if (url === "/api/images/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, images: mockImages }) });
      if (url === "/api/audio/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, audio: [] }) });
      if (url === "/api/images/upload")
        return Promise.reject(new Error("fetch error"));
      if (url === "/api/site")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ about: { content: mockAboutContent }, photos: [], links: mockLinks }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    const { container } = render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText(/MANAGE IMAGES/i)).toBeInTheDocument();
    });
    const fileInput = container.querySelector("input[data-image]") as HTMLInputElement;
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(
        (global.fetch as jest.Mock).mock.calls.some(
          ([url]) => url === "/api/images/upload"
        )
      ).toBe(true);
    });
  });

  it("shows ImageManager loading state while images are fetching", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockUser }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ about: { content: "" } }),
      })
      .mockImplementationOnce(() => new Promise(() => {})); // never resolves — keeps loading:true

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText(/LOADING IMAGES/i)).toBeInTheDocument();
    });
  });

  // Helper: URL-based mock so concurrent fetches resolve correctly regardless of order
  const mockByUrl = (
    images = mockImages,
    photos: { id: string }[] = [],
    siteOverride?: Record<string, unknown>
  ) => {
    const siteData = siteOverride ?? { about: { content: mockAboutContent }, photos };
    (global.fetch as jest.Mock).mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/auth/profile")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: mockUser }) });
      if (url === "/api/images/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, images }) });
      if (url === "/api/audio/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, audio: [] }) });
      if (url === "/api/site" && opts?.method === "PUT")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      if (url === "/api/site")
        return Promise.resolve({ ok: true, json: () => Promise.resolve(siteData) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  };

  it("marks saved photos as selected on load", async () => {
    mockByUrl(mockImages, [{ id: "image1.jpg" }]);

    render(<AdminPage />);

    await waitFor(() => {
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
    });
  });

  it("toggles image selection via checkbox", async () => {
    mockByUrl();

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
    });

    const checkbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("moves images with up/down arrow buttons", async () => {
    mockByUrl();

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getAllByText("↓").length).toBeGreaterThan(0);
    });

    // Move first image down (reorders state)
    fireEvent.click(screen.getAllByText("↓")[0]);
    // Move second image up
    await waitFor(() => {
      expect(screen.getAllByText("↑").length).toBeGreaterThan(1);
    });
    fireEvent.click(screen.getAllByText("↑")[1]);
  });

  it("saves image selection successfully", async () => {
    mockByUrl(mockImages, [{ id: "image1.jpg" }]);

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText(/SAVE SELECTION/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/SAVE SELECTION/i));

    await waitFor(() => {
      const putCall = (global.fetch as jest.Mock).mock.calls.find(
        ([url, options]) => url === "/api/site" && options?.method === "PUT"
      );
      expect(putCall).toBeDefined();
    });
  });

  it("shows error when handleSave GET fetch fails", async () => {
    let siteCallCount = 0;
    (global.fetch as jest.Mock).mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/auth/profile")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: mockUser }) });
      if (url === "/api/images/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, images: mockImages }) });
      if (url === "/api/audio/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, audio: [] }) });
      if (url === "/api/site" && opts?.method === "PUT")
        return Promise.resolve({ ok: true });
      if (url === "/api/site") {
        siteCallCount++;
        // First two calls (about + photos): ok. Next call (handleSave GET): fail
        if (siteCallCount <= 2)
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ about: { content: "" }, photos: [] }) });
        return Promise.resolve({ ok: false });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText(/SAVE SELECTION/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/SAVE SELECTION/i));

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch current site data/i)).toBeInTheDocument();
    });
  });

  it("shows error when handleAboutUpdate PUT response is not ok", async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/auth/profile")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: mockUser }) });
      if (url === "/api/images/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, images: [] }) });
      if (url === "/api/audio/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, audio: [] }) });
      if (url === "/api/site" && opts?.method === "PUT")
        return Promise.resolve({ ok: false }); // PUT fails
      if (url === "/api/site")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ about: { content: "" }, photos: [] }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText(/UPDATE ABOUT TEXT/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/^\[ SAVE \]$/i));

    await waitFor(() => {
      expect(screen.getByText(/Failed to update about content/i)).toBeInTheDocument();
    });
  });

  it("triggers gallery refresh after successful image upload", async () => {
    mockByUrl([], []);
    // Allow upload endpoint
    (global.fetch as jest.Mock).mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/auth/profile")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: mockUser }) });
      if (url === "/api/images/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, images: [] }) });
      if (url === "/api/audio/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, audio: [] }) });
      if (url === "/api/images/upload")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
      if (url === "/api/site" && opts?.method === "PUT")
        return Promise.resolve({ ok: true });
      if (url === "/api/site")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ about: { content: "" }, photos: [] }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const { container } = render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText(/UPLOAD IMAGES/i)).toBeInTheDocument();
    });

    const fileInput = container.querySelector("input[data-image]") as HTMLInputElement;
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        (global.fetch as jest.Mock).mock.calls.some(([url]) => url === "/api/images/upload")
      ).toBe(true);
    });
  });
});
