BEGIN {
	FS = "-"
}
/sh$/ {
	n++
	l = length($NF)
	s += l
	ck %= l
	totck += ck
	print
}
END {
	if (n > 0) {
		printf "%d %d %d %fn\n", totck, n, s, s/n
	}
	else
		print "n is zero"
}
