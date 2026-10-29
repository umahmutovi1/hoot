import json
from pathlib import Path

from hoot_ml.labels import block_label

CASES = json.loads(
    (Path(__file__).parents[2] / "src/lib/ml/labels.cases.json").read_text(encoding="utf-8")
)


def test_same_labels_as_typescript():
    for case in CASES["cases"]:
        label = block_label(case["status"], case["onDate"], case["hasSession"], CASES["today"])
        assert label == case["label"], case
