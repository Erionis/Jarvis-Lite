# Handoffs

Handoffs preserve the minimum context needed to continue a concrete task in a
fresh session. They are operational continuity records, not durable memory or a
second task backlog.

The same authoritative task keeps one `active` record. Resume leaves it active;
completion or intentional replacement changes it to `completed` or
`superseded`. Closed records remain readable and are never removed automatically.
