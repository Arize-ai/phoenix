### ====================================================================
###  @Awk-file{
###     author          = "Nelson H. F. Beebe",
###     version         = "1.00",
###     date            = "09 October 1996",
###     time            = "15:57:06 MDT",
###     filename        = "journal-toc.awk",
###     address         = "Center for Scientific Computing
###                        Department of Mathematics
###                        University of Utah
###                        Salt Lake City, UT 84112
###                        USA",
###     telephone       = "+1 801 581 5254",
###     FAX             = "+1 801 581 4148",
###     URL             = "http://www.math.utah.edu/~beebe",
###     checksum        = "25092 977 3357 26493",
###     email           = "beebe@math.utah.edu (Internet)",
###     codetable       = "ISO/ASCII",
###     keywords        = "BibTeX, bibliography, HTML, journal table of
###                        contents",
###     supported       = "yes",
###     docstring       = "Create a journal cover table of contents from
###                        <at>Article{...} entries in a journal BibTeX
###                        .bib file for checking the bibliography
###                        database against the actual journal covers.
###                        The output can be either plain text, or HTML.
###
###                        Usage:
###                            bibclean -max-width 0 BibTeX-file(s) | \
###                                bibsort -byvolume | \
###                                awk -f journal-toc.awk \
###                                    [-v HTML=nnn] [-v INDENT=nnn] \
###                                    [-v BIBFILEURL=url] >foo.toc
###
###                            or if the bibliography is already sorted
###                            by volume,
###
###                            bibclean -max-width 0 BibTeX-file(s) | \
###                                awk -f journal-toc.awk \
###                                    [-v HTML=nnn] [-v INDENT=nnn] \
###                                    [-v BIBFILEURL=url] >foo.toc
###
###                        A non-zero value of the command-line option,
###                        HTML=nnn, results in HTML output instead of
###                        the default plain ASCII text (corresponding
###                        to HTML=0).  The
###
###                        The INDENT=nnn command-line option specifies
###                        the number of blanks to indent each logical
###                        level of HTML.  The default is INDENT=4.
###                        INDENT=0 suppresses indentation.  The INDENT
###                        option has no effect when the default HTML=0
###                        (plain text output) option is in effect.
###
###                        When HTML output is selected, the
###                        BIBFILEURL=url command-line option provides a
###                        way to request hypertext links from table of
###                        contents page numbers to the complete BibTeX
###                        entry for the article.  These links are
###                        created by appending a sharp (#) and the
###                        citation label to the BIBFILEURL value, which
###                        conforms with the practice of
###                        bibtex-to-html.awk.
###
###                        The HTML output form may be useful as a more
###                        compact representation of journal article
###                        bibliography data than the original BibTeX
###                        file provides.  Of course, the
###                        table-of-contents format provides less
###                        information, and is considerably more
###                        troublesome for a computer program to parse.
###
###                        When URL key values are provided, they will
###                        be used to create hypertext links around
###                        article titles.  This supports journals that
###                        provide article contents on the World-Wide
###                        Web.
###
###                        For parsing simplicity, this program requires
###                        that BibTeX
###
###                            key = "value"
###
###                        and
###
###                            @String{name = "value"}
###
###                        specifications be entirely contained on
###                        single lines, which is readily provided by
###                        the `bibclean -max-width 0' filter.  It also
###                        requires that bibliography entries begin and
###                        end at the start of a line, and that
###                        quotation marks, rather than balanced braces,
###                        delimit string values.  This is a
###                        conventional format that again can be
###                        guaranteed by bibclean.
###
###                        This program requires `new' awk, as described
###                        in the book
###
###                            Alfred V. Aho, Brian W. Kernighan, and
###                            Peter J. Weinberger,
###                            ``The AWK Programming Language'',
###                            Addison-Wesley (1988), ISBN
###                            0-201-07981-X,
###
###                        such as provided by programs named (GNU)
###                        gawk, nawk, and recent AT&T awk.
###
###                        The checksum field above contains a CRC-16
###                        checksum as the first value, followed by the
###                        equivalent of the standard UNIX wc (word
###                        count) utility output of lines, words, and
###                        characters.  This is produced by Robert
###                        Solovay's checksum utility.",
###  }
### ====================================================================

BEGIN						{ initialize() }

/^ *@ *[Ss][Tt][Rr][Ii][Nn][Gg] *{/		{ do_String(); next }

/^ *@ *[Pp][Rr][Ee][Aa][Mm][Bb][Ll][Ee]/	{ next }

/^ *@ *[Aa][Rr][Tt][Ii][Cc][Ll][Ee]/		{ do_Article(); next }

/^ *@/						{ do_Other(); next }

/^ *author *= *\"/ 				{ do_author(); next }

/^ *journal *= */				{ do_journal(); next }

/^ *volume *= *\"/				{ do_volume(); next }

/^ *number *= *\"/				{ do_number(); next }

/^ *year *= *\"/				{ do_year(); next }

/^ *month *= */					{ do_month(); next }

/^ *title *= *\"/				{ do_title(); next }

/^ *pages *= *\"/				{ do_pages(); next }

/^ *URL *= *\"/					{ do_URL(); next }

/^ *} *$/					{ if (In_Article) do_end_entry(); next }

END						{ terminate() }


########################################################################
# NB: The programming conventions for variables in this program are:   #
#	UPPERCASE		global constants and user options      #
#	Initialuppercase	global variables                       #
#	lowercase		local variables                        #
# Any deviation is an error!                                           #
########################################################################


function do_Article()
{
	In_Article = 1

	Citation_label = $0
	sub(/^[^\{]*{/,"",Citation_label)
	sub(/ *, *$/,"",Citation_label)

	Author = ""
        Title = ""
        Journal = ""
        Volume = ""
        Number = ""
        Month = ""
        Year = ""
        Pages = ""
        Url = ""
}


function do_author()
{
	Author = TeX_to_HTML(get_value($0))
}


function do_end_entry( k,n,parts)
{
	n = split(Author,parts," and ")
	if (Last_number != Number)
		do_new_issue()
	for (k = 1; k < n; ++k)
		print_toc_line(parts[k] " and", "", "")
	Title_prefix = html_begin_title()
	Title_suffix = html_end_title()
	if (html_length(Title) <= (MAX_TITLE_CHARS + MIN_LEADERS)) # complete title fits on line
		print_toc_line(parts[n], Title, html_begin_pages() Pages html_end_pages())
	else			# need to split long title over multiple lines
		do_long_title(parts[n], Title, html_begin_pages() Pages html_end_pages())
}


function do_journal()
{
	if ($0 ~ /[=] *"/)	# have journal = "quoted journal name",
		Journal = get_value($0)
	else			# have journal = journal-abbreviation,
	{
        	Journal = get_abbrev($0)
		if (Journal in String) # replace abbrev by its expansion
			Journal = String[Journal]
	}
	gsub(/\\-/,"",Journal)	# remove discretionary hyphens
}


function do_long_title(author,title,pages, last_title,n)
{
	title = trim(title)			# discard leading and trailing space
	while (length(title) > 0)
	{
		n = html_breakpoint(title,MAX_TITLE_CHARS+MIN_LEADERS)
		last_title = substr(title,1,n)
		title = substr(title,n+1)
		sub(/^ +/,"",title)		# discard any leading space
		print_toc_line(author, last_title, (length(title) == 0) ? pages : "")
		author = ""
	}
}


function do_month( k,n,parts)
{
	Month = ($0 ~ /[=] *"/) ? get_value($0) : get_abbrev($0)
	gsub(/[\"]/,"",Month)
	gsub(/ *# *\\slash *# */," / ",Month)
	gsub(/ *# *-+ *# */," / ",Month)
	n = split(Month,parts," */ *")
	Month = ""
	for (k = 1; k <= n; ++k)
		Month = Month ((k > 1) ? " / " : "") \
			((parts[k] in Month_expansion) ? Month_expansion[parts[k]] : parts[k])
}


function do_new_issue()
{
	Last_number = Number
	if (HTML)
	{
		if (Last_volume != Volume)
		{
			Last_volume = Volume
			print_line(prefix(2) "<BR>")
		}
		html_end_toc()
		html_begin_issue()
		print_line(prefix(2) Journal "<BR>")
	}
	else
	{
		print_line("")
		print_line(Journal)
	}

	print_line(strip_html(vol_no_month_year()))

	if (HTML)
	{
		html_end_issue()
		html_toc_entry()
		html_begin_toc()
	}
	else
		print_line("")
}


function do_number()
{
	Number = get_value($0)
}


function do_Other()
{
	In_Article = 0
}


function do_pages()
{
	Pages = get_value($0)
	sub(/--[?][?]/,"",Pages)
}


function do_String()
{
	sub(/^[^\{]*\{/,"",$0)	# discard up to and including open brace
	sub(/\} *$/,"",$0)	# discard from optional whitespace and trailing brace to end of line
	String[get_key($0)] = get_value($0)
}


function do_title()
{
	Title = TeX_to_HTML(get_value($0))
}


function do_URL( parts)
{
	Url = get_value($0)
	split(Url,parts,"[,;]")			# in case we have multiple URLs
	Url = trim(parts[1])
}


function do_volume()
{
	Volume = get_value($0)
}


function do_year()
{
	Year = get_value($0)
}


function get_abbrev(s)
{	# return abbrev from ``key = abbrev,''
	sub(/^[^=]*= */,"",s)	# discard text up to start of non-blank value
	sub(/ *,? *$/,"",s)	# discard trailing optional whitspace, quote,
				# optional comma, and optional space
	return (s)
}


function get_key(s)
{	# return kay from ``key = "value",''
	sub(/^ */,"",s)		# discard leading space
	sub(/ *=.*$/,"",s)	# discard everthing after key

	return (s)
}


function get_value(s)
{	# return value from ``key = "value",''
	sub(/^[^\"]*\" */,"",s)	# discard text up to start of non-blank value
	sub(/ *\",? *$/,"",s)	# discard trailing optional whitspace, quote,
				# optional comma, and optional space
	return (s)
}


function html_accents(s)
{
	if (index(s,"\\") > 0)			# important optimization
	{
		# Convert common lower-case accented letters according to the
		# table on p. 169 of in Peter Flynn's ``The World Wide Web
		# Handbook'', International Thomson Computer Press, 1995, ISBN
		# 1-85032-205-8.  The official table of ISO Latin 1 SGML
		# entities used in HTML can be found in the file
		# /usr/local/lib/html-check/lib/ISOlat1.sgml (your path
		# may differ).

		gsub(/{\\\a}/,	"\\&agrave;",	s)
		gsub(/{\\'a}/,	"\\&aacute;",	s)
		gsub(/{\\[\^]a}/,"\\&acirc;",	s)
		gsub(/{\\~a}/,	"\\&atilde;",	s)
		gsub(/{\\\"a}/,	"\\&auml;",	s)
		gsub(/{\\aa}/,	"\\&aring;",	s)
		gsub(/{\\ae}/,	"\\&aelig;",	s)

		gsub(/{\\c{c}}/,"\\&ccedil;",	s)

		gsub(/{\\\e}/,	"\\&egrave;",	s)
		gsub(/{\\'e}/,	"\\&eacute;",	s)
		gsub(/{\\[\^]e}/,"\\&ecirc;",	s)
		gsub(/{\\\"e}/,	"\\&euml;",	s)

		gsub(/{\\\i}/,	"\\&igrave;",	s)
		gsub(/{\\'i}/,	"\\&iacute;",	s)
		gsub(/{\\[\^]i}/,"\\&icirc;",	s)
		gsub(/{\\\"i}/,	"\\&iuml;",	s)

		# ignore eth and thorn

		gsub(/{\\~n}/,	"\\&ntilde;",	s)

		gsub(/{\\\o}/,	"\\&ograve;",	s)
		gsub(/{\\'o}/,	"\\&oacute;",	s)
		gsub(/{\\[\^]o}/, "\\&ocirc;",	s)
		gsub(/{\\~o}/,	"\\&otilde;",	s)
		gsub(/{\\\"o}/,	"\\&ouml;",	s)
		gsub(/{\\o}/,	"\\&oslash;",	s)

		gsub(/{\\\u}/,	"\\&ugrave;",	s)
		gsub(/{\\'u}/,	"\\&uacute;",	s)
		gsub(/{\\[\^]u}/,"\\&ucirc;",	s)
		gsub(/{\\\"u}/,	"\\&uuml;",	s)

		gsub(/{\\'y}/,	"\\&yacute;",	s)
		gsub(/{\\\"y}/,	"\\&yuml;",	s)

		# Now do the same for upper-case accents

		gsub(/{\\\A}/,	"\\&Agrave;",	s)
		gsub(/{\\'A}/,	"\\&Aacute;",	s)
		gsub(/{\\[\^]A}/,	"\\&Acirc;",	s)
		gsub(/{\\~A}/,	"\\&Atilde;",	s)
		gsub(/{\\\"A}/,	"\\&Auml;",	s)
		gsub(/{\\AA}/,	"\\&Aring;",	s)
		gsub(/{\\AE}/,	"\\&AElig;",	s)

		gsub(/{\\c{C}}/,"\\&Ccedil;",	s)

		gsub(/{\\\e}/,	"\\&Egrave;",	s)
		gsub(/{\\'E}/,	"\\&Eacute;",	s)
		gsub(/{\\[\^]E}/,	"\\&Ecirc;",	s)
		gsub(/{\\\"E}/,	"\\&Euml;",	s)

		gsub(/{\\\I}/,	"\\&Igrave;",	s)
		gsub(/{\\'I}/,	"\\&Iacute;",	s)
		gsub(/{\\[\^]I}/,	"\\&Icirc;",	s)
		gsub(/{\\\"I}/,	"\\&Iuml;",	s)

		# ignore eth and thorn

		gsub(/{\\~N}/,	"\\&Ntilde;",	s)

		gsub(/{\\\O}/,	"\\&Ograve;",	s)
		gsub(/{\\'O}/,	"\\&Oacute;",	s)
		gsub(/{\\[\^]O}/,	"\\&Ocirc;",	s)
		gsub(/{\\~O}/,	"\\&Otilde;",	s)
		gsub(/{\\\"O}/,	"\\&Ouml;",	s)
		gsub(/{\\O}/,	"\\&Oslash;",	s)

		gsub(/{\\\U}/,	"\\&Ugrave;",	s)
		gsub(/{\\'U}/,	"\\&Uacute;",	s)
		gsub(/{\\[\^]U}/,	"\\&Ucirc;",	s)
		gsub(/{\\\"U}/,	"\\&Uuml;",	s)

		gsub(/{\\'Y}/,	"\\&Yacute;",	s)

		gsub(/{\\ss}/,	"\\&szlig;",	s)

		# Others not mentioned in Flynn's book
		gsub(/{\\'\\i}/,"\\&iacute;",	s)
		gsub(/{\\'\\j}/,"j",		s)
	}
	return (s)
}


function html_begin_issue()
{
	print_line("")
	print_line(prefix(2) "<HR>")
	print_line("")
	print_line(prefix(2) "<H1>")
	print_line(prefix(3) "<A NAME=\"" html_label() "\">")
}


function html_begin_pages()
{
	return ((HTML && (BIBFILEURL != "")) ? ("<A HREF=\"" BIBFILEURL "#" Citation_label "\">") : "")
}


function html_begin_pre()
{
	In_PRE = 1
	print_line("<PRE>")
}


function html_begin_title()
{
	return ((HTML && (Url != "")) ? ("<A HREF=\"" Url "\">") : "")
}


function html_begin_toc()
{
	html_end_toc()
	html_begin_pre()
}


function html_body( k)
{
	for (k = 1; k <= BodyLines; ++k)
		print Body[k]
}

function html_breakpoint(title,maxlength, break_after,k)
{
	# Return the largest character position in title AFTER which we
	# can break the title across lines, without exceeding maxlength
	# visible characters.
	if (html_length(title) > maxlength)	# then need to split title across lines
	{
		# In the presence of HTML markup, the initialization of
		# k here is complicated, because we need to advance it
		# until html_length(title) is at least maxlength,
		# without invoking the expensive html_length() function
		# too frequently.  The need to split the title makes the
		# alternative of delayed insertion of HTML markup much
		# more complicated.
		break_after = 0
		for (k = min(maxlength,length(title)); k < length(title); ++k)
		{
			if (substr(title,k+1,1) == " ")
			{		# could break after position k
				if (html_length(substr(title,1,k)) <= maxlength)
					break_after = k
				else	# advanced too far, retreat back to last break_after
					break
			}
		}
		if (break_after == 0)		# no breakpoint found by forward scan
		{				# so switch to backward scan
			for (k = min(maxlength,length(title)) - 1; \
				(k > 0) && (substr(title,k+1,1) != " "); --k)
				;		# find space at which to break title
			if (k < 1)		# no break point found
				k = length(title) # so must print entire string
		}
		else
			k = break_after
	}
	else					# title fits on one line
		k = length(title)
	return (k)
}



function html_end_issue()
{
	print_line(prefix(3) "</A>")
	print_line(prefix(2) "</H1>")
}


function html_end_pages()
{
	return ((HTML && (BIBFILEURL != "")) ? "</A>" : "")
}


function html_end_pre()
{
	if (In_PRE)
	{
		print_line("</PRE>")
		In_PRE = 0
	}
}


function html_end_title()
{
	return ((HTML && (Url != "")) ? "</A>" : "")
}


function html_end_toc()
{
	html_end_pre()
}


function html_fonts(s, arg,control_word,k,level,n,open_brace)
{
	open_brace = index(s,"{")
	if (open_brace > 0)			# important optimization
	{
		level = 1
		for (k = open_brace + 1; (level != 0) && (k <= length(s)); ++k)
		{
			if (substr(s,k,1) == "{")
				level++
			else if (substr(s,k,1) == "}")
				level--
		}

		# {...} is now found at open_brace ... (k-1)
		for (control_word in Font_decl_map)	# look for {\xxx ...}
		{
			if (substr(s,open_brace+1,length(control_word)+1) ~ \
				("\\" control_word "[^A-Za-z]"))
			{
				n = open_brace + 1 + length(control_word)
				arg = trim(substr(s,n,k - n))
				if (Font_decl_map[control_word] == "toupper") # arg -> ARG
					arg = toupper(arg)
				else if (Font_decl_map[control_word] != "") # arg -> <TAG>arg</TAG>
					arg = "<" Font_decl_map[control_word] ">" arg "</" Font_decl_map[control_word] ">"
				return (substr(s,1,open_brace-1) arg html_fonts(substr(s,k)))
			}
		}
		for (control_word in Font_cmd_map)	# look for \xxx{...}
		{
			if (substr(s,open_brace - length(control_word),length(control_word)) ~ \
				("\\" control_word))
			{
				n = open_brace + 1
				arg = trim(substr(s,n,k - n))
				if (Font_cmd_map[control_word] == "toupper") # arg -> ARG
					arg = toupper(arg)
				else if (Font_cmd_map[control_word] != "") # arg -> <TAG>arg</TAG>
					arg = "<" Font_cmd_map[control_word] ">" arg "</" Font_cmd_map[control_word] ">"
				n = open_brace - length(control_word) - 1
				return (substr(s,1,n) arg html_fonts(substr(s,k)))
			}
		}
	}
	return (s)
}


function html_header()
{
	USER = ENVIRON["USER"]
	if (USER == "")
	    USER = ENVIRON["LOGNAME"]
	if (USER == "")
	    USER = "????"
	"hostname" | getline HOSTNAME
	"date" | getline DATE
	("ypcat passwd | grep '^" USER ":' | awk -F: '{print $5}'") | getline PERSONAL_NAME
	if (PERSONAL_NAME == "")
	    ("grep  '^" USER ":' /etc/passwd | awk -F: '{print $5}'") | getline PERSONAL_NAME


	print "<!-- WARNING: Do NOT edit this file.  It was converted from -->"
	print "<!-- BibTeX format to HTML by journal-toc.awk version " VERSION_NUMBER " " VERSION_DATE " -->"
	print "<!-- on " DATE " -->"
	print "<!-- for " PERSONAL_NAME " (" USER "@" HOSTNAME ") -->"
	print ""
	print ""
	print "<!DOCTYPE HTML public \"-//IETF//DTD HTML//EN\">"
	print ""
	print "<HTML>"
	print prefix(1) "<HEAD>"
	print prefix(2) "<TITLE>"
	print prefix(3)  Journal
	print prefix(2) "</TITLE>"
	print prefix(2) "<LINK REV=\"made\" HREF=\"mailto:" USER "@" HOSTNAME "\">"
	print prefix(1) "</HEAD>"
	print ""
	print prefix(1) "<BODY>"
}


function html_label( label)
{
	label = Volume "(" Number "):" Month ":" Year
	gsub(/[^A-Za-z0-9():,;.\/\-]/,"",label)
	return (label)
}


function html_length(s)
{	# Return visible length of s, ignoring any HTML markup
	if (HTML)
	{
		gsub(/<\/?[^>]*>/,"",s)		# remove SGML tags
		gsub(/&[A-Za-z0-9]+;/,"",s)	# remove SGML entities
	}
	return (length(s))
}


function html_toc()
{
	print prefix(2) "<H1>"
	print prefix(3) "Table of contents for issues of " Journal
	print prefix(2) "</H1>"
	print HTML_TOC
}


function html_toc_entry()
{
	HTML_TOC = HTML_TOC "        <A HREF=\"#" html_label() "\">"
	HTML_TOC = HTML_TOC vol_no_month_year()
	HTML_TOC = HTML_TOC "</A><BR>" "\n"
}


function html_trailer()
{
	html_end_pre()
	print prefix(1) "</BODY>"
	print "</HTML>"
}


function initialize()
{
	# NB: Update these when the program changes
	VERSION_DATE = "[09-Oct-1996]"
	VERSION_NUMBER = "1.00"

	HTML = (HTML == "") ? 0 : (0 + HTML)

	if (INDENT == "")
		INDENT = 4

	if (HTML == 0)
		INDENT = 0	# indentation suppressed in ASCII mode

	LEADERS = " . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . ."

	MAX_TITLE_CHARS = 36	# 36 produces a 79-char output line when there is
				# just an initial page number.  If this is
				# increased, the LEADERS string may need to be
				# lengthened.

	MIN_LEADERS = 4		# Minimum number of characters from LEADERS
				# required when leaders are used.  The total
				# number of characters that can appear in a
				# title line is MAX_TITLE_CHARS + MIN_LEADERS.
				# Leaders are omitted when the title length is
				# between MAX_TITLE_CHARS and this sum.

	MIN_LEADERS_SPACE = "        "	# must be at least MIN_LEADERS characters long

	Month_expansion["jan"]	= "January"
	Month_expansion["feb"]	= "February"
	Month_expansion["mar"]	= "March"
	Month_expansion["apr"]	= "April"
	Month_expansion["may"]	= "May"
	Month_expansion["jun"]	= "June"
	Month_expansion["jul"]	= "July"
	Month_expansion["aug"]	= "August"
	Month_expansion["sep"]	= "September"
	Month_expansion["oct"]	= "October"
	Month_expansion["nov"]	= "November"
	Month_expansion["dec"]	= "December"

	Font_cmd_map["\\emph"]		= "EM"
	Font_cmd_map["\\textbf"]	= "B"
	Font_cmd_map["\\textit"]	= "I"
	Font_cmd_map["\\textmd"]	= ""
	Font_cmd_map["\\textrm"]	= ""
	Font_cmd_map["\\textsc"]	= "toupper"
	Font_cmd_map["\\textsl"]	= "I"
	Font_cmd_map["\\texttt"]	= "t"
	Font_cmd_map["\\textup"]	= ""

	Font_decl_map["\\bf"]		= "B"
	Font_decl_map["\\em"]		= "EM"
	Font_decl_map["\\it"]		= "I"
	Font_decl_map["\\rm"]		= ""
	Font_decl_map["\\sc"]		= "toupper"
	Font_decl_map["\\sf"]		= ""
	Font_decl_map["\\tt"]		= "TT"
	Font_decl_map["\\itshape"]	= "I"
	Font_decl_map["\\upshape"]	= ""
	Font_decl_map["\\slshape"]	= "I"
	Font_decl_map["\\scshape"]	= "toupper"
	Font_decl_map["\\mdseries"]	= ""
	Font_decl_map["\\bfseries"]	= "B"
	Font_decl_map["\\rmfamily"]	= ""
	Font_decl_map["\\sffamily"]	= ""
	Font_decl_map["\\ttfamily"]	= "TT"
}

function min(a,b)
{
	return (a < b) ? a : b
}


function prefix(level)
{
	# Return a prefix of up to 60 blanks

	if (In_PRE)
		return ("")
	else
		return (substr("                                                            ", \
			1, INDENT * level))
}


function print_line(line)
{
	if (HTML)		# must buffer in memory so that we can accumulate TOC
		Body[++BodyLines] = line
	else
		print line
}


function print_toc_line(author,title,pages, extra,leaders,n,t)
{
	# When we have a multiline title, the hypertext link goes only
	# on the first line.  A multiline hypertext link looks awful
	# because of long underlines under the leading indentation.

	if (pages == "")	# then no leaders needed in title lines other than last one
		t = sprintf("%31s   %s%s%s", author, Title_prefix, title, Title_suffix)
	else					# last title line, with page number
	{
		n = html_length(title)		# potentially expensive
		extra = n % 2			# extra space for aligned leader dots
		if (n <= MAX_TITLE_CHARS) 	# then need leaders
			leaders = substr(LEADERS, 1, MAX_TITLE_CHARS + MIN_LEADERS - extra - \
				   min(MAX_TITLE_CHARS,n))
		else				# title (almost) fills line, so no leaders
			leaders = substr(MIN_LEADERS_SPACE,1, \
					 (MAX_TITLE_CHARS + MIN_LEADERS - extra - n))
		t = sprintf("%31s   %s%s%s%s%s %4s", \
			    author, Title_prefix, title, Title_suffix, \
			    (extra ? " " : ""), leaders, pages)
	}

	Title_prefix = ""	# forget any hypertext
	Title_suffix = ""	# link material

	# Efficency note: an earlier version accumulated the body in a
	# single scalar like this: "Body = Body t".  Profiling revealed
	# this statement as the major hot spot, and the change to array
	# storage made the program more than twice as fast.  This
	# suggests that awk might benefit from an optimization of
	# "s = s t" that uses realloc() instead of malloc().
	if (HTML)
		Body[++BodyLines] = t
	else
		print t
}


function protect_SGML_characters(s)
{
    gsub(/&/,"\\&amp;",s)	# NB: this one MUST be first
    gsub(/</,"\\&lt;",s)
    gsub(/>/,"\\&gt;",s)
    gsub(/\"/,"\\&quot;",s)
    return (s)
}


function strip_braces(s, k)
{	# strip non-backslashed braces from s and return the result

	return (strip_char(strip_char(s,"{"),"}"))
}


function strip_char(s,c, k)
{	# strip non-backslashed instances of c from s, and return the result
	k = index(s,c)
	if (k > 0)		# then found the character
	{
		if (substr(s,k-1,1) != "\\") # then not backslashed char
			s = substr(s,1,k-1) strip_char(substr(s,k+1),c) # so remove it (recursively)
		else		# preserve backslashed char
			s = substr(s,1,k) strip_char(s,k+1,c)
	}
	return (s)
}


function strip_html(s)
{
	gsub(/<\/?[^>]*>/,"",s)
	return (s)
}


function terminate()
{
	if (HTML)
	{
		html_end_pre()

		HTML = 0	# NB: stop line buffering
		html_header()
		html_toc()
		html_body()
		html_trailer()
	}
}


function TeX_to_HTML(s, k,n,parts)
{
	# First convert the four SGML reserved characters to SGML entities
	if (HTML)
	{
	    gsub(/>/,	"\\&gt;",	s)
	    gsub(/</,	"\\&lt;",	s)
	    gsub(/"/,	"\\&quot;",	s)
	}

	gsub(/[$][$]/,"$$",s)	# change display math to triple dollars for split
	n = split(s,parts,/[$]/)# split into non-math (odd) and math (even) parts

	s = ""
	for (k = 1; k <= n; ++k) # unbrace non-math part, leaving math mode intact
		s = s ((k > 1) ? "$" : "") \
			((k % 2) ? strip_braces(TeX_to_HTML_nonmath(parts[k])) : \
			TeX_to_HTML_math(parts[k]))

	gsub(/[$][$][$]/,"$$",s) # restore display math

	return (s)
}


function TeX_to_HTML_math(s)
{
	# Mostly a dummy for now, but HTML 3 could support some math translation

	gsub(/\\&/,"\\&amp;",s)	# reduce TeX ampersands to SGML entities

	return (s)
}


function TeX_to_HTML_nonmath(s)
{
	if (index(s,"\\") > 0)			# important optimization
	{
		gsub(/\\slash +/,"/",s)		# replace TeX slashes with conventional ones
		gsub(/ *\\emdash +/," --- ",s)	# replace BibNet emdashes with conventional ones
		gsub(/\\%/,"%",s)		# reduce TeX percents to conventional ones
		gsub(/\\[$]/,"$",s)		# reduce TeX dollars to conventional ones
		gsub(/\\#/,"#",s)		# reduce TeX sharps to conventional ones

		if (HTML)			# translate TeX markup to HTML
		{
			gsub(/\\&/,"\\&amp;",s)	# reduce TeX ampersands to SGML entities
			s = html_accents(s)
			s = html_fonts(s)
		}
		else				# plain ASCII text output: discard all TeX markup
		{
			gsub(/\\\&/, "\\&", s)	# reduce TeX ampersands to conventional ones

			gsub(/\\[a-z][a-z] +/,"",s) # remove TeX font changes
			gsub(/\\[^A-Za-z]/,"",s) # remove remaining TeX control symbols
		}
	}
	return (s)
}


function trim(s)
{
    gsub(/^[ \t]+/,"",s)
    gsub(/[ \t]+$/,"",s)
    return (s)
}


function vol_no_month_year()
{
	return ("Volume " wrap(Volume)  ",  Number " wrap(Number) ", " wrap(Month) ", " wrap(Year))
}


function wrap(value)
{
	return (HTML ? ("<STRONG>" value "</STRONG>") : value)
}
