import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "editor@example.com";
const DATA_DIR = ".data-local-s3";

function stopMoto(): void {
  execFileSync("bash", ["scripts/dev-s3-down.sh"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}

async function loginViaMagicLink(page: import("@playwright/test").Page, request: import("@playwright/test").APIRequestContext) {
  await request.post("/api/auth/magic-link", {
    data: { email: ADMIN_EMAIL, next: "/admin" },
  });
  const outbox = path.join(process.cwd(), DATA_DIR, "outbox", "login-links.jsonl");
  const raw = await readFile(outbox, "utf8");
  const line = raw.trim().split("\n").at(-1);
  if (!line) throw new Error("No magic link in outbox");
  const { url } = JSON.parse(line) as { url: string };
  await page.goto(url);
  await expect(page.getByText(`LOGGED IN AS: ${ADMIN_EMAIL}`)).toBeVisible({ timeout: 30_000 });
}

test("upload image and audio on moto mock without scw.cloud", async ({ page, request }) => {
  const scwHits: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("scw.cloud")) scwHits.push(req.url());
  });

  page.on("dialog", (d) => d.accept());

  await loginViaMagicLink(page, request);

  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00,
    0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00,
    0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d,
    0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  const mp3 = Buffer.from([0xff, 0xfb, 0x90, 0x44, 0x00]);

  await page.locator("input[data-image]").setInputFiles({
    name: "e2e-pixel.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(page.getByText("e2e-pixel.png").first()).toBeVisible({ timeout: 60_000 });

  const imageRow = page.locator(".admin-inset", { hasText: "e2e-pixel.png" }).first();
  await imageRow.getByRole("checkbox").check();
  await page.getByRole("button", { name: "[ SAVE SELECTION ]" }).click();

  await page.locator("input[data-audio]").setInputFiles({
    name: "e2e-tone.mp3",
    mimeType: "audio/mpeg",
    buffer: mp3,
  });
  await expect(page.getByText("e2e tone", { exact: false })).toBeVisible({ timeout: 90_000 });

  await page.goto("/");
  await expect(page.getByText("[ MUSIC.DIR ]")).toBeVisible();
  await expect(page.getByText("[ IMAGES.DIR ]")).toBeVisible();
  await expect(page.locator("img").first()).toHaveAttribute("src", /19000/);

  await page.goto("/admin");
  await expect(page.getByText(`LOGGED IN AS: ${ADMIN_EMAIL}`)).toBeVisible();

  const imageManager = page.locator("div.admin-window", { hasText: "[ IMAGE MANAGER ]" });
  const imageRowAfter = imageManager.locator(".admin-inset", { hasText: "e2e-pixel.png" }).first();
  await imageRowAfter.getByRole("button", { name: "DEL" }).click();
  await expect(imageManager.locator(".admin-inset", { hasText: "e2e-pixel.png" })).toHaveCount(0, {
    timeout: 30_000,
  });

  const image404s: string[] = [];
  page.on("response", (res) => {
    if (res.status() === 404 && /images\//.test(res.url())) image404s.push(res.url());
  });
  await page.goto("/");
  const siteRes = await request.get("/api/site");
  const siteJson = (await siteRes.json()) as { photos?: { id: string }[] };
  expect(siteJson.photos?.some((p) => p.id.includes("e2e-pixel"))).toBe(false);
  await expect(page.locator('[alt*="e2e-pixel"], img[src*="e2e-pixel"]')).toHaveCount(0);
  expect(image404s).toEqual([]);

  await page.goto("/admin");
  await expect(page.getByText(`LOGGED IN AS: ${ADMIN_EMAIL}`)).toBeVisible();
  const audioManager = page.locator("div.admin-window", { hasText: "[ AUDIO MANAGER ]" });
  await audioManager.locator(".admin-inset", { hasText: "e2e" }).first().getByRole("button", { name: "DEL" }).click();
  await expect(page.getByText("e2e tone", { exact: false })).toHaveCount(0, { timeout: 30_000 });

  expect(scwHits).toEqual([]);
});

test("shows error toast when moto stops mid-save", async ({ page, request }) => {
  await loginViaMagicLink(page, request);
  await expect(page.getByText(/UPDATE ABOUT TEXT/i)).toBeVisible();

  stopMoto();

  await page.getByRole("button", { name: "[ SAVE ]" }).click();
  // Prefer .admin-toast: Next.js also mounts #__next-route-announcer__ with role=alert.
  const toast = page.locator(".admin-toast[role='alert']");
  await expect(toast).toBeVisible({ timeout: 60_000 });
  await expect(toast).not.toHaveText("");
});
