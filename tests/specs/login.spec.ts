import { test } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage.js";
import { ProductsPage } from "../pages/ProductsPage.js";

test.describe("Login Flow", () => {
  test("AC1-S1: Log in successfully with valid credentials", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const productsPage = new ProductsPage(page);

    await test.step("Navigate to the login page", async () => {
      await loginPage.goto();
    });

    await test.step("Enter valid username, password and click Login", async () => {
      await loginPage.login("standard_user", "secret_sauce");
    });

    await test.step("Verify redirection to the Products page", async () => {
      await productsPage.expectDisplayed();
    });
  });

  test("AC2-S1: Attempt login with invalid credentials", async ({ page }) => {
    const loginPage = new LoginPage(page);

    await test.step("Navigate to the login page", async () => {
      await loginPage.goto();
    });

    await test.step("Enter invalid username, password and click Login", async () => {
      await loginPage.login("invalid_user", "wrong_password");
    });

    await test.step("Verify error message is displayed and user remains on login page", async () => {
      await loginPage.expectErrorMessageVisible("Epic sadface: Username and password do not match any user in this service");
      await loginPage.expectStillOnLoginPage();
    });
  });
});
