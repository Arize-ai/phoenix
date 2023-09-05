#!/bin/bash

cd "$(git rev-parse --show-toplevel)"
python3 -m grpc_tools.protoc \
    -I src/phoenix/proto/ \
    --python_out=src/phoenix/. \
    --mypy_out=src/phoenix/. \
    src/phoenix/proto/trace/v1/trace.proto
