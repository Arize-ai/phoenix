	{ if (amount[$2] == "")
		name[++n] = $2
	  amount[$2] += $1
	}
END	{ for (i = 1; i <= n; i++)
		print name[i], amount[name[i]]
	}
