/**
 * @jest-environment node
 */
import { MemoryObjectStore, setObjectStoreForTests } from "./store";
import { ConflictError, replaceJson } from "./jsonStore";
import { getSiteData, readSiteData, removeSitePhotoByKey, saveSiteData } from "./site";
import { SiteData } from "@/types/site";

describe("site", () => {
  const mockSiteData: SiteData = {
    about: { content: "Test content" },
    photos: [{ id: "1", url: "https://test.com/photo1.jpg" }],
  };

  const defaultSiteData: SiteData = {
    about: { content: "" },
    photos: [],
  };

  beforeEach(() => {
    setObjectStoreForTests(new MemoryObjectStore());
  });

  describe("getSiteData", () => {
    it("should return site data when file exists", async () => {
      await replaceJson("metadata/site.json", mockSiteData);
      await expect(getSiteData()).resolves.toEqual(mockSiteData);
    });

    it("should return default data when file doesn't exist", async () => {
      await expect(getSiteData()).resolves.toEqual(defaultSiteData);
    });
  });

  describe("saveSiteData", () => {
    it("should save site data successfully", async () => {
      await saveSiteData(mockSiteData);
      const saved = await getSiteData();
      expect(saved.about).toEqual(mockSiteData.about);
      expect(saved.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("should throw ConflictError when etag no longer matches", async () => {
      await saveSiteData(mockSiteData);
      const { etag } = await readSiteData();
      await saveSiteData({ ...mockSiteData, about: { content: "other" } }, etag);
      await expect(
        saveSiteData({ ...mockSiteData, about: { content: "stale" } }, etag)
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("removeSitePhotoByKey", () => {
    it("should remove photo when id matches key", async () => {
      await replaceJson("metadata/site.json", {
        ...mockSiteData,
        photos: [
          { id: "images/a.png", url: "https://cdn/a.png" },
          { id: "images/b.png", url: "https://cdn/b.png" },
        ],
      });
      await expect(removeSitePhotoByKey("images/a.png")).resolves.toBe(true);
      const site = await getSiteData();
      expect(site.photos).toEqual([{ id: "images/b.png", url: "https://cdn/b.png" }]);
    });

    it("should return false when no photo matches key", async () => {
      await replaceJson("metadata/site.json", mockSiteData);
      await expect(removeSitePhotoByKey("missing-key")).resolves.toBe(false);
      await expect(getSiteData()).resolves.toEqual(mockSiteData);
    });
  });
});
