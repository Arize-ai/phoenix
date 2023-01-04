import argparse
import logging

import uvicorn

import phoenix.config as config
from phoenix.core.model import Model
from phoenix.server import create_app

logger = logging.getLogger(__name__)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=config.port)
    parser.add_argument("--primary", type=str)
    parser.add_argument("--reference", type=str)
    args = parser.parse_args()

    # Validate the required args
    if args.primary is None:
        raise ValueError("Primary dataset is required via the --primary flag")
    if args.reference is None:
        raise ValueError("Reference dataset is required via the --reference flag")
    print(
        f"""Starting Phoenix App
            primary dataset: {args.primary}
            reference dataset: {args.reference}"""
    )

    model = Model(primary_dataset_name=args.primary, reference_dataset_name=args.reference)
    app = create_app(model, graphiql=config.graphiql)

    uvicorn.run(app, port=args.port)
