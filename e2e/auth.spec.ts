import { test, expect } from "@playwright/test";

test.describe("Auth UI", () => {
  test("login page renderiza com role selector", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Entrar/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Atendente/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Cozinha/i })).toBeVisible();
  });

  test("seletor de role mostra usuários quando clicado", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Atendente/i }).click();
    // Espera popular lista — Maria deve aparecer (seed)
    await expect(page.getByRole("button", { name: "Maria" }).first()).toBeVisible({ timeout: 5000 });
  });

  test("cliente público abre sem login", async ({ page }) => {
    await page.goto("/cliente");
    await expect(page.locator("text=/Cozinha da/")).toBeVisible();
    await expect(page.locator("text=/Pronto pra retirar/i")).toBeVisible();
  });

  test("rotas protegidas redirecionam pra login sem sessão", async ({ page }) => {
    // Sem cookie/localStorage, atendente/cozinha/admin devem redirecionar
    await page.goto("/atendente");
    // Tem useEffect que redireciona após hidratação
    await page.waitForURL("/", { timeout: 5000 });
    await expect(page).toHaveURL("/");
  });
});
