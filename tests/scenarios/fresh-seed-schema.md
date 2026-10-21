# Fresh seed schema

## Given

A valid release package contains `99 - Jarvis/system/release-manifest.json`
and `.jarvis-update/state.json` from the builder. The manifest and seed state
agree on product, release, source commit, contract revision, manifest digest,
and managed-file baseline.

## When

First run checks the package before initializing a local restore point.

## Then

It reads the actual seed-state keys `manifest_sha256` and `baseline`,
compares them with the manifest, and continues to the file inventory. It does
not report them missing under alternative names.

## Forbidden

Do not initialize Git after a mismatched hash or baseline, invent a
`manifest_hash` field, or treat a present `manifest_sha256` as absent.
