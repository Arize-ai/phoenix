echo T.re: tests of regular expression code

awk '
BEGIN {
	FS = "\t"
	awk = "../a.out"
}
NF == 0 {
	next
}
$1 != "" {	# new test
	re = $1
}
$2 != "" {	# either ~ or !~
	op = $2
	if (op == "~")
		neg = "!"
	else if (op == "!~")
		neg = ""
}
$3 != "" {	# new test string
	str = $3
}
$3 == "\"\"" {	# explicit empty line
	$3 = ""
}
NF > 2 {	# generate a test
	input = $3
	test = sprintf("./echo '"'"'%s'"'"' | %s '"'"'%s/%s/ {print \"%d fails %s %s %s\"}'"'"'",
		input, awk, neg, re, NR, re, op, input)
	# printf(" %3d   %s %s %s:\n", NR, re, op, input)
	# print "test is |" test "|"
	system(test)
	# system("bprint -c ../a.out")
	nt++
}
END { print "	" nt, "tests" }
' <<\!!!!
	~	a
		aa
		aaa
		""
a	~	a
		ba
		bab
	!~	""
		x
		xxxxx
=	~	=
		b=
		b=b
	!~	""
		x
		xxxxx
.	~	x
		xxx
	!~	""			
.a	~	xa
		xxa
		xax
	!~	a
		ax
		""
$	~	x
		""
.$	~	x
		xx
	!~	""
a$	~	a
		ba
		bbba
	!~	ab
		x
		""
^	~	x
		""
		^
^a$	~	a
	!~	xa
		ax
		xax
		""
^a.$	~	ax
		aa
	!~	xa
		aaa
		axy
		""
^$	~	""
	!~	x
		^
^.a	~	xa
		xaa
	!~	a
		""
^.*a	~	a
		xa
		xxxxxxa
	!~	""
^.+a	~	xa
		xxxxxxa
	!~	""
		a
		ax
a*	~	""
		a
		aaaa
		xa
		xxxx
aa*	~	a
		aaa
		xa
	!~	xxxx
		""
\$	~	x$
		$
		$x
		x$x
	!~	""
		x
\.	~	.
	!~	x
		""
xr+y	~	xry
		xrry
		xrrrrrry
	!~	ry
		xy
		xr
xr?y	~	xy
		xry
	!~	xrry
a?b?c?	~	""
		x
^a?b?x	~	x
		ax
		bx
		abx
		xa
	!~	""
		ab
		aba			
[0-9]	~	1
		567
		x0y
	!~	abc
		""
[^0-9]	!~	1
		567
		""
	~	abc
		x0y
[0-25-69]	~	0
		1
		2
		5
		6
		9
	!~	3
		4
		7
		8
[[:lower:]]	~	a
		b
		z
	!~	A
		Z
		1
		:
		[
		]
[[:upper:]]	~	A
		B
		Z
	!~	a
		z
		1
		:
		[
		]
[[:digit:]]	~	0
		1
		9
	!~	d
		:
		[
		]
x[0-9]+y	~	x0y
		x23y
		x12345y
	!~	0y
		xy
x[0-9]?y	~	xy
		x1y
	!~	x23y
x[[]y	~	x[y
	!~	xy
		x[[]y
		x]y
x[[-]y	~	x[y
		x-y
	!~	xy
		x[[]y
		x]y
x[[-a]y	~	x[y
		xay
		x]y
	!~	xy
		x[[]y
		x-y
x[]-a]y	~	x]y
		xay
	!~	xy
		x[y
		x-y
x[]]y	~	x]y
	!~	xy
		x[]]y
		x[y
x[^[]y	~	xay
	!~	x[y
x[-]y	~	x-y
	!~	xy
		x+y
x[^-]y	~	x+y
	!~	x-y
		xy
x[][]y	~	x[y
		x]y
	!~	xy
		x][y
		x[]y
x[z-a]y	~	xy
	!~	x
		y
		xay
		xzy
		x-y
[0\-9]	~	0
		-
		9
	!~	1
		""
[-1]	~	-
		1
	!~	0
[0-]	~	0
		-
	!~	1
[^-0]	~	x
		^
	!~	-
		0
		""
[^0-]	~	x
		^
	!~	-
		0
		""
x|y	~	x
		y
		xy
	!~	a
		""
^abc|xyz$	~	abc
		abcd
		axyz
		xyz
	!~	xabc
		xyza
^(abc|xyz)$	~	abc
		xyz
	!~	abcxyz
		abcx
		cxyz
^x\|y$	~	x|y
	!~	xy
^x\\y$	~	x\y
	!~	xy
		x\\y
		xay
\141\142	~	ab
		xab
		abx
	!~	a
		b
		ax
		axb
x\056y	~	x.y
	!~	x.
		.x
		xxx
		xby  because \056 is not the metacharacter .
		xcy  ditto
[\60-\62\65-6\71]	~	0
		1
		2
		5
		6
		9
	!~	3
		4
		7
		8
[\60-2\65-6\71]	~	0
		1
		2
		5
		6
		9
	!~	3
		4
		7
		8
[\x30-\x32\x35-6\71]	~	0
		1
		2
		5
		6
		9
	!~	3
		4
		7
		8
[\x30-2\x35-6\x39]	~	0
		1
		2
		5
		6
		9
	!~	3
		4
		7
		8
\f	!~	x
\b	!~	x
\r	!~	x
\n	!~	x
...)	~	abc)
!!!!
