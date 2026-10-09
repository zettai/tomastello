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
      expect(screen.getByText(/\[ ABOUT \]/i)).toBeInTheDocument();
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
        return Promise.resolve({
          ok: true,
          headers: { get: () => null },
          json: () => Promise.resolve({ success: true }),
        });
      if (url === "/api/site")
        return Promise.resolve({
          ok: true,
          headers: {
            get: (n: string) =>
              n === "X-Site-ETag" || n === "ETag"
                ? '"s1"'
                : n === "X-Links-ETag"
                  ? '"l1"'
                  : null,
          },
          json: () => Promise.resolve(mockCurrentData),
        });
      return Promise.resolve({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) });
    });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText(/\[ ABOUT \]/i)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(
      "Enter about content (max 2000 characters)"
    );
    fireEvent.change(textarea, { target: { value: mockNewContent } });
    fireEvent.blur(textarea);

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
      expect(putCall[1].headers["X-Site-If-Match"]).toBe('"s1"');
      expect(screen.getByRole("status")).toHaveTextContent(/About text saved/i);
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

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText("image1.jpg")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText("DEL");
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

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
      expect(screen.getByText(/\[ ABOUT \]/i)).toBeInTheDocument();
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
        return Promise.reject(new Error("fetch error"));
      if (url === "/api/site")
        return Promise.resolve({
          ok: true,
          headers: { get: () => null },
          json: () => Promise.resolve({ about: { content: mockAboutContent }, photos: [], links: mockLinks }),
        });
      return Promise.resolve({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) });
    });
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText(/\[ ABOUT \]/i)).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText(
      "Enter about content (max 2000 characters)"
    );
    fireEvent.change(textarea, { target: { value: "New content" } });
    fireEvent.blur(textarea);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/fetch error/i);
    });
  });

  it("handles fetch error in fetchImages", async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === "/api/auth/profile")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: mockUser }) });
      if (url === "/api/admin/security")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ lock: { locked: false }, events: [] }) });
      if (url === "/api/images/list")
        return Promise.reject(new Error("fetch error"));
      if (url === "/api/audio/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, audio: [] }) });
      if (url === "/api/site")
        return Promise.resolve({
          ok: true,
          headers: { get: () => null },
          json: () => Promise.resolve({ about: { content: mockAboutContent }, photos: [], links: mockLinks }),
        });
      return Promise.resolve({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) });
    });
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText(/NO IMAGES/i)).toBeInTheDocument();
      expect(screen.queryByText(/No photos on the site/i)).not.toBeInTheDocument();
    });
  });

  it("handles fetch error when site photos load fails", async () => {
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
        return Promise.reject(new Error("fetch error"));
      return Promise.resolve({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) });
    });
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText(/NO IMAGES/i)).toBeInTheDocument();
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
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText("image1.jpg")).toBeInTheDocument();
    });
    const deleteButtons = screen.getAllByText("DEL");
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
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
        return Promise.resolve({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) });
      if (url === "/api/site") {
        siteCallCount++;
        if (siteCallCount <= 2)
          return Promise.resolve({
            ok: true,
            headers: { get: () => null },
            json: () => Promise.resolve({ about: { content: mockAboutContent }, photos: [], links: mockLinks }),
          });
        return Promise.reject(new Error("fetch error"));
      }
      return Promise.resolve({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) });
    });
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText("image1.jpg")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Show image1\.jpg/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/fetch error/i);
    });
  });

  it("handles fetch error in moveImage", async () => {
    const twoImages = [
      { key: "image1.jpg", url: "/images/image1.jpg", size: 1, lastModified: "2024-01-01" },
      { key: "image2.jpg", url: "/images/image2.jpg", size: 1, lastModified: "2024-01-02" },
    ];
    let siteGets = 0;
    (global.fetch as jest.Mock).mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/auth/profile")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: mockUser }) });
      if (url === "/api/admin/security")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ lock: { locked: false }, events: [] }) });
      if (url === "/api/images/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, images: twoImages }) });
      if (url === "/api/audio/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, audio: [] }) });
      if (url === "/api/site" && opts?.method === "PUT")
        return Promise.reject(new Error("fetch error"));
      if (url === "/api/site") {
        siteGets += 1;
        if (siteGets <= 2) {
          return Promise.resolve({
            ok: true,
            headers: { get: () => null },
            json: () =>
              Promise.resolve({
                about: { content: mockAboutContent },
                photos: [
                  { id: "image1.jpg", url: "/images/image1.jpg" },
                  { id: "image2.jpg", url: "/images/image2.jpg" },
                ],
                links: mockLinks,
              }),
          });
        }
        return Promise.reject(new Error("fetch error"));
      }
      return Promise.resolve({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) });
    });
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText("image1.jpg")).toBeInTheDocument();
      expect(screen.getAllByText("↓").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText("↓")[0]);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/fetch error/i);
    });
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
      expect(screen.getByText("image1.jpg")).toBeInTheDocument();
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
  const siteRes = (body: unknown, ok = true, status = 200) => ({
    ok,
    status,
    headers: {
      get: (name: string) =>
        name === "X-Site-ETag" || name === "ETag"
          ? '"site-etag"'
          : name === "X-Links-ETag"
            ? '"links-etag"'
            : null,
    },
    json: () => Promise.resolve(body),
  });

  const mockByUrl = (
    images = mockImages,
    photos: { id: string; url?: string }[] = [],
    siteOverride?: Record<string, unknown>
  ) => {
    const siteData = siteOverride ?? { about: { content: mockAboutContent }, photos, links: mockLinks };
    (global.fetch as jest.Mock).mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/auth/profile")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: mockUser }) });
      if (url === "/api/images/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, images }) });
      if (url === "/api/images/metadata")
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              metadata: images.map((img) => ({
                fileName: img.key,
                originalName: img.key.split("/").pop(),
              })),
            }),
        });
      if (url === "/api/audio/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, audio: [] }) });
      if (url === "/api/site" && opts?.method === "PUT")
        return Promise.resolve(siteRes({}));
      if (url === "/api/site")
        return Promise.resolve(siteRes(siteData));
      return Promise.resolve({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) });
    });
  };

  it("should place saved photos in On the site on load", async () => {
    mockByUrl(mockImages, [{ id: "image1.jpg", url: mockImages[0].url }]);

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText(/On the site \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Not shown \(1\)/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Hide image1\.jpg/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Show image2\.jpg/i })).toBeInTheDocument();
    });
  });

  it("should show a photo on the site when SHOW is clicked", async () => {
    mockByUrl();

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Show image1\.jpg/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Show image1\.jpg/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Photo shown on site/i);
      expect(screen.getByRole("button", { name: /Hide image1\.jpg/i })).toBeInTheDocument();
    });
  });

  it("should hide a photo when HIDE is clicked", async () => {
    mockByUrl(mockImages, [
      { id: "image1.jpg", url: mockImages[0].url },
      { id: "image2.jpg", url: mockImages[1].url },
    ]);

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Hide image1\.jpg/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Hide image1\.jpg/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Photo hidden/i);
    });
  });

  it("moves on-site images with up/down arrow buttons", async () => {
    mockByUrl(mockImages, [
      { id: "image1.jpg", url: mockImages[0].url },
      { id: "image2.jpg", url: mockImages[1].url },
    ]);

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getAllByText("↓").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText("↓")[0]);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Photo order saved/i);
    });
  });

  it("should save when a photo is shown", async () => {
    mockByUrl(mockImages, []);

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText("image1.jpg")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Show image1\.jpg/i }));

    await waitFor(() => {
      const putCall = (global.fetch as jest.Mock).mock.calls.find(
        ([url, options]) => url === "/api/site" && options?.method === "PUT"
      );
      expect(putCall).toBeDefined();
      expect(putCall[1].headers["X-Site-If-Match"]).toBe('"site-etag"');
      expect(screen.getByRole("status")).toHaveTextContent(/Photo shown on site/i);
    });
  });

  it("shows error when photo save-on-change GET fetch fails", async () => {
    let siteCallCount = 0;
    (global.fetch as jest.Mock).mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/auth/profile")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: mockUser }) });
      if (url === "/api/images/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, images: mockImages }) });
      if (url === "/api/audio/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, audio: [] }) });
      if (url === "/api/site" && opts?.method === "PUT")
        return Promise.resolve({ ok: true, headers: { get: () => null } });
      if (url === "/api/site") {
        siteCallCount++;
        if (siteCallCount <= 2)
          return Promise.resolve({
            ok: true,
            headers: { get: () => null },
            json: () => Promise.resolve({ about: { content: "" }, photos: [] }),
          });
        return Promise.resolve({
          ok: false,
          status: 500,
          headers: { get: () => null },
          json: () => Promise.resolve({ error: "Failed to fetch site data" }),
        });
      }
      return Promise.resolve({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) });
    });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText("image1.jpg")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Show image1\.jpg/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Failed to fetch site data/i);
    });
  });

  it("should hide the security panel when empty", async () => {
    mockByUrl();
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText(/\[ PHOTOS \]/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/\[ SECURITY \]/i)).not.toBeInTheDocument();
  });

  it("should render jump links for Photos Audio Links About", async () => {
    mockByUrl();
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByRole("navigation", { name: /Admin sections/i })).toBeInTheDocument();
    });
    const nav = screen.getByRole("navigation", { name: /Admin sections/i });
    expect(nav.querySelector('a[href="#photos"]')).toBeTruthy();
    expect(nav.querySelector('a[href="#audio"]')).toBeTruthy();
    expect(nav.querySelector('a[href="#links"]')).toBeTruthy();
    expect(nav.querySelector('a[href="#about"]')).toBeTruthy();
  });

  it("shows error when about autosave PUT response is not ok", async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/auth/profile")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: mockUser }) });
      if (url === "/api/images/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, images: [] }) });
      if (url === "/api/audio/list")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, audio: [] }) });
      if (url === "/api/site" && opts?.method === "PUT")
        return Promise.resolve({
          ok: false,
          status: 409,
          headers: { get: () => null },
          json: () =>
            Promise.resolve({
              error: "Someone else saved at the same moment. Reload and try again.",
            }),
        });
      if (url === "/api/site")
        return Promise.resolve({
          ok: true,
          headers: { get: () => null },
          json: () => Promise.resolve({ about: { content: "" }, photos: [] }),
        });
      return Promise.resolve({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) });
    });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText(/\[ ABOUT \]/i)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(
      "Enter about content (max 2000 characters)"
    );
    fireEvent.change(textarea, { target: { value: "Conflict content" } });
    fireEvent.blur(textarea);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Someone else saved/i);
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
      expect(screen.getByText(/\[ PHOTOS \]/i)).toBeInTheDocument();
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
