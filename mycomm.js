// ===== Rep ownership, deal numbers (VNXT-1001…, permanent, never reused), My Commission, pipeline new-deal form
const REP={id:'austin',name:'Austin Stinson',short:'Austin'};
function ownCheck(){(D.customers||[]).forEach(c=>{if(!c.owner)c.owner=REP.id});(D.deals||[]).forEach(d=>{if(!d.owner)d.owner=REP.id})}
const mine=c=>(c.owner||REP.id)==REP.id;
function dealNo(x){const d=typeof x=='object'?x:D.deals.find(d=>d.id==x);return d&&d.no?'VNXT-'+d.no:''}
function numCheck(){if(!D.deals)return;if(!D.nextNo)D.nextNo=Math.max(1000,...D.deals.map(d=>d.no||0))+1;let ch=0;D.deals.slice().sort((a,b)=>a.id-b.id).forEach(d=>{if(!d.no){d.no=D.nextNo++;ch=1}});ownCheck();if(ch)save()}
const findByNo=n=>D.deals.find(d=>d.no==n);
const addM=(t,n)=>{const d=new Date(t);d.setMonth(d.getMonth()+n);return d.getTime()};
const mKey=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
const mLabel=k=>new Date(k+'-15T12:00').toLocaleDateString(undefined,{month:'short',year:'numeric'});
const fd=t=>new Date(t).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
function payouts(d){const c=comm(d),w=d.wonAt,p=[{t:w,kind:'up',amt:c.bonus+c.dep+c.build,d}];for(let i=1;i<=12;i++)p.push({t:addM(w,i),kind:'res',amt:c.res/12,d});return p}
function commData(){const now=Date.now(),won=D.deals.filter(d=>d.stage=='Won'&&d.wonAt&&(d.owner||REP.id)==REP.id),pays=won.flatMap(payouts);
 const paid=pays.filter(p=>p.t<=now),pend=pays.filter(p=>p.t>now).sort((a,b)=>a.t-b.t),thisM=mKey(now);
 const nextK=pend[0]&&mKey(pend[0].t),nextAmt=nextK?pend.filter(p=>mKey(p.t)==nextK).reduce((s,p)=>s+p.amt,0):0;
 const claw=won.filter(d=>now<d.wonAt+90*DAY).reduce((s,d)=>s+comm(d).clawback,0);
 return{won,pays,earned:paid.reduce((s,p)=>s+p.amt,0),resLeft:pend.filter(p=>p.kind=='res').reduce((s,p)=>s+p.amt,0),nextK,nextAmt,claw,thisMonth:pays.filter(p=>mKey(p.t)==thisM).reduce((s,p)=>s+p.amt,0)}}
const m0=n=>'$'+Math.round(+n||0).toLocaleString();
function mcView(){const x=commData(),now=Date.now(),months={},cur=mKey(now);
 x.pays.forEach(p=>{const k=mKey(p.t);(months[k]=months[k]||{up:0,res:0,deals:new Set()});months[k][p.kind]+=p.amt;months[k].deals.add(dealNo(p.d))});
 return`<div class="card dk"><h1>My Commission</h1><p class=tag>${REP.name} · your Won deals and what they pay you.</p>
<div class="kpi mck"><div>Earned to date<b>${m0(x.earned)}</b></div><div>Next payout<b>${m0(x.nextAmt)}</b><small>${x.nextK?mLabel(x.nextK):'—'}</small></div><div>Residuals left to collect<b>${m0(x.resLeft)}</b></div><div>In 90-day clawback window<b class=amb>${m0(x.claw)}</b></div></div>
<p class=hint>This month: <b style="color:#6fd0ff">${m0(x.thisMonth)}</b> · 🎙 Ask “what's my commission this month”.</p></div>
<div class="card dk"><h2>Won deals</h2>${x.won.sort((a,b)=>b.wonAt-a.wonAt).map(d=>{const c=comm(d),pd=payouts(d).filter(p=>p.t<=now).reduce((s,p)=>s+p.amt,0),cl=d.wonAt+90*DAY;return`<div class=mcd><div class=mct><span class=dno>${dealNo(d)}</span> <b onclick="openDeal(${d.id})" style=cursor:pointer>${esc(d.company)}</b><span class=mtot>${m0(c.total)}</span></div>
<small>Won ${fd(d.wonAt)} · Deposit ${m0(d.deposit)} · ${m0(d.value)}/mo${+d.fees?' · Fees '+m0(d.fees):''}</small>
<div class=mcr><span class=pd>Paid ${m0(pd)}</span><span class=pn>Pending ${m0(c.total-pd)}</span><span class="${now<cl?'cw':'cc2'}">${now<cl?'Clawback clears '+fd(cl):'✓ Clawback cleared'}</span></div>
<label class=chk><input type=checkbox data-nomic ${d.mult?'checked':''} onchange="mcMult(${d.id},this.checked)"> With multiplier (15% residual)</label></div>`}).join('')||'<p class=hint>No Won deals yet.</p>'}</div>
<div class="card dk"><h2>Payout schedule</h2><p class=hint>Signing bonus + deposit commission (+ build/add-on) pay in the month of the win, then the residual monthly for 12 months.</p>
<table class=mcs><tr><th>Month</th><th>Upfront</th><th>Residual</th><th>Total</th></tr>${Object.keys(months).sort().map(k=>{const m=months[k];return`<tr class="${k<cur?'paid':k==cur?'now':''}"><td>${mLabel(k)}<small>${[...m.deals].join(', ')}</small></td><td>${m.up?m0(m.up):'—'}</td><td>${m.res?m0(m.res):'—'}</td><td><b>${m0(m.up+m.res)}</b><small>${k<cur?'Paid':k==cur?'This month':'Pending'}</small></td></tr>`}).join('')}</table></div>`}
function mcMult(id,v){const d=D.deals.find(d=>d.id==id);d.mult=v;save();view('mycomm')}
function mcBackfill(){if(!D.deals)return;D.deals.forEach(d=>{if(d.stage=='Won'&&!d.wonAt){const s=(d.log||[]).find(l=>/sign|won|closed/i.test(l.x))||(d.log||[]).slice(-1)[0];d.wonAt=s?s.t:Date.now();d.askedT=1}});
 if(D.demo&&!D.seed3){D.seed3=1;const mk=(co,ct,v,dep,mult,days)=>{const c=custFor(co,ct);c.status='customer';const w=Date.now()-days*DAY;D.deals.push({id:w,contact:ct,company:co,customerId:c.id,stage:'Won',value:v,deposit:dep,fees:0,mult,nextStep:'Account Manager owns it',followUp:'',wonAt:w,askedT:1,log:[{t:w,x:'Signed agreement.'}]});c.log.push({id:uid(),type:'meeting',t:w,x:'Signing meeting.'})};
  mk('Lakeside Auto','Dan Price',250,1500,false,200);mk('Fielder Tree Service','Ray Fielder',400,2500,true,75)}
 stBackfill();numCheck();save()}
// ---- voice
const _command3=command;
command=function(t){const n=wordsToNum(t),l=n.toLowerCase().trim();let m;
 if(/(what'?s|what is|how much|show|tell me).*\bcommission/.test(l)){const x=commData();const msg=`Your commission this month is ${money(x.thisMonth)}. Earned to date ${money(x.earned)}, ${money(x.claw)} still in the clawback window.`;speak(msg);toast(msg);view('mycomm');return true}
 if(m=l.match(/^(?:move|mark|set|change)\s+deal\s+(?:number\s+|#\s*)?(?:vnxt-?\s*)?(\d{3,6})\s+(?:to|as)\s+(target|prospect|lead|demo|proposal|won|lost|closed won|closed lost)/)){const d=findByNo(+m[1]);if(!d){toast('No deal VNXT-'+m[1]);return true}const s=/target|prospect/.test(m[2])?'Target':m[2].includes('lost')?'Lost':m[2].includes('won')?'Won':m[2][0].toUpperCase()+m[2].slice(1);d.stage=s;d.log.unshift({t:Date.now(),x:'Stage moved to '+s+' by voice.'});save();speak(`Moved deal ${d.no}, ${d.company}, to ${s}`);toast(`✔ ${dealNo(d)} ${d.company} → ${s}`);view('pipe');return true}
 if(m=l.match(/^(?:open|show|pull up|go to)\s+deal\s+(?:number\s+|#\s*)?(?:vnxt-?\s*)?(\d{3,6})/)){const d=findByNo(+m[1]);if(!d){toast('No deal VNXT-'+m[1]);return true}speak(`Opening deal ${d.no}, ${d.company}`);openDeal(d.id);return true}
 return _command3(t)};
// ---- pipeline new-deal form
const NEXTS=['Discovery call','Cold call','Product demo','Send proposal','Send agreement','Follow-up call','Meeting','Kickoff with Account Manager'];
function newDealForm(stage){stage=stage||'Lead';const f=$('#ndf');if(!f)return;const accts=D.customers.filter(mine);
 f.innerHTML=`<div class="card ndcard"><div class=calbar><h2 style="margin:0">＋ New deal</h2><button class="btn g sm" onclick="$('#ndf').innerHTML=''">✕</button></div><div class=ex>
<div><label>Target or customer</label><input id=n_acct list=nd_list placeholder="Pick or type a new company"><datalist id=nd_list>${accts.map(c=>`<option value="${esc(c.name)}">${acctSt(c)=='customer'?'My Customer':'Target'}</option>`).join('')}</datalist></div>
<div id=n_newwrap style="display:none"><label>New account is a</label><select id=n_newst><option value=target>🎯 Target</option><option value=customer>⭐ My Customer</option></select></div>
<div><label>Contact</label><input id=n_contact list=nd_contacts placeholder="Name"><datalist id=nd_contacts></datalist></div>
<div><label>Stage</label><select id=n_stage>${STAGES.map(s=>`<option ${s==stage?'selected':''}>${s}</option>`).join('')}</select></div>
<div><label>Next step</label>${nextSelect('n_next','')}</div><div><label>Close %</label><input id=n_prob type=number min=0 max=100 inputmode=numeric placeholder="${Math.round(PROB[stage]*100)} (stage default)"></div>
<div><label>Follow-up date</label><input id=n_fu type=date value="${addD(2)}"></div></div>
<h2 style="margin-top:14px">💰 Your commission</h2>${calcBox('n',{})}<p class=hint>A deal number (VNXT-${D.nextNo}) is assigned when you save.</p><button class=btn id=n_save>✔ Create deal</button></div>`;wireCalc('n');
 const chk=()=>{const c=cust($('#n_acct').value.trim());$('#n_newwrap').style.display=c||!$('#n_acct').value.trim()?'none':'';$('#nd_contacts').innerHTML=c?c.contacts.map(p=>`<option value="${esc(p.name)}">`).join(''):'';if(c&&!$('#n_contact').value&&c.contacts[0])$('#n_contact').value=c.contacts[0].name};$('#n_acct').oninput=chk;
 $('#n_save').onclick=()=>{const name=$('#n_acct').value.trim();if(!name){toast('Pick or enter a target or customer');$('#n_acct').focus();return}const isNew=!cust(name),c=custFor(name,$('#n_contact').value.trim());if(isNew){c.status=$('#n_newst').value;c.owner=REP.id}const v=calcVals('n');
  const d={id:Date.now(),owner:REP.id,contact:$('#n_contact').value.trim()||c.contacts[0]?.name||'',company:c.name,customerId:c.id,stage:$('#n_stage').value,value:v.value,deposit:v.deposit,fees:v.fees,mult:v.mult,nextStep:$('#n_next').value,prob:$('#n_prob').value===''?null:Math.max(0,Math.min(100,+$('#n_prob').value))/100,followUp:$('#n_fu').value,log:[{t:Date.now(),x:'Deal created.'}]};D.deals.push(d);numCheck();c.log.push({id:uid(),type:'note',t:Date.now(),x:`New deal ${dealNo(d)} created (${d.stage}).`});save();view('pipe');toast(`✔ ${dealNo(d)} created for ${c.name}`)};
 f.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>$('#n_acct').focus(),200)}
// ---- render hooks
const _view4=view;
view=function(v){numCheck();if(v=='mycomm'){_view4('voice');document.body.classList.add('dark');document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('on',a.dataset.v==v));app.innerHTML=mcView();scrollTo(0,0);return}
 _view4(v);
 if(v=='pipe'){document.querySelectorAll('.board .deal').forEach(el=>{const id=+(el.getAttribute('onclick').match(/\d+/)||[])[0],d=D.deals.find(d=>d.id==id);if(d){el.insertAdjacentHTML('afterbegin',`<span class=dno>${dealNo(d)}</span><br>`);el.dataset.q=(dealNo(d)+' '+d.no+' '+d.company+' '+d.contact).toLowerCase()}});
  document.querySelectorAll('.board .col').forEach(col=>{const s=col.dataset.s;col.querySelector('h3').insertAdjacentHTML('afterbegin',`<button class=colplus title="New ${s} deal" aria-label="New ${s} deal" onclick="newDealForm('${s}')">＋</button>`)});
  $('.board').insertAdjacentHTML('beforebegin',`<div class=pbar><button class="btn ndbtn" onclick="newDealForm()">＋ New deal</button><input id=pq placeholder="Search deals: VNXT-1003, 1003, company or contact…"></div><div id=ndf></div>`);$('#pq').oninput=e=>{const q=e.target.value.toLowerCase().trim();document.querySelectorAll('.board .deal').forEach(el=>el.style.display=!q||el.dataset.q.includes(q)?'':'none')}}};
const _od4=openDeal;openDeal=function(id){numCheck();_od4(id);const d=D.deals.find(d=>d.id==id);const h=document.querySelector('#app h1');if(d&&h)h.insertAdjacentHTML('beforebegin',`<span class="dno big">${dealNo(d)}</span>`)};
mcBackfill();
// ---- Pipeline summary bar + stage totals (live with search)
const PROB={Target:.05,Lead:.1,Demo:.3,Proposal:.6,Won:1,Lost:0};
const dealVal=d=>(+d.deposit||0)+(+d.fees||0)+(+d.value||0)*12;
function pipeSum(){const vis=[...document.querySelectorAll('.board .deal')].filter(e=>e.style.display!='none').map(e=>D.deals.find(d=>d.id==+(e.getAttribute('onclick').match(/\d+/)||[])[0])).filter(Boolean);
 const open=vis.filter(d=>!['Won','Lost'].includes(d.stage)),S=f=>open.reduce((s,d)=>s+f(d),0);
 const sb=$('#psum');if(sb)sb.innerHTML=[['Open pipeline',m0(S(dealVal))],['Weighted',m0(S(d=>dealVal(d)*probFor(d)))],['Monthly recurring',m0(S(d=>+d.value||0))+'/mo'],['Deposits',m0(S(d=>+d.deposit||0))],['Expected commission',m0(S(d=>comm(d).total*probFor(d)))],['Deals',open.length+' open · '+vis.length+' shown']].map(([k,v])=>`<div><small>${k}</small><b>${v}</b></div>`).join('');
 document.querySelectorAll('.board .col').forEach(col=>{const ds=vis.filter(d=>d.stage==col.dataset.s);let t=col.querySelector('.ctot');if(!t){col.querySelector('h3').insertAdjacentHTML('afterend','<div class=ctot></div>');t=col.querySelector('.ctot')}t.innerHTML=`<b>${m0(ds.reduce((s,d)=>s+dealVal(d),0))}</b> · ${ds.length} deal${ds.length==1?'':'s'}`})}
const _view5=view;view=function(v){_view5(v);if(v=='pipe'){$('.pbar').insertAdjacentHTML('beforebegin','<div class=psum id=psum></div><p class=hint style="margin:-6px 0 10px">Deal value = deposit + build fees + 12 × monthly. Weighted by each deal&rsquo;s close % (stage defaults: Target 5%, Lead 10%, Demo 30%, Proposal 60%). Totals cover open deals.</p>');const q=$('#pq'),o=q.oninput;q.oninput=e=>{o(e);pipeSum()};pipeSum()}};
