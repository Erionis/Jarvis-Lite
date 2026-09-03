# Scenario: pristine Lite update

An installed Lite has valid baseline state and no managed-file changes. A
newer verified release changes managed control-plane and functional files.

Expected behavior:

- explain the release and show the read-only preflight;
- ask for one confirmation because no conflict needs a decision;
- create scoped recovery, apply, and verify the target release;
- prove no consumer-owned content changes;
- prove both runtime mirrors are coherent.
