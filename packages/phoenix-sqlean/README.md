# sqlean.py

This package provides an SQLite Python wrapper bundled with [sqlean](https://github.com/nalgeon/sqlean) extensions. It's a drop-in replacement for the standard library's [sqlite3](https://docs.python.org/3/library/sqlite3.html) module.

The project is no longer maintained.

```
pip install sqlean.py
```

```python
import sqlean

# enable all extensions
sqlean.extensions.enable_all()

# has the same API as the default sqlite3 module
conn = sqlean.connect(":memory:")
conn.execute("create table employees(id, name)")

# and comes with sqlean extensions
cur = conn.execute("select median(value) from generate_series(1, 99)")
print(cur.fetchone())
# (50.0,)

conn.close()
```

## Extensions

`sqlean.py` contains essential SQLite extensions:

-   [crypto](https://github.com/nalgeon/sqlean/blob/main/docs/crypto.md): Hashing, encoding and decoding data
-   [define](https://github.com/nalgeon/sqlean/blob/main/docs/define.md): User-defined functions and dynamic SQL
-   [fileio](https://github.com/nalgeon/sqlean/blob/main/docs/fileio.md): Reading and writing files
-   [fuzzy](https://github.com/nalgeon/sqlean/blob/main/docs/fuzzy.md): Fuzzy string matching and phonetics
-   [ipaddr](https://github.com/nalgeon/sqlean/blob/main/docs/ipaddr.md): IP address manipulation
-   [regexp](https://github.com/nalgeon/sqlean/blob/main/docs/regexp.md): Regular expressions
-   [stats](https://github.com/nalgeon/sqlean/blob/main/docs/stats.md): Math statistics
-   [text](https://github.com/nalgeon/sqlean/blob/main/docs/text.md): String functions
-   [time](https://github.com/nalgeon/sqlean/blob/main/docs/time.md): High-precision date/time
-   [uuid](https://github.com/nalgeon/sqlean/blob/main/docs/uuid.md): Universally Unique IDentifiers
-   [vsv](https://github.com/nalgeon/sqlean/blob/main/docs/vsv.md): CSV files as virtual tables

## Installation

```
pip install sqlean.py
```

Note that the package name is `sqlean.py`, while the code imports are just `sqlean`. The `sqlean` package name was taken by some zomby project and the author seemed to be unavailable, so I had to add the `.py` suffix.

A binary package (wheel) is available for the following operating systems:

-   Linux (x86_64/aarch64)
-   macOS (x86_64/arm64)

Unfortunately, there are no wheels available for Windows.

## Usage

All extensions are disabled by default. You can still use `sqlean` as a drop-in replacement for `sqlite3`:

```python
import sqlean as sqlite3

conn = sqlite3.connect(":memory:")
cur = conn.execute("select 'sql is awesome'")
print(cur.fetchone())
conn.close()
```

To enable all extensions, call `sqlean.extensions.enable_all()` before calling `connect()`:

```python
import sqlean

sqlean.extensions.enable_all()

conn = sqlean.connect(":memory:")
cur = conn.execute("select median(value) from generate_series(1, 99)")
print(cur.fetchone())
conn.close()
```

To enable specific extensions, call `sqlean.extensions.enable()`:

```python
import sqlean

sqlean.extensions.enable("stats", "text")

conn = sqlean.connect(":memory:")
cur = conn.execute("select median(value) from generate_series(1, 99)")
print(cur.fetchone())
conn.close()
```

## Building from source

Prepare source files:

```
make prepare-src
make download-sqlite
make download-sqlean
```

Build and test the package:

```
make clean build
```

## Credits

Based on the [pysqlite3](https://github.com/coleifer/pysqlite3) project. Available under the [Zlib license](LICENSE).
