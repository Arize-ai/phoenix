#-*- coding: iso-8859-1 -*-
# pysqlite2/test/hooks.py: tests for various SQLite-specific hooks
#
# Copyright (C) 2006-2007 Gerhard H�ring <gh@ghaering.de>
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

import os
import unittest
from sqlean import dbapi2 as sqlite


class CollationTests(unittest.TestCase):
    def test_CreateCollationNotString(self):
        con = sqlite.connect(":memory:")
        with self.assertRaises(TypeError):
            con.create_collation(None, lambda x, y: (x > y) - (x < y))

    def test_CreateCollationNotCallable(self):
        con = sqlite.connect(":memory:")
        with self.assertRaises(TypeError) as cm:
            con.create_collation("X", 42)
        self.assertEqual(str(cm.exception), 'parameter must be callable')

    def test_CreateCollationNotAscii(self):
        con = sqlite.connect(":memory:")
        con.create_collation("coll�", lambda x, y: (x > y) - (x < y))

    def test_CreateCollationBadUpper(self):
        class BadUpperStr(str):
            def upper(self):
                return None
        con = sqlite.connect(":memory:")
        mycoll = lambda x, y: -((x > y) - (x < y))
        con.create_collation(BadUpperStr("mycoll"), mycoll)
        result = con.execute("""
            select x from (
            select 'a' as x
            union
            select 'b' as x
            ) order by x collate mycoll
            """).fetchall()
        self.assertEqual(result[0][0], 'b')
        self.assertEqual(result[1][0], 'a')

    @unittest.skipIf(sqlite.sqlite_version_info < (3, 2, 1),
                     'old SQLite versions crash on this test')
    def test_CollationIsUsed(self):
        def mycoll(x, y):
            # reverse order
            return -((x > y) - (x < y))

        con = sqlite.connect(":memory:")
        con.create_collation("mycoll", mycoll)
        sql = """
            select x from (
            select 'a' as x
            union
            select 'b' as x
            union
            select 'c' as x
            ) order by x collate mycoll
            """
        result = con.execute(sql).fetchall()
        self.assertEqual(result, [('c',), ('b',), ('a',)],
                         msg='the expected order was not returned')

        con.create_collation("mycoll", None)
        with self.assertRaises(sqlite.OperationalError) as cm:
            result = con.execute(sql).fetchall()
        self.assertEqual(str(cm.exception), 'no such collation sequence: mycoll')

    def test_CollationReturnsLargeInteger(self):
        def mycoll(x, y):
            # reverse order
            return -((x > y) - (x < y)) * 2**32
        con = sqlite.connect(":memory:")
        con.create_collation("mycoll", mycoll)
        sql = """
            select x from (
            select 'a' as x
            union
            select 'b' as x
            union
            select 'c' as x
            ) order by x collate mycoll
            """
        result = con.execute(sql).fetchall()
        self.assertEqual(result, [('c',), ('b',), ('a',)],
                         msg="the expected order was not returned")

    def test_CollationRegisterTwice(self):
        """
        Register two different collation functions under the same name.
        Verify that the last one is actually used.
        """
        con = sqlite.connect(":memory:")
        con.create_collation("mycoll", lambda x, y: (x > y) - (x < y))
        con.create_collation("mycoll", lambda x, y: -((x > y) - (x < y)))
        result = con.execute("""
            select x from (select 'a' as x union select 'b' as x) order by x collate mycoll
            """).fetchall()
        self.assertEqual(result[0][0], 'b')
        self.assertEqual(result[1][0], 'a')

    def test_DeregisterCollation(self):
        """
        Register a collation, then deregister it. Make sure an error is raised if we try
        to use it.
        """
        con = sqlite.connect(":memory:")
        con.create_collation("mycoll", lambda x, y: (x > y) - (x < y))
        con.create_collation("mycoll", None)
        with self.assertRaises(sqlite.OperationalError) as cm:
            con.execute("select 'a' as x union select 'b' as x order by x collate mycoll")
        self.assertEqual(str(cm.exception), 'no such collation sequence: mycoll')

class ProgressTests(unittest.TestCase):
    def test_ProgressHandlerUsed(self):
        """
        Test that the progress handler is invoked once it is set.
        """
        con = sqlite.connect(":memory:")
        progress_calls = []
        def progress():
            progress_calls.append(None)
            return 0
        con.set_progress_handler(progress, 1)
        con.execute("""
            create table foo(a, b)
            """)
        self.assertTrue(progress_calls)


    def test_OpcodeCount(self):
        """
        Test that the opcode argument is respected.
        """
        con = sqlite.connect(":memory:")
        progress_calls = []
        def progress():
            progress_calls.append(None)
            return 0
        con.set_progress_handler(progress, 1)
        curs = con.cursor()
        curs.execute("""
            create table foo (a, b)
            """)
        first_count = len(progress_calls)
        progress_calls = []
        con.set_progress_handler(progress, 2)
        curs.execute("""
            create table bar (a, b)
            """)
        second_count = len(progress_calls)
        self.assertGreaterEqual(first_count, second_count)

    def test_CancelOperation(self):
        """
        Test that returning a non-zero value stops the operation in progress.
        """
        con = sqlite.connect(":memory:")
        def progress():
            return 1
        con.set_progress_handler(progress, 1)
        curs = con.cursor()
        self.assertRaises(
            sqlite.OperationalError,
            curs.execute,
            "create table bar (a, b)")

    def test_ClearHandler(self):
        """
        Test that setting the progress handler to None clears the previously set handler.
        """
        con = sqlite.connect(":memory:")
        action = 0
        def progress():
            nonlocal action
            action = 1
            return 0
        con.set_progress_handler(progress, 1)
        con.set_progress_handler(None, 1)
        con.execute("select 1 union select 2 union select 3").fetchall()
        self.assertEqual(action, 0, "progress handler was not cleared")

class TraceCallbackTests(unittest.TestCase):
    def test_TraceCallbackUsed(self):
        """
        Test that the trace callback is invoked once it is set.
        """
        con = sqlite.connect(":memory:")
        traced_statements = []
        def trace(statement):
            traced_statements.append(statement)
        con.set_trace_callback(trace)
        con.execute("create table foo(a, b)")
        self.assertTrue(traced_statements)
        self.assertTrue(any("create table foo" in stmt for stmt in traced_statements))

    def test_TraceCallbackError(self):
        """
        Test behavior when exception raised in trace callback.
        """
        con = sqlite.connect(":memory:")
        def trace(statement):
            raise Exception('uh-oh')
        con.set_trace_callback(trace)
        con.execute("create table foo(a, b)")
        con.set_trace_callback(None)

    def test_ClearTraceCallback(self):
        """
        Test that setting the trace callback to None clears the previously set callback.
        """
        con = sqlite.connect(":memory:")
        traced_statements = []
        def trace(statement):
            traced_statements.append(statement)
        con.set_trace_callback(trace)
        con.set_trace_callback(None)
        con.execute("create table foo(a, b)")
        self.assertFalse(traced_statements, "trace callback was not cleared")

    def test_UnicodeContent(self):
        """
        Test that the statement can contain unicode literals.
        """
        unicode_value = '\xf6\xe4\xfc\xd6\xc4\xdc\xdf\u20ac'
        con = sqlite.connect(":memory:")
        traced_statements = []
        def trace(statement):
            traced_statements.append(statement)
        con.set_trace_callback(trace)
        con.execute("create table foo(x)")
        # Can't execute bound parameters as their values don't appear
        # in traced statements before SQLite 3.6.21
        # (cf. http://www.sqlite.org/draft/releaselog/3_6_21.html)
        con.execute('insert into foo(x) values ("%s")' % unicode_value)
        con.commit()
        self.assertTrue(any(unicode_value in stmt for stmt in traced_statements),
                        "Unicode data %s garbled in trace callback: %s"
                        % (ascii(unicode_value), ', '.join(map(ascii, traced_statements))))

    def test_TraceCallbackContent(self):
        # set_trace_callback() shouldn't produce duplicate content (bpo-26187)
        traced_statements = []
        def trace(statement):
            traced_statements.append(statement)

        queries = ["create table foo(x)",
                   "insert into foo(x) values(1)"]
        self.addCleanup(os.unlink, 'tracecb.db')
        con1 = sqlite.connect('tracecb.db', isolation_level=None)
        con2 = sqlite.connect('tracecb.db')
        con1.set_trace_callback(trace)
        cur = con1.cursor()
        cur.execute(queries[0])
        con2.execute("create table bar(x)")
        cur.execute(queries[1])
        self.assertEqual(traced_statements, queries)


class TestBusyHandlerTimeout(unittest.TestCase):
    def test_busy_handler(self):
        accum = []
        def custom_handler(n):
            accum.append(n)
            return 0 if n == 3 else 1

        self.addCleanup(os.unlink, 'busy.db')
        conn1 = sqlite.connect('busy.db')
        conn2 = sqlite.connect('busy.db')
        conn2.set_busy_handler(custom_handler)

        conn1.execute('begin exclusive')
        with self.assertRaises(sqlite.OperationalError):
            conn2.execute('create table test(id)')
        self.assertEqual(accum, [0, 1, 2, 3])
        accum.clear()

        conn2.set_busy_handler(None)
        with self.assertRaises(sqlite.OperationalError):
            conn2.execute('create table test(id)')
        self.assertEqual(accum, [])

        conn2.set_busy_handler(custom_handler)
        with self.assertRaises(sqlite.OperationalError):
            conn2.execute('create table test(id)')
        self.assertEqual(accum, [0, 1, 2, 3])
        accum.clear()

        conn2.set_busy_timeout(0.01)  # Clears busy handler.
        with self.assertRaises(sqlite.OperationalError):
            conn2.execute('create table test(id)')
        self.assertEqual(accum, [])


def suite():
    loader = unittest.TestLoader()
    tests = [loader.loadTestsFromTestCase(t) for t in (
        CollationTests,
        ProgressTests,
        TraceCallbackTests,
        TestBusyHandlerTimeout)]
    return unittest.TestSuite(tests)

def test():
    runner = unittest.TextTestRunner()
    runner.run(suite())

if __name__ == "__main__":
    test()
