# Copyright (c) 2023 Anton Zhiyanov, MIT License
# https://github.com/nalgeon/sqlite

.PHONY: build check-sqlean-pin

# The download URL embeds both, so a mismatch 404s at fetch time.
SQLITE_RELEASE_YEAR := 2026
SQLITE_VERSION := 3540100
# Recorded by confirming the download against the SHA3-256 in sqlite.org's
# PRODUCT line, then re-hashing (shasum cannot do SHA3). Release files there
# are immutable, so a mismatch means different bytes.
SQLITE_SHA256 := 0a9c8e34352dad46006aa82836d5383bff9dc6bc9ce5a60553c05aa30e6ad1f9
SQLEAN_REPO := https://github.com/nalgeon/sqlean.git
# The release SQLEAN_COMMIT corresponds to, +<short sha> when the commit sits
# ahead of it. check-sqlean-pin enforces that, and that setup.py's copy agrees
# -- setup.py's is the one compiled in as what sqlean_version() reports.
SQLEAN_VERSION := 0.29.0
# Pinned by commit, not tag: a tag can be moved to different content, a commit
# cannot, and git verifies every object it receives. Why a given pin was
# chosen belongs in the commit that moved it.
SQLEAN_COMMIT := 528537d8b768e0a2af4dba98f9d5aca2ceb76895
SQLEAN_MODULES := crypto define fileio fuzzy ipaddr math regexp stats text time uuid vsv

prepare-src:
	mkdir -p sqlite
	rm -rf sqlite/*

download-sqlite:
	curl -fL https://sqlite.org/$(SQLITE_RELEASE_YEAR)/sqlite-amalgamation-$(SQLITE_VERSION).zip --output sqlite.zip
	echo "$(SQLITE_SHA256)  sqlite.zip" | shasum -a 256 -c -
	unzip sqlite.zip
	mv sqlite-amalgamation-$(SQLITE_VERSION)/* sqlite
	rmdir sqlite-amalgamation-$(SQLITE_VERSION)
	rm -f sqlite.zip

# Catches SQLEAN_VERSION and SQLEAN_COMMIT disagreeing, which nothing else
# would: no build step relates the compiled sources to the reported version.
# Costs one ls-remote. Does not check ancestry -- the single-commit fetch
# below carries none -- so it catches moving one pin and not the other, not a
# base version that names the wrong release.
check-sqlean-pin:
	@base=$$(echo '$(SQLEAN_VERSION)' | cut -d+ -f1); \
	suffix=$$(echo '$(SQLEAN_VERSION)' | cut -s -d+ -f2); \
	case '$(SQLEAN_COMMIT)' in $$suffix*) ;; *) \
		echo "SQLEAN_VERSION suffix '+$$suffix' is not a prefix of SQLEAN_COMMIT $(SQLEAN_COMMIT)" >&2; \
		exit 1;; \
	esac; \
	refs=$$(git ls-remote $(SQLEAN_REPO) "refs/tags/$$base" "refs/tags/$$base^{}"); \
	if [ -z "$$refs" ]; then \
		echo "SQLEAN_VERSION base '$$base' is not a tag in $(SQLEAN_REPO)" >&2; \
		exit 1; \
	fi; \
	tag=$$(echo "$$refs" | grep '\^{}$$' | cut -f1); \
	[ -n "$$tag" ] || tag=$$(echo "$$refs" | cut -f1); \
	if [ -z "$$suffix" ] && [ "$$tag" != "$(SQLEAN_COMMIT)" ]; then \
		echo "SQLEAN_VERSION claims tag $$base ($$tag), but SQLEAN_COMMIT is $(SQLEAN_COMMIT)" >&2; \
		exit 1; \
	fi; \
	if [ -n "$$suffix" ] && [ "$$tag" = "$(SQLEAN_COMMIT)" ]; then \
		echo "SQLEAN_COMMIT is exactly tag $$base -- drop the '+$$suffix' suffix from SQLEAN_VERSION" >&2; \
		exit 1; \
	fi; \
	compiled=$$(sed -n 's/^SQLEAN_VERSION = "\([^"]*\)".*/\1/p' setup.py | head -1); \
	if [ "$$compiled" != "$(SQLEAN_VERSION)" ]; then \
		echo "setup.py SQLEAN_VERSION ($$compiled) != Makefile SQLEAN_VERSION ($(SQLEAN_VERSION))" >&2; \
		exit 1; \
	fi; \
	echo "sqlean pin OK: $(SQLEAN_VERSION) -> $(SQLEAN_COMMIT)"

download-sqlean: check-sqlean-pin
	# Over git by commit, not a GitHub source archive: those are generated on
	# demand and not byte-stable, so they cannot be checksum-pinned. Git hashes
	# every object it receives, so no checksum is needed here; a bad
	# SQLEAN_COMMIT fails at fetch.
	rm -rf sqlean-src
	mkdir sqlean-src
	# --template= skips hook templates: a global init.templateDir would
	# otherwise install hooks in this throwaway repo and fire them on checkout.
	git -C sqlean-src init -q --template=
	git -C sqlean-src remote add origin $(SQLEAN_REPO)
	git -C sqlean-src fetch -q --depth 1 origin $(SQLEAN_COMMIT)
	git -C sqlean-src checkout -q FETCH_HEAD
	# Tripwires against upstream changing shape: sqlean >= 0.29 vendors all
	# extension sources in-tree and ships the fixed module set in SQLEAN_MODULES.
	@ext_urls=$$(grep -E 'curl ' sqlean-src/Makefile | grep -v 'sqlite-amalgamation-' || true); \
	if [ -n "$$ext_urls" ]; then \
		echo "sqlean $(SQLEAN_COMMIT) fetches external sources in its Makefile:" >&2; \
		echo "$$ext_urls" >&2; \
		exit 1; \
	fi; \
	mods=$$(ls sqlean-src/src/sqlite3-*.c | sed 's|.*/sqlite3-\(.*\)\.c|\1|' | grep -v '^sqlean$$' | sort | tr '\n' ' ' | sed 's/ $$//'); \
	if [ "$$mods" != "$(SQLEAN_MODULES)" ]; then \
		echo "sqlean $(SQLEAN_COMMIT) modules ($$mods) != expected ($(SQLEAN_MODULES))" >&2; \
		exit 1; \
	fi
	mkdir -p \
		  sqlite/crypto \
		  sqlite/define \
		  sqlite/fileio \
		  sqlite/fuzzy \
		  sqlite/ipaddr \
		  sqlite/regexp/pcre2 \
		  sqlite/stats \
		  sqlite/text \
		  sqlite/time \
		  sqlite/uuid \
		  sqlite/vsv
	cp sqlean-src/src/crypto/*.[ch] sqlite/crypto/
	cp sqlean-src/src/define/*.[ch] sqlite/define/
	cp sqlean-src/src/fileio/*.[ch] sqlite/fileio/
	cp sqlean-src/src/fuzzy/*.[ch] sqlite/fuzzy/
	cp sqlean-src/src/ipaddr/*.[ch] sqlite/ipaddr/
	cp sqlean-src/src/regexp/*.[ch] sqlite/regexp/
	cp sqlean-src/src/regexp/pcre2/*.[ch] sqlite/regexp/pcre2/
	cp sqlean-src/src/stats/*.[ch] sqlite/stats/
	cp sqlean-src/src/text/*.[ch] sqlite/text/
	cp sqlean-src/src/time/*.[ch] sqlite/time/
	# MSVC rejects file-scope consts initialized from other consts (C2099),
	# which gcc and clang accept; the patch swaps them for literals. patch(1)
	# failing on a bump is the tripwire -- otherwise it breaks Windows only.
	patch -p1 -d sqlite < src/sqlean-time-msvc.patch
	cp sqlean-src/src/uuid/*.[ch] sqlite/uuid/
	cp sqlean-src/src/vsv/*.[ch] sqlite/vsv/
	cp sqlean-src/src/*.h sqlite/
	cat src/init.c >> sqlite/sqlite3.c
	cp src/init.h sqlite
	rm -rf sqlean-src

clean:
	rm -rf build/*
	rm -f dist/*
	rm -rf sqlean/*.so
	rm -rf sqlean.py.egg-info

build:
	python -m pip install --upgrade setuptools wheel
	python setup.py build_ext -i
	python -m tests
	python -m pip wheel . -w dist
