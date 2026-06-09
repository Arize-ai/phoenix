#!/bin/sh

echo T.utf: tests of utf functions

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
	sub(/try [a-zA-Z_0-9]+ /, "")
	prog = $0
	printf("try %3d %s\n", nt, prog)
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
		run = sprintf("diff foo1 foo2 || echo test %d.%d failed",
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

try length { print length($1) }
	0
a	1
の今がその時だ	7
Сейчас	6
现在是时候了	6
给所有的好男	6
来参加聚会。	6
😀	1
🖕 finger	8
Τωρα	4
για	3
να	2
עכשיו	5
לכל	3
לבוא	4
の今がその時だ	7
지금이	3
모든	2
파티에	3
Сейчас	6
для	3
прийти	6

try index { print index($1, $2) }
abc	a	1
abc	b	2
abc	x	0
现在是时候了	""	0
现在是时候了	了	6
现在是时候了	在是	2
现在是时候了	x	0
现x在是时候了	x	2
🖕 fingerすべての善人のためにすべての善人のために	f	3
🖕 finger🖕	r🖕	8

try substr { print substr($0, 2, 3) }
abcdef	bcd
Τωρα ειναι η	ωρα
Τω	ω
지금 이절호의	금 이
xпyрийти	пyр

try rematch { print $1 ~ $2 }
abc	a	1
abc	x	0
すべての善人のために	の	1
すべての善人のために	の.*の	1
すべての善人のために	の.*て	0
Τωρα	ω+	1

# replace first occurrence of $2 by $3 in $1
try sub { n = sub($2, $3, $1); print n, $1 }
abcdef	bc	XYZ	1 aXYZdef
abcdef	xy	XYZ	0 abcdef
の今がその時だ	の	NO	1 NO今がその時だ
🖕 finger	🖕.*g	FING	1 FINGer
Сейчас	.	x	1 xейчас

# replace all occurrences of $2 by $3 in $1
try gsub { n = gsub($2, $3, $1); print n, $1 }
abcdef	bc	XYZ	1 aXYZdef
abcdef	xy	XYZ	0 abcdef
の今がその時だ	の	NO	2 NO今がそNO時だ
🖕 finger	🖕.*g	FING	1 FINGer
Сейчас	.	x	6 xxxxxx

try match { print match($1, $2), RSTART, RLENGTH }
abc	[^a]	2 2 1
abc	[^ab]	3 3 1
すべての善人のために	[^す]	2 2 1
すべての善人のために	[^ぁ-ゖ]	5 5 1
abc	a	1 1 1
abc	x	0 0 -1
すべての善人のために	の	4 4 1
すべての善人のために	の.*の	4 4 4
すべての善人のために	の.*て	0 0 -1
Τωρα	ω+	2 2 1
Τωρα	x+	0 0 -1
Τωρα	ω.	2 2 2
すべての善人のために	[の]	4 4 1
すべての善人のために	[ぁ-え]	0 0 -1
すべての善人のために	[^ぁ-え]	1 1 1
Τωρα ειναι η	[α-ω]	2 2 1
Τωρα ειναι η	[α-ω]+	2 2 3
xxxΤωρα ειναι η	[Α-Ω]	4 4 1
για όλους τους καλούς ά	α.*α	3 3 15
να έρθει στο πά	[^ν]	2 2 1

# FS="" should split into unicode chars
try emptyFS BEGIN {FS=""} {print NF}
すべての善人のために	10
の今がその時だ	7
Сейчас	6
现在是时候了	6
给所有的好男	6
来参加聚会。	6
😀	1
🖕 finger	8

# printf(%N.Ns) for utf8 strings
try printfs1 {printf("[%5.2s][%-5.2s]\n"), $1, $1}
abcd	[   ab][ab   ]
现在abc	[   现在][现在   ]
现ωabc	[   现ω][现ω   ]
ωabc	[   ωa][ωa   ]
Сейчас	[   Се][Се   ]
Сейxyz	[   Се][Се   ]
😀	[    😀][😀    ]

# printf(%N.Ns) for utf8 strings
try printfs2 {printf("[%5s][%-5s]\n"), $1, $1}
abcd	[ abcd][abcd ]
现在ab	[ 现在ab][现在ab ]
a现在ab	[a现在ab][a现在ab]
a现在abc	[a现在abc][a现在abc]
现ωab	[ 现ωab][现ωab ]
ωabc	[ ωabc][ωabc ]
Сейчас	[Сейчас][Сейчас]
😀	[    😀][😀    ]

# printf(%N.Ns) for utf8 strings
try printfs3 {printf("[%.2s][%-.2s]\n"), $1, $1}
abcd	[ab][ab]
现在abc	[现在][现在]
现ωabc	[现ω][现ω]
ω	[ω][ω]
😀	[😀][😀]

# printf(%c) for utf
try printfc {printf("%c %c\n", $1, substr($1,2,1))}
すべての善人のために	す べ
の今がその時だ	の 今
Сейчас	С е
现在是时候了	现 在
😀🖕	😀 🖕

!!!!
