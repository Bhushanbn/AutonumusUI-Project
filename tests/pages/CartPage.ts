import type { Locator, Page } from "@playwright/test";

export class CartPage {
  readonly page: Page;
  readonly checkoutButton: Locator;
  readonly cartItems: Locator;

  constructor(page: Page) {
    this.page = page;
    this.checkoutButton = page.getByRole("button", { name: "Checkout" });
    this.cartItems = page.locator(".cart_item");
  }

  cartItemByName(productName: string): Locator {
    return this.cartItems.filter({ hasText: productName });
  }

  itemQuantity(productName: string): Locator {
    return this.cartItemByName(productName).getByTestId("item-quantity");
  }

  async goToCheckout(): Promise<void> {
    await this.checkoutButton.click();
  }
}
