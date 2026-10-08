import "@testing-library/jest-dom";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import { LinkManager } from "./LinkManager";

// Mock console.error
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe("LinkManager", () => {
  let originalFetch: typeof global.fetch;
  let originalAlert: typeof global.alert;
  let originalConfirm: typeof global.confirm;

  const mockLinks = [
    {
      id: "1",
      text: "Link 1",
      href: "https://example.com/1",
      description: "Description 1",
      createdAt: "2024-01-01T00:00:00.000Z",
      createdBy: "test@example.com",
    },
    {
      id: "2",
      text: "Link 2",
      href: "https://example.com/2",
      createdAt: "2024-01-02T00:00:00.000Z",
      createdBy: "test@example.com",
    },
  ];

  beforeEach(() => {
    originalFetch = global.fetch;
    originalAlert = global.alert;
    originalConfirm = global.confirm;
    global.alert = jest.fn();
    global.confirm = jest.fn().mockReturnValue(true);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.alert = originalAlert;
    global.confirm = originalConfirm;
    jest.clearAllMocks();
  });

  it("renders loading state initially", () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, links: [] }),
    });

    render(<LinkManager refreshTrigger={0} />);
    expect(screen.getByText(/Loading links/i)).toBeInTheDocument();
  });

  it("renders links list after loading", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, links: mockLinks }),
    });

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("Link 1")).toBeInTheDocument();
      expect(screen.getByText("Link 2")).toBeInTheDocument();
    });
  });

  it("shows empty state when no links", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, links: [] }),
    });

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(
        screen.getByText(/No links yet. Click "ADD LINK" to create one./i)
      ).toBeInTheDocument();
    });
  });

  it("shows add link button", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, links: [] }),
    });

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("+ ADD LINK")).toBeInTheDocument();
    });
  });

  it("opens create form when add button clicked", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, links: [] }),
    });

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("+ ADD LINK")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("+ ADD LINK"));

    expect(screen.getByText("Add New Link")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter link text")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("https://example.com")).toBeInTheDocument();
  });

  it("creates new link successfully", async () => {
    const newLink = {
      id: "3",
      text: "New Link",
      href: "https://new.com",
      description: "New description",
      createdAt: "2024-01-03T00:00:00.000Z",
      createdBy: "test@example.com",
    };

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, links: [] }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, link: newLink }),
      });

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("+ ADD LINK")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("+ ADD LINK"));

    fireEvent.change(screen.getByPlaceholderText("Enter link text"), {
      target: { value: "New Link" },
    });
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://new.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Optional description"), {
      target: { value: "New description" },
    });

    fireEvent.click(screen.getByText("SAVE"));

    await waitFor(() => {
      expect(screen.getByText("New Link")).toBeInTheDocument();
    });
  });

  it("handles create error from API", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, links: [] }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: "Failed" }),
      });

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("+ ADD LINK")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("+ ADD LINK"));

    fireEvent.change(screen.getByPlaceholderText("Enter link text"), {
      target: { value: "New Link" },
    });
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://new.com" },
    });

    fireEvent.click(screen.getByText("SAVE"));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith("Failed");
    });
  });

  it("handles create network error", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, links: [] }),
      })
      .mockRejectedValueOnce(new Error("Network error"));

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("+ ADD LINK")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("+ ADD LINK"));

    fireEvent.change(screen.getByPlaceholderText("Enter link text"), {
      target: { value: "New Link" },
    });
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://new.com" },
    });

    fireEvent.click(screen.getByText("SAVE"));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith("Failed to create link");
    });
  });

  it("opens edit form when edit button clicked", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, links: mockLinks }),
    });

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("Link 1")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText("EDIT");
    fireEvent.click(editButtons[0]);

    expect(screen.getByText("Edit Link")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Link 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://example.com/1")).toBeInTheDocument();
  });

  it("updates link successfully", async () => {
    const updatedLink = {
      ...mockLinks[0],
      text: "Updated Link",
    };

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, links: mockLinks }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, link: updatedLink }),
      });

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("Link 1")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText("EDIT");
    fireEvent.click(editButtons[0]);

    fireEvent.change(screen.getByDisplayValue("Link 1"), {
      target: { value: "Updated Link" },
    });

    fireEvent.click(screen.getByText("SAVE"));

    await waitFor(() => {
      expect(screen.getByText("Updated Link")).toBeInTheDocument();
    });
  });

  it("handles update error from API", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, links: mockLinks }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: "Update failed" }),
      });

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("Link 1")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText("EDIT");
    fireEvent.click(editButtons[0]);

    fireEvent.change(screen.getByDisplayValue("Link 1"), {
      target: { value: "Updated Link" },
    });

    fireEvent.click(screen.getByText("SAVE"));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith("Update failed");
    });
  });

  it("handles update network error", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, links: mockLinks }),
      })
      .mockRejectedValueOnce(new Error("Network error"));

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("Link 1")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText("EDIT");
    fireEvent.click(editButtons[0]);

    fireEvent.change(screen.getByDisplayValue("Link 1"), {
      target: { value: "Updated Link" },
    });

    fireEvent.click(screen.getByText("SAVE"));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith("Failed to update link");
    });
  });

  it("deletes link successfully", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, links: mockLinks }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      });

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("Link 1")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText("DEL");
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText("Link 1")).not.toBeInTheDocument();
    });
  });

  it("handles delete error from API", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, links: mockLinks }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: "Delete failed" }),
      });

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("Link 1")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText("DEL");
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith("Delete failed");
    });
  });

  it("handles delete network error", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, links: mockLinks }),
      })
      .mockRejectedValueOnce(new Error("Network error"));

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("Link 1")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText("DEL");
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith("Failed to delete link");
    });
  });

  it("cancels delete if user declines confirmation", async () => {
    global.confirm = jest.fn().mockReturnValue(false);
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, links: mockLinks }),
    });

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("Link 1")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText("DEL");
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Link 1")).toBeInTheDocument();
    });
  });

  it("moves link up", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, links: mockLinks }),
    });

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("Link 2")).toBeInTheDocument();
    });

    const upButtons = screen.getAllByTitle("Move up");
    fireEvent.click(upButtons[1]); // Click up on second link

    // Links should be reordered
    const linkTexts = screen.getAllByText(/Link \d/).map((el) => el.textContent);
    expect(linkTexts[0]).toBe("Link 2");
    expect(linkTexts[1]).toBe("Link 1");
  });

  it("moves link down", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, links: mockLinks }),
    });

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("Link 1")).toBeInTheDocument();
    });

    const downButtons = screen.getAllByTitle("Move down");
    fireEvent.click(downButtons[0]); // Click down on first link

    // Links should be reordered
    const linkTexts = screen.getAllByText(/Link \d/).map((el) => el.textContent);
    expect(linkTexts[0]).toBe("Link 2");
    expect(linkTexts[1]).toBe("Link 1");
  });

  it("saves link order successfully", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, links: mockLinks }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ about: {}, photos: [] }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      });

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("SAVE ORDER")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("SAVE ORDER"));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith("Link order saved successfully!");
    });
  });

  it("handles save order error from API", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, links: mockLinks }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ about: {}, photos: [] }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ error: "Save failed" }),
      });

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("SAVE ORDER")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("SAVE ORDER"));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith("Save failed");
    });
  });

  it("handles save order network error", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, links: mockLinks }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ about: {}, photos: [] }),
      })
      .mockRejectedValueOnce(new Error("Network error"));

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("SAVE ORDER")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("SAVE ORDER"));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith("Failed to save order");
    });
  });

  it("cancels create form", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, links: [] }),
    });

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("+ ADD LINK")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("+ ADD LINK"));
    expect(screen.getByText("Add New Link")).toBeInTheDocument();

    fireEvent.click(screen.getByText("CANCEL"));
    expect(screen.queryByText("Add New Link")).not.toBeInTheDocument();
  });

  it("cancels edit form", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, links: mockLinks }),
    });

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("Link 1")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText("EDIT");
    fireEvent.click(editButtons[0]);
    expect(screen.getByText("Edit Link")).toBeInTheDocument();

    fireEvent.click(screen.getByText("CANCEL"));
    expect(screen.queryByText("Edit Link")).not.toBeInTheDocument();
  });

  it("handles fetch error", async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("Network error"));

    render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("+ ADD LINK")).toBeInTheDocument();
    });
  });

  it("refetches links when refreshTrigger changes", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, links: [] }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, links: mockLinks }),
      });

    const { rerender } = render(<LinkManager refreshTrigger={0} />);

    await waitFor(() => {
      expect(screen.getByText("+ ADD LINK")).toBeInTheDocument();
    });

    rerender(<LinkManager refreshTrigger={1} />);

    await waitFor(() => {
      expect(screen.getByText("Link 1")).toBeInTheDocument();
    });
  });
});
