import { Page, Locator, expect } from "@playwright/test";

export class ProductsPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly cartBadge: Locator;
  readonly cartLink: Locator;
  readonly inventoryList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator(".title");
    this.cartBadge = page.locator(".shopping_cart_badge");
    this.cartLink = page.locator(".shopping_cart_link");
    this.inventoryList = page.locator(".inventory_list");
  }

  async expectDisplayed() {
    await expect(this.page).toHaveURL(/inventory\.html/);
    await expect(this.pageTitle).toBeVisible();
  }

  async expectHeaderTitle(expectedText: string) {
    await expect(this.pageTitle).toBeVisible();
    await expect(this.pageTitle).toHaveText(expectedText);
  }

  async expectHeaderTitleNotToHaveText(unexpectedText: string) {
    await expect(this.pageTitle).not.toHaveText(unexpectedText);
  }

  async expectInventoryListVisible() {
    await expect(this.inventoryList).toBeVisible();
  }

  private productItem(productName: string): Locator {
    return this.page.locator(".inventory_item", { hasText: productName });
  }

  addToCartButton(productName: string): Locator {
    return this.productItem(productName).getByRole("button", { name: "Add to cart" });
  }

  removeButton(productName: string): Locator {
    return this.productItem(productName).getByRole("button", { name: "Remove" });
  }

  async addProductToCart(productName: string) {
    await this.addToCartButton(productName).click();
  }

  async getCartBadgeCount(): Promise<string> {
    return (await this.cartBadge.textContent()) ?? "";
  }

  async isCartBadgeVisible(): Promise<boolean> {
    return this.cartBadge.isVisible();
  }

  async expectCartBadgeCount(count: string) {
    await expect(this.cartBadge).toBeVisible();
    await expect(this.cartBadge).toHaveText(count);
  }

  async expectRemoveButtonVisible(productName: string) {
    await expect(this.removeButton(productName)).toBeVisible();
  }

  async goToCart() {
    await this.cartLink.click();
  }
}
