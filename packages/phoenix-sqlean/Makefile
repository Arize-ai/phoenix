# Copyright (c) 2023 Anton Zhiyanov, MIT License
# https://github.com/nalgeon/sqlite

.PHONY: build

SQLITE_RELEASE_YEAR := 2025
SQLITE_VERSION := 3500400
SQLEAN_VERSION := 0.27.4

prepare-src:
	mkdir -p sqlite
	rm -rf sqlite/*

download-sqlite:
	curl -L https://github.com/sqlite/sqlite/raw/master/src/test_windirent.h --output sqlite/test_windirent.h
	curl -L https://sqlite.org/$(SQLITE_RELEASE_YEAR)/sqlite-amalgamation-$(SQLITE_VERSION).zip --output sqlite.zip
	unzip sqlite.zip
	mv sqlite-amalgamation-$(SQLITE_VERSION)/* sqlite
	rmdir sqlite-amalgamation-$(SQLITE_VERSION)
	rm -f sqlite.zip

download-sqlean:
	curl -L https://github.com/nalgeon/sqlean/archive/refs/tags/$(SQLEAN_VERSION).zip --output sqlean.zip
	unzip sqlean.zip
	mv sqlean-$(SQLEAN_VERSION) sqlean-src
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
	cat sqlean-src/src/unicode/*.c > sqlite/sqlean-unicode.c
	cat sqlean-src/src/uuid/*.c > sqlite/sqlean-uuid.c
	cat sqlean-src/src/vsv/*.c > sqlite/sqlean-vsv.c
	cat src/init.c >> sqlite/sqlite3.c
	cp src/init.h sqlite
	rm -rf sqlean-src
	rm -f sqlean.zip

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
