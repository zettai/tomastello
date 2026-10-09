import "@testing-library/jest-dom";
import { render, fireEvent, waitFor } from "@testing-library/react";
import ImageUpload from "./ImageUpload";

type Handler = (init?: RequestInit) => unknown;

function routeFetch(routes: Record<string, Handler>) {
  return jest.fn((url: string, init?: RequestInit) => {
    const match = Object.keys(routes).find((prefix) => url.startsWith(prefix));
    if (!match) return Promise.reject(new Error(`unexpected fetch ${url}`));
    return Promise.resolve(routes[match](init));
  });
}

const json = (body: unknown, ok = true) => ({ ok, json: () => Promise.resolve(body) });

describe("ImageUpload in presigned mode", () => {
  const originalFetch = global.fetch;
  const originalAlert = global.alert;

  beforeEach(() => {
    global.alert = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.alert = originalAlert;
  });

  function pick(container: HTMLElement) {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["img"], "photo.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    return file;
  }

  it("should sign, PUT to the bucket and register the image", async () => {
    const fetchMock = routeFetch({
      "/api/uploads/config": () => json({ mode: "presigned", chunkSizeMb: 5 }),
      "/api/images/upload/presign": () =>
        json({ url: "https://bucket.example/put", key: "images/1-photo.png", headers: { "Content-Type": "image/png" } }),
      "https://bucket.example/put": () => ({ ok: true, headers: new Headers({ ETag: '"e"' }), text: () => Promise.resolve("") }),
      "/api/images/upload/complete": () => json({ success: true, fileName: "images/1-photo.png" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const onSuccess = jest.fn();
    const { container } = render(<ImageUpload onUploadSuccess={onSuccess} />);

    const file = pick(container);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ success: true, fileName: "images/1-photo.png" }));
    const putCall = fetchMock.mock.calls.find(([url]) => url === "https://bucket.example/put");
    expect(putCall?.[1]).toEqual({ method: "PUT", body: file, headers: { "Content-Type": "image/png" } });
    const completeCall = fetchMock.mock.calls.find(([url]) => url === "/api/images/upload/complete");
    expect(JSON.parse(String(completeCall?.[1]?.body))).toEqual({ key: "images/1-photo.png", originalName: "photo.png" });
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/images/upload")).toBe(false);
  });

  it.each([
    [
      "signing is refused",
      { "/api/images/upload/presign": () => json({ error: "Only JPEG, PNG" }, false) },
      "Only JPEG, PNG",
    ],
    [
      "signing returns no URL",
      { "/api/images/upload/presign": () => json({}) },
      "Upload failed",
    ],
    [
      "the bucket rejects the PUT",
      {
        "/api/images/upload/presign": () => json({ url: "https://bucket.example/put", key: "images/1-photo.png" }),
        "https://bucket.example/put": () => ({ ok: false, headers: new Headers(), text: () => Promise.resolve("") }),
      },
      "Upload to storage failed",
    ],
  ])("should alert when %s", async (_label, routes, message) => {
    global.fetch = routeFetch({
      "/api/uploads/config": () => json({ mode: "presigned", chunkSizeMb: 5 }),
      ...routes,
    }) as unknown as typeof fetch;
    const onSuccess = jest.fn();
    const { container } = render(<ImageUpload onUploadSuccess={onSuccess} />);

    pick(container);

    await waitFor(() =>
      expect(global.alert).toHaveBeenCalledWith(`photo.png: ${message}`)
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
