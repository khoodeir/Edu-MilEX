
(function(){
  var JSZIP_URL = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
  var COMMON = ['milex-common.js','milex-theme.css','milex-motion.js','logo.png','logo-dark.png','icon-192.png','icon-512.png','apple-touch-icon.png'];
  var BUNDLES = {
    teacher:   { zip:'MilEX-Teacher',   pages:['dashboard.html','student_serch.html','student_edit.html','manage_exams.html','student_registration.html','scanner.html','student_delete.html','audit_log.html'] },
    assistant: { zip:'MilEX-Assistant', pages:['scanner.html','student_registration.html','manage_exams.html','exam_builder.html','manage_groups.html','student_delete.html','student_serch.html','student_edit.html'] }
  };
  var COPY_DAYS = 30;
  var REVOKE_KEY = 'bundle_revoked_before';
  var CSS_HIDE = '<style id="milex-bundle-css">.milex-bundle #roleScreen,.milex-bundle .back-top-row,.milex-bundle .hub-actions{display:none!important}</style>';

  function lang(){ return (document.documentElement.getAttribute('lang') || 'ar').indexOf('en') === 0 ? 'en' : 'ar'; }
  function t(ar, en){ return lang() === 'en' ? en : ar; }

  function loadScript(src){
    return new Promise(function(res, rej){
      if(window.JSZip) return res();
      var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function(){ rej(new Error('jszip')); };
      document.head.appendChild(s);
    });
  }
  async function getText(u){ var r = await fetch(u, {cache:'no-store'}); if(!r.ok) throw new Error(u); return r.text(); }
  async function getBlob(u){ var r = await fetch(u, {cache:'no-store'}); if(!r.ok) throw new Error(u); return r.blob(); }
  function toDataURI(blob){ return new Promise(function(res){ var f = new FileReader(); f.onload = function(){ res(f.result); }; f.readAsDataURL(blob); }); }
  function save(blob, name){
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  function b64(s){ return btoa(unescape(encodeURIComponent(s))); }

  async function buildParent(){
    var html = await getText('parent_portal.html');
    var logo = await toDataURI(await getBlob('logo.png'));
    html = html.replace(/<a class="back-top-btn" href="index\.html">[\s\S]*?<\/a>/, '');
    html = html.replace(/<div id="milexDownloadRow"[\s\S]*?<\/div>\s*(?=<div class="search-card")/, '');
    html = html.replace(/src="logo\.png"/g, 'src="' + logo + '"');
    html = html.replace(/<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*>\s*/g, '');
    html = html.replace(/<script src="milex-download\.js"><\/script>\s*/, '');
    return new Blob([html], {type:'text/html;charset=utf-8'});
  }

  function gateJs(issued, role, site){
    return 'var ISSUED=' + issued + ',DAYS=' + COPY_DAYS + ',ROLE="' + role + '",SITE=' + JSON.stringify(site) + ',SEEN="milexBundleSeen_"+ROLE;' +
      'function milexBlock(m){try{sessionStorage.removeItem("milexTeacherSession");sessionStorage.removeItem("milexAssistantSession");localStorage.removeItem("milexTeacherSession");localStorage.removeItem("milexAssistantSession");localStorage.removeItem("mgAssistantOk");}catch(e){}' +
      'document.documentElement.classList.add("milex-bundle");document.body.innerHTML=\'<div style="min-height:100vh;display:flex;flex-direction:column;gap:18px;align-items:center;justify-content:center;padding:24px;text-align:center;font:600 18px Cairo,sans-serif;line-height:1.9"><div>\'+m+\'</div>\'+(SITE?\'<a href="\'+SITE+\'index.html?renew=\'+ROLE+\'" style="background:#0B3A87;color:#fff;text-decoration:none;padding:12px 26px;border-radius:12px">⬇ تحديث النسخة</a>\':"")+\'</div>\';}' +
      'async function milexGate(){var seen=0;try{seen=Number(localStorage.getItem(SEEN))||0;}catch(e){}' +
      'if(Date.now()>Math.max(seen,ISSUED)+DAYS*86400000)return "انتهت صلاحية النسخة دي. اضغط تحديث وحمّل نسخة جديدة.";' +
      'try{var r=await supa.from("app_config").select("value").eq("key","' + REVOKE_KEY + '").maybeSingle();if(r.error)throw r.error;' +
      'var v=r.data&&r.data.value;var ts=v&&typeof v==="object"?Number(v.ts):Number(v);if(ts&&ts>ISSUED)return "النسخة دي اتلغت من المدرس. اضغط تحديث وحمّل نسخة جديدة.";' +
      'try{localStorage.setItem(SEEN,String(Date.now()));}catch(e){}' +
      '}catch(e){}' +
      'return "";}';
  }

  function bootTeacher(issued, site){
    return '<script>(async function(){document.documentElement.classList.add("milex-bundle");' + gateJs(issued, 'teacher', site) +
      'var bad=await milexGate();if(bad){milexBlock(bad);return;}' +
      'try{var v=JSON.stringify({exp:Date.now()+4*60*60*1000});sessionStorage.setItem("milexTeacherSession",v);localStorage.removeItem("milexTeacherSession");}catch(e){}' +
      'showHub();})();<\/script>\n';
  }
  function bootAssistant(pw, issued, site){
    return '<script>(async function(){document.documentElement.classList.add("milex-bundle");' + gateJs(issued, 'assistant', site) +
      'var bad=await milexGate();if(bad){try{await supa.auth.signOut();}catch(e){}milexBlock(bad);return;}' +
      'var PW=decodeURIComponent(escape(atob("' + b64(pw) + '")));' +
      'try{var s=await supa.auth.getSession();' +
      'if(!(s.data&&s.data.session)){var r=await supa.auth.signInWithPassword({email:ASSISTANT_EMAIL,password:PW});if(r.error)throw r.error;}' +
      'sessionStorage.setItem("milexAssistantSession",JSON.stringify({exp:Date.now()+4*60*60*1000}));localStorage.removeItem("milexAssistantSession");localStorage.removeItem("mgAssistantOk");showAssistantHub();' +
      '}catch(e){document.documentElement.classList.remove("milex-bundle");openAssistantOverlay();}})();<\/script>\n';
  }
  async function buildBundle(role, pw){
    await loadScript(JSZIP_URL);
    var cfg = BUNDLES[role], zip = new window.JSZip();
    var idx = await getText('index.html');
    idx = idx.replace(/<script src="milex-download\.js"><\/script>\s*/, '');
    idx = idx.replace(/<div class="overlay" id="dlPwOverlay">[\s\S]*?<!-- \/dlPwOverlay -->/, '');
    idx = idx.replace('</head>', CSS_HIDE + '\n</head>');
    var marker = '<!-- MilEX EDU PWA';
    var issued = Date.now(), site = new URL('./', location.href).href;
    if(!/^https?:/.test(site)) site = '';
    var boot = role === 'teacher' ? bootTeacher(issued, site) : bootAssistant(pw, issued, site);
    lastExpires = issued + COPY_DAYS * 86400000;
    if(idx.indexOf(marker) === -1) throw new Error('marker');
    idx = idx.replace(marker, boot + marker);
    zip.file('index.html', idx);
    var files = cfg.pages.concat(COMMON);
    for(var i = 0; i < files.length; i++){
      var f = files[i];
      zip.file(f, /\.(png)$/.test(f) ? await getBlob(f) : await getText(f));
    }
    zip.file('README.txt', (role === 'teacher' ?
      'MilEX - Teacher copy\nOpen index.html - it enters the teacher page directly (no password).\n' :
      'MilEX - Assistant copy\nOpen index.html - it signs in automatically.\n') +
      'Renews itself each time it is opened online; expires after ' + COPY_DAYS + ' days unused (press Update), and the teacher can cancel every copy from the site. Needs internet (the data lives online).\n' +
      'Keep this folder private: anyone who has it can enter.\n' +
      'Tip: extract the zip first, then open index.html (Chrome / Edge work best).\n');
    return zip.generateAsync({type:'blob'});
  }

  function setBusy(btn, on){
    if(!btn) return;
    if(on){ btn.dataset.old = btn.textContent; btn.textContent = t('جاري التحميل...', 'Preparing...'); btn.disabled = true; }
    else { btn.textContent = btn.dataset.old || btn.textContent; btn.disabled = false; }
  }
  async function run(role, btn, pw){
    setBusy(btn, true);
    try{
      if(role === 'parent') save(await buildParent(), 'MilEX-Parent-Portal.html');
      else{
        save(await buildBundle(role, pw), BUNDLES[role].zip + '.zip');
        try{ if(window.MILEX) MILEX.audit(window.supa || supa, { action:'download_bundle', details:{ role:role, expires:new Date(lastExpires).toISOString() } }); }catch(e){}
      }
    }catch(e){
      console.error(e);
      alert(t('تعذّر تجهيز الملف. تأكد إنك فاتح الموقع أونلاين (مش ملف على الجهاز) وجرّب تاني.', 'Could not prepare the file. Make sure you opened the site online, then try again.'));
    }finally{ setBusy(btn, false); }
  }

  var pending = null, lastExpires = 0;
  window.MILEX_DL = {
    start: function(role, btn){
      if(role !== 'assistant') return run(role, btn);
      pending = btn || null;
      var o = document.getElementById('dlPwOverlay');
      document.getElementById('dlPwError').classList.remove('show');
      document.getElementById('dlPw').value = '';
      o.classList.add('open'); document.getElementById('dlPw').focus();
    },
    revokeAll: async function(btn){
      if(!confirm(t('تلغي كل النسخ المحمّلة (المدرس والمساعد)؟ أي نسخة قديمة هتتقفل أول ما تتفتح والنت شغال.\n\nلو النسخة عند حد مش واثق فيه، غيّر كمان باسورد المساعد من Supabase.', 'Cancel ALL downloaded copies? Any older copy will lock itself the next time it opens online.\n\nIf someone untrusted has one, also change the assistant password in Supabase.'))) return;
      setBusy(btn, true);
      try{
        var r = await supa.from('app_config').upsert({ key: REVOKE_KEY, value: { ts: Date.now() }, updated_at: new Date().toISOString() });
        if(r.error) throw r.error;
        try{ if(window.MILEX) MILEX.audit(supa, { action:'revoke_bundles' }); }catch(e){}
        alert(t('تم. كل النسخ القديمة اتلغت.', 'Done. All older copies are cancelled.'));
      }catch(e){ console.error(e); alert(t('فشل الإلغاء — اتأكد من جدول app_config والنت.', 'Revoke failed - check the app_config table and your connection.')); }
      finally{ setBusy(btn, false); }
    },
    cancel: function(){ document.getElementById('dlPwOverlay').classList.remove('open'); },
    confirm: async function(){
      var pw = document.getElementById('dlPw').value, err = document.getElementById('dlPwError');
      err.classList.remove('show');
      if(!pw){ err.classList.add('show'); return; }
      try{

        var chk = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth:{ persistSession:false, autoRefreshToken:false } });
        var r = await chk.auth.signInWithPassword({ email: ASSISTANT_EMAIL, password: pw });
        if(r.error) throw r.error;
      }catch(e){ err.classList.add('show'); return; }
      this.cancel();
      await run('assistant', pending, pw);
    }
  };

  window.addEventListener('load', function(){
    var role = new URLSearchParams(location.search).get('renew');
    if(role !== 'teacher' && role !== 'assistant') return;
    try{ history.replaceState(null, '', location.pathname); }catch(e){}
    var done = false;
    function banner(){
      if(done) return; done = true;
      var b = document.createElement('button'); b.type = 'button';
      b.textContent = t('⬇ اضغط هنا لتحميل النسخة الجديدة', '⬇ Tap to download the new copy');
      b.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:9999;background:#0B3A87;color:#fff;border:0;border-radius:12px;padding:12px 22px;font:700 15px Cairo,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.3);cursor:pointer';
      b.onclick = function(){ window.MILEX_DL.start(role, b); setTimeout(function(){ if(role==='teacher') b.remove(); }, 800); };
      document.body.appendChild(b);
    }
    var origHub = window.showHub, origAHub = window.showAssistantHub;
    if(typeof origHub === 'function') window.showHub = function(){ origHub.apply(this, arguments); if(role === 'teacher') banner(); };
    if(typeof origAHub === 'function') window.showAssistantHub = function(){ origAHub.apply(this, arguments); if(role === 'assistant') banner(); };
    if(typeof window.selectRole === 'function') window.selectRole(role, document.createElement('div'));
  });
})();
