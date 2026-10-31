(()=>{
const socket=io(),$=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d'),W=800,H=520,keys={};
let room=null,myId=null,roomState=null,playing=false,ended=false,paused=false,lastSent=0,raf=0,lastSnapshotAt=0;
const renderPlayers=new Map();
let pulseEffects=[];
function say(t){$('message').textContent=t;}
function playerName(){return $('name').value.trim().slice(0,14)||'Player';}
$('create').onclick=()=>socket.emit('room:create',{name:playerName()});
$('join').onclick=()=>socket.emit('room:join',{name:playerName(),code:$('code').value.trim().toUpperCase()});
$('start').onclick=()=>socket.emit('match:start');
$('copyCode').onclick=async()=>{if(!room)return;try{await navigator.clipboard.writeText(room);$('copyCode').textContent='COPIED!';setTimeout(()=>{$('copyCode').textContent='COPY CODE';},1400);}catch(e){const t=document.createElement('textarea');t.value=room;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();$('copyCode').textContent='COPIED!';setTimeout(()=>{$('copyCode').textContent='COPY CODE';},1400);}};
$('leave').onclick=()=>{socket.emit('room:leave');room=null;roomState=null;playing=false;ended=false;showLobby();};
$('pulse').onclick=()=>{if(playing)socket.emit('player:pulse');};
socket.on('connect',()=>{$('phase').textContent='ONLINE';myId=socket.id;});
socket.on('room:created',d=>{room=d.code;$('roomLabel').textContent=room;$('copyCode').disabled=false;$('phase').textContent='LOBBY';say('Room created! Share code '+room+' with your friends.');});
socket.on('room:joined',d=>{room=d.code;$('roomLabel').textContent=room;$('copyCode').disabled=false;$('phase').textContent='LOBBY';say('Joined room '+room+'. Waiting for the host to start.');});
socket.on('error:message',say);
socket.on('room:update',r=>{roomState=r;lastSnapshotAt=performance.now();for(const p of r.players){let q=renderPlayers.get(p.id);if(!q)renderPlayers.set(p.id,{x:p.x,y:p.y,tx:p.x,ty:p.y,color:p.color,name:p.name});else{q.tx=p.x;q.ty=p.y;q.color=p.color;q.name=p.name;}}for(const id of [...renderPlayers.keys()])if(!r.players.some(p=>p.id===id))renderPlayers.delete(id);room=r.code;$('roomLabel').textContent=room;$('time').textContent=r.phase==='lobby'?'—':r.remaining;$('phase').textContent=r.phase.toUpperCase();const me=r.players.find(p=>p.id===socket.id);$('score').textContent=me?me.score:0;$('pulse').disabled=!(r.phase==='playing'&&me&&me.pulseCooldown===0);$('pulse').textContent=me&&me.pulseCooldown>0?`PULSE · ${Math.ceil(me.pulseCooldown/20)}s`:'PULSE · SPACE';$('players').innerHTML='';[...r.players].sort((a,b)=>b.score-a.score).forEach((p,i)=>{let row=document.createElement('div');row.className='player';let nm=document.createElement('span');nm.textContent=(i+1)+'. '+p.name+(p.id===r.host?' ★':'')+(p.id===socket.id?' (you)':'');let sc=document.createElement('b');sc.textContent=p.score;row.append(nm,sc);$('players').append(row);});$('start').disabled=!(r.phase==='lobby'&&r.host===socket.id&&r.players.length>=2);if(r.phase==='lobby')say(`${r.players.length}/8 players · ${r.players.length>=2?'Host can start the match.':'Need at least 2 players to start.'}`);});
socket.on('pulse:activated',d=>{pulseEffects.push({x:d.x,y:d.y,r:8,life:30,max:30});say(`Pulse! Cleared ${d.cleared} hazards and collected ${d.collected} signals.`);});
socket.on('match:started',()=>{playing=true;ended=false;$('overlay').style.display='none';say('Match live! Everyone is playing simultaneously.');});
socket.on('match:finished',d=>{playing=false;ended=true;cancelAnimationFrame(raf);const winner=d.ranking[0];$('overlay').style.display='grid';$('overlay').innerHTML=`<div class="modal"><div class="brand">MATCH COMPLETE</div><h1>${winner.name} wins!</h1><p>Final leaderboard</p><div class="players">${d.ranking.map(p=>`<div class="player"><span>${p.place}. ${escapeHtml(p.name)}</span><b>${p.score}</b></div>`).join('')}</div><p style="margin-top:16px">Create a new room to play again.</p><button id="again">BACK TO LOBBY</button></div>`;$('again').onclick=()=>{socket.emit('room:leave');room=null;roomState=null;ended=false;showLobby();};});
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function showLobby(){$('overlay').style.display='grid';$('overlay').innerHTML=`<div class="modal"><div class="brand">SIGNAL DETECTED</div><h1>Enter the arena.</h1><p>Everyone plays at the same time. Collect cyan signals, avoid red hazards, and finish with the highest score.</p><div class="row"><input id="name" maxlength="14" placeholder="Your name"><button id="create">CREATE ROOM</button></div><div class="row"><input id="code" maxlength="4" placeholder="ROOM CODE"><button class="secondary" id="join">JOIN ROOM</button></div><p id="message">Create a room and share its 4-character code.</p></div>`;$('create').onclick=()=>socket.emit('room:create',{name:playerName()});$('join').onclick=()=>socket.emit('room:join',{name:playerName(),code:$('code').value.trim().toUpperCase()});$('roomLabel').textContent='—';$('copyCode').disabled=true;$('copyCode').textContent='COPY CODE';$('phase').textContent='ONLINE';$('players').innerHTML='<p>Waiting for room…</p>';}
document.addEventListener('keydown',e=>{let k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();keys[k]=true;if(k===' '&&playing)socket.emit('player:pulse');});
document.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
let drag=null;canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag={x:e.clientX,y:e.clientY};if(Math.hypot(dx,dy)>1)socket.emit('player:input',{dx,dy});});canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
function inputLoop(){if(playing){let dx=0,dy=0;if(keys.a||keys.arrowleft)dx--;if(keys.d||keys.arrowright)dx++;if(keys.w||keys.arrowup)dy--;if(keys.s||keys.arrowdown)dy++;if((dx||dy)&&performance.now()-lastSent>8){socket.emit('player:input',{dx,dy});lastSent=performance.now();}}raf=requestAnimationFrame(inputLoop);}
function draw(){
const now=performance.now();
ctx.clearRect(0,0,W,H);ctx.fillStyle='#070d1c';ctx.fillRect(0,0,W,H);
ctx.strokeStyle='#172541';ctx.lineWidth=1;for(let x=24;x<W;x+=36){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=20;y<H;y+=36){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
ctx.strokeStyle='#24375c';ctx.lineWidth=2;ctx.strokeRect(8,8,W-16,H-16);
if(roomState){
 for(let i=pulseEffects.length-1;i>=0;i--){const fx=pulseEffects[i];fx.life--;fx.r+=5;ctx.strokeStyle=`rgba(103,232,249,${Math.max(0,fx.life/fx.max)})`;ctx.lineWidth=5;ctx.beginPath();ctx.arc(fx.x,fx.y,fx.r,0,Math.PI*2);ctx.stroke();if(fx.life<=0)pulseEffects.splice(i,1);}
 for(const o of roomState.objects||[]){ctx.fillStyle=o.type==='good'?'#67e8f9':'#fb7185';ctx.shadowBlur=18;ctx.shadowColor=ctx.fillStyle;ctx.beginPath();ctx.arc(o.x,o.y,o.type==='good'?8:11,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
 for(const p of roomState.players){
   const q=renderPlayers.get(p.id)||{x:p.x,y:p.y,tx:p.x,ty:p.y,color:p.color,name:p.name};
   // Frame-rate-independent easing: positions glide toward fresh authoritative server snapshots.
   const alpha=1-Math.pow(0.001,Math.min(1/30,Math.max(0,(now-(q.lastFrame||now))/1000)));
   q.x+=(q.tx-q.x)*Math.min(.42,alpha);q.y+=(q.ty-q.y)*Math.min(.42,alpha);q.lastFrame=now;renderPlayers.set(p.id,q);
   ctx.fillStyle=q.color;ctx.shadowBlur=20;ctx.shadowColor=q.color;ctx.beginPath();ctx.arc(q.x,q.y,12,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
   ctx.fillStyle='#eaf3ff';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText(q.name,q.x,q.y-20);
   if(p.id===socket.id&&p.pulseTimer>0){ctx.strokeStyle='rgba(103,232,249,.85)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(q.x,q.y,34,0,Math.PI*2);ctx.stroke();}
   if(p.id===socket.id){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.x,q.y,17,0,Math.PI*2);ctx.stroke();}
 }
}
requestAnimationFrame(draw);
}
inputLoop();draw();
})();