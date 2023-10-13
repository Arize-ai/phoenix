import asyncio
import os
import sys
import time

import httpx
import openai

START_TIME = time.time()
COMPLETED_RESPONSES = 0

API_URL = "https://api.openai.com/v1/chat/completions"
openai.api_key = os.environ["OPENAI_API_KEY"]
HEADERS = {
    "Authorization": f"Bearer {openai.api_key}",
}

MAX_CONCURRENT_REQUESTS = 10
# throttler = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

# Queue setup
MAX_QUEUE_SIZE = 100
request_queue = asyncio.Queue(maxsize=MAX_QUEUE_SIZE)


rate_limited = asyncio.Event()

# prompt = (
#     "I'm making a a ChatCompletion request over and over and over and over again."
#     "How long do you think it'll take for me to get rate limited?"
# )
prompt = "hello!"
payload = {
    "model": "gpt-4",
    "messages": [{"role": "assistant", "content": prompt}],
    "temperature": 0.7,
}


async def producer():
    while not rate_limited.is_set():
        await request_queue.put(payload)
        # print(f"Queue size: {request_queue.qsize()}")
        await asyncio.sleep(0.5)


async def consumer():
    while not rate_limited.is_set():
        next_payload = await request_queue.get()
        async with httpx.AsyncClient() as client:
            # async with throttler:
            try:
                async with asyncio.timeout(10):
                    # completion = await openai.ChatCompletion.acreate(**next_payload)
                    # print(completion.to_dict_recursive()["usage"])
                    completion = await client.post(API_URL, headers=HEADERS, json=next_payload)
                    print(completion.json()["choices"][0]["text"])
                    sys.stdout.flush()
                    request_queue.task_done()
            except asyncio.TimeoutError:
                print("Maybe rate limited!")
                rate_limited.set()
                return


async def main(timeout_duration):
    producer_task = asyncio.create_task(producer())
    consumer_tasks = [asyncio.create_task(consumer()) for _ in range(MAX_CONCURRENT_REQUESTS)]

    try:
        await asyncio.wait_for(producer_task, timeout=timeout_duration)
    except asyncio.TimeoutError:
        producer_task.cancel()
        for task in consumer_tasks:
            task.cancel()
        print("Process timed out!")


if __name__ == "__main__":
    TIMEOUT_DURATION = 30
    asyncio.run(main(TIMEOUT_DURATION))
    print(f"Effective Rate: {COMPLETED_RESPONSES / (time.time() - START_TIME)}")
