import { PutObjectCommand } from "@aws-sdk/client-s3";
import { scalewayClient } from "./api";
import {
  getAudioMetadata,
  saveAudioMetadata,
  addAudioMetadata,
  updateAudioMetadata,
  deleteAudioMetadata,
  getAudioByFileName,
  reorderAudioMetadata,
  type AudioMetadata,
} from "./audioMetadata";
import { readStoredJson, seedJson } from "@/test/storeHelpers";

jest.mock("./api", () => ({
  scalewayClient: {
    send: jest.fn(),
  },
  SCALEWAY_BUCKET: "test-bucket",
}));

const METADATA_FILE_KEY = "metadata/audios.json";

describe("audioMetadata", () => {
  const mockAudio: AudioMetadata[] = [
    {
      id: "1",
      title: "Song One",
      fileName: "audio/song1.mp3",
      url: "https://test.com/audio/song1.mp3",
      size: 1000,
      mimeType: "audio/mpeg",
      order: 1,
      uploadedAt: "2024-01-01T00:00:00.000Z",
      uploadedBy: "test@example.com",
    },
    {
      id: "2",
      title: "Song Two",
      fileName: "audio/song2.mp3",
      url: "https://test.com/audio/song2.mp3",
      size: 2000,
      mimeType: "audio/mpeg",
      order: 2,
      uploadedAt: "2024-01-02T00:00:00.000Z",
      uploadedBy: "test@example.com",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAudioMetadata", () => {
    it("should return metadata when file exists", async () => {
      await seedJson(METADATA_FILE_KEY, mockAudio);

      const result = await getAudioMetadata();
      expect(result).toEqual(mockAudio);
    });

    it("should return empty array when file doesn't exist", async () => {
      const result = await getAudioMetadata();
      expect(result).toEqual([]);
    });
  });

  describe("saveAudioMetadata", () => {
    it("should save metadata successfully", async () => {
      (scalewayClient.send as jest.Mock).mockResolvedValueOnce({});

      await saveAudioMetadata(mockAudio);
      expect(scalewayClient.send).toHaveBeenCalledWith(
        expect.any(PutObjectCommand)
      );
    });
  });

  describe("addAudioMetadata", () => {
    it("should add new metadata with auto order and uploadedAt", async () => {
      const newAudio = {
        fileName: "audio/new.mp3",
        title: "New Song",
        url: "https://test.com/audio/new.mp3",
        size: 3000,
        mimeType: "audio/mpeg",
        uploadedBy: "test@example.com",
      };

      const result = await addAudioMetadata(newAudio);
      expect(result).toMatchObject({
        ...newAudio,
        id: expect.any(String),
        uploadedAt: expect.any(String),
        order: 1,
      });
    });

    it("should assign order = existing.length + 1", async () => {
      await seedJson(METADATA_FILE_KEY, mockAudio);

      const result = await addAudioMetadata({
        fileName: "audio/third.mp3",
        title: "Third Song",
        url: "https://test.com/audio/third.mp3",
        size: 500,
        mimeType: "audio/mpeg",
        uploadedBy: "test@example.com",
      });

      expect(result.order).toBe(3);
    });
  });

  describe("updateAudioMetadata", () => {
    it("should update existing metadata", async () => {
      await seedJson(METADATA_FILE_KEY, mockAudio);

      const result = await updateAudioMetadata("1", { title: "Updated Title" });
      expect(result).toEqual({ ...mockAudio[0], title: "Updated Title" });
    });

    it("should return null for non-existent id", async () => {
      await seedJson(METADATA_FILE_KEY, mockAudio);

      const result = await updateAudioMetadata("999", { title: "test" });
      expect(result).toBeNull();
    });

    it("should change only the matching track", async () => {
      await seedJson(METADATA_FILE_KEY, [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
      ]);
      await expect(updateAudioMetadata("a", { title: "New" })).resolves.toEqual({
        id: "a",
        title: "New",
      });
      expect(await readStoredJson(METADATA_FILE_KEY)).toEqual([
        { id: "a", title: "New" },
        { id: "b", title: "B" },
      ]);
    });
  });

  describe("deleteAudioMetadata", () => {
    it("should delete existing metadata", async () => {
      await seedJson(METADATA_FILE_KEY, mockAudio);

      const result = await deleteAudioMetadata("1");
      expect(result).toBe(true);
    });

    it("should return false for non-existent id", async () => {
      await seedJson(METADATA_FILE_KEY, mockAudio);

      const result = await deleteAudioMetadata("999");
      expect(result).toBe(false);
    });
  });

  describe("getAudioByFileName", () => {
    it("should return metadata for existing filename", async () => {
      await seedJson(METADATA_FILE_KEY, mockAudio);

      const result = await getAudioByFileName("audio/song1.mp3");
      expect(result).toEqual(mockAudio[0]);
    });

    it("should return null for non-existent filename", async () => {
      await seedJson(METADATA_FILE_KEY, mockAudio);

      const result = await getAudioByFileName("audio/nonexistent.mp3");
      expect(result).toBeNull();
    });
  });

  describe("reorderAudioMetadata", () => {
    it("should reorder items and update order fields", async () => {
      await seedJson(METADATA_FILE_KEY, mockAudio);

      const result = await reorderAudioMetadata(["2", "1"]);
      expect(result[0].id).toBe("2");
      expect(result[0].order).toBe(1);
      expect(result[1].id).toBe("1");
      expect(result[1].order).toBe(2);
    });

    it("should skip unknown ids and return empty array for empty input", async () => {
      await seedJson(METADATA_FILE_KEY, mockAudio);

      const result = await reorderAudioMetadata([]);
      expect(result).toEqual([]);
    });

    it("should persist the reordered list", async () => {
      await seedJson(METADATA_FILE_KEY, mockAudio);

      await reorderAudioMetadata(["1", "2"]);
      const saved = await readStoredJson<AudioMetadata[]>(METADATA_FILE_KEY);
      expect(saved.map((a) => a.id)).toEqual(["1", "2"]);
    });

    it("should drop ids that don't exist", async () => {
      await seedJson(METADATA_FILE_KEY, [
        { id: "a", order: 1 },
        { id: "b", order: 2 },
      ]);
      await expect(reorderAudioMetadata(["b", "ghost", "a"])).resolves.toEqual([
        { id: "b", order: 1 },
        { id: "a", order: 3 },
      ]);
    });
  });
});
