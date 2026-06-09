NF > 0 { 
  n = split($0, x)
  if (n != NF)
	printf("split screwed up %d %d\n", n, NF)
  delete x[1]
  k = 0
  for (i in x)
	k++
  if (k != NF-1)
	printf "delete miscount %d elems should be %d at line %d\n", k, NF-1, NR 
}
