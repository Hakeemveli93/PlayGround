(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 960, H = 540, FLOOR = 425;
  canvas.width = W; canvas.height = H;
  const COLORS = {
    ink:'#11171c', paper:'#f4f0e5', muted:'#9ba7a7', orange:'#f06c3b', cyan:'#5ae0d2', gold:'#e8c75a', red:'#e55551'
  };
  const fighters = [
    {name:'SLICK', title:'THE STREET PHANTOM', style:'KICKBOXER', color:'#ef754d', dark:'#8c3d3b', skin:'#bd8063', hair:'#25272a', bio:'Fast hands. Faster exits.', stats:[4,3,5]},
    {name:'SHADE', title:'NIGHT SHIFT', style:'COUNTER STRIKER', color:'#a78ee4', dark:'#48447e', skin:'#c18c77', hair:'#201f35', bio:'You never saw it coming.', stats:[3,5,4]},
    {name:'BRICK', title:'THE WALL', style:'POWER BRAWLER', color:'#e6b755', dark:'#8c5a36', skin:'#ce9271', hair:'#392a21', bio:'Built to break the rules.', stats:[5,4,2]},
    {name:'SGT. VOSS', title:'HARDWARE DIVISION', style:'COMBAT SPECIALIST', color:'#74b87f', dark:'#3d634b', skin:'#c09178', hair:'#4b4438', bio:'Mission comes first.', stats:[4,4,3]},
    {name:'KESTREL', title:'SKYLINE RUNNER', style:'AERIAL ACE', color:'#5dc5d2', dark:'#316c82', skin:'#d09a7a', hair:'#252f3b', bio:'Catch me if you can.', stats:[3,3,5]}
  ];
  const stages = [
    {name:'BACK ALLEY', sub:'EAST SIDE • 11:47 PM', sky:'#252438', floor:'#4a3a37', light:'#f17a48', sign:'OPEN'},
    {name:'DESERT OUTPOST', sub:'MOJAVE • 03:16 PM', sky:'#d98558', floor:'#8e6245', light:'#f5cf77', sign:'MOTEL'},
    {name:'BUNKER 13', sub:'RESTRICTED • 02:04 AM', sky:'#263b42', floor:'#36474b', light:'#6fcdc0', sign:'B-13'}
  ];
  let screen='title', selected=0, stageIndex=0, player=null, cpu=null, round=1, wins=[0,0], timer=60, lastTime=0, matchMessage='', menuHit=[], soundOn=true, audio=null, shake=0, flash=0;
  const keys = Object.create(null), pointers = new Map(), touch = {left:false,right:false,up:false,block:false,punch:false,kick:false};
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function beep(freq=240,duration=.06,type='square',vol=.035){
    if(!soundOn) return;
    try { audio ||= new (window.AudioContext||window.webkitAudioContext)(); if(audio.state==='suspended') audio.resume();
      const o=audio.createOscillator(), g=audio.createGain(); o.type=type; o.frequency.setValueAtTime(freq,audio.currentTime); g.gain.setValueAtTime(vol,audio.currentTime); g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration); o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);
    } catch(_){}
  }
  function newFighter(def,index,side){return {def,index,side,x:side===0?300:660,y:FLOOR,vx:0,vy:0,health:100,facing:side===0?1:-1,grounded:true,block:false,attack:null,attackCooldown:0,anim:0,stun:0,aiWait:.3+Math.random()*.4};}
  function beginMatch(){player=newFighter(fighters[selected],selected,0);let ix=(selected+1+Math.floor(Math.random()*4))%5;cpu=newFighter(fighters[ix],ix,1);round=1;wins=[0,0];timer=60;screen='fight';matchMessage='';beep(440,.1,'triangle');}
  function nextRound(){round++;timer=60;player=newFighter(fighters[selected],selected,0);cpu=newFighter(fighters[cpu.index],cpu.index,1);screen='fight';}
  function startAttack(f,kind){if(f.attackCooldown>0||f.stun>0||f.attack)return;f.attack={kind,age:0,hit:false};f.attackCooldown=kind==='punch'?.42:.62;beep(kind==='punch'?185:125,.07,'sawtooth',.025);}
  function tryHit(attacker,defender){const a=attacker.attack;if(!a||a.hit)return;const active=a.kind==='punch'?.10:.14, start=a.kind==='punch'?.11:.19, end=a.kind==='punch'?.27:.38;if(a.age<start||a.age>end)return;
    const reach=a.kind==='punch'?56:78, close=Math.abs(attacker.x-defender.x)<reach+12, vertical=Math.abs(attacker.y-defender.y)<65;
    if(close&&vertical&&attacker.facing===Math.sign(defender.x-attacker.x)){a.hit=true;const blocking=defender.block&&defender.grounded&&defender.facing===-attacker.facing;const power=attacker.def.stats[0]/4, armor=1-(defender.def.stats[1]-3)*.06;const damage=(a.kind==='punch'?7:11)*power*armor*(blocking?.22:1);defender.health=Math.max(0,defender.health-damage);defender.stun=blocking?.12:.23;defender.vx=(attacker.facing)*(blocking?85:210);if(!blocking&&a.kind==='kick'&&defender.grounded){defender.vy=-110;defender.grounded=false;}shake=blocking?3:7;flash=.08;beep(blocking?300:90,.09,blocking?'triangle':'square',.045);
    }
  }
  function updateFighter(f,dt,enemy,isPlayer){f.anim+=dt;f.attackCooldown=Math.max(0,f.attackCooldown-dt);f.stun=Math.max(0,f.stun-dt);if(f.attack){f.attack.age+=dt;if(f.attack.age>(f.attack.kind==='punch'?.42:.58))f.attack=null;}
    if(!isPlayer){f.aiWait-=dt;const dist=enemy.x-f.x;f.facing=dist>=0?1:-1;f.block=f.aiWait<.1&&Math.abs(dist)<95&&Math.random()<.025;
      if(f.stun<=0&&f.attackCooldown<=0&&!f.attack){if(Math.abs(dist)>92){f.vx=Math.sign(dist)*(Math.abs(dist)>190?115:70)*(0.82+f.def.stats[2]*.06);if(f.grounded&&Math.random()<.0012){f.vy=-365;f.grounded=false;}}
        else {f.vx*=.7;if(f.aiWait<=0){startAttack(f,Math.random()<.58?'punch':'kick');f.aiWait=.38+Math.random()*.62;}}}
    } else {const l=keys.KeyA||keys.ArrowLeft||touch.left, r=keys.KeyD||keys.ArrowRight||touch.right, jump=keys.KeyW||keys.ArrowUp||keys.Space||touch.up;f.block=keys.KeyS||keys.ArrowDown||touch.block;
      if(f.stun<=0){const moveSpeed=180+f.def.stats[2]*8;f.vx=l?-moveSpeed:r?moveSpeed:0;if(l)f.facing=-1;if(r)f.facing=1;if(jump&&f.grounded){f.vy=-390-f.def.stats[2]*6;f.grounded=false;beep(330,.05,'triangle',.02);}if((keys.KeyJ||keys.KeyZ||touch.punch)&&!f._punch){startAttack(f,'punch');f._punch=true;}if(!(keys.KeyJ||keys.KeyZ||touch.punch))f._punch=false;if((keys.KeyK||keys.KeyX||touch.kick)&&!f._kick){startAttack(f,'kick');f._kick=true;}if(!(keys.KeyK||keys.KeyX||touch.kick))f._kick=false;}
    }
    if(f.stun>0&&isPlayer) f.vx*=.92;
    f.x+=f.vx*dt;f.x=clamp(f.x,85,875);if(!f.grounded){f.vy+=1000*dt;f.y+=f.vy*dt;if(f.y>=FLOOR){f.y=FLOOR;f.vy=0;f.grounded=true;}}
    tryHit(f,enemy);
  }
  function update(dt){if(screen!=='fight')return;timer=Math.max(0,timer-dt);updateFighter(player,dt,cpu,true);updateFighter(cpu,dt,player,false);
    const gap=cpu.x-player.x;if(Math.abs(gap)<58){const push=(58-Math.abs(gap))*.5;player.x-=Math.sign(gap)*push;cpu.x+=Math.sign(gap)*push;}player.facing=player.x<cpu.x?1:-1;cpu.facing=-player.facing;
    if(player.health<=0||cpu.health<=0||timer<=0){const winner=player.health===cpu.health?null:(player.health>cpu.health?0:1);if(winner!==null)wins[winner]++;matchMessage=winner===null?'TIME • DRAW':winner===0?'ROUND '+round+' • YOU TAKE IT':'ROUND '+round+' • CPU WINS';screen='roundend';beep(winner===0?520:110,.35,'sawtooth',.035);}
    shake=Math.max(0,shake-dt*28);flash=Math.max(0,flash-dt);
  }
  function fitText(text,x,y,max,size,color=COLORS.paper,align='left',font='Impact, Haettenschweiler, Arial Narrow Bold, sans-serif') {ctx.textAlign=align;ctx.font=`${size}px ${font}`;ctx.fillStyle=color;let s=text;while(ctx.measureText(s).width>max&&s.length>3)s=s.slice(0,-1);if(s!==text)s=s.slice(0,-1)+'…';ctx.fillText(s,x,y);}
  function text(txt,x,y,size,color=COLORS.paper,align='left',font='Impact, Haettenschweiler, Arial Narrow Bold, sans-serif'){ctx.font=`${size}px ${font}`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(txt,x,y);}
  function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
  function line(x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  function button(label,x,y,w,h,action,primary=false){menuHit.push({x,y,w,h,action});ctx.fillStyle=primary?'#f06c3b':'#1b262d';ctx.fillRect(x,y,w,h);ctx.strokeStyle=primary?'#ff9b67':'#486068';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1);text(label,x+w/2,y+h/2+6,17,COLORS.paper,'center');}
  function drawTitle(){rect(0,0,W,H,'#11171c');drawGrid();ctx.save();ctx.translate(70,0);ctx.rotate(-.07);rect(625,-40,250,650,'#1c282e');for(let i=0;i<8;i++)line(640+i*35,0,510+i*35,H,'#2b393d',1);ctx.restore();
    text('STREET',58,105,73,COLORS.paper);text('vs',331,104,33,COLORS.orange);text('STEEL',390,105,73,COLORS.cyan);rect(60,125,630,3,COLORS.orange);text('1993',61,174,31,COLORS.gold);text('ARCADE EDITION',144,174,22,COLORS.muted);text('THE CITY DOESN’T PLAY FAIR.',62,217,14,'#aab5b4','left','Arial, sans-serif');
    drawFighterArt(fighters[0],250,419,1,.9,0,true);drawFighterArt(fighters[2],698,419,-1,.9,0,true);rect(55,259,386,1,'#39464a');text('INSERT COIN  /  PRESS START',58,287,14,COLORS.cyan);button('START GAME',58,315,200,50,'select',true);button('HOW TO PLAY',270,315,171,50,'help');text('A / D MOVE     W JUMP     S BLOCK',59,400,12,COLORS.muted,'left','Arial, sans-serif');text('J PUNCH     K KICK     ESC PAUSE',59,420,12,COLORS.muted,'left','Arial, sans-serif');text('© 1993 NEON FOUNDRY',60,502,10,'#647278','left','Arial, sans-serif');}
  function drawGrid(){rect(0,0,W,H,'#131a1f');for(let x=0;x<W;x+=32)line(x,0,x,H,'#1c262b',1);for(let y=0;y<H;y+=32)line(0,y,W,y,'#1c262b',1);}
  function drawHelp(){drawPanel('HOW TO THROW DOWN','One fighter. One CPU rival. First to two rounds wins.');text('KEYBOARD',115,196,16,COLORS.cyan);text('A / D  Move     W  Jump     S  Block',115,225,17);text('J / Z  Punch     K / X  Kick',115,253,17);text('Touch controls appear during the fight on mobile.',115,301,15,COLORS.muted,'left','Arial, sans-serif');text('Block low to reduce incoming damage. Time your attacks.',115,331,15,COLORS.muted,'left','Arial, sans-serif');button('BACK',115,400,140,46,'title');button('SOUND: '+(soundOn?'ON':'OFF'),275,400,180,46,'sound');}
  function drawSelect(){drawPanel('CHOOSE YOUR FIGHTER','Pick your fighter. The CPU will find a worthy opponent.');
    fighters.forEach((f,i)=>{const x=43+i*176,w=164,h=257,y=169,active=i===selected;ctx.fillStyle=active?'#28373b':'#1a2429';ctx.fillRect(x,y,w,h);ctx.strokeStyle=active?f.color:'#39464a';ctx.lineWidth=active?3:1;ctx.strokeRect(x+1,y+1,w-2,h-2);drawFighterArt(f,x+w/2,y+164,1,.54,0,false);rect(x+10,y+13,26,22,active?f.color:'#344248');text(String(i+1),x+23,y+29,13,'#fff','center');text(f.name,x+12,y+205,17,COLORS.paper);fitText(f.style,x+12,y+229,w-24,10,f.color);for(let s=0;s<3;s++){text(['PWR','DEF','SPD'][s],x+12+s*48,y+249,8,COLORS.muted,'left','Arial, sans-serif');rect(x+12+s*48,y+254,36,3,'#334146');rect(x+12+s*48,y+254,36*f.stats[s]/5,3,f.color);}});
    button('BACK',43,451,115,42,'title');button('FIGHT  →',747,451,170,42,'stage',true);text('← →  OR  TAP TO SELECT',480,480,10,COLORS.muted,'center','Arial, sans-serif');}
  function drawStageSelect(){drawPanel('SELECT YOUR BATTLEGROUND','The city is waiting. Choose where the bell rings.');stages.forEach((s,i)=>{const x=76+i*276,y=180,w=252,h=222,active=stageIndex===i;drawStageArt(s,x,y,w,h,i);ctx.strokeStyle=active?COLORS.orange:'#4a5759';ctx.lineWidth=active?3:1;ctx.strokeRect(x,y,w,h);text(s.name,x+14,y+173,18,COLORS.paper);text(s.sub,x+14,y+197,10,COLORS.muted,'left','Arial, sans-serif');});button('BACK',76,432,126,42,'select');button('BEGIN MATCH  ▶',694,432,190,42,'begin',true);text('TAP A STAGE TO PREVIEW',480,467,10,COLORS.muted,'center','Arial, sans-serif');}
  function drawPanel(title,subtitle){drawGrid();rect(0,0,W,H,'#11171ce8');text(title,50,82,39,COLORS.paper);rect(50,101,860,2,COLORS.orange);text(subtitle,52,129,13,COLORS.muted,'left','Arial, sans-serif');}
  function drawFighterArt(f,x,y,face=1,scale=1,pose=0,full=false){ctx.save();ctx.translate(x,y);ctx.scale(face*scale,scale);const bob=Math.sin((player&&f===player?player.anim:performance.now()/1000)*7)*2;ctx.translate(0,bob);const attacking=(player&&f===player?player.attack:cpu&&f===cpu?cpu.attack:null);let punch=attacking?.kind==='punch'?1:0,kick=attacking?.kind==='kick'?1:0;
    // shadow
    ctx.fillStyle='#080d0dcc';ctx.beginPath();ctx.ellipse(0,3,full?58:58,11,0,0,Math.PI*2);ctx.fill();
    // legs
    const stride=(pose?0:Math.sin((f===player?player.anim:performance.now()/1000)*8))*5;
    ctx.strokeStyle=f.dark;ctx.lineWidth=20;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-10,-50);ctx.lineTo(-18+stride,-25);ctx.lineTo(-22+stride,-7);ctx.moveTo(9,-49);ctx.lineTo(18-stride,-26);ctx.lineTo(25+kick*31,-10-kick*17);ctx.stroke();
    ctx.strokeStyle=f.color;ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(-22+stride,-9);ctx.lineTo(-8+stride,-8);ctx.moveTo(20+kick*30,-12-kick*17);ctx.lineTo(37+kick*27,-10-kick*17);ctx.stroke();
    // torso, shoulders
    ctx.fillStyle=f.color;ctx.beginPath();ctx.moveTo(-22,-104);ctx.lineTo(19,-105);ctx.lineTo(27,-62);ctx.lineTo(12,-47);ctx.lineTo(-19,-50);ctx.lineTo(-29,-67);ctx.closePath();ctx.fill();
    ctx.fillStyle=f.dark;ctx.fillRect(-21,-75,42,7);ctx.fillStyle='#171d21';ctx.fillRect(-7,-102,14,54);
    // rear arm
    ctx.strokeStyle=f.dark;ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(-20,-97);ctx.lineTo(-34,-77);ctx.lineTo(-25,-64);ctx.stroke();
    // forward arm with attack extension
    ctx.strokeStyle=f.color;ctx.lineWidth=16;ctx.beginPath();ctx.moveTo(19,-98);ctx.lineTo(31+(punch?39:0),-84-(punch?3:0));ctx.lineTo(37+(punch?45:0),-80);ctx.stroke();ctx.fillStyle=f.skin;ctx.beginPath();ctx.arc(39+(punch?44:0),-80,8,0,Math.PI*2);ctx.fill();
    // neck and head
    ctx.fillStyle=f.skin;ctx.fillRect(-8,-119,16,19);ctx.beginPath();ctx.ellipse(0,-132,18,22,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=f.hair;ctx.beginPath();ctx.ellipse(-1,-143,19,12,-.15,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(-18,-144,36,7);
    ctx.fillStyle='#15191c';ctx.fillRect(7,-135,6,3);ctx.fillStyle='#e6d5bd';ctx.fillRect(10,-128,7,2);
    if(f.name==='SGT. VOSS'){ctx.fillStyle='#e2d5a4';ctx.fillRect(-18,-89,7,7);ctx.fillStyle='#383d38';ctx.fillRect(-20,-67,40,9);}
    if(f.name==='KESTREL'){ctx.fillStyle='#e6e5db';ctx.beginPath();ctx.moveTo(-14,-144);ctx.lineTo(-24,-151);ctx.lineTo(-9,-149);ctx.fill();}
    ctx.restore();}
  function drawStageArt(s,x,y,w,h,idx){ctx.save();ctx.translate(x,y);const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,s.sky);g.addColorStop(1,s.floor);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    if(idx===0){ctx.fillStyle='#171d25';ctx.fillRect(0,38,w*.42,h*.55);ctx.fillRect(w*.62,18,w*.38,h*.61);for(let n=0;n<6;n++){ctx.fillStyle=n%2?'#3a343d':'#4a3b3d';ctx.fillRect(n*24,76,15,32);}ctx.fillStyle=s.light;ctx.fillRect(w*.7,50,45,24);text(s.sign,x+w*.7+22,y+67,12,'#201e25','center');for(let n=0;n<6;n++){rect(w*.1+n*39,h*.62,4,36,'#d7a866');}}
    else if(idx===1){ctx.fillStyle='#b35e46';ctx.beginPath();ctx.moveTo(0,h*.57);ctx.lineTo(w*.18,h*.31);ctx.lineTo(w*.35,h*.55);ctx.lineTo(w*.52,h*.25);ctx.lineTo(w*.76,h*.56);ctx.lineTo(w,h*.36);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.fill();ctx.fillStyle='#493d36';ctx.fillRect(w*.57,h*.36,95,58);ctx.fillStyle=s.light;ctx.fillRect(w*.61,h*.4,83,4);text(s.sign,x+w*.75,y+h*.54,9,'#292523','center');ctx.fillStyle='#e3b664';ctx.beginPath();ctx.arc(w*.81,h*.23,18,0,Math.PI*2);ctx.fill();}
    else {ctx.fillStyle='#1b2b30';ctx.fillRect(0,32,w,h*.48);for(let n=0;n<4;n++){ctx.strokeStyle='#59666a';ctx.lineWidth=4;ctx.strokeRect(12+n*61,50,46,87);rect(17+n*61,56,36,6,n===1?'#bd6553':'#34474c');}ctx.fillStyle='#4a5b5c';ctx.fillRect(0,h*.66,w,8);for(let n=0;n<4;n++)line(20+n*71,0,20+n*71,h*.64,'#3e5155',3);text('B-13',x+w*.78,y+45,12,s.light,'center');}
    rect(0,h*.68,w,h*.32,'#25282a');for(let i=0;i<8;i++)line(i*w/8,h*.68,w/2+(i-4)*14,h,'#4c4540',1);ctx.restore();}
  function drawBackground(){const s=stages[stageIndex];const grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,s.sky);grad.addColorStop(.7,s.floor);grad.addColorStop(1,'#15191b');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    if(stageIndex===0){rect(0,150,240,190,'#1c2229');rect(38,194,166,35,'#382d35');for(let i=0;i<4;i++){rect(22+i*55,164,43,6,i%2?s.light:'#7b5b58');rect(18+i*61,238,8,90,'#413437');}rect(684,103,276,237,'#22252b');rect(714,143,211,45,'#4c3540');text('NIGHT OWL',820,173,19,'#e3896c','center');for(let i=0;i<5;i++){rect(702+i*49,220,4,110,'#574644');}rect(268,195,102,39,'#b05443');text('OPEN',319,222,21,'#ffe19a','center');}
    if(stageIndex===1){ctx.fillStyle='#dca36e';ctx.beginPath();ctx.arc(754,111,43,0,Math.PI*2);ctx.fill();ctx.fillStyle='#a9654e';ctx.beginPath();ctx.moveTo(0,335);ctx.lineTo(190,195);ctx.lineTo(360,332);ctx.lineTo(577,171);ctx.lineTo(795,332);ctx.lineTo(960,218);ctx.lineTo(960,430);ctx.lineTo(0,430);ctx.fill();rect(604,270,240,85,'#60483b');rect(620,252,205,20,'#9b6650');rect(674,294,69,40,'#28383a');text('MOTEL',722,289,12,'#ead3a2','center');for(let i=0;i<7;i++)rect(i*150+30,383,46,3,'#d7ad75');}
    if(stageIndex===2){rect(0,116,W,228,'#1a2a2e');for(let i=0;i<8;i++){let x=i*122;rect(x,120,7,210,'#4b5c5d');rect(x+9,153,95,5,'#394e51');rect(x+18,200,75,38,'#26393d');rect(x+23,207,65,4,i%3===0?'#d85e54':'#3e6d69');}rect(0,330,W,12,'#667271');text('AUTHORIZED PERSONNEL ONLY',480,92,13,'#98aba7','center','Arial, sans-serif');}
    rect(0,FLOOR+7,W,H-FLOOR,'#292b2d');for(let i=0;i<12;i++){line(i*100,FLOOR+7,480+(i-5)*20,H,'#414244',1);}rect(0,FLOOR,W,6,'#b16c50');
    // scenery silhouettes
    if(stageIndex===0){rect(0,344,108,19,'#172126');rect(817,352,143,15,'#172126');}
  }
  function drawFighter(f){const moving=Math.abs(f.vx)>30, bob=moving?Math.sin(f.anim*12)*2:0;ctx.save();ctx.translate(f.x,f.y+bob);ctx.scale(f.facing,1);const c=f.def;const atk=f.attack;const punch=atk&&atk.kind==='punch',kick=atk&&atk.kind==='kick';
    ctx.fillStyle='#090d0dbb';ctx.beginPath();ctx.ellipse(0,2,43,9,0,0,Math.PI*2);ctx.fill();
    // legs, weight shift
    ctx.lineCap='round';ctx.strokeStyle=c.dark;ctx.lineWidth=19;ctx.beginPath();ctx.moveTo(-10,-49);ctx.lineTo(-16+(moving?Math.sin(f.anim*12)*7:0),-25);ctx.lineTo(-21,-7);ctx.moveTo(10,-49);ctx.lineTo(17,-27);ctx.lineTo(kick?62:24,kick?-31:-7);ctx.stroke();
    ctx.strokeStyle=c.color;ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(-27,-9);ctx.lineTo(-9,-8);ctx.moveTo(kick?52:17,kick?-29:-9);ctx.lineTo(kick?77:36,kick?-31:-9);ctx.stroke();
    ctx.fillStyle=c.color;ctx.beginPath();ctx.moveTo(-22,-104);ctx.lineTo(19,-104);ctx.lineTo(26,-64);ctx.lineTo(13,-49);ctx.lineTo(-18,-50);ctx.lineTo(-29,-68);ctx.closePath();ctx.fill();ctx.fillStyle=c.dark;ctx.fillRect(-21,-76,42,7);ctx.fillStyle='#182025';ctx.fillRect(-7,-102,13,51);
    ctx.strokeStyle=c.dark;ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(-20,-97);ctx.lineTo(-34,-78);ctx.lineTo(-24,-64);ctx.stroke();ctx.strokeStyle=c.color;ctx.lineWidth=15;ctx.beginPath();ctx.moveTo(18,-97);ctx.lineTo(punch?62:32,punch?-84:-78);ctx.lineTo(punch?83:36,punch?-82:-64);ctx.stroke();ctx.fillStyle=c.skin;ctx.beginPath();ctx.arc(punch?85:37,punch?-82:-64,8,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=c.skin;ctx.fillRect(-8,-119,16,19);ctx.beginPath();ctx.ellipse(0,-132,18,22,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=c.hair;ctx.beginPath();ctx.ellipse(-1,-143,19,12,-.15,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(-18,-144,36,7);ctx.fillStyle='#14191b';ctx.fillRect(7,-135,6,3);ctx.fillStyle='#e4d7c6';ctx.fillRect(10,-128,7,2);
    if(c.name==='SGT. VOSS'){ctx.fillStyle='#e2d5a4';ctx.fillRect(-18,-89,7,7);ctx.fillStyle='#35473d';ctx.fillRect(-20,-67,40,9);}if(c.name==='KESTREL'){ctx.fillStyle='#ece8df';ctx.beginPath();ctx.moveTo(-14,-144);ctx.lineTo(-25,-153);ctx.lineTo(-9,-150);ctx.fill();}
    if(f.block){ctx.strokeStyle=c.color;ctx.lineWidth=3;ctx.globalAlpha=.5;ctx.beginPath();ctx.arc(8,-81,48,-1.7,.3);ctx.stroke();}
    ctx.restore();}
  function drawHUD(){const nameA=player.def.name,nameB=cpu.def.name;rect(44,28,355,20,'#090e11');rect(44,28,355*player.health/100,20,player.health>28?COLORS.cyan:COLORS.red);rect(561,28,355,20,'#090e11');rect(561+355*(1-cpu.health/100),28,355*cpu.health/100,20,cpu.health>28?COLORS.orange:COLORS.red);ctx.strokeStyle='#f2eee3';ctx.lineWidth=2;ctx.strokeRect(44,28,355,20);ctx.strokeRect(561,28,355,20);text(nameA,46,22,17,COLORS.paper);text(nameB,914,22,17,COLORS.paper,'right');text('ROUND '+round,480,25,11,COLORS.gold,'center');rect(443,31,74,40,'#12191d');ctx.strokeStyle='#c9d2c9';ctx.strokeRect(443,31,74,40);text(String(Math.ceil(timer)).padStart(2,'0'),480,61,28,COLORS.paper,'center');for(let i=0;i<2;i++){for(let j=0;j<wins[i];j++){ctx.fillStyle=i===0?COLORS.cyan:COLORS.orange;ctx.beginPath();ctx.arc(i===0?54+j*20:906-j*20,60,6,0,Math.PI*2);ctx.fill();}}
    button('Ⅱ',866,76,40,32,'pause');button(soundOn?'♪':'×',912,76,34,32,'sound');button('↻',820,76,38,32,'restart');}
  function drawTouchControls(){const circle=(x,y,r,label,pressed,col)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=pressed?'#f06c3b9e':'#10171b8c';ctx.fill();ctx.strokeStyle=pressed?'#ffb17d':'#869497aa';ctx.lineWidth=2;ctx.stroke();text(label,x,y+5,18,COLORS.paper,'center');};circle(64,455,35,'◀',touch.left,'');circle(142,455,35,'▶',touch.right,'');circle(103,398,31,'▲',touch.up);circle(103,493,29,'▼',touch.block);circle(833,454,34,'P',touch.punch);circle(909,411,34,'K',touch.kick);text('PUNCH',833,500,9,'#c7d0cd','center','Arial, sans-serif');text('KICK',909,457,9,'#c7d0cd','center','Arial, sans-serif');}
  function drawFight(){drawBackground();if(shake>0)ctx.save(),ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);drawFighter(player);drawFighter(cpu);if(shake>0)ctx.restore();drawHUD();drawTouchControls();if(flash>0){ctx.fillStyle=`rgba(255,255,255,${flash*1.6})`;ctx.fillRect(0,0,W,H);}}
  function drawOverlay(title,sub){rect(0,0,W,H,'#0b1112bb');rect(245,146,470,252,'#172126');ctx.strokeStyle=COLORS.orange;ctx.lineWidth=2;ctx.strokeRect(246,147,468,250);text(title,480,207,37,COLORS.paper,'center');text(sub,480,240,14,COLORS.muted,'center','Arial, sans-serif');}
  function drawPause(){drawFight();drawOverlay('PAUSED','TAKE A BREATH. THE CITY CAN WAIT.');button('RESUME',345,280,130,44,'resume',true);button('RESTART MATCH',485,280,140,44,'restart');button('MAIN MENU',405,339,150,38,'title');}
  function drawRoundEnd(){drawFight();const matchOver=wins[0]>=2||wins[1]>=2||round>=3;drawOverlay(matchMessage,matchOver?'BEST OF THREE • FINAL SCORE '+wins[0]+' — '+wins[1]:'BEST OF THREE • '+wins[0]+' — '+wins[1]);if(matchOver){const tied=wins[0]===wins[1];text(tied?'MATCH DRAW':wins[0]>=2?'YOU WIN THE MATCH':'CPU TAKES THE MATCH',480,273,20,tied?COLORS.gold:wins[0]>=2?COLORS.cyan:COLORS.orange,'center');button('REMATCH',350,308,125,42,'begin',true);button('CHARACTER SELECT',485,308,155,42,'select');}else{button('NEXT ROUND',390,308,180,42,'next',true);button('RESTART MATCH',400,358,160,33,'restart');}}
  function draw(){ctx.clearRect(0,0,W,H);menuHit=[];if(screen==='title')drawTitle();else if(screen==='help')drawHelp();else if(screen==='select')drawSelect();else if(screen==='stage')drawStageSelect();else if(screen==='fight')drawFight();else if(screen==='pause')drawPause();else if(screen==='roundend')drawRoundEnd();}
  function frame(now){const dt=Math.min(.033,(now-lastTime)/1000||0);lastTime=now;update(dt);draw();requestAnimationFrame(frame);}
  function action(name){switch(name){case 'title':screen='title';break;case 'help':screen='help';break;case 'select':screen='select';break;case 'stage':screen='stage';break;case 'begin':beginMatch();break;case 'next':nextRound();break;case 'pause':if(screen==='fight')screen='pause';else if(screen==='pause')screen='fight';break;case 'resume':screen='fight';break;case 'restart':beginMatch();break;case 'sound':soundOn=!soundOn;if(soundOn)beep(440,.07,'triangle');break;}}
  function point(e){const r=canvas.getBoundingClientRect();if(window.matchMedia('(max-aspect-ratio: 4/5)').matches){return {x:(e.clientY-r.top)*W/r.height,y:(r.right-e.clientX)*H/r.width};}return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
  function hitMenu(p){for(let i=menuHit.length-1;i>=0;i--){const b=menuHit[i];if(p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h){action(b.action);return true;}}return false;}
  function touchAt(p,on){touch.left=touch.right=touch.up=touch.block=touch.punch=touch.kick=false;if(!on)return;const points=[...pointers.values()];if(p.x!==undefined)points.push(p);
    for(const q of points){if(q.x<190&&q.y>350){if(q.y<435){if(q.x<97)touch.left=true;else if(q.x<178)touch.right=true;else touch.up=true;}else if(q.x<152)touch.block=true;}if(q.x>770&&q.y>360){if(q.y>430||q.x<870)touch.punch=true;if(q.x>870&&q.y<435)touch.kick=true;}}
  }
  function onPointerDown(e){e.preventDefault();canvas.setPointerCapture(e.pointerId);const p=point(e);pointers.set(e.pointerId,p);
    if(screen==='select'&&p.y>=165&&p.y<=430){const ix=Math.floor((p.x-43)/176);if(ix>=0&&ix<5){selected=ix;beep(280,.04,'triangle');return;}}
    if(screen==='stage'&&p.y>=175&&p.y<=410){const ix=Math.floor((p.x-76)/276);if(ix>=0&&ix<3){stageIndex=ix;beep(280,.04,'triangle');return;}}
    if(hitMenu(p))return;
    if(screen==='fight')touchAt(p,true);
  }
  function onPointerMove(e){if(!pointers.has(e.pointerId))return;const p=point(e);pointers.set(e.pointerId,p);if(screen==='fight')touchAt(p,true);}
  function onPointerUp(e){pointers.delete(e.pointerId);if(screen==='fight')touchAt([...pointers.values()][0]||{x:0,y:0},pointers.size>0);}
  canvas.addEventListener('pointerdown',onPointerDown);canvas.addEventListener('pointermove',onPointerMove);canvas.addEventListener('pointerup',onPointerUp);canvas.addEventListener('pointercancel',onPointerUp);canvas.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('keydown',e=>{keys[e.code]=true;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code))e.preventDefault();if(e.repeat)return;
    if(e.code==='Escape'||e.code==='KeyP'){if(screen==='fight')screen='pause';else if(screen==='pause')screen='fight';return;}
    if(screen==='title'&&(e.code==='Enter'||e.code==='Space'))screen='select';else if(screen==='help'&&e.code==='Enter')screen='title';else if(screen==='select'){if(e.code==='ArrowRight')selected=(selected+1)%5;else if(e.code==='ArrowLeft')selected=(selected+4)%5;else if(e.code==='Enter')screen='stage';}else if(screen==='stage'){if(e.code==='ArrowRight')stageIndex=(stageIndex+1)%3;else if(e.code==='ArrowLeft')stageIndex=(stageIndex+2)%3;else if(e.code==='Enter')beginMatch();}else if(screen==='pause'&&e.code==='Enter')screen='fight';else if(screen==='roundend'&&e.code==='Enter'){if(wins[0]>=2||wins[1]>=2||round>=3)beginMatch();else nextRound();}
  });window.addEventListener('keyup',e=>{keys[e.code]=false;});window.addEventListener('blur',()=>{for(const k in keys)keys[k]=false;touchAt({x:0,y:0},false);});
  requestAnimationFrame(frame);
})();
