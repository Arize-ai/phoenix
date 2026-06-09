function g() { return "{" f() "}" }
function f() { return $1 }
 { print "<" g() ">" }
