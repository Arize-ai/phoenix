BEGIN	{ FS = "\t" }
	{ pop[$4 ":" $1] += $3 }
END	{ for (cc in pop)
		print cc ":" pop[cc] | "sort -t: -k 1,1 -k 3nr" }
