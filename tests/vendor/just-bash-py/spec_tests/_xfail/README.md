# Known spec-test failures (xfail manifests)

These files list the Oils/upstream spec-test cases that the vendored
`just_bash` interpreter does not yet pass. `test_spec.py` reads them and marks
the corresponding tests `xfail` (non-strict), so the suite stays green while a
*new*, un-listed failure still surfaces as a real error. The gaps themselves
are described in [`../KNOWN_LIMITATIONS.md`](../KNOWN_LIMITATIONS.md).

One entry per line; blank lines and `#` comments are ignored.

| File | Marks | Entry format |
| --- | --- | --- |
| `bash_cases.txt` | `TestBashSpecTests::test_spec_case` (per case) | `<file>::<case name>[L<line>]` |
| `bash_files.txt` | `test_bash_spec_file` (per file) | `<file>.test.sh` |
| `awk_files.txt` | `test_awk_spec_file` | `T.<name>` |
| `jq_files.txt` | `test_jq_spec_file` | `<file>.test` |
| `grep_files.txt` | `test_grep_spec_file` | `<file>.tests` |
| `sed_files.txt` | `test_sed_spec_file` | `<file>.tests` / `<file>.suite` |

## Regenerating

After interpreter changes shift which cases pass, rebuild the manifests from a
clean run:

```bash
uv run pytest tests/vendor/just-bash-py/spec_tests --tb=no -q \
  | grep '^FAILED' > /tmp/spec_failed_raw.txt

cd tests/vendor/just-bash-py/spec_tests
grep 'test_spec_case\[' /tmp/spec_failed_raw.txt \
  | perl -pe 's/^.*?test_spec_case\[//; s/\]$//;' | sort -u > _xfail/bash_cases.txt
for fn in test_bash_spec_file:bash_files test_awk_spec_file:awk_files \
          test_jq_spec_file:jq_files test_grep_spec_file:grep_files \
          test_sed_spec_file:sed_files; do
  func=${fn%%:*}; out=${fn##*:}
  grep "${func}\[" /tmp/spec_failed_raw.txt \
    | perl -pe "s/^.*?${func}\\[//; s/\\]\$//;" | sort -u > "_xfail/${out}.txt"
done
```

Because the marks are non-strict, a fixed case that starts passing shows up as
`XPASS` rather than a failure — prune it from the manifest when convenient.
