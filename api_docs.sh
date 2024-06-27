#!/bin/bash

cd docs/api_sphinx
sphinx-apidoc -o ./docs_sphinx/source ./src/phoenix/inferences -f
sphinx-apidoc -o ./docs_sphinx/source ./src/phoenix/session -f
sphinx-apidoc -o ./docs_sphinx/source ./src/phoenix/evals -f

make clean && make html
open build/html/index.html

