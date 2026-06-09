BEGIN	{ FS = "\t" }
	{ area[$4] += $2 }
END	{ for (name in area)
		print name ":" area[name] }
