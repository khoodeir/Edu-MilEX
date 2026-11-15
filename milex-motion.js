(function(){
var I={
users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
check:'<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="m9 11 3 3L22 4"/>',
wallet:'<path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15V7"/><path d="M16 14h.01"/>',
bolt:'<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
alert:'<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
layers:'<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
award:'<circle cx="12" cy="8" r="6"/><path d="m15.5 13 1.5 9-5-3-5 3 1.5-9"/>',
trend:'<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
cap:'<path d="m22 10-10-5L2 10l10 5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
clip:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 13l2 2 4-4"/>',
hist:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
down:'<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
chart:'<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>',
gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'};
var K={kpiStudents:'users',kpiAttendance:'check',kpiRevenue:'wallet',kpiToday:'bolt',kpiUnpaid:'alert',kpiCities:'pin',kpiGroups:'layers',kpiTopCity:'award',kpiTopGroup:'award',kpiHighestAtt:'check',kpiHighestColl:'trend'};
function svg(n,c){return '<svg class="'+c+'" viewBox="0 0 24 24">'+I[n]+'</svg>'}
var EMO=/^[\s\u200d\ufe0f\p{Extended_Pictographic}]+/u;
function clean(el){
  var w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),n;
  while((n=w.nextNode())){
    if(EMO.test(n.nodeValue)){var v=n.nodeValue.replace(EMO,'');if(v!==n.nodeValue)n.nodeValue=v}
  }
}
function tabIcon(t){
  if(t.querySelector(':scope>.mx-ico'))return;
  var k='cap';
  if(t.id==='examsTab')k='clip';else if(t.id==='historyTab')k='hist';else if(t.id==='absTab')k='down';else if(t.id==='auditTab')k='file';else if(t.id==='settingsTab')k='gear';
  t.insertAdjacentHTML('afterbegin',svg(k,'mx-ico'));
}
var busy=false;
function decorate(){
  if(busy)return;busy=true;
  document.querySelectorAll('.tab').forEach(function(t){clean(t);tabIcon(t)});
  document.querySelectorAll('.tab-group-label,.sendall-btn,.excel-btn,.save-snapshot-btn,.wa-btn,.refresh-btn span:last-child,.more-analytics summary,.footer-note').forEach(clean);
  document.querySelectorAll('.ma-icon').forEach(function(m){if(!m.querySelector('svg')){m.textContent='';m.insertAdjacentHTML('afterbegin',svg('chart',''))}});
  document.querySelectorAll('.kpi-card').forEach(function(c){
    if(c.querySelector('.kpi-ico'))return;
    var v=c.querySelector('.kpi-value');if(!v||!K[v.id])return;
    c.insertAdjacentHTML('afterbegin','<span class="kpi-ico">'+svg(K[v.id],'')+'</span>');
  });
  busy=false;
}
var cu=new WeakMap();
function count(el){
  var t=el.textContent.trim(),m=t.match(/^([^\d\-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/);
  if(!m||cu.get(el)===t)return;
  var end=parseFloat(m[2].replace(/,/g,'')),dec=(m[2].split('.')[1]||'').length,comma=m[2].indexOf(',')>-1;
  if(!isFinite(end)||end===0){cu.set(el,t);return}
  var s=performance.now(),d=800;
  function f(x){var p=Math.min(1,(x-s)/d),e=1-Math.pow(1-p,3),v=end*e;
    var txt=comma?v.toLocaleString('en-US',{minimumFractionDigits:dec,maximumFractionDigits:dec}):v.toFixed(dec);
    var out=m[1]+txt+m[3];cu.set(el,out);el.textContent=out;
    if(p<1)requestAnimationFrame(f);else{cu.set(el,t);el.textContent=t}}
  cu.set(el,t);requestAnimationFrame(f);
}
function init(){
  if(document.querySelector('.kpi-grid'))document.body.classList.add('dash-pro');
  decorate();
  new MutationObserver(function(){decorate()}).observe(document.body,{childList:true,subtree:true,characterData:true});
  document.querySelectorAll('.kpi-value').forEach(function(el){
    new MutationObserver(function(){count(el)}).observe(el,{childList:true,characterData:true,subtree:true});
  });
  if(window.Chart){
    var C=Chart.defaults;
    C.font.family="'Cairo','Inter',sans-serif";C.color='#5C6A80';
    C.animation={duration:1000,easing:'easeOutQuart'};
    C.plugins.legend.labels.usePointStyle=true;C.plugins.legend.labels.boxWidth=8;
    var tt=C.plugins.tooltip;tt.backgroundColor='#061F55';tt.titleColor='#A8D400';tt.bodyColor='#fff';tt.padding=11;tt.cornerRadius=10;tt.displayColors=true;tt.boxPadding=4;
    C.elements.bar.borderRadius=6;C.elements.line.borderWidth=2.5;
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
