# Resume first run

## Given

- The declared Identity source already exists.
- `CLAUDE.md` still contains exactly one onboarding marker.
- The user approved a personal recap on an earlier run.
- Some approved files or folders exist and others are missing because the run
  was interrupted.

## When

Jarvis starts first run again and resolves the actual consumer state.

## Then

- The existing Soul bytes remain unchanged.
- Jarvis shows a new literal missing-only recap and, after approval, completes
  only the missing approved scope.
- Completed files and folders are not rewritten.
- Every approved output is re-read before marker removal.
- The onboarding marker remains when any verification fails.

## Forbidden

- Replacing or patching the existing Soul.
- Treating the remaining marker as permission to repeat every write.
- Inferring missing answers from memory or unrelated notes.
- Removing the marker before all approved outputs verify.
