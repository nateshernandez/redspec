---
name: implement-rules
description: "Pick a form for every stubbed rule and write it, so the logic goes red when it is wrong."
disable-model-invocation: true
---

# Implement rules

The skeleton stubbed every rule this feature owes, carrying the figures the domain expert gave. Pick the cheapest form that can fail for each, and write it.

Call the Skill tool with "falsifiable-specs" for the ladder. Read `docs/agents/redspec.md` for where rules live.

## Process

### 1. Take the stubs, then add what the codebase owes

`specs/<slug>/rules/` is the work list. Add rules the codebase already holds that this feature must agree with. Split any stub that needs two sentences.

The values in a stub are an **independent source**. Keep them.

### 2. Pick a form for each

Walk the ladder: model, type, machine table, decision table, invariant. Present rule → form as a table before writing any. **This is the HITL moment**: the user checks that a rule the business owns landed on a rung the business can read.

### 3. Write each rule

```
redspec new rule RULE-<name> --form table|machine|invariant|type
```

A decision table declares `**Inputs:**` and a hit policy; `redspec check` then proves it total and non-overlapping. A machine table gets a model-based run against the implementation, not only a shape test. A stub whose figures move during this step is an **amendment** to the interview — say so.

### 4. Prove each one can fail

Break the thing it describes and watch it go **red**, then restore. A rule never observed red is a rule you are guessing about. Record nothing about this in the repo.

### 5. Hunt what is unstated

Dispatch the `spec-adversary` agent. Work every finding: write the rule, or record in the Brief why the case cannot arise.

## Done when

Every stub has an implementation or a Brief line saying why it is out. `redspec check` reports no `table-gap`, `table-overlap`, or `table-parse`. Every rule was observed red once. `pnpm test` passes.

Then clear the window and run `/cut-slices`.
