---
type: regex
target: {source: file, path: validate_judge.py}
match: contains
---
confusion_matrix|classification_report|precision_score|recall_score|\bTPR\b|\bTNR\b
