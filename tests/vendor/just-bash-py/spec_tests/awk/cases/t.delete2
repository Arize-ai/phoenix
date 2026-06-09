NR < 50 { n = split($0, x)
  for (i = 1; i <= n; i++)
  for (j = 1; j <= n; j++)
	y[i,j] = n * i + j
  for (i = 1; i <= n; i++)
	delete y[i,i]
  k = 0
  for (i in y)
	k++
  if (k != int(n^2-n))
	printf "delete2 miscount %d vs %d at %d\n", k, n^2-n, NR
}
