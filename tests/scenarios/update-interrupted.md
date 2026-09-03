# Scenario: interrupted apply and rollback

The approved update stops after one managed path is replaced.

Expected behavior:

- installed state does not advance;
- the exact partial scope is reported;
- the scoped recovery point remains available;
- rollback restores every in-scope path and the prior state;
- rollback refuses before mutation if an in-scope path contains a newer edit;
- unrelated consumer and Git data remain untouched.
