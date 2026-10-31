const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const path=require('path');
const app=express(),server=http.createServer(app),io=new Server(server);
app.use(express.static(path.join(__dirname,'public')));
const PORT=process.env.PORT||3000, rooms=new Map();
const rand=(a,b)=>Math.random()*(b-a)+a;
function code(){let s;do{s=Math.random().toString(36).slice(2,6).toUpperCase()}while(rooms.has(s));return s;}
function publicRoom(r){return {code:r.code,phase:r.phase,host:r.host,remaining:r.remaining,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,score:p.score,x:p.x,y:p.y,color:p.color,connected:p.connected,pulseTimer:p.pulseTimer,pulseCooldown:p.pulseCooldown})),objects:r.objects};}
function broadcast(r){io.to(r.code).emit('room:update',publicRoom(r));}
function stop(r){if(r.timer)clearInterval(r.timer);r.timer=null;}
function finish(r){if(r.phase!=='playing')return;stop(r);r.phase='finished';r.remaining=0;const ranking=[...r.players.values()].sort((a,b)=>b.score-a.score);io.to(r.code).emit('match:finished',{ranking:ranking.map((p,i)=>({id:p.id,name:p.name,score:p.score,place:i+1})),room:publicRoom(r)});broadcast(r);}
function begin(r){if(r.phase!=='lobby'||r.players.size<2)return false;r.phase='playing';r.remaining=60;for(const p of r.players.values()){p.score=0;p.x=rand(70,730);p.y=rand(70,450);p.pulseTimer=0;p.pulseCooldown=0;p.invuln=0;}r.objects=[];for(let i=0;i<18;i++)spawn(r);io.to(r.code).emit('match:started',{duration:60});broadcast(r);r.timer=setInterval(()=>tick(r),50);return true;}
function spawn(r){r.objects.push({id:Math.random().toString(36).slice(2),x:rand(25,775),y:rand(25,495),type:Math.random()<.29?'danger':'good',vx:rand(-.9,.9),vy:rand(-.9,.9)});}
function tick(r){if(r.phase!=='playing')return;r.frame=(r.frame||0)+1;if(r.frame%20===0){r.remaining--;if(r.remaining<=0){finish(r);return;}}
if(r.objects.length<26&&Math.random()<.18)spawn(r);
for(const p of r.players.values()){if(!p.connected)continue;if(p.pulseTimer>0)p.pulseTimer--;if(p.pulseCooldown>0)p.pulseCooldown--;if(p.invuln>0)p.invuln--;p.x=Math.max(13,Math.min(787,p.x));p.y=Math.max(13,Math.min(507,p.y));}
for(let i=r.objects.length-1;i>=0;i--){const o=r.objects[i];o.x+=o.vx;o.y+=o.vy;if(o.x<12||o.x>788)o.vx*=-1;if(o.y<12||o.y>508)o.vy*=-1;for(const p of r.players.values()){if(!p.connected||Math.hypot(p.x-o.x,p.y-o.y)>21)continue;if(o.type==='good'){p.score+=10;}else if(p.pulseTimer===0&&p.invuln===0){p.score=Math.max(0,p.score-20);p.invuln=20;}r.objects.splice(i,1);break;}}
if(r.frame%2===0)broadcast(r);
}
io.on('connection',socket=>{
socket.on('room:create',({name})=>{const c=code(),p={id:socket.id,name:String(name||'Player').slice(0,14),score:0,x:400,y:260,color:'#67e8f9',pulse:0,invuln:0,connected:true};const r={code:c,host:socket.id,phase:'lobby',remaining:0,players:new Map([[socket.id,p]]),objects:[],timer:null};rooms.set(c,r);socket.join(c);socket.data.room=c;socket.emit('room:created',{code:c});broadcast(r);});
socket.on('room:join',({name,code:c})=>{c=String(c||'').toUpperCase();const r=rooms.get(c);if(!r){socket.emit('error:message','Room not found. Check the code.');return;}if(r.phase!=='lobby'){socket.emit('error:message','This match has already started.');return;}if(r.players.size>=8){socket.emit('error:message','Room is full (8 players maximum).');return;}const palette=['#67e8f9','#f9a8d4','#a3e635','#c4b5fd','#fbbf24','#fb923c','#5eead4','#fda4af'];const p={id:socket.id,name:String(name||'Player').slice(0,14),score:0,x:rand(70,730),y:rand(70,450),color:palette[r.players.size],pulse:0,invuln:0,connected:true};r.players.set(socket.id,p);socket.join(c);socket.data.room=c;socket.emit('room:joined',{code:c});broadcast(r);});
socket.on('match:start',()=>{const r=rooms.get(socket.data.room);if(!r)return;if(socket.id!==r.host){socket.emit('error:message','Only the host can start the match.');return;}if(!begin(r))socket.emit('error:message','At least 2 players are required.');});
socket.on('player:input',data=>{const r=rooms.get(socket.data.room),p=r?.players.get(socket.id);if(!r||r.phase!=='playing'||!p)return;let dx=Math.max(-1,Math.min(1,Number(data?.dx)||0)),dy=Math.max(-1,Math.min(1,Number(data?.dy)||0)),len=Math.hypot(dx,dy)||1;p.x=Math.max(13,Math.min(787,p.x+dx/len*8));p.y=Math.max(13,Math.min(507,p.y+dy/len*8));});
socket.on('player:pulse',()=>{
 const r=rooms.get(socket.data.room),p=r?.players.get(socket.id);
 if(!r||r.phase!=='playing'||!p||p.pulseCooldown>0)return;
 p.pulseTimer=24; p.pulseCooldown=100; p.invuln=24;
 // Pulse is a real area blast: clear nearby hazards and collect nearby signals.
 let cleared=0,collected=0;
 for(let i=r.objects.length-1;i>=0;i--){
   const o=r.objects[i];
   if(Math.hypot(p.x-o.x,p.y-o.y)<=145){
     if(o.type==='danger')cleared++;
     else {p.score+=10;collected++;}
     r.objects.splice(i,1);
   }
 }
 socket.emit('pulse:activated',{x:p.x,y:p.y,cleared,collected});
 broadcast(r);
});
socket.on('room:leave',()=>leave(socket));
socket.on('disconnect',()=>leave(socket));
});
function leave(socket){const c=socket.data.room,r=rooms.get(c);if(!r)return;r.players.delete(socket.id);socket.leave(c);socket.data.room=null;if(!r.players.size){stop(r);rooms.delete(c);return;}if(r.host===socket.id)r.host=r.players.keys().next().value;if(r.phase==='playing'&&r.players.size===1){finish(r);}else broadcast(r);}
server.listen(PORT,'0.0.0.0',()=>console.log(`Unknown Arcade multiplayer running on ${PORT}`));
