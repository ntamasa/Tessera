<!-- Adapted from mattpocock/skills (skills/engineering/tdd), MIT License, Copyright (c) Matt Pocock. -->

# When to mock

Mock at **system boundaries** only:

- External APIs (payment, email, etc.)
- Databases (sometimes: prefer a real test database, e.g. the same engine in a container)
- Time and randomness
- File system (sometimes)

Which boundaries are mocked comes from the tickets, not decided mid-loop.

Don't mock:

- Your own classes or modules
- Internal collaborators
- Anything you control

## Designing for mockability

At system boundaries, design interfaces that are easy to mock.

**1. Use dependency injection**

Pass external dependencies in rather than creating them internally:

```typescript
// Easy to mock
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// Hard to mock
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

If the framework has a DI container (e.g. Spring, Angular), use it: inject the boundary through the constructor and replace it in tests with the framework's test support.

**2. Prefer SDK-style interfaces over generic fetchers**

Create one function per external operation instead of one generic function with conditional logic:

```typescript
// GOOD: each function is independently mockable
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch("/orders", { method: "POST", body: data }),
};

// BAD: mocking requires conditional logic inside the mock
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

The SDK approach means:

- Each mock returns one specific shape
- No conditional logic in test setup
- Easier to see which endpoints a test exercises
- Type safety per endpoint
