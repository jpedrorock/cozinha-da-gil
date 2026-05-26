import { test, expect } from "@playwright/test";

test.describe("Auth UI", () => {
  test("login page renderiza com brand e seletor de papel", async ({ page }) => {
    await page.goto("/");
    // Brand "Cozinha da Gil" na tela de login (sem heading formal — é a marca)
    await expect(page.getByText("Cozinha da").first()).toBeVisible();
    // Seletor de papel
    await expect(page.getByRole("button", { name: /Atendente/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Cozinha/i })).toBeVisible();
  });

  test("clicar em Atendente mostra o teclado PIN", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Atendente/i }).click({ force: true });
    // Após clicar no papel, o teclado numérico deve aparecer pra digitar PIN
    await expect(
      page.getByRole("group", { name: "Teclado numérico" }),
    ).toBeVisible({ timeout: 3000 });
  });

  test("cliente público abre sem login", async ({ page }) => {
    await page.goto("/cliente");
    await expect(page.getByText("Cozinha da").first()).toBeVisible();
    await expect(
      page.locator("text=/Pronto pra retirar/i").first(),
    ).toBeVisible();
  });

  test("rotas protegidas redirecionam pra login sem sessão", async ({ page }) => {
    // Sem cookie/localStorage, atendente/cozinha/admin devem redirecionar
    await page.goto("/atendente");
    // Tem useEffect que redireciona após hidratação
    await page.waitForURL("/", { timeout: 5000 });
    await expect(page).toHaveURL("/");
  });
});
