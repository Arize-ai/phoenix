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


def suite():
    loader = unittest.TestLoader()
    return unittest.TestSuite(
        (
            loader.loadTestsFromTestCase(BlobRegressionTests),
        )
    )


def test():
    runner = unittest.TextTestRunner()
    runner.run(suite())


if __name__ == "__main__":
    test()
