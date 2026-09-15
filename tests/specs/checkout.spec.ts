import { test } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage.js";
import { ProductsPage } from "../pages/ProductsPage.js";
import { CartPage } from "../pages/CartPage.js";
import { CheckoutPage } from "../pages/CheckoutPage.js";

test.describe("Checkout Flow", () => {
  test("AC4-S1: Complete checkout process for item in cart", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const productsPage = new ProductsPage(page);
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);

    await test.step('Preconditions: Log in and add "Sauce Labs Backpack" to cart', async () => {
      await loginPage.goto();
      await loginPage.login("standard_user", "secret_sauce");
      await productsPage.expectDisplayed();
      await productsPage.addProductToCart("Sauce Labs Backpack");
    });

    await test.step("Click shopping cart icon to view cart", async () => {
      await productsPage.goToCart();
      await cartPage.expectDisplayed();
    });

    await test.step('Click "Checkout" button', async () => {
      await cartPage.checkout();
    });

    await test.step("Enter customer info and click Continue", async () => {
      await checkoutPage.fillInformation("John", "Doe", "12345");
      await checkoutPage.continueToOverview();
      await checkoutPage.expectOverviewDisplayed();
    });

    await test.step('Click "Finish" button on checkout overview page', async () => {
      await checkoutPage.finish();
    });

    await test.step("Verify order confirmation header is displayed", async () => {
      await checkoutPage.expectConfirmationDisplayed("Thank you for your order!");
    });
  });
});
