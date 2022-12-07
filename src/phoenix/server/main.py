import argparse

import uvicorn

import phoenix.config as config
from phoenix.server.app import app

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=config.port)
    args = parser.parse_args()
    uvicorn.run(app, port=args.port)
