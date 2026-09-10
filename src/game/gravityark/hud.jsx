import { useState } from "react";
// gravityark/hud.jsx — the ark's whole interface, carved verbatim from the
// component: tutorial, top panel, buttons, win and crash screens, map footer.
// The component keeps the loop and hands everything down as props.
export default function ArkHud({ ui, s, locked, noFuel, showTutorial, setShowTutorial, progress, lock, ffRef, setUi, doLaunch, doPlan, doExec, doCancel, doRetry, doNext, toggleMap, copyLogs, exportFavorites, rateLevel, adjustAngle, adjustPower, onExit }){
  const[bp,setBp]=useState({});
  const Btn=({label,icon,color,onClick,wide,disabled})=>{const k=label||icon;return(<div onMouseDown={()=>!disabled&&setBp(p=>({...p,[k]:true}))} onMouseUp={()=>{setBp(p=>({...p,[k]:false}));!disabled&&onClick();}} onMouseLeave={()=>setBp(p=>({...p,[k]:false}))} onTouchStart={e=>{e.preventDefault();!disabled&&setBp(p=>({...p,[k]:true}));}} onTouchEnd={e=>{e.preventDefault();setBp(p=>({...p,[k]:false}));!disabled&&onClick();}} onTouchCancel={e=>{e.preventDefault();setBp(p=>({...p,[k]:false}));}}
    style={{height:56,minWidth:wide?140:68,paddingLeft:15,paddingRight:15,borderRadius:15,display:"flex",alignItems:"center",justifyContent:"center",gap:7,background:bp[k]?`rgba(${color},.2)`:`rgba(${color},.07)`,border:`1.5px solid rgba(${color},${bp[k]?.4:.15})`,opacity:disabled?.35:1,backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",transform:bp[k]&&!disabled?"scale(.94)":"scale(1)",transition:"all .08s ease",cursor:disabled?"default":"pointer",userSelect:"none",WebkitUserSelect:"none",touchAction:"none"}}>
    {icon&&<span style={{fontSize:16,fontWeight:600,color:`rgba(${color},${bp[k]?.9:.55})`,lineHeight:1}}>{icon}</span>}
    {label&&<span style={{fontSize:11,fontWeight:700,letterSpacing:1.1,color:`rgba(${color},${bp[k]?.9:.55})`,textTransform:"uppercase"}}>{label}</span>}</div>);};
  return(<>
      {showTutorial&&<div onClick={()=>setShowTutorial(false)} style={{position:"absolute",inset:0,background:"rgba(245,244,240,.97)",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",padding:40,zIndex:100,cursor:"pointer",touchAction:"none"}}>
        <div style={{fontSize:28,fontWeight:200,color:"rgba(200,215,240,.75)",letterSpacing:2,marginBottom:24}}>GRAVITY WELL</div>
        <div style={{fontSize:12,fontWeight:400,color:"rgba(200,215,240,.6)",lineHeight:2.2,textAlign:"center",maxWidth:280}}>
          Navigate through gravitational fields to reach the gate.
        </div>
        <div style={{marginTop:30,display:"flex",flexDirection:"column",gap:14,maxWidth:260}}>
          {[
            ["Drag","to aim your trajectory"],
            ["Tap Launch","to fire"],
            ["Tap screen","to pause during flight"],
            ["Plan Burn","for mid-course corrections"],
            ["Fly close","to planets for bonus points"],
            ["Rate every level","to help curate the best ones"]
          ].map(([a,b],i)=><div key={i} style={{display:"flex",gap:10,alignItems:"baseline"}}>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(0,0,0,.55)",minWidth:90,textAlign:"right"}}>{a}</div>
            <div style={{fontSize:12,fontWeight:400,color:"rgba(200,215,240,.55)"}}>{b}</div>
          </div>)}
        </div>
        <div style={{marginTop:40,fontSize:11,fontWeight:600,color:"rgba(0,0,0,.3)",letterSpacing:1.5}}>TAP ANYWHERE TO BEGIN</div>
      </div>}
      {!ui.showMap&&<>
        <div style={{position:"absolute",top:14,left:14,background:"rgba(245,244,240,.82)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderRadius:14,padding:"10px 16px",border:"1px solid rgba(0,0,0,.06)",maxWidth:210}}>
          <div style={{fontSize:9,fontWeight:700,letterSpacing:1.8,color:"rgba(0,0,0,.4)",marginBottom:2}}>{ui.sysName}</div>
          <div style={{fontSize:8,fontWeight:500,color:"rgba(0,0,0,.3)",marginBottom:6,lineHeight:1.3}}>{ui.brief}</div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {[["VEL",ui.vel],["BURNS",ui.burns],["FUEL",Math.floor(ui.fuel)]].map(([l,v])=>(
              <div key={l}><div style={{fontSize:7,fontWeight:700,letterSpacing:1.5,color:l==="FUEL"&&Number(ui.fuel)<50?"rgba(220,60,30,.7)":"rgba(0,0,0,.35)"}}>{l}</div>
              <div style={{fontSize:16,fontWeight:300,color:"rgba(0,0,0,.65)",fontVariantNumeric:"tabular-nums"}}>{v}</div></div>))}
          </div>
          {ui.gateTotal>1&&<div style={{fontSize:8,fontWeight:600,color:"rgba(40,160,80,.6)",marginTop:6,letterSpacing:1}}>GATE {ui.gateNum+1} / {ui.gateTotal}</div>}
        </div>
        <div style={{position:"absolute",top:14,right:14,display:"flex",gap:6}}>
          <div onClick={toggleMap} style={{background:"rgba(245,244,240,.82)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderRadius:10,padding:"8px 11px",border:"1px solid rgba(0,0,0,.06)",cursor:"pointer",userSelect:"none",touchAction:"none"}}><span style={{fontSize:10,fontWeight:600,color:"rgba(0,0,0,.45)",letterSpacing:1}}>◈</span></div>
          <div onClick={copyLogs} style={{background:ui.copied?"rgba(40,140,70,.12)":"rgba(245,244,240,.82)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderRadius:10,padding:"8px 11px",border:`1px solid ${ui.copied?"rgba(40,140,70,.2)":"rgba(0,0,0,.06)"}`,cursor:"pointer",userSelect:"none",touchAction:"none"}}><span style={{fontSize:10,fontWeight:600,color:ui.copied?"rgba(40,140,70,.6)":"rgba(0,0,0,.3)",letterSpacing:1}}>{ui.copied?"✓":"⊕"}</span></div>
          <div onClick={exportFavorites} style={{background:"rgba(245,244,240,.82)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderRadius:10,padding:"8px 11px",border:"1px solid rgba(0,0,0,.06)",cursor:"pointer",userSelect:"none",touchAction:"none"}}><span style={{fontSize:10,fontWeight:600,color:"rgba(240,190,50,.5)",letterSpacing:1}}>★</span></div>
          {(ui.phase==="fly"||ui.phase==="plan")&&<div onClick={doRetry} style={{background:"rgba(245,244,240,.82)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderRadius:10,padding:"8px 11px",border:"1px solid rgba(0,0,0,.06)",cursor:"pointer",userSelect:"none",touchAction:"none"}}><span style={{fontSize:10,fontWeight:600,color:"rgba(0,0,0,.45)"}}>↺</span></div>}
        </div>
        <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"0 16px 26px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,pointerEvents:"none"}}>
          {(ui.phase==="aim"||ui.phase==="plan")&&locked&&(
            <div style={{display:"flex",gap:8,pointerEvents:"auto",alignItems:"center"}}>
              <Btn icon="◀" color="60,80,140" onClick={()=>adjustAngle(-.03)}/>
              <Btn icon="−" color="60,80,140" onClick={()=>adjustPower(-3)}/>
              <div style={{padding:"4px 12px",borderRadius:10,background:"rgba(0,0,0,.04)",minWidth:50,textAlign:"center"}}>
                <span style={{fontSize:14,fontWeight:300,color:"rgba(0,0,0,.7)",fontVariantNumeric:"tabular-nums"}}>{Math.sqrt(lock.current.vx**2+lock.current.vz**2).toFixed(0)}</span>
                <span style={{fontSize:8,fontWeight:600,color:"rgba(0,0,0,.25)",marginLeft:3}}>Δv</span>
              </div>
              <Btn icon="+" color="60,80,140" onClick={()=>adjustPower(3)}/>
              <Btn icon="▶" color="60,80,140" onClick={()=>adjustAngle(.03)}/>
            </div>
          )}
          {ui.phase==="aim"&&<div style={{display:"flex",gap:12,pointerEvents:"auto"}}>
            <Btn icon="▸" label="Launch" color="220,130,20" onClick={doLaunch} wide disabled={!locked||noFuel}/>
          </div>}
          {ui.phase==="fly"&&<div style={{display:"flex",gap:12,pointerEvents:"auto"}}>
            <Btn icon="▸▸" label="Fast" color="100,100,100" onClick={()=>{ffRef.current=!ffRef.current;setUi(u=>({...u}));}}/>
            <Btn icon="◎" label="Plan Burn" color="60,130,220" onClick={doPlan} wide disabled={s?.fuel<=0}/>
          </div>}
          {ui.phase==="plan"&&<div style={{display:"flex",gap:12,pointerEvents:"auto"}}>
            <Btn label="Cancel" color="100,100,100" onClick={doCancel}/>
            <Btn icon="⚡" label="Execute" color="60,130,220" onClick={doExec} wide disabled={!locked||noFuel}/>
          </div>}
        </div>
        {ui.phase==="win"&&<div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center",pointerEvents:"none",
          background:"rgba(245,244,240,.88)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderRadius:20,padding:"28px 36px",border:"1px solid rgba(60,200,100,.15)"}}>
          <div style={{fontSize:13,fontWeight:600,letterSpacing:3,color:"rgba(60,200,100,.6)",marginBottom:8}}>GATE REACHED</div>
          <div style={{fontSize:36,fontWeight:200,color:"rgba(0,0,0,.75)",fontVariantNumeric:"tabular-nums"}}>{ui.score} <span style={{fontSize:14,fontWeight:500,color:"rgba(0,0,0,.25)"}}>PTS</span></div>
          <div style={{fontSize:13,fontWeight:500,color:"rgba(0,0,0,.3)",marginTop:6}}>{ui.burns===0?"Perfect — zero burns":`${ui.burns} burn${ui.burns!==1?"s":""}`}{progress.current.streak>1?` · ×${progress.current.streak} streak`:""}</div>
          {s?.lastFlyby&&<div style={{fontSize:12,fontWeight:600,color:"rgba(200,110,20,.75)",marginTop:4}}>{s.lastFlyby}</div>}
          <div style={{fontSize:11,fontWeight:500,color:"rgba(0,0,0,.15)",marginTop:16,marginBottom:6}}>Rate this level</div>
          <div style={{display:"flex",justifyContent:"center",gap:12,pointerEvents:"auto"}}>
            {[1,2,3,4,5].map(r=>(
              <div key={r} onClick={()=>rateLevel(r)} style={{width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,cursor:"pointer",color:r<=(s?._rating||0)?"rgba(240,190,50,.9)":"rgba(0,0,0,.1)",userSelect:"none",WebkitUserSelect:"none",touchAction:"none",transition:"all .15s"}}>★</div>
            ))}
          </div>
          <div style={{marginTop:16,pointerEvents:"auto"}}>
            {s?._rated
              ?<Btn icon="▸" label="Next System" color="60,200,100" onClick={doNext} wide/>
              :<div style={{fontSize:10,fontWeight:500,color:"rgba(0,0,0,.25)"}}>Rate to continue</div>}
          </div>
        </div>}
        {ui.phase==="crash"&&<div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center",pointerEvents:"auto"}} onClick={doRetry}>
          <div style={{fontSize:20,fontWeight:200,color:"rgba(200,50,35,.7)",letterSpacing:6}}>IMPACT</div>
          <div style={{fontSize:10,fontWeight:400,color:"rgba(0,0,0,.35)",letterSpacing:2,marginTop:12}}>tap to retry</div>
        </div>}
      </>}
      {onExit&&<button onClick={onExit} style={{position:"absolute",top:10,left:10,zIndex:40,pointerEvents:"auto",padding:"8px 14px",font:"inherit",fontSize:12,letterSpacing:1,background:"rgba(20,25,33,.85)",color:"#c2c9d6",border:"1px solid rgba(150,160,178,.4)",borderRadius:10,cursor:"pointer"}}>⏏ MENU</button>}
      {ui.showMap&&<div style={{position:"absolute",bottom:30,left:"50%",transform:"translateX(-50%)",pointerEvents:"auto"}}><Btn icon="▸" label="Continue" color="100,180,255" onClick={toggleMap} wide/></div>}
  </>);
}
