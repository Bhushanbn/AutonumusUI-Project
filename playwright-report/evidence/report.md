# Test Execution Report

Generated: 2026-09-20T03:54:39.842Z

**Result: 9/11 passed** (2 failed, 0 skipped)

| Test | Status | Duration (ms) |
|---|---|---|
| AC1-S1: Log in successfully with valid credentials | ✅ pass | 6315 |
| AC2-S1: Attempt login with invalid credentials | ✅ pass | 6687 |
| AC3-S1: Add "Sauce Labs Backpack" to cart from the products page | ✅ pass | 6745 |
| AC4-S1: Complete checkout process for item in cart | ✅ pass | 7550 |
| AC3-S1: Add "Sauce Labs Backpack" to cart from the products page | ✅ pass | 6524 |
| AC4-S1: Complete checkout process for item in cart | ✅ pass | 7255 |
| AC1-S1: Successful login with valid credentials | ✅ pass | 3480 |
| AC2-S1: Verify primary page header text is 'Inventory' | ❌ fail | 7146 |
| AC3-S1: Verify old 'Products' header is absent | ❌ fail | 7278 |
| AC1-S1: Log in successfully with valid credentials | ✅ pass | 2342 |
| AC2-S1: Attempt login with invalid credentials | ✅ pass | 2209 |

## Failure details

### AC2-S1: Verify primary page header text is 'Inventory'

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoHaveText[2m([22m[32mexpected[39m[2m)[22m failed

Locator:  locator('.title')
Expected: [32m"Inventory"[39m
Received: [31m"Products"[39m
Timeout:  5000ms

Call log:
[2m  - Expect "toHaveText" with timeout 5000ms[22m
[2m  - waiting for locator('.title')[22m
[2m    13 × locator resolved to <span class="title" data-test="title">Products</span>[22m
[2m       - unexpected value "Products"[22m

```

### AC3-S1: Verify old 'Products' header is absent

```
Error: [2mexpect([22m[31mlocator[39m[2m).not.[22mtoHaveText[2m([22m[32mexpected[39m[2m)[22m failed

Locator:  locator('.title')
Expected: not [32m"Products"[39m
Received: [31m"[7mProducts[27m"[39m
Timeout:  5000ms

Call log:
[2m  - Expect "not toHaveText" with timeout 5000ms[22m
[2m  - waiting for locator('.title')[22m
[2m    14 × locator resolved to <span class="title" data-test="title">Products</span>[22m
[2m       - unexpected value "Products"[22m

```

## Other artifacts in this folder

- `playwright-report/` — Playwright's interactive HTML report
- `allure-report/` — Allure's HTML report (if generated)
- `test-results/` — raw traces/screenshots/videos for any failures
