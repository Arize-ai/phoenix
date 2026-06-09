BEGIN	{ FS = "\t" }
	{ pop[$4] += $3 }
END	{ for (c in pop)
		print c ":" pop[c] | "sort" }
