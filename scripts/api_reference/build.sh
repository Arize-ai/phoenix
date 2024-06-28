#!/bin/bash

cd api_reference

sphinx-apidoc -o ./source ../src/phoenix/inferences -f
sphinx-apidoc -o ./source ../src/phoenix/session -f
sphinx-apidoc -o ./source ../src/phoenix/evals -f

make clean && make html
open build/html/index.html