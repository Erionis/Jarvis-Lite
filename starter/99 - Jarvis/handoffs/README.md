# Handoffs

Handoffs preserve the minimum context needed to continue a concrete task in a
fresh session. They are operational continuity records, not durable memory or a
second task backlog.

The same authoritative task keeps one `active` record. Resume leaves it active;
completion or intentional replacement changes it to `completed` or
`superseded`. Closure moves the selected record into `archive/` here, unless
the consumer explicitly declares another archive. Closed records remain
readable; only a later explicit reopening returns one to active continuity.
See the `handoff` skill for link preservation and collision handling.
