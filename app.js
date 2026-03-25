/* ===========================
   JolSapari — app.js
   Firebase Firestore интеграциясы
   =========================== */

const firebaseConfig = {
  apiKey: "AIzaSyCsX2R6uMdzBdhTVUe9Je7_VHds3Sp3rw4",
  authDomain: "jolsapari.firebaseapp.com",
  projectId: "jolsapari",
  storageBucket: "jolsapari.firebasestorage.app",
  messagingSenderId: "346731383742",
  appId: "1:346731383742:web:551c57e2652a0389b487ef"
};

let db = null;
function initFirebase() {
  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
  } catch(e) { console.error('Firebase:', e); }
}

async function fsGet(col) {
  try { const s = await db.collection(col).get(); return s.docs.map(d=>({_fid:d.id,...d.data()})); }
  catch(e) { return []; }
}
async function fsAdd(col, data) {
  try { const r = await db.collection(col).add({...data,_ts:Date.now()}); return r.id; }
  catch(e) { return null; }
}
async function fsUpdate(col, id, data) {
  try { await db.collection(col).doc(id).update(data); } catch(e) {}
}
async function fsSet(col, id, data) {
  try { await db.collection(col).doc(id).set(data,{merge:true}); } catch(e) {}
}
async function fsDelete(col, id) {
  try { await db.collection(col).doc(id).delete(); } catch(e) {}
}

function todayStr() { return new Date().toISOString().split('T')[0]; }
function offsetDate(d) { const x=new Date(); x.setDate(x.getDate()+d); return x.toISOString().split('T')[0]; }
function fmtDate(s) { if(!s) return ''; const [y,m,d]=s.split('-'); return d+'.'+m+'.'+y; }
function fmtMoney(n) { return Number(n).toLocaleString('ru-RU')+' ₸'; }
function genTktId() { return 'TKT-'+Date.now().toString(36).toUpperCase(); }

function buildSeatSchema(bus) {
  const s=[];
  for(let i=1;i<=(bus.solo||12);i++) s.push({id:i+'үсті',label:i+' үсті',type:'solo',level:'top'});
  s.push({id:'0үстіA',label:'0 үсті',type:'couple',level:'top'});
  s.push({id:'0үстіB',label:'0 үсті',type:'couple',level:'top'});
  for(let i=13;i<=16;i++) s.push({id:i+'үсті',label:i+' үсті',type:'quad',level:'top'});
  for(let i=1;i<=12;i++) s.push({id:i+'асты',label:i+' асты',type:'bottom',level:'bottom'});
  s.push({id:'0астыA',label:'0 асты',type:'couple-bot',level:'bottom'});
  s.push({id:'0астыB',label:'0 асты',type:'couple-bot',level:'bottom'});
  for(let i=13;i<=16;i++) s.push({id:i+'асты',label:i+' асты',type:'quad-bot',level:'bottom'});
  return s;
}
function getCouplePartner(id) { return id.endsWith('A')?id.slice(0,-1)+'B':id.slice(0,-1)+'A'; }

let state = {
  loggedIn:false, currentTrip:null, currentBus:null,
  selectedSeats:[], paxCount:1, bookingStep:1, newTicketId:null,
  adminSelectedSeat:null,
  buses:[], trips:[], bookings:[], settings:{}
};

function defaultSettings() {
  return { company:'ИП',bin:'',phone:'',email:'',kaspiPhone:'+7 700 000 0000',kaspiQr:'',kaspiNote:'Kaspi арқылы аударыңыз.',adminPass:'admin123' };
}

document.addEventListener('DOMContentLoaded', async ()=>{
  initFirebase();
  document.getElementById('c-date').value = todayStr();
  showToast('Жүктелуде...');
  await loadAll();
  document.getElementById('toast').classList.remove('show');
  switchView('client');
});

async function loadAll() {
  const [buses,trips,bookings,sets] = await Promise.all([fsGet('buses'),fsGet('trips'),fsGet('bookings'),fsGet('settings')]);
  state.buses=buses; state.trips=trips; state.bookings=bookings;
  state.settings = sets.length ? sets[0] : defaultSettings();
  if(state.buses.length===0) await seedData();
}

async function seedData() {
  const today=todayStr(), tom=offsetDate(1);
  const b1=await fsAdd('buses',{plate:'777 KZT 02',model:'Yutong ZK6127',solo:12,couple:2,quad:4,bottom:18,status:'active'});
  const b2=await fsAdd('buses',{plate:'888 KZT 05',model:'Golden Dragon XML6127',solo:12,couple:2,quad:4,bottom:18,status:'active'});
  const b3=await fsAdd('buses',{plate:'999 KZT 07',model:'Yutong ZK6127',solo:12,couple:2,quad:4,bottom:18,status:'repair'});
  const pr={solo:3500,couple:3000,quad:2800,bottom:3500};
  await fsAdd('trips',{busId:b1,dir:'AJ',date:today,dep:'06:00',arr:'17:30',prices:pr,status:'active'});
  await fsAdd('trips',{busId:b2,dir:'AJ',date:today,dep:'09:30',arr:'21:00',prices:pr,status:'active'});
  await fsAdd('trips',{busId:b1,dir:'AJ',date:tom,dep:'06:00',arr:'17:30',prices:pr,status:'active'});
  const sf=await fsAdd('settings',defaultSettings());
  await loadAll();
}

function switchView(v) {
  document.getElementById('view-client').style.display=v==='client'?'block':'none';
  document.getElementById('view-admin').style.display=v==='admin'?'flex':'none';
  document.getElementById('nav-client').classList.toggle('active',v==='client');
  if(v==='admin'){ renderDashboard();renderBuses();renderTripsAdmin();populateTripFilters();renderRevenue();loadSettings(); }
}

function showAdminLogin() { if(state.loggedIn){switchView('admin');return;} openModal('login-modal'); }
function doLogin() {
  const u=document.getElementById('login-user').value.trim();
  const p=document.getElementById('login-pass').value;
  if(u==='admin'&&p===(state.settings.adminPass||'admin123')) {
    state.loggedIn=true; closeModal('login-modal'); switchView('admin');
  } else { const e=document.getElementById('login-err'); e.textContent='Қате логин/пароль'; e.style.display='block'; }
}
function logout() { state.loggedIn=false; switchView('client'); showToast('Жүйеден шықтыңыз'); }

// Жасырын админ кіру — логотипке 5 рет басу
let adminClickCount=0, adminClickTimer=null;
function adminSecretClick() {
  adminClickCount++;
  clearTimeout(adminClickTimer);
  adminClickTimer=setTimeout(()=>adminClickCount=0, 2000);
  if(adminClickCount>=5) { adminClickCount=0; showAdminLogin(); }
}

function searchTrips() {
  const dir=document.getElementById('c-dir').value;
  const date=document.getElementById('c-date').value;
  if(!date){showToast('Күнін таңдаңыз');return;}
  const trips=state.trips.filter(t=>t.dir===dir&&t.date===date&&t.status==='active');
  const [fc,tc]=dir==='AJ'?['Алматы','Жетісай']:['Жетісай','Алматы'];
  document.getElementById('empty-state').style.display='none';
  document.getElementById('trip-results').style.display='block';
  document.getElementById('results-label').textContent=fc+' → '+tc+' · '+fmtDate(date);
  const list=document.getElementById('trips-list');
  if(!trips.length){ const noTripMsg = dir==='AJ'
    ? '<div class="empty-state" style="padding:32px"><div class="empty-icon">😔</div><div class="empty-title">Рейс табылмады</div><div class="empty-sub">Кешіріңіз, біз Алматыдан Жетісайға рейс таппадық.<br>Бірақ сіз <a href="tel:87005950333" style="color:var(--brand);font-weight:600">87005950333</a> нөміріне звандап брондай аласыз</div></div>'
    : '<div class="empty-state" style="padding:32px"><div class="empty-icon">😔</div><div class="empty-title">Рейс табылмады</div><div class="empty-sub">Бұл күнге рейс жоспарланбаған</div></div>';
  list.innerHTML=noTripMsg; return; }
  list.innerHTML='';
  trips.forEach((t,i)=>{
    const bus=state.buses.find(b=>b._fid===t.busId); if(!bus) return;
    const taken=state.bookings.filter(b=>b.tripId===t._fid&&b.status!=='cancelled').map(b=>b.seatId);
    const avail=buildSeatSchema(bus).length-taken.length;
    const mp=Math.min(...Object.values(t.prices));
    const badge=i===0?'<span class="tc-badge blue">Ең танымал</span>':avail<=5?'<span class="tc-badge red">Соңғы '+avail+' орын</span>':'<span class="tc-badge gold">Тікелей</span>';
    list.innerHTML+=`<div class="trip-card ${i===0?'featured':''}" onclick="openBooking('${t._fid}')">
      <div class="time-col"><div class="tbig">${t.dep}</div><div class="tsmall">${fc}</div></div>
      <div class="mid-col"><div style="margin-bottom:6px">${badge}</div><div class="dur">~11.5 сағат</div>
        <div class="tline"><div class="tldot"></div><div class="tlbar"></div><div class="tldot"></div></div>
        <div class="dur" style="font-size:11px">${bus.plate}</div></div>
      <div class="time-col" style="text-align:right"><div class="tbig">${t.arr}</div><div class="tsmall">${tc}</div></div>
      <div class="seats-col"><div class="snum" style="${avail<=5?'color:#D97706':''}">${avail}</div><div class="slabel">бос орын</div></div>
      <div class="price-col"><div class="price-big">${fmtMoney(mp)}</div><div class="slabel">бастап</div></div>
      <button class="btn primary" style="font-size:12px;padding:8px 14px;white-space:nowrap" onclick="event.stopPropagation();openBooking('${t._fid}')">Брондау</button>
    </div>`;
  });
}

function openBooking(tripId) {
  const t=state.trips.find(x=>x._fid===tripId); if(!t) return;
  const bus=state.buses.find(b=>b._fid===t.busId);
  const [fc,tc]=t.dir==='AJ'?['Алматы','Жетісай']:['Жетісай','Алматы'];
  state.currentTrip=t; state.currentBus=bus; state.selectedSeats=[];
  state.paxCount=parseInt(document.getElementById('c-pax').value)||1;
  document.getElementById('ts-from').textContent=fc; document.getElementById('ts-to').textContent=tc;
  document.getElementById('ts-dep').textContent=t.dep; document.getElementById('ts-arr').textContent=t.arr;
  document.getElementById('ts-bus-info').textContent=bus.plate+' · '+bus.model+' · '+fmtDate(t.date);
  setStep(1); buildSeatMap(bus,t); openModal('booking-modal');
}

function buildSeatMap(bus,trip) {
  const schema=buildSeatSchema(bus);
  const taken=state.bookings.filter(b=>b.tripId===trip._fid&&b.status!=='cancelled').map(b=>b.seatId);
  const body=document.getElementById('seat-map-body');
  body.innerHTML=`
  <div class="sm-section"><div class="sm-sec-title">Үстінгі орындар (18)</div><div class="seats-row" id="seats-top"></div></div>
  <div class="sm-section"><div class="sm-sec-title">Астынғы орындар (18)</div><div class="seats-row" id="seats-bot"></div></div>`;
  [{arr:schema.filter(s=>s.level==='top'),cid:'seats-top'},{arr:schema.filter(s=>s.level==='bottom'),cid:'seats-bot'}].forEach(({arr,cid})=>{
    const cont=document.getElementById(cid);
    arr.forEach(s=>{
      const isTaken=taken.includes(s.id);
      const pk=(s.type==='couple'||s.type==='couple-bot')?'couple':(s.type==='quad'||s.type==='quad-bot')?'quad':s.type==='bottom'?'bottom':'solo';
      const price=trip.prices[pk];
      const tl={solo:'Жеке',couple:'Жұптық','couple-bot':'Жұптық',quad:'Тапшан','quad-bot':'Тапшан',bottom:'Жеке'};
      const ct=s.type==='couple-bot'?'couple':s.type==='quad-bot'?'quad':s.type;
      const cls=['seat','type-'+ct,isTaken?'taken':''].filter(Boolean).join(' ');
      const oc=isTaken?'':'onclick="selectSeat(\''+s.id+'\',\''+s.type+'\','+price+')"';
      cont.innerHTML+=`<div class="${cls}" ${oc}><span class="seat-id">${s.label}</span><span class="seat-type-tag">${tl[s.type]}</span></div>`;
    });
  });
}

function selectSeat(id,type,price) {
  const pax=state.paxCount||1;
  if((type==='couple'||type==='couple-bot')&&pax<2){showToast('Жұптық орын тек 2+ жолаушыда');return;}
  const fe=sid=>[...document.querySelectorAll('.seat')].find(s=>s.querySelector('.seat-id')?.textContent.trim()===sid);
  const idx=state.selectedSeats.findIndex(s=>s.id===id);
  if(idx!==-1){
    if(type==='couple'||type==='couple-bot'){
      const pt=getCouplePartner(id),pi=state.selectedSeats.findIndex(s=>s.id===pt);
      if(pi!==-1){state.selectedSeats.splice(pi,1);const pe=fe(pt);if(pe)pe.classList.remove('selected');}
    }
    state.selectedSeats.splice(state.selectedSeats.findIndex(s=>s.id===id),1);
    const el=fe(id);if(el)el.classList.remove('selected');
    updateSeatInfo();return;
  }
  if(type==='couple'||type==='couple-bot'){
    const pt=getCouplePartner(id);
    const taken=state.bookings.filter(b=>b.tripId===state.currentTrip._fid&&b.status!=='cancelled').map(b=>b.seatId);
    if(state.selectedSeats.length+2>pax){showToast('Жұптық үшін 2 бос слот керек');return;}
    if(taken.includes(pt)){showToast('Серіктес орын алынған');return;}
    state.selectedSeats.push({id,type,price});state.selectedSeats.push({id:pt,type,price});
    const el=fe(id);if(el)el.classList.add('selected');const pe=fe(pt);if(pe)pe.classList.add('selected');
    updateSeatInfo();return;
  }
  if(state.selectedSeats.length>=pax){showToast('Тек '+pax+' орын таңдай аласыз');return;}
  state.selectedSeats.push({id,type,price});const el=fe(id);if(el)el.classList.add('selected');
  updateSeatInfo();
}

function updateSeatInfo() {
  const pax=state.paxCount||1,seats=state.selectedSeats;
  const info=document.getElementById('seat-selected-info');
  if(!seats.length){info.style.display='none';return;}
  const total=seats.reduce((s,x)=>s+x.price,0);
  info.style.display='flex';
  info.innerHTML='<span>Таңдалған ('+seats.length+'/'+pax+'): <strong>'+seats.map(s=>s.id).join(', ')+'</strong></span><span style="color:var(--brand);font-weight:600">'+fmtMoney(total)+'</span>';
}

function goStep(n) {
  const seats=state.selectedSeats,pax=state.paxCount||1;
  if(n===2){
    if(!seats.length){showToast('Орын таңдаңыз');return;}
    if(seats.length<pax){showToast(pax+' орын таңдаңыз, қазір '+seats.length);return;}
    const total=seats.reduce((s,x)=>s+x.price,0);
    document.getElementById('confirm-seat-info').innerHTML='<span>Орындар: <strong>'+seats.map(s=>s.id).join(', ')+'</strong></span><span style="color:var(--brand);font-weight:600">'+fmtMoney(total)+'</span>';
    const gl=document.getElementById('pax-gender-list');
    gl.innerHTML='<div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:6px">Жолаушылардың жынысы</div>';
    seats.forEach((s,i)=>{gl.innerHTML+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="font-size:13px;min-width:80px;color:var(--muted)">'+s.id+':</span><select id="pg-'+i+'" style="border:1px solid var(--bdr);border-radius:var(--rad);padding:6px 10px;font-size:13px;background:var(--bg2);color:var(--text);flex:1"><option value="M">Ер адам</option><option value="F">Әйел адам</option><option value="C">Бала</option></select></div>';});
  }
  if(n===3){
    const fn=document.getElementById('p-first').value.trim(),ln=document.getElementById('p-last').value.trim(),ph=document.getElementById('p-phone').value.trim();
    if(!fn||!ln){showToast('Аты-жөнін толтырыңыз');return;}
    if(!ph||ph.length<10){showToast('Телефон енгізіңіз');return;}
    const total=seats.reduce((x,y)=>x+y.price,0),tktId=genTktId(),s=state.settings;
    state.newTicketId=tktId;
    document.getElementById('k-amount').textContent=fmtMoney(total);
    document.getElementById('k-final').textContent=fmtMoney(total);
    document.getElementById('k-company').textContent=s.company||'ИП';
    document.getElementById('k-phone').textContent=s.kaspiPhone||'+7 700 000 0000';
    document.getElementById('k-note').textContent=s.kaspiNote||'';
    document.getElementById('k-ticket-num').textContent=tktId;
    // Kaspi сілтемесіне сумманы қосамыз
    const kaspiBtn=document.getElementById('kaspi-pay-btn');
    if(kaspiBtn) kaspiBtn.href='https://pay.kaspi.kz/pay/wscyhhai?amount='+total;
  }
  setStep(n);
}

function setStep(n) {
  ['seat','passenger','payment','success'].forEach((s,i)=>document.getElementById('bstep-'+s).style.display=(i+1===n)?'block':'none');
  [1,2,3].forEach(i=>document.getElementById('st'+i).classList.toggle('on',i<=n));
  document.getElementById('modal-title').textContent={1:'Орын таңдау',2:'Жолаушы деректері',3:'Kaspi төлем',4:'Төлеміңіз тексеріске жіберілді!'}[n]||'';
}

async function confirmPayment() {
  const fn=document.getElementById('p-first').value.trim(),ln=document.getElementById('p-last').value.trim(),ph=document.getElementById('p-phone').value.trim();
  if(ph.length<10){showToast('Телефон дұрыс емес');return;}
  const t=state.currentTrip,seats=state.selectedSeats,total=seats.reduce((s,x)=>s+x.price,0);
  showToast('Брондалуда...');
  for(let i=0;i<seats.length;i++){
    const seat=seats[i],g=(document.getElementById('pg-'+i)||{value:'M'}).value,tktId=genTktId();
    const bk={id:tktId,tripId:t._fid,seatId:seat.id,seatType:seat.type,name:fn+' '+ln,phone:ph,gender:g,price:seat.price,method:'Kaspi Pay',status:'pending',ts:Date.now()};
    const fid=await fsAdd('bookings',bk);
    state.bookings.push({...bk,_fid:fid});
  }
  const [fc,tc]=t.dir==='AJ'?['Алматы','Жетісай']:['Жетісай','Алматы'];
  document.getElementById('final-ticket-card').innerHTML=
    '<div class="tkt-route"><div><div class="tkt-city">'+fc+'</div><div class="tkt-time">'+t.dep+'</div></div><div class="tkt-arrow">→</div><div class="tkt-right"><div class="tkt-city">'+tc+'</div><div class="tkt-time">'+t.arr+'</div></div></div>'+
    '<div class="tkt-dashed"></div>'+
    '<div class="tkt-grid"><div><div class="tkt-key">Жолаушы</div><div class="tkt-val">'+fn+' '+ln+'</div></div><div><div class="tkt-key">Орындар</div><div class="tkt-val">'+seats.map(s=>s.id).join(', ')+'</div></div><div><div class="tkt-key">Күні</div><div class="tkt-val">'+fmtDate(t.date)+'</div></div><div><div class="tkt-key">Жалпы</div><div class="tkt-val" style="color:var(--brand)">'+fmtMoney(total)+'</div></div></div>'+
    '<div class="tkt-num">'+seats.length+' билет · '+state.newTicketId+'</div>';
  // Telegram хабарлама жіберу
  const bus2 = state.buses.find(b => b._fid === t.busId);
  const busPlate = bus2 ? bus2.plate : '—';
  const dir2 = t.dir === 'AJ' ? 'Алматы → Жетісай' : 'Жетісай → Алматы';
  const tgMsg = '🚌 <b>Жаңа бронь!</b>\n\n' +
    '👤 <b>Жолаушы:</b> ' + fn + ' ' + ln + '\n' +
    '📞 <b>Телефон:</b> ' + ph + '\n' +
    '🪑 <b>Орындар:</b> ' + seats.map(s=>s.id).join(', ') + '\n' +
    '🚌 <b>Автобус:</b> ' + busPlate + '\n' +
    '📅 <b>Күні:</b> ' + fmtDate(t.date) + ' · ' + t.dep + '\n' +
    '🛣 <b>Бағыт:</b> ' + dir2 + '\n' +
    '💰 <b>Сомасы:</b> ' + fmtMoney(total) + '\n' +
    '⏳ <b>Күй:</b> Төлем күтілуде\n\n' +
    '👉 Kaspi-де тексеріп, Админ панелінен растаңыз!';
  sendTelegram(tgMsg);
  setStep(4); showToast('Билет сәтті брондалды!');
}

function renderDashboard() {
  const now=new Date(),kk=['қаңтар','ақпан','наурыз','сәуір','мамыр','маусым','шілде','тамыз','қыркүйек','қазан','қараша','желтоқсан'];
  const today=todayStr();
  document.getElementById('dash-date').textContent='Бүгін: '+now.getDate()+' '+kk[now.getMonth()]+' '+now.getFullYear()+' ж.';
  const fe=document.getElementById('dash-filter-date');
  if(fe&&!fe.value) fe.value=today;
  const fv=fe?fe.value:today,showAll=fv==='all';
  const trips=showAll?state.trips:state.trips.filter(t=>t.date===(fv||today));
  const todayTrips=state.trips.filter(t=>t.date===today);
  let ts=0,ss=0,rev=0;
  todayTrips.forEach(t=>{const bus=state.buses.find(b=>b._fid===t.busId);if(!bus)return;const tb=state.bookings.filter(b=>b.tripId===t._fid&&b.status!=='cancelled');ts+=buildSeatSchema(bus).length;ss+=tb.length;rev+=tb.filter(b=>b.status==='paid').reduce((s,b)=>s+b.price,0);});
  document.getElementById('dash-stats').innerHTML=
    '<div class="stat-card"><div class="stat-lbl">Бүгінгі рейс</div><div class="stat-n blue">'+todayTrips.length+'</div></div>'+
    '<div class="stat-card"><div class="stat-lbl">Сатылған</div><div class="stat-n green">'+ss+'</div></div>'+
    '<div class="stat-card"><div class="stat-lbl">Бос орын</div><div class="stat-n amber">'+(ts-ss)+'</div></div>'+
    '<div class="stat-card"><div class="stat-lbl">Бүгінгі кіріс</div><div class="stat-n green">'+fmtMoney(rev)+'</div></div>';
  const tbody=document.getElementById('dash-trips-body');tbody.innerHTML='';
  const sorted=[...trips].sort((a,b)=>a.date.localeCompare(b.date)||a.dep.localeCompare(b.dep));
  if(!sorted.length){tbody.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px">Рейс жоқ</td></tr>';return;}
  sorted.forEach(t=>{
    const bus=state.buses.find(b=>b._fid===t.busId);if(!bus)return;
    const schema=buildSeatSchema(bus),tb=state.bookings.filter(b=>b.tripId===t._fid&&b.status!=='cancelled'),takenIds=tb.map(b=>b.seatId);
    const rev2=tb.filter(b=>b.status==='paid').reduce((s,b)=>s+b.price,0);
    const [fc,tc]=t.dir==='AJ'?['Алматы','Жетісай']:['Жетісай','Алматы'];
    let sh='<div style="display:flex;flex-wrap:wrap;gap:3px;max-width:280px">';
    schema.forEach(s=>{
      const it=takenIds.includes(s.id);
      const bg=it?((s.type==='couple'||s.type==='couple-bot')?'#7C3AED':(s.type==='quad'||s.type==='quad-bot')?'#059669':'#6B7280'):((s.type==='couple'||s.type==='couple-bot')?'#EDE9FE':(s.type==='quad'||s.type==='quad-bot')?'#D1FAE5':'var(--bg2)');
      const textColor=it?'white':(s.type==='couple'||s.type==='couple-bot')?'#5B21B6':(s.type==='quad'||s.type==='quad-bot')?'#065F46':'var(--muted)';
      sh+='<div title="'+s.label+(it?' — брондаулы':' — бос')+'" style="width:26px;height:26px;border-radius:4px;background:'+bg+';border:1px solid var(--bdr);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:600;color:'+textColor+'">'+s.label.replace(' үсті','ү').replace(' асты','а')+'</div>';
    });
    sh+='</div><div style="display:flex;gap:12px;margin-top:5px;flex-wrap:wrap">'+
      '<span style="font-size:11px;color:var(--muted)">🔒 Брондаулы: <strong>'+tb.length+'</strong></span>'+
      '<span style="font-size:11px;color:var(--muted)">✅ Бос: <strong>'+(schema.length-tb.length)+'</strong></span>'+
      '<span style="font-size:11px;color:var(--muted)">📋 Жалпы: <strong>'+schema.length+'</strong></span>'+
    '</div>';
    tbody.innerHTML+='<tr><td>'+fmtDate(t.date)+'</td><td><div style="font-weight:600">'+bus.plate+'</div><div style="font-size:11px;color:var(--muted)">'+bus.model+'</div></td><td>'+fc+' → '+tc+'</td><td>'+t.dep+'</td><td>'+t.arr+'</td><td>'+sh+'</td><td>'+fmtMoney(rev2)+'</td><td><span class="badge '+(t.status==='active'?'green':'amber')+'">'+(t.status==='active'?'Белсенді':'Жоспарланған')+'</span></td></tr>';
  });
}

function renderBuses() {
  const tbody=document.getElementById('buses-body');tbody.innerHTML='';
  state.buses.forEach((b,i)=>{
    const total=(b.solo||12)+(b.couple||2)+(b.quad||4)+(b.bottom||18);
    const sb=b.status==='active'?'<span class="badge green">Белсенді</span>':b.status==='repair'?'<span class="badge amber">Жөндеуде</span>':'<span class="badge gray">Белсенді емес</span>';
    const tb=b.status==='active'?'<button class="btn" style="font-size:11px;padding:4px 10px;margin-bottom:4px" onclick="setBusStatus(\''+b._fid+'\',\'repair\')">Жөндеуге жіберу</button><br>':'<button class="btn primary" style="font-size:11px;padding:4px 10px;margin-bottom:4px" onclick="setBusStatus(\''+b._fid+'\',\'active\')">Белсенді ету</button><br>';
    tbody.innerHTML+='<tr><td>'+(i+1)+'</td><td><strong>'+b.plate+'</strong></td><td>'+b.model+'</td><td><span class="badge blue">'+total+' орын</span></td><td>'+sb+'</td><td>'+tb+'<button class="btn danger" style="font-size:11px;padding:4px 10px" onclick="deleteBus(\''+b._fid+'\')">Жою</button></td></tr>';
  });
}

function setupSeatCountPreview() {
  ['b-solo','b-couple','b-quad','b-bottom'].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener('input',updateSeatPreview);});
}
function updateSeatPreview() {
  const s=+document.getElementById('b-solo').value||0,c=+document.getElementById('b-couple').value||0,q=+document.getElementById('b-quad').value||0,bot=+document.getElementById('b-bottom').value||0;
  document.getElementById('seat-count-preview').innerHTML='Жалпы: <strong>'+(s+c+q+bot)+' орын</strong>';
}
async function addBus() {
  const plate=document.getElementById('b-plate').value.trim(),model=document.getElementById('b-model').value.trim();
  if(!plate||!model){showToast('Нөмір мен модель міндетті');return;}
  const data={plate,model,solo:+document.getElementById('b-solo').value||12,couple:+document.getElementById('b-couple').value||2,quad:+document.getElementById('b-quad').value||4,bottom:+document.getElementById('b-bottom').value||18,status:'active'};
  showToast('Сақталуда...');
  const fid=await fsAdd('buses',data);state.buses.push({...data,_fid:fid});
  document.getElementById('b-plate').value='';document.getElementById('b-model').value='';
  renderBuses();populateBusSelect();showToast('Автобус қосылды');
}
async function setBusStatus(fid,status) {
  await fsUpdate('buses',fid,{status});const bus=state.buses.find(b=>b._fid===fid);if(bus)bus.status=status;
  renderBuses();populateBusSelect();showToast(status==='active'?'Белсенді етілді!':'Жөндеуге жіберілді');
}
async function deleteBus(fid) {
  if(!confirm('Автобусты жою?'))return;
  await fsDelete('buses',fid);state.buses=state.buses.filter(b=>b._fid!==fid);
  renderBuses();populateBusSelect();showToast('Жойылды');
}
function populateBusSelect() {
  const sel=document.getElementById('t-bus');if(!sel)return;
  sel.innerHTML=state.buses.filter(b=>b.status==='active').map(b=>'<option value="'+b._fid+'">'+b.plate+' — '+b.model+'</option>').join('');
}

async function addTrip() {
  const busId=document.getElementById('t-bus').value,dir=document.getElementById('t-dir').value,date=document.getElementById('t-date').value,dep=document.getElementById('t-dep').value,arr=document.getElementById('t-arr').value;
  if(!busId||!date||!dep||!arr){showToast('Барлық өрістерді толтырыңыз');return;}
  const data={busId,dir,date,dep,arr,prices:{solo:+document.getElementById('t-p-solo').value||3500,couple:+document.getElementById('t-p-couple').value||3000,quad:+document.getElementById('t-p-quad').value||2800,bottom:+document.getElementById('t-p-bottom').value||3500},status:'active'};
  showToast('Сақталуда...');
  const fid=await fsAdd('trips',data);state.trips.push({...data,_fid:fid});
  renderTripsAdmin();populateTripFilters();showToast('Рейс қосылды');
}
function renderTripsAdmin() {
  const fd=document.getElementById('filter-trip-date')?.value||'';
  const filtered=fd?state.trips.filter(t=>t.date===fd):state.trips;
  const sorted=[...filtered].sort((a,b)=>a.date.localeCompare(b.date)||a.dep.localeCompare(b.dep));
  const tbody=document.getElementById('trips-body');tbody.innerHTML='';
  if(!sorted.length){tbody.innerHTML='<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:24px">Рейс жоқ</td></tr>';return;}
  sorted.forEach(t=>{
    const bus=state.buses.find(b=>b._fid===t.busId);if(!bus)return;
    const sold=state.bookings.filter(b=>b.tripId===t._fid&&b.status!=='cancelled').length;
    const total=buildSeatSchema(bus).length;
    const pct=Math.round(sold/total*100);
    const [fc,tc]=t.dir==='AJ'?['Алматы','Жетісай']:['Жетісай','Алматы'];
    tbody.innerHTML+='<tr><td>'+fmtDate(t.date)+'</td><td><strong>'+bus.plate+'</strong></td><td>'+fc+' → '+tc+'</td><td>'+t.dep+'</td><td>'+t.arr+'</td>'+
      '<td style="font-size:11px">Жеке: '+fmtMoney(t.prices.solo)+'<br>Жұп: '+fmtMoney(t.prices.couple)+'<br>Тапшан: '+fmtMoney(t.prices.quad)+'</td>'+
      '<td><span class="badge '+(pct>=80?'green':pct>=40?'amber':'blue')+'">'+sold+'/'+total+'</span></td>'+
      '<td><span class="badge '+(t.status==='active'?'green':'amber')+'">'+(t.status==='active'?'Белсенді':'Жоспарланған')+'</span></td>'+
      '<td><button class="btn danger" style="font-size:11px;padding:4px 8px" onclick="deleteTrip(\''+t._fid+'\')">Жою</button></td></tr>';
  });
}
async function deleteTrip(fid) {
  if(!confirm('Рейсті жою?'))return;
  await fsDelete('trips',fid);state.trips=state.trips.filter(t=>t._fid!==fid);
  renderTripsAdmin();populateTripFilters();showToast('Рейс жойылды');
}

function populateTripFilters() {
  const sel=document.getElementById('pax-trip-filter');if(!sel)return;
  sel.innerHTML='<option value="">— Барлық рейстер —</option>'+
    [...state.trips].sort((a,b)=>b.date.localeCompare(a.date)).map(t=>{
      const bus=state.buses.find(b=>b._fid===t.busId);
      return '<option value="'+t._fid+'">'+fmtDate(t.date)+' · '+t.dep+' · '+(t.dir==='AJ'?'АЛМ→ЖЕТ':'ЖЕТ→АЛМ')+(bus?' · '+bus.plate:'')+'</option>';
    }).join('');
  populateBusSelect();
}
function renderPassengers() {
  const tid=document.getElementById('pax-trip-filter')?.value;
  let bks=tid?state.bookings.filter(b=>b.tripId===tid):state.bookings;
  const paid=bks.filter(b=>b.status==='paid').length,pend=bks.filter(b=>b.status==='pending').length,canc=bks.filter(b=>b.status==='cancelled').length;
  document.getElementById('pax-stats').innerHTML=
    '<div class="stat-card"><div class="stat-lbl">Жалпы</div><div class="stat-n blue">'+bks.length+'</div></div>'+
    '<div class="stat-card"><div class="stat-lbl">Төленді</div><div class="stat-n green">'+paid+'</div></div>'+
    '<div class="stat-card"><div class="stat-lbl">Күтілуде</div><div class="stat-n amber">'+pend+'</div></div>'+
    '<div class="stat-card"><div class="stat-lbl">Бас тартылды</div><div class="stat-n red">'+canc+'</div></div>';
  const tbody=document.getElementById('pax-body');tbody.innerHTML='';
  if(!bks.length){tbody.innerHTML='<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:24px">Жолаушы жоқ</td></tr>';return;}
  const tl={solo:'Жеке',couple:'Жұптық','couple-bot':'Жұптық',quad:'Тапшан','quad-bot':'Тапшан',bottom:'Жеке'};
  const tb2={solo:'blue',couple:'purple','couple-bot':'purple',quad:'teal','quad-bot':'teal',bottom:'green'};
  const sc={paid:'green',pending:'amber',cancelled:'red'};
  const sl={paid:'Төленді',pending:'Күтілуде',cancelled:'Бас тартылды'};
  [...bks].sort((a,b)=>(b.ts||0)-(a.ts||0)).forEach((bk,i)=>{
    const bkTrip=state.trips.find(t=>t._fid===bk.tripId);
    const bkBus=bkTrip?state.buses.find(b=>b._fid===bkTrip.busId):null;
    const busInfo=bkBus?('<strong>'+bkBus.plate+'</strong>'):'—';
    tbody.innerHTML+='<tr><td style="color:var(--muted);font-size:11px">'+(i+1)+'</td>'+
      '<td><div style="font-weight:600">'+bk.name+'</div><div style="font-size:11px;color:var(--muted)">'+bk.id+'</div></td>'+
      '<td>'+bk.phone+'</td>'+
      '<td><div style="font-weight:600">'+bk.seatId+'</div><div style="font-size:11px;color:var(--brand)">'+busInfo+'</div></td>'+
      '<td><span class="badge '+(tb2[bk.seatType]||'blue')+'">'+(tl[bk.seatType]||'Жеке')+'</span></td>'+
      '<td>'+fmtMoney(bk.price)+'</td><td style="font-size:12px">'+bk.method+'</td>'+
      '<td><span class="badge '+(sc[bk.status]||'amber')+'">'+(sl[bk.status]||bk.status)+'</span></td>'+
      '<td>'+(bk.status==='pending'?'<button class="btn primary" style="font-size:11px;padding:4px 8px;margin-bottom:4px" onclick="updateBookingStatus(\''+bk._fid+'\',\'paid\')">Растау</button><br>':'')+
      (bk.status!=='cancelled'?'<button class="btn danger" style="font-size:11px;padding:4px 8px" onclick="updateBookingStatus(\''+bk._fid+'\',\'cancelled\')">Бас тарту</button>':'')+'</td></tr>';
  });
}
async function updateBookingStatus(fid,status) {
  await fsUpdate('bookings',fid,{status});const bk=state.bookings.find(b=>b._fid===fid);if(bk)bk.status=status;
  renderPassengers();showToast(status==='paid'?'Төлем расталды':'Бас тартылды');
}
function printPassengers(){window.print();}

function renderRevenue() {
  const today=todayStr(),ts=new Date(today).getTime(),wa=Date.now()-7*86400000;
  const tr=state.bookings.filter(b=>b.status==='paid'&&b.ts>=ts).reduce((s,b)=>s+b.price,0);
  const wr=state.bookings.filter(b=>b.status==='paid'&&b.ts>=wa).reduce((s,b)=>s+b.price,0);
  const ar=state.bookings.filter(b=>b.status==='paid').reduce((s,b)=>s+b.price,0);
  const pr=state.bookings.filter(b=>b.status==='pending').reduce((s,b)=>s+b.price,0);
  document.getElementById('rev-stats').innerHTML=
    '<div class="stat-card"><div class="stat-lbl">Бүгін</div><div class="stat-n green">'+fmtMoney(tr)+'</div></div>'+
    '<div class="stat-card"><div class="stat-lbl">Осы апта</div><div class="stat-n blue">'+fmtMoney(wr)+'</div></div>'+
    '<div class="stat-card"><div class="stat-lbl">Барлық уақыт</div><div class="stat-n blue">'+fmtMoney(ar)+'</div></div>'+
    '<div class="stat-card"><div class="stat-lbl">Күтілуде</div><div class="stat-n amber">'+fmtMoney(pr)+'</div></div>';
  const tbody=document.getElementById('rev-body');tbody.innerHTML='';
  const sc={paid:'green',pending:'amber',cancelled:'red'},sl={paid:'Растаулды',pending:'Күтілуде',cancelled:'Бас тартылды'};
  [...state.bookings].sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0,50).forEach(bk=>{
    const trip=state.trips.find(t=>t._fid===bk.tripId),bus=trip?state.buses.find(b=>b._fid===trip.busId):null;
    const dt=new Date(bk.ts||Date.now()),ds=dt.toLocaleDateString('ru-RU')+' '+dt.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
    tbody.innerHTML+='<tr><td style="font-size:12px">'+ds+'</td><td><strong style="color:var(--brand)">'+bk.id+'</strong></td>'+
      '<td>'+bk.name+'</td><td style="font-size:12px">'+(trip?fmtDate(trip.date)+' · '+trip.dep:'—')+(bus?' · '+bus.plate:'')+'</td>'+
      '<td>'+bk.seatId+'</td><td style="font-weight:600">'+fmtMoney(bk.price)+'</td>'+
      '<td style="font-size:12px;color:#E83A3A;font-weight:600">'+bk.method+'</td>'+
      '<td><span class="badge '+(sc[bk.status]||'amber')+'">'+(sl[bk.status]||bk.status)+'</span></td></tr>';
  });
}

function loadSettings() {
  const s=state.settings;
  ['company','bin','phone','email'].forEach(k=>{const el=document.getElementById('s-'+k);if(el)el.value=s[k]||'';});
  const kp=document.getElementById('s-kaspi-phone');if(kp)kp.value=s.kaspiPhone||'';
  const kq=document.getElementById('s-kaspi-qr');if(kq)kq.value=s.kaspiQr||'';
  const kn=document.getElementById('s-kaspi-note');if(kn)kn.value=s.kaspiNote||'';
}
async function saveSettings() {
  const s=state.settings;
  s.company=document.getElementById('s-company').value;s.bin=document.getElementById('s-bin').value;
  s.phone=document.getElementById('s-phone').value;s.email=document.getElementById('s-email').value;
  s.kaspiPhone=document.getElementById('s-kaspi-phone').value;s.kaspiQr=document.getElementById('s-kaspi-qr').value;
  s.kaspiNote=document.getElementById('s-kaspi-note').value;
  const np=document.getElementById('s-pass').value,np2=document.getElementById('s-pass2').value;
  if(np){if(np!==np2){showToast('Құпия сөздер сәйкес емес');return;}s.adminPass=np;document.getElementById('s-pass').value='';document.getElementById('s-pass2').value='';}
  showToast('Сақталуда...');
  if(s._fid)await fsSet('settings',s._fid,s);else{const fid=await fsAdd('settings',s);s._fid=fid;}
  showToast('Баптаулар сақталды');
}

function adminTab(name) {
  document.querySelectorAll('.atab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.snav').forEach(n=>n.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  event.currentTarget.classList.add('active');
  if(name==='dashboard')renderDashboard();
  if(name==='buses')renderBuses();
  if(name==='trips'){renderTripsAdmin();populateBusSelect();populateTripFilters();}
  if(name==='passengers'){populateTripFilters();renderPassengers();}
  if(name==='revenue')renderRevenue();
  if(name==='settings')loadSettings();
}

function openAdminBooking() {
  const sel=document.getElementById('ab-trip');
  sel.innerHTML=state.trips.map(t=>{const bus=state.buses.find(b=>b._fid===t.busId);return '<option value="'+t._fid+'">'+fmtDate(t.date)+' · '+t.dep+' · '+(t.dir==='AJ'?'АЛМ→ЖЕТ':'ЖЕТ→АЛМ')+(bus?' · '+bus.plate:'')+'</option>';}).join('');
  buildAdminSeatMap();openModal('admin-book-modal');
}
function buildAdminSeatMap() {
  const tid=document.getElementById('ab-trip').value,t=state.trips.find(x=>x._fid===tid);if(!t)return;
  const bus=state.buses.find(b=>b._fid===t.busId);if(!bus)return;
  const schema=buildSeatSchema(bus),taken=state.bookings.filter(b=>b.tripId===tid&&b.status!=='cancelled').map(b=>b.seatId);
  state.adminSelectedSeat=null;document.getElementById('ab-seat-info').style.display='none';
  const rg=(seats,title)=>{
    let h='<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:6px">'+title+'</div><div style="display:flex;flex-wrap:wrap;gap:5px">';
    seats.forEach(s=>{
      const it=taken.includes(s.id),pk=(s.type==='couple'||s.type==='couple-bot')?'couple':(s.type==='quad'||s.type==='quad-bot')?'quad':s.type==='bottom'?'bottom':'solo';
      const price=t.prices[pk];
      const bg=it?'#F3F4F6':(s.type==='couple'||s.type==='couple-bot')?'#EDE9FE':(s.type==='quad'||s.type==='quad-bot')?'#D1FAE5':'var(--bg2)';
      const col=it?'#D1D5DB':(s.type==='couple'||s.type==='couple-bot')?'#5B21B6':(s.type==='quad'||s.type==='quad-bot')?'#065F46':'var(--muted)';
      const oc=it?'':'onclick="adminSelectSeat(\''+s.id+'\',\''+s.type+'\','+price+')"';
      h+='<div id="abs-'+s.id+'" '+oc+' style="width:44px;height:44px;border-radius:6px;border:1px solid var(--bdr);font-size:9px;font-weight:600;cursor:'+(it?'not-allowed':'pointer')+';display:flex;flex-direction:column;align-items:center;justify-content:center;background:'+bg+';color:'+col+';text-align:center;line-height:1.3">'+s.label+'</div>';
    });
    return h+'</div></div>';
  };
  document.getElementById('ab-seat-map').innerHTML='<div style="border:1px solid var(--bdr);border-radius:var(--rad);padding:12px">'+rg(schema.filter(s=>s.level==='top'),'Үстінгі орындар')+rg(schema.filter(s=>s.level==='bottom'),'Астынғы орындар')+'</div>';
}
function adminSelectSeat(id,type,price) {
  if(state.adminSelectedSeat){const p=document.getElementById('abs-'+state.adminSelectedSeat.id);if(p){p.style.background='';p.style.color='';}}
  state.adminSelectedSeat={id,type,price};
  const el=document.getElementById('abs-'+id);if(el){el.style.background='var(--brand)';el.style.color='white';}
  const info=document.getElementById('ab-seat-info');info.style.display='flex';
  info.innerHTML='<span>Таңдалған: <strong>'+id+'</strong></span><span style="color:var(--brand);font-weight:600">'+fmtMoney(price)+'</span>';
}
async function adminBookSeat() {
  const seat=state.adminSelectedSeat;if(!seat){showToast('Орын таңдаңыз');return;}
  const tripId=document.getElementById('ab-trip').value,fn=document.getElementById('ab-first').value.trim(),ln=document.getElementById('ab-last').value.trim(),ph=document.getElementById('ab-phone').value.trim(),g=document.getElementById('ab-gender').value,method=document.getElementById('ab-method').value;
  if(!fn||!ln){showToast('Аты-жөнін толтырыңыз');return;}
  if(!ph||ph.length<10){showToast('Телефон енгізіңіз');return;}
  showToast('Брондалуда...');
  const tktId=genTktId(),bk={id:tktId,tripId,seatId:seat.id,seatType:seat.type,name:fn+' '+ln,phone:ph,gender:g,price:seat.price,method,status:'paid',ts:Date.now()};
  const fid=await fsAdd('bookings',bk);state.bookings.push({...bk,_fid:fid});
  // Admin бронды Telegram арқылы хабарлау
  const adminTrip = state.trips.find(t2 => t2._fid === tripId);
  const adminBus = adminTrip ? state.buses.find(b => b._fid === adminTrip.busId) : null;
  const adminDir = adminTrip ? (adminTrip.dir === 'AJ' ? 'Алматы → Жетісай' : 'Жетісай → Алматы') : '—';
  const adminTg = '✅ <b>Админ брондады!</b>\n\n' +
    '👤 <b>Жолаушы:</b> ' + fn + ' ' + ln + '\n' +
    '📞 <b>Телефон:</b> ' + ph + '\n' +
    '🪑 <b>Орын:</b> ' + seat.id + '\n' +
    '🚌 <b>Автобус:</b> ' + (adminBus ? adminBus.plate : '—') + '\n' +
    '📅 <b>Күні:</b> ' + (adminTrip ? fmtDate(adminTrip.date) + ' · ' + adminTrip.dep : '—') + '\n' +
    '🛣 <b>Бағыт:</b> ' + adminDir + '\n' +
    '💰 <b>Сомасы:</b> ' + fmtMoney(seat.price) + '\n' +
    '💵 <b>Төлем:</b> ' + method + ' · <b>Төленді</b>';
  sendTelegram(adminTg);
  closeModal('admin-book-modal');renderPassengers();showToast(tktId+' — брондалды!');
}

function openModal(id){document.getElementById(id).style.display='flex';}
function closeModal(id){document.getElementById(id).style.display='none';}
document.addEventListener('click',e=>{
  ['login-modal','booking-modal','admin-book-modal'].forEach(id=>{const el=document.getElementById(id);if(el&&e.target===el)closeModal(id);});
});

// ============================================================
// TELEGRAM БОТ ХАБАРЛАМАСЫ
// ============================================================
async function sendTelegram(text) {
  try {
    await fetch('/.netlify/functions/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
  } catch(e) { console.log('Telegram қате:', e); }
}

let toastTimer;
function showToast(msg) {
  const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3000);
}
