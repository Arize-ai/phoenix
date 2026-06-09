	{ x[NR] = $0 }
END {
	for (i=1; i <= NR; i++) {
		print i, x[i]
		if (x[i] ~ /shen/)
			break
	}
	print "got here"
	print i, x[i]
}
