#!/bin/sh

oldawk=${oldawk-awk}
awk=${awk-../a.out}

echo compiling time.c
cc time.c -o time
time=./time

echo time command = $time

#case `uname` in
#SunOS)
#	time=/usr/bin/time ;;
#Linux)
#	time=/usr/bin/time ;;
#*)
#	time=time ;;
#esac

echo oldawk = $oldawk, awk = $awk, time command = $time


# an arbitrary collection of input data

cat td.1 td.1 >foo.td
sed 's/^........................//' td.1 >>foo.td
pr -m td.1 td.1 td.1 >>foo.td
pr -2 td.1 >>foo.td
cat bib >>foo.td
wc foo.td

td=foo.td
>footot

for i in $*
do
	echo $i "($oldawk vs $awk)":
	# ind <$i
	$time $oldawk -f $i $td >foo2 2>foo2t
	cat foo2t
	$time $awk -f $i $td >foo1 2>foo1t
	cat foo1t
	cmp foo1 foo2
	echo $i: >>footot
	cat foo1t foo2t >>footot
done

ctimes footot
