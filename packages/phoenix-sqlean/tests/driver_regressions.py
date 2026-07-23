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
import sys
import threading
import unittest
import weakref

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
            loader.loadTestsFromTestCase(CursorRegressionTests),
            loader.loadTestsFromTestCase(RowRegressionTests),
        )
    )


def test():
    runner = unittest.TextTestRunner()
    runner.run(suite())


if __name__ == "__main__":
    test()
