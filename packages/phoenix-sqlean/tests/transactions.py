#-*- coding: iso-8859-1 -*-
# pysqlite2/test/transactions.py: tests transactions
#
# Copyright (C) 2005-2007 Gerhard H�ring <gh@ghaering.de>
#
# This file is part of pysqlite.
#
# This software is provided 'as-is', without any express or implied
# warranty.  In no event will the authors be held liable for any damages
# arising from the use of this software.
#
# Permission is granted to anyone to use this software for any purpose,
# including commercial applications, and to alter it and redistribute it
# freely, subject to the following restrictions:
#
# 1. The origin of this software must not be misrepresented; you must not
#    claim that you wrote the original software. If you use this software
#    in a product, an acknowledgment in the product documentation would be
#    appreciated but is not required.
# 2. Altered source versions must be plainly marked as such, and must not be
#    misrepresented as being the original software.
# 3. This notice may not be removed or altered from any source distribution.

import glob, os, unittest
from sqlean import dbapi2 as sqlite

def get_db_path():
    return "sqlite_testdb"

class TransactionTests(unittest.TestCase):
    def setUp(self):
        try:
            os.remove(get_db_path())
        except OSError:
            pass

        self.con1 = sqlite.connect(get_db_path(), timeout=0.1)
        self.cur1 = self.con1.cursor()

        self.con2 = sqlite.connect(get_db_path(), timeout=0.1)
        self.cur2 = self.con2.cursor()

    def tearDown(self):
        self.cur1.close()
        self.con1.close()

        self.cur2.close()
        self.con2.close()

        try:
            os.unlink(get_db_path())
        except OSError:
            pass

    def test_DMLDoesNotAutoCommitBefore(self):
        self.cur1.execute("create table test(i)")
        self.cur1.execute("insert into test(i) values (5)")
        self.cur1.execute("create table test2(j)")
        self.cur2.execute("select i from test")
        res = self.cur2.fetchall()
        self.assertEqual(len(res), 0)

    def test_InsertStartsTransaction(self):
        self.cur1.execute("create table test(i)")
        self.cur1.execute("insert into test(i) values (5)")
        self.cur2.execute("select i from test")
        res = self.cur2.fetchall()
        self.assertEqual(len(res), 0)

    def test_UpdateStartsTransaction(self):
        self.cur1.execute("create table test(i)")
        self.cur1.execute("insert into test(i) values (5)")
        self.con1.commit()
        self.cur1.execute("update test set i=6")
        self.cur2.execute("select i from test")
        res = self.cur2.fetchone()[0]
        self.assertEqual(res, 5)

    def test_DeleteStartsTransaction(self):
        self.cur1.execute("create table test(i)")
        self.cur1.execute("insert into test(i) values (5)")
        self.con1.commit()
        self.cur1.execute("delete from test")
        self.cur2.execute("select i from test")
        res = self.cur2.fetchall()
        self.assertEqual(len(res), 1)

    def test_ReplaceStartsTransaction(self):
        self.cur1.execute("create table test(i)")
        self.cur1.execute("insert into test(i) values (5)")
        self.con1.commit()
        self.cur1.execute("replace into test(i) values (6)")
        self.cur2.execute("select i from test")
        res = self.cur2.fetchall()
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0][0], 5)

    def test_ToggleAutoCommit(self):
        self.cur1.execute("create table test(i)")
        self.cur1.execute("insert into test(i) values (5)")
        self.con1.isolation_level = None
        self.assertEqual(self.con1.isolation_level, None)
        self.cur2.execute("select i from test")
        res = self.cur2.fetchall()
        self.assertEqual(len(res), 1)

        self.con1.isolation_level = "DEFERRED"
        self.assertEqual(self.con1.isolation_level , "DEFERRED")
        self.cur1.execute("insert into test(i) values (5)")
        self.cur2.execute("select i from test")
        res = self.cur2.fetchall()
        self.assertEqual(len(res), 1)

    @unittest.skipIf(sqlite.sqlite_version_info < (3, 2, 2),
                     'test hangs on sqlite versions older than 3.2.2')
    def test_RaiseTimeout(self):
        self.cur1.execute("create table test(i)")
        self.cur1.execute("insert into test(i) values (5)")
        with self.assertRaises(sqlite.OperationalError):
            self.cur2.execute("insert into test(i) values (5)")

    @unittest.skipIf(sqlite.sqlite_version_info < (3, 2, 2),
                     'test hangs on sqlite versions older than 3.2.2')
    def test_Locking(self):
        """
        This tests the improved concurrency with pysqlite 2.3.4. You needed
        to roll back con2 before you could commit con1.
        """
        self.cur1.execute("create table test(i)")
        self.cur1.execute("insert into test(i) values (5)")
        with self.assertRaises(sqlite.OperationalError):
            self.cur2.execute("insert into test(i) values (5)")
        # NO self.con2.rollback() HERE!!!
        self.con1.commit()

    def test_RollbackCursorConsistency(self):
        """
        Checks if cursors on the connection are set into a "reset" state
        when a rollback is done on the connection.
        """
        con = sqlite.connect(":memory:")
        cur = con.cursor()
        cur.execute("create table test(x)")
        cur.execute("insert into test(x) values (5)")
        cur.execute("select 1 union select 2 union select 3")

        con.rollback()
        with self.assertRaises(sqlite.InterfaceError):
            cur.fetchall()

class SpecialCommandTests(unittest.TestCase):
    def setUp(self):
        self.con = sqlite.connect(":memory:")
        self.cur = self.con.cursor()

    def test_DropTable(self):
        self.cur.execute("create table test(i)")
        self.cur.execute("insert into test(i) values (5)")
        self.cur.execute("drop table test")

    def test_Pragma(self):
        self.cur.execute("create table test(i)")
        self.cur.execute("insert into test(i) values (5)")
        self.cur.execute("pragma count_changes=1")

    def tearDown(self):
        self.cur.close()
        self.con.close()

class TransactionalDDL(unittest.TestCase):
    def setUp(self):
        self.con = sqlite.connect(":memory:")

    def test_DdlDoesNotAutostartTransaction(self):
        # For backwards compatibility reasons, DDL statements should not
        # implicitly start a transaction.
        self.con.execute("create table test(i)")
        self.con.rollback()
        result = self.con.execute("select * from test").fetchall()
        self.assertEqual(result, [])

        self.con.execute("alter table test rename to test2")
        self.con.rollback()
        result = self.con.execute("select * from test2").fetchall()
        self.assertEqual(result, [])

    def test_ImmediateTransactionalDDL(self):
        # You can achieve transactional DDL by issuing a BEGIN
        # statement manually.
        self.con.execute("begin immediate")
        self.con.execute("create table test(i)")
        self.con.rollback()
        with self.assertRaises(sqlite.OperationalError):
            self.con.execute("select * from test")

    def test_TransactionalDDL(self):
        # You can achieve transactional DDL by issuing a BEGIN
        # statement manually.
        self.con.execute("begin")
        self.con.execute("create table test(i)")
        self.con.rollback()
        with self.assertRaises(sqlite.OperationalError):
            self.con.execute("select * from test")

    def tearDown(self):
        self.con.close()


class DMLStatementDetectionTestCase(unittest.TestCase):
    """
    https://bugs.python.org/issue36859

    Use sqlite3_stmt_readonly to determine if the statement is DML or not.
    """
    def setUp(self):
        for f in glob.glob(get_db_path() + '*'):
            try:
                os.unlink(f)
            except OSError:
                pass
    tearDown = setUp

    @unittest.skipIf(sqlite.sqlite_version_info < (3, 8, 3),
                     'needs sqlite 3.8.3 or newer')
    def test_dml_detection_cte(self):
        conn = sqlite.connect(':memory:')
        conn.execute('create table kv ("key" text, "val" integer)')
        self.assertFalse(conn.in_transaction)
        conn.execute('insert into kv (key, val) values (?, ?), (?, ?)',
                     ('k1', 1, 'k2', 2))
        self.assertTrue(conn.in_transaction)

        conn.commit()
        self.assertFalse(conn.in_transaction)

        rc = conn.execute('update kv set val=val + ?', (10,))
        self.assertEqual(rc.rowcount, 2)
        self.assertTrue(conn.in_transaction)
        conn.commit()
        self.assertFalse(conn.in_transaction)

        rc = conn.execute('with c(k, v) as (select key, val + ? from kv) '
                          'update kv set val=(select v from c where k=kv.key)',
                          (100,))
        self.assertEqual(rc.rowcount, 2)
        self.assertTrue(conn.in_transaction)

        curs = conn.execute('select key, val from kv order by key')
        self.assertEqual(curs.fetchall(), [('k1', 111), ('k2', 112)])

    def test_dml_detection_sql_comment(self):
        conn = sqlite.connect(':memory:')
        conn.execute('create table kv ("key" text, "val" integer)')
        conn.execute('insert into kv (key, val) values (?, ?), (?, ?)',
                     ('k1', 1, 'k2', 2))
        conn.commit()

        self.assertFalse(conn.in_transaction)
        rc = conn.execute('-- a comment\nupdate kv set val=val + ?', (10,))
        self.assertEqual(rc.rowcount, 2)
        self.assertTrue(conn.in_transaction)

        curs = conn.execute('select key, val from kv order by key')
        self.assertEqual(curs.fetchall(), [('k1', 11), ('k2', 12)])
        conn.rollback()

    def test_dml_detection_begin_exclusive(self):
        conn = sqlite.connect(':memory:')
        conn.execute('begin exclusive')
        self.assertTrue(conn.in_transaction)
        conn.execute('rollback')
        self.assertFalse(conn.in_transaction)

    def test_dml_detection_vacuum(self):
        conn = sqlite.connect(':memory:')
        conn.execute('vacuum')
        self.assertFalse(conn.in_transaction)

    def test_dml_detection_pragma(self):
        conn = sqlite.connect(get_db_path())
        conn.execute('pragma journal_mode=\'wal\'')
        jmode, = conn.execute('pragma journal_mode').fetchone()
        self.assertEqual(jmode, 'wal')
        self.assertFalse(conn.in_transaction)


def suite():
    loader = unittest.TestLoader()
    tests = [loader.loadTestsFromTestCase(t) for t in (
        TransactionTests,
        SpecialCommandTests,
        TransactionalDDL,
        DMLStatementDetectionTestCase)]
    return unittest.TestSuite(tests)

def test():
    runner = unittest.TextTestRunner()
    runner.run(suite())

if __name__ == "__main__":
    test()
