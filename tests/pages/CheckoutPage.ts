import type { Locator, Page } from "@playwright/test";

export class CheckoutPage {
  readonly page: Page;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly postalCodeInput: Locator;
  readonly continueButton: Locator;
  readonly finishButton: Locator;
  readonly errorMessage: Locator;
  readonly summaryItems: Locator;
  readonly completeHeader: Locator;
  readonly completeText: Locator;
  readonly ponyExpressImage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.firstNameInput = page.getByPlaceholder("First Name");
    this.lastNameInput = page.getByPlaceholder("Last Name");
    this.postalCodeInput = page.getByPlaceholder("Zip/Postal Code");
    this.continueButton = page.getByRole("button", { name: "Continue" });
    this.finishButton = page.getByRole("button", { name: "Finish" });
    this.errorMessage = page.getByTestId("error");
    this.summaryItems = page.locator(".cart_item");
    this.completeHeader = page.getByText("Thank you for your order!");
    this.completeText = page.getByText(
      "Your order has been dispatched, and will arrive just as fast as the pony can get there!"
    );
    this.ponyExpressImage = page.getByAltText("Pony Express");
  }

  async fillInformation(
    firstName: string,
    lastName: string,
    postalCode: string
  ): Promise<void> {
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.postalCodeInput.fill(postalCode);
  }

  async continueToOverview(): Promise<void> {
    await this.continueButton.click();
  }

  async finish(): Promise<void> {
    await this.finishButton.click();
  }

  itemInSummary(productName: string): Locator {
    return this.summaryItems.filter({ hasText: productName });
  }

  async getErrorText(): Promise<string | null> {
    return this.errorMessage.textContent();
  }
}
