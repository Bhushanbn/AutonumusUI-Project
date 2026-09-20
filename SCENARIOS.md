# Test Scenarios (source: plan.md — Rename Products header to Inventory #3)

## AC1: User can log in with valid credentials and land on the products page.
### AC1-S1: Successful login with valid credentials
- Preconditions:
  - User is on the application Login page.
  - User possesses valid credentials.
- User Actions:
  1. Type valid username into the "Username" input field.
  2. Type valid password into the "Password" input field.
  3. Click the "Login" button.
- Expected Validation Checkpoints:
  1. The login form disappears and the user is redirected to the main dashboard/inventory URL.
  2. Main page content (inventory list/grid) is rendered and visible.
- Linked Acceptance Criteria: AC1 — "User can log in with valid credentials and land on the products page."

## AC2: Page header should be renamed from "Products" to "Inventory".
### AC2-S1: Verify primary page header text is "Inventory"
- Preconditions:
  - User is logged in and located on the main product/inventory page.
- User Actions:
  1. Locate the main header at the top of the page content area.
- Expected Validation Checkpoints:
  1. The header text reads exactly "Inventory".
- Linked Acceptance Criteria: AC2 — "Page header should be renamed from "Products" to "Inventory"."

## AC3: The old "Products" header should not be displayed.
### AC3-S1: Verify old "Products" header is absent
- Preconditions:
  - User is logged in and located on the main product/inventory page.
- User Actions:
  1. Inspect the main header area of the page.
- Expected Validation Checkpoints:
  1. The text "Products" is not visible within the main page header area.
- Linked Acceptance Criteria: AC3 — "The old "Products" header should not be displayed."
