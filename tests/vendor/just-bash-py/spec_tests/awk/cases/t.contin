{
for (i = 1; i <= NF; i++) {
	if ($i ~ /^[0-9]+$/)
		continue;
	print $i, " is non-numeric"
	next
}
print $0, "is all numeric"
}
