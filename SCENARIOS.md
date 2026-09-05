# Test Scenarios (source: plan.md — Add to cart & checkout flow #1)

## AC1: User can log in with valid credentials and land on the products page.
### AC1-S1: Successful login with valid credentials navigates to products page
- Preconditions:
  - User is logged out and starting on the login page.
  - A valid username/password pair is available for the application under test.
- User Actions:
  1. Navigate to the login page.
  2. Enter a valid username into the username field.
  3. Enter a valid password into the password field.
  4. Click the "Login" button.
- Expected Validation Checkpoints:
  1. The browser navigates away from the login page (URL changes to the products/inventory page).
  2. A page heading or title indicating "Products" (or equivalent products page identifier) is visible.
  3. No error message is displayed.
- Linked Acceptance Criteria: AC1 — "User can log in with valid credentials and land on the products page."

## AC2: An invalid login shows an error and does not navigate away.
### AC2-S1: Invalid credentials show error message and user stays on login page
- Preconditions:
  - User is logged out and starting on the login page.
- User Actions:
  1. Navigate to the login page.
  2. Enter an invalid username and/or password combination into the username and password fields.
  3. Click the "Login" button.
- Expected Validation Checkpoints:
  1. An error message is visible on the page (e.g. text indicating the username/password combination is incorrect).
  2. The user remains on the login page (URL/page does not change to the products page).
  3. The username and/or password input fields are still present and available for retry.
- Linked Acceptance Criteria: AC2 — "An invalid login shows an error and does not navigate away."

## AC3: User can add "Sauce Labs Backpack" to the cart.
### AC3-S1: Add "Sauce Labs Backpack" to cart from products page
- Preconditions:
  - User is logged in with valid credentials and is on the products page.
  - The "Sauce Labs Backpack" product is listed on the products page and not already in the cart.
- User Actions:
  1. Locate the "Sauce Labs Backpack" product listing on the products page.
  2. Click the "Add to cart" button associated with "Sauce Labs Backpack".
- Expected Validation Checkpoints:
  1. The "Add to cart" button for "Sauce Labs Backpack" changes to a "Remove" button (or equivalent state indicating it is in the cart).
  2. The shopping cart icon displays a badge/count of "1" (or incremented count reflecting the added item).
  3. Opening the cart shows "Sauce Labs Backpack" listed as a cart item.
- Linked Acceptance Criteria: AC3 — "User can add \"Sauce Labs Backpack\" to the cart."

## AC4: User can complete checkout and see the confirmation message.
### AC4-S1: Complete checkout flow and see confirmation message
- Preconditions:
  - User is logged in with valid credentials.
  - "Sauce Labs Backpack" (or at least one item) has already been added to the cart.
- User Actions:
  1. Click the shopping cart icon to view the cart.
  2. Verify the item is listed, then click the "Checkout" button.
  3. Enter required checkout information (first name, last name, postal code) into the corresponding fields.
  4. Click the "Continue" button.
  5. Review the order summary/overview page.
  6. Click the "Finish" button.
- Expected Validation Checkpoints:
  1. After clicking "Continue", the checkout overview page is displayed showing the item(s) and order total.
  2. After clicking "Finish", a confirmation message is visible (e.g. text such as "Thank you for your order" or equivalent completion heading).
  3. The user is navigated to a checkout complete/confirmation page.
- Linked Acceptance Criteria: AC4 — "User can complete checkout and see the confirmation message."
