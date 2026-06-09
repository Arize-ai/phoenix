BEGIN { FS = "a" }
{
	n = split ($0, x, FS)
	if (n != NF)
		print "botch at ", NR, n, NF
	for (i=1; i<=n; i++)
		if ($i != x[i])
			print "diff at ", i, x[i], $i
}
