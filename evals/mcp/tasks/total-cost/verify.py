from grading import numeric


def grade(answer, reference):
    return {"reward": int(numeric(answer, reference.get("value"), kind="cost", places=2))}
