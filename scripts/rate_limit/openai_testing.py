import asyncio
import os
import time

import httpx
import openai
from phoenix.utilities.ratelimits import OpenAIRateLimiter

START_TIME = time.time()
COMPLETED_RESPONSES = 0

API_URL = "https://api.openai.com/v1/chat/completions/"
openai.api_key = os.environ["OPENAI_API_KEY"]
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {openai.api_key}",
}

MAX_CONCURRENT_REQUESTS = 20
# throttler = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

# Queue setup
MAX_QUEUE_SIZE = 100
request_queue = asyncio.Queue(maxsize=MAX_QUEUE_SIZE)


rate_limited = asyncio.Event()

prompt = "hello!"
payload_template = {
    "model": "gpt-4",
    "messages": [{"role": "assistant", "content": prompt}],
    "temperature": 0.7,
}


rate_limiter = OpenAIRateLimiter(openai.api_key)
rate_limiter.set_rate_limits("gpt-4", 190, 40000)


def print_effective_rate():
    key = rate_limiter.key("gpt-4")
    effective_rpm = 60 * rate_limiter._store._rate_limits[key]["requests"].effective_rate()
    print(f"Effective RPM: {effective_rpm} @ {time.time() - START_TIME} seconds")


@OpenAIRateLimiter(openai.api_key).alimit("gpt-4", 0)
async def openai_python_request(payload):
    try:
        async with asyncio.timeout(20):
            completion = await openai.ChatCompletion.acreate(**payload)
            print_effective_rate()
            # print(completion.to_dict_recursive()["usage"])  # type: ignore
            # sys.stdout.flush()
            return completion
    except asyncio.TimeoutError:
        print("Maybe rate limited!")
        rate_limited.set()


@OpenAIRateLimiter(openai.api_key).limit("gpt-4", 0)
async def openai_httpx_request(payload):
    async with httpx.AsyncClient() as client:
        response = await client.post(API_URL, headers=HEADERS, json=payload)
        # print(response.json()["usage"])
        # sys.stdout.flush()
        return response


async def producer():
    while not rate_limited.is_set():
        await request_queue.put(payload_template)
        # print(f"Queue size: {request_queue.qsize()}")
        await asyncio.sleep(0.001)


async def consumer():
    while not rate_limited.is_set():
        payload = await request_queue.get()
        await openai_python_request(payload)
        # await openai_httpx_request(client, payload)
        request_queue.task_done()
        global COMPLETED_RESPONSES
        COMPLETED_RESPONSES += 1


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
    TIMEOUT_DURATION = 300
    asyncio.run(main(TIMEOUT_DURATION))
    print(f"Effective RPM: {60 * COMPLETED_RESPONSES / (time.time() - START_TIME)}")
