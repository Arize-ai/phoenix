.so /usr/bwk/talks/vg.mac
.vg
.ft R
.cstart
	# this is the structure of penicillin G, an antibiotic
size 14
R1:	ring4 pointing 45 put N at 2 
	doublebond -135 from R1.V3 ; O
	backbond up from R1.V1 ; H
	frontbond -45 from R1.V4 ; N
	H above N
	bond left from N ; C
	doublebond up ; O
	bond length .1 left from C ; CH2
	bond length .1 left
	benzene pointing left
R2:	flatring5 put S at 1 put N at 4 with .V5 at R1.V1
	bond 20 from R2.V2 ; CH3
	bond 90 from R2.V2 ; CH3
	bond 90 from R2.V3 ; H
	backbond 170 from R2.V3 ; COOH
.cend
.CW
	# this is the structure of penicillin G, an antibiotic
R1:	ring4 pointing 45 put N at 2 
	doublebond -135 from R1.V3 ; O
	backbond up from R1.V1 ; H
	frontbond -45 from R1.V4 ; N
	H above N
	bond left from N ; C
	doublebond up ; O
	bond length .1 left from C ; CH2
	bond length .1 left
	benzene pointing left
R2:	flatring5 put S at 1 put N at 4 with .V5 at R1.V1
	bond 20 from R2.V2 ; CH3
	bond 90 from R2.V2 ; CH3
	bond 90 from R2.V3 ; H
	backbond 170 from R2.V3 ; COOH
