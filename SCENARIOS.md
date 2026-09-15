# Test Scenarios (source: plan.md — Add to cart & checkout flow #1)

## AC1: User can log in with valid credentials and land on the products page.
### AC1-S1: Log in successfully with valid credentials
- Preconditions:
  - User is on the login page
- User Actions:
  1. Enter a valid username into the Username field
  2. Enter a valid password into the Password field
  3. Click the "Login" button
- Expected Validation Checkpoints:
  1. User is redirected to the Products page
  2. The page title or header displays "Products"
- Linked Acceptance Criteria: AC1 — "User can log in with valid credentials and land on the products page."

## AC2: An invalid login shows an error and does not navigate away.
### AC2-S1: Attempt login with invalid credentials
- Preconditions:
  - User is on the login page
- User Actions:
  1. Enter an invalid username into the Username field
  2. Enter an invalid password into the Password field
  3. Click the "Login" button
- Expected Validation Checkpoints:
  1. An error message is displayed on the page indicating invalid credentials
  2. User remains on the login page and is not navigated to the products page
- Linked Acceptance Criteria: AC2 — "An invalid login shows an error and does not navigate away."

## AC3: User can add "Sauce Labs Backpack" to the cart.
### AC3-S1: Add "Sauce Labs Backpack" to cart from the products page
- Preconditions:
  - User is logged in and on the products page
- User Actions:
  1. Locate the product item "Sauce Labs Backpack"
  2. Click the "Add to cart" button associated with "Sauce Labs Backpack"
- Expected Validation Checkpoints:
  1. The shopping cart badge count updates to display "1"
  2. The "Add to cart" button for "Sauce Labs Backpack" changes to a "Remove" button
- Linked Acceptance Criteria: AC3 — "User can add "Sauce Labs Backpack" to the cart."

## AC4: User can complete checkout and see the confirmation message.
### AC4-S1: Complete checkout process for item in cart
- Preconditions:
  - User is logged in
  - "Sauce Labs Backpack" has been added to the cart
- User Actions:
  1. Click the shopping cart icon to view the cart
  2. Click the "Checkout" button
  3. Enter a first name into the "First Name" field
  4. Enter a last name into the "Last Name" field
  5. Enter a postal code into the "Zip/Postal Code" field
  6. Click the "Continue" button
  7. Click the "Finish" button on the checkout overview page
- Expected Validation Checkpoints:
  1. Order confirmation header or text (e.g., "Thank you for your order!") is displayed on the page
- Linked Acceptance Criteria: AC4 — "User can complete checkout and see the confirmation message."
