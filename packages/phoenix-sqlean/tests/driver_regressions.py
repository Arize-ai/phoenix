# tests/driver_regressions.py: regression tests for bugs fixed in the C
# driver sources (src/).
#
# Each test pins down a defect that was inherited from the upstream
# pysqlite lineage: wrong blob reads, use-after-free and double-free
# error paths, reference-count bugs, and crashes on partially
# initialized objects.  Only defects with a deterministic, non-OOM
# trigger are covered here; allocation-failure paths can only be
# exercised with fault injection.

import gc
import subprocess
import sys
import textwrap
import threading
import unittest
import weakref
from pathlib import Path

from sqlean import dbapi2 as sqlite


class BlobRegressionTests(unittest.TestCase):
    def setUp(self):
        self.cx = sqlite.connect(":memory:")
        self.cx.execute("create table test(b blob)")
        self.cx.execute("insert into test(b) values (?)", (b"0123456789",))
        self.blob = self.cx.open_blob("test", "b", 1)

    def tearDown(self):
        try:
            self.cx.close()
        except sqlite.ProgrammingError:
            pass

    def test_subscript_uses_requested_offset(self):
        # Subscript reads used the current seek position instead of the
        # requested offset.
        self.blob.seek(9)
        self.assertEqual(self.blob[5], b"5")
        self.assertEqual(self.blob[2:5], b"234")
        # An in-range subscript with the seek position at the end used
        # to raise OperationalError.
        self.blob.seek(10)
        self.assertEqual(self.blob[0], b"0")
        # Sequential read still honors the seek position.
        self.blob.seek(4)
        self.assertEqual(self.blob.read(2), b"45")

    def test_negative_step_slices(self):
        # Negative-step slices allocated `stop - start` (< 0) bytes and
        # always raised MemoryError.
        self.assertEqual(self.blob[::-1], b"9876543210")
        self.assertEqual(self.blob[::-2], b"97531")
        self.assertEqual(self.blob[8:2:-2], b"864")
        self.assertEqual(self.blob[::2], b"02468")

    def test_negative_step_slice_assignment(self):
        self.blob[::-1] = b"abcdefghij"
        self.assertEqual(self.blob[0:10], b"jihgfedcba")

    def test_step_slice_assignment(self):
        self.blob[::2] = b"abcde"
        self.assertEqual(self.blob[0:10], b"a1b3c5d7e9")

    def test_step_slice_assignment_on_expired_blob(self):
        # Expiring the blob handle makes the initial range read fail
        # with SQLITE_ABORT; that error path used to write to a freed
        # buffer, free it twice, and then report success anyway.
        self.cx.execute("update test set b = zeroblob(10)")
        with self.assertRaises(sqlite.OperationalError):
            self.blob[::2] = b"abcde"

    def test_cross_thread_open_blob(self):
        # open_blob had no thread check at entry; the failure used to be
        # detected only after the handle was opened, and the error path
        # closed the handle twice.
        results = []

        def worker():
            try:
                self.cx.open_blob("test", "b", 1)
                results.append(None)
            except Exception as exc:  # noqa: BLE001
                results.append(exc)

        thread = threading.Thread(target=worker)
        thread.start()
        thread.join()
        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0], sqlite.ProgrammingError)

    def test_open_blob_on_closed_connection(self):
        self.blob.close()
        self.cx.close()
        with self.assertRaises(sqlite.ProgrammingError):
            self.cx.open_blob("test", "b", 1)

    def test_connection_close_closes_every_blob(self):
        # close() used to skip every other open blob because it iterated
        # by index while entries were being removed.
        blobs = [self.blob] + [self.cx.open_blob("test", "b", 1) for _ in range(4)]
        self.cx.close()
        for blob in blobs:
            with self.assertRaises(sqlite.ProgrammingError):
                blob.read(1)

    def test_explicit_close_keeps_weakrefs_intact(self):
        # close() used to clear weakrefs of the still-live blob object,
        # an internal-API misuse that raises SystemError on Python
        # 3.13+.
        ref = weakref.ref(self.blob)
        self.blob.close()
        self.assertIs(ref(), self.blob)

    def test_closed_blob_is_collected(self):
        # close() leaked a strong reference taken while unlinking the
        # blob from the connection's blob list, pinning the blob (and
        # through it the connection) forever.
        blob = self.cx.open_blob("test", "b", 1)
        ref = weakref.ref(blob)
        blob.close()
        del blob
        gc.collect()
        self.assertIsNone(ref())


class FactoryMemberRegressionTests(unittest.TestCase):
    def setUp(self):
        self.cx = sqlite.connect(":memory:")
        self.cx.execute("create table test(t text)")
        self.cx.execute("insert into test(t) values ('hello')")

    def tearDown(self):
        self.cx.close()

    def test_del_connection_row_factory(self):
        # row_factory is a plain member; deleting it stored NULL, and
        # the next cursor() call crashed in Py_INCREF(NULL).
        del self.cx.row_factory
        cur = self.cx.cursor()
        self.assertEqual(cur.execute("select t from test").fetchone(), ("hello",))

    def test_del_cursor_row_factory(self):
        cur = self.cx.cursor()
        cur.execute("select t from test")
        del cur.row_factory
        self.assertEqual(cur.fetchone(), ("hello",))

    def test_del_text_factory(self):
        del self.cx.text_factory
        cur = self.cx.cursor()
        with self.assertRaises(sqlite.ProgrammingError):
            cur.execute("select t from test").fetchone()


class BusyHandlerRegressionTests(unittest.TestCase):
    def test_fractional_busy_timeout(self):
        # (int)timeout * 1000 truncated before multiplying, so 0.5
        # seconds became 0 ms and silently disabled waiting.
        cx = sqlite.connect(":memory:")
        try:
            cx.set_busy_timeout(0.5)
            row = cx.execute("pragma busy_timeout").fetchone()
            self.assertEqual(row[0], 500)
        finally:
            cx.close()

    def test_busy_handler_reference_management(self):
        # set_busy_timeout dropped the busy-handler reference without
        # NULLing the stored pointer, so a second call (or dealloc)
        # dropped it again and underflowed the refcount.
        cx = sqlite.connect(":memory:")
        try:
            def handler(n):
                return 0

            cx.set_busy_handler(handler)
            before = sys.getrefcount(handler)
            cx.set_busy_timeout(1.0)  # replaces the handler: drops one reference
            after = sys.getrefcount(handler)
            self.assertEqual(after, before - 1)
            cx.set_busy_timeout(2.0)  # must not drop another reference
            self.assertEqual(sys.getrefcount(handler), after)
            cx.set_busy_handler(handler)
        finally:
            cx.close()
        # The handler survives connection teardown.
        self.assertEqual(handler(0), 0)


class ConnectionLifecycleRegressionTests(unittest.TestCase):
    def test_uninitialized_connection_close(self):
        # Connection.__new__ without __init__ used to crash close() on
        # its NULL internal lists.
        cx = sqlite.Connection.__new__(sqlite.Connection)
        with self.assertRaises(sqlite.ProgrammingError):
            cx.close()

    def test_uninitialized_connection_isolation_level(self):
        cx = sqlite.Connection.__new__(sqlite.Connection)
        with self.assertRaises(sqlite.ProgrammingError):
            cx.isolation_level

    def test_failed_reinit_preserves_connection(self):
        # A failed re-open used to leave a half-initialized connection
        # (NULL statement cache) that crashed on the next execute();
        # the new database is now opened before any existing state is
        # replaced, so the original connection survives untouched.
        cx = sqlite.connect(":memory:")
        try:
            cx.execute("create table t(i int)")
            cx.execute("insert into t values (1)")
            with self.assertRaises(sqlite.OperationalError):
                cx.__init__("/nonexistent-directory/no-such.db")
            self.assertEqual(cx.execute("select i from t").fetchone(), (1,))
        finally:
            cx.close()

    def test_failed_reinit_preserves_open_blob(self):
        cx = sqlite.connect(":memory:")
        try:
            cx.execute("create table t(b blob)")
            cx.execute("insert into t values (?)", (b"0123456789",))
            blob = cx.open_blob("t", "b", 1)
            with self.assertRaises(sqlite.OperationalError):
                cx.__init__("/nonexistent-directory/no-such.db")
            self.assertEqual(blob.read(2), b"01")
            blob.close()
        finally:
            cx.close()

    def test_reinit_produces_working_connection(self):
        # Re-initialization used to leak the previous database handle.
        cx = sqlite.connect(":memory:")
        cx.execute("create table one(i int)")
        cx.__init__(":memory:")
        try:
            # The new database is empty; the old handle was closed.
            rows = cx.execute(
                "select name from sqlite_master where type = 'table'"
            ).fetchall()
            self.assertEqual(rows, [])
        finally:
            cx.close()

    def test_reinit_with_open_blob(self):
        # A blob that outlives a re-initialization must close cleanly:
        # the old database handle stays alive until its last blob
        # handle is closed (sqlite3_close_v2 semantics).
        cx = sqlite.connect(":memory:")
        cx.execute("create table t(b blob)")
        cx.execute("insert into t values (?)", (b"0123456789",))
        blob = cx.open_blob("t", "b", 1)
        cx.__init__(":memory:")
        try:
            blob.close()
            with self.assertRaises(sqlite.ProgrammingError):
                blob.read(1)
        finally:
            cx.close()

    def test_backup_from_closed_source(self):
        # backup() validated only the target connection; a closed
        # source dereferenced a NULL sqlite3 handle.
        source = sqlite.connect(":memory:")
        target = sqlite.connect(":memory:")
        source.close()
        try:
            with self.assertRaises(sqlite.ProgrammingError):
                source.backup(target)
        finally:
            target.close()


class CallbackCloseRegressionTests(unittest.TestCase):
    def _run(self, source):
        result = subprocess.run(
            [
                sys.executable,
                "-X",
                "faulthandler",
                "-c",
                "from sqlean import dbapi2 as sqlite\n" + textwrap.dedent(source),
            ],
            cwd=Path(__file__).resolve().parents[1],
            capture_output=True,
            text=True,
            timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return result.stdout

    def test_close_in_scalar_function(self):
        # gh-145040: close() during sqlite3_step used to NULL db and
        # finalize the executing statement.
        self._run(
            """
            con = sqlite.connect(":memory:")
            def callback():
                try:
                    con.close()
                except sqlite.ProgrammingError:
                    raise
                else:
                    raise AssertionError("close() should have been refused")
                return 1
            con.create_function("f", 0, callback)
            try:
                con.execute("select f()")
            except sqlite.Error:
                pass
            else:
                raise AssertionError("expected execute to fail after a refused close")
            assert con.execute("select 1").fetchone() == (1,)
            con.close()
            """
        )

    def test_close_in_authorizer(self):
        self._run(
            """
            con = sqlite.connect(":memory:")
            con.execute("create table t(x)")
            def auth(*args):
                try:
                    con.close()
                except sqlite.ProgrammingError:
                    raise
                else:
                    raise AssertionError("close() should have been refused")
                return sqlite.SQLITE_OK
            con.set_authorizer(auth)
            try:
                con.execute("select x from t")
            except sqlite.Error:
                pass
            else:
                raise AssertionError("expected execute to fail after a refused close")
            con.set_authorizer(None)
            assert con.execute("select 1").fetchone() == (1,)
            con.close()
            """
        )

    def test_close_in_progress_handler(self):
        self._run(
            """
            con = sqlite.connect(":memory:")
            con.execute("create table t(x)")
            con.executemany("insert into t values (?)", [(i,) for i in range(20)])
            def progress():
                try:
                    con.close()
                except sqlite.ProgrammingError:
                    raise
                else:
                    raise AssertionError("close() should have been refused")
                return 1
            con.set_progress_handler(progress, 1)
            try:
                list(con.execute("select x from t"))
            except sqlite.Error:
                pass
            else:
                raise AssertionError("expected execute to fail after a refused close")
            con.set_progress_handler(None, 1)
            assert con.execute("select 1").fetchone() == (1,)
            con.close()
            """
        )

    def test_close_in_collation(self):
        self._run(
            """
            con = sqlite.connect(":memory:")
            con.execute("create table t(x text)")
            con.executemany("insert into t values (?)", [("a",), ("b",), ("c",)])
            def collation(a, b):
                try:
                    con.close()
                except sqlite.ProgrammingError:
                    raise
                else:
                    raise AssertionError("close() should have been refused")
                return (a > b) - (a < b)
            con.create_collation("c", collation)
            try:
                con.execute("select x from t order by x collate c")
            except sqlite.Error:
                pass
            else:
                raise AssertionError("expected execute to fail after a refused close")
            assert con.execute("select 1").fetchone() == (1,)
            con.close()
            """
        )

    def test_close_in_aggregate(self):
        self._run(
            """
            con = sqlite.connect(":memory:")
            con.execute("create table t(x integer)")
            con.executemany("insert into t values (?)", [(i,) for i in range(5)])
            class Agg:
                def __init__(self):
                    self.total = 0
                def step(self, value):
                    try:
                        con.close()
                    except sqlite.ProgrammingError:
                        raise
                    else:
                        raise AssertionError("close() should have been refused")
                    self.total += value
                def finalize(self):
                    return self.total
            con.create_aggregate("agg_close", 1, Agg)
            try:
                con.execute("select agg_close(x) from t")
            except sqlite.Error:
                pass
            else:
                raise AssertionError("expected execute to fail after a refused close")
            assert con.execute("select 1").fetchone() == (1,)
            con.close()
            """
        )

    def test_close_in_backup_progress(self):
        self._run(
            """
            src = sqlite.connect(":memory:")
            dst = sqlite.connect(":memory:")
            src.execute("create table t(x)")
            src.executemany("insert into t values (?)", [(i,) for i in range(20)])
            src.commit()
            calls = []
            def progress(status, remaining, total):
                calls.append((status, remaining, total))
                try:
                    src.close()
                except sqlite.ProgrammingError:
                    raise
                else:
                    raise AssertionError("close() should have been refused")
            try:
                src.backup(dst, pages=1, progress=progress)
            except sqlite.Error:
                pass
            else:
                raise AssertionError("expected backup to fail after a refused close")
            assert calls, "progress callback never ran; commit the source first"
            assert src.execute("select count(*) from t").fetchone()[0] == 20
            src.close()
            dst.close()
            """
        )

    def test_close_caught_inside_callback(self):
        # If the callback swallows ProgrammingError, the native operation
        # continues and the connection remains usable.
        self._run(
            """
            con = sqlite.connect(":memory:")
            def swallow(_):
                try:
                    con.close()
                except sqlite.ProgrammingError:
                    pass
                return 1
            con.create_function("swallow", 1, swallow)
            assert con.execute("select swallow(1)").fetchone() == (1,)
            assert con.execute("select 1").fetchone() == (1,)
            con.close()
            """
        )

    def test_close_target_in_backup_progress(self):
        self._run(
            """
            src = sqlite.connect(":memory:")
            dst = sqlite.connect(":memory:")
            src.execute("create table t(x)")
            src.executemany("insert into t values (?)", [(i,) for i in range(20)])
            src.commit()
            def progress(status, remaining, total):
                try:
                    dst.close()
                except sqlite.ProgrammingError:
                    raise
                else:
                    raise AssertionError("target close() should have been refused")
            try:
                src.backup(dst, pages=1, progress=progress)
            except sqlite.Error:
                pass
            else:
                raise AssertionError("expected backup to fail after a refused close")
            assert src.execute("select count(*) from t").fetchone()[0] == 20
            src.close()
            dst.close()
            """
        )

    def test_close_in_window_finalize(self):
        # xFinal runs from sqlite3_reset after the last row, not from
        # step; the driver clears callback exceptions there, so the
        # query may still complete. close() must not crash.
        self._run(
            """
            con = sqlite.connect(":memory:")
            con.execute("create table t(x integer)")
            con.executemany("insert into t values (?)", [(i,) for i in range(3)])
            class Win:
                def step(self, value):
                    pass
                def inverse(self, value):
                    pass
                def value(self):
                    return 1
                def finalize(self):
                    try:
                        con.close()
                    except sqlite.ProgrammingError:
                        pass
                    return 1
            con.create_window_function("w", 1, Win)
            list(con.execute("select w(x) over (order by x) from t"))
            assert con.execute("select 1").fetchone() == (1,)
            con.close()
            """
        )

    def test_rollback_in_window_finalize(self):
        self._run(
            """
            con = sqlite.connect(":memory:")
            con.execute("create table t(x integer)")
            con.executemany("insert into t values (?)", [(i,) for i in range(3)])
            class Win:
                def step(self, value):
                    pass
                def inverse(self, value):
                    pass
                def value(self):
                    return 1
                def finalize(self):
                    try:
                        con.rollback()
                    except sqlite.ProgrammingError:
                        pass
                    return 1
            con.create_window_function("w", 1, Win)
            list(con.execute("select w(x) over (order by x) from t"))
            assert con.execute("select 1").fetchone() == (1,)
            con.close()
            """
        )

    def test_cursor_close_in_window_finalize(self):
        self._run(
            """
            con = sqlite.connect(":memory:")
            con.execute("create table t(x integer)")
            con.executemany("insert into t values (?)", [(i,) for i in range(3)])
            cur = con.cursor()
            class Win:
                def step(self, value):
                    pass
                def inverse(self, value):
                    pass
                def value(self):
                    return 1
                def finalize(self):
                    try:
                        cur.close()
                    except sqlite.ProgrammingError:
                        pass
                    return 1
            con.create_window_function("w", 1, Win)
            list(cur.execute("select w(x) over (order by x) from t"))
            assert con.execute("select 1").fetchone() == (1,)
            con.close()
            """
        )

    def test_reexecute_in_window_finalize(self):
        self._run(
            """
            con = sqlite.connect(":memory:")
            con.execute("create table t(x integer)")
            con.executemany("insert into t values (?)", [(i,) for i in range(3)])
            cur = con.cursor()
            class Win:
                def step(self, value):
                    pass
                def inverse(self, value):
                    pass
                def value(self):
                    return 1
                def finalize(self):
                    try:
                        cur.execute("select 1")
                    except sqlite.ProgrammingError:
                        pass
                    return 1
            con.create_window_function("w", 1, Win)
            list(cur.execute("select w(x) over (order by x) from t"))
            assert con.execute("select 1").fetchone() == (1,)
            con.close()
            """
        )

    def test_gc_in_window_finalize(self):
        self._run(
            """
            import gc
            con = sqlite.connect(":memory:")
            con.execute("create table t(x integer)")
            con.executemany("insert into t values (?)", [(i,) for i in range(3)])
            class Win:
                def step(self, value):
                    pass
                def inverse(self, value):
                    pass
                def value(self):
                    return 1
                def finalize(self):
                    try:
                        con.close()
                    except sqlite.ProgrammingError:
                        pass
                    return 1
            con.create_window_function("w", 1, Win)
            cur = con.execute("select w(x) over (order by x) from t")
            cur.fetchone()
            del cur
            gc.collect()
            assert con.execute("select 1").fetchone() == (1,)
            con.close()
            """
        )

    def test_cursor_close_in_udf(self):
        self._run(
            """
            con = sqlite.connect(":memory:")
            cur = con.cursor()
            def callback():
                try:
                    cur.close()
                except sqlite.ProgrammingError:
                    raise
                else:
                    raise AssertionError("cursor close() should have been refused")
                return 1
            con.create_function("f", 0, callback)
            try:
                cur.execute("select f()")
            except sqlite.Error:
                pass
            else:
                raise AssertionError("expected execute to fail after a refused cursor close")
            assert con.execute("select 1").fetchone() == (1,)
            con.close()
            """
        )

    def test_cursor_close_in_converter(self):
        self._run(
            """
            def conv(value):
                try:
                    cur.close()
                except sqlite.ProgrammingError:
                    raise
                else:
                    raise AssertionError("cursor close() should have been refused")
            sqlite.register_converter("X", conv)
            con = sqlite.connect(":memory:", detect_types=sqlite.PARSE_COLNAMES)
            cur = con.cursor()
            cur.execute("create table t(a, b)")
            cur.execute("insert into t values (1, 2)")
            try:
                cur.execute('select a as "a [X]", b as "b [X]" from t')
                cur.fetchall()
            except sqlite.Error:
                pass
            else:
                raise AssertionError("expected fetch to fail after a refused cursor close")
            assert con.execute("select 1").fetchone() == (1,)
            con.close()
            """
        )

    def test_close_in_open_blob_busy_handler(self):
        self._run(
            """
            import os
            import tempfile
            fd, path = tempfile.mkstemp(suffix=".db")
            os.close(fd)
            try:
                locker = sqlite.connect(path)
                locker.execute("create table t(b blob)")
                locker.execute("insert into t values (zeroblob(8))")
                locker.commit()
                locker.execute("begin exclusive")
                con = sqlite.connect(path, timeout=0)
                def busy(n):
                    try:
                        con.close()
                    except sqlite.ProgrammingError:
                        raise
                    else:
                        raise AssertionError("close() should have been refused")
                    return 0
                con.set_busy_handler(busy)
                try:
                    con.open_blob("t", "b", 1)
                except sqlite.Error:
                    pass
                else:
                    raise AssertionError("expected open_blob to fail after a refused close")
                con.set_busy_handler(None)
                locker.rollback()
                assert con.execute("select 1").fetchone() == (1,)
                con.close()
                locker.close()
            finally:
                os.unlink(path)
            """
        )

    def test_create_function_replace_destructor_close(self):
        self._run(
            """
            class Closer:
                def __init__(self, con):
                    self.con = con
                def __call__(self):
                    return 1
                def __del__(self):
                    try:
                        self.con.close()
                    except sqlite.ProgrammingError:
                        pass
            con = sqlite.connect(":memory:")
            old = Closer(con)
            con.create_function("f", 0, old)
            del old
            con.create_function("f", 0, lambda: 2)
            assert con.execute("select f()").fetchone() == (2,)
            con.close()
            """
        )

    def test_cursor_init_in_udf(self):
        # Re-init used to Py_CLEAR the live statement while execute still
        # held it. CPython refuses recursive cursor use here.
        self._run(
            """
            con = sqlite.connect(":memory:")
            cur = con.cursor()
            def callback():
                try:
                    cur.__init__(con)
                except sqlite.ProgrammingError:
                    raise
                else:
                    raise AssertionError("cursor __init__ should have been refused")
                return 1
            con.create_function("f", 0, callback)
            try:
                cur.execute("select f()")
            except sqlite.Error:
                pass
            else:
                raise AssertionError("expected execute to fail after a refused cursor __init__")
            assert con.execute("select 1").fetchone() == (1,)
            con.close()
            """
        )

    def test_cursor_init_in_converter(self):
        self._run(
            """
            def conv(value):
                try:
                    cur.__init__(con)
                except sqlite.ProgrammingError:
                    raise
                else:
                    raise AssertionError("cursor __init__ should have been refused")
            sqlite.register_converter("X", conv)
            con = sqlite.connect(":memory:", detect_types=sqlite.PARSE_COLNAMES)
            cur = con.cursor()
            cur.execute("create table t(a)")
            cur.execute("insert into t values (1)")
            try:
                cur.execute('select a as "a [X]" from t')
                cur.fetchall()
            except sqlite.Error:
                pass
            else:
                raise AssertionError("expected fetch to fail after a refused cursor __init__")
            assert con.execute("select 1").fetchone() == (1,)
            con.close()
            """
        )

    def test_cursor_init_in_conform(self):
        self._run(
            """
            con = sqlite.connect(":memory:")
            cur = con.cursor()
            cur.execute("create table t(x)")
            class Payload:
                def __conform__(self, protocol):
                    try:
                        cur.__init__(con)
                    except sqlite.ProgrammingError:
                        raise
                    else:
                        raise AssertionError("cursor __init__ should have been refused")
            try:
                cur.execute("insert into t values (?)", (Payload(),))
            except sqlite.Error:
                pass
            else:
                raise AssertionError("expected execute to fail after a refused cursor __init__")
            assert con.execute("select 1").fetchone() == (1,)
            con.close()
            """
        )

    def test_reinit_from_destructor_refused(self):
        # Re-init used to set initialized=0 before closing the old
        # handle, so an xDestroy __del__ could __init__ again, leak the
        # inner db, and drop work already committed on the outer handle.
        self._run(
            """
            events = []
            class Fn:
                def __call__(self):
                    return 1
                def __del__(self):
                    try:
                        con.__init__(":memory:")
                        events.append("allowed")
                    except sqlite.ProgrammingError:
                        events.append("refused")
            con = sqlite.connect(":memory:")
            con.execute("create table keep(x)")
            con.execute("insert into keep values (1)")
            con.commit()
            con.create_function("f", 0, Fn())
            con.__init__(":memory:")
            assert events == ["refused"], events
            con.execute("create table t(x)")
            assert con.execute("select count(*) from t").fetchone()[0] == 0
            con.close()
            """
        )

    def test_reinit_orphan_statement_does_not_corrupt_next_connection(self):
        # Re-init used to Py_CLEAR the statements list without NULLing
        # borrowed statement->connection pointers. del con then missed
        # those orphans in the dealloc walk.
        self._run(
            """
            bad = []
            class Fn:
                victim = None
                def __call__(self):
                    return 1
                def __del__(self):
                    if self.victim is not None:
                        try:
                            self.victim.close()
                        except sqlite.ProgrammingError as e:
                            bad.append(str(e))
            con = sqlite.connect(":memory:")
            fn = Fn()
            con.create_function("f", 0, fn)
            stmt = con("select f()")
            con.__init__(":memory:")
            del con
            victim = sqlite.connect(":memory:")
            fn.victim = victim
            del fn
            del stmt
            assert not bad, bad
            victim.close()
            """
        )

    def test_execute_commit_in_window_finalize_during_rollback(self):
        # commit() is guarded; execute("COMMIT") used to bypass it.
        self._run(
            """
            con = sqlite.connect(":memory:")
            con.execute("create table t(x integer)")
            con.executemany("insert into t values (?)", [(i,) for i in range(3)])
            con.commit()
            con.execute("insert into t values (4)")
            class Win:
                def step(self, value):
                    pass
                def inverse(self, value):
                    pass
                def value(self):
                    return 1
                def finalize(self):
                    try:
                        con.execute("COMMIT")
                    except sqlite.ProgrammingError:
                        pass
                    return 1
            con.create_window_function("w", 1, Win)
            cur = con.execute("select w(x) over (order by x) from t")
            cur.fetchone()
            con.rollback()
            assert con.execute("select count(*) from t").fetchone()[0] == 3, (
                "execute(COMMIT) from window finalize must not preserve a rolled-back insert"
            )
            con.close()
            """
        )

    def test_comment_prefixed_commit_in_window_finalize_during_rollback(self):
        self._run(
            """
            con = sqlite.connect(":memory:")
            con.execute("create table t(x integer)")
            con.executemany("insert into t values (?)", [(i,) for i in range(3)])
            con.commit()
            con.execute("insert into t values (4)")
            class Win:
                def step(self, value):
                    pass
                def inverse(self, value):
                    pass
                def value(self):
                    return 1
                def finalize(self):
                    try:
                        con.execute("/*x*/COMMIT")
                    except sqlite.ProgrammingError:
                        pass
                    try:
                        con.execute("COMMIT--x")
                    except sqlite.ProgrammingError:
                        pass
                    return 1
            con.create_window_function("w", 1, Win)
            cur = con.execute("select w(x) over (order by x) from t")
            cur.fetchone()
            con.rollback()
            assert con.execute("select count(*) from t").fetchone()[0] == 3
            con.close()
            """
        )

    def test_same_cursor_execute_in_window_finalize_during_rollback(self):
        self._run(
            """
            con = sqlite.connect(":memory:")
            con.execute("create table t(x integer)")
            con.executemany("insert into t values (?)", [(i,) for i in range(3)])
            con.commit()
            cur = con.cursor()
            class Win:
                def step(self, value):
                    pass
                def inverse(self, value):
                    pass
                def value(self):
                    return 1
                def finalize(self):
                    try:
                        cur.execute("select 1")
                    except sqlite.ProgrammingError:
                        pass
                    return 1
            con.create_window_function("w", 1, Win)
            cur.execute("select w(x) over (order by x) from t")
            cur.fetchone()
            con.rollback()
            assert con.execute("select 1").fetchone() == (1,)
            con.close()
            """
        )

    def test_open_blob_from_function_destructor(self):
        self._run(
            """
            import os
            import tempfile
            fd, path = tempfile.mkstemp(suffix=".db")
            os.close(fd)
            try:
                con = sqlite.connect(path)
                con.execute("create table t(b blob)")
                con.execute("insert into t values (zeroblob(8))")
                con.commit()
                class Fn:
                    def __call__(self):
                        return 1
                    def __del__(self):
                        try:
                            con.open_blob("t", "b", 1)
                        except sqlite.ProgrammingError:
                            pass
                con.create_function("f", 0, Fn())
                con.close()
            finally:
                os.unlink(path)
            """
        )

    def test_cursor_created_in_finalize_stays_usable(self):
        # rollback() locks every live cursor around the reset so a window
        # finalize cannot re-enter execute() on the statement being
        # reset. A cursor the finalize creates used to receive the
        # matching unlock without ever being locked, leaving it stuck
        # with "Recursive use of cursors not allowed".
        self._run(
            """
            con = sqlite.connect(":memory:")
            con.execute("create table t(x integer)")
            con.executemany("insert into t values (?)", [(i,) for i in range(3)])
            created = []
            class Win:
                def step(self, value):
                    pass
                def inverse(self, value):
                    pass
                def value(self):
                    return 1
                def finalize(self):
                    created.append(con.cursor())
                    return 1
            con.create_window_function("w", 1, Win)
            cur = con.execute("select w(x) over (order by x) from t")
            cur.fetchone()
            con.rollback()
            assert len(created) == 1, created
            assert created[0].execute("select 1").fetchone() == (1,)
            con.close()
            """
        )

    def test_callbacks_may_query_and_register(self):
        # Nothing here tears a handle down, so it stays allowed: a
        # callback may run its own query on the connection and register
        # a new function. SQLite itself refuses to replace a function or
        # collation while a statement is active.
        self._run(
            """
            con = sqlite.connect(":memory:")
            con.execute("create table t(x integer)")
            con.execute("insert into t values (1), (2), (3)")
            def total():
                return con.execute("select sum(x) from t").fetchone()[0]
            con.create_function("total", 0, total)
            assert con.execute("select total()").fetchone() == (6,)
            def register():
                con.create_function("late", 0, lambda: 7)
                con.create_collation("late_c", lambda a, b: (a > b) - (a < b))
                return 1
            con.create_function("register", 0, register)
            con.execute("select register()").fetchone()
            assert con.execute("select late()").fetchone() == (7,)
            assert [r[0] for r in con.execute(
                "select x from t order by x collate late_c desc"
            )] == [3, 2, 1]
            def replace():
                try:
                    con.create_function("replace", 0, lambda: 0)
                except sqlite.OperationalError:
                    return "busy"
                return "replaced"
            con.create_function("replace", 0, replace)
            assert con.execute("select replace()").fetchone() == ("busy",)
            con.close()
            """
        )

    def test_connection_methods_from_function_destructor_during_close(self):
        # close() publishes the connection as closed before
        # sqlite3_close_v2 destroys the registered functions, so a
        # callable's __del__ fired there sees "closed database" from
        # every entry point. Before, the methods reached the zombie
        # handle; sqlite3_blob_open walked freed structures.
        self._run(
            """
            results = {}
            def attempt(name, fn):
                try:
                    fn()
                    results[name] = "allowed"
                except sqlite.ProgrammingError:
                    results[name] = "refused"
            class Fn:
                def __call__(self):
                    return 1
                def __del__(self):
                    attempt("in_transaction", lambda: con.in_transaction)
                    attempt("total_changes", lambda: con.total_changes)
                    attempt("isolation_level", lambda: setattr(con, "isolation_level", None))
                    attempt("interrupt", con.interrupt)
                    attempt("set_busy_timeout", lambda: con.set_busy_timeout(1.0))
                    attempt("set_busy_handler", lambda: con.set_busy_handler(lambda n: 0))
                    attempt("enable_load_extension", lambda: con.enable_load_extension(True))
                    attempt("__call__", lambda: con("select 1"))
                    attempt("cursor", con.cursor)
                    attempt("execute", lambda: con.execute("select 1"))
                    attempt("executescript", lambda: con.executescript("select 1;"))
                    attempt("commit", con.commit)
                    attempt("rollback", con.rollback)
                    attempt("create_function", lambda: con.create_function("z", 0, lambda: 0))
                    attempt("create_aggregate", lambda: con.create_aggregate("za", 1, Fn))
                    attempt("create_window_function", lambda: con.create_window_function("zw", 1, Fn))
                    attempt("create_collation", lambda: con.create_collation("zc", lambda a, b: 0))
                    attempt("set_authorizer", lambda: con.set_authorizer(lambda *a: 0))
                    attempt("set_progress_handler", lambda: con.set_progress_handler(lambda: 0, 1))
                    attempt("set_trace_callback", lambda: con.set_trace_callback(lambda s: None))
                    attempt("open_blob", lambda: con.open_blob("t", "b", 1))
                    attempt("backup", lambda: con.backup(sqlite.connect(":memory:")))
                    attempt("__exit__", lambda: con.__exit__(None, None, None))
                    attempt("close", con.close)
                    attempt("__init__", lambda: con.__init__(":memory:"))
            con = sqlite.connect(":memory:")
            con.execute("create table t(b blob)")
            con.execute("insert into t values (zeroblob(4))")
            con.commit()
            con.create_function("f", 0, Fn())
            con.close()
            allowed = sorted(k for k, v in results.items() if v != "refused")
            assert len(results) == 25 and not allowed, (len(results), allowed)
            """
        )

    def test_orphan_statement_does_not_corrupt_next_connection(self):
        # Statement.connection is borrowed. dealloc used to free the
        # Connection while an orphan con("sql") still wrote in_sqlite
        # into that heap, so a later Connection that reused the slot
        # saw a callback in progress.
        #
        # The enter/leave pair around finalize nets to zero, so the
        # corruption is only visible *during* the finalize. Finalizing
        # the orphan closes the zombie db, which destroys the registered
        # function; its __del__ runs at exactly that moment and probes
        # the victim. pymalloc hands the freed Connection block to the
        # next same-sized allocation, so the victim reuses the slot.
        self._run(
            """
            bad = []
            class Fn:
                victim = None
                def __call__(self):
                    return 1
                def __del__(self):
                    if self.victim is not None:
                        try:
                            self.victim.close()
                        except sqlite.ProgrammingError as e:
                            bad.append(str(e))
            con = sqlite.connect(":memory:")
            fn = Fn()
            con.create_function("f", 0, fn)
            stmt = con("select f()")
            del con
            victim = sqlite.connect(":memory:")
            fn.victim = victim
            del fn
            del stmt
            assert not bad, bad
            """
        )

    def test_close_from_function_destructor(self):
        # sqlite3_close_v2 destroys registered functions; a callable
        # whose only reference is SQLite's runs __del__ from inside
        # close(). Re-entering close() there used to reach SQLite as
        # API misuse; it is now refused like any other callback.
        self._run(
            """
            events = []
            class Fn:
                def __call__(self):
                    return 1
                def __del__(self):
                    try:
                        con.close()
                    except sqlite.ProgrammingError as e:
                        events.append(str(e))
            con = sqlite.connect(":memory:")
            con.create_function("f", 0, Fn())
            con.close()
            assert events == [
                "Cannot close the database connection from within a callback function."
            ], events
            try:
                con.execute("select 1")
            except sqlite.ProgrammingError:
                pass
            else:
                raise AssertionError("connection should be closed")
            """
        )

    def test_commit_in_window_finalize_during_rollback(self):
        # rollback() resets live statements; window xFinal runs there.
        # SQLite accepts COMMIT during that reset, so an unguarded
        # commit() turned rollback into a commit.
        self._run(
            """
            con = sqlite.connect(":memory:")
            con.execute("create table t(x integer)")
            con.executemany("insert into t values (?)", [(i,) for i in range(3)])
            con.commit()
            con.execute("insert into t values (4)")
            class Win:
                def step(self, value):
                    pass
                def inverse(self, value):
                    pass
                def value(self):
                    return 1
                def finalize(self):
                    try:
                        con.commit()
                    except sqlite.ProgrammingError:
                        pass
                    return 1
            con.create_window_function("w", 1, Win)
            cur = con.execute("select w(x) over (order by x) from t")
            cur.fetchone()
            con.rollback()
            assert con.execute("select count(*) from t").fetchone()[0] == 3, (
                "commit from window finalize must not preserve a rolled-back insert"
            )
            con.close()
            """
        )


class StatementLifetimeRegressionTests(unittest.TestCase):
    def test_function_destructor_after_connection_close(self):
        # Isolate native crashes so a missing GIL reports a test failure rather
        # than taking down the suite. All three registration APIs share xDestroy.
        for registration in (
            "create_function",
            "create_aggregate",
            "create_window_function",
        ):
            for lifetime in ("failed", "active", "orphan"):
                with self.subTest(registration=registration, lifetime=lifetime):
                    result = subprocess.run(
                        [
                            sys.executable,
                            "-X",
                            "faulthandler",
                            "-c",
                            textwrap.dedent("""
                            import gc
                            import sys
                            import weakref
                            from sqlean import dbapi2 as sqlite

                            registration, lifetime = sys.argv[1:]
                            con = sqlite.connect(":memory:")
                            callback = lambda *args: 1
                            ref = weakref.ref(callback)
                            getattr(con, registration)("f", 1, callback)
                            del callback

                            if lifetime == "orphan":
                                # A directly prepared Statement does not own the
                                # Connection. Its finalization closes the zombie
                                # with the GIL released, even when every cursor
                                # statement is correctly tracked by close().
                                statement = con("select 1")
                                del con
                                assert ref() is not None
                                del statement
                            else:
                                cursors = [con.cursor(), con.cursor()]
                                if lifetime == "failed":
                                    con.execute("create table t(x unique)")
                                    con.execute("insert into t values (1)")
                                    for cursor in cursors:
                                        try:
                                            cursor.execute("insert into t values (1)")
                                        except sqlite.IntegrityError:
                                            pass
                                        else:
                                            raise AssertionError("constraint did not fail")
                                    del cursor
                                else:
                                    # The second cursor needs an uncached copy
                                    # while the first is still using this SQL.
                                    for cursor in cursors:
                                        cursor.execute("select 1 union all select 2")
                                    del cursor
                                con.close()
                                released_at_close = ref() is None
                                del con, cursors
                                gc.collect()
                                assert released_at_close, "close left a live statement"
                            gc.collect()
                            assert ref() is None, "registered callback leaked"
                        """),
                            registration,
                            lifetime,
                        ],
                        cwd=Path(__file__).resolve().parents[1],
                        capture_output=True,
                        text=True,
                        timeout=30,
                    )
                    self.assertEqual(
                        result.returncode, 0, result.stdout + result.stderr
                    )


class CursorRegressionTests(unittest.TestCase):
    def setUp(self):
        self.cx = sqlite.connect(":memory:")
        self.cx.execute("create table test(i int)")
        self.cx.executemany(
            "insert into test(i) values (?)", [(i,) for i in range(10)]
        )

    def tearDown(self):
        self.cx.close()

    def test_fetchmany_nonpositive_size(self):
        # fetchmany(0) and negative sizes used to return every
        # remaining row.
        cur = self.cx.execute("select i from test")
        self.assertEqual(cur.fetchmany(0), [])
        self.assertEqual(cur.fetchmany(-1), [])
        self.assertEqual(len(cur.fetchmany(3)), 3)

    def test_converter_cannot_reenter_cursor(self):
        # A detect_types converter re-entering execute() on the same
        # cursor used to reset the statement out from under the active
        # fetch.  The first row is fetched inside execute() (which was
        # already locked); re-entering on the second row exercises the
        # previously unlocked iteration path.
        cx = sqlite.connect(":memory:", detect_types=sqlite.PARSE_COLNAMES)
        try:
            cx.execute("create table test(i int)")
            cx.executemany("insert into test(i) values (?)", [(1,), (2,)])
            cur = cx.cursor()

            def reenter(value):
                if value == b"2":
                    cur.execute("select 3")
                return value

            sqlite.register_converter("reenter", reenter)
            try:
                # execute() itself succeeds: only row 1 is fetched there.
                cur.execute('select i as "i [reenter]" from test order by i')
                # The first fetch prefetches row 2, where the
                # converter's re-entrant execute() must be rejected.
                with self.assertRaises(sqlite.ProgrammingError):
                    cur.fetchall()
            finally:
                del sqlite.converters["REENTER"]
        finally:
            cx.close()

    def test_udf_text_with_embedded_nul(self):
        # Function arguments and results were marshalled with
        # NUL-terminated string APIs, truncating TEXT values at the
        # first embedded NUL byte in both directions.
        self.cx.create_function("gen", 0, lambda: "a\x00b")
        self.cx.create_function("echo", 1, lambda v: v)
        # Result direction: the full value reaches SQLite.  (length()
        # deliberately counts only up to the first NUL; octet_length()
        # reports the stored bytes.)
        self.assertEqual(
            self.cx.execute("select octet_length(gen())").fetchone()[0], 3
        )
        # Argument direction: the full value reaches Python.
        self.assertEqual(self.cx.execute("select echo(gen())").fetchone()[0], "a\x00b")

    def test_progress_handler_bad_return(self):
        # A progress-handler return value that fails truth-testing used
        # to leave the exception set across PyGILState_Release,
        # surfacing at an arbitrary later point.
        class BadBool:
            def __bool__(self):
                raise RuntimeError("boom")

        self.cx.set_progress_handler(lambda: BadBool(), 1)
        try:
            with self.assertRaises(sqlite.OperationalError):
                self.cx.execute("select 1")
        finally:
            self.cx.set_progress_handler(None, 1)
        # The handler's exception must not leak into unrelated calls.
        self.assertEqual(self.cx.execute("select 2").fetchone()[0], 2)

    def test_load_extension_failure(self):
        # A failed load raises cleanly (and no longer leaks the SQLite
        # error message buffer, which is not observable from here).
        if not hasattr(self.cx, "enable_load_extension"):
            self.skipTest("load-extension support not compiled in")
        self.cx.enable_load_extension(True)
        try:
            with self.assertRaises(sqlite.OperationalError):
                self.cx.load_extension("no-such-extension")
        finally:
            self.cx.enable_load_extension(False)


class RowRegressionTests(unittest.TestCase):
    def test_row_over_uninitialized_cursor(self):
        # Row() over a cursor created without __init__ crashed in
        # Py_INCREF(NULL) on the cursor's description.
        cursor = sqlite.Cursor.__new__(sqlite.Cursor)
        with self.assertRaises(sqlite.ProgrammingError):
            sqlite.Row(cursor, ())

    def test_row_hash(self):
        # Row.__hash__ XORed two PyObject_Hash results without checking
        # for -1 (error).
        cx = sqlite.connect(":memory:")
        try:
            cx.row_factory = sqlite.Row
            row = cx.execute("select 1 as a, 2 as b").fetchone()
            self.assertNotEqual(hash(row), -1)
            self.assertEqual(hash(row), hash(row))
        finally:
            cx.close()


def suite():
    loader = unittest.TestLoader()
    return unittest.TestSuite(
        (
            loader.loadTestsFromTestCase(BlobRegressionTests),
            loader.loadTestsFromTestCase(FactoryMemberRegressionTests),
            loader.loadTestsFromTestCase(BusyHandlerRegressionTests),
            loader.loadTestsFromTestCase(ConnectionLifecycleRegressionTests),
            loader.loadTestsFromTestCase(CallbackCloseRegressionTests),
            loader.loadTestsFromTestCase(StatementLifetimeRegressionTests),
            loader.loadTestsFromTestCase(CursorRegressionTests),
            loader.loadTestsFromTestCase(RowRegressionTests),
        )
    )


def test():
    runner = unittest.TextTestRunner()
    runner.run(suite())


if __name__ == "__main__":
    test()
