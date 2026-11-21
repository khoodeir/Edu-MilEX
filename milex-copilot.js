(function(){
  const M = window.MILEX;
  if(!M || window.MILEX_COPILOT) return;

  /* ===================== شخصية المساعدة ===================== */
  const BOT = {
    name: "نور",
    role: "مساعدتك الشخصية في MilEX",
    // نفس النص ده ينفع تحطه في system prompt بتاع الدالة milex-copilot على السيرفر
    persona: "أنتِ «نور»، المساعدة الشخصية لمدرس مركز MilEX. بتتكلمي بالعامية المصرية بدفء واحترام وثقة، وبتنادي المدرس «يا أستاذ». " +
             "ردودك قصيرة ومباشرة: ابدئي بالمهم، وبعد كده اقترحي الخطوة الجاية. لما تعرضي قوايم طلاب أو أرقام استخدمي جدول. " +
             "ما تخترعيش أي رقم أو اسم: كل معلومة لازم تيجي من البيانات الفعلية، ولو مش متأكدة قولي كده بصراحة. " +
             "أي تعديل أو كتابة بيتنفذ بعد تأكيد المدرس بس."
  };

  const URL_ = "https://evbjulsahncllewwvlxp.supabase.co";
  const KEY_ = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2Ymp1bHNhaG5jbGxld3d2bHhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NzE5MjUsImV4cCI6MjA5OTI0NzkyNX0.Xg9sU6ZenUU3kC2RNIbvZmK19KvE28MM2oyGcKNn8UA";
  const ENDPOINT = URL_ + "/functions/v1/milex-copilot";
  const HIST_KEY = "milexCopilotHistory";
  const INTRO_KEY = "milexNourIntro";
  const PERSONA_IN_MESSAGES = true; // بيبعت تعريف الشخصية مع كل طلب (لو السيرفر مش بيقرا حقل persona)

  const FIELD_AR = { full_name:"الاسم", student_phone:"موبايل الطالب", parent_phone:"موبايل ولي الأمر", city:"المدينة", group_name:"المجموعة", behavior:"سلوك", level:"مستوى", note:"ملاحظة" };

  const BRIEF_PROMPT = "اديني ملخص يومي: الغياب والمدفوعات وأي حاجة محتاجة متابعة، في جدول مختصر.";
  const QUICK = [
    { ic:"☀️", t:"ملخص يومي",         q: BRIEF_PROMPT },
    { ic:"🚫", t:"الغياب المتتالي",    q:"مين الطلاب اللي غابوا أكتر من مرتين ورا بعض؟" },
    { ic:"💰", t:"غير الدافعين",       q:"مين لسه ما دفعش الشهر ده؟" },
    { ic:"📊", t:"آخر امتحان",         q:"اعرض نتايج آخر امتحان" },
    { ic:"👥", t:"المجموعات",          q:"ورّيني المجموعات وعدد الطلاب في كل واحدة" },
    { ic:"🧾", t:"إجمالي المدفوعات",   q:"إجمالي المدفوعات الشهر ده كام؟" }
  ];

  let root, dock, fab, bubble, panel, list, input, sendBtn, chipsBox, statusEl;
  let busy = false, built = false, history = [], introRunning = false, introTimers = [], lastText = "";

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const reduceMotion = () => { try{ return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } };

  function isTeacher(){
    try{
      if(!M.teacherOk()) return false;
      const a = M.actor();
      return !!(a && a.role === "teacher");
    }catch(e){ return false; }
  }

  function session(){
    try{
      const key = "sb-" + URL_.replace(/^https?:\/\//,"").split(".")[0] + "-auth-token";
      return JSON.parse(localStorage.getItem(key) || "null") || {};
    }catch(e){ return {}; }
  }
  function token(){ const j = session(); return j.access_token || ""; }
  function teacherName(){
    try{
      const u = session().user || {};
      const md = u.user_metadata || {};
      const n = md.full_name || md.name || "";
      return n ? String(n).trim().split(/\s+/)[0] : "";
    }catch(e){ return ""; }
  }
  function greeting(){
    const h = new Date().getHours();
    return h >= 5 && h < 12 ? "صباح الخير" : h >= 12 && h < 18 ? "نهارك سعيد" : "مساء الخير";
  }

  function loadHistory(){ try{ history = JSON.parse(sessionStorage.getItem(HIST_KEY) || "[]") || []; }catch(e){ history = []; } }
  function saveHistory(){ try{ sessionStorage.setItem(HIST_KEY, JSON.stringify(history.slice(-40))); }catch(e){} }

  /* ---------- تنسيق الردود (فقرات، قوايم، جداول، bold) ---------- */
  function inline(s){ return s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>"); }
  function fmt(text){
    const lines = esc(text).split("\n");
    let out = "", inList = false, i = 0;
    const isRow = l => /^\s*\|.*\|\s*$/.test(l);
    const isSep = l => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
    const cells = l => l.trim().replace(/^\||\|$/g,"").split("|").map(c => inline(c.trim()));
    while(i < lines.length){
      const raw = lines[i];
      if(isRow(raw) && i + 1 < lines.length && isSep(lines[i+1])){
        if(inList){ out += "</ul>"; inList = false; }
        const head = cells(raw); i += 2;
        let body = "";
        while(i < lines.length && isRow(lines[i])){
          body += "<tr>" + cells(lines[i]).map(c => "<td>" + c + "</td>").join("") + "</tr>"; i++;
        }
        out += '<div class="nr-tbl"><table><thead><tr>' + head.map(c => "<th>" + c + "</th>").join("") + "</tr></thead><tbody>" + body + "</tbody></table></div>";
        continue;
      }
      const l = inline(raw);
      const m = l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
      if(m){
        if(!inList){ out += "<ul>"; inList = true; }
        out += "<li>" + m[1] + "</li>";
      }else{
        if(inList){ out += "</ul>"; inList = false; }
        out += l.trim() ? "<p>" + l + "</p>" : "";
      }
      i++;
    }
    if(inList) out += "</ul>";
    return out;
  }

  /* ===================== الأفاتار ===================== */
  const AVATAR = '<svg class="nr-av" viewBox="0 0 100 100" aria-hidden="true">' +
    '<path d="M20 54C20 27 34 14 50 14s30 13 30 40v12c0 6-4 10-8 10H28c-4 0-8-4-8-10z" fill="#1B2540"/>' +
    '<path d="M22 100c2-17 14-23 28-23s26 6 28 23z" fill="#A8D400"/>' +
    '<path d="M42 80l8 8 8-8" fill="#fff" opacity=".9"/>' +
    '<rect x="43" y="64" width="14" height="16" rx="6" fill="#E3AE86"/>' +
    '<ellipse cx="50" cy="49" rx="22" ry="25" fill="#F3C9A3"/>' +
    '<path d="M27 47c1-19 14-25 27-23 11 2 19 11 19 23-6-9-15-13-23-13-9 0-17 5-23 13z" fill="#1B2540"/>' +
    '<g class="nr-eyes"><ellipse cx="41" cy="52" rx="2.8" ry="3.6" fill="#1B2540"/><ellipse cx="59" cy="52" rx="2.8" ry="3.6" fill="#1B2540"/>' +
    '<circle cx="42" cy="50.6" r="1" fill="#fff"/><circle cx="60" cy="50.6" r="1" fill="#fff"/></g>' +
    '<path d="M36 44.5q5-3 10-.5M54 44q5-2.5 10 .5" stroke="#1B2540" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
    '<circle cx="34.5" cy="60" r="4" fill="#F28B82" opacity=".42"/><circle cx="65.5" cy="60" r="4" fill="#F28B82" opacity=".42"/>' +
    '<path class="nr-smile" d="M43 61.5q7 7.5 14 0" stroke="#8A3B2E" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
    '<ellipse class="nr-mouth" cx="50" cy="64" rx="4.6" ry="3.2" fill="#8A3B2E"/>' +
    '<path d="M25 49a25 25 0 0 1 50 0" stroke="#0B3A87" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    '<rect x="20.5" y="47" width="7" height="14" rx="3.5" fill="#0B3A87"/><rect x="72.5" y="47" width="7" height="14" rx="3.5" fill="#0B3A87"/>' +
    '<path d="M76 59q0 11-15 13" stroke="#0B3A87" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="59.5" cy="72" r="3" fill="#A8D400"/></svg>';

  const ICON_SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l16-8-6 16-3-7-7-1z"/></svg>';
  const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/></svg>';
  const ICON_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';

  /* ===================== الستايل ===================== */
  const CSS = `
  #mxc{position:fixed;inset:0;pointer-events:none;z-index:2147480000;font-family:Cairo,system-ui,sans-serif;direction:rtl;
    --c-bg:#fff;--c-ink:#101B33;--c-mut:#5C6A80;--c-line:#DCE3ED;--c-soft:#F3F6FB;--c-acc:#0B3A87;--c-acc2:#061F55;--c-lime:#A8D400;--c-ok:#2E7D32;--c-err:#B3261E}
  #mxc.dark{--c-bg:#1F1F1F;--c-ink:#E6EEFB;--c-mut:#9FB3D4;--c-line:rgba(180,205,240,.18);--c-soft:#2A2A2A;--c-acc:#5B93E6;--c-acc2:#9DB8E8;--c-ok:#6FCF73;--c-err:#FF8A80}
  #mxc *{box-sizing:border-box}
  #mxc [hidden]{display:none!important}

  /* ----- الأفاتار ----- */
  .nr-av{width:100%;height:100%;display:block;border-radius:50%}
  .nr-eyes{transform-box:fill-box;transform-origin:center;animation:nrBlink 4.6s infinite}
  .nr-mouth{display:none;transform-box:fill-box;transform-origin:center}
  .talking .nr-smile{display:none}.talking .nr-mouth{display:block;animation:nrTalk .32s infinite alternate ease-in-out}
  .nr-face{position:relative;border-radius:50%;background:radial-gradient(circle at 30% 25%,#2D5FB8,#0B3A87 60%,#061F55);overflow:hidden}
  @keyframes nrBlink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.08)}}
  @keyframes nrTalk{from{transform:scaleY(.35)}to{transform:scaleY(1.15)}}

  /* ----- الدوك (الأفاتار العايم) ----- */
  .nr-dock{position:fixed;right:18px;bottom:18px;pointer-events:none;display:flex;align-items:flex-end;gap:12px;direction:rtl}
  .nr-fab{pointer-events:auto;position:relative;width:66px;height:66px;border:0;padding:0;background:none;cursor:pointer;border-radius:50%;
    transform-origin:right bottom;filter:drop-shadow(0 10px 22px rgba(6,31,85,.38));animation:nrIn .7s cubic-bezier(.2,1.3,.4,1) both}
  .nr-fab .nr-face{width:100%;height:100%;border:3px solid #fff;animation:nrFloat 3.8s ease-in-out infinite}
  .nr-fab::before{content:"";position:absolute;inset:-6px;border-radius:50%;border:2px solid var(--c-lime);opacity:0;animation:nrRing 2.8s infinite}
  .nr-fab:hover .nr-face{animation-play-state:paused;transform:scale(1.07)}
  .nr-dot{position:absolute;right:2px;bottom:3px;width:15px;height:15px;border-radius:50%;background:var(--c-lime);border:3px solid #fff;z-index:2}
  .nr-wave{position:absolute;top:-22px;left:-14px;font-size:30px;transform-origin:70% 80%;opacity:0;pointer-events:none}
  .nr-spark{position:absolute;left:50%;top:50%;width:9px;height:9px;margin:-4.5px;border-radius:50%;background:var(--c-lime);pointer-events:none;opacity:0;animation:nrSpark .95s ease-out forwards}
  .nr-spark:nth-child(3n){background:#5B93E6}.nr-spark:nth-child(4n){background:#fff;width:6px;height:6px}
  @keyframes nrIn{from{opacity:0;transform:translateX(140px) rotate(24deg) scale(.4)}to{opacity:1;transform:none}}
  @keyframes nrFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
  @keyframes nrRing{0%{transform:scale(.92);opacity:.7}80%,100%{transform:scale(1.4);opacity:0}}
  @keyframes nrSpark{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.2)}}
  @keyframes nrWave{0%,100%{transform:rotate(0)}20%{transform:rotate(22deg)}40%{transform:rotate(-14deg)}60%{transform:rotate(22deg)}80%{transform:rotate(-8deg)}}
  @keyframes nrPop{0%{opacity:0;transform:translateY(10px) scale(.92)}100%{opacity:1;transform:none}}

  /* لحظة الدخول: نور بتكبر وتسلّم */
  #mxc.intro .nr-fab{animation:nrIntro 1.1s cubic-bezier(.2,1.25,.4,1) both;width:96px;height:96px}
  #mxc.intro .nr-wave{opacity:1;animation:nrWave 1.6s .9s 2}
  #mxc.intro .nr-dock{bottom:26px}
  @keyframes nrIntro{0%{opacity:0;transform:translateX(220px) rotate(30deg) scale(.3)}55%{opacity:1;transform:translateX(-14px) rotate(-6deg) scale(1.08)}78%{transform:translateX(4px) rotate(3deg) scale(.98)}100%{transform:none}}
  .nr-fab,.nr-bubble{transition:width .5s cubic-bezier(.3,1.2,.4,1),height .5s cubic-bezier(.3,1.2,.4,1)}

  /* ----- فقاعة الكلام ----- */
  .nr-bubble{pointer-events:auto;position:relative;max-width:310px;margin-bottom:10px;background:var(--c-bg);color:var(--c-ink);border:1px solid var(--c-line);
    direction:rtl;text-align:right;border-right:4px solid var(--c-lime);border-radius:18px 18px 6px 18px;padding:12px 16px 12px 34px;font-size:14px;line-height:1.85;
    box-shadow:0 18px 44px rgba(16,27,51,.22);animation:nrPop .4s cubic-bezier(.22,.9,.3,1) both}
  .nr-bubble b.nm{color:var(--c-acc)}
  .nr-bubble .x{position:absolute;left:8px;top:6px;border:0;background:none;color:var(--c-mut);font-size:19px;line-height:1;cursor:pointer}
  .nr-bubble .cur{display:inline-block;width:2px;height:1em;background:var(--c-acc);margin-inline-start:2px;vertical-align:-2px;animation:nrCur .7s steps(1) infinite}
  .nr-bubble .acts{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
  @keyframes nrCur{50%{opacity:0}}

  /* ----- اللوحة ----- */
  .mxc-panel,.nr-panel{pointer-events:auto;position:fixed;top:0;bottom:0;right:0;width:min(440px,100vw);display:flex;flex-direction:column;background:var(--c-bg);color:var(--c-ink);
    border-left:1px solid var(--c-line);box-shadow:-24px 0 60px rgba(6,31,85,.22);transform:translateX(104%);visibility:hidden;transition:transform .38s cubic-bezier(.22,.8,.3,1),visibility .38s}
  #mxc.open .nr-panel{transform:translateX(0);visibility:visible}
  #mxc.open .nr-dock{display:none}
  .nr-head{display:flex;align-items:center;gap:12px;padding:13px 16px;color:#fff;background:linear-gradient(135deg,#0B3A87 0%,#061F55 100%);position:relative}
  .nr-head::after{content:"";position:absolute;inset-inline:0;bottom:0;height:3px;background:linear-gradient(90deg,#A8D400,#0B3A87)}
  .nr-head .nr-face{width:46px;height:46px;flex:0 0 auto;border:2px solid rgba(255,255,255,.9)}
  .nr-title{flex:1;min-width:0}
  .nr-title b{display:block;font-size:17px;font-weight:800;line-height:1.3}
  .nr-title small{display:flex;align-items:center;gap:6px;font-size:12px;opacity:.9}
  .nr-title small i{width:7px;height:7px;border-radius:50%;background:#A8D400;display:inline-block}
  .nr-title small.busy i{animation:nrBlinkDot .8s infinite}
  @keyframes nrBlinkDot{50%{opacity:.25}}
  .nr-ibtn{border:0;background:rgba(255,255,255,.14);color:#fff;width:34px;height:34px;border-radius:10px;cursor:pointer;display:grid;place-items:center;transition:background .2s}
  .nr-ibtn:hover{background:rgba(255,255,255,.26)}.nr-ibtn svg{width:18px;height:18px}
  .nr-list{flex:1;overflow-y:auto;padding:18px 14px 8px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth;background:var(--c-soft)}
  .nr-msg{position:relative;max-width:92%;padding:10px 14px;border-radius:16px;font-size:14px;line-height:1.85;word-wrap:break-word;animation:nrPop .28s ease both}
  .nr-msg p{margin:0 0 6px}.nr-msg p:last-child{margin:0}
  .nr-msg ul{margin:4px 0 6px;padding-inline-start:20px}.nr-msg li{margin:2px 0}
  .nr-msg code{background:var(--c-soft);padding:1px 6px;border-radius:6px;font-size:12.5px}
  .nr-user{align-self:flex-start;background:linear-gradient(135deg,#0B3A87,#2D5FB8);color:#fff;border-end-start-radius:4px}
  .nr-bot{align-self:flex-end;background:var(--c-bg);border:1px solid var(--c-line);border-end-end-radius:4px;padding-bottom:12px}
  .nr-bot.err{border-color:var(--c-err);color:var(--c-err)}
  .nr-copy{position:absolute;left:6px;bottom:-12px;width:26px;height:26px;border-radius:8px;border:1px solid var(--c-line);background:var(--c-bg);color:var(--c-mut);cursor:pointer;display:grid;place-items:center;opacity:0;transition:opacity .2s}
  .nr-msg:hover .nr-copy,.nr-copy:focus{opacity:1}.nr-copy svg{width:14px;height:14px}.nr-copy.ok{color:var(--c-ok);border-color:var(--c-ok);opacity:1}
  .nr-tbl{overflow-x:auto;margin:6px -2px 4px;border:1px solid var(--c-line);border-radius:10px}
  .nr-tbl table{border-collapse:collapse;width:100%;font-size:12.5px}
  .nr-tbl th{background:var(--c-soft);color:var(--c-acc);text-align:start;font-weight:700;white-space:nowrap}
  .nr-tbl th,.nr-tbl td{padding:6px 10px;border-bottom:1px solid var(--c-line)}.nr-tbl tr:last-child td{border-bottom:0}
  .nr-typing{display:inline-flex;gap:5px;padding:4px 2px}
  .nr-typing i{width:7px;height:7px;border-radius:50%;background:var(--c-acc);opacity:.35;animation:nrDot 1.1s infinite}
  .nr-typing i:nth-child(2){animation-delay:.18s}.nr-typing i:nth-child(3){animation-delay:.36s}
  @keyframes nrDot{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-4px)}}
  .nr-card{align-self:stretch;background:var(--c-bg);border:1px solid var(--c-line);border-inline-start:4px solid var(--c-lime);border-radius:14px;padding:12px 14px;animation:nrPop .28s ease both}
  .nr-card h4{margin:0 0 8px;font-size:14px;color:var(--c-acc)}
  .nr-row{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:13px;margin-bottom:10px;line-height:1.7}
  .nr-row b{color:var(--c-mut);font-weight:600}.nr-row s{color:var(--c-mut);margin-inline-end:6px}
  .nr-actions{display:flex;gap:8px;flex-wrap:wrap}
  .nr-btn{border:0;border-radius:10px;padding:8px 16px;font:700 13px Cairo,system-ui,sans-serif;cursor:pointer;transition:transform .15s,filter .2s}
  .nr-btn:active{transform:scale(.96)}
  .nr-btn.pri{background:var(--c-acc);color:#fff}.nr-btn.pri:hover{filter:brightness(1.1)}
  .nr-btn.gho{background:var(--c-soft);color:var(--c-ink);border:1px solid var(--c-line)}
  .nr-btn[disabled]{opacity:.55;cursor:default}
  .nr-nav{display:inline-flex;align-items:center;gap:8px;align-self:flex-end;border:1px solid var(--c-acc);color:var(--c-acc);background:var(--c-bg);border-radius:999px;padding:7px 16px;font:700 13px Cairo,system-ui,sans-serif;cursor:pointer;animation:nrPop .28s ease both}
  .nr-nav:hover{background:var(--c-acc);color:#fff}

  /* ----- بطاقات الإجراءات السريعة ----- */
  .nr-quick{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;align-self:stretch;margin-top:2px}
  .nr-q{display:flex;align-items:center;gap:9px;border:1px solid var(--c-line);background:var(--c-bg);color:var(--c-ink);border-radius:14px;padding:10px 12px;font:700 13px Cairo,system-ui,sans-serif;cursor:pointer;text-align:start;transition:transform .15s,border-color .2s,box-shadow .2s}
  .nr-q:hover{border-color:var(--c-acc);box-shadow:0 6px 16px rgba(11,58,135,.12);transform:translateY(-1px)}
  .nr-q span{font-size:20px}
  .nr-chips{display:flex;gap:7px;padding:8px 14px 0;background:var(--c-soft);overflow-x:auto;scrollbar-width:none}.nr-chips::-webkit-scrollbar{display:none}
  .nr-chip{flex:0 0 auto;border:1px solid var(--c-line);background:var(--c-bg);color:var(--c-ink);border-radius:999px;padding:6px 12px;font:600 12px Cairo,system-ui,sans-serif;cursor:pointer;transition:border-color .2s,color .2s}
  .nr-chip:hover{border-color:var(--c-acc);color:var(--c-acc)}

  .nr-foot{padding:10px 12px 12px;background:var(--c-soft);border-top:1px solid var(--c-line)}
  .nr-box{display:flex;align-items:flex-end;gap:6px;background:var(--c-bg);border:1px solid var(--c-line);border-radius:14px;padding:6px 6px 6px 8px;transition:border-color .2s,box-shadow .2s}
  .nr-box:focus-within{border-color:var(--c-acc);box-shadow:0 0 0 3px rgba(11,58,135,.12)}
  #mxc .nr-box textarea,#mxc .nr-box textarea:focus,#mxc .nr-box textarea:focus-visible{outline:0!important;box-shadow:none!important;border:0!important;background:transparent!important;border-radius:0!important}
  .nr-box textarea{flex:1;resize:none;color:var(--c-ink);font:500 14px/1.7 Cairo,system-ui,sans-serif;max-height:120px;padding:6px 8px}
  .nr-send{flex:0 0 auto;width:38px;height:38px;border:0;border-radius:11px;cursor:pointer;display:grid;place-items:center;transition:filter .2s,transform .15s}
  .nr-send{background:var(--c-acc);color:#fff}
  .nr-send:hover{filter:brightness(1.12)}.nr-send:active{transform:scale(.94)}.nr-send[disabled]{opacity:.5;cursor:default}
  .nr-send svg{width:18px;height:18px;transform:scaleX(-1)}
  .nr-note{margin:7px 4px 0;font-size:11px;color:var(--c-mut);text-align:center}

  @media (max-width:560px){
    .nr-dock{right:12px;bottom:14px}.nr-bubble{max-width:calc(100vw - 150px);font-size:13px}
    #mxc.intro .nr-fab{width:80px;height:80px}.nr-panel{width:100vw}.nr-quick{grid-template-columns:1fr 1fr}
  }
  @media print{#mxc{display:none!important}}
  @media (prefers-reduced-motion:reduce){#mxc *{animation:none!important;transition:none!important}#mxc .nr-fab{opacity:1}}
  `;

  function syncTheme(){
    if(!root) return;
    const dark = document.documentElement.getAttribute("data-theme") === "dark" || document.body.classList.contains("dark");
    root.classList.toggle("dark", dark);
  }

  /* ===================== البناء ===================== */
  function faceHTML(){ return '<div class="nr-face">' + AVATAR + "</div>"; }

  function build(){
    if(built) return;
    built = true;
    const st = document.createElement("style");
    st.id = "mxcCss"; st.textContent = CSS;
    document.head.appendChild(st);

    root = document.createElement("div");
    root.id = "mxc"; root.setAttribute("dir","rtl");
    root.innerHTML =
      '<div class="nr-dock" id="nrDock">' +
        '<button type="button" class="nr-fab" id="nrFab" aria-label="افتح المحادثة مع ' + BOT.name + '">' + faceHTML() + '<span class="nr-dot"></span><span class="nr-wave">👋</span></button>' +
        '<div class="nr-bubble" id="nrBubble" hidden></div>' +
      '</div>' +
      '<aside class="nr-panel" id="nrPanel" role="dialog" aria-label="' + BOT.name + ' - مساعدة MilEX">' +
        '<div class="nr-head" id="nrHead">' + faceHTML() +
          '<div class="nr-title"><b>' + BOT.name + '</b><small id="nrStatus"><i></i>' + BOT.role + '</small></div>' +
          '<button type="button" class="nr-ibtn" id="nrClear" title="محادثة جديدة">' + ICON_TRASH + '</button>' +
          '<button type="button" class="nr-ibtn" id="nrClose" title="إغلاق">' + ICON_X + '</button></div>' +
        '<div class="nr-list" id="nrList"></div>' +
        '<div class="nr-chips" id="nrChips"></div>' +
        '<div class="nr-foot"><div class="nr-box"><textarea id="nrInput" rows="1" placeholder="اكتب لـ' + BOT.name + '…"></textarea>' +
        '<button type="button" class="nr-send" id="nrSend" aria-label="إرسال">' + ICON_SEND + '</button></div>' +
        '<div class="nr-note">أي تعديل بيتنفذ بعد ما تأكده بنفسك · اختصار: Ctrl + K</div></div>' +
      '</aside>';
    document.body.appendChild(root);

    dock = root.querySelector("#nrDock"); fab = root.querySelector("#nrFab"); bubble = root.querySelector("#nrBubble");
    panel = root.querySelector("#nrPanel"); list = root.querySelector("#nrList"); input = root.querySelector("#nrInput");
    sendBtn = root.querySelector("#nrSend"); chipsBox = root.querySelector("#nrChips"); statusEl = root.querySelector("#nrStatus");

    fab.addEventListener("click", function(){ endIntro(); open(); });
    root.querySelector("#nrClose").addEventListener("click", close);
    root.querySelector("#nrClear").addEventListener("click", reset);
    sendBtn.addEventListener("click", function(){ send(input.value); });
    input.addEventListener("keydown", function(e){
      if(e.key === "Enter" && !e.shiftKey && !e.isComposing){ e.preventDefault(); send(input.value); }
    });
    input.addEventListener("input", function(){ input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 120) + "px"; });
    // دوس في أي مكان بره إطار الشات يقفله تلقائي
    document.addEventListener("pointerdown", function(e){
      if(!root || !root.classList.contains("open")) return;
      if(panel.contains(e.target)) return;
      close();
    }, true);
    document.addEventListener("keydown", function(e){
      if(!root || root.hidden) return;
      if(e.key === "Escape" && root.classList.contains("open")) close();
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k"){ e.preventDefault(); root.classList.contains("open") ? close() : open(); }
    });

    new MutationObserver(syncTheme).observe(document.documentElement, { attributes:true, attributeFilter:["data-theme","class"] });
    new MutationObserver(syncTheme).observe(document.body, { attributes:true, attributeFilter:["class"] });
    syncTheme();

    loadHistory();
    renderAll();
  }

  /* ===================== حالة نور ===================== */
  function setTalking(on){
    root.querySelectorAll(".nr-face").forEach(function(f){ f.classList.toggle("talking", !!on); });
  }
  function setStatus(txt, busyFlag){
    if(!statusEl) return;
    statusEl.className = busyFlag ? "busy" : "";
    statusEl.innerHTML = "<i></i>" + esc(txt);
  }

  /* ===================== الدخول المميز ===================== */
  function sparks(){
    if(reduceMotion()) return;
    for(let n = 0; n < 18; n++){
      const s = document.createElement("i");
      s.className = "nr-spark";
      const a = (Math.PI * 2 * n) / 18 + Math.random() * .4, d = 60 + Math.random() * 60;
      s.style.setProperty("--dx", Math.cos(a) * d + "px");
      s.style.setProperty("--dy", Math.sin(a) * d + "px");
      s.style.animationDelay = (0.55 + Math.random() * .25) + "s";
      fab.appendChild(s);
      setTimeout(function(){ s.remove(); }, 2000);
    }
  }
  function later(fn, ms){ const t = setTimeout(fn, ms); introTimers.push(t); return t; }

  function typeInto(el, html, speed, done){
    // بيكتب نص عادي حرف حرف، والـ HTML الجاهز (بين <>) بيتحط مرة واحدة
    const parts = html.split(/(<[^>]+>)/).filter(Boolean);
    let pi = 0, ci = 0, out = "";
    setTalking(true);
    (function step(){
      if(!introRunning){ el.innerHTML = html; setTalking(false); return done && done(); }
      if(pi >= parts.length){ el.innerHTML = out; setTalking(false); return done && done(); }
      const p = parts[pi];
      if(p.charAt(0) === "<"){ out += p; pi++; return step(); }
      out += p.charAt(ci++);
      if(ci >= p.length){ pi++; ci = 0; }
      el.innerHTML = out + '<span class="cur"></span>';
      later(step, speed);
    })();
  }

  function playIntro(){
    if(introRunning || !root || root.classList.contains("open")) return;
    let seen = false;
    try{ seen = sessionStorage.getItem(INTRO_KEY) === "1"; }catch(e){}
    if(seen) return;
    try{ sessionStorage.setItem(INTRO_KEY, "1"); }catch(e){}
    introRunning = true;
    root.classList.add("intro");
    // إعادة تشغيل أنيميشن الدخول
    fab.style.animation = "none"; void fab.offsetWidth; fab.style.animation = "";
    later(sparks, 0);

    const n = teacherName();
    const hello = greeting() + (n ? " يا أستاذ <b class=\"nm\">" + esc(n) + "</b>" : " يا أستاذ") + " 👋";
    later(function(){
      bubble.hidden = false;
      bubble.innerHTML = '<button class="x" aria-label="إغلاق">×</button><div id="nrSay"></div><div class="acts" id="nrActs" hidden></div>';
      bubble.querySelector(".x").addEventListener("click", function(){ endIntro(); });
      const say = bubble.querySelector("#nrSay"), acts = bubble.querySelector("#nrActs");
      typeInto(say, hello + "<br>أنا <b class=\"nm\">" + BOT.name + "</b>، " + BOT.role + ".<br>جهّزتلك ملخص يومك — أبدأ بيه؟", 26, function(){
        if(!introRunning) return;
        acts.hidden = false;
        acts.innerHTML = '<button type="button" class="nr-btn pri" id="nrGo">ابدأ الملخص ✨</button><button type="button" class="nr-btn gho" id="nrLater">بعدين</button>';
        acts.querySelector("#nrGo").addEventListener("click", function(){ endIntro(); open(); send(BRIEF_PROMPT); });
        acts.querySelector("#nrLater").addEventListener("click", function(){ endIntro(); });
        later(function(){ endIntro(); }, 14000);
      });
    }, 1150);
  }

  function endIntro(){
    if(!introRunning && !root.classList.contains("intro")) return;
    introRunning = false;
    introTimers.forEach(clearTimeout); introTimers = [];
    setTalking(false);
    root.classList.remove("intro");
    if(bubble){ bubble.hidden = true; bubble.innerHTML = ""; }
  }

  /* ===================== المحادثة ===================== */
  function scrollDown(){ list.scrollTop = list.scrollHeight; }

  function addCopy(d, raw){
    const b = document.createElement("button");
    b.type = "button"; b.className = "nr-copy"; b.title = "نسخ"; b.innerHTML = ICON_COPY;
    b.addEventListener("click", function(){
      try{ navigator.clipboard.writeText(raw); b.classList.add("ok"); setTimeout(function(){ b.classList.remove("ok"); }, 1400); }catch(e){}
    });
    d.appendChild(b);
  }

  function addBubble(role, text, cls){
    const d = document.createElement("div");
    d.className = "nr-msg " + (role === "user" ? "nr-user" : "nr-bot") + (cls ? " " + cls : "");
    d.innerHTML = role === "user" ? "<p>" + esc(text).replace(/\n/g,"<br>") + "</p>" : fmt(text);
    if(role !== "user" && text && text.length > 40 && !cls) addCopy(d, text);
    list.appendChild(d);
    scrollDown();
    return d;
  }

  // رد نور بيتكتب قدامك زي ما بتتكلم
  function addBotTyped(text){
    const d = document.createElement("div");
    d.className = "nr-msg nr-bot";
    list.appendChild(d);
    if(reduceMotion() || text.length < 30 || /\n\s*\|/.test(text)){
      d.innerHTML = fmt(text); if(text.length > 40) addCopy(d, text); scrollDown(); return d;
    }
    const total = Math.min(1900, text.length * 14), tick = 28, per = Math.max(2, Math.ceil(text.length / (total / tick)));
    let n = 0;
    setTalking(true); setStatus("بتكتب…", true);
    const iv = setInterval(function(){
      n += per;
      if(n >= text.length){
        clearInterval(iv); d.innerHTML = fmt(text); if(text.length > 40) addCopy(d, text);
        setTalking(false); setStatus(BOT.role, false);
      }else{
        d.innerHTML = fmt(text.slice(0, n).replace(/\*+$/,""));
      }
      scrollDown();
    }, tick);
    d.addEventListener("click", function(){ if(n < text.length) n = text.length; });
    return d;
  }

  function addNav(n){
    const b = document.createElement("button");
    b.type = "button"; b.className = "nr-nav";
    b.innerHTML = "فتح " + esc(n.label) + " ←";
    b.addEventListener("click", function(){ location.href = n.page; });
    list.appendChild(b);
    scrollDown();
  }

  function addProposal(p){
    const c = document.createElement("div");
    c.className = "nr-card";
    const rows = (p.lines || []).map(function(l){
      const from = l.from ? "<s>" + esc(l.from) + "</s>" : "";
      return "<b>" + esc(FIELD_AR[l.field] || l.field) + "</b><span>" + from + esc(l.to) + "</span>";
    }).join("");
    c.innerHTML = "<h4>" + esc(p.title) + "</h4><div class=\"nr-row\">" + rows + "</div>" +
      "<div class=\"nr-actions\"><button type=\"button\" class=\"nr-btn pri\">تأكيد وتنفيذ</button><button type=\"button\" class=\"nr-btn gho\">إلغاء</button></div>";
    const [ok, no] = c.querySelectorAll("button");
    ok.addEventListener("click", async function(){
      ok.disabled = no.disabled = true; ok.textContent = "جاري التنفيذ…";
      try{
        const r = await call({ confirm:{ name:p.name, args:p.args } });
        c.querySelector(".nr-actions").remove();
        addBotTyped(r.message || "تم ✓");
        history.push({ role:"assistant", content: r.message || "تم ✓" });
        saveHistory();
      }catch(e){
        ok.disabled = no.disabled = false; ok.textContent = "تأكيد وتنفيذ";
        addBubble("bot", errText(e), "err");
      }
    });
    no.addEventListener("click", function(){
      c.querySelector(".nr-actions").remove();
      const s = document.createElement("div");
      s.style.cssText = "font-size:12px;color:var(--c-mut)"; s.textContent = "اتلغى";
      c.appendChild(s);
    });
    list.appendChild(c);
    scrollDown();
  }

  function renderChips(){
    chipsBox.innerHTML = "";
    chipsBox.hidden = !history.length;
    if(!history.length) return;
    QUICK.forEach(function(qk){
      const b = document.createElement("button");
      b.type = "button"; b.className = "nr-chip"; b.textContent = qk.ic + " " + qk.t;
      b.addEventListener("click", function(){ send(qk.q); });
      chipsBox.appendChild(b);
    });
  }

  function renderWelcome(){
    const n = teacherName();
    addBubble("bot", greeting() + (n ? " يا أستاذ " + n : " يا أستاذ") + " 👋\nأنا " + BOT.name + "، " + BOT.role + ".\nأجيبلك بيانات الطلاب والحضور والمدفوعات والامتحانات، وأعدّل بيانات طالب أو أضيف ملاحظة بعد تأكيدك، وأفتحلك أي صفحة. اختار من تحت أو اكتبلي:", "");
    const q = document.createElement("div");
    q.className = "nr-quick";
    QUICK.forEach(function(qk){
      const b = document.createElement("button");
      b.type = "button"; b.className = "nr-q";
      b.innerHTML = "<span>" + qk.ic + "</span>" + esc(qk.t);
      b.addEventListener("click", function(){ send(qk.q); });
      q.appendChild(b);
    });
    list.appendChild(q);
  }

  function renderAll(){
    list.innerHTML = "";
    if(!history.length) renderWelcome();
    else history.forEach(function(m){ addBubble(m.role === "user" ? "user" : "bot", m.content); });
    renderChips();
  }

  function reset(){
    history = []; saveHistory(); renderAll(); input.focus();
  }

  function errText(e){
    const s = String((e && e.message) || e);
    if(s === "not_configured") return "المساعدة لسه متفعّلتش على السيرفر: لازم تضيف مفتاح OPENAI_API_KEY في أسرار Supabase.";
    if(s === "404") return "دالة المساعدة لسه ما اتنشرتش على Supabase. انشر الدالة milex-copilot الأول.";
    if(s === "401" || s === "unauthorized") return "الجلسة انتهت. سجّل خروج وادخل كمدرس تاني.";
    if(s === "403" || s === "forbidden") return "الحساب ده مش مدرس، فالمساعدة مش متاحة ليه.";
    if(s === "network") return "مفيش اتصال بالإنترنت دلوقتي. اتأكد من النت وجرّب تاني.";
    if(/^llm_/.test(s)) return "خدمة الذكاء الاصطناعي رفضت الطلب (" + s.replace("llm_","") + "). راجع المفتاح والرصيد.";
    console.warn("[milex-copilot]", s);
    return "حصلت مشكلة غير متوقعة (" + s + "). جرّب تاني بعد شوية.";
  }

  async function call(body){
    const t = token();
    if(!t) throw new Error("401");
    let res;
    try{
      res = await fetch(ENDPOINT, {
        method:"POST",
        headers:{ "Content-Type":"application/json", apikey:KEY_, Authorization:"Bearer " + t },
        body: JSON.stringify(body)
      });
    }catch(e){ throw new Error("network"); }
    let data = null;
    try{ data = await res.json(); }catch(e){}
    if(!res.ok) throw new Error((data && data.error) || String(res.status));
    return data || {};
  }

  function buildMessages(){
    const msgs = history.slice(-14);
    if(!PERSONA_IN_MESSAGES) return msgs;
    return [
      { role:"user", content:"[تعليمات الشخصية — التزمي بيها في كل الردود ولا تذكريها]\n" + BOT.persona },
      { role:"assistant", content:"تمام يا أستاذ، أنا " + BOT.name + " 🌟" }
    ].concat(msgs);
  }

  async function send(text){
    text = String(text || "").trim();
    if(!text || busy) return;
    lastText = text;
    busy = true; sendBtn.disabled = true;
    input.value = ""; input.style.height = "auto";
    const wasEmpty = !history.length;
    history.push({ role:"user", content:text });
    saveHistory();
    if(wasEmpty){ renderAll(); }
    else{
      list.querySelectorAll(".nr-quick").forEach(function(n){ n.remove(); });
      addBubble("user", text);
    }
    const typing = addBubble("bot", "");
    typing.innerHTML = '<span class="nr-typing"><i></i><i></i><i></i></span>';
    setStatus("بتفكر…", true); setTalking(false);
    try{
      const r = await call({
        messages: buildMessages(),
        persona: { name: BOT.name },
        context: { page: location.pathname.split("/").pop() || "index.html", localTime: new Date().toISOString() }
      });
      typing.remove();
      if(r.reply){
        addBotTyped(r.reply);
        history.push({ role:"assistant", content:r.reply });
        saveHistory();
      }
      (r.navigate || []).forEach(addNav);
      if((r.navigate || []).length && !(r.proposals || []).length){ const go = r.navigate[0].page; setTimeout(function(){ location.href = go; }, 1100); }
      (r.proposals || []).forEach(addProposal);
      setStatus(BOT.role, false);
    }catch(e){
      typing.remove();
      history.pop(); saveHistory();
      const eb = addBubble("bot", errText(e), "err");
      const rb = document.createElement("button");
      rb.type = "button"; rb.className = "nr-btn gho"; rb.style.marginTop = "8px"; rb.textContent = "حاول تاني";
      rb.addEventListener("click", function(){ eb.remove(); send(lastText); });
      eb.appendChild(rb);
      setStatus(BOT.role, false);
    }finally{
      busy = false; sendBtn.disabled = false; input.focus();
    }
  }

  /* ===================== فتح / قفل ===================== */
  function open(){
    build();
    endIntro();
    root.classList.add("open");
    setTimeout(function(){ input.focus(); scrollDown(); }, 380);
  }
  function close(){ if(root) root.classList.remove("open"); }

  function refresh(){
    if(isTeacher()){
      build();
      root.hidden = false;
      if(!root.classList.contains("open")) setTimeout(playIntro, 500);
    }else{
      if(root){ root.hidden = true; root.classList.remove("open"); endIntro(); }
      try{ sessionStorage.removeItem(HIST_KEY); sessionStorage.removeItem(INTRO_KEY); }catch(e){}
      history = [];
    }
  }

  window.MILEX_COPILOT = { refresh:refresh, open:open, close:close, name:BOT.name };

  function init(){
    const hubOnly = /(^|\/)(index\.html)?$/.test(location.pathname);
    if(hubOnly){
      const hub = document.getElementById("hubScreen");
      if(hub && hub.style.display === "block") refresh();
      return;
    }
    refresh();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
