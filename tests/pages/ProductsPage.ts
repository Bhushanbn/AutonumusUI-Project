import type { Locator, Page } from "@playwright/test";

export class ProductsPage {
  readonly page: Page;
  readonly title: Locator;
  readonly inventoryItems: Locator;
  readonly cartBadge: Locator;
  readonly cartLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.getByText("Products", { exact: true });
    this.inventoryItems = page.locator(".inventory_item");
    this.cartBadge = page.getByTestId("shopping-cart-badge");
    this.cartLink = page.getByTestId("shopping-cart-link");
  }

  productAddToCartButton(productName: string): Locator {
    return this.page
      .locator(".inventory_item")
      .filter({ hasText: productName })
      .getByRole("button", { name: "Add to cart" });
  }

  productRemoveButton(productName: string): Locator {
    return this.page
      .locator(".inventory_item")
      .filter({ hasText: productName })
      .getByRole("button", { name: "Remove" });
  }

  async addProductToCart(productName: string): Promise<void> {
    await this.productAddToCartButton(productName).click();
  }

  async getCartBadgeCount(): Promise<string | null> {
    return this.cartBadge.textContent();
  }

  async openCart(): Promise<void> {
    await this.cartLink.click();
  }
}
