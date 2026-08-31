## RULE-demo-invite-resolution

Which screen the invitee lands on. The outcome column is `state`, so this is a
resolution table: the region walk proves the cross product total, and every
outcome is a state with a face on the board.

**Inputs:** linkAge: {fresh, expired}, account: {none, locked}
**Hit policy:** UNIQUE

| linkAge | account | state                       |
| ------- | ------- | --------------------------- |
| fresh   | -       | STATE-demo-roster-populated |
| expired | none    | STATE-demo-roster-empty     |
| expired | locked  | STATE-demo-invite-nowhere   |
