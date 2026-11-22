# -*- coding: utf-8 -*-
"""Reproducibly generate CH16 (iteration, comprehensions, generators).

The authored task descriptions/templates/solutions live in ch16_cases.json.
Reference outputs and assertions are computed from the Python solutions;
nothing is copied from the preceding chapter's answers.

Usage:
  python generator/gen_ch16.py           # write four files in questions/ and docs/
  python generator/gen_ch16.py --check   # re-run solutions and compare checked-in JSON
"""
import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
from framework import run

ROOT = Path(__file__).resolve().parent.parent
SPECS = ROOT / "generator" / "ch16_cases.json"
OUTDIR = "CH16_Iteration_Generators"
FILES = {"E": "easy_30.json", "M": "medium_30.json",
         "H": "hard_30.json", "X": "expert_30.json"}
DIFFICULTIES = {"E": ("超简单", "⭐"), "M": ("简单", "⭐⭐"),
                "H": ("中等", "⭐⭐⭐"), "X": ("较难", "⭐⭐⭐⭐")}
FIELDS = ("id", "topic", "difficulty", "stars", "description", "code_template",
          "expected_output", "hints", "test_cases", "solution")


def generate():
    specs = json.loads(SPECS.read_text(encoding="utf-8"))
    assert specs["chapter"] == "CH16"
    assert specs["outputDir"] == OUTDIR
    assert len(specs["cases"]) == 120, "CH16 must contain 120 authored cases"

    result = {}
    outs = set()
    for suffix, filename in FILES.items():
        questions = []
        cases = [s for s in specs["cases"] if s["id"].startswith("CH16-" + suffix + "-")]
        assert len(cases) == 30, (suffix, len(cases))
        for i, item in enumerate(cases, 1):
            assert item["id"] == "CH16-{}-{:03d}".format(suffix, i)
            assert item["difficulty"] == DIFFICULTIES[suffix][0]
            assert item["stars"] == DIFFICULTIES[suffix][1]
            assert "___" in item["code_template"]
            output = run(item["solution"])
            assert output not in outs, "duplicate output " + item["id"]
            outs.add(output)
            test = "assert captured_output == " + json.dumps(output, ensure_ascii=False)
            exec(test, {"captured_output": output})
            q = {}
            for field in FIELDS:
                if field == "expected_output":
                    q[field] = output
                elif field == "test_cases":
                    q[field] = [test]
                else:
                    q[field] = item[field]
            questions.append(q)
        result[filename] = {"chapter": "CH16", "title": specs["title"],
                            "difficulty": DIFFICULTIES[suffix][0], "questions": questions}
    assert len(outs) == 120
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true",
                        help="do not write; verify generated payload against repository")
    args = parser.parse_args()
    result = generate()
    for filename, payload in result.items():
        for prefix in ("questions", "docs/data/questions"):
            path = ROOT / prefix / OUTDIR / filename
            if args.check:
                assert path.exists(), "Missing: " + str(path)
                actual = json.loads(path.read_text(encoding="utf-8"))
                assert actual == payload, "Stale/incorrect: " + str(path)
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
                                encoding="utf-8")
        print("OK: " + filename + " (30)")
    print("CH16 verified: 120 cases, 4 difficulty levels, unique outputs, real Python assertions.")


if __name__ == "__main__":
    main()
