import path from "node:path";
import type { NextConfig } from "next";

/** Keep in sync with src/lib/cdn.ts PAGE_CACHE_TAG. */
const PAGE_CACHE_TAG = "tt-pages";
const PAGE_CDN_SECONDS = 3600;

type ImageRemotePattern = {
  protocol: "http" | "https";
  hostname: string;
  port?: string;
  pathname: string;
};

function publicBaseRemotePattern(): ImageRemotePattern | null {
  const raw = process.env.SCALEWAY_PUBLIC_BASE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return {
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      port: url.port,
      pathname: "/**",
    };
  } catch {
    return null;
  }
}

const extraImagePattern = publicBaseRemotePattern();

const nextConfig: NextConfig = {
  // Netlify's Next.js runtime packages the app itself; "standalone" is only for the Docker
  // image (self-hosted). Netlify sets NETLIFY=true during its builds.
  output: process.env.NETLIFY ? undefined : "standalone",
  // Parent worktree also has a lockfile (/tmp/ttpoc); pin tracing to this app root.
  outputFileTracingRoot: path.join(__dirname),
  // Home loads bucket data at request time; don't bake an empty build-time shell (PPR).
  experimental: { ppr: false },
  // Disable React strict mode to avoid warnings from swagger-ui-react
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ps-os-1.s3.nl-ams.scw.cloud",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "ps-os-1.s3.fr-par.scw.cloud",
        port: "",
        pathname: "/**",
      },
      ...(extraImagePattern ? [extraImagePattern] : []),
    ],
  },
  async headers() {
    const cdn = [
      // Durable cache only after home SSR is verified; tag purge runs on admin save.
      { key: "Netlify-CDN-Cache-Control", value: `public, durable, s-maxage=${PAGE_CDN_SECONDS}` },
      { key: "Netlify-Cache-Tag", value: PAGE_CACHE_TAG },
      { key: "Cache-Control", value: "private, no-cache" },
    ];
    return [{ source: "/", headers: cdn }];
  },
};

export default nextConfig;
