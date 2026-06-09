#!/bin/sh

awk=${awk-../a.out}

WORKDIR=$(mktemp -d /tmp/nawktest.XXXXXX)

TEMP0=$WORKDIR/test.temp.0
TEMP1=$WORKDIR/test.temp.1
TEMP2=$WORKDIR/test.temp.2

RESULT=0

fail() {
	echo "$1" >&2
	RESULT=1
}

echo T.split: misc tests of field splitting and split command

$awk 'BEGIN {
	# Assign string to $0, then change FS.
	FS = ":"
	$0="a:bc:def"
	FS = "-"
	print FS, $1, NF

	# Assign number to $0, then change FS.
	FS = "2"
	$0=1212121
	FS="3"
	print FS, $1, NF
}' > $TEMP1
echo '- a 3
3 1 4' > $TEMP2
diff $TEMP1 $TEMP2 || fail 'BAD: T.split 0.1'

$awk 'BEGIN {
	# FS changes after getline.
	FS = ":"
	"echo a:bc:def" | getline
	FS = "-"
	print FS, $1, NF
}' > $TEMP1
echo '- a 3' > $TEMP2
diff $TEMP1 $TEMP2 || fail 'BAD: T.split 0.2'

echo '
a
a:b
c:d:e
e:f:g:h' > $TEMP0
$awk 'BEGIN {
	FS = ":"
	while (getline <"'$TEMP0'" > 0) 
		print NF
}' > $TEMP1
echo '0
1
2
3
4' > $TEMP2
diff $TEMP1 $TEMP2 || fail 'BAD: T.split 0.3'

# getline var shouldn't impact fields.

echo 'f b a' > $TEMP0
$awk '{
	FS = ":"
	getline a < "/etc/passwd"
	print $1
}' $TEMP0 > $TEMP1
echo 'f' > $TEMP2
diff $TEMP1 $TEMP2 || fail 'BAD: T.split 0.4'

echo 'a b c d
foo
e f g h i
bar' > $TEMP0
$awk '{
	FS=":"
	getline v
	print $2, NF
	FS=" "
}' $TEMP0 > $TEMP1
echo 'b 4
f 5' > $TEMP2
diff $TEMP1 $TEMP2 || fail 'BAD: T.split 0.5'

echo 'a.b.c=d.e.f
g.h.i=j.k.l
m.n.o=p.q.r' > $TEMP0
echo 'b
h
n' > $TEMP1
$awk 'BEGIN { FS="=" } { FS="."; $0=$1; print $2; FS="="; }' $TEMP0 > $TEMP2
diff $TEMP1 $TEMP2 || fail 'BAD: T.split (record assignment 1)'

echo 'a.b.c=d.e.f
g.h.i=j.k.l
m.n.o=p.q.r' > $TEMP0
echo 'd.e.f
b
j.k.l
h
p.q.r
n' > $TEMP1
$awk 'BEGIN { FS="=" } { print $2; FS="."; $0=$1; print $2; FS="="; }' $TEMP0 > $TEMP2
diff $TEMP1 $TEMP2 || fail 'BAD: T.split (record assignment 2)'

echo 'abc
de
f

     ' > $TEMP0
who | sed 10q  >> $TEMP0
sed 10q /etc/passwd >> $TEMP0

$awk '
{	n = split($0, x, "")
	m = length($0)
	if (m != n) print "error 1", NR
	s = ""
	for (i = 1; i <= m; i++)
		s = s x[i]
	if (s != $0) print "error 2", NR
	print s
}' $TEMP0 > $TEMP1

diff $TEMP0 $TEMP1 || fail 'BAD: T.split 1'

# assumes same test.temp.0!  bad design


$awk '
{	n = split($0, x, //)
	m = length($0)
	if (m != n) print "error 1", NR
	s = ""
	for (i = 1; i <= m; i++)
		s = s x[i]
	if (s != $0) print "error 2", NR
	print s
}' $TEMP0 > $TEMP1

diff $TEMP0 $TEMP1 || fail 'BAD: T.split //'

$awk '
BEGIN { FS = "" }
{	n = split($0, x)	# will be split with FS
	m = length($0)
	if (m != n) print "error 1", NR
	s = ""
	for (i = 1; i <= m; i++)
		s = s x[i]
	if (s != $0) print "error 2", NR
	print s
}' $TEMP0 > $TEMP2

diff $TEMP0 $TEMP2 || fail 'BAD: T.split 2'

# assumes same test.temp.0!

$awk '
BEGIN { FS = "" }
{	n = NF
	m = length($0)
	if (m != n) print "error 1", NR
	s = ""
	for (i = 1; i <= m; i++)
		s = s $i
	if (s != $0) print "error 2", NR
	print s
}' $TEMP0 > $TEMP2

diff $TEMP0 $TEMP2 || fail 'BAD: T.split 3'


$awk '
{ n = split( $0, temp, /^@@@ +/ )
  print n
}' > $TEMP1 <<XXX
@@@ xxx
@@@ xxx
@@@ xxx
XXX
echo '2
2
2' > $TEMP2
diff $TEMP1 $TEMP2 || fail 'BAD: T.split 4'

rm -f $WORKDIR/test.temp*

echo '
a
bc
def' > $TEMP0
$awk '
{ print split($0, x, "")
}' $TEMP0 > $TEMP1
echo '0
1
2
3' > $TEMP2
diff $TEMP1 $TEMP2 || fail 'BAD: T.split null 3rd arg'

rm -f $WORKDIR/test.temp*
$awk 'BEGIN {
  a[1]="a b"
  print split(a[1],a),a[1],a[2]
}' > $TEMP1

echo '2 a b' > $TEMP2
diff $TEMP1 $TEMP2 || fail 'BAD: T.split(a[1],a)'

$awk 'BEGIN {
  a = "cat\n\n\ndog"
  split(a, b, "[\r\n]+")
  print b[1], b[2]
}' > $TEMP1
echo 'cat dog' > $TEMP2
diff $TEMP1 $TEMP2 || fail 'BAD: T.split(a, b, "[\r\n]+")'

rm -rf $WORKDIR

exit $RESULT
