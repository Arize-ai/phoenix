import argparse
import asyncio
import collections
import os
import time

import httpx
import openai
from phoenix.utilities.ratelimits import OpenAIRateLimiter

START_TIME = time.time()
COMPLETED_RESPONSES = 0
stop_event = asyncio.Event()
request_times = collections.deque()
tokens_processed = collections.deque()

API_URL = "https://api.openai.com/v1/chat/completions"
openai.api_key = os.environ["OPENAI_API_KEY"]
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {openai.api_key}",
}

MAX_CONCURRENT_REQUESTS = 20
# throttler = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

# Queue setup
MAX_QUEUE_SIZE = 40
request_queue = asyncio.Queue(maxsize=MAX_QUEUE_SIZE)

prompt = "hello!"
payload_template = {
    "model": "gpt-4",
    "messages": [{"role": "assistant", "content": prompt}],
    "temperature": 0.7,
}


rate_limiter = OpenAIRateLimiter(openai.api_key)


def request_time(bucket_size):
    global request_times
    recent_request_times = (request_times.popleft() for _ in range(bucket_size))
    return sum(recent_request_times) / bucket_size  # seconds


def effective_rate():
    key = rate_limiter.key("gpt-4")
    return (
        60 * rate_limiter._store._rate_limits[key]["requests"].effective_rate()
    )  # requests per minute


def effective_token_rate():
    key = rate_limiter.key("gpt-4")
    return (
        60 * rate_limiter._store._rate_limits[key]["tokens"].effective_rate()
    )  # tokens per minute


def print_rate_info():
    info_interval = 20
    if len(request_times) > info_interval:
        elapsed_time = time.time() - START_TIME
        avg_request_time = request_time(info_interval)
        cumulative_request_rate = effective_rate()
        cumulative_token_rate = effective_token_rate()
        info_str = (
            f"time: {elapsed_time:.2f} | "
            f"avg request time: {avg_request_time:.2f} | "
            f"request rate: {cumulative_request_rate:.2f} | "
            f"token rate: {cumulative_token_rate:.2f} | "
        )
        print(info_str)


@rate_limiter.alimit("gpt-4", 0)
async def openai_python_request(payload):
    try:
        async with asyncio.timeout(20):
            completion = await openai.ChatCompletion.acreate(**payload)
            print_rate_info()
            return completion
    except asyncio.TimeoutError:
        print("Maybe rate limited!")
        stop_event.set()


@rate_limiter.alimit("gpt-4", 0)
async def openai_httpx_request(payload):
    async with httpx.AsyncClient() as client:
        response = await client.post(API_URL, headers=HEADERS, json=payload, timeout=None)
        if response.status_code == 429:
            print("Rate limited!")
            stop_event.set()
        else:
            request_times.append(response.elapsed.total_seconds())
            tokens_processed.append(response.json()["usage"]["total_tokens"])
            print_rate_info()
        return response


async def producer():
    while not stop_event.is_set():
        await request_queue.put(payload_template)
        await asyncio.sleep(0.001)


async def consumer():
    while not stop_event.is_set():
        payload = await request_queue.get()
        # await openai_python_request(payload)
        await openai_httpx_request(payload)
        request_queue.task_done()
        global COMPLETED_RESPONSES
        COMPLETED_RESPONSES += 1


async def main(timeout_duration):
    producer_task = asyncio.create_task(producer())
    [asyncio.create_task(consumer()) for _ in range(MAX_CONCURRENT_REQUESTS)]

    try:
        await asyncio.wait_for(producer_task, timeout=timeout_duration)
    except asyncio.TimeoutError:
        stop_event.set()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("duration", type=int, default=300)
    parser.add_argument("-r", "--request-limit", type=int, default=200)
    parser.add_argument("-t", "--token-limit", type=int, default=40000)
    args = parser.parse_args()
    rate_limiter.set_rate_limits("gpt-4", args.request_limit, args.token_limit)

    TIMEOUT_DURATION = args.duration
    asyncio.run(main(TIMEOUT_DURATION))
    print(f"Effective RPM: {60 * COMPLETED_RESPONSES / (time.time() - START_TIME)}")
