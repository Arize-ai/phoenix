def grade(answer, reference):
    return {"reward": int(isinstance(answer, str) and answer.strip() == "ok")}
