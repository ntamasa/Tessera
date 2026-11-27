<!-- Adapted from mattpocock/skills (skills/engineering/tdd), MIT License, Copyright (c) Matt Pocock. -->

# Good and bad tests

The integration and UI examples are TypeScript, the unit test examples Java. Apply the same rules in the project's own language and test framework.

## Good tests

**Integration-style:** test through real interfaces, not mocks of internal parts.

```typescript
// GOOD: tests observable behavior
test("user can checkout with valid cart", async () => {
  const cart = createCart();
  cart.add(product);
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});
```

Characteristics:

- Tests behavior users or callers care about
- Uses the public interface only
- Survives internal refactors
- Describes WHAT, not HOW
- One logical assertion per test
- The name reads like a line of the ticket

## Happy path and negative tests

Both are required for every behavior. A suite that only proves the feature works when everything is right proves nothing about what happens when something is wrong, and that's where most bugs live.

- **Happy path:** valid input, the expected result. Include the values just inside each limit (e.g. the shortest and longest allowed name, quantity 1 and the maximum).
- **Negative:** each way the behavior can be used wrongly or can fail:
  - invalid input: wrong format, wrong type, out of range, too long
  - missing or empty input: required field absent, empty string, empty list
  - values just outside each limit (e.g. quantity 0 and maximum + 1)
  - not found: unknown id, deleted item
  - conflicts and rules: duplicates, invalid state (e.g. paying an already paid order)
  - failures at system boundaries: the payment provider declines, the database is down
- **A negative test checks the exact failure:** the error type or status, the message the ticket specifies, and that nothing changed (checked through the interface, e.g. the cart still holds its items). "It throws" or "it returns 400" alone isn't enough.
- **One failure case per test.** Don't combine several invalid inputs in one test: when it fails, you can't tell which case broke.
- Name negative tests after the rule they protect: "rejects checkout with an empty cart", not "checkout fails".

```typescript
// GOOD: happy path, including the boundary values just inside the limit
test("user can checkout with valid cart", async () => {
  const result = await checkout(cartWith({ quantity: 1 }), validCard);
  expect(result.status).toBe("confirmed");
});

test("accepts the maximum quantity of 99", async () => {
  const result = await checkout(cartWith({ quantity: 99 }), validCard);
  expect(result.status).toBe("confirmed");
});

// GOOD: negative tests, one failure each, exact error, nothing changed
test("rejects checkout with an empty cart", async () => {
  await expect(checkout(emptyCart(), validCard)).rejects.toThrow("Cart is empty");
});

test("rejects a quantity of 100", async () => {
  await expect(checkout(cartWith({ quantity: 100 }), validCard)).rejects.toThrow("Quantity must be between 1 and 99");
});

test("keeps the cart when the card is declined", async () => {
  const cart = cartWith({ quantity: 1 });
  await expect(checkout(cart, declinedCard)).rejects.toThrow("Your card was declined");
  expect(cart.items).toHaveLength(1);
});

// BAD: only checks that something failed, and mixes two failure cases
test("checkout fails on bad input", async () => {
  await expect(checkout(emptyCart(), declinedCard)).rejects.toThrow();
});
```

## Bad tests

**Implementation-detail tests:** coupled to internal structure.

```typescript
// BAD: tests implementation details
test("checkout calls paymentService.process", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});
```

Red flags:

- Mocking internal collaborators
- Testing private methods
- Asserting on call counts or order
- Test breaks when refactoring without a behavior change
- Test name describes HOW, not WHAT
- Checking through a side channel instead of the interface

```typescript
// BAD: bypasses the interface to check
test("createUser saves to database", async () => {
  await createUser({ name: "Alice" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
  expect(row).toBeDefined();
});

// GOOD: checks through the interface
test("createUser makes user retrievable", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```

**Tautological tests:** the expected value restates the implementation, so the test passes by construction.

```typescript
// BAD: expected value is recomputed the way the code computes it
test("calculateTotal sums line items", () => {
  const items = [{ price: 10 }, { price: 5 }];
  const expected = items.reduce((sum, i) => sum + i.price, 0);
  expect(calculateTotal(items)).toBe(expected);
});

// GOOD: expected value is an independent, known literal
test("calculateTotal sums line items", () => {
  expect(calculateTotal([{ price: 10 }, { price: 5 }])).toBe(15);
});
```

## Unit tests

A unit test checks one unit of behavior through its public interface, in plain code: build the objects directly, with no framework context, no database and no network. If the behavior needs any of those, it's an integration test at the seam the tickets name.

### Good unit tests

**Isolated and deterministic:** one behavior through the public interface, with time, randomness and system boundaries injected.

```java
// GOOD: one behavior, given / when / then, time injected
class CheckoutTest {

    private final Clock clock = Clock.fixed(Instant.parse("2026-01-15T10:00:00Z"), ZoneOffset.UTC);
    private final FakePaymentGateway payments = new FakePaymentGateway();
    private final Checkout checkout = new Checkout(payments, clock);

    @Test
    @DisplayName("confirms the order when the cart is valid")
    void confirmsOrderForValidCart() {
        // given
        Cart cart = new Cart();
        cart.add(new Product("Coffee grinder", new BigDecimal("49.90")));

        // when
        Order order = checkout.pay(cart, PaymentMethod.CARD);

        // then
        assertThat(order.status()).isEqualTo(OrderStatus.CONFIRMED);
    }

    @Test
    @DisplayName("stamps the order with the checkout time")
    void stampsOrderWithCheckoutTime() {
        Cart cart = cartWith("Coffee grinder", "49.90");

        Order order = checkout.pay(cart, PaymentMethod.CARD);

        assertThat(order.placedAt()).isEqualTo(Instant.parse("2026-01-15T10:00:00Z"));
    }

    @Nested
    @DisplayName("when the cart is empty")
    class EmptyCart {

        @Test
        @DisplayName("rejects checkout")
        void rejectsCheckout() {
            assertThatThrownBy(() -> checkout.pay(new Cart(), PaymentMethod.CARD))
                    .isInstanceOf(EmptyCartException.class)
                    .hasMessage("Cart is empty");
        }
    }
}
```

**Table-driven:** one rule, several cases, every expected value a literal.

```java
// GOOD: one rule, a table of known cases
@ParameterizedTest(name = "{0} × 10.00 = {1}")
@CsvSource({
        "1, 10.00",
        "3, 30.00",
        "0, 0.00",
})
@DisplayName("cart total is quantity times price")
void cartTotalIsQuantityTimesPrice(int quantity, BigDecimal expectedTotal) {
    Cart cart = new Cart();
    cart.add(new Product("Paper filter", new BigDecimal("10.00")), quantity);

    assertThat(cart.total()).isEqualByComparingTo(expectedTotal);
}
```

Characteristics:

- Given / when / then blocks separated by a blank line, one "when" per test
- The name says the behavior, as a sentence from the ticket
- Tests that share a situation are grouped ("when the cart is empty")
- Several cases of one rule go in one table-driven test
- Each test builds its own fixtures: no shared mutable state, no dependence on test order
- Time and randomness are injected and fixed in the test
- System boundaries are replaced by small fakes or mocks, passed in through the constructor
- Uses the most specific assertion available, so a failure shows the actual value
- Runs in milliseconds, with no framework, database or network

### Bad unit tests

**Implementation-detail tests:** coupled to how the unit works inside.

```java
// BAD: mocks an internal collaborator and asserts on calls
@Test
void payCallsPriceCalculator() {
    PriceCalculator calculator = mock(PriceCalculator.class);
    new Checkout(calculator, payments, clock).pay(cart, PaymentMethod.CARD);
    verify(calculator, times(1)).calculate(cart);
}

// BAD: tests a private method through reflection
@Test
void roundsPrice() throws Exception {
    Method round = Checkout.class.getDeclaredMethod("round", BigDecimal.class);
    round.setAccessible(true);
    assertThat(round.invoke(checkout, new BigDecimal("1.005"))).isEqualTo(new BigDecimal("1.01"));
}
```

Red flags:

- Verifying calls on anything that isn't a system boundary
- Reflection, or widening a method's visibility just for a test
- Loops, conditions or calculations inside a test
- Sleeping, reading the real clock, unseeded randomness
- Generic true/false assertions where a specific one would describe the failure
- A framework context, database or network in a unit test
- One test checking several unrelated behaviors
- A behavior with only a happy-path test, or only negative tests
- A negative test that only checks that something failed, not which error

**Non-deterministic tests:** depend on the real clock or on waiting.

```java
// BAD: real time and a fixed sleep
@Test
void orderExpires() throws InterruptedException {
    Order order = checkout.pay(cart, PaymentMethod.CARD);
    Thread.sleep(2000);
    assertTrue(order.isExpired(LocalDateTime.now()));
}

// GOOD: time is injected and moved explicitly
@Test
@DisplayName("an order expires 30 minutes after it was placed")
void orderExpiresAfterThirtyMinutes() {
    Order order = checkout.pay(cart, PaymentMethod.CARD);

    assertThat(order.isExpiredAt(Instant.parse("2026-01-15T10:30:01Z"))).isTrue();
}
```

**Tautological tests:** the expected value restates the implementation, so the test passes by construction.

```java
// BAD: a loop recomputes the expected value the way the code does
@Test
void totalOfCart() {
    BigDecimal expected = BigDecimal.ZERO;
    for (Product p : cart.products()) {
        expected = expected.add(p.price());
    }
    assertThat(cart.total()).isEqualTo(expected);
}

// GOOD: expected value is an independent, known literal
@Test
@DisplayName("cart total sums the item prices")
void cartTotalSumsItemPrices() {
    Cart cart = cartWith("Coffee grinder", "49.90", "Paper filter", "10.00");

    assertThat(cart.total()).isEqualByComparingTo("59.90");
}
```

**Framework-bound tests:** start the whole application to test plain logic.

```java
// BAD: boots the framework context for a calculation
@SpringBootTest
class CartTotalTest {
    @Autowired Cart cart;
    // ...
}

// GOOD: plain objects, built directly
class CartTest {
    private final Cart cart = new Cart();
    // ...
}
```

## Where expected values come from

From the tickets: their requirements, acceptance criteria and worked examples. If the tickets don't settle a value, it's a gap: ask, don't take it from the code.

## UI tests

The seam of a screen is what the user sees and does: the rendered output and the user's actions on it. Not component internals, state fields or private methods.

```typescript
// GOOD: tests a state through what the user sees
test("cart shows the empty state when it has no items", async () => {
  render(Cart, { items: [] });
  expect(screen.getByText("Your cart is empty")).toBeVisible();
});

// BAD: tests the component's internals
test("cart sets isEmpty to true", () => {
  const component = new CartComponent();
  component.items = [];
  expect(component.isEmpty).toBe(true);
});
```

- Find elements by role, label or visible text, the way a user would, not by CSS class or test-only structure.
- Each screen state and each interaction (action → result) in the tickets is a candidate test.
- Don't assert on styling (colors, spacing, fonts).

### Playwright

**Locators are always readable and user-facing.** Never use CSS or XPath selectors, ids, classes, `page.$`, `page.$$`, `page.$eval`, or `document.querySelector` / `getElementById` inside `page.evaluate`. Pick the first locator that matches the element uniquely:

1. `getByRole` with its accessible name, e.g. `getByRole("button", { name: "Pay now" })`
2. `getByLabel` (form fields)
3. `getByPlaceholder`
4. `getByText` (non-interactive content)
5. `getByAltText`, `getByTitle`
6. `getByTestId`, only when nothing user-facing is unique. The `data-testid` is then part of the tickets' contract.

Narrow down by chaining and filtering (`getByRole("listitem").filter({ hasText: "Coffee grinder" })`), not with `nth()`, unless the position is the behavior.

**One feature, three files:**

```
e2e/checkout/
  checkout.locators.ts   every locator of the feature, nothing else
  checkout.data.json     test data, only when needed
  checkout.spec.ts       the tests; imports the locators and the data
```

```typescript
// checkout.locators.ts
import type { Page } from "@playwright/test";

export const checkoutLocators = (page: Page) => ({
  cartItems: page.getByRole("list", { name: "Cart items" }).getByRole("listitem"),
  emptyCartMessage: page.getByText("Your cart is empty"),
  cardNumberInput: page.getByLabel("Card number"),
  payButton: page.getByRole("button", { name: "Pay now" }),
  confirmationHeading: page.getByRole("heading", { name: "Order confirmed" }),
  cardError: page.getByRole("alert"),
});
```

`checkout.data.json` (plain JSON, no comments):

```json
{
  "validCard": { "number": "4242 4242 4242 4242" },
  "declinedCard": { "number": "4000 0000 0000 0002", "error": "Your card was declined" },
  "product": { "name": "Coffee grinder", "price": "€49.90" }
}
```

```typescript
// checkout.spec.ts
import { test, expect } from "@playwright/test";
import { checkoutLocators } from "./checkout.locators";
import data from "./checkout.data.json";

test.describe("checkout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/cart?add=${encodeURIComponent(data.product.name)}`);
  });

  test("user can pay for a valid cart", async ({ page }) => {
    const checkout = checkoutLocators(page);

    await checkout.cardNumberInput.fill(data.validCard.number);
    await checkout.payButton.click();

    await expect(checkout.confirmationHeading).toBeVisible();
  });

  test("user sees an error when the card is declined", async ({ page }) => {
    const checkout = checkoutLocators(page);

    await checkout.cardNumberInput.fill(data.declinedCard.number);
    await checkout.payButton.click();

    await expect(checkout.cardError).toHaveText(data.declinedCard.error);
  });
});
```

- **Locators file:** only locators, named after what the user sees (`payButton`, not `btn2`). No actions, assertions or waits.
- **Data file:** only when the data is reused across tests or too big to read inline. A single short literal used once stays in the test.
- **Spec file:** one `test.describe` per feature, test names from the ticket, given / when / then blocks as in the unit tests section. Each test sets up its own state (`beforeEach`, API calls, seeded data) and never depends on another test or on test order.
- **Negative paths too:** every flow also gets its failure tests: the validation message the user sees, the error state, and that nothing was saved (e.g. the list is unchanged after a rejected form).
- **Web-first assertions only:** `await expect(locator).toBeVisible()`, `toHaveText`, `toHaveCount`, `toHaveURL`. They wait and retry. Never `expect(await locator.isVisible()).toBe(true)`.
- **No fixed waits:** never `page.waitForTimeout`. Locators and web-first assertions already wait.

```typescript
// BAD: unreadable selectors, element handles, manual checks, fixed waits
await page.locator("#card-number").fill("4242 4242 4242 4242");
await page.locator("div.checkout > form button.btn-primary").click();
await page.locator("//h1[text()='Order confirmed']").waitFor();
const error = await page.$(".error");
const id = await page.evaluate(() => document.getElementById("order-id")?.textContent);
await page.waitForTimeout(2000);
expect(await page.getByRole("alert").isVisible()).toBe(true);
```
