BEGIN	{ FS = ":" }
{
	if ($1 != prev) {
		if (prev) {
			printf "\t%-10s\t %6d\n", "total", subtotal
			subtotal = 0
		}
		print "\n" $1 ":"
		prev = $1
	}
	printf "\t%-10s %6d\n", $2, $3
	wtotal += $3
	subtotal += $3
}
END	{ printf "\t%-10s\t %6d\n", "total", subtotal
	  printf "\n%-10s\t\t %6d\n", "World Total", wtotal }
