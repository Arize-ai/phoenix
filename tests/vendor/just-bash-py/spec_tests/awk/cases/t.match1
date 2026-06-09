NF > 0 && match($NF, $1) {
	print $0, RSTART, RLENGTH
	if (RLENGTH != length($1))
		printf "match error at %d: %d %d\n",
			NR, RLENGTH, RSTART >"/dev/tty"
}
