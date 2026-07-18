# arize-phoenix-sqlean

This package provides an SQLite Python wrapper bundled with [sqlean](https://github.com/nalgeon/sqlean) extensions. It's a drop-in replacement for the standard library's [sqlite3](https://docs.python.org/3/library/sqlite3.html) module.

> [!NOTE]
> This is a modified fork of [nalgeon/sqlean.py](https://github.com/nalgeon/sqlean.py),
> which was archived upstream in February 2026. It was imported at upstream commit
> [`bdd7097`](https://github.com/nalgeon/sqlean.py/commit/bdd7097f8d5777bc9e3ac3235d9be66b9db34519)
> and is maintained by [Arize AI](https://arize.com) as part of the Phoenix monorepo.
> Original work by Anton Zhiyanov and contributors,
> [zlib License](https://github.com/Arize-ai/phoenix/blob/main/packages/phoenix-sqlean/LICENSE).
> The `src/` directory contains code derived from CPython's `sqlite3` module
> (PSF License 2.0). Builds download the SQLite amalgamation (public domain) and
> [sqlean](https://github.com/nalgeon/sqlean) extension sources (MIT License), which
> include PCRE2 (BSD 3-Clause), STC (MIT), and code based on Go's time package
> (BSD 3-Clause). Full notices and the CPython change summary are in
> [THIRD_PARTY_LICENSES](https://github.com/Arize-ai/phoenix/blob/main/packages/phoenix-sqlean/THIRD_PARTY_LICENSES).

```
pip install arize-phoenix-sqlean
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

This package bundles essential SQLite extensions:

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
pip install arize-phoenix-sqlean
```

Note that the package name is `arize-phoenix-sqlean`, while the code imports are just `sqlean` — the same import name as the upstream `sqlean.py` package, so this fork is a drop-in replacement (only one of the two can be installed in an environment).

A binary package (wheel) is available for the following operating systems:

-   Linux (x86_64/aarch64)
-   macOS (x86_64/arm64)
-   Windows (x86_64)

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

Based on the [pysqlite3](https://github.com/coleifer/pysqlite3) project by Charles Leifer, which is in turn based on [pysqlite](https://github.com/ghaering/pysqlite) by Gerhard Häring. Available under the [zlib license](https://github.com/Arize-ai/phoenix/blob/main/packages/phoenix-sqlean/LICENSE).
