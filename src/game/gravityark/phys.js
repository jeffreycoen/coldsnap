// gravityark/phys.js — the ark's physics, carved whole from the module:
// the symplectic integrator, the gravity law, the potential, the hit
// test, and the trajectory predictor. Pure math; no screen in it.
const cbrt2=Math.cbrt(2),W1=1/(2-cbrt2),W0=-cbrt2/(2-cbrt2);
const YC=[W1/2,(W0+W1)/2,(W0+W1)/2,W1/2],YD=[W1,W0,W1];
export const DT=1/60;
export const GATE_R=36,VEL_SC=.28,MAX_V=110,SF=14,MAX_BURN=65,PICKUP_R=18;
// Gravity power law: 1/r^2.3 (steeper than Newton — more local, less long-range perturbation)
export function ga(x,z,b){let ax=0,az=0;for(let i=0;i<b.length;i++){const dx=b[i].x-x,dz=b[i].z-z,r2=dx*dx+dz*dz+SF*SF,rn=Math.pow(r2,1.65);ax+=b[i].G*b[i].mass*dx/rn;az+=b[i].G*b[i].mass*dz/rn;}return[ax,az];}
export function ystep(x,z,vx,vz,b,dt){x+=YC[0]*vx*dt;z+=YC[0]*vz*dt;let[ax,az]=ga(x,z,b);vx+=YD[0]*ax*dt;vz+=YD[0]*az*dt;x+=YC[1]*vx*dt;z+=YC[1]*vz*dt;[ax,az]=ga(x,z,b);vx+=YD[1]*ax*dt;vz+=YD[1]*az*dt;x+=YC[2]*vx*dt;z+=YC[2]*vz*dt;[ax,az]=ga(x,z,b);vx+=YD[2]*ax*dt;vz+=YD[2]*az*dt;x+=YC[3]*vx*dt;z+=YC[3]*vz*dt;return[x,z,vx,vz];}
export function pot(x,z,b){let p=0;for(let i=0;i<b.length;i++){const r2=(b[i].x-x)**2+(b[i].z-z)**2+SF*SF;p-=b[i].G*b[i].mass/(1.3*Math.pow(r2,.65));}return p;}
const SHIP_R=3;// ship collision radius
export function hitAny(x,z,b){for(let i=0;i<b.length;i++){const cr=b[i].r+SHIP_R,d2=(x-b[i].x)**2+(z-b[i].z)**2;if(d2<cr*cr)return true;}return false;}
export function predict(x,z,vx,vz,b,planets,gate,n,half,stars){
  const pts=[];let minGate=Infinity,minGateIdx=0;
  const simP=planets.map(p=>({x:p.x,z:p.z,vx:p.vx||0,vz:p.vz||0,mass:p.mass,r:p.r,G:p.G}));
  // Stars as static kill zones (no orbital motion)
  const simStars=(stars||[]).map(st=>({x:st.x,z:st.z,r:st.killR||st.r,mass:st.mass,G:st.G}));
  const allSolid=[...simP,...simStars];// everything that kills you
  const ghosts=[];const ghostSet=new Set();
  for(const s2 of [100,250,450,Math.floor(n*.25),Math.floor(n*.5),Math.floor(n*.75)])ghostSet.add(s2);
  for(let i=0;i<n;i++){
    for(const p of simP){const weakOthers=simP.filter(q=>q!==p).map(q=>({...q,G:q.G*.01}));
      [p.x,p.z,p.vx,p.vz]=ystep(p.x,p.z,p.vx,p.vz,weakOthers,DT*2);}
    const curBodies=[...simP,...simStars,...b.slice(planets.length+(stars||[]).length)];
    [x,z,vx,vz]=ystep(x,z,vx,vz,curBodies,DT*2);
    // Danger from planets AND stars
    let danger=0;
    for(const p of simP){const d=Math.sqrt((x-p.x)**2+(z-p.z)**2);if(d<p.r*2.5)danger=Math.max(danger,1-(d-p.r)/(p.r*1.5));}
    for(const st of simStars){const d=Math.sqrt((x-st.x)**2+(z-st.z)**2);if(d<st.r*3)danger=Math.max(danger,1-(d-st.r)/(st.r*2));}
    const gd=Math.sqrt((x-gate.x)**2+(z-gate.z)**2);if(gd<minGate){minGate=gd;minGateIdx=pts.length;}const hg=gd<GATE_R;
    if(hitAny(x,z,allSolid)||Math.abs(x)>half*1.4||Math.abs(z)>half*1.4){pts.push({x,z,hit:true,danger,hitsGate:hg});break;}
    pts.push({x,z,danger,hitsGate:hg});if(hg)break;
    if(ghostSet.has(i)&&ghosts.length<3)ghosts.push(simP.map(p=>({x:p.x,z:p.z,r:p.r})));
  }
  return{pts,minGate,minGateIdx,ghosts};}
