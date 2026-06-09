#!/bin/sh

uname -a
cc echo.c -o echo && echo echo compiled

oldawk=${oldawk-awk}
awk=${awk-../a.out}

echo oldawk=$oldawk, awk=$awk 

oldawk=$oldawk awk=$awk Compare.t t.*
	echo `ls t.* | wc -l` tests; echo

oldawk=$oldawk awk=$awk Compare.p p.? p.??*
	echo `ls p.* | wc -l` tests; echo

oldawk=$oldawk awk=$awk Compare.T1
	echo `grep '\$awk' T.* | wc -l` tests; echo

oldawk=$oldawk awk=$awk Compare.tt tt.*
	echo `ls tt.* | wc -l` tests; echo
