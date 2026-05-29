import { expect, test } from "@playwright/test";

test.describe("Auth UI", () => {
  test("login page renderiza com role chips", async ({ page }) => {
    await page.goto("/");
    // App boota com splash screen — aguarda ela sumir
    await page
      .locator('[aria-hidden="true"].fixed.z-\\[100\\]')
      .waitFor({ state: "hidden", timeout: 5_000 })
      .catch(() => {/* já sumiu */});

    // Segmented control mostra Atendente + Cozinha
    await expect(page.getByRole("button", { name: /Atendente/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Cozinha/i })).toBeVisible();
  });

  test("keypad numérico aparece sempre (login via role + PIN)", async ({ page }) => {
    await page.goto("/");
    await page
      .locator('[aria-hidden="true"].fixed.z-\\[100\\]')
      .waitFor({ state: "hidden", timeout: 5_000 })
      .catch(() => {/* já sumiu */});

    // Login moderno identifica user pelo {role + PIN} sem cards de usuário.
    // Keypad numérico sempre visível — aria-label confirma presença.
    await expect(page.getByRole("group", { name: /Teclado num/i })).toBeVisible({
      timeout: 5_000,
    });
  });

  test("cliente público abre sem login", async ({ page }) => {
    await page.goto("/cliente");
    await page
      .locator('[aria-hidden="true"].fixed.z-\\[100\\]')
      .waitFor({ state: "hidden", timeout: 5_000 })
      .catch(() => {/* já sumiu */});

    // TV pública tem "Cozinha da Gil" no header e "Pronto pra retirar"
    // como título da coluna direita.
    await expect(page.locator("text=/Cozinha da/").first()).toBeVisible();
    await expect(page.locator("text=/Pronto pra retirar/i").first()).toBeVisible();
  });

  test("rotas protegidas redirecionam pra login sem sessão", async ({ page }) => {
    // Sem cookie/localStorage, atendente/cozinha/admin devem redirecionar
    await page.goto("/atendente");
    // Tem useEffect que redireciona após hidratação
    await page.waitForURL("/", { timeout: 5_000 });
    await expect(page).toHaveURL("/");
  });
});
