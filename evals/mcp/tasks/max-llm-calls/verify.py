from grading import exact_integer


def grade(answer, reference):
    return {"reward": int(exact_integer(answer, reference.get("value"), "(?:LLM )?calls?"))}
