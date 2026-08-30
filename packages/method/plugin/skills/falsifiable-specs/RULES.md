# Rule forms

One rule takes one form: the cheapest that can falsify it.

## 1. Type

```ts
// RULE-invoice-status-fields
type Invoice =
  | { status: "draft" }
  | { status: "sent"; sentAt: Date }
  | { status: "paid"; sentAt: Date; paidAt: Date; amount: Money }
```

Where a rule reduces to "these fields only exist together", this is the whole answer.

## 2. Machine table

```ts
// RULE-timesheet-lifecycle
export const timesheetMachine = {
  draft: { submit: "submitted" },
  submitted: { approve: "approved", reject: "draft" },
  approved: { invoice: "invoiced" },
  invoiced: {},
} as const satisfies Machine<TimesheetState, TimesheetEvent>
```

Two tests, not one. The shape test asserts every state is a key. The **model-based run** (`fast-check`'s `commands` / `modelRun`) generates random legal event sequences, applies each to the real implementation, and asserts observable state tracks the table after every event. The first proves the table is well-formed; only the second proves the code is the table.

## 3. Decision table

```md
## RULE-overtime-rate

**Inputs:** hours: number(0..), plan: {free, pro}
**Hit policy:** UNIQUE

| hours   | plan | multiplier | note     |
| ------- | ---- | ---------- | -------- |
| [0..40] | -    | 1          | straight |
| (40..]  | free | 1.5        | overtime |
| (40..]  | pro  | 2          | pro rate |
```

The `**Inputs:**` line declares the domains; `redspec check` walks every elementary region of the input space and reports a **gap** (no row matches) or an **overlap** (two rows match under UNIQUE). The test then does two jobs: drive the listed rows, and — via `representativeInputs(table)` — assert the implementation agrees with `decide(table, input)` in every region the table distinguishes, not only at the listed points.

Expected values come from an independent source: the person who owns the rule, a worked example, a known-good figure. A value computed the way the code computes it makes the test tautological.

## 4. Invariant

```ts
// INV-line-items-sum-to-total
test("line items always sum to the invoice total", () => {
  fc.assert(
    fc.property(arbInvoice(), (inv) => inv.lineItems.reduce(sum, 0) === inv.total)
  )
})
```

Good candidates read as a sentence about the domain that admits no exception. Where an exception exists, it is a Rule of another form.

## 0. Model

For approval-once, money conservation, tenant isolation, permission composition: a bounded model in TLA+, Quint, or Alloy, checked in CI. Exhaustive over a bounded space rather than random. Use it two or three times in a codebase; naming it is what makes the ladder serious.
