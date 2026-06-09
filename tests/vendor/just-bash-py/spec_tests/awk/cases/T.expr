#!/bin/sh

echo T.expr: tests of miscellaneous expressions

awk=${awk-../a.out}

$awk '
BEGIN {
	FS = "\t"
	awk = "../a.out"
}
NF == 0 || $1 ~ /^#/ {
	next
}
$1 ~ /try/ {	# new test
	nt++
	sub(/try /, "")
	prog = $0
	printf("%3d  %s\n", nt, prog)
	prog = sprintf("%s -F\"\\t\" '"'"'%s'"'"'", awk, prog)
	# print "prog is", prog
	nt2 = 0
	while (getline > 0) {
		if (NF == 0)	# blank line terminates a sequence
			break
		input = $1
		for (i = 2; i < NF; i++)	# input data
			input = input "\t" $i
		test = sprintf("./echo '"'"'%s'"'"' | %s >foo1; ",
			input, prog)
		if ($NF == "\"\"")
			output = ">foo2;"
		else
			output = sprintf("./echo '"'"'%s'"'"' >foo2; ", $NF)
		gsub(/\\t/, "\t", output)
		gsub(/\\n/, "\n", output)
		run = sprintf("cmp foo1 foo2 || echo test %d.%d failed",
			nt, ++nt2)
		# print  "input is", input
		# print  "test is", test
		# print  "output is", output
		# print  "run is", run
		system(test output run)
	}
	tt += nt2
}
END { print tt, "tests" }
' <<\!!!!
# General format:
# try program as rest of line
# $1	$2	$3	output1  (\t for tab, \n for newline,
# $1	$2	$3	output2  ("" for null)
# ... terminated by blank line

# try another program...

try { print ($1 == 1) ? "yes" : "no" }
1	yes
1.0	yes
1E0	yes
0.1E1	yes
10E-1	yes
01	yes
10	no
10E-2	no

try $1 > 0
1	1
2	2
0	""
-1	""
1e0	1e0
0e1	""
-2e64	""
3.1e4	3.1e4

try { print NF }
	0
x	1
x	y	2
	y	2
x		2

try { print NF, $NF }
	0 
x	1 x
x	y	2 y
x	yy	zzz	3 zzz

# this horror prints $($2+1)
try { i=1; print ($++$++i) }
1	1
1	2	3	3
abc	abc

# concatenate $1 and ++$2; print new $1 and concatenated value
try { x = $1++++$2; print $1, x }
1	3	2 14

# do we get the precedence of ! right?
try $1 !$2
0	0	0\t0
0	1	0\t1
1	0	1\t0
1	1	1\t1

# another ava special
try { print ($1~/abc/ !$2) }
0	0	01
0	1	00
abc	0	11
xabcd	1	10

try { print !$1 + $2 }
1	3	3
0	3	4
-1	3	3

# aside:  !$1 = $2 is now a syntax error

# the definition of "number" changes with isnumber.
# 2e100 is ok according to strtod.
# try 1 

try { print ($1 == $2) }
0	0	1
0	1	0
0	00	1
0	""	0
+0	-0	1
1	1.0	1
1	1e0	1
2e10	2.00e10	1
2e10	2e+10	1
2e-10	2e-10	1
2e10	2e-10	0
2e10	20e9	1
2e100	2.000e100	1
2e1000	2.0e1000	0

# this one (3 & 4) may "fail" if a negative 0 is printed as -0,
# but i think this might be a type-coercion problem.

try { print $1, +$1, -$1, - -$1 }
1	1 1 -1 1
-1	-1 -1 1 -1
0	0 0 0 0
x	x 0 0 0

try { printf("a%*sb\n", $1, $2) }
1	x	axb
2	x	a xb
3	x	a  xb

try { printf("a%-*sb\n", $1, $2) }
1	x	axb
2	x	ax b
3	x	ax  b

try { printf("a%*.*sb\n", $1, $2, "hello") }
1	1	ahb
2	1	a hb
3	1	a  hb

try { printf("a%-*.*sb\n", $1, $2, "hello") }
1	1	ahb
2	1	ah b
3	1	ah  b

try { printf("%d %ld %lld %zd %jd %hd %hhd\n", $1, $1, $1, $1, $1, $1, $1) }
1	1 1 1 1 1 1 1
10	10 10 10 10 10 10 10
10000	10000 10000 10000 10000 10000 10000 10000

try { printf("%x %lx %llx %zx %jx %hx %hhx\n", $1, $1, $1, $1, $1, $1, $1) }
1	1 1 1 1 1 1 1
10	a a a a a a a
10000	2710 2710 2710 2710 2710 2710 2710

try { if ($1 ~ $2) print 1; else print 0 }
a	\141	1
a	\142	0
a	\x61	1
a	\x061	0
a	\x62	0
0	\060	1
0	\60	1
0	\0060	0
Z	\x5a	1
Z	\x5A	1

try { print $1 ~ $2 }
a	\141	1
a	\142	0
a	\x61	1
a	\x061	0
a	\x62	0
0	\060	1
0	\60	1
0	\0060	0
Z	\x5a	1
Z	\x5A	1

try { print $1 || $2 }
		0
1		1
0	0	0
1	0	1
0	1	1
1	1	1
a	b	1

try { print $1 && $2 }
		0
1		0
0	0	0
1	0	0
0	1	0
1	1	1
a	b	1

try { $1 = $2; $1 = $1; print $1 }
abc	def	def
abc	def	ghi	def

# $f++ => ($f)++
try { f = 1; $f++; print f, $f }
11	22	33	1 12

# $f[1]++ => ($f[1])++
try { f[1]=1; f[2]=2; print $f[1], $f[1]++, $f[2], f[1], f[2] }
111	222	333	111 111 222 2 2


!!!!
