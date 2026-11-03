from openai import OpenAI

client = OpenAI()


def lookup_order(order_id: str) -> dict:
    return {"order_id": order_id, "status": "shipped"}


def answer(question: str) -> str:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a support agent for an online store."},
            {"role": "user", "content": question},
        ],
    )
    return response.choices[0].message.content


if __name__ == "__main__":
    print(answer("Where is order 1234?"))
