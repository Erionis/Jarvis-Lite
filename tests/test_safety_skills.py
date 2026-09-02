from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILLS = ROOT / "skills"


class SafetySkillsTest(unittest.TestCase):
    def read(self, name: str) -> str:
        path = SKILLS / name / "SKILL.md"
        return path.read_text(encoding="utf-8") if path.is_file() else ""

    def read_card(self, name: str) -> str:
        path = SKILLS / name / "README.md"
        return path.read_text(encoding="utf-8") if path.is_file() else ""

    def read_scenario(self, name: str) -> str:
        path = ROOT / "tests" / "scenarios" / f"{name}.md"
        return path.read_text(encoding="utf-8") if path.is_file() else ""

    def test_doctor_is_evidence_based_and_read_only(self):
        text = self.read("jarvis-doctor")
        for phrase in ["read-only", "evidence", "unverifiable", "optional"]:
            self.assertIn(phrase, text)
        self.assertNotIn("apply the fix automatically", text.lower())

    def test_doctor_frontmatter_has_a_trigger_only_description(self):
        text = self.read("jarvis-doctor")
        frontmatter = text.split("---", 2)[1].strip().splitlines() if text else []
        fields = dict(line.split(": ", 1) for line in frontmatter)

        self.assertEqual(set(fields), {"name", "description"})
        self.assertEqual(fields["name"], "jarvis-doctor")
        self.assertTrue(fields["description"].startswith("Use when"))
        for workflow_word in [
            "read",
            "resolve",
            "inspect",
            "report",
            "write",
            "repair",
            "commit",
        ]:
            self.assertNotIn(workflow_word, fields["description"].lower())

    def test_doctor_card_has_the_exact_adoption_headings(self):
        card = self.read_card("jarvis-doctor")
        headings = [line[3:] for line in card.splitlines() if line.startswith("## ")]

        self.assertEqual(
            headings,
            [
                "Purpose",
                "Use it when",
                "Dependencies",
                "Files it may change",
                "Adopting it into an existing Jarvis",
            ],
        )

    def test_doctor_resolves_declared_roles_without_fallbacks(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for phrase in [
            "Resolve every capability role from the consumer's declared capability map",
            "Do not use starter paths, filesystem discovery, or guessed fallbacks",
            "missing or ambiguous",
            "declared target exists and is readable",
            "A declared missing target is evidence",
            "do not silently create it",
            "A missing optional capability is not automatically an error",
        ]:
            self.assertIn(phrase, text)
        self.assertNotIn("starter/", text)

    def test_doctor_preserves_local_extensions(self):
        text = " ".join(self.read("jarvis-doctor").split())
        self.assertIn(
            "Preserve local extensions outside the common contract", text
        )
        self.assertIn("Do not normalize or remove them", text)

    def test_doctor_stale_claim_rule_has_no_age_threshold(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for phrase in [
            "A past date alone is not stale",
            "current-state claim",
            "its own date or freshness statement no longer supports present-tense use",
            "declared evidence cannot establish it",
            "Do not invent a universal age threshold",
        ]:
            self.assertIn(phrase, text)

    def test_doctor_contradiction_rule_requires_compatible_scope_and_time(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for phrase in [
            "two mutually incompatible claims about the same subject",
            "compatible scope and time",
            "Different dates or scopes are not automatically contradictions",
            "If scope cannot be resolved, label the finding `unverifiable`",
        ]:
            self.assertIn(phrase, text)

    def test_doctor_checks_only_local_relative_markdown_links(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for phrase in [
            "Ignore external URLs and fragment-only anchors",
            "Resolve each local relative Markdown link relative to its declaring source",
            "literal link",
            "resolved missing target",
        ]:
            self.assertIn(phrase, text)

    def test_doctor_uses_the_three_exact_finding_labels(self):
        text = " ".join(self.read("jarvis-doctor").split())
        self.assertIn(
            "Use exactly one label: `error`, `unverifiable`, or `optional evolution`",
            text,
        )
        for label in ["error", "unverifiable", "optional evolution"]:
            self.assertIn(f"`{label}`:", text)

    def test_doctor_findings_are_plain_language_and_actionable(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for field in [
            "problem",
            "impact",
            "evidence",
            "minimal repair",
        ]:
            self.assertIn(field, text.lower())
        self.assertIn("plain language before technical detail", text)
        self.assertIn("compact source path and location", text)

    def test_doctor_reports_operational_state_and_natural_language_focus(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for phrase in [
            "Jarvis operational",
            "Jarvis partially operational",
            "Bootstrap blocked",
            "nothing was changed",
            "plain Doctor request audits the complete bounded scope",
            "names a symptom or capability",
            "that role and its direct dependencies",
            "Do not introduce flags or a second mode",
        ]:
            self.assertIn(phrase, text)

    def test_doctor_checks_readiness_without_mutating_the_consumer(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for phrase in [
            "Use an available read-only effective-access check or permission metadata",
            "A full audit checks every declared writer: `Identity`, `Durable memory`, `Future work`, `Daily history`, `Handoff`, and `Inbox`",
            "A focused audit checks only the named writer and its dependencies",
            "assess writability",
            "certain denial is a verified error",
            "cannot establish it without mutation",
            "unverifiable",
            "Do not create a write probe, script, cache, or temporary file in the consumer",
        ]:
            self.assertIn(phrase, text)

    def test_doctor_validates_only_real_handoff_records(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for phrase in [
            "The consumer's established Handoff contract is the lifecycle authority",
            "The shipped Lite contract defines",
            "Markdown files whose frontmatter contains `type: handoff`",
            "`active`, `completed`, and `superseded`",
            "A missing or unknown status is a verified error",
            "`created:` and `updated:` are required on every Handoff record",
            "`completed` requires `completed:`",
            "`superseded` requires `superseded:` and `superseded_by:`",
            "`resumed:` is metadata, not a status",
            "Do not lint ordinary Markdown files as handoffs",
        ]:
            self.assertIn(phrase, text)

    def test_doctor_filters_history_and_semantic_noise(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for phrase in [
            "Daily history is historical evidence",
            "an active source directly cites it for a current fact",
            "explicit pointer, time-bound promise, or directly verifiable filesystem evidence",
            "Do not turn preferences or descriptive present-tense prose into findings",
        ]:
            self.assertIn(phrase, text)

    def test_doctor_limits_actions_and_keeps_repairs_separate(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for phrase in [
            "at most three prioritized actions",
            "`jarvis-memory` remains the only curator of Identity and Durable memory",
            "plan or repair is separate follow-up work",
            "Never create or update it during Doctor",
        ]:
            self.assertIn(phrase, text)

    def test_doctor_respects_the_first_run_gate(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for phrase in [
            "Identity is missing",
            "onboarding marker is present",
            "`<!-- jarvis:onboarding-required -->` in the resolved local profile only",
            "A Doctor request is concrete user work",
            "complete the bounded read-only diagnosis before offering setup",
            "do not bypass first run",
            "missing non-Identity capability",
            "does not authorize a fallback source",
        ]:
            self.assertIn(phrase, text)

    def test_doctor_reports_verified_scope_without_overclaiming_health(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for phrase in [
            "Report inspected scope and count findings only after verifying what was read",
            "which roles, sources, and link scope were checked",
            "Do not claim the whole installation is healthy",
        ]:
            self.assertIn(phrase, text)

    def test_doctor_has_a_total_no_write_or_git_boundary(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for phrase in [
            "Do not edit, create, rename, move, delete, or install anything",
            "Do not generate a report file",
            "Do not stage, commit, push, or configure Git",
            "never perform repair as a side effect",
        ]:
            self.assertIn(phrase, text)

    def test_doctor_card_keeps_adoption_read_only_and_semantic(self):
        card = " ".join(self.read_card("jarvis-doctor").split())
        for phrase in [
            "semantic capability map",
            "declared sources",
            "None. The audit is read-only",
            "preserve local extensions",
            "does not apply repairs",
        ]:
            self.assertIn(phrase, card)
        self.assertNotIn("starter/", card)

    def test_doctor_behavioral_scenario_documents_cover_operational_gaps(self):
        expected = {
            "doctor-targeted-focus": [
                "reports only the Handoff failure",
                "does not report the unrelated broken Durable memory link",
            ],
            "doctor-handoff-lifecycle": [
                "missing status",
                "status: resumed",
                "missing `created:`",
                "missing `updated:`",
                "completed without `completed:`",
                "superseded without `superseded:` and `superseded_by:`",
                "ordinary Markdown note is ignored",
            ],
            "doctor-readiness": [
                "readable but certainly not writable",
                "verified readiness error",
                "does not create a write probe",
                "read-only effective-access evidence establishes writability",
                "does not report an unverifiable state",
                "non-Handoff write target",
            ],
            "doctor-semantic-noise": [
                "preferences and descriptive present-tense prose",
                "no false finding",
            ],
        }
        for name, phrases in expected.items():
            scenario = " ".join(self.read_scenario(name).split())
            for phrase in phrases:
                self.assertIn(phrase, scenario, f"{phrase!r} missing from {name}")

    def test_doctor_handoff_contract_matches_handoff_skill(self):
        doctor = " ".join(self.read("jarvis-doctor").split())
        handoff = " ".join(self.read("handoff").split())

        for lifecycle_term in [
            "`active`",
            "`completed`",
            "`superseded`",
            "`created:`",
            "`updated:`",
            "`completed:`",
            "`superseded:`",
            "`superseded_by:`",
            "`resumed:`",
        ]:
            self.assertIn(lifecycle_term, handoff)
            self.assertIn(lifecycle_term, doctor)

    def test_adoption_requires_selection_and_approval(self):
        text = self.read("adopt-capability")
        for label in ["add", "adapt", "already present", "conflict"]:
            self.assertIn(f"`{label}`", text)
        for phrase in [
            "Compare capabilities semantically",
            "Do not modify anything before explicit approval",
            "identity",
            "memory",
            "provenance",
        ]:
            self.assertIn(phrase, text)

    def test_adoption_frontmatter_has_a_trigger_only_description(self):
        text = self.read("adopt-capability")
        frontmatter = text.split("---", 2)[1].strip().splitlines() if text else []
        fields = dict(line.split(": ", 1) for line in frontmatter)

        self.assertEqual(set(fields), {"name", "description"})
        self.assertEqual(fields["name"], "adopt-capability")
        self.assertTrue(fields["description"].startswith("Use when"))
        for workflow_word in [
            "read",
            "resolve",
            "inventory",
            "classify",
            "propose",
            "patch",
            "approve",
            "write",
            "commit",
        ]:
            self.assertNotIn(workflow_word, fields["description"].lower())

    def test_adoption_card_has_the_exact_headings(self):
        card = self.read_card("adopt-capability")
        headings = [line[3:] for line in card.splitlines() if line.startswith("## ")]

        self.assertEqual(
            headings,
            [
                "Purpose",
                "Use it when",
                "Dependencies",
                "Files it may change",
                "Adopting it into an existing Jarvis",
            ],
        )

    def test_adoption_requires_an_immutable_verifiable_public_source(self):
        text = " ".join(self.read("adopt-capability").split())
        for phrase in [
            "The user supplies or selects the Jarvis Lite repository or release",
            "Resolve an immutable source release identifier before proposing adoption",
            "clean local Git source records the full resolved commit SHA",
            "selected Git tag or release records its human-readable label and its resolved commit or object SHA",
            "A tag name alone is insufficient",
            "assembled release records its version, manifest identity, and artifact checksum",
            "SHA-256",
            "missing or unverifiable",
            "classify adoption as `conflict` and perform no write",
            "dirty source tree",
            "moving branch name",
            "missing identifier",
            "unverifiable source card",
            "blocks adoption and produces no write",
            "Do not require a remote or GitHub account",
            "complete `SKILL.md` and human adoption card",
            "Do not import private files or history",
            "public license and provenance obligations",
        ]:
            self.assertIn(phrase, text)

    def test_adoption_displays_and_records_immutable_source_identity(self):
        text = " ".join(self.read("adopt-capability").split())
        for phrase in [
            "`Immutable source identifier(s)`",
            "display the immutable identifier or identifiers, not only a human-readable label",
            "record the displayed immutable identifier or identifiers",
        ]:
            self.assertIn(phrase, text)

    def test_adoption_inventories_and_displays_semantic_evidence(self):
        text = " ".join(self.read("adopt-capability").split())
        for phrase in [
            "Compare capabilities semantically, not by filename, folder, command, or skill name alone",
            "purpose, triggers, dependencies, authoritative roles, mutation scope, safety and approval gates, and adoption notes",
            "consumer capability map, same-purpose behavior wherever it lives, declared authoritative sources, adapters, local extensions, and existing provenance or changelog convention",
            "Read every candidate skill card completely before classification",
        ]:
            self.assertIn(phrase, text)
        for field in [
            "Semantic capability and exact label",
            "Source release or commit",
            "Consumer equivalent, regardless of path",
            "Benefit",
            "Dependencies and whether each is satisfied",
            "Exact affected consumer files",
            "Local extensions to preserve",
            "Conflicts or unresolved evidence",
            "Intended provenance action",
        ]:
            self.assertIn(f"`{field}`", text)

    def test_adoption_label_rules_are_complete_and_block_unsafe_choices(self):
        text = " ".join(self.read("adopt-capability").split())
        for phrase in [
            "Each fully inspected candidate gets exactly one label",
            "`add`: no same-purpose behavior exists",
            "every dependency can be satisfied without a second authority or protected-source rewrite",
            "`adapt`: same-purpose behavior exists or the consumer structure differs",
            "integrated in place while preserving local extensions and authorities",
            "`already present`: consumer behavior already satisfies the source contract and dependencies",
            "no capability patch or source-adoption claim is needed",
            "`conflict`: an incompatible safety or authority contract, unresolved dependency, unreadable candidate, dirty or unpinned source, or protected or local behavior would have to be overwritten",
            "Conflict is a stop state, not permission to choose a winner",
            "Do not force a classification from incomplete evidence",
            "name the missing evidence",
        ]:
            self.assertIn(phrase, text)

    def test_adoption_has_two_distinct_gates_and_zero_writes_before_both(self):
        text = " ".join(self.read("adopt-capability").split())
        for phrase in [
            "Do not modify anything before explicit approval",
            "Gate 1 — Capability selection",
            "A general request to inspect the repository is not selection",
            "may satisfy only this first gate",
            "Gate 2 — Exact patch approval",
            "show the exact file and hunk patch, preservation decisions, and provenance update",
            "wait for a second explicit approval of that displayed patch",
            "Selection is never patch approval",
            "No selection means zero filesystem changes",
            "Selection without exact patch approval also means zero filesystem changes",
            "no provenance write and no Git mutation",
            "Conflict candidates cannot advance until the conflict is resolved and reclassified",
        ]:
            self.assertIn(phrase, text)

    def test_adoption_preserves_paths_authorities_extensions_and_git(self):
        text = " ".join(self.read("adopt-capability").split())
        for phrase in [
            "For `adapt`, patch the existing same-purpose skill in place",
            "rather than adding a duplicate under the Lite path",
            "For `add`, create only the approved capability files",
            "For `already present`, make no capability write",
            "Never overwrite, redirect, or curate identity or memory content",
            "Preserve local extensions, adapters, unrelated files, authoritative-source declarations, and user formatting",
            "Re-read every affected file and verify the approved patch scope",
            "On partial failure, stop, disclose the exact state, and do not reset or discard unrelated work",
            "Do not stage, commit, push, create a remote, or change Git configuration",
        ]:
            self.assertIn(phrase, text)

    def test_adoption_provenance_uses_one_existing_or_approved_new_authority(self):
        text = " ".join(self.read("adopt-capability").split())
        for phrase in [
            "For an applied `add` or `adapt`",
            "immutable source release or commit and semantic capability",
            "one clearly established existing provenance or changelog source",
            "Do not claim source adoption for independently equivalent `already present` behavior",
            "If no provenance or changelog source exists, propose one new source with an exact path and minimal entry",
            "create it only inside the second approved patch",
            "If multiple possible sources exist or authority is unclear, adoption is blocked as `conflict`",
            "Never write a second provenance authority by guesswork",
        ]:
            self.assertIn(phrase, text)

    def test_adoption_card_names_gates_source_provenance_and_protections(self):
        card = " ".join(self.read_card("adopt-capability").split())
        for phrase in [
            "semantic capability inputs",
            "full resolved commit SHA",
            "tag or release label plus its resolved commit or object SHA",
            "version, manifest identity, and artifact checksum",
            "capability selection",
            "exact patch approval",
            "existing provenance or changelog authority",
            "Files change only after exact patch approval",
            "Identity, memory, local extensions, unrelated files, and Git remain protected",
        ]:
            self.assertIn(phrase, card)

    def test_adoption_card_handles_missing_and_ambiguous_provenance(self):
        card = " ".join(self.read_card("adopt-capability").split())
        for phrase in [
            "inspection of the consumer's established provenance or changelog convention when one exists",
            "If no provenance or changelog source exists",
            "propose one new source with an exact path and minimal entry",
            "create it only inside the second explicitly approved patch",
            "Multiple plausible sources with unclear authority remain a conflict",
        ]:
            self.assertIn(phrase, card)
        self.assertNotIn(
            "and its existing provenance or changelog authority.", card
        )

    def test_memory_card_names_the_current_adoption_workflow(self):
        card = " ".join(self.read_card("jarvis-memory").split())
        for phrase in [
            "`adopt-capability`",
            "consumer's declared capability map",
            "existing same-purpose skill",
            "Do not blindly copy",
            "preserve local extensions",
        ]:
            self.assertIn(phrase, card)
        self.assertNotIn("eventual semantic adoption workflow", card)

    def test_existing_jarvis_scenario_proves_all_three_terminal_states(self):
        scenario = " ".join(self.read_scenario("existing-jarvis").split())
        for phrase in [
            "same-purpose memory skill lives at `local-skills/remember/SKILL.md`",
            "named local extension `Weekly signal digest`",
            "matched semantically and classified `adapt`, not `add`",
            "Terminal state: no selection",
            "zero filesystem changes",
            "Terminal state: selection only",
            "selection alone is not exact patch approval",
            "Terminal state: approved patch",
            "patched in place only after capability selection and exact patch approval",
            "Identity, Durable memory contents, capability paths, and the `Weekly signal digest` local extension remain unchanged",
            "approved patch and provenance entry are the only changes",
            "before and after tree and digest evidence",
        ]:
            self.assertIn(phrase, scenario)


if __name__ == "__main__":
    unittest.main()
