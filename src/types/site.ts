import { LinkMetadata } from "./link";

export interface Photo {
  id: string;
  url: string;
}

export interface SiteData {
  about: {
    content: string;
  };
  photos: Photo[];
  links?: LinkMetadata[];
  /** Bumped on each admin save of site.json (about/photos). */
  updatedAt?: string;
}
