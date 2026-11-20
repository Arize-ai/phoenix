---
type: regex
target: {source: file, path: validate_judge.py}
match: contains
---
confusion_matrix|classification_report|precision_score|recall_score|f1_score|accuracy_score|cohen_kappa_score|cohen_kappa|\bkappa\b|\bTPR\b|\bTNR\b
