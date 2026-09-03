import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage.js";
import { ProductsPage } from "../pages/ProductsPage.js";
import { CartPage } from "../pages/CartPage.js";

const PRODUCT_NAME = "Sauce Labs Backpack";

test.describe("AC3: Add to cart", () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login("standard_user", "secret_sauce");
  });

  test('AC3-S1: Adding "Sauce Labs Backpack" to the cart updates the cart indicator', async ({
    page,
  }) => {
    const productsPage = new ProductsPage(page);

    await test.step("Locate the product listing and click Add to cart", async () => {
      await productsPage.addProductToCart(PRODUCT_NAME);
    });

    await test.step('The cart icon/badge shows a count of "1"', async () => {
      await expect(productsPage.cartBadge).toHaveText("1");
    });

    await test.step('The button changes from "Add to cart" to "Remove"', async () => {
      await expect(productsPage.productRemoveButton(PRODUCT_NAME)).toBeVisible();
      await expect(productsPage.productAddToCartButton(PRODUCT_NAME)).toHaveCount(0);
    });
  });

  test("AC3-S2: Added item appears in the cart page", async ({ page }) => {
    const productsPage = new ProductsPage(page);
    const cartPage = new CartPage(page);

    await test.step("Add Sauce Labs Backpack to the cart", async () => {
      await productsPage.addProductToCart(PRODUCT_NAME);
    });

    await test.step("Click the cart icon to open the cart page", async () => {
      await productsPage.openCart();
    });

    await test.step('The cart page displays an item titled "Sauce Labs Backpack"', async () => {
      await expect(cartPage.cartItemByName(PRODUCT_NAME)).toBeVisible();
    });

    await test.step('The item quantity is "1"', async () => {
      await expect(cartPage.itemQuantity(PRODUCT_NAME)).toHaveText("1");
    });
  });
});
