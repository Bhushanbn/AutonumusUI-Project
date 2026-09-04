import { Page, Locator, expect } from "@playwright/test";

export class CartPage {
  readonly page: Page;
  readonly checkoutButton: Locator;
  readonly cartItems: Locator;

  constructor(page: Page) {
    this.page = page;
    this.checkoutButton = page.getByRole("button", { name: "Checkout" });
    this.cartItems = page.locator(".cart_item");
  }

  async expectDisplayed() {
    await expect(this.page).toHaveURL(/cart\.html/);
  }

  cartItem(productName: string): Locator {
    return this.cartItems.filter({ hasText: productName });
  }

  async isProductInCart(productName: string): Promise<boolean> {
    return this.cartItem(productName).isVisible();
  }

  async checkout() {
    await this.checkoutButton.click();
  }
}
