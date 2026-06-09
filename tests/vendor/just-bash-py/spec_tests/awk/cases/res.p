.cstart
	CH3O
	bond 60
R1:	benzene
R2:	aromatic flatring5 pointing down put N at 1 with .V3 at R1.V2
	H below R2.V1
R3:	ring put N at 3 with .V5 at R2.V5
R4:	ring put N at 1 with .V1 at R3.V3
	back bond -120 from R4.V4 ; H
	back bond 60 from R4.V3 ; H
R5:	ring with .V1 at R4.V3
	bond -120 ; C
	doublebond down from C ; O
	CH3O left of C
	back bond 60 from R5.V3 ; H
	back bond down from R5.V4 ; O
	CH3 right of O
	bond 120 from R5.V3 ; O
	bond right lenght .1 from O ; C
	double bond down ; O
	bond right length .1 from C 
B:	benzene pointing right
	bond 30 from B ; OCH3
	bond right from B ; OCH3
	bond 150 from B ; OCH3
.cend
