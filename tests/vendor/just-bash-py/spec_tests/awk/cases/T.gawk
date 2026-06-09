echo T.gawk: tests adapted from gawk test suite
# for which thanks.

awk=${awk-../a.out}

# arrayref:  
./echo '1
1' >foo1
$awk '
	BEGIN { # foo[10] = 0		# put this line in and it will work
		test(foo); print foo[1]
		test2(foo2); print foo2[1]
	}
	function test(foo) { test2(foo) }
	function test2(bar) { bar[1] = 1 }
' >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk arrayref'

# asgext
./echo '1 2 3
1
1 2 3 4' >foo
./echo '3
1 2 3 a

1   a
3
1 2 3 a' >foo1
$awk '{ print $3; $4 = "a"; print }' foo >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk asgext'

# backgsub:
./echo 'x\y
x\\y' >foo
./echo 'x\y
xAy
xAy
xAAy' >foo1
$awk '{	x = y = $0
        gsub( /\\\\/, "A", x); print x
        gsub( "\\\\", "A", y); print y
}' foo >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk backgsub'


# backgsub2:
./echo 'x\y
x\\y
x\\\y' >foo
./echo '	x\y
	x\y
	x\y
	x\y
	x\\y
	x\\\y
	x\\y
	x\\\y
	x\\\\y' >foo1
$awk '{	w = x = y = z = $0
        gsub( /\\\\/, "\\", w); print "	" w
        gsub( /\\\\/, "\\\\", x); print "	" x
        gsub( /\\\\/, "\\\\\\", y); print "	" y
}
' foo >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk backgsub2'


# backgsub3:
./echo 'xax
xaax' >foo
./echo '	xax
	x&x
	x&x
	x\ax
	x\ax
	x\&x
	xaax
	x&&x
	x&&x
	x\a\ax
	x\a\ax
	x\&\&x' >foo1
$awk '{	w = x = y = z = z1 = z2 = $0
        gsub( /a/, "\&", w); print "	" w
        gsub( /a/, "\\&", x); print "	" x
        gsub( /a/, "\\\&", y); print "	" y
        gsub( /a/, "\\\\&", z); print "	" z
        gsub( /a/, "\\\\\&", z1); print "	" z1
        gsub( /a/, "\\\\\\&", z2); print "	" z2
}
' foo >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk backgsub3'


# backsub3:
./echo 'xax
xaax' >foo
./echo '	xax
	x&x
	x&x
	x\ax
	x\ax
	x\&x
	xaax
	x&ax
	x&ax
	x\aax
	x\aax
	x\&ax' >foo1
$awk '{	w = x = y = z = z1 = z2 = $0
        sub( /a/, "\&", w); print "	" w
        sub( /a/, "\\&", x); print "	" x
        sub( /a/, "\\\&", y); print "	" y
        sub( /a/, "\\\\&", z); print "	" z
        sub( /a/, "\\\\\&", z1); print "	" z1
        sub( /a/, "\\\\\\&", z2); print "	" z2
}
' foo >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk backsub3'


# backsub:
./echo 'x\y
x\\y' >foo
./echo 'x\y
x\\y
x\\y
x\\\y' >foo1
$awk '{	x = y = $0
        sub( /\\\\/, "\\\\", x); print x
        sub( "\\\\", "\\\\", y); print y
}' foo >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk backsub'




# dynlj:  
./echo 'hello               world' >foo1
$awk 'BEGIN { printf "%*sworld\n", -20, "hello" }' >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk dynlj'

# fsrs:  
./echo 'a b
c d
e f

1 2
3 4
5 6' >foo
# note -n:
./echo -n 'a b
c d
e f1 2
3 4
5 6' >foo1
$awk '
BEGIN {
       RS=""; FS="\n";
       ORS=""; OFS="\n";
      }
{
        split ($2,f," ")
        print $0;
}' foo >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk fsrs'

# intest
./echo '0 1' >foo1
$awk 'BEGIN {
	bool = ((b = 1) in c);
	print bool, b	# gawk-3.0.1 prints "0 "; should print "0 1"
}' >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk intest'

# intprec:  
./echo '0000000005:000000000e' >foo1
$awk 'BEGIN { printf "%.10d:%.10x\n", 5, 14 }' >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk intprec'

# litoct:  
./echo 'axb
ab
a*b' >foo
./echo 'no match
no match
match' >foo1
$awk '{ if (/a\52b/) print "match" ; else print "no match" }' foo >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk litoct'

# math:  
./echo 'cos(0.785398) = 0.707107
sin(0.785398) = 0.707107
e = 2.718282
log(e) = 1.000000
sqrt(pi ^ 2) = 3.141593
atan2(1, 1) = 0.785398' >foo1
$awk 'BEGIN {
	pi = 3.1415927
	printf "cos(%f) = %f\n", pi/4, cos(pi/4)
	printf "sin(%f) = %f\n", pi/4, sin(pi/4)
	e = exp(1)
	printf "e = %f\n", e
	printf "log(e) = %f\n", log(e)
	printf "sqrt(pi ^ 2) = %f\n", sqrt(pi ^ 2)
	printf "atan2(1, 1) = %f\n", atan2(1, 1)
}' >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk math'

# nlfldsep:  
./echo 'some stuff
more stuffA
junk
stuffA
final' >foo
./echo '4
some
stuff
more
stuff

2
junk
stuff

1
final
' >foo1
$awk 'BEGIN { RS = "A" }
{print NF; for (i = 1; i <= NF; i++) print $i ; print ""}
' foo >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk nlfldsep'

# numsubstr:  
./echo '5000
10000
5000' >foo
./echo '000
1000
000' >foo1
$awk '{ print substr(1000+$1, 2) }' foo >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk numsubstr'

# pcntplus:  
./echo '+3 4' >foo1
$awk 'BEGIN { printf "%+d %d\n", 3, 4 }' >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk pcntplus'

# prt1eval:  
./echo 1 >foo1
$awk 'function tst () {
	sum += 1
	return sum
}
BEGIN { OFMT = "%.0f" ; print tst() }
' >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk prt1eval'

# reparse:  
./echo '1 axbxc 2' >foo
./echo '1
1 a b c 2
1 a b' >foo1
$awk '{	gsub(/x/, " ")
	$0 = $0
	print $1
	print $0
	print $1, $2, $3
}' foo >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk reparse'

# rswhite:  
./echo '    a b
c d' >foo
./echo '<    a b
c d>' >foo1
$awk 'BEGIN { RS = "" }
{ printf("<%s>\n", $0) }' foo  >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk rswhite'

# splitvar:  
./echo 'Here===Is=Some=====Data' >foo
./echo 4 >foo1
$awk '{	sep = "=+"
	n = split($0, a, sep)
	print n
}' foo >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk splitvar'

# splitwht:  
./echo '4
5' >foo1
$awk 'BEGIN {
	str = "a   b\t\tc d"
	n = split(str, a, " ")
	print n
	m = split(str, b, / /)
	print m
}' >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk splitwht'

# sprintfc:  
./echo '65
66
foo' >foo
./echo 'A 65
B 66
f foo' >foo1
$awk '{ print sprintf("%c", $1), $1 }' foo >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk sprintfc'

# substr:  
./echo 'xxA                                      
xxab
xxbc
xxab
xx
xx
xxab
xx
xxef
xx' >foo1
$awk 'BEGIN {
	x = "A"
	printf("xx%-39s\n", substr(x,1,39))
	print "xx" substr("abcdef", 0, 2)
	print "xx" substr("abcdef", 2.3, 2)
	print "xx" substr("abcdef", -1, 2)
	print "xx" substr("abcdef", 1, 0)
	print "xx" substr("abcdef", 1, -3)
	print "xx" substr("abcdef", 1, 2.3)
	print "xx" substr("", 1, 2)
	print "xx" substr("abcdef", 5, 5)
	print "xx" substr("abcdef", 7, 2)
	exit (0)
}' >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk substr'

# fldchg:  
./echo 'aa aab c d e f' >foo
./echo '1: + +b c d e f
2: + +b <c> d e f
2a:%+%+b%<c>%d%e' >foo1
$awk '{	gsub("aa", "+")
	print "1:", $0
	$3 = "<" $3 ">"
	print "2:", $0
	print "2a:" "%" $1 "%" $2 "%" $3 "%" $4 "%" $5
}' foo >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk fldchg'

# fldchgnf:  
./echo 'a b c d' >foo
./echo 'a::c:d
4' >foo1
$awk '{ OFS = ":"; $2 = ""; print $0; print NF }' foo >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk fldchgnf'

# funstack:
# ./echo '	funstack test takes 5-10 sec, replicates part of T.beebe'
$awk -f funstack.awk funstack.in >foo 2>&1
cmp -s foo funstack.ok || ./echo 'BAD: T.gawk funstack'

# OFMT from arnold robbins 6/02:
#	5.7 with OFMT = %0.f is 6
./echo '6' >foo1
$awk 'BEGIN {
	OFMT = "%.0f"
	print 5.7
}' >foo2
cmp -s foo1 foo2 || ./echo 'BAD: T.gawk ofmt'


### don't know what this is supposed to do now.
### # convfmt:  
### ./echo 'a =  123.46
### a =  123.456
### a =  123.456' >foo1
### $awk 'BEGIN {
### 	CONVFMT = "%2.2f"
### 	a = 123.456
### 	b = a ""                # give a string value also
### 	a += 0                  # make a numeric only again
### 	print "a = ", a
### 	CONVFMT = "%.6g"
### 	print "a = ", a
### 	a += 0                  # make a numeric only again
### 	print "a = ", a    # use a as string
### }' >foo2
### cmp -s foo1 foo2 || ./echo 'BAD: T.gawk convfmt'
