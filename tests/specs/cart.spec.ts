import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";
import { ProductsPage } from "../pages/ProductsPage";
import { CartPage } from "../pages/CartPage";

const PRODUCT_NAME = "Sauce Labs Backpack";

test.describe("AC3: Add to cart", () => {
  test("AC3-S1: Add 'Sauce Labs Backpack' to cart from products page", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const productsPage = new ProductsPage(page);
    const cartPage = new CartPage(page);

    await test.step("Given user is logged in and on the products page with an empty cart", async () => {
      await loginPage.goto();
      await loginPage.login("standard_user", "secret_sauce");
      await productsPage.expectDisplayed();
      await expect(productsPage.cartBadge).not.toBeVisible();
    });

    await test.step("When user adds 'Sauce Labs Backpack' to the cart", async () => {
      await expect(productsPage.addToCartButton(PRODUCT_NAME)).toBeVisible();
      await productsPage.addProductToCart(PRODUCT_NAME);
    });

    await test.step("Then the cart badge shows a count of 1", async () => {
      await expect(productsPage.cartBadge).toBeVisible();
      await expect(productsPage.cartBadge).toHaveText("1");
    });

    await test.step("And the Add to cart button changes to a Remove button", async () => {
      await expect(productsPage.removeButton(PRODUCT_NAME)).toBeVisible();
      await expect(productsPage.addToCartButton(PRODUCT_NAME)).not.toBeVisible();
    });

    await test.step("And navigating to the cart page shows the product listed", async () => {
      await productsPage.goToCart();
      await cartPage.expectDisplayed();
      await expect(cartPage.cartItem(PRODUCT_NAME)).toBeVisible();
    });
  });
});
