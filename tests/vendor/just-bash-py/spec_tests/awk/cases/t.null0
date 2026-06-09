BEGIN { FS = ":" }
{	if (a) print "a", a
	if (b == 0) print "b", b
	if ( c == "0") print "c", c
	if (d == "") print "d", d
	if (e == 1-1) print "e", e
}
$1 == 0	{print "$1 = 0"}
$1 == "0"	{print "$1 = quoted 0"}
$1 == ""	{print "$1 = null string"}
$5 == 0	{print "$5 = 0"}
$5 == "0"	{print "$5 = quoted 0"}
$5 == ""	{print "$5 = null string"}
$1 == $3 {print "$1 = $3"}
$5 == $6 {print "$5 = $6"}
