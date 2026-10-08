import "@testing-library/jest-dom";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import AudioUpload from "./AudioUpload";

type Handler = (url: string, init?: RequestInit) => unknown;

function routeFetch(routes: Array<[string, Handler]>) {
  return jest.fn((url: string, init?: RequestInit) => {
    const route = routes.find(([prefix]) => url.startsWith(prefix));
    if (!route) return Promise.reject(new Error(`unexpected fetch ${url}`));
    return Promise.resolve(route[1](url, init));
  });
}

const json = (body: unknown, ok = true) => ({ ok, json: () => Promise.resolve(body) });
const MB = 1024 * 1024;

function bigFile(size: number, name = "01 - Long Mix.mp3"): File {
  const file = new File(["x"], name, { type: "audio/mpeg" });
  Object.defineProperty(file, "size", { value: size });
  Object.defineProperty(file, "slice", {
    value: (start: number, end: number) => ({ size: end - start, start, end }),
  });
  return file;
}

function upload(container: HTMLElement, file: File) {
  const input = container.querySelector("input[data-audio]") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe("AudioUpload in presigned mode", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  function happyRoutes(etag: (partNumber: number) => string | null): Array<[string, Handler]> {
    return [
      ["/api/uploads/config", () => json({ mode: "presigned", chunkSizeMb: 5 })],
      ["/api/audio/upload/multipart/init", () => json({ uploadId: "up-1", key: "audio/1-mix.mp3" })],
      [
        "/api/audio/upload/multipart/part",
        (url) => {
          const partNumber = new URL(url, "http://x").searchParams.get("partNumber");
          return json({ url: `https://bucket.example/part/${partNumber}` });
        },
      ],
      [
        "https://bucket.example/part/",
        (url) => {
          const value = etag(Number(url.split("/").pop()));
          return { ok: true, headers: new Headers(value ? { ETag: value } : {}), text: () => Promise.resolve("") };
        },
      ],
      ["/api/audio/upload/multipart/abort", () => json({ success: true })],
      ["/api/audio/upload/multipart/complete", () => json({ success: true })],
    ];
  }

  it("should send parts straight to the bucket and complete with their ETags", async () => {
    const fetchMock = routeFetch(happyRoutes((n) => `"etag-${n}"`));
    global.fetch = fetchMock as unknown as typeof fetch;
    const onSuccess = jest.fn();
    const { container } = render(<AudioUpload onUploadSuccess={onSuccess} />);

    upload(container, bigFile(12 * MB));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    const urls = fetchMock.mock.calls.map(([url]) => url);
    // 12 MB in 5 MB chunks: the 2 MB tail merges into part 2.
    expect(urls.filter((u) => u.startsWith("https://bucket.example/part/"))).toEqual([
      "https://bucket.example/part/1",
      "https://bucket.example/part/2",
    ]);
    expect(urls).toContain("/api/audio/upload/multipart/part?uploadId=up-1&key=audio%2F1-mix.mp3&partNumber=2&size=7340032");
    const complete = fetchMock.mock.calls.find(([url]) => url === "/api/audio/upload/multipart/complete");
    expect(JSON.parse(String(complete?.[1]?.body)).parts).toEqual([
      { partNumber: 1, etag: '"etag-1"' },
      { partNumber: 2, etag: '"etag-2"' },
    ]);
    expect(urls.some((u) => u === "/api/audio/upload")).toBe(false);
  });

  it("should use one direct part for a small file instead of the relay route", async () => {
    const fetchMock = routeFetch(happyRoutes(() => '"e"'));
    global.fetch = fetchMock as unknown as typeof fetch;
    const onSuccess = jest.fn();
    const { container } = render(<AudioUpload onUploadSuccess={onSuccess} />);

    upload(container, bigFile(3 * MB));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls.filter((u) => u.startsWith("https://bucket.example/part/"))).toEqual(["https://bucket.example/part/1"]);
  });

  it("should abort and show an error when the bucket never exposes an ETag", async () => {
    jest.useFakeTimers();
    try {
      const fetchMock = routeFetch(happyRoutes(() => null));
      global.fetch = fetchMock as unknown as typeof fetch;
      const { container } = render(<AudioUpload />);

      upload(container, bigFile(6 * MB));

      await jest.runAllTimersAsync();
      jest.useRealTimers();
      expect(await screen.findByText("Failed to upload part 1 after 3 attempts")).toBeInTheDocument();
      expect(fetchMock.mock.calls.map(([url]) => url)).toContain(
        "/api/audio/upload/multipart/abort?uploadId=up-1&key=audio%2F1-mix.mp3"
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("should reject an empty file without calling the API", async () => {
    const fetchMock = routeFetch(happyRoutes(() => '"e"'));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { container } = render(<AudioUpload />);

    upload(container, bigFile(0));

    expect(await screen.findByText("File is empty")).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/uploads/config"]);
  });

  it("should use the chunk size the server sends", async () => {
    const routes = happyRoutes(() => '"e"');
    routes[0] = ["/api/uploads/config", () => json({ mode: "presigned", chunkSizeMb: 10 })];
    const fetchMock = routeFetch(routes);
    global.fetch = fetchMock as unknown as typeof fetch;
    const onSuccess = jest.fn();
    const { container } = render(<AudioUpload onUploadSuccess={onSuccess} />);

    upload(container, bigFile(25 * MB));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    const partPuts = fetchMock.mock.calls.filter(([url]) => url.startsWith("https://bucket.example/part/"));
    expect(partPuts).toHaveLength(3);
  });

  it("should treat a failed signing request as a failed part", async () => {
    jest.useFakeTimers();
    try {
      const routes = happyRoutes(() => '"e"');
      routes[2] = ["/api/audio/upload/multipart/part", () => json({ error: "nope" }, false)];
      global.fetch = routeFetch(routes) as unknown as typeof fetch;
      const { container } = render(<AudioUpload />);

      upload(container, bigFile(6 * MB));

      await jest.runAllTimersAsync();
      jest.useRealTimers();
      expect(await screen.findByText("Failed to upload part 1 after 3 attempts")).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});
