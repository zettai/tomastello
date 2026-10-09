import type { ReactElement } from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { AdminToastProvider } from "./AdminToast";
import { AdminSaveProvider, useAdminSave } from "./AdminSave";

function SiteSaveProbe() {
  const { saveSite, isInflight } = useAdminSave();
  return (
    <div>
      <span data-testid="inflight">{isInflight ? "yes" : "no"}</span>
      <button
        type="button"
        onClick={() =>
          saveSite({
            mutate: (data) => ({ ...data, about: { content: "next" } }),
            successMessage: "Saved about",
          })
        }
      >
        save
      </button>
      <button
        type="button"
        onClick={() =>
          saveSite({
            mutate: (data) => ({ ...data, photos: [] }),
            successMessage: "Hidden",
            undo: () =>
              saveSite({
                mutate: (data) => ({
                  ...data,
                  photos: [{ id: "a", url: "/a" }],
                }),
                successMessage: "Restored",
              }),
          })
        }
      >
        hide
      </button>
    </div>
  );
}

function AudioSaveProbe() {
  const { saveAudioOrder } = useAdminSave();
  return (
    <button
      type="button"
      onClick={() =>
        saveAudioOrder({
          ids: ["2", "1"],
          successMessage: "Audio order saved",
        })
      }
    >
      reorder
    </button>
  );
}

function wrap(ui: ReactElement) {
  return render(
    <AdminToastProvider>
      <AdminSaveProvider>{ui}</AdminSaveProvider>
    </AdminToastProvider>
  );
}

describe("AdminSave", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should save site on change when enqueue succeeds", async () => {
    global.fetch = jest.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/site" && opts?.method === "PUT") {
        return Promise.resolve({
          ok: true,
          headers: { get: () => null },
          json: () => Promise.resolve({}),
        });
      }
      if (url === "/api/site") {
        return Promise.resolve({
          ok: true,
          headers: {
            get: (n: string) =>
              n === "ETag" ? '"s1"' : n === "X-Links-ETag" ? '"l1"' : null,
          },
          json: () => Promise.resolve({ about: { content: "" }, photos: [] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    wrap(<SiteSaveProbe />);
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Saved about/i);
    });
    const put = (global.fetch as jest.Mock).mock.calls.find(
      ([url, opts]) => url === "/api/site" && opts?.method === "PUT"
    );
    expect(put).toBeDefined();
    expect(put[1].headers["If-Match"]).toBe('"s1"');
  });

  it("should enqueue undo through the same queue when Undo is clicked", async () => {
    const puts: unknown[] = [];
    global.fetch = jest.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/site" && opts?.method === "PUT") {
        puts.push(JSON.parse(String(opts.body)));
        return Promise.resolve({
          ok: true,
          headers: { get: () => null },
          json: () => Promise.resolve({}),
        });
      }
      if (url === "/api/site") {
        return Promise.resolve({
          ok: true,
          headers: { get: () => null },
          json: () =>
            Promise.resolve({
              about: { content: "" },
              photos: [{ id: "a", url: "/a" }],
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    wrap(<SiteSaveProbe />);
    fireEvent.click(screen.getByText("hide"));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Hidden/i);
    });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Restored/i);
    });
    expect(puts.length).toBeGreaterThanOrEqual(2);
    expect(puts.at(-1)).toEqual(
      expect.objectContaining({ photos: [{ id: "a", url: "/a" }] })
    );
  });

  it("should show error toast when site save fails", async () => {
    global.fetch = jest.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/site" && opts?.method === "PUT") {
        return Promise.resolve({
          ok: false,
          status: 500,
          headers: { get: () => null },
          json: () => Promise.resolve({ error: "boom" }),
        });
      }
      if (url === "/api/site") {
        return Promise.resolve({
          ok: true,
          headers: { get: () => null },
          json: () => Promise.resolve({ about: { content: "" } }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    wrap(<SiteSaveProbe />);
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/boom/i);
    });
  });

  it("should save audio order when enqueue succeeds", async () => {
    global.fetch = jest.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/audio/reorder" && opts?.method === "PUT") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    wrap(<AudioSaveProbe />);
    fireEvent.click(screen.getByText("reorder"));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Audio order saved/i);
    });
  });

  it("should show error toast when audio reorder fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({
          error: "Someone else saved at the same moment. Reload and try again.",
        }),
    });

    wrap(<AudioSaveProbe />);
    fireEvent.click(screen.getByText("reorder"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Someone else saved/i);
    });
  });

  it("should warn on beforeunload while a save is inflight", async () => {
    let resolvePut: (() => void) | undefined;
    global.fetch = jest.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/site" && opts?.method === "PUT") {
        return new Promise((resolve) => {
          resolvePut = () =>
            resolve({
              ok: true,
              headers: { get: () => null },
              json: () => Promise.resolve({}),
            });
        });
      }
      if (url === "/api/site") {
        return Promise.resolve({
          ok: true,
          headers: { get: () => null },
          json: () => Promise.resolve({ about: { content: "" } }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    wrap(<SiteSaveProbe />);
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(screen.getByTestId("inflight")).toHaveTextContent("yes");
    });

    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    Object.defineProperty(event, "returnValue", { writable: true, value: undefined });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);

    await act(async () => {
      resolvePut?.();
    });
    await waitFor(() => {
      expect(screen.getByTestId("inflight")).toHaveTextContent("no");
    });
  });
});

describe("useAdminSave outside provider", () => {
  it("should throw when used without AdminSaveProvider", () => {
    function Bad() {
      useAdminSave();
      return null;
    }
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <AdminToastProvider>
          <Bad />
        </AdminToastProvider>
      )
    ).toThrow(/useAdminSave must be used within AdminSaveProvider/);
    spy.mockRestore();
  });
});
