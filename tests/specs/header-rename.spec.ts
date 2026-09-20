import { test } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";
import { ProductsPage } from "../pages/ProductsPage";

test.describe("Header Rename to Inventory", () => {
  test("AC1-S1: Successful login with valid credentials", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const productsPage = new ProductsPage(page);

    await test.step("Navigate to login page", async () => {
      await loginPage.goto();
    });

    await test.step("Type valid credentials and click Login button", async () => {
      await loginPage.login("standard_user", "secret_sauce");
    });

    await test.step("Verify login form disappears and user is redirected to inventory URL", async () => {
      await loginPage.expectLoginFormNotVisible();
      await productsPage.expectDisplayed();
    });

    await test.step("Verify main page content (inventory list) is rendered and visible", async () => {
      await productsPage.expectInventoryListVisible();
    });
  });

  test("AC2-S1: Verify primary page header text is 'Inventory'", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const productsPage = new ProductsPage(page);

    await test.step("Log in as valid user", async () => {
      await loginPage.goto();
      await loginPage.login("standard_user", "secret_sauce");
      await productsPage.expectDisplayed();
    });

    await test.step("Locate main header and verify text reads exactly 'Inventory'", async () => {
      await productsPage.expectHeaderTitle("Inventory");
    });
  });

  test("AC3-S1: Verify old 'Products' header is absent", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const productsPage = new ProductsPage(page);

    await test.step("Log in as valid user", async () => {
      await loginPage.goto();
      await loginPage.login("standard_user", "secret_sauce");
      await productsPage.expectDisplayed();
    });

    await test.step("Inspect main header area and verify 'Products' text is not displayed", async () => {
      await productsPage.expectHeaderTitleNotToHaveText("Products");
    });
  });
});
