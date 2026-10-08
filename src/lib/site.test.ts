/**
 * @jest-environment node
 */
import { MemoryObjectStore, setObjectStoreForTests } from "./store";
import { replaceJson } from "./jsonStore";
import { getSiteData, saveSiteData } from "./site";
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
  });
});
