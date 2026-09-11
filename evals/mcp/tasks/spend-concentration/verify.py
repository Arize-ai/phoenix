from grading import numeric


def grade(answer, reference):
    return {"reward": int(numeric(answer, reference.get("value"), kind="percent", places=1))}
