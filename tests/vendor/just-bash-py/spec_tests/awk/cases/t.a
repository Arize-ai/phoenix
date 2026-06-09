	{if (amount[$2] "" == "") item[++num] = $2;
	 amount[$2] += $1
	}
END	{for (i=1; i<=num; i++)
		print item[i], amount[item[i]]
	}
