# Copyright (c) 2023 Anton Zhiyanov, MIT License
# https://github.com/nalgeon/sqlite

.PHONY: build check-sqlean-pin

# The download URL embeds both, so a mismatch 404s at fetch time.
SQLITE_RELEASE_YEAR := 2026
SQLITE_VERSION := 3530400
# Recorded by confirming the download against the SHA3-256 in sqlite.org's
# PRODUCT line, then re-hashing (shasum cannot do SHA3). Release files there
# are immutable, so a mismatch means different bytes.
SQLITE_SHA256 := 1e71ddf93849c6a6ecf58b827c0692073d2dd7ee40196158068f7b29f422e87d
SQLEAN_REPO := https://github.com/nalgeon/sqlean.git
# The release SQLEAN_COMMIT corresponds to, +<short sha> when the commit sits
# ahead of it. check-sqlean-pin enforces that, and that setup.py's copy agrees
# -- setup.py's is the one compiled in as what sqlean_version() reports.
SQLEAN_VERSION := 0.28.3+6b969da
# Pinned by commit, not tag: a tag can be moved to different content, a commit
# cannot, and git verifies every object it receives. Why a given pin was
# chosen belongs in the commit that moved it.
SQLEAN_COMMIT := 6b969da844d9c3c79a0b226b403b3d8227b4ed46
# sqlean's crypto extension includes crypto/xxhash.impl.h but does not ship it.
# XXHASH_TAG is the tag sqlean's own Makefile fetches; download-sqlean asserts
# they still agree, so an upstream move stops the build.
XXHASH_TAG := v0.8.3
# Plain HTTP, unlike the sqlean fetch: curl verifies nothing. The commit fixes
# which content is correct, XXHASH_SHA256 proves the bytes are it.
XXHASH_COMMIT := e626a72bc2321cd320e953a0ccf1584cad60f363
XXHASH_SHA256 := 17973c0dc49d9854ca26caa191f0e12f7a424b68858d9a78de3860d959d85e4b

prepare-src:
	mkdir -p sqlite
	rm -rf sqlite/*

download-sqlite:
	# Vendored, not downloaded: SQLite removed this Windows opendir() shim in
	# 3.51.0, so the copy in src/ is pinned at 3.50.4 and deliberately NOT tied
	# to $(SQLITE_VERSION). Do not re-sync it on a bump.
	cp src/test_windirent.h sqlite/test_windirent.h
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
	# Here rather than in check-sqlean-pin because it reads sqlean's Makefile,
	# which exists only between the checkout above and the cleanup below. An
	# empty $$ref -- sqlean sourcing xxHash some other way -- fails too.
	@ref=$$(sed -n 's|.*xxhash/raw/\([^/]*\)/xxhash.h.*|\1|p' sqlean-src/Makefile | head -1); \
	if [ "$$ref" != "$(XXHASH_TAG)" ]; then \
		echo "sqlean $(SQLEAN_COMMIT) fetches xxHash '$$ref', but XXHASH_TAG is $(XXHASH_TAG)" >&2; \
		exit 1; \
	fi; \
	echo "xxHash pin OK: sqlean asks for $(XXHASH_TAG)"
	# Into the sqlean tree, so the crypto/*.h copy below picks it up.
	curl -fL https://github.com/cyan4973/xxhash/raw/$(XXHASH_COMMIT)/xxhash.h --output sqlean-src/src/crypto/xxhash.impl.h
	echo "$(XXHASH_SHA256)  sqlean-src/src/crypto/xxhash.impl.h" | shasum -a 256 -c -
	mkdir -p \
		  sqlite/crypto \
		  sqlite/define \
		  sqlite/fileio \
		  sqlite/fuzzy \
		  sqlite/ipaddr \
		  sqlite/math \
		  sqlite/regexp/pcre2 \
		  sqlite/stats \
		  sqlite/text \
		  sqlite/text/utf8 \
		  sqlite/time \
		  sqlite/unicode \
		  sqlite/uuid \
		  sqlite/vsv
	cp sqlean-src/src/crypto/*.h sqlite/crypto/
	cp sqlean-src/src/define/*.h sqlite/define/
	cp sqlean-src/src/fileio/*.h sqlite/fileio/
	cp sqlean-src/src/fuzzy/*.h sqlite/fuzzy/
	cp sqlean-src/src/ipaddr/*.h sqlite/ipaddr/
	cp sqlean-src/src/math/*.h sqlite/math/
	cp sqlean-src/src/regexp/*.h sqlite/regexp/
	cp sqlean-src/src/regexp/pcre2/*.h sqlite/regexp/pcre2
	cp sqlean-src/src/stats/*.h sqlite/stats/
	cp sqlean-src/src/text/*.h sqlite/text/
	cp sqlean-src/src/text/utf8/*.h sqlite/text/utf8
	cp sqlean-src/src/time/*.h sqlite/time/
	cp sqlean-src/src/unicode/*.h sqlite/unicode/
	cp sqlean-src/src/uuid/*.h sqlite/uuid/
	cp sqlean-src/src/vsv/*.h sqlite/vsv/
	cp sqlean-src/src/*.h sqlite/
	cat sqlean-src/src/crypto/*.c > sqlite/sqlean-crypto.c
	cat sqlean-src/src/define/*.c > sqlite/sqlean-define.c
	cat sqlean-src/src/fileio/*.c > sqlite/sqlean-fileio.c
	cat sqlean-src/src/fuzzy/*.c > sqlite/sqlean-fuzzy.c
	cat sqlean-src/src/ipaddr/*.c > sqlite/sqlean-ipaddr.c
	cat sqlean-src/src/math/*.c > sqlite/sqlean-math.c
	cat sqlean-src/src/regexp/pcre2/*.c sqlean-src/src/regexp/*.c > sqlite/sqlean-regexp.c
	cat sqlean-src/src/stats/*.c > sqlite/sqlean-stats.c
	cat sqlean-src/src/text/utf8/*.c sqlean-src/src/text/*.c > sqlite/sqlean-text.c
	cat sqlean-src/src/time/*.c > sqlite/sqlean-time.c
	# MSVC rejects file-scope consts initialized from other consts (C2099),
	# which gcc and clang accept; the patch swaps them for literals. patch(1)
	# failing on a bump is the tripwire -- otherwise it breaks Windows only.
	patch sqlite/sqlean-time.c src/sqlean-time-msvc.patch
	cat sqlean-src/src/unicode/*.c > sqlite/sqlean-unicode.c
	cat sqlean-src/src/uuid/*.c > sqlite/sqlean-uuid.c
	cat sqlean-src/src/vsv/*.c > sqlite/sqlean-vsv.c
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
