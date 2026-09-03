# Test Scenarios (source: plan.md — Add to cart & checkout flow #1)

## AC1: User can log in with valid credentials and land on the products page.
### AC1-S1: Successful login with valid credentials navigates to the products page
- Preconditions:
  - Application under test is the Sauce Labs demo site login page (e.g. https://www.saucedemo.com/), user is logged out.
  - A valid standard user account exists (e.g. username "standard_user", password "secret_sauce").
- User Actions:
  1. Navigate to the login page.
  2. Enter "standard_user" into the "Username" field.
  3. Enter "secret_sauce" into the "Password" field.
  4. Click the "Login" button.
- Expected Validation Checkpoints:
  1. The browser navigates away from the login page.
  2. The page heading/title "Products" is visible.
  3. A list of product items is visible on the page.
  4. No error message is displayed.
- Linked Acceptance Criteria: 1. User can log in with valid credentials and land on the products page.

## AC2: An invalid login shows an error and does not navigate away.
### AC2-S1: Invalid credentials display an error message and keep user on the login page
- Preconditions:
  - Application under test is the Sauce Labs demo site login page, user is logged out.
- User Actions:
  1. Navigate to the login page.
  2. Enter "invalid_user" into the "Username" field.
  3. Enter "wrong_password" into the "Password" field.
  4. Click the "Login" button.
- Expected Validation Checkpoints:
  1. An error message is visible on the page (e.g. text indicating "Username and password do not match any user" or similar login failure message).
  2. The user remains on the login page (URL/page does not change to the products page).
  3. The "Username" and "Password" fields remain visible.
- Linked Acceptance Criteria: 2. An invalid login shows an error and does not navigate away.

### AC2-S2: Empty credentials submission displays a required-field error
- Preconditions:
  - Application under test is the Sauce Labs demo site login page, user is logged out.
- User Actions:
  1. Navigate to the login page.
  2. Leave the "Username" field empty.
  3. Leave the "Password" field empty.
  4. Click the "Login" button.
- Expected Validation Checkpoints:
  1. An error message is visible indicating the username is required.
  2. The user remains on the login page.
- Linked Acceptance Criteria: 2. An invalid login shows an error and does not navigate away.

## AC3: User can add "Sauce Labs Backpack" to the cart.
### AC3-S1: Adding "Sauce Labs Backpack" to the cart updates the cart indicator
- Preconditions:
  - User is logged in with valid credentials ("standard_user" / "secret_sauce") and is on the products page.
- User Actions:
  1. Locate the product listing titled "Sauce Labs Backpack".
  2. Click the "Add to cart" button associated with "Sauce Labs Backpack".
- Expected Validation Checkpoints:
  1. The cart icon/badge shows a count of "1".
  2. The button for "Sauce Labs Backpack" changes from "Add to cart" to "Remove", confirming the item was added.
- Linked Acceptance Criteria: 3. User can add "Sauce Labs Backpack" to the cart.

### AC3-S2: Added item appears in the cart page
- Preconditions:
  - User is logged in with valid credentials and is on the products page.
  - "Sauce Labs Backpack" has been added to the cart.
- User Actions:
  1. Click the cart icon to open the cart page.
- Expected Validation Checkpoints:
  1. The cart page displays an item titled "Sauce Labs Backpack".
  2. The item quantity is "1".
- Linked Acceptance Criteria: 3. User can add "Sauce Labs Backpack" to the cart.

## AC4: User can complete checkout and see the confirmation message.
### AC4-S1: Completing checkout with valid information shows the order confirmation message
- Preconditions:
  - User is logged in with valid credentials and is on the products page.
  - "Sauce Labs Backpack" has been added to the cart.
- User Actions:
  1. Click the cart icon to open the cart page.
  2. Click the "Checkout" button.
  3. Enter "Jane" into the "First Name" field.
  4. Enter "Doe" into the "Last Name" field.
  5. Enter "12345" into the "Zip/Postal Code" field.
  6. Click the "Continue" button.
  7. Verify the order summary/overview page shows the "Sauce Labs Backpack" item.
  8. Click the "Finish" button.
- Expected Validation Checkpoints:
  1. A confirmation message is visible (e.g. "Thank you for your order!").
  2. Confirmation/completion text such as "Your order has been dispatched" or equivalent is visible.
  3. A visual confirmation element (e.g. checkmark/pony express image) is present on the page, indicating order completion.
- Linked Acceptance Criteria: 4. User can complete checkout and see the confirmation message.

### AC4-S2: Checkout information step requires mandatory fields
- Preconditions:
  - User is logged in with valid credentials and is on the products page.
  - "Sauce Labs Backpack" has been added to the cart.
- User Actions:
  1. Click the cart icon to open the cart page.
  2. Click the "Checkout" button.
  3. Leave the "First Name", "Last Name", and "Zip/Postal Code" fields empty.
  4. Click the "Continue" button.
- Expected Validation Checkpoints:
  1. An error message is visible indicating the first name is required.
  2. The user remains on the checkout information page (does not proceed to the order overview/confirmation).
- Linked Acceptance Criteria: 4. User can complete checkout and see the confirmation message.
