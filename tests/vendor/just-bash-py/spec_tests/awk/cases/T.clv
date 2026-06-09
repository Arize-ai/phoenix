#!/bin/sh
echo T.clv: check command-line variables

awk=${awk-../a.out}

rm -f core

# stdin only, no cmdline asgn
echo 'hello
goodbye' | $awk '
BEGIN { x=0; print x; getline; print x, $0 }
' >foo1
echo '0
0 hello' >foo2
diff foo1 foo2 || echo 'BAD: T.clv (stdin only)'

# cmdline asgn then stdin
echo 'hello
goodbye' | $awk '
BEGIN { x=0; print x; getline; print x, $0 }
' x=1 >foo1
echo '0
1 hello' >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=1 only)'

# several cmdline asgn, then stdin
echo 'hello
goodbye' | $awk '
BEGIN { x=0; print x; getline; print x, $0 }
' x=1 x=2 x=3 >foo1
echo '0
3 hello' >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=3 only)'

# several cmdline asgn, then file
echo 'hello
goodbye' >foo
$awk '
BEGIN { x=0; print x; getline; print x, $0 }
' x=1 x=2 x=3 foo >foo1
echo '0
3 hello' >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=3 only)'

# cmdline asgn then file
echo 4 >foo1
$awk 'BEGIN { getline; print x}' x=4 /dev/null >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=4 /dev/null)'

#cmdline asgn then file but no read of it
echo 0 >foo1
$awk 'BEGIN { x=0; getline <"/dev/null"; print x}' x=5 /dev/null >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=5 /dev/null)'

#cmdline asgn then file then read
echo 'xxx
yyy
zzz' >foo
echo '6
end' >foo1
$awk 'BEGIN { x=0; getline; print x}
      END { print x }' x=6 foo x=end >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=6 /dev/null)'

#cmdline asgn then file then read
echo '0
end' >foo1
$awk 'BEGIN { x=0; getline <"/dev/null"; print x}
      END { print x }' x=7 /dev/null x=end >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=7 /dev/null)'

#cmdline asgn then file then read; _ in commandname
echo '0
end' >foo1
$awk 'BEGIN { _=0; getline <"/dev/null"; print _}
      END { print _ }' _=7A /dev/null _=end >foo2
diff foo1 foo2 || echo 'BAD: T.clv (_=7A /dev/null)'

# illegal varname in commandname
$awk '{ print }' 99_=foo /dev/null >foo 2>foo2
grep "can't open.*foo" foo2 >/dev/null 2>&1 || echo 'BAD: T.clv (7B: illegal varname)'

# these test the new -v option:  awk ... -v a=1 -v b=2 'prog' does before BEGIN

echo 123 >foo1
$awk -v x=123 'BEGIN { print x }' >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=11)'

echo 123 >foo1
$awk -vx=123 'BEGIN { print x }' >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=11a)'

echo 123 abc 10.99 >foo1
$awk -v x=123 -v y=abc -v z1=10.99 'BEGIN { print x, y, z1 }' >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=12)'

echo 123 abc 10.99 >foo1
$awk -vx=123 -vy=abc -vz1=10.99 'BEGIN { print x, y, z1 }' >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=12a)'

echo 123 abc 10.99 >foo1
$awk -v x=123 -v y=abc -v z1=10.99 -- 'BEGIN { print x, y, z1 }' >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=12a)'

echo 'BEGIN { print x, y, z1 }' >foo0
echo 123 abc 10.99 >foo1
$awk -v x=123 -v y=abc -f foo0 -v z1=10.99 >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=13)'

echo 'BEGIN { print x, y, z1 }' >foo0
echo 123 abc 10.99 >foo1
$awk -vx=123 -vy=abc -f foo0 -vz1=10.99 >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=13a)'

echo 'BEGIN { print x, y, z1 }' >foo0
echo 123 abc 10.99 >foo1
$awk -f foo0 -v x=123 -v y=abc -v z1=10.99 >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=14)'

echo 'BEGIN { print x, y, z1 }' >foo0
echo 123 abc 10.99 >foo1
$awk -f foo0 -vx=123 -vy=abc -vz1=10.99 >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=14a)'

echo 'BEGIN { print x, y, z1 }
END { print x }' >foo0
echo '123 abc 10.99
4567' >foo1
$awk -f foo0 -v x=123 -v y=abc -v z1=10.99 /dev/null x=4567 /dev/null >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=15)'

echo 'BEGIN { print x, y, z1 }
END { print x }' >foo0
echo '123 abc 10.99
4567' >foo1
$awk -f foo0 -vx=123 -vy=abc -vz1=10.99 /dev/null x=4567 /dev/null >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=15a)'

echo 'BEGIN { print x, y, z1 }
NR==1 { print x }' >foo0
echo '123 abc 10.99
4567' >foo1
$awk -v x=123 -v y=abc -v z1=10.99 -f foo0 x=4567 /etc/passwd >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=16)'

echo 'BEGIN { print x, y, z1 }
NR==1 { print x }' >foo0
echo '123 abc 10.99
4567' >foo1
$awk -vx=123 -vy=abc -vz1=10.99 -f foo0 x=4567 /etc/passwd >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=16a)'



# special chars in commandline assigned value;
# have to use local echo to avoid quoting problems.

./echo 'a\\b\z' >foo1
./echo 'hello' | $awk '{print x}' x='\141\\\\\142\\z' >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=17)'

./echo "a
z" >foo1
./echo 'hello' | $awk '{print x}' x='a\nz' >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=18)'

# a bit circular here...
$awk 'BEGIN { printf("a%c%c%cz\n", "\b", "\r", "\f") }' >foo1 
./echo 'hello' | $awk '{print x}' x='a\b\r\fz' >foo2
diff foo1 foo2 || echo 'BAD: T.clv (x=19)'


### newer -v tests


$awk -vx 'BEGIN {print x}' >foo 2>&1
grep 'invalid -v option argument: x' foo >/dev/null || echo 'BAD: T.clv (x=20)'

$awk -v x 'BEGIN {print x}' >foo 2>&1
grep 'invalid -v option argument: x' foo >/dev/null || echo 'BAD: T.clv (x=20a)'

