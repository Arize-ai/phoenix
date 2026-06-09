$2 ~ /^[a-l]/	{ x["a"] = x["a"] + 1 }
$2 ~ /^[m-z]/	{ x["m"] = x["m"] + 1 }
$2 !~ /^[a-z]/	{ x["other"] = x["other"] + 1 }
END { print NR, x["a"], x["m"], x["other"] }
