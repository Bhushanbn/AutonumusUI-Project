import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage.js";
import { ProductsPage } from "../pages/ProductsPage.js";

test.describe("AC1: Valid login", () => {
  test("AC1-S1: Successful login with valid credentials navigates to the products page", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    const productsPage = new ProductsPage(page);

    await test.step("Navigate to the login page", async () => {
      await loginPage.goto();
    });

    await test.step("Enter valid credentials and click Login", async () => {
      await loginPage.login("standard_user", "secret_sauce");
    });

    await test.step("Browser navigates away from the login page", async () => {
      await expect(page).toHaveURL(/inventory\.html/);
    });

    await test.step('Page heading "Products" is visible', async () => {
      await expect(productsPage.title).toBeVisible();
    });

    await test.step("A list of product items is visible", async () => {
      await expect(productsPage.inventoryItems.first()).toBeVisible();
      expect(await productsPage.inventoryItems.count()).toBeGreaterThan(0);
    });

    await test.step("No error message is displayed", async () => {
      await expect(loginPage.errorMessage).toHaveCount(0);
    });
  });
});

test.describe("AC2: Invalid login", () => {
  test("AC2-S1: Invalid credentials display an error message and keep user on the login page", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);

    await test.step("Navigate to the login page", async () => {
      await loginPage.goto();
    });

    await test.step("Enter invalid credentials and click Login", async () => {
      await loginPage.login("invalid_user", "wrong_password");
    });

    await test.step("An error message is visible", async () => {
      await expect(loginPage.errorMessage).toBeVisible();
      const text = await loginPage.getErrorText();
      expect(text).toMatch(/Username and password do not match any user/i);
    });

    await test.step("The user remains on the login page", async () => {
      await expect(page).toHaveURL(/saucedemo\.com\/?$/);
    });

    await test.step("Username and Password fields remain visible", async () => {
      await expect(loginPage.usernameInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();
    });
  });

  test("AC2-S2: Empty credentials submission displays a required-field error", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);

    await test.step("Navigate to the login page", async () => {
      await loginPage.goto();
    });

    await test.step("Submit the form with empty Username and Password", async () => {
      await loginPage.loginButton.click();
    });

    await test.step("An error message is visible indicating username is required", async () => {
      await expect(loginPage.errorMessage).toBeVisible();
      const text = await loginPage.getErrorText();
      expect(text).toMatch(/Username is required/i);
    });

    await test.step("The user remains on the login page", async () => {
      await expect(page).toHaveURL(/saucedemo\.com\/?$/);
    });
  });
});
