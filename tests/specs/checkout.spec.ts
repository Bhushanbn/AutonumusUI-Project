import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";
import { ProductsPage } from "../pages/ProductsPage";
import { CartPage } from "../pages/CartPage";
import { CheckoutPage } from "../pages/CheckoutPage";

const PRODUCT_NAME = "Sauce Labs Backpack";

test.describe("AC4: Checkout flow", () => {
  test("AC4-S1: Complete checkout end-to-end and see confirmation message", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const productsPage = new ProductsPage(page);
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);

    await test.step("Given user is logged in and has added 'Sauce Labs Backpack' to the cart", async () => {
      await loginPage.goto();
      await loginPage.login("standard_user", "secret_sauce");
      await productsPage.expectDisplayed();
      await productsPage.addProductToCart(PRODUCT_NAME);
      await expect(productsPage.cartBadge).toHaveText("1");
    });

    await test.step("When user navigates to the cart page and clicks Checkout", async () => {
      await productsPage.goToCart();
      await cartPage.expectDisplayed();
      await expect(cartPage.cartItem(PRODUCT_NAME)).toBeVisible();
      await cartPage.checkout();
    });

    await test.step("And enters valid checkout information and clicks Continue", async () => {
      await checkoutPage.fillInformation("John", "Doe", "12345");
      await checkoutPage.continueToOverview();
    });

    await test.step("Then the checkout overview page shows the product and order totals", async () => {
      await checkoutPage.expectOverviewDisplayed();
      await expect(checkoutPage.productInSummary(PRODUCT_NAME)).toBeVisible();
      await expect(page.locator(".summary_total_label")).toBeVisible();
    });

    await test.step("When user clicks Finish", async () => {
      await checkoutPage.finish();
    });

    await test.step("Then a confirmation message is displayed", async () => {
      await checkoutPage.expectConfirmationDisplayed();
      const text = await checkoutPage.getConfirmationText();
      expect(text.toLowerCase()).toContain("thank you");
    });
  });
});
