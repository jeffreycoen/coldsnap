// gravityark/draw.js — the ark's whole drawn frame, carved verbatim from
// the component behind one factory seam: the module receives the refs and
// helpers it always closed over, and drawFrame paints exactly what the
// loop painted. The loop keeps physics and hands over an env each frame.
import { GATE_R, VEL_SC, MAX_V, MAX_BURN, pot, predict } from "./phys.js";
export function makeDraw({ C30, S30, MAP_NODES, sim, camRef, particles, progress, drg, lock, s2sim }) {
  const iso=(sx,sz,d,cx,cy,sc)=>({x:cx+(sx-sz)*C30*sc,y:cy+(sx+sz)*S30*sc+d});
    const drawShip=(ctx,sx,sy,ang,sc,thrust)=>{const fd={x:Math.cos(ang),z:Math.sin(ang)},fs={x:(fd.x-fd.z)*C30,y:(fd.x+fd.z)*S30},fl=Math.sqrt(fs.x**2+fs.y**2)||1;const nx=fs.x/fl,ny=fs.y/fl,px=-ny,py=nx,L=12*sc,W2=3.5*sc;
      if(thrust){const pL=(14+Math.random()*7)*sc,ex=sx-nx*L*.75,ey=sy-ny*L*.75;const pg=ctx.createRadialGradient(ex,ey,0,ex-nx*pL*.3,ey-ny*pL*.3,pL*.5);pg.addColorStop(0,"rgba(200,220,255,.8)");pg.addColorStop(.3,"rgba(120,170,255,.3)");pg.addColorStop(1,"rgba(60,100,220,0)");ctx.fillStyle=pg;ctx.beginPath();ctx.arc(ex-nx*pL*.2,ey-ny*pL*.2,pL*.45,0,Math.PI*2);ctx.fill();}
      ctx.beginPath();ctx.arc(sx-nx*L*.65,sy-ny*L*.65,3*sc,0,Math.PI*2);ctx.fillStyle=thrust?"rgba(40,80,200,.3)":"rgba(40,60,120,.08)";ctx.fill();
      ctx.save();ctx.shadowColor="rgba(0,0,0,.4)";ctx.shadowBlur=6*sc;ctx.beginPath();ctx.moveTo(sx+nx*L,sy+ny*L);ctx.lineTo(sx-nx*L*.2+px*W2,sy-ny*L*.2+py*W2);ctx.lineTo(sx-nx*L*.65+px*W2*.7,sy-ny*L*.65+py*W2*.7);ctx.lineTo(sx-nx*L*.7,sy-ny*L*.7);ctx.lineTo(sx-nx*L*.65-px*W2*.7,sy-ny*L*.65-py*W2*.7);ctx.lineTo(sx-nx*L*.2-px*W2,sy-ny*L*.2-py*W2);ctx.closePath();ctx.fillStyle="#2a3448";ctx.fill();
      ctx.beginPath();ctx.moveTo(sx+nx*L,sy+ny*L);ctx.lineTo(sx-nx*L*.2+px*W2*.95,sy-ny*L*.2+py*W2*.95);ctx.strokeStyle="rgba(40,50,80,.4)";ctx.lineWidth=.8;ctx.stroke();
      ctx.beginPath();ctx.arc(sx+nx*L*.7,sy+ny*L*.7,1.5*sc,0,Math.PI*2);ctx.fillStyle="rgba(40,80,160,.6)";ctx.fill();ctx.restore();};

    const drawGate=(ctx,gate,gateIndex,totalGates,cmx,cmy,sc,time,isNext)=>{
      const gd2=(sx2,sz2)=>Math.min(Math.sqrt(Math.abs(pot(sx2,sz2,sim.current.planets)))*.28*sc/camRef.current.zoom,120*sc/camRef.current.zoom);
      const gAng=gate.ang||0,pulse=.5+.5*Math.sin(time*2.5),gW=GATE_R*1.1,gH=45*sc;
      const perpX=Math.cos(gAng+Math.PI/2),perpZ=Math.sin(gAng+Math.PI/2);
      const p1x=gate.x+perpX*gW,p1z=gate.z+perpZ*gW,p2x=gate.x-perpX*gW,p2z=gate.z-perpZ*gW;
      const gdep=gd2(gate.x,gate.z);
      const pb1=iso(p1x,p1z,gdep,cmx,cmy,sc),pb2=iso(p2x,p2z,gdep,cmx,cmy,sc);
      const pt1={x:pb1.x,y:pb1.y-gH},pt2={x:pb2.x,y:pb2.y-gH};
      const alpha=isNext?1:(gate.reached?.12:.2);const col="60,200,100";
      ctx.save();ctx.globalAlpha=alpha;
      ctx.shadowColor=`rgba(${col},${.2+pulse*.1})`;ctx.shadowBlur=20*sc;
      ctx.beginPath();ctx.moveTo(pb1.x,pb1.y);ctx.lineTo(pb2.x,pb2.y);ctx.strokeStyle=`rgba(${col},${.25+pulse*.1})`;ctx.lineWidth=2*sc;ctx.stroke();
      ctx.beginPath();ctx.moveTo(pb1.x,pb1.y);ctx.lineTo(pt1.x,pt1.y);ctx.lineTo(pt2.x,pt2.y);ctx.lineTo(pb2.x,pb2.y);ctx.closePath();
      ctx.fillStyle=`rgba(${col},${.06+pulse*.04})`;ctx.fill();ctx.strokeStyle=`rgba(${col},${.2+pulse*.1})`;ctx.lineWidth=1*sc;ctx.stroke();
      ctx.lineWidth=3*sc;ctx.strokeStyle=`rgba(${col},${.45+pulse*.2})`;
      ctx.beginPath();ctx.moveTo(pb1.x,pb1.y);ctx.lineTo(pt1.x,pt1.y);ctx.stroke();
      ctx.beginPath();ctx.moveTo(pb2.x,pb2.y);ctx.lineTo(pt2.x,pt2.y);ctx.stroke();
      ctx.lineWidth=2.5*sc;ctx.strokeStyle=`rgba(${col},${.4+pulse*.2})`;ctx.beginPath();ctx.moveTo(pt1.x,pt1.y);ctx.lineTo(pt2.x,pt2.y);ctx.stroke();
      ctx.fillStyle=`rgba(${col},${.5+pulse*.2})`;ctx.beginPath();ctx.arc(pt1.x,pt1.y,2.5*sc,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(pt2.x,pt2.y,2.5*sc,0,Math.PI*2);ctx.fill();
      if(isNext){const entryDx=Math.cos(gAng),entryDz=Math.sin(gAng),eSx=(entryDx-entryDz)*C30*sc,eSy=(entryDx+entryDz)*S30*sc,el=Math.sqrt(eSx**2+eSy**2)||1,enx=eSx/el,eny=eSy/el;
        const gm={x:(pb1.x+pb2.x)/2,y:(pb1.y+pb2.y)/2-gH*.4};
        for(let ci=0;ci<3;ci++){const cd=22+ci*16;const ca=(.3+pulse*.15)*(1-ci*.25);const cx2=gm.x+enx*cd*sc,cy2=gm.y+eny*cd*sc,cS=6*sc;
          ctx.beginPath();ctx.moveTo(cx2+enx*cS-eny*cS*.6,cy2+eny*cS+enx*cS*.6);ctx.lineTo(cx2,cy2);ctx.lineTo(cx2+enx*cS+eny*cS*.6,cy2+eny*cS-enx*cS*.6);ctx.strokeStyle=`rgba(${col},${ca})`;ctx.lineWidth=2*sc;ctx.stroke();}}
      if(gate.reached){ctx.fillStyle=`rgba(${col},.25)`;ctx.font=`700 ${9*sc}px -apple-system,sans-serif`;ctx.textAlign="center";ctx.fillText("✓",(pb1.x+pb2.x)/2,(pb1.y+pb2.y)/2-gH*.5);ctx.textAlign="left";}
      // Gate number label
      if(totalGates>1){ctx.font=`700 ${Math.max(10,11*sc)}px -apple-system,sans-serif`;ctx.fillStyle=`rgba(${col},${isNext?.5:.2})`;ctx.textAlign="center";
        ctx.fillText(`${gateIndex+1}`,(pt1.x+pt2.x)/2,(pt1.y+pt2.y)/2+4*sc);ctx.textAlign="left";}
      ctx.restore();
      return{x:(pb1.x+pb2.x)/2,y:(pb1.y+pb2.y)/2-gH*.5};};
  const drawFrame=(env)=>{
    const {ctx,W,H,s,sh,cam,pf,parts,cmx,cmy,sc,baseSc,getD,gravBodies,ui,tFrameStart}=env;
      if(ui.showMap){ctx.fillStyle="#eceae4";ctx.fillRect(0,0,W,H);ctx.fillStyle="rgba(0,0,0,.06)";for(let i=0;i<100;i++)ctx.fillRect(((i*7919+37)%W),((i*4967+13)%H),1,1);ctx.save();ctx.globalAlpha=.035;for(let i=0;i<250;i++){const a=i*.14,r=18+i*2.3;ctx.fillStyle=`rgba(${80+i%40},${120+i%30},${200-i%20},.5)`;ctx.fillRect(W/2+Math.cos(a)*r+Math.random()*18-9,H/2+Math.sin(a)*r+Math.random()*18-9,2,2);}ctx.restore();const pr=progress.current;for(let i=0;i<MAP_NODES.length;i++){const nd=MAP_NODES[i],nx2=W/2+nd.x,ny2=H/2+nd.y,comp=i<pr.scores.length&&pr.scores[i]>0,cur=i===s.level;if(comp){ctx.save();ctx.shadowColor="rgba(240,190,50,.5)";ctx.shadowBlur=10;ctx.fillStyle="rgba(240,190,50,.75)";ctx.beginPath();ctx.arc(nx2,ny2,3.5,0,Math.PI*2);ctx.fill();ctx.restore();}else if(cur){const p=.5+.5*Math.sin(s.time*4);ctx.save();ctx.shadowColor=`rgba(100,200,255,${.4+p*.3})`;ctx.shadowBlur=14;ctx.fillStyle=`rgba(100,200,255,${.7+p*.3})`;ctx.beginPath();ctx.arc(nx2,ny2,5,0,Math.PI*2);ctx.fill();ctx.restore();}else{ctx.fillStyle="rgba(0,0,0,.06)";ctx.beginPath();ctx.arc(nx2,ny2,2,0,Math.PI*2);ctx.fill();}}ctx.font="200 20px -apple-system,'SF Pro Display',sans-serif";ctx.fillStyle="rgba(0,0,0,.3)";ctx.textAlign="center";ctx.fillText("SURVEY PROGRESS",W/2,45);ctx.font="500 11px -apple-system,sans-serif";ctx.fillStyle="rgba(0,0,0,.12)";ctx.fillText(`${pr.scores.filter(s2=>s2>0).length} systems · ${pr.totalScore} pts`,W/2,65);ctx.font="400 9px -apple-system,sans-serif";ctx.fillStyle="rgba(0,0,0,.1)";ctx.fillText("Tap a gold system to replay it",W/2,80);ctx.textAlign="left";return true;}
      const dim=s.phase==="plan"?.55:1;ctx.fillStyle=s.phase==="plan"?"#eceae4":"#f5f4f0";ctx.fillRect(0,0,W,H);
      if(ui.danger>.05&&s.phase==="fly"){const da=ui.danger*.35*(.7+.3*Math.sin(s.time*8));const dg=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.3,W/2,H/2,Math.max(W,H)*.7);dg.addColorStop(0,"rgba(200,40,25,0)");dg.addColorStop(1,`rgba(200,40,25,${da})`);ctx.fillStyle=dg;ctx.fillRect(0,0,W,H);}
      ctx.fillStyle="rgba(0,0,20,.008)";for(let i=0;i<60;i++)ctx.fillRect(Math.random()*W,Math.random()*H,1,1);
      // No nebula backdrop on white void theme
      // Starfield — white-blue dots at varying brightness
      for(let i=0;i<80;i++){const sx3=((i*7919+37)*3.7)%W,sy3=((i*4967+13)*2.3)%H;
        const bright=i%11===0?.15:i%5===0?.08:i%3===0?.04:.02;const sz3=i%11===0?1.5:1;
        ctx.fillStyle=`rgba(0,0,20,${bright})`;ctx.fillRect(sx3,sy3,sz3,sz3);}

      // Grid 110x110 with color gradient near wells
      const tGS=performance.now(),gN=75,gSp=19,halfG=gN*gSp/2,gcx=Math.round(sh.x/gSp)*gSp,gcz=Math.round(sh.z/gSp)*gSp; // the grid follows the camera, stepped to its own spacing so the lines stay put
      const gxa=new Float32Array((gN+1)**2),gya=new Float32Array((gN+1)**2);
      for(let ix=0;ix<=gN;ix++)for(let iz=0;iz<=gN;iz++){const sx2=ix*gSp-halfG+gcx,sz2=iz*gSp-halfG+gcz,d=getD(sx2,sz2),idx=ix*(gN+1)+iz;gxa[idx]=cmx+(sx2-sz2)*C30*sc;gya[idx]=cmy+(sx2+sz2)*S30*sc+d;}
      ctx.lineWidth=.7;
      for(let ix=0;ix<=gN;ix++){const sx2=ix*gSp-halfG+gcx,fade=Math.max(0,1-(Math.abs(sx2-gcx)/(halfG*.7))**3);let w=0,nearP=0;
        for(const p of s.planets){const pd=Math.abs(sx2-p.x);w=Math.max(w,Math.max(0,1-pd/110)*.3);nearP=Math.max(nearP,Math.max(0,1-pd/40));}
        const a=(fade*.2+w)*dim;if(a<.005)continue;ctx.beginPath();const b=ix*(gN+1);ctx.moveTo(gxa[b],gya[b]);for(let iz=1;iz<=gN;iz++)ctx.lineTo(gxa[b+iz],gya[b+iz]);
        const r=Math.floor(40+nearP*60),g=Math.floor(50+nearP*30),bl=Math.floor(70-nearP*30);
        ctx.strokeStyle=`rgba(${r},${g},${bl},${a})`;ctx.stroke();}
      for(let iz=0;iz<=gN;iz++){const sz2=iz*gSp-halfG+gcz,fade=Math.max(0,1-(Math.abs(sz2-gcz)/(halfG*.7))**3);let w=0,nearP=0;
        for(const p of s.planets){const pd=Math.abs(sz2-p.z);w=Math.max(w,Math.max(0,1-pd/110)*.3);nearP=Math.max(nearP,Math.max(0,1-pd/40));}
        const a=(fade*.2+w)*dim;if(a<.005)continue;ctx.beginPath();ctx.moveTo(gxa[iz],gya[iz]);for(let ix=1;ix<=gN;ix++)ctx.lineTo(gxa[ix*(gN+1)+iz],gya[ix*(gN+1)+iz]);
        const r=Math.floor(40+nearP*60),g=Math.floor(50+nearP*30),bl=Math.floor(70-nearP*30);
        ctx.strokeStyle=`rgba(${r},${g},${bl},${a})`;ctx.stroke();}
      const tGE=performance.now();pf.gridMs=tGE-tGS;pf.gridVerts=(gN+1)**2;

      for(const imp of s.impacts){const ip=iso(imp.x,imp.z,getD(imp.x,imp.z)*.5,cmx,cmy,sc);const age=s.time-imp.t,alpha=Math.max(0,1-age/1.5)*.4,ringR=age*60*sc;ctx.beginPath();ctx.arc(ip.x,ip.y,ringR,0,Math.PI*2);ctx.strokeStyle=`rgba(200,150,80,${alpha})`;ctx.lineWidth=2*sc;ctx.stroke();}
      // Nebulae — translucent drag clouds
      for(const nb of (s.nebulae||[])){const np=iso(nb.x,nb.z,0,cmx,cmy,sc),nR=nb.r*sc;
        const[nr,ng,nbl]=nb.color;
        // Outer glow
        const ng3=ctx.createRadialGradient(np.x,np.y,0,np.x,np.y,nR*1.3);
        ng3.addColorStop(0,`rgba(${nr},${ng},${nbl},.03)`);ng3.addColorStop(1,`rgba(${nr},${ng},${nbl},0)`);
        ctx.fillStyle=ng3;ctx.beginPath();ctx.arc(np.x,np.y,nR*1.3,0,Math.PI*2);ctx.fill();
        // Main cloud — VISIBLE
        const ng2=ctx.createRadialGradient(np.x,np.y,0,np.x,np.y,nR);
        ng2.addColorStop(0,`rgba(${nr},${ng},${nbl},.3)`);ng2.addColorStop(.4,`rgba(${nr},${ng},${nbl},.18)`);
        ng2.addColorStop(.8,`rgba(${nr},${ng},${nbl},.06)`);ng2.addColorStop(1,`rgba(${nr},${ng},${nbl},0)`);
        ctx.fillStyle=ng2;ctx.beginPath();ctx.arc(np.x,np.y,nR,0,Math.PI*2);ctx.fill();
        // Inner wisps
        for(let wi=0;wi<8;wi++){const wa=wi*.785+s.time*.08,wr=nR*(.15+wi*.1);
          const wx=np.x+Math.cos(wa)*wr*.4,wy=np.y+Math.sin(wa)*wr*.3;
          ctx.beginPath();ctx.arc(wx,wy,wr*.35,0,Math.PI*2);
          ctx.fillStyle=`rgba(${nr},${ng},${nbl},.08)`;ctx.fill();}
        // Border ring
        ctx.beginPath();ctx.arc(np.x,np.y,nR,0,Math.PI*2);
        ctx.strokeStyle=`rgba(${nr},${ng},${nbl},.12)`;ctx.lineWidth=1;ctx.setLineDash([6,4]);ctx.stroke();ctx.setLineDash([]);
      }

      // Stars — massive glowing bodies
      for(const st of (s.stars||[])){const sp=iso(st.x,st.z,0,cmx,cmy,sc),sR=st.r*sc;
        ctx.save();
        // Outer corona
        const cg=ctx.createRadialGradient(sp.x,sp.y,sR*.5,sp.x,sp.y,sR*3);
        cg.addColorStop(0,"rgba(255,220,100,.25)");cg.addColorStop(.3,"rgba(255,180,60,.08)");cg.addColorStop(1,"rgba(255,140,30,0)");
        ctx.fillStyle=cg;ctx.beginPath();ctx.arc(sp.x,sp.y,sR*3,0,Math.PI*2);ctx.fill();
        // Photosphere
        ctx.shadowColor="rgba(255,200,80,.8)";ctx.shadowBlur=30*sc;
        const sg=ctx.createRadialGradient(sp.x-sR*.2,sp.y-sR*.2,sR*.1,sp.x,sp.y,sR);
        sg.addColorStop(0,"rgba(255,255,230,1)");sg.addColorStop(.4,"rgba(255,220,120,1)");sg.addColorStop(1,"rgba(255,160,40,1)");
        ctx.fillStyle=sg;ctx.beginPath();ctx.arc(sp.x,sp.y,sR,0,Math.PI*2);ctx.fill();
        // Kill zone ring
        const kR=(st.killR||st.r)*sc;
        ctx.beginPath();ctx.arc(sp.x,sp.y,kR,0,Math.PI*2);
        ctx.strokeStyle="rgba(255,100,30,.15)";ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.stroke();ctx.setLineDash([]);
        ctx.restore();}

      for(const pl of s.planets){const pp=iso(pl.x,pl.z,0,cmx,cmy,sc),pR=pl.r*sc;const[cr,cg,cb]=pl.c,[hr,hg,hb]=pl.h;ctx.save();
        // Atmosphere glow
        ctx.beginPath();ctx.arc(pp.x,pp.y,pR+22*sc,0,Math.PI*2);const at=ctx.createRadialGradient(pp.x,pp.y,pR*.7,pp.x,pp.y,pR+22*sc);at.addColorStop(0,`rgba(${cr},${cg},${cb},.2)`);at.addColorStop(1,`rgba(${cr},${cg},${cb},0)`);ctx.fillStyle=at;ctx.fill();
        // Main body
        ctx.beginPath();ctx.arc(pp.x,pp.y,pR,0,Math.PI*2);const pg=ctx.createRadialGradient(pp.x-pR*.3,pp.y-pR*.3,pR*.05,pp.x+pR*.1,pp.y+pR*.1,pR);pg.addColorStop(0,`rgba(${cr+30},${cg+30},${cb+30},1)`);pg.addColorStop(.5,`rgba(${cr},${cg},${cb},1)`);pg.addColorStop(1,`rgba(${Math.max(0,cr-25)},${Math.max(0,cg-25)},${Math.max(0,cb-25)},1)`);ctx.fillStyle=pg;ctx.fill();
        // Concentric pressure rings (surface detail)
        for(let ri=0;ri<3;ri++){const rr=pR*(.35+ri*.22);ctx.beginPath();ctx.arc(pp.x,pp.y,rr,0,Math.PI*2);ctx.strokeStyle=`rgba(${hr},${hg},${hb},${.08-.02*ri})`;ctx.lineWidth=.7;ctx.stroke();}
        // Highlight crescent
        ctx.beginPath();ctx.arc(pp.x,pp.y,pR+.5,-.6,.6);ctx.strokeStyle=`rgba(${hr},${hg},${hb},.6)`;ctx.lineWidth=2.2*sc;ctx.stroke();
        // Terminator line (day/night divide)
        ctx.beginPath();ctx.arc(pp.x+pR*.15,pp.y+pR*.15,pR*.85,1.2,3.8);ctx.strokeStyle=`rgba(0,0,0,.06)`;ctx.lineWidth=1.5;ctx.stroke();
        ctx.restore();}
      for(const a of s.asteroids){if(!a.alive)continue;const ap=iso(a.x,a.z,getD(a.x,a.z)*.4,cmx,cmy,sc),aR=a.r*sc;ctx.fillStyle="rgba(100,110,130,.7)";ctx.beginPath();ctx.arc(ap.x,ap.y,aR,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(120,130,150,.35)";ctx.lineWidth=1.2*sc;ctx.beginPath();ctx.arc(ap.x,ap.y,aR+.5,-.4,.4);ctx.stroke();}

      // Comets — bright head with dramatic tail
      for(const cm of (s.comets||[])){if(!cm.alive)continue;
        if(cm.trail.length>3){
          // Wide outer glow tail
          ctx.beginPath();const t0=iso(cm.trail[0].x,cm.trail[0].z,0,cmx,cmy,sc);ctx.moveTo(t0.x,t0.y);
          for(let ti=1;ti<cm.trail.length;ti++){const tp=iso(cm.trail[ti].x,cm.trail[ti].z,0,cmx,cmy,sc);ctx.lineTo(tp.x,tp.y);}
          ctx.strokeStyle="rgba(100,160,255,.08)";ctx.lineWidth=8*sc;ctx.stroke();
          // Medium tail
          ctx.strokeStyle="rgba(140,180,255,.15)";ctx.lineWidth=4*sc;ctx.stroke();
          // Bright core tail
          ctx.strokeStyle="rgba(200,220,255,.3)";ctx.lineWidth=1.5*sc;ctx.stroke();}
        // Head — large bright glow
        const cp=iso(cm.x,cm.z,getD(cm.x,cm.z)*.3,cmx,cmy,sc),cR=Math.max(cm.r*sc*2,4);
        ctx.save();ctx.shadowColor="rgba(120,170,255,.8)";ctx.shadowBlur=18*sc;
        ctx.fillStyle="rgba(180,210,255,.9)";ctx.beginPath();ctx.arc(cp.x,cp.y,cR,0,Math.PI*2);ctx.fill();
        ctx.fillStyle="rgba(255,255,255,.8)";ctx.beginPath();ctx.arc(cp.x,cp.y,cR*.4,0,Math.PI*2);ctx.fill();
        ctx.restore();}

      // Fuel pickups
      for(const pk of s.pickups){if(!pk.alive)continue;const pp=iso(pk.x,pk.z,getD(pk.x,pk.z)*.3,cmx,cmy,sc);const bob=Math.sin(s.time*3+pk.x)*.5;const pr2=8*sc;
        ctx.save();ctx.shadowColor="rgba(50,220,220,.4)";ctx.shadowBlur=12*sc;
        // Diamond shape
        ctx.beginPath();ctx.moveTo(pp.x,pp.y-pr2+bob);ctx.lineTo(pp.x+pr2*.6,pp.y+bob);ctx.lineTo(pp.x,pp.y+pr2+bob);ctx.lineTo(pp.x-pr2*.6,pp.y+bob);ctx.closePath();
        ctx.fillStyle=`rgba(50,220,220,${.25+.1*Math.sin(s.time*4)})`;ctx.fill();
        ctx.strokeStyle=`rgba(50,220,220,${.5+.15*Math.sin(s.time*4)})`;ctx.lineWidth=1.5*sc;ctx.stroke();
        ctx.font=`600 ${7*sc}px -apple-system,sans-serif`;ctx.fillStyle="rgba(50,220,220,.4)";ctx.textAlign="center";ctx.fillText(`+${pk.fuel}`,pp.x,pp.y+pr2+10*sc);ctx.textAlign="left";
        ctx.restore();}

      // Gates — draw all, highlight current, add number labels
      let gateScreenPos={x:W/2,y:H/2};
      for(let gi=0;gi<s.gates.length;gi++){
        const isNext=gi===s.gateIdx&&s.phase!=="win";
        const gsp=drawGate(ctx,s.gates[gi],gi,s.gates.length,cmx,cmy,sc,s.time,isNext);
        if(isNext)gateScreenPos=gsp;
        // Gate number label
        if(s.gates.length>1){
          ctx.font=`700 ${Math.max(10,11*sc)}px -apple-system,sans-serif`;
          ctx.textAlign="center";
          ctx.fillStyle=s.gates[gi].reached?`rgba(60,200,100,.25)`:isNext?`rgba(60,200,100,.5)`:`rgba(60,200,100,.15)`;
          ctx.fillText(`${gi+1}`,gsp.x,gsp.y+22*sc);
          ctx.textAlign="left";}}

      // Particles
      for(const p of parts){const pd=getD(p.x,p.z),pp=iso(p.x,p.z,pd*.4,cmx,cmy,sc);ctx.fillStyle=`rgba(${p.color},${(p.life/p.maxLife)*.6})`;ctx.beginPath();ctx.arc(pp.x,pp.y,p.r*sc,0,Math.PI*2);ctx.fill();}
      if(s.trail.length>4){
        const tLen=s.trail.length,step=Math.max(1,Math.floor(tLen/200));
        for(let i=step+1;i<tLen;i+=step){
          const t0=s.trail[i-step],t1=s.trail[i];
          const d0=getD(t0.x,t0.z),d1=getD(t1.x,t1.z);
          const p0=iso(t0.x,t0.z,d0,cmx,cmy,sc),p1=iso(t1.x,t1.z,d1,cmx,cmy,sc);
          const fade=i/tLen;
          ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);
          ctx.strokeStyle=`rgba(30,80,180,${fade*.25})`;ctx.lineWidth=.8+fade*2.2;ctx.stroke();}}

      // Trajectory
      const tTS=performance.now(),dr=drg.current,lk=lock.current;let showVx=0,showVz=0,hasTraj=false;
      if((s.phase==="aim"||s.phase==="plan")&&dr.active){const ddx=dr.cx-dr.sx,ddy=dr.cy-dr.sy,dist=Math.sqrt(ddx*ddx+ddy*ddy);if(dist>12){const[sdx,sdz]=s2sim(ddx,ddy,baseSc);const mag=Math.sqrt(sdx*sdx+sdz*sdz);const maxV=s.phase==="plan"?Math.min(MAX_BURN,s.fuel,MAX_V):Math.min(MAX_V,s.fuel);const vel=Math.min(mag*VEL_SC,maxV);showVx=sdx/mag*vel;showVz=sdz/mag*vel;hasTraj=true;}}
      else if((s.phase==="aim"||s.phase==="plan")&&lk.on){showVx=lk.vx;showVz=lk.vz;hasTraj=true;}

      const drawCT=(result)=>{const{pts,minGate,minGateIdx}=result;if(pts.length<3)return;const lp=pts[pts.length-1],hGA=pts.some(p=>p.hitsGate),hW=lp.hit&&!lp.hitsGate;ctx.save();
        for(let i=1;i<pts.length;i++){const p=pts[i],pv=pts[i-1],d1=getD(pv.x,pv.z),d2=getD(p.x,p.z),s1=iso(pv.x,pv.z,d1,cmx,cmy,sc),s2=iso(p.x,p.z,d2,cmx,cmy,sc),fade=Math.max(.12,1-i/pts.length);let col;
          if(p.hitsGate)col=`rgba(60,200,100,${fade*.7})`;else if(p.danger>.6)col=`rgba(220,55,35,${fade*.55})`;else if(p.danger>.2)col=`rgba(220,170,40,${fade*.5})`;else col=hGA?`rgba(60,200,100,${fade*.5})`:(hW?`rgba(220,55,35,${fade*.45})`:`rgba(80,190,110,${fade*.45})`);
          ctx.beginPath();ctx.moveTo(s1.x,s1.y);ctx.lineTo(s2.x,s2.y);ctx.strokeStyle=col;ctx.lineWidth=3;ctx.stroke();}
        const off=(s.time*40)%18;for(let i=Math.floor(off);i<pts.length;i+=18){const p=pts[i],d=getD(p.x,p.z),sp=iso(p.x,p.z,d,cmx,cmy,sc),fade=(1-i/pts.length)*.5;ctx.fillStyle=p.hitsGate?`rgba(60,200,100,${fade})`:p.danger>.5?`rgba(220,55,35,${fade})`:`rgba(80,190,110,${fade})`;ctx.beginPath();ctx.arc(sp.x,sp.y,2.5*sc,0,Math.PI*2);ctx.fill();}
        if(hW){const d2=getD(lp.x,lp.z),sp=iso(lp.x,lp.z,d2,cmx,cmy,sc);ctx.strokeStyle="rgba(220,50,30,.65)";ctx.lineWidth=2.5*sc;ctx.beginPath();ctx.moveTo(sp.x-7*sc,sp.y-7*sc);ctx.lineTo(sp.x+7*sc,sp.y+7*sc);ctx.stroke();ctx.beginPath();ctx.moveTo(sp.x+7*sc,sp.y-7*sc);ctx.lineTo(sp.x-7*sc,sp.y+7*sc);ctx.stroke();}
        if(hGA){const ghp=pts.find(p=>p.hitsGate);if(ghp){const d2=getD(ghp.x,ghp.z),sp=iso(ghp.x,ghp.z,d2,cmx,cmy,sc);ctx.save();ctx.shadowColor="rgba(60,200,100,.6)";ctx.shadowBlur=12*sc;ctx.fillStyle=`rgba(60,200,100,${.4+.2*Math.sin(s.time*5)})`;ctx.beginPath();ctx.arc(sp.x,sp.y,6*sc,0,Math.PI*2);ctx.fill();ctx.restore();}}
        if(!hGA&&minGate<120&&minGateIdx>0){const mp=pts[minGateIdx],d2=getD(mp.x,mp.z),sp=iso(mp.x,mp.z,d2,cmx,cmy,sc);ctx.font=`600 11px -apple-system,sans-serif`;ctx.fillStyle="rgba(220,170,40,.65)";ctx.fillText(`Miss: ${Math.floor(minGate-GATE_R)}`,sp.x+8,sp.y-8);ctx.beginPath();ctx.moveTo(sp.x,sp.y);ctx.lineTo(gateScreenPos.x,gateScreenPos.y);ctx.strokeStyle="rgba(220,170,40,.2)";ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.stroke();ctx.setLineDash([]);}
        ctx.restore();};
      // Draw ghost planets (future positions from trajectory prediction)
      const drawGhosts=(ghosts)=>{if(!ghosts||!ghosts.length)return;
        const tLabels=["T+10s","T+20s","T+30s"];
        for(let gi=0;gi<ghosts.length;gi++){const snap=ghosts[gi];const alpha=.2+gi*.08;
          for(let pi=0;pi<snap.length;pi++){const gp2=snap[pi];const gpp=iso(gp2.x,gp2.z,0,cmx,cmy,sc);const gR=Math.max(gp2.r*sc*1.2,6);
            // Connecting line from real planet to ghost
            const realP=s.planets[pi];if(realP){const rpp=iso(realP.x,realP.z,0,cmx,cmy,sc);
              ctx.beginPath();ctx.moveTo(rpp.x,rpp.y);ctx.lineTo(gpp.x,gpp.y);
              ctx.strokeStyle=`rgba(100,130,200,${alpha*.3})`;ctx.lineWidth=1;ctx.setLineDash([2,4]);ctx.stroke();ctx.setLineDash([]);}
            // Ghost fill — translucent but visible
            ctx.beginPath();ctx.arc(gpp.x,gpp.y,gR,0,Math.PI*2);
            ctx.fillStyle=`rgba(100,130,200,${alpha*.5})`;ctx.fill();
            ctx.strokeStyle=`rgba(80,110,180,${alpha*.8})`;ctx.lineWidth=1.5*sc;ctx.stroke();}
          // Time label
          if(snap[0]){const lp=iso(snap[0].x,snap[0].z,0,cmx,cmy,sc);
            ctx.font=`700 ${Math.max(9,10*sc)}px -apple-system,sans-serif`;ctx.fillStyle=`rgba(80,110,180,${alpha})`;
            ctx.fillText(tLabels[gi]||"",lp.x+snap[0].r*sc+6,lp.y-6);}}};

      if(hasTraj){const bvx=s.phase==="plan"?sh.vx+showVx:showVx,bvz=s.phase==="plan"?sh.vz+showVz:showVz;
        const trajResult=predict(sh.x,sh.z,bvx,bvz,gravBodies,s.planets,s.gate,1200,halfG,s.stars);
        drawCT(trajResult);drawGhosts(trajResult.ghosts);
        const shipP=iso(sh.x,sh.z,getD(sh.x,sh.z),cmx,cmy,sc),vm=Math.sqrt(showVx**2+showVz**2);
        const sd2={x:(showVx-showVz)*C30,y:(showVx+showVz)*S30},sl=Math.sqrt(sd2.x**2+sd2.y**2)||1,aL=Math.min(vm*1.2*sc,160),adx=sd2.x/sl*aL,ady=sd2.y/sl*aL;
        const atMax=vm>=s.fuel-.5;const col=s.phase==="plan"?"70,150,255":"240,165,30";ctx.save();ctx.shadowColor=`rgba(${col},.4)`;ctx.shadowBlur=8;
        ctx.beginPath();ctx.moveTo(shipP.x,shipP.y);ctx.lineTo(shipP.x+adx,shipP.y+ady);ctx.strokeStyle=`rgba(${col},.7)`;ctx.lineWidth=3;ctx.stroke();
        ctx.fillStyle=`rgba(${col},.7)`;ctx.beginPath();ctx.arc(shipP.x+adx,shipP.y+ady,4.5,0,Math.PI*2);ctx.fill();
        if(atMax){ctx.beginPath();ctx.arc(shipP.x+adx,shipP.y+ady,7,0,Math.PI*2);ctx.strokeStyle="rgba(220,60,30,.5)";ctx.lineWidth=1.5;ctx.stroke();}
        ctx.font=`700 12px -apple-system,sans-serif`;ctx.fillStyle=atMax?`rgba(220,60,30,.7)`:`rgba(${col},.65)`;ctx.fillText(`Δv ${vm.toFixed(0)}${atMax?" MAX":""}`,shipP.x+adx+12,shipP.y+ady-8);ctx.restore();}
      if(s.phase==="fly"&&!hasTraj){const flyResult=predict(sh.x,sh.z,sh.vx,sh.vz,gravBodies,s.planets,s.gate,1200,halfG,s.stars);drawCT(flyResult);drawGhosts(flyResult.ghosts);}
      pf.trajMs=performance.now()-tTS;

      // Ship
      const sd=getD(sh.x,sh.z),sp2=iso(sh.x,sh.z,sd,cmx,cmy,sc);
      if(s.flash>0&&s.time-s.flash<.5&&s.phase==="fly"){ctx.save();ctx.globalCompositeOperation="lighter";const gs=(25+Math.random()*12)*sc;ctx.shadowColor="rgba(80,170,255,.8)";ctx.shadowBlur=30*sc;const tg=ctx.createRadialGradient(sp2.x,sp2.y,0,sp2.x,sp2.y,gs);tg.addColorStop(0,"rgba(100,180,255,.7)");tg.addColorStop(.4,"rgba(60,140,240,.25)");tg.addColorStop(1,"rgba(30,90,210,0)");ctx.fillStyle=tg;ctx.beginPath();ctx.arc(sp2.x,sp2.y,gs,0,Math.PI*2);ctx.fill();ctx.restore();}
      if(s.phase!=="crash"||s.time-s.flash<.1)drawShip(ctx,sp2.x,sp2.y,sh.ang,sc,s.phase==="fly"&&s.flash>0&&s.time-s.flash<.4);
      if(s.phase==="fly"){const vm=Math.sqrt(sh.vx**2+sh.vz**2);if(vm>.5){const v={x:(sh.vx-sh.vz)*C30,y:(sh.vx+sh.vz)*S30},vl=Math.sqrt(v.x**2+v.y**2)||1,al=Math.min(vm*.3*sc,45*sc);ctx.beginPath();ctx.moveTo(sp2.x,sp2.y);ctx.lineTo(sp2.x+v.x/vl*al,sp2.y+v.y/vl*al);ctx.strokeStyle="rgba(40,80,180,.4)";ctx.lineWidth=1.2;ctx.stroke();}}
      if(s.phase==="crash"&&s.time-s.flash<.4){ctx.fillStyle=`rgba(180,40,25,${(1-(s.time-s.flash)/.4)*.08})`;ctx.fillRect(0,0,W,H);}
      if(s.phase==="win"&&s.time-s.flash<.5){ctx.fillStyle=`rgba(60,200,100,${(1-(s.time-s.flash)/.5)*.05})`;ctx.fillRect(0,0,W,H);}
      // Gravity assist notification
      if(s._assistTime&&s.time-s._assistTime<1.5&&s.phase==="fly"){
        const aa=Math.max(0,1-(s.time-s._assistTime)/1.5);
        ctx.save();ctx.font=`300 14px -apple-system,'SF Pro Display',sans-serif`;ctx.fillStyle=`rgba(60,100,180,${aa*.4})`;
        ctx.textAlign="center";ctx.fillText("GRAVITY ASSIST",W/2,H*.18);ctx.textAlign="left";ctx.restore();}
      // Flight HUD — distance and velocity
      if(s.phase==="fly"&&!s.paused){
        const gDist2=Math.floor(Math.sqrt((sh.x-s.gate.x)**2+(sh.z-s.gate.z)**2));
        const vel2=Math.floor(Math.sqrt(sh.vx**2+sh.vz**2));
        ctx.font="300 10px -apple-system,'SF Pro Display',sans-serif";ctx.textAlign="center";
        ctx.fillStyle="rgba(0,0,0,.35)";ctx.fillText(`${gDist2}u to gate · ${vel2} m/s`,W/2,H-195);
        ctx.textAlign="left";}
      // Nebula tint when ship is inside
      if(s._inNebula&&s.phase==="fly"){ctx.fillStyle="rgba(140,100,200,.04)";ctx.fillRect(0,0,W,H);}
      const vr=Math.max(W,H)*.7,vig=ctx.createRadialGradient(W/2,H/2,vr*.4,W/2,H/2,vr);vig.addColorStop(0,"rgba(0,0,0,0)");vig.addColorStop(1,"rgba(0,0,0,0.04)");ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);
      // Phase border glow
      const phaseCol=s.phase==="aim"?"rgba(220,180,50,":"rgba(60,130,220,";
      if(s.phase==="aim"||s.phase==="plan"){const bc=phaseCol+".08)";ctx.fillStyle=bc;ctx.fillRect(0,0,2,H);ctx.fillRect(W-2,0,2,H);ctx.fillRect(0,0,W,2);ctx.fillRect(0,H-2,W,2);}
      // Pause hint — first flight only
      if(s.phase==="fly"&&!s.paused&&s.time>2&&s.time<4&&s.level<2&&!s._pauseHintShown){
        const ho=Math.max(0,1-(s.time-2)/2)*.2;
        ctx.font=`300 ${11}px -apple-system,sans-serif`;ctx.fillStyle=`rgba(0,0,0,${ho})`;ctx.textAlign="center";ctx.fillText("tap to pause",W/2,H/2+50);ctx.textAlign="left";
        if(s.time>3.5)s._pauseHintShown=true;}
      if(s.phase==="plan"){ctx.font=`600 11px -apple-system,sans-serif`;ctx.fillStyle="rgba(60,130,220,.5)";ctx.textAlign="center";ctx.fillText("TIME FROZEN — DRAG TO AIM BURN",W/2,24);ctx.textAlign="left";}
      if(s.paused&&s.phase==="fly"){ctx.fillStyle="rgba(10,20,34,.65)";ctx.fillRect(0,0,W,H);ctx.font="200 22px -apple-system,'SF Pro Display',sans-serif";ctx.fillStyle="rgba(0,0,0,.25)";ctx.textAlign="center";ctx.fillText("PAUSED",W/2,H/2);ctx.font="400 10px -apple-system,sans-serif";ctx.fillStyle="rgba(0,0,0,.12)";ctx.fillText("Tap to resume",W/2,H/2+22);ctx.textAlign="left";}
      // Perf
      const tFE=performance.now();pf.totalMs=tFE-tFrameStart;pf.frameTimes.push(pf.totalMs);if(pf.frameTimes.length>300)pf.frameTimes.shift();pf.fps=Math.round(1000/Math.max(pf.totalMs,.1));pf.minFps=Math.round(1000/Math.max(Math.max(...pf.frameTimes.slice(-300)),.1));
      ctx.font="600 9px 'Courier New',monospace";ctx.textAlign="right";ctx.fillStyle="rgba(0,0,0,.35)";
      const bodyCount=gravBodies.length;
      ctx.fillText(`${pf.fps}fps PHY${pf.physMs.toFixed(1)} GRD${pf.gridMs.toFixed(1)} TRJ${pf.trajMs.toFixed(1)} =${pf.totalMs.toFixed(1)}ms`,W-10,H-160);
      ctx.fillText(`${pf.gridVerts}v ${pf.particles}p ${bodyCount}bod ${s.asteroids.filter(a=>a.alive).length}ast`,W-10,H-148);
      if(pf.energy0!==null){ctx.fillStyle=pf.energyDrift<.1?"rgba(40,140,70,.2)":"rgba(200,50,30,.2)";ctx.fillText(`drift ${pf.energyDrift.toFixed(4)}%`,W-10,H-136);}
      ctx.textAlign="left";
    // Compass — when the gate is off frame, an edge arrow points to it with the distance
    if(s.phase==="aim"||s.phase==="plan"||s.phase==="fly"){
      const gp=iso(s.gate.x,s.gate.z,0,cmx,cmy,sc);
      if(gp.x<-10||gp.x>W+10||gp.y<-10||gp.y>H+10){
        const dx=gp.x-W/2,dy=gp.y-H/2,dl=Math.sqrt(dx*dx+dy*dy)||1,nx=dx/dl,ny=dy/dl;
        const m=46,t=Math.min((W/2-m)/Math.max(Math.abs(nx),1e-6),(H/2-m)/Math.max(Math.abs(ny),1e-6));
        const ax=W/2+nx*t,ay=H/2+ny*t,ca2=Math.atan2(ny,nx);
        const gd3=Math.floor(Math.sqrt((s.gate.x-sh.x)**2+(s.gate.z-sh.z)**2));
        ctx.save();ctx.translate(ax,ay);ctx.rotate(ca2);
        ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-7,-8);ctx.lineTo(-3,0);ctx.lineTo(-7,8);ctx.closePath();
        ctx.fillStyle="rgba(60,200,100,.7)";ctx.fill();ctx.rotate(-ca2);
        ctx.font="600 10px -apple-system,sans-serif";ctx.textAlign="center";
        ctx.fillStyle="rgba(60,200,100,.65)";ctx.fillText(gd3+"u",0,ny<-.3?26:-18);
        ctx.textAlign="left";ctx.restore();}}
    return false;
  };
  return { iso, drawShip, drawGate, drawFrame };
}
