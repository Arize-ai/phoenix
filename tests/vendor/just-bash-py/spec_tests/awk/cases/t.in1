	{ if (amount[$2] == "")
		name[++n] = $2
	  amount[$2] += $1
	}
END	{ for (i in name)
		print i, name[i], amount[name[i]] | "sort"
	}
