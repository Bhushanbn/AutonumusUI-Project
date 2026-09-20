import { test } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";
import { ProductsPage } from "../pages/ProductsPage";
import { CartPage } from "../pages/CartPage";
import { CheckoutPage } from "../pages/CheckoutPage";

test.describe("Add to cart & checkout flow", () => {
  test("AC1-S1: Log in successfully with valid credentials", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const productsPage = new ProductsPage(page);

    await test.step("Navigate to the login page", async () => {
      await loginPage.goto();
    });

    await test.step("Enter valid credentials and click Login", async () => {
      await loginPage.login("standard_user", "secret_sauce");
    });

    await test.step("Verify redirection to Products page and header title", async () => {
      await productsPage.expectDisplayed();
    });
  });

  test("AC2-S1: Attempt login with invalid credentials", async ({ page }) => {
    const loginPage = new LoginPage(page);

    await test.step("Navigate to the login page", async () => {
      await loginPage.goto();
    });

    await test.step("Enter invalid credentials and click Login", async () => {
      await loginPage.login("invalid_user", "invalid_password");
    });

    await test.step("Verify error message is displayed and user remains on login page", async () => {
      await loginPage.expectErrorMessageVisible("Username and password do not match");
      await loginPage.expectStillOnLoginPage();
    });
  });

  test("AC3-S1: Add \"Sauce Labs Backpack\" to cart from the products page", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const productsPage = new ProductsPage(page);

    await test.step("Log in with valid credentials", async () => {
      await loginPage.goto();
      await loginPage.login("standard_user", "secret_sauce");
    });

    await test.step("Locate \"Sauce Labs Backpack\" and click \"Add to cart\"", async () => {
      await productsPage.addProductToCart("Sauce Labs Backpack");
    });

    await test.step("Verify cart badge count updates to \"1\" and button changes to \"Remove\"", async () => {
      await productsPage.expectCartBadgeCount("1");
      await productsPage.expectRemoveButtonVisible("Sauce Labs Backpack");
    });
  });

  test("AC4-S1: Complete checkout process for item in cart", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const productsPage = new ProductsPage(page);
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);

    await test.step("Log in and add \"Sauce Labs Backpack\" to cart", async () => {
      await loginPage.goto();
      await loginPage.login("standard_user", "secret_sauce");
      await productsPage.addProductToCart("Sauce Labs Backpack");
    });

    await test.step("Navigate to cart page", async () => {
      await productsPage.goToCart();
      await cartPage.expectDisplayed();
    });

    await test.step("Click Checkout and fill shipping information", async () => {
      await cartPage.checkout();
      await checkoutPage.fillInformation("John", "Doe", "12345");
      await checkoutPage.continueToOverview();
      await checkoutPage.expectOverviewDisplayed();
    });

    await test.step("Finish checkout and verify confirmation message", async () => {
      await checkoutPage.finish();
      await checkoutPage.expectConfirmationDisplayed("Thank you for your order!");
    });
  });
});
