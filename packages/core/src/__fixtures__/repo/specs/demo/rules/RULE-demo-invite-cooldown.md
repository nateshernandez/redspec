## RULE-demo-invite-cooldown

**Inputs:** daysSinceInvite: number(0..), plan: {free, pro}
**Hit policy:** UNIQUE

| daysSinceInvite | plan | outcome |
| --------------- | ---- | ------- |
| [0..7)          | -    | blocked |
| [7..]           | free | allowed |
