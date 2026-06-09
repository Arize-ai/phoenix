{
	line = substr($0, index($0, " "))
	print line
	n = split(line, x)
	x[$0, $1] = $0
	print x[$0, $1]
	print "<<<"
for (i in x) print i, x[i]
	print ">>>"
	if (($0,$1) in x)
		print "yes"
	if ($1 in x)
		print "yes"
	else
		print "no"
}
