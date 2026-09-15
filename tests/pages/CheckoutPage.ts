import { Page, Locator, expect } from "@playwright/test";

export class CheckoutPage {
  readonly page: Page;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly postalCodeInput: Locator;
  readonly continueButton: Locator;
  readonly finishButton: Locator;
  readonly completeHeader: Locator;
  readonly cartList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.firstNameInput = page.getByPlaceholder("First Name");
    this.lastNameInput = page.getByPlaceholder("Last Name");
    this.postalCodeInput = page.getByPlaceholder("Zip/Postal Code");
    this.continueButton = page.getByRole("button", { name: "Continue" });
    this.finishButton = page.getByRole("button", { name: "Finish" });
    this.completeHeader = page.locator(".complete-header");
    this.cartList = page.locator(".cart_list");
  }

  async fillInformation(firstName: string, lastName: string, postalCode: string) {
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.postalCodeInput.fill(postalCode);
  }

  async continueToOverview() {
    await this.continueButton.click();
  }

  async expectOverviewDisplayed() {
    await expect(this.page).toHaveURL(/checkout-step-two\.html/);
  }

  productInSummary(productName: string): Locator {
    return this.cartList.locator(".cart_item", { hasText: productName });
  }

  async finish() {
    await this.finishButton.click();
  }

  async expectConfirmationDisplayed(expectedText?: string) {
    await expect(this.page).toHaveURL(/checkout-complete\.html/);
    await expect(this.completeHeader).toBeVisible();
    if (expectedText) {
      await expect(this.completeHeader).toHaveText(expectedText);
    }
  }

  async getConfirmationText(): Promise<string> {
    return (await this.completeHeader.textContent()) ?? "";
  }
}
