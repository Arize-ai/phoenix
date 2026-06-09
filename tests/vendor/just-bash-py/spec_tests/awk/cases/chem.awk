BEGIN {
	macros = "/usr/bwk/chem/chem.macros"	# CHANGE ME!!!!!
	macros = "/dev/null" # since originals are lost

	pi = 3.141592654
	deg = 57.29578
	setparams(1.0)
	set(dc, "up 0 right 90 down 180 left 270 ne 45 se 135 sw 225 nw 315")
	set(dc, "0 n 30 ne 45 ne 60 ne 90 e 120 se 135 se 150 se 180 s")
	set(dc, "300 nw 315 nw 330 nw 270 w 210 sw 225 sw 240 sw")
}
function init() {
	printf ".PS\n"
	if (firsttime++ == 0) {
		printf "copy \"%s\"\n", macros
		printf "\ttextht = %g; textwid = .1; cwid = %g\n", textht, cwid
		printf "\tlineht = %g; linewid = %g\n", lineht, linewid
	}
	printf "Last: 0,0\n"
	RING = "R"; MOL = "M"; BOND = "B"; OTHER = "O"	# manifests
	last = OTHER
	dir = 90
}
function setparams(scale) {
	lineht = scale * 0.2
	linewid = scale * 0.2
	textht = scale * 0.16
	db = scale * 0.2		# bond length
	cwid = scale * 0.12		# character width
	cr = scale * 0.08		# rad of invis circles at ring vertices
	crh = scale * 0.16		# ht of invis ellipse at ring vertices
	crw = scale * 0.12		# wid	
	dav = scale * 0.015		# vertical shift up for atoms in atom macro
	dew = scale * 0.02		# east-west shift for left of/right of
	ringside = scale * 0.3		# side of all rings
	dbrack = scale * 0.1		# length of bottom of bracket
}

	{ lineno++ }

/^(\.cstart)|(begin chem)/	{ init(); inchem = 1; next }
/^(\.cend)|(end)/		{ inchem = 0; print ".PE"; next }

/^\./		{ print; next }		# troff

inchem == 0	{ print; next }		# everything else

$1 == "pic"	{ shiftfields(1); print; next }	# pic pass-thru
$1 ~ /^#/	{ next }	# comment

$1 == "textht"	{ textht = $NF; next }
$1 == "cwid"	{ cwid = $NF; next }
$1 == "db"	{ db = $NF; next }
$1 == "size"	{ if ($NF <= 4) size = $NF; else size = $NF/10
		  setparams(size); next }

	{ print "\n#", $0 }	# debugging, etc.
	{ lastname = "" }

$1 ~ /^[A-Z].*:$/ {	# label;  falls thru after shifting left
	lastname = substr($1, 1, length($1)-1)
	print $1
	shiftfields(1)
}

$1 ~ /^\"/	{ print "Last: ", $0; last = OTHER; next }

$1 ~ /bond/	{ bond($1); next }
$1 ~ /^(double|triple|front|back)$/ && $2 == "bond" {
		   $1 = $1 $2; shiftfields(2); bond($1); next }

$1 == "aromatic" { temp = $1; $1 = $2; $2 = temp }
$1 ~ /ring|benz/ { ring($1); next }

$1 == "methyl"	{ $1 = "CH3" }	# left here as an example

$1 ~ /^[A-Z]/	{ molecule(); next }

$1 == "left"	{ left[++stack] = fields(2, NF); printf("Last: [\n"); next }

$1 == "right"	{ bracket(); stack--; next }

$1 == "label"	{ label(); next }

/./	{ print "Last: ", $0; last = OTHER }	

END	{ if (firsttime == 0) error("did you forget .cstart and .cend?")
	  if (inchem) printf ".PE\n"
}

function bond(type,	i, goes, from) {
	goes = ""
	for (i = 2; i <= NF; i++)
		if ($i == ";") {
			goes = $(i+1)
			NF = i - 1
			break
		}
	leng = db
	from = ""
	for (cf = 2; cf <= NF; ) {
		if ($cf ~ /(\+|-)?[0-9]+|up|down|right|left|ne|se|nw|sw/)
			dir = cvtdir(dir)
		else if ($cf ~ /^leng/) {
			leng = $(cf+1)
			cf += 2
		} else if ($cf == "to") {
			leng = 0
			from = fields(cf, NF)
			break
		} else if ($cf == "from") {
			from = dofrom()
			break
		} else if ($cf ~ /^#/) {
			cf = NF+1
			break;
		} else {
			from = fields(cf, NF)
			break
		}
	}
	if (from ~ /( to )|^to/)	# said "from ... to ...", so zap length
		leng = 0
	else if (from == "")	# no from given at all
		from = "from Last." leave(last, dir) " " fields(cf, NF)
	printf "Last: %s(%g, %g, %s)\n", type, leng, dir, from
	last = BOND
	if (lastname != "")
		labsave(lastname, last, dir)
	if (goes) {
		$0 = goes
		molecule()
	}
}

function dofrom(	n, s) {
	cf++	# skip "from"
	n = $cf
	if (n in labtype)	# "from Thing" => "from Thing.V.s"
		return "from " n "." leave(labtype[n], dir)
	if (n ~ /^\.[A-Z]/)	# "from .V" => "from Last.V.s"
		return "from Last" n "." corner(dir)
	if (n ~ /^[A-Z][^.]*\.[A-Z][^.]*$/)	# "from X.V" => "from X.V.s"
		return "from " n "." corner(dir)
	return fields(cf-1, NF)
}

function bracket(	t) {
	printf("]\n")
	if ($2 == ")")
		t = "spline"
	else
		t = "line"
	printf("%s from last [].sw+(%g,0) to last [].sw to last [].nw to last [].nw+(%g,0)\n",
		t, dbrack, dbrack)
	printf("%s from last [].se-(%g,0) to last [].se to last [].ne to last [].ne-(%g,0)\n",
		t, dbrack, dbrack)
	if ($3 == "sub")
		printf("\" %s\" ljust at last [].se\n", fields(4,NF))
}

function molecule(	n, type) {
	n = $1
	if (n == "BP") {
		$1 = "\"\" ht 0 wid 0"
		type = OTHER
	} else {
		$1 = atom(n)
		type = MOL
	}
	gsub(/[^A-Za-z0-9]/, "", n)	# for stuff like C(OH3): zap non-alnum
	if ($2 == "")
		printf "Last: %s: %s with .%s at Last.%s\n", \
			n, $0, leave(type,dir+180), leave(last,dir)
	else if ($2 == "below")
		printf("Last: %s: %s with .n at %s.s\n", n, $1, $3)
	else if ($2 == "above")
		printf("Last: %s: %s with .s at %s.n\n", n, $1, $3)
	else if ($2 == "left" && $3 == "of")
		printf("Last: %s: %s with .e at %s.w+(%g,0)\n", n, $1, $4, dew)
	else if ($2 == "right" && $3 == "of")
		printf("Last: %s: %s with .w at %s.e-(%g,0)\n", n, $1, $4, dew)
	else
		printf "Last: %s: %s\n", n, $0
	last = type
	if (lastname != "")
		labsave(lastname, last, dir)
	labsave(n, last, dir)
}

function label(	i, v) {
	if (substr(labtype[$2], 1, 1) != RING)
		error(sprintf("%s is not a ring", $2))
	else {
		v = substr(labtype[$2], 2, 1)
		for (i = 1; i <= v; i++)
			printf("\"\\s-3%d\\s0\" at 0.%d<%s.C,%s.V%d>\n", i, v+2, $2, $2, i)
	}
}

function ring(type,	typeint, pt, verts, i) {
	pt = 0	# points up by default
	if (type ~ /[1-8]$/)
		verts = substr(type, length(type), 1)
	else if (type ~ /flat/)
		verts = 5
	else
		verts = 6
	fused = other = ""
	for (i = 1; i <= verts; i++)
		put[i] = dbl[i] = ""
	nput = aromatic = withat = 0
	for (cf = 2; cf <= NF; ) {
		if ($cf == "pointing")
			pt = cvtdir(0)
		else if ($cf == "double" || $cf == "triple")
			dblring(verts)
		else if ($cf ~ /arom/) {
			aromatic++
			cf++	# handled later
		} else if ($cf == "put") {
			putring(verts)
			nput++
		} else if ($cf ~ /^#/) {
			cf = NF+1
			break;
		} else {
			if ($cf == "with" || $cf == "at")
				withat = 1
			other = other " " $cf
			cf++
		}
	}
	typeint = RING verts pt		# RING | verts | dir
	if (withat == 0)
		fused = joinring(typeint, dir, last)
	printf "Last: [\n"
	makering(type, pt, verts)
	printf "] %s %s\n", fused, other
	last = typeint
	if (lastname != "")
		labsave(lastname, last, dir)
}

function makering(type, pt, v,       i, a, r) {
	if (type ~ /flat/)
		v = 6
    # vertices
	r = ringside / (2 * sin(pi/v))
	printf "\tC: 0,0\n"
	for (i = 0; i <= v+1; i++) {
		a = ((i-1) / v * 360 + pt) / deg
		printf "\tV%d: (%g,%g)\n", i, r * sin(a), r * cos(a)
	}
	if (type ~ /flat/) {
		printf "\tV4: V5; V5: V6\n"
		v = 5
	}
    # sides
	if (nput > 0) {	# hetero ...
		for (i = 1; i <= v; i++) {
			c1 = c2 = 0
			if (put[i] != "") {
				printf("\tV%d: ellipse invis ht %g wid %g at V%d\n",
					i, crh, crw, i)
				printf("\t%s at V%d\n", put[i], i)
				c1 = cr
			}
			j = i+1
			if (j > v)
				j = 1
			if (put[j] != "")
				c2 = cr
			printf "\tline from V%d to V%d chop %g chop %g\n", i, j, c1, c2
			if (dbl[i] != "") {	# should check i<j
				if (type ~ /flat/ && i == 3) {
					rat = 0.75; fix = 5
				} else {
					rat = 0.85; fix = 1.5
				}
				if (put[i] == "")
					c1 = 0
				else
					c1 = cr/fix
				if (put[j] == "")
					c2 = 0
				else
					c2 = cr/fix
				printf "\tline from %g<C,V%d> to %g<C,V%d> chop %g chop %g\n",
					rat, i, rat, j, c1, c2
				if (dbl[i] == "triple")
					printf "\tline from %g<C,V%d> to %g<C,V%d> chop %g chop %g\n",
						2-rat, i, 2-rat, j, c1, c2
			}
		}
	} else {	# regular
		for (i = 1; i <= v; i++) {
			j = i+1
			if (j > v)
				j = 1
			printf "\tline from V%d to V%d\n", i, j
			if (dbl[i] != "") {	# should check i<j
				if (type ~ /flat/ && i == 3) {
					rat = 0.75
				} else
					rat = 0.85
				printf "\tline from %g<C,V%d> to %g<C,V%d>\n",
					rat, i, rat, j
				if (dbl[i] == "triple")
					printf "\tline from %g<C,V%d> to %g<C,V%d>\n",
						2-rat, i, 2-rat, j
			}
		}
	}
	# punt on triple temporarily
    # circle
	if (type ~ /benz/ || aromatic > 0) {
		if (type ~ /flat/)
			r *= .4
		else
			r *= .5
		printf "\tcircle rad %g at 0,0\n", r
	}
}

function putring(v) {	# collect "put Mol at n"
	cf++
	mol = $(cf++)
	if ($cf == "at")
		cf++
	if ($cf >= 1 && $cf <= v) {
		m = mol
		gsub(/[^A-Za-z0-9]/, "", m)
		put[$cf] = m ":" atom(mol)
	}
	cf++
}

function joinring(type, dir, last) {	# join a ring to something
	if (substr(last, 1, 1) == RING) {	# ring to ring
		if (substr(type, 3) == substr(last, 3))	# fails if not 6-sided
			return "with .V6 at Last.V2"
	}
	# if all else fails
	return sprintf("with .%s at Last.%s", \
		leave(type,dir+180), leave(last,dir))
}

function leave(last, d,		c, c1) {	# return vertex of last in dir d
	if (last == BOND)
		return "end"
	d = reduce(d)
	if (substr(last, 1, 1) == RING)
		return ringleave(last, d)
	if (last == MOL) {
		if (d == 0 || d == 180)
			c = "C"
		else if (d > 0 && d < 180)
			c = "R"
		else
			c = "L"
		if (d in dc)
			c1 = dc[d]
		else 
			c1 = corner(d)
		return sprintf("%s.%s", c, c1)
	}
	if (last == OTHER)
		return corner(d)
	return "c"
}

function ringleave(last, d,	rd, verts) {	# return vertex of ring in dir d
	verts = substr(last, 2, 1)
	rd = substr(last, 3)
	return sprintf("V%d.%s", int(reduce(d-rd)/(360/verts)) + 1, corner(d))
}

function corner(dir) {
	return dc[reduce(45 * int((dir+22.5)/45))]
}	

function labsave(name, type, dir) {
	labtype[name] = type
	labdir[name] = dir
}

function dblring(v,	d, v1, v2) {	# should canonicalize to i,i+1 mod v
	d = $cf
	for (cf++; $cf ~ /^[1-9]/; cf++) {
		v1 = substr($cf,1,1)
		v2 = substr($cf,3,1)
		if (v2 == v1+1 || v1 == v && v2 == 1)	# e.g., 2,3 or 5,1
			dbl[v1] = d
		else if (v1 == v2+1 || v2 == v && v1 == 1)	# e.g., 3,2 or 1,5
			dbl[v2] = d
		else
			error(sprintf("weird %s bond in\n\t%s", d, $0))
	}
}

function cvtdir(d) {	# maps "[pointing] somewhere" to degrees
	if ($cf == "pointing")
		cf++
	if ($cf ~ /^[+\-]?[0-9]+/)
		return reduce($(cf++))
	else if ($cf ~ /left|right|up|down|ne|nw|se|sw/)
		return reduce(dc[$(cf++)])
	else {
		cf++
		return d
	}
}

function reduce(d) {	# reduces d to 0 <= d < 360
	while (d >= 360)
		d -= 360
	while (d < 0)
		d += 360
	return d
}

function atom(s,    c, i, n, nsub, cloc, nsubc) { # convert CH3 to atom(...)
	if (s == "\"\"")
		return s
	n = length(s)
	nsub = nsubc = 0
	cloc = index(s, "C")
	if (cloc == 0)
		cloc = 1
	for (i = 1; i <= n; i++)
		if (substr(s, i, 1) !~ /[A-Z]/) {
			nsub++
			if (i < cloc)
				nsubc++
		}
	gsub(/([0-9]+\.[0-9]+)|([0-9]+)/, "\\s-3\\d&\\u\\s+3", s)
	if (s ~ /([^0-9]\.)|(\.[^0-9])/)	# centered dot
		gsub(/\./, "\\v#-.3m#.\\v#.3m#", s)
	return sprintf("atom(\"%s\", %g, %g, %g, %g, %g, %g)",
		s, (n-nsub/2)*cwid, textht, (cloc-nsubc/2-0.5)*cwid, crh, crw, dav)
}

function in_line(	i, n, s, s1, os) {
	s = $0
	os = ""
	while ((n = match(s, /!?[A-Z][A-Za-z]*(([0-9]+\.[0-9]+)|([0-9]+))/)) > 0) {
		os = os substr(s, 1, n-1)	# prefix
		s1 = substr(s, n, RLENGTH)	# molecule
		if (substr(s1, 1, 1) == "!") {	# !mol => leave alone
			s1 = substr(s1, 2)
		} else {
			gsub(/([0-9]+\.[0-9]+)|([0-9]+)/, "\\s-3\\d&\\u\\s+3", s1)
			if (s1 ~ /([^0-9]\.)|(\.[^0-9])/)	# centered dot
				gsub(/\./, "\\v#-.3m#.\\v#.3m#", s1)
		}
		os = os s1
		s = substr(s, n + RLENGTH)	# tail
	}
	os = os s
	print os
	return
}

function shiftfields(n,		i) {	# move $n+1..$NF to $n..$NF-1, zap $NF
	for (i = n; i < NF; i++)
		$i = $(i+1)
	$NF = ""
	NF--
}

function fields(n1, n2,		i, s) {
	if (n1 > n2)
		return ""
	s = ""
	for (i = n1; i <= n2; i++) {
		if ($i ~ /^#/)
			break;
		s = s $i " "
	}
	return s
}

function set(a, s,     i, n, q) {
	n = split(s, q)
	for (i = 1; i <= n; i += 2)
		a[q[i]] = q[i+1]
}

function error(s) {
	printf "chem\007: error on line %d: %s\n", lineno, s | "cat 1>&2"
}
