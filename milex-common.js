
(function(){
  try{
    // Remove markers written by older releases so a stale localStorage value
    // cannot unlock a protected page in a new browser tab.
    localStorage.removeItem('milexTeacherSession');
    localStorage.removeItem('milexAssistantSession');
    localStorage.removeItem('mgAssistantOk');
  }catch(e){}
  const GRADES = {
    first_prep:       { ar:"الصف الأول الإعدادي",  att:"حضور_أولى_إعدادي", pay:"دفع_أولى_إعدادي", scanner:"prep1",  reg:"First Prep"   },
    second_prep:      { ar:"الصف الثاني الإعدادي", att:"حضور_تانية_إعدادي", pay:"دفع_تانية_إعدادي", scanner:"prep2",  reg:"Second Prep"  },
    third_prep:       { ar:"الصف الثالث الإعدادي", att:"حضور_تالتة_إعدادي", pay:"دفع_تالتة_إعدادي", scanner:"prep3",  reg:"Third Prep"   },
    first_secondary:  { ar:"الصف الأول الثانوي",   att:"حضور_أولى_ثانوي",   pay:"دفع_أولى_ثانوي",   scanner:"first",  reg:"First Grade"  },
    second_secondary: { ar:"الصف الثاني الثانوي",  att:"حضور_تانية_ثانوي",  pay:"دفع_تانية_ثانوي",  scanner:"second", reg:"Second Grade" },
    third_secondary:  { ar:"الصف الثالث الثانوي",  att:"حضور_تالتة_ثانوي",  pay:"دفع_تالتة_ثانوي",  scanner:"third",  reg:"Third Grade"  }
  };

  const LEGACY = {
    "prep1-sattue-3": {id:"سبت وثلاث 3",        dayAr:"سبت وتلات", time:"3:00"},
    "prep2-sattue-4": {id:"سبت وثلاث 4",        dayAr:"سبت وتلات", time:"4:00"},
    "prep3-sattue-2": {id:"سبت وثلاث 2",        dayAr:"سبت وتلات", time:"2:00"},
    "sec1-sunwed-2":  {id:"الأحد والأربعاء 2",  dayAr:"حد واربع",  time:"2:00"},
    "sec2-sunwed-3":  {id:"الأحد والأربعاء 3",  dayAr:"حد واربع",  time:"3:00"},
    "sec2-sunwed-6":  {id:"الأحد والأربعاء 6",  dayAr:"حد واربع",  time:"6:00"},
    "sec3-sunwed-12": {id:"الأحد والأربعاء 12", dayAr:"حد واربع",  time:"12:00"},
    "sec3-sunwed-5":  {id:"الأحد والأربعاء 5",  dayAr:"حد واربع",  time:"5:00"}
  };
  const DEFAULT_GROUPS = {
    first_prep:["prep1-sattue-3"], second_prep:["prep2-sattue-4"], third_prep:["prep3-sattue-2"],
    first_secondary:["sec1-sunwed-2"], second_secondary:["sec2-sunwed-3","sec2-sunwed-6"],
    third_secondary:["sec3-sunwed-12","sec3-sunwed-5"]
  };

  function teacherOk(){
    try{
      const raw = sessionStorage.getItem('milexTeacherSession');
      if(!raw) return false;
      const d = JSON.parse(raw);
      return !!(d && d.exp && Date.now() < d.exp);
    }catch(e){ return false; }
  }

  function assistantOk(){
    try{
      const raw = sessionStorage.getItem('milexAssistantSession');
      if(!raw) return false;
      const d = JSON.parse(raw);
      return !!(d && d.exp && Date.now() < d.exp);
    }catch(e){ return false; }
  }

  function assistantName(){
    try{
      const raw = sessionStorage.getItem('milexStaff');
      const d = raw ? JSON.parse(raw) : null;
      return (d && d.name) ? String(d.name) : 'المساعد';
    }catch(e){ return 'المساعد'; }
  }

  window.MILEX = {
    GRADES,
    teacherOk,
    assistantOk,

    actor(){
      let r = null;
      try{ r = sessionStorage.getItem('milexActiveRole') || localStorage.getItem('milexActiveRole'); }catch(e){}
      const t = teacherOk(), a = assistantOk();
      if(r === 'assistant' && a) return { role:'assistant', name:assistantName() };
      if(r === 'teacher' && t)   return { role:'teacher',   name:'المدرس' };
      if(a && !t) return { role:'assistant', name:assistantName() };
      return t ? { role:'teacher', name:'المدرس' } : { role:'assistant', name:assistantName() };
    },

    async audit(supa, entry){
      try{
        const a = this.actor();
        const { error } = await supa.from('audit_log').insert({
          actor_role: a.role, actor: a.name,
          action: entry.action, grade: entry.grade || null,
          student_name: entry.student_name || null, qr_code: entry.qr_code || null,
          details: entry.details || null
        });
        if(error) console.warn('audit_log insert failed', error.message);
      }catch(e){ console.warn('audit_log insert failed', e); }
    },

    async loadGroups(supa){
      const out = {};
      Object.keys(GRADES).forEach(k => out[k] = []);
      let cfg = null;
      try{
        const { data } = await supa.from('app_config').select('value').eq('key','reg_form_data').maybeSingle();
        if(data && data.value && Array.isArray(data.value.stages)) cfg = data.value;
      }catch(e){}
      if(cfg){
        const byReg = {};
        Object.entries(GRADES).forEach(([k,g]) => byReg[g.reg] = k);
        cfg.stages.forEach(st => (st.grades||[]).forEach(gr => {
          const key = byReg[gr.value]; if(!key) return;
          (gr.groups||[]).forEach(g => {
            const time = String(g.time||''); const short = time.replace(':00','');
            const l = LEGACY[g.value];
            const id = (l && l.dayAr === g.dayAr && l.time === time) ? l.id : `${g.dayAr} ${short}`;
            out[key].push({ id, label:`${g.dayAr} - الساعة ${short}` });
          });
        }));
      } else {
        Object.entries(DEFAULT_GROUPS).forEach(([k,vals]) => vals.forEach(v => {
          const l = LEGACY[v]; out[k].push({ id:l.id, label:`${l.dayAr} - الساعة ${l.time.replace(':00','')}` });
        }));
      }
      return out;
    }
  };
})();


/* ======================================================================
   صلاحيات المساعدين + حماية الصفحات (بتشتغل فوق MILEX الأساسي)
   - كل صفحة تقدر تحط:  <meta name="milex-perm" content="edit">
       content = اسم صلاحية | teacher (للمدرس بس) | any (أي حد داخل)
   - أي عنصر عليه data-perm="payments" بيتخفي لو المستخدم معندوش الصلاحية.
   ====================================================================== */
(function(){
  const M = window.MILEX; if(!M) return;
  const SUPA_URL = "https://evbjulsahncllewwvlxp.supabase.co";
  const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2Ymp1bHNhaG5jbGxld3d2bHhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NzE5MjUsImV4cCI6MjA5OTI0NzkyNX0.Xg9sU6ZenUU3kC2RNIbvZmK19KvE28MM2oyGcKNn8UA";

  // الصلاحيات اللي المدرس يقدر يدّيها للمساعد
  M.PERMS = [
    { key:'attendance',   ar:'تسجيل الحضور',            hint:'السكانر في وضع الحضور' },
    { key:'payments',     ar:'تسجيل المدفوعات والإيصالات', hint:'وضع الدفع في السكانر + الإيصالات' },
    { key:'register',     ar:'تسجيل طالب جديد',          hint:'صفحة التسجيل' },
    { key:'search',       ar:'بحث الطلاب',               hint:'البحث + البحث السريع' },
    { key:'edit',         ar:'تعديل بيانات الطلاب',       hint:'تعديل الاسم/المجموعة/الأرقام' },
    { key:'delete',       ar:'حذف الطلاب',               hint:'حذف نهائي — خطيرة' },
    { key:'exams',        ar:'إدارة الامتحانات والدرجات', hint:'إدخال درجات الامتحانات' },
    { key:'online_exams', ar:'الامتحانات الأونلاين',      hint:'إنشاء وإدارة الامتحانات الأونلاين' },
    { key:'groups',       ar:'المجاميع والمواعيد',        hint:'تعديل أيام وأوقات المجاميع' },
    { key:'reports',      ar:'التقارير ولوحة الشرف',      hint:'التقرير الشهري + لوحة الشرف' },
    { key:'materials',    ar:'الواجبات والمواد',          hint:'رفع ملفات وفيديوهات للمجموعات' },
    { key:'dashboard',    ar:'لوحة المتابعة',             hint:'الإحصائيات والتحليلات' }
  ];
  M.DEFAULT_ASSISTANT_PERMS = ['attendance','payments','register','search'];
  const TEACHER_ONLY = ['staff','backup','notes','audit','teacher'];

  M.staff = function(){
    try{ const r = sessionStorage.getItem('milexStaff'); return r ? JSON.parse(r) : null; }catch(e){ return null; }
  };
  M.setStaff = function(info){
    try{
      if(!info){ sessionStorage.removeItem('milexStaff'); return; }
      sessionStorage.setItem('milexStaff', JSON.stringify(info));
    }catch(e){}
  };

  M.can = function(key){
    if(!key || key === 'any') return M.teacherOk() || M.assistantOk();
    if(String(key).indexOf('|') >= 0) return String(key).split('|').some(function(k){ return M.can(k.trim()); });   // 'a|b' = أي واحدة منهم
    const a = M.actor();
    const isTeacher = a.role === 'teacher' && M.teacherOk();
    if(TEACHER_ONLY.indexOf(key) >= 0) return isTeacher;
    if(isTeacher) return true;
    if(!M.assistantOk()) return false;
    const s = M.staff();
    if(!s || !s.exists || s.legacy) return true;            // حسابات قديمة لسه متسجلتش: زي ما كانت
    if(s.role === 'teacher') return true;                    // حساب مدرس داخل من بوابة المساعد
    return Array.isArray(s.perms) && s.perms.indexOf(key) >= 0;
  };

  M.applyPerms = function(root){
    (root || document).querySelectorAll('[data-perm]').forEach(function(el){
      const ok = M.can(el.getAttribute('data-perm'));
      el.style.display = ok ? '' : 'none';
    });
  };

  function kickOut(){
    ['milexTeacherSession','milexAssistantSession','milexStaff','mgAssistantOk'].forEach(function(k){
      try{ sessionStorage.removeItem(k); localStorage.removeItem(k); }catch(e){}
    });
    location.replace('index.html');
  }

  function denyScreen(msg){
    if(document.getElementById('milexDenied')) return;
    const d = document.createElement('div');
    d.id = 'milexDenied';
    d.setAttribute('dir','rtl');
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(6,31,85,.92);font-family:Cairo,system-ui,sans-serif';
    d.innerHTML = '<div style="background:#fff;color:#101B33;max-width:360px;width:100%;border-radius:18px;padding:26px 22px;text-align:center;border-top:5px solid #A8D400;box-shadow:0 24px 60px rgba(0,0,0,.4)">'
      + '<div style="font-size:42px;margin-bottom:6px">🔒</div>'
      + '<h2 style="margin:0 0 8px;font-size:19px">' + (msg || 'الصفحة دي مش متاحة لحسابك') + '</h2>'
      + '<p style="margin:0 0 18px;color:#5C6A80;font-size:14px;line-height:1.7">اطلب من المدرس يفعّل الصلاحية دي لحسابك.</p>'
      + '<button type="button" id="milexDeniedBtn" style="width:100%;padding:12px;border:0;border-radius:12px;background:#0B3A87;color:#fff;font:700 15px Cairo,system-ui,sans-serif;cursor:pointer">رجوع للقائمة الرئيسية</button></div>';
    document.body.appendChild(d);
    document.getElementById('milexDeniedBtn').onclick = function(){ location.href = 'index.html'; };
  }

  M.guardMeta = function(){
    const meta = document.querySelector('meta[name="milex-perm"]');
    if(!meta) return true;
    const need = (meta.getAttribute('content') || 'any').trim();
    if(!(M.teacherOk() || M.assistantOk())){ location.replace('index.html'); return false; }
    if(!M.can(need)){
      denyScreen(need === 'teacher' ? 'الصفحة دي للمدرس فقط' : 'مش مسموح لك تفتح الصفحة دي');
      return false;
    }
    const d = document.getElementById('milexDenied'); if(d) d.remove();
    return true;
  };

  // يقرا الـ access token اللي supabase-js حاطّه في localStorage (من غير ما نعمل client تاني)
  function accessToken(){
    try{
      const key = 'sb-' + SUPA_URL.replace(/^https?:\/\//,'').split('.')[0] + '-auth-token';
      const raw = localStorage.getItem(key); if(!raw) return null;
      const j = JSON.parse(raw);
      const tok = j && (j.access_token || (j.currentSession && j.currentSession.access_token));
      const exp = j && (j.expires_at || (j.currentSession && j.currentSession.expires_at));
      if(exp && Date.now()/1000 > exp + 30) return null;
      return tok || null;
    }catch(e){ return null; }
  }

  // بيحدّث صلاحيات المستخدم من السيرفر (لو المدرس غيّرها أو وقف الحساب)
  M.syncStaff = async function(){
    const tok = accessToken(); if(!tok) return null;
    try{
      const res = await fetch(SUPA_URL + '/rest/v1/rpc/staff_me', {
        method:'POST',
        headers:{ 'apikey':SUPA_KEY, 'Authorization':'Bearer ' + tok, 'Content-Type':'application/json' },
        body:'{}'
      });
      if(!res.ok) return null;                                // الـ migration لسه متشغلش → وضع قديم
      const info = await res.json();
      if(!info || !info.exists) return info;
      if(info.active === false){ kickOut(); return info; }
      const prev = M.staff() || {};
      M.setStaff(Object.assign({}, prev, info, { legacy:false }));
      return info;
    }catch(e){ return null; }
  };

  function boot(){
    if(!M.guardMeta()) return;
    M.applyPerms();
    M.syncStaff().then(function(info){
      if(!info) return;
      M.applyPerms();
      M.guardMeta();
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
