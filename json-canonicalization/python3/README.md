## JSON Canonicalizer for Python

The [src/org/webpki/json](src/org/webpki/json)
folder contains the source code for a 
JCS (RFC 8785) compliant canonicalizer written in Python.

### Building and testing

- Set PYTHONPATH to the `src` directory.

- For running `verify-numbers.py` you need to download a 3Gb+ file with test
data described in the root directory [testdata](../testdata).  This file can be stored in
any directory and requires updating the file path in `verify-numbers.py`.

- Perform the commands:
```code
$ cd test
$ python verify-canonicalization.py
$ python verify-numbers.py
```


### Using the JSON canonicalizer

```python
from org.webpki.json.Canonicalize import canonicalize

data = canonicalize({"tag":4})
```
Note that the input is Python data structures while result is an UTF-8 formatted byte array.

If you rather need a free-standing canonicalizer you can achive that by using standard Python tools:
```python
from org.webpki.json.Canonicalize import canonicalize
from json import loads

data = canonicalize(loads('{"tag":4}'))
```
