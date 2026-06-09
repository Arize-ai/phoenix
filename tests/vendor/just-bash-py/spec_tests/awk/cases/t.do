NF > 0 {
	t = $0
	gsub(/[ \t]+/, "", t)
	n = split($0, y)
	if (n > 0) {
		i = 1
		s = ""
		do {
			s = s $i
		} while (i++ < NF)
	}
	if (s != t)
		print "bad at", NR
}
