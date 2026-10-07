"""Regenerate the agent-surfaces SVG in the Harbor deck."""
import re,json,sys
P=__import__("os").path.join(__import__("os").path.dirname(__file__),"index.html")
ic=json.load(open(__import__("os").path.join(__import__("os").path.dirname(__file__),"surfaces-icons.json")))
ic['mcp']=ic['mcp'].replace('#A5B4FC','var(--text)')
H='fill="none" stroke-width="1.5" style="stroke:var(--line-strong)"'
def svg(k,x,y,w,h=None):
    h=h or w; return re.sub(r'^<svg x="[\d.]+" y="[\d.]+" width="\d+" height="\d+"',f'<svg x="{x}" y="{y}" width="{w}" height="{h}"',ic[k])
def g(k,x,y,sc): return re.sub(r'^<g transform="translate\([\d. ]+\)"',f'<g transform="translate({x} {y}) scale({sc})"',ic[k])
phx=lambda x,y,w,h:f'<svg x="{x}" y="{y}" width="{w}" height="{h}" viewBox="0 0 305.92 350.13" aria-hidden="true"><use href="#phoenix"/></svg>'
pxi=lambda x,y,w:f'<svg x="{x}" y="{y}" width="{w}" height="{w}" viewBox="0 0 18.5 18.5" fill="var(--text)" aria-hidden="true"><rect x="0" y="0" width="5.5" height="5.5" rx="1.1"/><rect x="13" y="0" width="5.5" height="5.5" rx="1.1"/><rect x="6.5" y="6.5" width="5.5" height="5.5" rx="1.1"/><rect x="0" y="13" width="5.5" height="5.5" rx="1.1"/><rect x="13" y="13" width="5.5" height="5.5" rx="1.1"/></svg>'
robot=lambda x,y,w:f'<svg x="{x}" y="{y}" width="{w}" height="{w}" viewBox="0 0 24 24" fill="none" stroke="var(--text)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="9" width="14" height="10" rx="3"/><path d="M12 5v4M9 14h.01M15 14h.01"/><circle cx="12" cy="4" r="1"/></svg>'
cyl=lambda x,y:f'<svg x="{x}" y="{y}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>'
layers=lambda x,y:f'<svg x="{x}" y="{y}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/></svg>'
ar_r=lambda x,y:f'<path d="M{x-8} {y-6} L{x} {y} L{x-8} {y+6}" {H}/>'
ar_l=lambda x,y:f'<path d="M{x+8} {y-6} L{x} {y} L{x+8} {y+6}" {H}/>'
ar_d=lambda x,y:f'<path d="M{x-6} {y-8} L{x} {y} L{x+6} {y-8}" {H}/>'
ar_u=lambda x,y:f'<path d="M{x-6} {y+8} L{x} {y} L{x+6} {y+8}" {H}/>'
badge=lambda cx,cy,t:f'<g class="hx-b"><circle cx="{cx}" cy="{cy}" r="10"/><text x="{cx}" y="{cy+4}" text-anchor="middle" style="font-size:12px">{t}</text></g>'
box=lambda x,y,w,h,cls='node',rx=14:f'<rect class="{cls}" x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}"/>'
wire=lambda d:f'<path class="wire" d="{d}"/>'
lbl=lambda x,y,t,fs=20,extra='':f'<text class="lbl" x="{x}" y="{y}" style="font-size:{fs}px"{extra}>{t}</text>'
sub=lambda x,y,t,fs=12,extra='':f'<text class="sub" x="{x}" y="{y}" style="font-size:{fs}px"{extra}>{t}</text>'

# rows
PXI=(262,48); MCP=(342,48); API=(430,48); CORE=(510,80); SRV_B=CORE[0]+CORE[1]+24; DB=(634,92)
L,Rc=640,805; CW=145; RIGHT=950           # two columns
o=[]; A=o.append
A('<g class="ap-dock">'+box(400,-52,680,DB[0]+DB[1]+28+52,'ap-sbx')+lbl(424,-22,'Docker',18)+'</g>')
A(box(420,236,640,SRV_B-236)+phx(434,258,18,22)+lbl(460,276,'Phoenix server',18))
# agents
A(box(550,0,260,84)+lbl(570,38,'Coding agent')+sub(570,62,'CLAUDE CODE · CURSOR · CODEX')+svg('agent1',722,16,22)+svg('agent2',752,16,22)+svg('agent3',782,16,22))
A(wire('M610 84 V156')+ar_d(610,156)+box(550,156,130,48)+g('cli',581,170,0.75)+lbl(617,186,'CLI',18))
A(wire(f'M610 204 V{API[0]+24} H{L}')+ar_r(L,API[0]+24))                                  # CLI -> REST
A(wire(f'M610 {API[0]-20} H705 A7 7 0 0 1 719 {API[0]-20} H830 V{API[0]}')+ar_d(830,API[0]))  # CLI -> GraphQL, over REST
A(wire(f'M750 84 V{MCP[0]}')+ar_d(750,MCP[0]))                                            # coding agent -> MCP
A(box(825,0,190,84)
  +'<g class="ap-live">'+g('browser',951,25,1.1).replace('</g>',phx(14,10,16,18)+'</g>')+lbl(845,38,'Browser')+sub(845,62,'PHOENIX UI')+'</g>'
  +'<g class="ap-dock">'+lbl(845,38,'Test client')+sub(845,62,'SCRIPTED TURNS')+'</g>')
A(wire(f'M890 84 V{PXI[0]}')+ar_d(890,PXI[0]))                                            # browser -> PXI
A(badge(610,112,'1')+badge(750,112,'2')+badge(890,112,'3'))
# server stack
py=PXI[0]; A(box(Rc,py,CW,PXI[1],'hx-env',10)+pxi(Rc+40,py+13,22)+lbl(Rc+74,py+30,'PXI',18))
A(wire(f'M890 {py+PXI[1]} V{MCP[0]}')+ar_d(890,MCP[0]))                                   # PXI -> MCP
gy=API[0]+24; A(wire(f'M{RIGHT} {py+24} H975 V{gy} H{RIGHT}')+ar_l(RIGHT,gy))             # PXI -> GraphQL
my=MCP[0]; A(box(L,my,RIGHT-L,MCP[1],'hx-env',10)+svg('mcp',759,my+12,24)+lbl(793,my+30,'MCP',18))
A(wire(f'M712 {my+MCP[1]} V{API[0]}')+ar_d(712,API[0])+wire(f'M890 {my+MCP[1]} V{API[0]}')+ar_d(890,API[0]))
ay=API[0]; A(box(L,ay,CW,API[1],'hx-env',10)+svg('rest',L+20,ay+14,20)+lbl(L+50,ay+30,'REST',18)+box(Rc,ay,CW,API[1],'hx-env',10)+svg('gql',Rc+20,ay+14,20)+lbl(Rc+50,ay+30,'GraphQL',18))
cy=CORE[0]; A(wire(f'M712 {ay+API[1]} V{cy}')+ar_d(712,cy)+wire(f'M890 {ay+API[1]} V{cy}')+ar_d(890,cy))
A(box(L,cy,RIGHT-L,CORE[1],'hx-env',10)+layers(L+20,cy+12)+lbl(L+50,cy+28,'Core services',18)+sub(L+20,cy+50,'PROJECTS · TRACES · SESSIONS · DATASETS',10.5)+sub(L+20,cy+66,'EXPERIMENTS · PROMPTS · EVALUATORS',10.5))
# OTLP + your AI app (production only)
oy=MCP[0]; oh=API[0]+API[1]-oy; rc=oy+oh//2; A('<g class="ap-live">'+box(440,oy,120,oh,'hx-env',10)+svg('otlp',488,oy+24,24)+lbl(500,oy+70,'OTLP',18,' text-anchor="middle"')+sub(500,oy+92,'SPAN INGEST',11,' text-anchor="middle"')
  +wire(f'M500 {oy+oh} V{DB[0]+46} H{L}')+ar_r(L,DB[0]+46)
  +box(240,oy,120,oh)+svg('otel',288,oy+24,24)+lbl(300,oy+70,'Your AI app',16,' text-anchor="middle"')+sub(300,oy+92,'OTEL EXPORTER',11,' text-anchor="middle"')+wire(f'M360 {rc} H440')+ar_r(440,rc)+'</g>')
# database
dy=DB[0]; A(wire(f'M795 {cy+CORE[1]} V{dy}')+ar_d(795,dy))
A(box(L,dy,RIGHT-L,DB[1])+cyl(L+20,dy+12)+lbl(L+50,dy+28,'Database',18)+box(L+12,dy+44,137,40,'hx-env',10)+svg('sqlite',L+20,dy+55,18)+lbl(L+50,dy+70,'SQLite',16)+box(L+161,dy+44,137,40,'hx-env',10)+svg('pg',L+169,dy+55,18)+lbl(L+199,dy+70,'PostgreSQL',15.5))
A(wire(f'M{RIGHT} {my+24} H968 A7 7 0 0 1 982 {my+24} H1030 V{dy+46} H{RIGHT}')+ar_l(RIGHT,dy+46))   # MCP -> SQL -> database
# legend
for k,t in enumerate(['Coding agent + CLI','Coding agent + MCP','PXI']):
    y=64+k*44; A(badge(1130,y-5,str(k+1))+f'<text class="hx-v" x="1150" y="{y}">{t}</text>')
A('<g class="ap-live"><text class="hx-band a" x="1120" y="224">IN PRODUCTION</text></g><g class="ap-dock"><text class="hx-band e" x="1120" y="224">IN HARBOR</text></g>')
body=''.join(o)
s=open(P).read()
m=re.search(r'(<svg class="diagram ap" viewBox=")[^"]*(" role="img" aria-label="[^"]*">)(.*?)(</svg>\s*</div>\s*</section>)',s,re.S); assert m
vbh=DB[0]+DB[1]+28+60
s=s[:m.start()]+m.group(1)+f'120 -60 1256 {vbh}'+m.group(2)+body+m.group(4)+s[m.end():]
open(P,'w').write(s); print('ok',vbh)
