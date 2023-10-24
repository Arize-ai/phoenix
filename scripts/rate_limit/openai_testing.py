import argparse
import asyncio
import os
import time
from collections import defaultdict, deque
from json import JSONDecodeError
from typing import Any, Deque, Dict

import httpx
import openai
import tiktoken
from phoenix.experimental.evals.models.rate_limiters import OpenAIRateLimiter

# define trackers
START_TIME = time.time()
COMPLETED_RESPONSES = 0
TOTAL_TOKENS = 0
ERRORS = 0
stop_event = asyncio.Event()
request_times: Deque[float] = deque()
tokens_processed: Deque[int] = deque()
log = defaultdict(list)
error_log: Dict[str, Any] = defaultdict(list)

API_URL = "https://api.openai.com/v1/chat/completions"
openai.api_key = os.environ["OPENAI_API_KEY"]
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {openai.api_key}",
}

MAX_CONCURRENT_REQUESTS = 20

MAX_QUEUE_SIZE = 40
request_queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue(maxsize=MAX_QUEUE_SIZE)

prompt = "hello!"
payload_template = {
    "model": "gpt-4",
    "messages": [{"role": "assistant", "content": prompt}],
    "temperature": 0.7,
}


rate_limiter = OpenAIRateLimiter(openai.api_key)


def request_time(bucket_size: int) -> float:
    global request_times
    recent_request_times = (request_times.popleft() for _ in range(bucket_size))
    return sum(recent_request_times) / bucket_size  # seconds


def effective_rate() -> float:
    elapsed_time = time.time() - START_TIME
    global COMPLETED_RESPONSES
    return 60 * COMPLETED_RESPONSES / elapsed_time  # requests per minute


def effective_token_rate() -> float:
    elapsed_time = time.time() - START_TIME
    global TOTAL_TOKENS
    return 60 * TOTAL_TOKENS / elapsed_time  # requests per minute


def print_rate_info() -> None:
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
        global log
        log["time"].append(elapsed_time)
        log["avg_request"].append(avg_request_time)
        log["request_rate"].append(cumulative_request_rate)
        log["token_rate"].append(cumulative_token_rate)
        print(info_str)


def print_error(response: httpx.Response) -> None:
    if response.status_code != 200:
        elapsed_time = time.time() - START_TIME

        global error_log
        error_log["time"].append(elapsed_time)
        error_log["error_code"].append(response.status_code)
        try:
            error_log["error_payload"].append(response.json())
        except JSONDecodeError:
            error_log["error_payload"].append("no json payload")


def initial_token_cost(payload: Dict[str, Any]) -> int:
    """Return the number of tokens used by a list of messages.

    Official documentation: https://github.com/openai/openai-cookbook/blob/main/examples/How_to_format_inputs_to_ChatGPT_models.ipynb
    """  # noqa
    encoder = tiktoken.get_encoding("cl100k_base")
    messages = payload["messages"]
    tokens_per_message = 3
    tokens_per_name = 1

    token_count = 0
    for message in messages:
        token_count += tokens_per_message
        for key, text in message.items():
            token_count += len(encoder.encode(text))
            if key == "name":
                token_count += tokens_per_name
    # every reply is primed with <|start|>assistant<|message|>
    token_count += 3
    return token_count


def response_token_cost(response: httpx.Response) -> int:
    if response.status_code == 200:
        return int(response.json()["usage"]["completion_tokens"])
    else:
        return 0


@rate_limiter.alimit("gpt-4", initial_token_cost, response_token_cost)
async def openai_request(payload: Dict[str, Any]) -> httpx.Response:
    async with httpx.AsyncClient() as client:
        response = await client.post(API_URL, headers=HEADERS, json=payload, timeout=None)
        if response.status_code != 200:
            global ERRORS
            ERRORS += 1
            print_error(response)
        else:
            usage = response.json()["usage"]
            global request_times
            request_times.append(response.elapsed.total_seconds())
            global tokens_processed
            tokens_processed.append(usage["total_tokens"])
            global COMPLETED_RESPONSES
            COMPLETED_RESPONSES += 1
            global TOTAL_TOKENS
            TOTAL_TOKENS += usage["total_tokens"]
            print_rate_info()
        return response


async def producer() -> None:
    while not stop_event.is_set():
        await request_queue.put(payload_template)
        await asyncio.sleep(0.001)


async def consumer() -> None:
    while not stop_event.is_set():
        global request_queue
        payload = await request_queue.get()
        await openai_request(payload)
        request_queue.task_done()


async def main(timeout_duration: int) -> None:
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
    parser.add_argument("-o", "--output", type=str, default=None)
    args = parser.parse_args()
    rate_limiter.set_rate_limits("gpt-4", args.request_limit, args.token_limit)

    TIMEOUT_DURATION = args.duration
    asyncio.run(main(TIMEOUT_DURATION))
    import pandas as pd

    if output := args.output:
        pd.DataFrame(log).to_csv(output)
        pd.DataFrame(error_log).to_csv(output + ".errors")
