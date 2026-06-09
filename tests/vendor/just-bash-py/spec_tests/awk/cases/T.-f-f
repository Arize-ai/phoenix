#!/bin/sh
echo T.-f-f: check multiple -f arguments

awk=${awk-../a.out}

echo 'begin
end' >foo
echo 'BEGIN { print "begin" }' >foo1
echo 'END { print "end" }' >foo2
echo xxx | $awk -f foo1 -f foo2 >foo3
diff foo foo3 || echo 'BAD: T.-f-f multiple -fs'


echo '/a/' | $awk -f - /etc/passwd >foo1
$awk '/a/' /etc/passwd >foo2
diff foo1 foo2 || echo 'BAD: T.-f-f  -f -'


cp /etc/passwd foo1
echo '/./ {' >foo2
echo 'print' >foo3
echo '}' >foo4
$awk -f foo2 -f foo3 -f foo4 /etc/passwd >foo5
diff foo1 foo5 || echo 'BAD: T.-f-f 3 files'


echo '/./ {' >foo2
echo 'print' >foo3
echo '



]' >foo4
$awk -f foo2 -f foo3 -f foo4 /etc/passwd >foo5 2>foo6
grep 'syntax error.*file foo4' foo6 >/dev/null 2>&1 || echo 'BAD: T.-f-f source file name'
