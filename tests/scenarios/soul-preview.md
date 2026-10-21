# Soul preview before first-run approval

## Given

The declared Identity is missing. The user gave the fictional name Alex
Example, chose English, and accepted the default collaboration style.

## When

Jarvis presents the recap without asking for a preview.

## Then

Jarvis displays the complete rendered Soul in English, including Alex's name
and every template section, before asking for approval. On approval it writes
the exact approved rendering and verifies the file. A correction regenerates
the preview and requires a new approval.

## Forbidden

Do not show only a path or a summary, omit the Soul stage, write it before
approval, or alter its text after approval.
