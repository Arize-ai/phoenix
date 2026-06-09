BEGIN	{ FS = ":" }
{	if ($1 != prev) {
		print "\n" $1 ":"
		prev = $1
	}
	printf "\t%-10s %6d\n", $2, $3
}
