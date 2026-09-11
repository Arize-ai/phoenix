from grading import identity


def grade(answer, reference):
    return {"reward": int(identity(answer, reference["winners"]))}
