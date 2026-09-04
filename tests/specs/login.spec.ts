import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";
import { ProductsPage } from "../pages/ProductsPage";

test.describe("AC1 & AC2: Login", () => {
  test("AC1-S1: Successful login with valid credentials navigates to products page", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const productsPage = new ProductsPage(page);

    await test.step("Given user is on the login page", async () => {
      await loginPage.goto();
    });

    await test.step("When user logs in with valid credentials", async () => {
      await loginPage.login("standard_user", "secret_sauce");
    });

    await test.step("Then the user is navigated away from the login page", async () => {
      await expect(page).not.toHaveURL(/saucedemo\.com\/?$/);
    });

    await test.step("And the products page is displayed", async () => {
      await productsPage.expectDisplayed();
    });

    await test.step("And no error message is shown", async () => {
      await expect(loginPage.errorMessage).not.toBeVisible();
    });
  });

  test("AC2-S1: Invalid credentials show an error message and user remains on login page", async ({ page }) => {
    const loginPage = new LoginPage(page);

    await test.step("Given user is on the login page", async () => {
      await loginPage.goto();
    });

    await test.step("When user logs in with invalid credentials", async () => {
      await loginPage.login("invalid_user", "wrong_password");
    });

    await test.step("Then an error message is displayed", async () => {
      await expect(loginPage.errorMessage).toBeVisible();
      const text = await loginPage.getErrorText();
      expect(text.length).toBeGreaterThan(0);
    });

    await test.step("And the user remains on the login page", async () => {
      await loginPage.expectStillOnLoginPage();
    });

    await test.step("And the products page is not displayed", async () => {
      await expect(page).not.toHaveURL(/inventory\.html/);
    });
  });

  test("AC2-S2: Empty credentials show an error message and user remains on login page", async ({ page }) => {
    const loginPage = new LoginPage(page);

    await test.step("Given user is on the login page", async () => {
      await loginPage.goto();
    });

    await test.step("When user submits the login form with empty fields", async () => {
      await loginPage.login("", "");
    });

    await test.step("Then an error message is displayed", async () => {
      await expect(loginPage.errorMessage).toBeVisible();
      const text = await loginPage.getErrorText();
      expect(text.length).toBeGreaterThan(0);
    });

    await test.step("And the user remains on the login page", async () => {
      await loginPage.expectStillOnLoginPage();
    });
  });
});
