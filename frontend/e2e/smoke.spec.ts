import { expect, test } from "@playwright/test";

test("主要ページをグローバルナビゲーションで移動できる", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "ホーム" })).toBeVisible();

  await page.getByRole("link", { name: "応募先企業", exact: true }).click();

  await expect(page).toHaveURL(/\/companies$/);
  await expect(
    page.getByRole("heading", { name: "応募企業情報" }),
  ).toBeVisible();
});

test("async Server Componentの動的ページを表示できる", async ({ page }) => {
  await page.goto("/companies/1/edit");

  await expect(
    page.getByRole("heading", { name: "株式会社アルファテック" }),
  ).toBeVisible();
  await expect(page.getByLabel("企業名")).toHaveValue("株式会社アルファテック");

  await page.goto("/evaluations/87");

  await expect(
    page.getByRole("heading", { name: "合否の目安：通過見込み" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "アドバイス" })).toBeVisible();
});
