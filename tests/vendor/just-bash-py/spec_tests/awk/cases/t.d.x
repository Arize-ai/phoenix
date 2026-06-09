BEGIN {FS=":" ; OFS=":"}
{print NF "	",$0}
