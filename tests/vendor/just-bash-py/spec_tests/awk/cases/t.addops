{	n = $1
	n += $1
	if (n != $1 + $1) print NR,  "urk +="
	n = $1
	n -= $1
	if (n != 0) print NR,  "urk -="
	n = $1
	n *= 3.5
	if (n != 3.5 * $1) print NR,  "urk *="
	n = $1
	n /= 4
	if (n != $1 / 4) print NR,  "urk /="
	n = NR
	n ^= 2
	if (n != NR * NR) print NR,  "urk1 ^=", n, NR * NR
	n = NR
	n **= 2
	if (n != NR * NR) print NR,  "urk1 **=", n, NR * NR
	n = NR
	n ^= 1.5
	ns = sprintf("%.10g", n)
	sq = sprintf("%.10g", NR * sqrt(NR))
	if (ns != sq) print NR,  "urk2 ^=", ns, sq
}
