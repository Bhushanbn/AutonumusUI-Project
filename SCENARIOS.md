# Test Scenarios (source: plan.md — Add to cart & checkout flow #1)

## AC1: User can log in with valid credentials and land on the products page.
### AC1-S1: Successful login with valid credentials navigates to products page
- Preconditions:
  - User is on the login page (application start URL).
  - A valid username/password pair is available for the application under test.
- User Actions:
  1. Enter a valid username into the "Username" field.
  2. Enter a valid password into the "Password" field.
  3. Click the "Login" button.
- Expected Validation Checkpoints:
  1. The user is navigated away from the login page.
  2. The products page is displayed (e.g. page heading/title such as "Products" is visible).
  3. No error message is shown.
- Linked Acceptance Criteria: AC1 — "User can log in with valid credentials and land on the products page."

## AC2: An invalid login shows an error and does not navigate away.
### AC2-S1: Invalid credentials show an error message and user remains on login page
- Preconditions:
  - User is on the login page (application start URL).
  - No valid session is active.
- User Actions:
  1. Enter an invalid username and/or invalid password into the "Username" and "Password" fields.
  2. Click the "Login" button.
- Expected Validation Checkpoints:
  1. An error message is displayed to the user indicating the login failed.
  2. The user remains on the login page (URL/page state unchanged).
  3. The products page is not displayed.
- Linked Acceptance Criteria: AC2 — "An invalid login shows an error and does not navigate away."

### AC2-S2: Empty credentials show an error message and user remains on login page
- Preconditions:
  - User is on the login page (application start URL).
- User Actions:
  1. Leave the "Username" and "Password" fields empty.
  2. Click the "Login" button.
- Expected Validation Checkpoints:
  1. An error message is displayed indicating required fields/login failure.
  2. The user remains on the login page.
- Linked Acceptance Criteria: AC2 — "An invalid login shows an error and does not navigate away."

## AC3: User can add "Sauce Labs Backpack" to the cart.
### AC3-S1: Add "Sauce Labs Backpack" to cart from products page
- Preconditions:
  - User is logged in with valid credentials.
  - User is on the products page.
  - The cart is empty.
- User Actions:
  1. Locate the product item named "Sauce Labs Backpack" on the products page.
  2. Click the "Add to cart" button associated with "Sauce Labs Backpack".
- Expected Validation Checkpoints:
  1. The cart icon/badge updates to show a count of 1 item.
  2. The "Add to cart" button for "Sauce Labs Backpack" changes to a "Remove" button (or equivalent added-state indicator).
  3. Navigating to the cart page shows "Sauce Labs Backpack" listed as a cart item.
- Linked Acceptance Criteria: AC3 — "User can add \"Sauce Labs Backpack\" to the cart."

## AC4: User can complete checkout and see the confirmation message.
### AC4-S1: Complete checkout end-to-end and see confirmation message
- Preconditions:
  - User is logged in with valid credentials.
  - "Sauce Labs Backpack" has already been added to the cart.
- User Actions:
  1. Navigate to the cart page.
  2. Click the "Checkout" button.
  3. Enter valid checkout information (first name, last name, postal code) into the respective fields.
  4. Click the "Continue" button.
  5. Review the order summary on the checkout overview page.
  6. Click the "Finish" button.
- Expected Validation Checkpoints:
  1. After clicking "Continue", the checkout overview page is displayed showing "Sauce Labs Backpack" and order totals.
  2. After clicking "Finish", a confirmation message (e.g. "Thank you for your order!" or equivalent success text) is displayed.
  3. The checkout flow completes without errors at any step.
- Linked Acceptance Criteria: AC4 — "User can complete checkout and see the confirmation message."
