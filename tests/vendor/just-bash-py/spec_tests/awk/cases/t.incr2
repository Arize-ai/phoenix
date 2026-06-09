{ s = 0
  for (i=1; i <= NF; )
	if ($(i) ~ /^[0-9]+$/)
		s += $(i++)
	else
		i++
  print s
}
