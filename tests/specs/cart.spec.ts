import { test } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage.js";
import { ProductsPage } from "../pages/ProductsPage.js";

test.describe("Cart Flow", () => {
  test('AC3-S1: Add "Sauce Labs Backpack" to cart from the products page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const productsPage = new ProductsPage(page);

    await test.step("Preconditions: Log in and navigate to products page", async () => {
      await loginPage.goto();
      await loginPage.login("standard_user", "secret_sauce");
      await productsPage.expectDisplayed();
    });

    await test.step('Click "Add to cart" for "Sauce Labs Backpack"', async () => {
      await productsPage.addProductToCart("Sauce Labs Backpack");
    });

    await test.step('Verify cart badge displays "1" and button changes to "Remove"', async () => {
      await productsPage.expectCartBadgeCount("1");
      await productsPage.expectRemoveButtonVisible("Sauce Labs Backpack");
    });
  });
});
