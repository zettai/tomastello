import { PutObjectCommand } from "@aws-sdk/client-s3";
import { scalewayClient } from "./api";
import {
  getImageMetadata,
  saveImageMetadata,
  addImageMetadata,
  updateImageMetadata,
  deleteImageMetadata,
  getMetadataByFileName,
  type ImageMetadata,
} from "./metadata";
import { readStoredJson, seedJson } from "@/test/storeHelpers";

jest.mock("./api", () => ({
  scalewayClient: {
    send: jest.fn(),
  },
}));

const METADATA_FILE_KEY = "metadata/images.json";

describe("metadata", () => {
  const mockMetadata: ImageMetadata[] = [
    {
      id: "1",
      fileName: "test1.jpg",
      originalName: "test1.jpg",
      url: "https://test.com/test1.jpg",
      size: 1000,
      type: "image/jpeg",
      uploadedAt: "2024-01-01T00:00:00.000Z",
      uploadedBy: "test@example.com",
      tags: ["test"],
      description: "Test image",
      alt: "Test image alt",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getImageMetadata", () => {
    it("should return metadata when file exists", async () => {
      await seedJson(METADATA_FILE_KEY, mockMetadata);
      const result = await getImageMetadata();
      expect(result).toEqual(mockMetadata);
    });

    it("should return empty array when file doesn't exist", async () => {
      const result = await getImageMetadata();
      expect(result).toEqual([]);
    });
  });

  describe("saveImageMetadata", () => {
    it("should save metadata successfully", async () => {
      (scalewayClient.send as jest.Mock).mockResolvedValueOnce({});

      await saveImageMetadata(mockMetadata);
      expect(scalewayClient.send).toHaveBeenCalledWith(
        expect.any(PutObjectCommand)
      );
    });
  });

  describe("addImageMetadata", () => {
    it("should add new metadata", async () => {
      const newImageData = {
        fileName: "test2.jpg",
        originalName: "test2.jpg",
        url: "https://test.com/test2.jpg",
        size: 2000,
        type: "image/jpeg",
        uploadedBy: "test@example.com",
      };

      const result = await addImageMetadata(newImageData);
      expect(result).toMatchObject({
        ...newImageData,
        id: expect.any(String),
        uploadedAt: expect.any(String),
      });
    });
  });

  describe("updateImageMetadata", () => {
    it("should update existing metadata", async () => {
      await seedJson(METADATA_FILE_KEY, mockMetadata);

      const updates = { description: "Updated description" };
      const result = await updateImageMetadata("1", updates);

      expect(result).toEqual({
        ...mockMetadata[0],
        description: "Updated description",
      });
    });

    it("should return null for non-existent id", async () => {
      await seedJson(METADATA_FILE_KEY, mockMetadata);

      const result = await updateImageMetadata("999", { description: "test" });
      expect(result).toBeNull();
    });

    it("should change only the matching image", async () => {
      await seedJson(METADATA_FILE_KEY, [
        { id: "a", alt: "x" },
        { id: "b", alt: "y" },
      ]);
      await expect(updateImageMetadata("b", { alt: "z" })).resolves.toEqual({
        id: "b",
        alt: "z",
      });
      expect(await readStoredJson(METADATA_FILE_KEY)).toEqual([
        { id: "a", alt: "x" },
        { id: "b", alt: "z" },
      ]);
    });
  });

  describe("deleteImageMetadata", () => {
    it("should delete existing metadata", async () => {
      await seedJson(METADATA_FILE_KEY, mockMetadata);

      const result = await deleteImageMetadata("1");
      expect(result).toBe(true);
    });

    it("should return false for non-existent id", async () => {
      await seedJson(METADATA_FILE_KEY, mockMetadata);

      const result = await deleteImageMetadata("999");
      expect(result).toBe(false);
    });
  });

  describe("getMetadataByFileName", () => {
    it("should return metadata for existing filename", async () => {
      await seedJson(METADATA_FILE_KEY, mockMetadata);

      const result = await getMetadataByFileName("test1.jpg");
      expect(result).toEqual(mockMetadata[0]);
    });

    it("should return null for non-existent filename", async () => {
      await seedJson(METADATA_FILE_KEY, mockMetadata);

      const result = await getMetadataByFileName("nonexistent.jpg");
      expect(result).toBeNull();
    });
  });
});
