#!/usr/bin/env python3

import json
import sys
from collections import Counter
from pathlib import Path


def fail(message: str) -> None:
    print(f"slither-triage: FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    if len(sys.argv) != 3:
        fail("usage: check-slither-triage.py <slither-report.json> <triage.json>")

    report_path = Path(sys.argv[1])
    triage_path = Path(sys.argv[2])
    if not report_path.is_file():
        fail(f"missing report: {report_path}")
    if not triage_path.is_file():
        fail(f"missing triage manifest: {triage_path}")

    report = json.loads(report_path.read_text())
    triage = json.loads(triage_path.read_text())
    detectors = report.get("results", {}).get("detectors", [])
    gate_impacts = set(triage.get("policy", {}).get("gateImpacts", []))
    rules = triage.get("rules", [])

    if not gate_impacts:
        fail("triage manifest has no gate impacts")
    if not rules:
        fail("triage manifest has no rules")

    rule_by_id = {}
    for rule in rules:
        rule_id = rule.get("id")
        if not rule_id or rule_id in rule_by_id:
            fail(f"invalid or duplicate rule id: {rule_id!r}")
        if rule.get("impact") in gate_impacts and rule.get("verdict") != "not_actionable":
            fail(f"gated rule {rule_id} has unresolved verdict {rule.get('verdict')!r}")
        if not isinstance(rule.get("expectedCount"), int) or rule["expectedCount"] <= 0:
            fail(f"rule {rule_id} has invalid expectedCount")
        rule_by_id[rule_id] = rule

    matched = Counter()
    unmatched = []
    ambiguous = []

    for detector in detectors:
        impact = str(detector.get("impact", "Unknown"))
        if impact not in gate_impacts:
            continue
        check = str(detector.get("check", "<unknown>"))
        description = " ".join(str(detector.get("description", "")).split())
        candidates = [
            rule
            for rule in rules
            if rule.get("impact") == impact
            and rule.get("check") == check
            and str(rule.get("contains", "")) in description
        ]
        if len(candidates) == 1:
            matched[candidates[0]["id"]] += 1
        elif not candidates:
            unmatched.append((impact, check, description))
        else:
            ambiguous.append((impact, check, description, [rule["id"] for rule in candidates]))

    if unmatched:
        for impact, check, description in unmatched:
            print(f"UNTRIAGED [{impact}] {check}: {description}", file=sys.stderr)
        fail(f"{len(unmatched)} gated Slither finding(s) are untriaged")

    if ambiguous:
        for impact, check, description, ids in ambiguous:
            print(f"AMBIGUOUS [{impact}] {check} matches {ids}: {description}", file=sys.stderr)
        fail(f"{len(ambiguous)} gated Slither finding(s) match multiple triage rules")

    count_errors = []
    for rule in rules:
        if rule.get("impact") not in gate_impacts:
            continue
        actual = matched[rule["id"]]
        expected = rule["expectedCount"]
        if actual != expected:
            count_errors.append((rule["id"], expected, actual))

    if count_errors:
        for rule_id, expected, actual in count_errors:
            print(
                f"COUNT_MISMATCH {rule_id}: expected {expected}, observed {actual}",
                file=sys.stderr,
            )
        fail("reviewed High/Medium Slither fingerprint changed; retriage required")

    all_counts = Counter(str(item.get("impact", "Unknown")) for item in detectors)
    print(f"slither_detector_count: {len(detectors)}")
    for impact in sorted(all_counts):
        print(f"slither_{impact.lower()}_count: {all_counts[impact]}")
    for rule in rules:
        if rule.get("impact") in gate_impacts:
            print(
                f"TRIAGED {rule['id']} [{rule['impact']}] {rule['check']} "
                f"count={matched[rule['id']]} verdict={rule['verdict']}"
            )

    nongated = [
        item for item in detectors if str(item.get("impact", "Unknown")) not in gate_impacts
    ]
    if nongated:
        print("nongated Slither findings remain visible for low/informational review:")
        for item in nongated:
            impact = str(item.get("impact", "Unknown"))
            check = str(item.get("check", "<unknown>"))
            description = " ".join(str(item.get("description", "")).split())
            print(f"  [{impact}] {check}: {description}")

    print("slither-triage: PASS")


if __name__ == "__main__":
    main()
