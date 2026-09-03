import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";
import { ProductsPage } from "../pages/ProductsPage";
import { CartPage } from "../pages/CartPage";
import { CheckoutPage } from "../pages/CheckoutPage";

const PRODUCT_NAME = "Sauce Labs Backpack";

test.describe("AC4: Checkout", () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    const productsPage = new ProductsPage(page);
    await loginPage.goto();
    await loginPage.login("standard_user", "secret_sauce");
    await productsPage.addProductToCart(PRODUCT_NAME);
  });

  test("AC4-S1: Completing checkout with valid information shows the order confirmation message", async ({
    page,
  }) => {
    const productsPage = new ProductsPage(page);
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);

    await test.step("Click the cart icon to open the cart page", async () => {
      await productsPage.openCart();
    });

    await test.step('Click the "Checkout" button', async () => {
      await cartPage.goToCheckout();
    });

    await test.step("Enter first name, last name, and zip code", async () => {
      await checkoutPage.fillInformation("Jane", "Doe", "12345");
    });

    await test.step('Click the "Continue" button', async () => {
      await checkoutPage.continueToOverview();
    });

    await test.step('Order overview page shows the "Sauce Labs Backpack" item', async () => {
      await expect(checkoutPage.itemInSummary(PRODUCT_NAME)).toBeVisible();
    });

    await test.step('Click the "Finish" button', async () => {
      await checkoutPage.finish();
    });

    await test.step('A confirmation message "Thank you for your order!" is visible', async () => {
      await expect(checkoutPage.completeHeader).toBeVisible();
    });

    await test.step("Confirmation/completion text is visible", async () => {
      await expect(checkoutPage.completeText).toBeVisible();
    });

    await test.step("A visual confirmation element (pony express image) is present", async () => {
      await expect(checkoutPage.ponyExpressImage).toBeVisible();
    });
  });

  test("AC4-S2: Checkout information step requires mandatory fields", async ({
    page,
  }) => {
    const productsPage = new ProductsPage(page);
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);

    await test.step("Click the cart icon to open the cart page", async () => {
      await productsPage.openCart();
    });

    await test.step('Click the "Checkout" button', async () => {
      await cartPage.goToCheckout();
    });

    await test.step('Leave fields empty and click "Continue"', async () => {
      await checkoutPage.continueToOverview();
    });

    await test.step("An error message indicating first name is required is visible", async () => {
      await expect(checkoutPage.errorMessage).toBeVisible();
      const text = await checkoutPage.getErrorText();
      expect(text).toMatch(/First Name is required/i);
    });

    await test.step("The user remains on the checkout information page", async () => {
      await expect(page).toHaveURL(/checkout-step-one\.html/);
    });
  });
});
