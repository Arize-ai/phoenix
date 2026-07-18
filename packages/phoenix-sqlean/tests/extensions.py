import unittest
import sqlean
from sqlean import dbapi2 as sqlite
from setup import SQLEAN_VERSION


class FuncTest(unittest.TestCase):
    def setUp(self):
        sqlean.extensions.enable_all()
        self.conn = sqlite.connect(":memory:")
        self.conn.close()
        self.conn = sqlite.connect(":memory:")

    def tearDown(self):
        self.conn.close()

    def test_crypto(self):
        self._assert_eq("hex(md5('abc'))", "900150983cd24fb0d6963f7d28e17f72".upper())
        self._assert_eq("encode('abcd', 'base64')", "YWJjZA==")
        self._assert_eq("decode('YWJjZA==', 'base64')", b"abcd")

    def test_define(self):
        self._assert_eq("define('sumn', '?1 * (?1 + 1) / 2')", None)
        self._assert_eq("sumn(5)", (1 + 2 + 3 + 4 + 5))
        self._assert_eq("eval('select abs(-42)')", "42")
        self._assert_eq("define_free()", None)

    def test_fuzzy(self):
        self._assert_eq("dlevenshtein('abc', 'abcd')", 1)
        self._assert_eq("caverphone('awesome')", "AWSM111111")

    def test_ipaddr(self):
        self._assert_eq("iphost('192.168.16.12/24')", "192.168.16.12")
        self._assert_eq("ipcontains('192.168.16.0/24', '192.168.16.3')", 1)

    def test_math(self):
        self._assert_eq("trunc(3.9)", 3)
        self._assert_eq("sqrt(100)", 10)
        self._assert_eq("round(degrees(pi()))", 180)

    def test_regexp(self):
        self._assert_eq("regexp_replace('1 10 100', '\d+', '**')", "** ** **")
        self._assert_eq("regexp_substr('abcdef', 'b(.)d')", "bcd")
        self._assert_eq("regexp_capture('abcdef', 'b(.)d', 1)", "c")

    def test_stats(self):
        self._assert_eq("percentile(value, 50) from generate_series(1, 99)", 50)
        self._assert_eq("median(value) from generate_series(1, 99)", 50)

    def test_text(self):
        self._assert_eq("text_substring('hello world', 7)", "world")
        self._assert_eq("text_split('one|two|three', '|', 2)", "two")
        self._assert_eq("text_translate('hello', 'l', '1')", "he11o")

    def test_time(self):
        self._assert_eq("time_to_unix(time_date(2011, 11, 18))", 1321574400)

    def test_uuid(self):
        self._assert_eq("length(uuid4())", 36)

    def test_unicode(self):
        self._assert_eq("nupper('пРиВеТ')", "ПРИВЕТ")
        self._assert_eq("unaccent('hôtel')", "hotel")

    def test_version(self):
        self._assert_eq("sqlean_version()", SQLEAN_VERSION)

    def _assert_eq(self, expr, want):
        cur = self.conn.execute(f"select {expr}")
        got = cur.fetchone()[0]
        self.assertEqual(got, want)


class EnableTest(unittest.TestCase):
    def setUp(self):
        sqlean.extensions.enable("stats", "text")
        self.conn = sqlite.connect(":memory:")

    def test_enabled_1(self):
        sql = "select median(value) from generate_series(1, 99)"
        cur = self.conn.execute(sql)
        got = cur.fetchone()[0]
        self.assertEqual(got, 50)

    def test_enabled_2(self):
        sql = "select text_substring('hello world', 7)"
        cur = self.conn.execute(sql)
        got = cur.fetchone()[0]
        self.assertEqual(got, "world")

    def test_disabled(self):
        sql = "select dlevenshtein('abc', 'abcd')"
        with self.assertRaises(Exception, msg="no such function: dlevenshtein"):
            self.conn.execute(sql)

    def tearDown(self):
        self.conn.close()


class PragmaTest(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite.connect(":memory:")

    def tearDown(self):
        self.conn.close()

    def test_temp_store(self):
        val = self._get_opt("TEMP_STORE")
        self.assertEqual(val, "1")

    def _get_opt(self, name):
        cur = self.conn.execute("PRAGMA compile_options;")
        for row in cur.fetchall():
            if row[0].startswith(name + "="):
                return row[0].split("=")[1]


def suite():
    loader = unittest.TestLoader()
    cases = (FuncTest, EnableTest, PragmaTest)
    tests = [loader.loadTestsFromTestCase(c) for c in cases]
    return unittest.TestSuite(tests)


def test():
    runner = unittest.TextTestRunner()
    runner.run(suite())


if __name__ == "__main__":
    test()
