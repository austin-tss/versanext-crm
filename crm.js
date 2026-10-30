// ===== VNXT CRM v2: Customers, comm log, calendar, commission calculator
const DAY=864e5,uid=()=>Date.now()+Math.floor(Math.random()*1e6);
const TYPES={call:'📞 Call',email:'✉️ Email',meeting:'🤝 Meeting',note:'📝 Note'};
const ETYPES={demo:'Demo',meeting:'Meeting',call:'Call',followup:'Follow-up'};
function ensure(){if(!D.deals)D.deals=[];if(!D.events)D.events=[];if(!D.customers){D.customers=[];
 D.deals.forEach(d=>{const c=custFor(d.company,d.contact);d.customerId=c.id;(d.log||[]).forEach(l=>c.log.push({id:uid(),type:/call/i.test(l.x)?'call':/meet|demo/i.test(l.x)?'meeting':/email/i.test(l.x)?'email':'note',t:l.t,x:l.x}))});
 if(D.demo){const ago=(n,h)=>Date.now()-DAY*n-(h||0)*36e5,add=(co,type,n,x)=>{const c=D.customers.find(c=>c.name==co);if(c)c.log.push({id:uid(),type,t:ago(n,2),x})};
  add('Acme Logistics','email',4,'Sent capabilities deck to Sarah.');add('Acme Logistics','call',3,'Discovery call. Wants a dispatch app, budget ~$300/mo.');
  add('Riverbend Dental','call',1,'Left voicemail, Mark called back. Booking discovery.');add('Southside Builders','meeting',8,'Demo on site with Tina and her PM.');
  add('Southside Builders','email',9,'Confirmed demo time.');add('Peach State Realty','meeting',2,'Signing meeting. Agreement executed.');add('Harbor Cafe','call',16,'Final call. Going in-house for now.');
  const dt=n=>addD(n);D.events.push({id:uid(),type:'demo',title:'Product demo',date:dt(0),time:'14:00',customerId:cust('Acme Logistics')?.id,dealId:1},{id:uid(),type:'meeting',title:'Kickoff with Account Manager',date:dt(1),time:'10:00',customerId:cust('Peach State Realty')?.id,dealId:4},{id:uid(),type:'call',title:'Discovery call',date:dt(2),time:'11:30',customerId:cust('Riverbend Dental')?.id,dealId:2})}
 save()}
 D.customers.forEach(c=>{c.contacts=c.contacts||[];c.log=c.log||[]});D.deals.forEach(d=>{if(!d.customerId){d.customerId=custFor(d.company,d.contact).id}})}
function cust(n){n=(n||'').toLowerCase();return D.customers.find(c=>c.name.toLowerCase()==n)}
const custById=id=>D.customers.find(c=>c.id==id);
function custFor(name,contact){name=name||'Unknown company';let c=cust(name);if(!c){c={id:uid(),name,phone:'',email:'',address:'',contacts:[],log:[]};D.customers.push(c)}if(contact&&!c.contacts.some(p=>p.name.toLowerCase()==contact.toLowerCase()))c.contacts.push({id:uid(),name:contact,title:'',email:'',phone:''});return c}
const guessType=t=>/\b(called|call|phone|voicemail|rang)\b/i.test(t)?'call':/\b(email|emailed|e-mail)\b/i.test(t)?'email':/\b(met|meeting|meet|demo|lunch|coffee|visit)\b/i.test(t)?'meeting':'note';
function linkCust(d,text,type){const c=custFor(d.company,d.contact);d.customerId=c.id;if(text)c.log.push({id:uid(),type:type||guessType(text),t:Date.now(),x:text});return c}
const lastContact=c=>c.log.reduce((m,l)=>Math.max(m,l.t),0);
function ago(t){if(!t)return'never';const n=Math.floor((Date.now()-t)/DAY);return n<=0?'today':n==1?'yesterday':n+' days ago'}
function stale(t){const n=t?(Date.now()-t)/DAY:999;return n>=14?'red':n>=7?'amber':'ok'}
const fmtT=s=>{if(!s)return'All day';let[h,m]=s.split(':').map(Number);return(h%12||12)+(m?':'+String(m).padStart(2,'0'):'')+(h<12?' AM':' PM')};
// ---- Commission UI (shared)
function calcBox(p,v,big){v=v||{};return`<div class="calc ${big?'big':''}"><div class=ex>
<div><label>Deposit ($)</label><input id=${p}_dep type=number inputmode=decimal value="${v.deposit||''}" placeholder=0></div>
<div><label>Monthly fee ($)</label><input id=${p}_mo type=number inputmode=decimal value="${v.value||''}" placeholder=0></div>
<div><label>Build / add-on fees ($)</label><input id=${p}_fee type=number inputmode=decimal value="${v.fees||''}" placeholder=0></div></div>
<label class=chk><input type=checkbox id=${p}_mult ${v.mult?'checked':''}> With multiplier (15% residual)</label><div id=${p}_out></div></div>`}
function calcVals(p){return{deposit:+$('#'+p+'_dep').value||0,value:+$('#'+p+'_mo').value||0,fees:+$('#'+p+'_fee').value||0,mult:$('#'+p+'_mult').checked}}
function wireCalc(p){const r=()=>{const v=calcVals(p),c=calc({deposit:v.deposit,monthly:v.value,fees:v.fees,mult:v.mult});$('#'+p+'_out').innerHTML=`<table class=ct>
<tr><td>Signing bonus <small>100% of month 1</small></td><td>${money(c.bonus)}</td></tr>
<tr><td>Deposit commission <small>15% of deposit</small></td><td>${money(c.dep)}</td></tr>
<tr><td>Residual <small>${c.rate*100}% × monthly × 12</small></td><td>${money(c.res)}</td></tr>
<tr><td>Build / add-on <small>10% of fees</small></td><td>${money(c.build)}</td></tr>
<tr class=tot><td>Total year-one commission</td><td>${money(c.total)}</td></tr></table>
<p class=claw>⚠️ 90-day clawback: <b>${money(c.clawback)}</b> <small>(signing bonus + deposit commission) comes back out of your next check if the client cancels or stops paying within 90 days.</small></p>`};
 ['dep','mo','fee','mult'].forEach(k=>{const e=$('#'+p+'_'+k);e.oninput=e.onchange=r});r()}
// ---- New-deal review form (voice) with live calculator
showReview=function(x){$('#rev').innerHTML=`<div class=card><h2>✨ AI captured this. Tap to fix anything, then save</h2><div class=ex>
<div><label>Contact</label><input id=r_contact value="${esc(x.contact)}"></div><div><label>Customer</label><input id=r_company list=custlist value="${esc(x.company)}"><datalist id=custlist>${D.customers.map(c=>`<option value="${esc(c.name)}">`).join('')}</datalist></div>
<div><label>Stage</label><select id=r_stage>${STAGES.map(s=>`<option ${s==x.stage?'selected':''}>${s}</option>`).join('')}</select></div>
<div><label>Follow-up date</label><input id=r_followUp type=date value="${x.followUp}"></div><div><label>Log as</label><select id=r_type>${Object.entries(TYPES).map(([k,l])=>`<option value=${k} ${k==guessType(x.note)?'selected':''}>${l}</option>`).join('')}</select></div></div>
<label>Next step</label><input id=r_nextStep value="${esc(x.nextStep)}"><label>Note</label><textarea id=r_note rows=2>${esc(x.note)}</textarea>
<h2 style="margin-top:14px">💰 Your commission</h2>${calcBox('r',{deposit:x.deposit,value:x.value,fees:x.fees})}
<button class=btn id=sv>✔ Save to CRM</button> <button class="btn g" onclick="$('#rev').innerHTML=''">Discard</button></div>`;wireCalc('r');
 $('#sv').onclick=()=>{const g=k=>$('#r_'+k).value,cv=calcVals('r');let d=D.deals.find(d=>d.company.toLowerCase()==g('company').toLowerCase()&&!['Won','Lost'].includes(d.stage))||D.deals.find(d=>d.company.toLowerCase()==g('company').toLowerCase());const isNew=!d;if(!d){d={id:Date.now(),log:[]};D.deals.push(d)}
 Object.assign(d,{contact:g('contact')||d.contact,company:g('company')||'Unknown company',stage:g('stage'),value:cv.value,deposit:cv.deposit||d.deposit||0,fees:cv.fees,mult:cv.mult,nextStep:g('nextStep'),followUp:g('followUp')});d.log.unshift({t:Date.now(),x:g('note')});linkCust(d,g('note'),g('type'));save();$('#rev').innerHTML='';$('#tx').value='';finalTx='';toast(`✔ ${isNew?'New deal':'Updated'}: ${d.company} · logged to customer`);speak(`Saved. ${d.company}, follow up ${d.followUp}`)}};
// ---- Voice: notes also hit the customer log; scheduling by voice
const _command=command;
command=function(t){const l=t.toLowerCase();
 if(/^(schedule|book|set up|setup|add|put|create)\b/.test(l)&&/\b(demo|meeting|call|follow[- ]?up)\b/.test(l)){const ev=parseEvent(t);if(!ev.customerId){toast('Which customer? Try: schedule a demo with Acme Tuesday at 2');return true}
  D.events.push(ev);save();const c=custById(ev.customerId);const msg=`${ETYPES[ev.type]} with ${c.name} on ${new Date(ev.date+'T12:00').toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})} at ${fmtT(ev.time)}`;speak('Scheduled. '+msg);toast('📅 '+msg);cal.date=ev.date;cal.mode='day';view('calendar');return true}
 const m=t.match(/^(?:add (?:a )?note to|note for|log (?:a )?note (?:on|for))\s+([^:,.-]+?)(?:[:,.-]|\s+that\s|\s+saying\s)\s*(.+)$/i);
 if(m){const d=findCompany(m[1]);if(d)linkCust(d,m[2])}return _command(t)};
function findCust(t){const l=t.toLowerCase();return D.customers.find(c=>l.includes(c.name.toLowerCase()))||D.customers.find(c=>new RegExp('\\b'+c.name.split(' ')[0].toLowerCase().replace(/[^\w]/g,'')+'\\b').test(l))}
function parseEvent(t){const l=t.toLowerCase(),type=/demo/.test(l)?'demo':/meeting|meet/.test(l)?'meeting':/follow/.test(l)?'followup':'call';const c=findCust(t);
 let time='';const m=l.match(/\bat (\d{1,2})(?::(\d\d))?\s*(a\.?m\.?|p\.?m\.?)?/)||l.match(/\b(\d{1,2})(?::(\d\d))?\s*(a\.?m\.?|p\.?m\.?)/);if(m){let h=+m[1];const ap=m[3]||'';if(/p/.test(ap)&&h<12)h+=12;else if(/a/.test(ap)&&h==12)h=0;else if(!ap&&h<8)h+=12;time=String(h).padStart(2,'0')+':'+(m[2]||'00')}
 const d=c&&D.deals.find(d=>d.customerId==c.id&&!['Won','Lost'].includes(d.stage));
 return{id:uid(),type,title:ETYPES[type]+(c?' with '+c.name:''),date:parseDate(t.replace(/\bat \d.*$/i,''))||parseDate(t)||iso(new Date()),time:time||'09:00',customerId:c?.id,dealId:d?.id}}
// ---- Calendar
const cal={mode:'week',date:iso(new Date())};
function allEvents(){const ev=D.events.map(e=>({...e}));D.deals.filter(d=>d.followUp&&!['Won','Lost'].includes(d.stage)).forEach(d=>ev.push({id:'f'+d.id,type:'followup',title:d.nextStep||'Follow up',date:d.followUp,time:'',customerId:d.customerId,dealId:d.id,derived:1}));return ev.sort((a,b)=>(a.date+(a.time||'00')).localeCompare(b.date+(b.time||'00')))}
const evOn=ds=>allEvents().filter(e=>e.date==ds);
function chip(e){const c=custById(e.customerId);return`<div class="ev t-${e.type}" onclick="event.stopPropagation();openEv('${e.id}')"><b>${e.time?fmtT(e.time):'Due'}</b> ${esc(ETYPES[e.type])}${c?' · '+esc(c.name):''}<small>${esc(e.title)}</small></div>`}
function openEv(id){const e=allEvents().find(e=>String(e.id)==String(id));if(!e)return;if(e.dealId&&D.deals.some(d=>d.id==e.dealId))openDeal(e.dealId);else if(e.customerId)openCust(e.customerId)}
const shift=(ds,n)=>{const d=new Date(ds+'T12:00');d.setDate(d.getDate()+n);return iso(d)};
function calNav(n){cal.date=n==0?iso(new Date()):shift(cal.date,n*(cal.mode=='day'?1:cal.mode=='week'?7:0));if(cal.mode=='month'&&n){const d=new Date(cal.date+'T12:00');d.setMonth(d.getMonth()+n);cal.date=iso(d)}view('calendar')}
function addEvForm(date,time){const f=$('#evf');f.innerHTML=`<div class=card><h2>New event</h2><div class=ex><div><label>Type</label><select id=ev_type>${Object.entries(ETYPES).map(([k,v])=>`<option value=${k}>${v}</option>`).join('')}</select></div>
<div><label>Customer</label><select id=ev_cust><option value="">—</option>${D.customers.map(c=>`<option value=${c.id}>${esc(c.name)}</option>`).join('')}</select></div><div><label>Deal</label><select id=ev_deal><option value="">—</option>${D.deals.map(d=>`<option value=${d.id}>${esc(d.company)} · ${d.stage}</option>`).join('')}</select></div>
<div><label>Date</label><input id=ev_date type=date value=${date}></div><div><label>Time</label><input id=ev_time type=time value=${time||'09:00'}></div><div><label>Title</label><input id=ev_title placeholder="e.g. Product demo"></div></div><br>
<button class=btn id=ev_s>Add to calendar</button> <button class="btn g" onclick="$('#evf').innerHTML=''">Cancel</button></div>`;
 $('#ev_deal').onchange=()=>{const d=D.deals.find(d=>d.id==$('#ev_deal').value);if(d)$('#ev_cust').value=d.customerId};
 $('#ev_s').onclick=()=>{const type=$('#ev_type').value,cid=+$('#ev_cust').value||undefined,c=custById(cid);D.events.push({id:uid(),type,title:$('#ev_title').value||ETYPES[type]+(c?' with '+c.name:''),date:$('#ev_date').value,time:$('#ev_time').value,customerId:cid,dealId:+$('#ev_deal').value||undefined});save();toast('📅 Added');view('calendar')};f.scrollIntoView({behavior:'smooth'})}
function calView(){const t=iso(new Date()),d0=new Date(cal.date+'T12:00');let body='',title='';
 if(cal.mode=='day'){title=d0.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});const ev=evOn(cal.date);
  body=`<div class=dayv>${ev.filter(e=>!e.time).map(chip).join('')}${Array.from({length:13},(_,i)=>i+7).map(h=>{const hh=String(h).padStart(2,'0');return`<div class=slot onclick="addEvForm('${cal.date}','${hh}:00')"><span>${fmtT(hh+':00')}</span><div>${ev.filter(e=>e.time&&e.time.slice(0,2)==hh).map(chip).join('')}</div></div>`}).join('')}</div>`}
 else if(cal.mode=='week'){const s=shift(cal.date,-((d0.getDay()+6)%7));title='Week of '+new Date(s+'T12:00').toLocaleDateString(undefined,{month:'short',day:'numeric'});
  body=`<div class=weekv>${Array.from({length:7},(_,i)=>shift(s,i)).map(ds=>{const dd=new Date(ds+'T12:00');return`<div class="wd ${ds==t?'now':''}" onclick="addEvForm('${ds}','09:00')"><div class=wh onclick="event.stopPropagation();cal.mode='day';cal.date='${ds}';view('calendar')"><b>${dd.toLocaleDateString(undefined,{weekday:'short'})}</b><span>${dd.getDate()}</span></div><div class=we>${evOn(ds).map(chip).join('')||'<small class=hint>Tap to add</small>'}</div></div>`}).join('')}</div>`}
 else{const y=d0.getFullYear(),mo=d0.getMonth(),first=new Date(y,mo,1,12),st=shift(iso(first),-((first.getDay()+6)%7));title=first.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  body=`<div class=monv>${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>`<div class=mh>${x}</div>`).join('')}${Array.from({length:42},(_,i)=>shift(st,i)).map(ds=>{const e=evOn(ds),dd=new Date(ds+'T12:00');return`<div class="md ${dd.getMonth()!=mo?'oth':''} ${ds==t?'now':''}" onclick="cal.mode='day';cal.date='${ds}';view('calendar')"><span>${dd.getDate()}</span>${e.slice(0,3).map(x=>`<i class="dot t-${x.type}" title="${esc(x.title)}"></i>`).join('')}${e.length>3?'<small>+'+(e.length-3)+'</small>':''}</div>`}).join('')}</div>`}
 return`<div class=card><div class=calbar><div class=seg>${['day','week','month'].map(m=>`<a class="${cal.mode==m?'on':''}" onclick="cal.mode='${m}';view('calendar')">${m[0].toUpperCase()+m.slice(1)}</a>`).join('')}</div><div><button class="btn g sm" onclick=calNav(-1)>‹</button> <button class="btn g sm" onclick=calNav(0)>Today</button> <button class="btn g sm" onclick=calNav(1)>›</button></div></div>
<h2>${title}</h2><p class=hint>🎙 Say “schedule a demo with Acme Tuesday at 2” on the Voice tab, or tap a ${cal.mode=='day'?'time slot':'day'} to add.</p>
<div class=legend>${Object.entries(ETYPES).map(([k,v])=>`<span><i class="dot t-${k}"></i>${v}</span>`).join('')}</div>${body}</div><div id=evf></div>`}
// ---- Customers
function custList(q){q=(q||'').toLowerCase();const cs=D.customers.filter(c=>!q||(c.name+' '+c.contacts.map(p=>p.name).join(' ')).toLowerCase().includes(q)).sort((a,b)=>lastContact(b)-lastContact(a));
 return cs.map(c=>{const lc=lastContact(c),ds=D.deals.filter(d=>d.customerId==c.id),op=ds.filter(d=>!['Won','Lost'].includes(d.stage));return`<div class=cust onclick="openCust(${c.id})"><div><b>${esc(c.name)}</b><small>${esc(c.contacts.map(p=>p.name).join(', ')||'No contacts yet')}</small></div><div class=cr><span class="lc ${stale(lc)}">Last contact: ${ago(lc)}</span><small>${op.length} open · ${ds.length} deal${ds.length==1?'':'s'}</small></div></div>`}).join('')||'<p class=hint>No customers found.</p>'}
function newCust(){const n=prompt('Customer (company) name?');if(!n||!n.trim())return;if(cust(n.trim())){openCust(cust(n.trim()).id);return}const c=custFor(n.trim());save();openCust(c.id)}
function openCust(id){const c=custById(id);if(!c)return view('customers');document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('on',a.dataset.v=='customers'));const ds=D.deals.filter(d=>d.customerId==c.id),lc=lastContact(c);
 const evs=allEvents().filter(e=>e.customerId==c.id&&e.date>=iso(new Date())).slice(0,5);
 app.innerHTML=`<p><a class=bk onclick="view('customers')">← Customers</a></p><div class=card><div class=calbar><div><h1>${esc(c.name)}</h1><span class="lc ${stale(lc)}">Last contact: ${ago(lc)}</span></div><button class=btn id=nd>＋ New deal</button></div>
<div class=ex><div><label>Company name</label><input id=c_name value="${esc(c.name)}"></div><div><label>Main phone</label><input id=c_phone type=tel value="${esc(c.phone)}"></div><div><label>Main email</label><input id=c_email type=email value="${esc(c.email)}"></div></div><label>Address</label><input id=c_address value="${esc(c.address)}"><br><br><button class="btn g" id=cs>Save customer</button></div>
<div class=card><h2>Contacts</h2><div id=cts>${c.contacts.map((p,i)=>`<div class=ex style="margin-bottom:8px"><div><label>Name</label><input data-i=${i} data-k=name value="${esc(p.name)}"></div><div><label>Title</label><input data-i=${i} data-k=title value="${esc(p.title)}"></div><div><label>Phone / email</label><input data-i=${i} data-k=phone value="${esc(p.phone||p.email)}"></div></div>`).join('')||'<p class=hint>No contacts yet.</p>'}</div><button class="btn g" id=ac>＋ Add contact</button> <button class=btn id=sc>Save contacts</button></div>
<div class=card><h2>Deals</h2>${ds.map(d=>`<div class=deal onclick="openDeal(${d.id})"><b>${d.stage}</b> · ${esc(d.contact)} · <span class=m>${money(d.value)}/mo</span> · <span class=m>💰 ${money(comm(d).total)}</span><br><small>Next: ${esc(d.nextStep)} · ${d.followUp}</small></div>`).join('')||'<p class=hint>No deals yet. Tap “New deal”.</p>'}
${evs.length?'<h2 style="margin-top:12px">Upcoming</h2>'+evs.map(chip).join(''):''}</div>
<div class=card><h2>Communication log</h2><div class=ex style="grid-template-columns:auto 1fr"><select id=l_type style="width:auto">${Object.entries(TYPES).map(([k,v])=>`<option value=${k}>${v}</option>`).join('')}</select><input id=l_when type=datetime-local value="${dtl(Date.now())}"></div><textarea id=l_x rows=2 placeholder="What happened?" style="margin-top:8px"></textarea><br><br><button class=btn id=la>Add entry</button>
<div class=tl style="margin-top:14px">${c.log.slice().sort((a,b)=>b.t-a.t).map(l=>`<div class=le id=le_${l.id}><span class="lt ${l.type}">${TYPES[l.type]||l.type}</span> ${esc(l.x)}<br><small>${new Date(l.t).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})} · <a onclick="editLog(${c.id},${l.id})">Edit</a></small></div>`).join('')||'<p class=hint>No entries yet.</p>'}</div></div>`;
 $('#nd').onclick=()=>{const d={id:Date.now(),contact:c.contacts[0]?.name||'',company:c.name,customerId:c.id,stage:'Lead',value:0,deposit:0,fees:0,mult:false,nextStep:'Discovery call',followUp:addD(2),log:[{t:Date.now(),x:'Deal created from customer.'}]};D.deals.push(d);save();toast('✔ New deal for '+c.name);openDeal(d.id)};
 $('#cs').onclick=()=>{const old=c.name;['name','phone','email','address'].forEach(k=>c[k]=$('#c_'+k).value.trim());if(!c.name)c.name=old;D.deals.forEach(d=>{if(d.customerId==c.id)d.company=c.name});save();toast('✔ Customer saved');openCust(id)};
 const readC=()=>document.querySelectorAll('#cts input').forEach(e=>{const p=c.contacts[e.dataset.i];if(e.dataset.k=='phone'){if(/@/.test(e.value)){p.email=e.value;p.phone=''}else{p.phone=e.value}}else p[e.dataset.k]=e.value});
 $('#ac').onclick=()=>{readC();c.contacts.push({id:uid(),name:'',title:'',phone:'',email:''});save();openCust(id)};$('#sc').onclick=()=>{readC();c.contacts=c.contacts.filter(p=>p.name.trim());save();toast('✔ Contacts saved');openCust(id)};
 $('#la').onclick=()=>{const x=$('#l_x').value.trim();if(!x)return;c.log.push({id:uid(),type:$('#l_type').value,t:new Date($('#l_when').value).getTime()||Date.now(),x});save();toast('✔ Logged');openCust(id)};scrollTo(0,0)}
const dtl=t=>{const d=new Date(t);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)};
function editLog(cid,lid){const c=custById(cid),l=c.log.find(l=>l.id==lid),el=$('#le_'+lid);el.innerHTML=`<select id=x_type>${Object.entries(TYPES).map(([k,v])=>`<option value=${k} ${k==l.type?'selected':''}>${v}</option>`).join('')}</select><input id=x_when type=datetime-local value="${dtl(l.t)}" style="margin-top:6px"><textarea id=x_x rows=2 style="margin-top:6px">${esc(l.x)}</textarea><button class="btn sm" id=x_s>Save</button> <button class="btn g sm" id=x_d>Delete</button>`;
 $('#x_s').onclick=()=>{l.type=$('#x_type').value;l.t=new Date($('#x_when').value).getTime()||l.t;l.x=$('#x_x').value;save();openCust(cid)};$('#x_d').onclick=()=>{if(confirm('Delete this entry?')){c.log=c.log.filter(x=>x!==l);save();openCust(cid)}}}
// ---- Deal page (replaces old commission display)
openDeal=function(id){const d=D.deals.find(d=>d.id==id);if(!d)return;const c=custById(d.customerId);document.querySelectorAll('nav a').forEach(a=>a.classList.remove('on'));
 app.innerHTML=`<p><a class=bk onclick="view('pipe')">← Pipeline</a>${c?` · <a class=bk onclick="openCust(${c.id})">${esc(c.name)} →</a>`:''}</p><div class=card><h1>${esc(d.company)}</h1><p class=tag>${esc(d.contact)} · ${d.stage}</p><div class=ex>
<div><label>Stage</label><select id=e_stage>${STAGES.map(s=>`<option ${s==d.stage?'selected':''}>${s}</option>`).join('')}</select></div><div><label>Contact</label><input id=e_contact value="${esc(d.contact)}"></div><div><label>Follow-up</label><input id=e_followUp type=date value=${d.followUp}></div></div><label>Next step</label><input id=e_nextStep value="${esc(d.nextStep)}">
<h2 style="margin-top:16px">💰 Your commission on this deal</h2>${calcBox('e',d)}<p class=hint>${d.stage=='Won'?'Earned once the client pays.':'Potential, if this deal closes.'}</p><button class=btn id=es>Save</button> <button class="btn g" id=ed>Delete deal</button></div>
<div class=card><h2>Deal activity</h2><div style="display:flex;gap:8px;margin-bottom:12px"><input id=nn placeholder="Add a note (also logs to the customer)…"><button class=btn id=na>Add</button></div><div class=tl>${d.log.map(l=>`<div>${esc(l.x)}<br><small>${new Date(l.t).toLocaleString()}</small></div>`).join('')}</div></div>`;wireCalc('e');
 $('#es').onclick=()=>{['stage','contact','nextStep','followUp'].forEach(k=>d[k]=$('#e_'+k).value);const v=calcVals('e');Object.assign(d,{value:v.value,deposit:v.deposit,fees:v.fees,mult:v.mult});if(c&&d.contact)custFor(c.name,d.contact);d.log.unshift({t:Date.now(),x:'Deal updated.'});save();toast('✔ Saved');openDeal(id)};
 $('#ed').onclick=()=>{if(confirm('Delete '+d.company+'?')){D.deals=D.deals.filter(x=>x!==d);D.events=D.events.filter(e=>e.dealId!=d.id);save();view('pipe')}};$('#na').onclick=()=>{const v=$('#nn').value.trim();if(v){d.log.unshift({t:Date.now(),x:v});linkCust(d,v,'note');save();openDeal(id)}};scrollTo(0,0)};
// ---- View router extension
const _view=view;
view=function(v){if(v=='contacts'||v=='companies')v='customers';ensure();
 if(['customers','calendar','calc'].includes(v)){document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('on',a.dataset.v==v));const banner=D.demo?`<span class=demo>DEMO DATA: sample deals only.</span>`:'';
  if(v=='customers'){app.innerHTML=banner+`<div class=card><div class=calbar><h2 style="margin:0">Customers</h2><button class=btn onclick=newCust()>＋ Add customer</button></div><input id=cq placeholder="Search customers or contacts…" style="margin:12px 0"><div id=cl>${custList('')}</div></div>`;$('#cq').oninput=e=>$('#cl').innerHTML=custList(e.target.value)}
  if(v=='calendar')app.innerHTML=banner+calView();
  if(v=='calc'){app.innerHTML=`<div class="card calcpage"><h1>Commission Calculator</h1><p class=tag>See exactly what a deal pays you. Updates as you type.</p>${calcBox('k',{deposit:2000,value:300},true)}</div>`;wireCalc('k')}
  scrollTo(0,0);return}
 _view(v);
 if(v=='today'){const t=iso(new Date()),ev=D.events.filter(e=>e.date==t).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  const cs=D.customers.slice().sort((a,b)=>lastContact(a)-lastContact(b));
  app.insertAdjacentHTML('beforeend',`<div class=card><h2>📅 Today's schedule</h2>${ev.map(chip).join('')||'<p class=hint>Nothing scheduled. Say “schedule a demo with Acme Tuesday at 2”.</p>'}<p><a class=bk onclick="cal.mode='week';cal.date=iso(new Date());view('calendar')">Open calendar →</a></p></div>
<div class=card><h2>Customer last contact</h2><p class=hint>Amber = 7+ days, red = 14+ days since you last reached out.</p>${cs.map(c=>{const lc=lastContact(c);return`<div class=cust onclick="openCust(${c.id})"><div><b>${esc(c.name)}</b><small>${esc(c.contacts.map(p=>p.name).join(', '))}</small></div><span class="lc ${stale(lc)}">Last contact: ${ago(lc)}</span></div>`}).join('')}</div>`)}
 if(v=='pipe')document.querySelectorAll('.board .deal').forEach(el=>{const id=+(el.getAttribute('onclick').match(/\d+/)||[])[0],d=D.deals.find(d=>d.id==id);if(d)el.insertAdjacentHTML('beforeend',`<div class=cc>💰 ${money(comm(d).total)} <small>commission</small></div>`)})};
ensure();
