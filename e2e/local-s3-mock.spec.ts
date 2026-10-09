import { mkdir } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const ADMIN_EMAIL = "editor@example.com";
const DATA_DIR = ".data-local-s3";
const ARTIFACTS_DIR = path.join(process.cwd(), "e2e", "artifacts");

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00,
  0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d,
  0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);
const MP3 = Buffer.from([0xff, 0xfb, 0x90, 0x44, 0x00]);

function stopMoto(): void {
  execFileSync("bash", ["scripts/dev-s3-down.sh"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}

async function loginViaMagicLink(page: Page, request: APIRequestContext) {
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

async function assertModalFullyVisible(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (!viewport) return;
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function assertScrollLocked(page: Page): Promise<void> {
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 400);
  const after = await page.evaluate(() => window.scrollY);
  expect(after).toBe(before);
}

test("upload image and audio on moto mock without scw.cloud", async ({ page, request }) => {
  const scwHits: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("scw.cloud")) scwHits.push(req.url());
  });

  await loginViaMagicLink(page, request);

  await page.locator("input[data-image]").setInputFiles({
    name: "e2e-pixel.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(page.getByText("e2e-pixel.png").first()).toBeVisible({ timeout: 60_000 });

  const imageRow = page.locator(".admin-inset", { hasText: "e2e-pixel.png" }).first();
  await imageRow.getByRole("checkbox").check();
  await page.getByRole("button", { name: "[ SAVE SELECTION ]" }).click();

  await page.locator("input[data-audio]").setInputFiles({
    name: "e2e-tone.mp3",
    mimeType: "audio/mpeg",
    buffer: MP3,
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
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
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
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("e2e tone", { exact: false })).toHaveCount(0, { timeout: 30_000 });

  expect(scwHits).toEqual([]);
});

test.describe("delete confirm modal visibility across viewports", () => {
  test.beforeAll(async () => {
    await mkdir(ARTIFACTS_DIR, { recursive: true });
  });

  for (const viewport of VIEWPORTS) {
    const label = `${viewport.width}x${viewport.height}`;

    test(`image delete modal at ${label}`, async ({ page, request }) => {
      await page.setViewportSize(viewport);
      await loginViaMagicLink(page, request);

      const name = `vp-img-${label}.png`;
      await page.locator("input[data-image]").setInputFiles({
        name,
        mimeType: "image/png",
        buffer: PNG,
      });
      const imageManager = page.locator("div.admin-window", { hasText: "[ IMAGE MANAGER ]" });
      const row = imageManager.locator(".admin-inset", { hasText: name }).first();
      await expect(row).toBeAttached({ timeout: 60_000 });
      await row.scrollIntoViewIfNeeded();
      await row.getByRole("button", { name: "DEL" }).click();

      await assertModalFullyVisible(page);
      await assertScrollLocked(page);
      await page.getByRole("dialog").screenshot({
        path: path.join(ARTIFACTS_DIR, `image-${label}.png`),
      });
      await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    });

    test(`audio delete modal at ${label}`, async ({ page, request }) => {
      await page.setViewportSize(viewport);
      await loginViaMagicLink(page, request);

      const fileName = `vp-tone-${label}.mp3`;
      await page.locator("input[data-audio]").setInputFiles({
        name: fileName,
        mimeType: "audio/mpeg",
        buffer: MP3,
      });
      const titleHint = fileName.replace(/\.mp3$/, "").replaceAll(/-/g, " ");
      const audioManager = page.locator("div.admin-window", { hasText: "[ AUDIO MANAGER ]" });
      const row = audioManager.locator(".admin-inset", { hasText: titleHint }).first();
      await expect(row).toBeAttached({ timeout: 90_000 });
      await row.scrollIntoViewIfNeeded();
      await row.getByRole("button", { name: "DEL" }).click();

      await assertModalFullyVisible(page);
      await assertScrollLocked(page);
      await page.getByRole("dialog").screenshot({
        path: path.join(ARTIFACTS_DIR, `audio-${label}.png`),
      });
      await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    });

    test(`link delete modal at ${label}`, async ({ page, request }) => {
      await page.setViewportSize(viewport);
      await loginViaMagicLink(page, request);

      const linkText = `VP Link ${label}`;
      const linkManager = page.locator("div.admin-window", { hasText: "[ MANAGE LINKS ]" });
      await linkManager.getByRole("button", { name: "+ ADD LINK" }).click();
      await linkManager.getByPlaceholder("Enter link text").fill(linkText);
      await linkManager.getByPlaceholder("https://example.com").fill(`https://example.com/${label}`);
      await linkManager.getByRole("button", { name: "SAVE", exact: true }).click();
      await expect(linkManager.getByText(linkText)).toBeVisible({ timeout: 30_000 });

      const row = linkManager.locator("div.admin-window", { hasText: linkText }).first();
      await row.scrollIntoViewIfNeeded();
      await row.getByRole("button", { name: "DEL" }).click();

      await assertModalFullyVisible(page);
      await assertScrollLocked(page);
      await page.getByRole("dialog").screenshot({
        path: path.join(ARTIFACTS_DIR, `link-${label}.png`),
      });
      await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    });
  }
});

test("keyboard-only image delete confirm flow", async ({ page, request }) => {
  await loginViaMagicLink(page, request);

  await page.locator("input[data-image]").setInputFiles({
    name: "kb-delete.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(page.getByText("kb-delete.png").first()).toBeVisible({ timeout: 60_000 });

  const imageManager = page.locator("div.admin-window", { hasText: "[ IMAGE MANAGER ]" });
  const row = imageManager.locator(".admin-inset", { hasText: "kb-delete.png" }).first();
  await row.getByRole("button", { name: "DEL" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "DEL" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Delete" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(imageManager.locator(".admin-inset", { hasText: "kb-delete.png" })).toHaveCount(0, {
    timeout: 30_000,
  });
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
