{
	n = split ($0, x, /[ 	]+/)
	print n
	if (n != NF)
		print "split botch at ", NR, n, NF
	for (i=1; i<=n; i++)
		if ($i != x[i])
			print "different element at ", i, x[i], $i
}
