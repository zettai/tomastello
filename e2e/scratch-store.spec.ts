import { test, expect } from "@playwright/test";

test("public home and health run on file scratch store", async ({ page, request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  await page.goto("/");
  await expect(page.getByText("[ LIVE_RADIO.EXE ]")).toBeVisible();
  await expect(page.getByText("[ ABOUT.TXT ]")).toBeVisible();
});

test("login page loads without bucket credentials", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("[ LOGIN.EXE ]")).toBeVisible();
});
