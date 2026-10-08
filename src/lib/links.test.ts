import {
  getLinkMetadata,
  saveLinkMetadata,
  addLinkMetadata,
  updateLinkMetadata,
  deleteLinkMetadata,
} from "./links";
import { LinkMetadata } from "@/types/link";
import { readStoredJson, seedJson } from "@/test/storeHelpers";

const LINKS_FILE_KEY = "metadata/links.json";

describe("links", () => {
  const mockLinks: LinkMetadata[] = [
    {
      id: "1",
      text: "Test Link 1",
      href: "https://example.com/1",
      description: "Test description 1",
      createdAt: "2024-01-01T00:00:00.000Z",
      createdBy: "test@example.com",
    },
    {
      id: "2",
      text: "Test Link 2",
      href: "https://example.com/2",
      createdAt: "2024-01-02T00:00:00.000Z",
      createdBy: "test@example.com",
    },
  ];

  describe("getLinkMetadata", () => {
    it("should return links when file exists", async () => {
      await seedJson(LINKS_FILE_KEY, mockLinks);

      const result = await getLinkMetadata();
      expect(result).toEqual(mockLinks);
    });

    it("should return empty array when file doesn't exist", async () => {
      const result = await getLinkMetadata();
      expect(result).toEqual([]);
    });
  });

  describe("saveLinkMetadata", () => {
    it("should save links successfully", async () => {
      await saveLinkMetadata(mockLinks);
      expect(await readStoredJson(LINKS_FILE_KEY)).toEqual(mockLinks);
    });
  });

  describe("addLinkMetadata", () => {
    it("should add new link", async () => {
      const newLinkData = {
        text: "New Link",
        href: "https://example.com/new",
        description: "New description",
        createdBy: "test@example.com",
      };

      const result = await addLinkMetadata(newLinkData);
      expect(result).toMatchObject({
        ...newLinkData,
        id: expect.any(String),
        createdAt: expect.any(String),
      });
    });

    it("should add link without description", async () => {
      const newLinkData = {
        text: "New Link",
        href: "https://example.com/new",
        createdBy: "test@example.com",
      };

      const result = await addLinkMetadata(newLinkData);
      expect(result).toMatchObject({
        ...newLinkData,
        id: expect.any(String),
        createdAt: expect.any(String),
      });
    });
  });

  describe("updateLinkMetadata", () => {
    it("should update existing link", async () => {
      await seedJson(LINKS_FILE_KEY, mockLinks);

      const updates = { text: "Updated Link" };
      const result = await updateLinkMetadata("1", updates);

      expect(result).toEqual({
        ...mockLinks[0],
        text: "Updated Link",
      });
    });

    it("should return null for non-existent id", async () => {
      await seedJson(LINKS_FILE_KEY, mockLinks);

      const result = await updateLinkMetadata("999", { text: "test" });
      expect(result).toBeNull();
    });

    it("should update multiple fields", async () => {
      await seedJson(LINKS_FILE_KEY, mockLinks);

      const updates = {
        text: "Updated Link",
        href: "https://updated.com",
        description: "Updated description",
      };
      const result = await updateLinkMetadata("1", updates);

      expect(result).toEqual({
        ...mockLinks[0],
        ...updates,
      });
    });
  });

  describe("deleteLinkMetadata", () => {
    it("should delete existing link", async () => {
      await seedJson(LINKS_FILE_KEY, mockLinks);

      const result = await deleteLinkMetadata("1");
      expect(result).toBe(true);
    });

    it("should return false for non-existent id", async () => {
      await seedJson(LINKS_FILE_KEY, mockLinks);

      const result = await deleteLinkMetadata("999");
      expect(result).toBe(false);
    });
  });
});
