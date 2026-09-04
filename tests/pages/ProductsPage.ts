import { Page, Locator, expect } from "@playwright/test";

export class ProductsPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly cartBadge: Locator;
  readonly cartLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator(".title", { hasText: "Products" });
    this.cartBadge = page.getByTestId("shopping-cart-badge");
    this.cartLink = page.getByTestId("shopping-cart-link");
  }

  async expectDisplayed() {
    await expect(this.page).toHaveURL(/inventory\.html/);
    await expect(this.pageTitle).toBeVisible();
    await expect(this.pageTitle).toHaveText("Products");
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

  async goToCart() {
    await this.cartLink.click();
  }
}
