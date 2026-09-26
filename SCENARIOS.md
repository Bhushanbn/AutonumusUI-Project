# Test Scenarios (source: plan.md — Rename Products header to Inventory #3)

## AC1: User can log in with valid credentials and land on the products page.
### AC1-S1: Successful login with valid credentials
- Preconditions:
  - User is on the login page.
- User Actions:
  1. Enter valid username in the "Username" input field.
  2. Enter valid password in the "Password" input field.
  3. Click the "Login" button.
- Expected Validation Checkpoints:
  1. User is successfully authenticated and redirected away from the login page.
  2. The main inventory page is loaded and main layout elements are visible.
- Linked Acceptance Criteria: AC1 — "User can log in with valid credentials and land on the products page."

## AC2: Page header should be renamed from "Products" to "Inventory".
### AC2-S1: Verify page header displays "Inventory"
- Preconditions:
  - User is logged in and on the main products/inventory page.
- User Actions:
  1. Observe the primary page header in the top section of the page.
- Expected Validation Checkpoints:
  1. The page header heading explicitly displays the text "Inventory".
- Linked Acceptance Criteria: AC2 — "Page header should be renamed from "Products" to "Inventory"."

## AC3: The old "Products" header should not be displayed.
### AC3-S1: Verify "Products" header is absent from page header area
- Preconditions:
  - User is logged in and on the main products/inventory page.
- User Actions:
  1. Inspect the primary page header and title area.
- Expected Validation Checkpoints:
  1. The text "Products" is not displayed as the primary page title/header.
- Linked Acceptance Criteria: AC3 — "The old "Products" header should not be displayed."
