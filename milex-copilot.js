(function(){
  const M = window.MILEX;
  if(!M || window.MILEX_COPILOT) return;

  const URL_ = "https://evbjulsahncllewwvlxp.supabase.co";
  const KEY_ = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2Ymp1bHNhaG5jbGxld3d2bHhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NzE5MjUsImV4cCI6MjA5OTI0NzkyNX0.Xg9sU6ZenUU3kC2RNIbvZmK19KvE28MM2oyGcKNn8UA";
  const ENDPOINT = URL_ + "/functions/v1/milex-copilot";
  const HIST_KEY = "milexCopilotHistory";
  const SEEN_KEY = "milexCopilotSeen";

  const FIELD_AR = { full_name:"الاسم", student_phone:"موبايل الطالب", parent_phone:"موبايل ولي الأمر", city:"المدينة", group_name:"المجموعة", behavior:"سلوك", level:"مستوى", note:"ملاحظة" };
  const SUGGESTIONS = [
    "مين الطلاب اللي غابوا أكتر من مرتين ورا بعض؟",
    "مين لسه ما دفعش الشهر ده؟",
    "إجمالي المدفوعات الشهر ده كام؟",
    "اعرض نتايج آخر امتحان",
    "ورّيني المجموعات وعدد الطلاب في كل واحدة"
  ];

  let root, panel, handle, teaser, list, input, sendBtn, chipsBox;
  let busy = false, built = false, history = [], teaserTimer;

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function isTeacher(){
    try{
      if(!M.teacherOk()) return false;
      const a = M.actor();
      return !!(a && a.role === "teacher");
    }catch(e){ return false; }
  }

  function token(){
    try{
      const key = "sb-" + URL_.replace(/^https?:\/\//,"").split(".")[0] + "-auth-token";
      const j = JSON.parse(localStorage.getItem(key) || "null");
      return j && j.access_token ? j.access_token : "";
    }catch(e){ return ""; }
  }

  function loadHistory(){
    try{ history = JSON.parse(sessionStorage.getItem(HIST_KEY) || "[]") || []; }catch(e){ history = []; }
  }
  function saveHistory(){
    try{ sessionStorage.setItem(HIST_KEY, JSON.stringify(history.slice(-40))); }catch(e){}
  }

  function fmt(text){
    const lines = esc(text).split("\n");
    let out = "", inList = false;
    lines.forEach(function(raw){
      let l = raw.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
      const m = l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
      if(m){
        if(!inList){ out += "<ul>"; inList = true; }
        out += "<li>" + m[1] + "</li>";
      }else{
        if(inList){ out += "</ul>"; inList = false; }
        out += l.trim() ? "<p>" + l + "</p>" : "";
      }
    });
    if(inList) out += "</ul>";
    return out;
  }

  const CSS = `
  #mxc{position:fixed;inset:0;pointer-events:none;z-index:2147480000;font-family:Cairo,system-ui,sans-serif;direction:rtl;
    --c-bg:#fff;--c-ink:#101B33;--c-mut:#5C6A80;--c-line:#DCE3ED;--c-soft:#F3F6FB;--c-acc:#0B3A87;--c-acc2:#061F55;--c-lime:#A8D400;--c-bot:#EEF3FB;--c-ok:#2E7D32;--c-err:#B3261E}
  #mxc.dark{--c-bg:#1F1F1F;--c-ink:#E6EEFB;--c-mut:#9FB3D4;--c-line:rgba(180,205,240,.18);--c-soft:#2A2A2A;--c-acc:#5B93E6;--c-acc2:#9DB8E8;--c-bot:#2A2E36;--c-ok:#6FCF73;--c-err:#FF8A80}
  #mxc *{box-sizing:border-box}
  #mxc [hidden]{display:none!important}
  .mxc-handle{pointer-events:auto;position:fixed;left:0;top:42%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;
    padding:14px 9px;border:0;cursor:pointer;color:#fff;background:linear-gradient(180deg,#0B3A87,#061F55);border-radius:0 14px 14px 0;
    box-shadow:0 10px 28px rgba(6,31,85,.35);font:700 13px Cairo,system-ui,sans-serif;transition:padding .2s ease,box-shadow .2s ease,transform .2s ease;animation:mxcSlideIn .5s cubic-bezier(.22,.8,.3,1) both}
  .mxc-handle:hover{padding-inline:13px;box-shadow:0 14px 34px rgba(6,31,85,.45)}
  .mxc-handle svg{width:22px;height:22px}
  .mxc-handle span{writing-mode:vertical-rl;letter-spacing:0}
  .mxc-handle::after{content:"";position:absolute;top:8px;right:8px;width:8px;height:8px;border-radius:50%;background:#A8D400;box-shadow:0 0 0 0 rgba(168,212,0,.6);animation:mxcPulse 2.2s infinite}
  .mxc-teaser{pointer-events:auto;position:fixed;left:62px;top:42%;transform:translateY(-50%);max-width:240px;background:var(--c-bg);color:var(--c-ink);border:1px solid var(--c-line);
    border-inline-start:4px solid var(--c-lime);border-radius:14px;padding:11px 14px 11px 30px;font-size:13px;line-height:1.7;box-shadow:0 14px 34px rgba(16,27,51,.18);animation:mxcTeaser .45s cubic-bezier(.22,.8,.3,1) both}
  .mxc-teaser button{position:absolute;left:6px;top:4px;border:0;background:transparent;color:var(--c-mut);font-size:18px;cursor:pointer;line-height:1}
  .mxc-panel{pointer-events:auto;position:fixed;top:0;bottom:0;left:0;width:min(420px,100vw);display:flex;flex-direction:column;background:var(--c-bg);color:var(--c-ink);
    border-inline-end:1px solid var(--c-line);box-shadow:24px 0 60px rgba(6,31,85,.22);transform:translateX(-104%);visibility:hidden;transition:transform .35s cubic-bezier(.22,.8,.3,1),visibility .35s}
  #mxc.open .mxc-panel{transform:translateX(0);visibility:visible}
  #mxc.open .mxc-handle,#mxc.open .mxc-teaser{display:none}
  .mxc-head{display:flex;align-items:center;gap:12px;padding:14px 16px;color:#fff;background:linear-gradient(135deg,#0B3A87 0%,#061F55 100%);position:relative}
  .mxc-head::after{content:"";position:absolute;inset-inline:0;bottom:0;height:3px;background:linear-gradient(90deg,#A8D400,#0B3A87)}
  .mxc-logo{width:38px;height:38px;border-radius:11px;background:#fff url(logo-mark.png) center/78% no-repeat;flex:0 0 auto}
  .mxc-title{flex:1;min-width:0}
  .mxc-title b{display:block;font-size:16px;font-weight:800}
  .mxc-title small{display:flex;align-items:center;gap:6px;font-size:12px;opacity:.85}
  .mxc-title small i{width:7px;height:7px;border-radius:50%;background:#A8D400;display:inline-block}
  .mxc-ibtn{border:0;background:rgba(255,255,255,.14);color:#fff;width:34px;height:34px;border-radius:10px;cursor:pointer;display:grid;place-items:center;transition:background .2s}
  .mxc-ibtn:hover{background:rgba(255,255,255,.26)}
  .mxc-ibtn svg{width:18px;height:18px}
  .mxc-list{flex:1;overflow-y:auto;padding:18px 14px 8px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth;background:var(--c-soft)}
  .mxc-msg{max-width:90%;padding:10px 14px;border-radius:16px;font-size:14px;line-height:1.85;word-wrap:break-word;animation:mxcMsg .28s ease both}
  .mxc-msg p{margin:0 0 6px}.mxc-msg p:last-child{margin:0}
  .mxc-msg ul{margin:4px 0 6px;padding-inline-start:20px}.mxc-msg li{margin:2px 0}
  .mxc-user{align-self:flex-start;background:linear-gradient(135deg,#0B3A87,#2D5FB8);color:#fff;border-end-start-radius:4px}
  .mxc-bot{align-self:flex-end;background:var(--c-bg);border:1px solid var(--c-line);border-end-end-radius:4px}
  .mxc-bot.err{border-color:var(--c-err);color:var(--c-err)}
  .mxc-typing{display:inline-flex;gap:5px;padding:4px 2px}
  .mxc-typing i{width:7px;height:7px;border-radius:50%;background:var(--c-acc);opacity:.35;animation:mxcDot 1.1s infinite}
  .mxc-typing i:nth-child(2){animation-delay:.18s}.mxc-typing i:nth-child(3){animation-delay:.36s}
  .mxc-card{align-self:stretch;background:var(--c-bg);border:1px solid var(--c-line);border-inline-start:4px solid var(--c-lime);border-radius:14px;padding:12px 14px;animation:mxcMsg .28s ease both}
  .mxc-card h4{margin:0 0 8px;font-size:14px;color:var(--c-acc)}
  .mxc-row{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:13px;margin-bottom:10px;line-height:1.7}
  .mxc-row b{color:var(--c-mut);font-weight:600}
  .mxc-row s{color:var(--c-mut);margin-inline-end:6px}
  .mxc-actions{display:flex;gap:8px;flex-wrap:wrap}
  .mxc-btn{border:0;border-radius:10px;padding:8px 16px;font:700 13px Cairo,system-ui,sans-serif;cursor:pointer;transition:transform .15s,filter .2s}
  .mxc-btn:active{transform:scale(.96)}
  .mxc-btn.pri{background:var(--c-acc);color:#fff}.mxc-btn.pri:hover{filter:brightness(1.1)}
  .mxc-btn.gho{background:var(--c-soft);color:var(--c-ink);border:1px solid var(--c-line)}
  .mxc-btn[disabled]{opacity:.55;cursor:default}
  .mxc-nav{display:inline-flex;align-items:center;gap:8px;align-self:flex-end;border:1px solid var(--c-acc);color:var(--c-acc);background:var(--c-bg);border-radius:999px;padding:7px 16px;font:700 13px Cairo,system-ui,sans-serif;cursor:pointer;animation:mxcMsg .28s ease both}
  .mxc-nav:hover{background:var(--c-acc);color:#fff}
  .mxc-chips{display:flex;flex-wrap:wrap;gap:7px;padding:8px 14px 0;background:var(--c-soft)}
  .mxc-chip{border:1px solid var(--c-line);background:var(--c-bg);color:var(--c-ink);border-radius:999px;padding:6px 12px;font:600 12px Cairo,system-ui,sans-serif;cursor:pointer;transition:border-color .2s,color .2s}
  .mxc-chip:hover{border-color:var(--c-acc);color:var(--c-acc)}
  .mxc-foot{padding:10px 12px 12px;background:var(--c-soft);border-top:1px solid var(--c-line)}
  .mxc-box{display:flex;align-items:flex-end;gap:8px;background:var(--c-bg);border:1px solid var(--c-line);border-radius:14px;padding:6px 6px 6px 8px;transition:border-color .2s,box-shadow .2s}
  .mxc-box:focus-within{border-color:var(--c-acc);box-shadow:0 0 0 3px rgba(11,58,135,.12)}
  #mxc .mxc-box textarea,#mxc .mxc-box textarea:focus,#mxc .mxc-box textarea:focus-visible{outline:0!important;box-shadow:none!important;border:0!important;background:transparent!important;border-radius:0!important}
  .mxc-box textarea{flex:1;border:0;outline:0;resize:none;background:transparent;color:var(--c-ink);font:500 14px/1.7 Cairo,system-ui,sans-serif;max-height:120px;padding:6px 8px}
  .mxc-send{flex:0 0 auto;width:38px;height:38px;border:0;border-radius:11px;background:var(--c-acc);color:#fff;cursor:pointer;display:grid;place-items:center;transition:filter .2s,transform .15s}
  .mxc-send:hover{filter:brightness(1.12)}.mxc-send:active{transform:scale(.94)}.mxc-send[disabled]{opacity:.5;cursor:default}
  .mxc-send svg{width:18px;height:18px;transform:scaleX(-1)}
  .mxc-note{margin:7px 4px 0;font-size:11px;color:var(--c-mut);text-align:center}
  @keyframes mxcSlideIn{from{transform:translate(-100%,-50%)}to{transform:translate(0,-50%)}}
  @keyframes mxcTeaser{from{opacity:0;transform:translate(-14px,-50%)}to{opacity:1;transform:translate(0,-50%)}}
  @keyframes mxcMsg{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  @keyframes mxcDot{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-4px)}}
  @keyframes mxcPulse{0%{box-shadow:0 0 0 0 rgba(168,212,0,.55)}70%{box-shadow:0 0 0 9px rgba(168,212,0,0)}100%{box-shadow:0 0 0 0 rgba(168,212,0,0)}}
  @media (max-width:560px){.mxc-handle{top:auto;bottom:86px;transform:none;animation:none;padding:11px 8px}.mxc-teaser{display:none}.mxc-panel{width:100vw}}
  @media print{#mxc{display:none!important}}
  @media (prefers-reduced-motion:reduce){#mxc *{animation:none!important;transition:none!important}}
  `;

  const ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4V5z"/><path d="M8.5 9.5h7M8.5 12.5h4"/></svg>';
  const ICON_SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l16-8-6 16-3-7-7-1z"/></svg>';
  const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/></svg>';

  function syncTheme(){
    if(!root) return;
    const de = document.documentElement;
    const dark = de.getAttribute("data-theme") === "dark" || document.body.classList.contains("dark");
    root.classList.toggle("dark", dark);
  }

  function build(){
    if(built) return;
    built = true;
    const st = document.createElement("style");
    st.id = "mxcCss";
    st.textContent = CSS;
    document.head.appendChild(st);

    root = document.createElement("div");
    root.id = "mxc";
    root.setAttribute("dir","rtl");
    root.innerHTML =
      '<button type="button" class="mxc-handle" id="mxcHandle" aria-label="فتح مساعد MilEX">' + ICON_CHAT + '<span>المساعد</span></button>' +
      '<div class="mxc-teaser" id="mxcTeaser" hidden><button type="button" aria-label="إغلاق">×</button>أنا مساعدك. اسألني عن الطلاب والحضور والمدفوعات والامتحانات.</div>' +
      '<aside class="mxc-panel" id="mxcPanel" role="dialog" aria-label="مساعد MilEX">' +
        '<div class="mxc-head"><div class="mxc-logo"></div><div class="mxc-title"><b>مساعد MilEX</b><small><i></i>متصل بالبيانات الحالية</small></div>' +
        '<button type="button" class="mxc-ibtn" id="mxcClear" title="محادثة جديدة">' + ICON_TRASH + '</button>' +
        '<button type="button" class="mxc-ibtn" id="mxcClose" title="إغلاق">' + ICON_X + '</button></div>' +
        '<div class="mxc-list" id="mxcList"></div>' +
        '<div class="mxc-chips" id="mxcChips"></div>' +
        '<div class="mxc-foot"><div class="mxc-box"><textarea id="mxcInput" rows="1" placeholder="اكتب طلبك هنا…"></textarea>' +
        '<button type="button" class="mxc-send" id="mxcSend" aria-label="إرسال">' + ICON_SEND + '</button></div>' +
        '<div class="mxc-note">أي تعديل بيتنفذ بعد ما تأكده بنفسك</div></div>' +
      '</aside>';
    document.body.appendChild(root);

    panel = root.querySelector("#mxcPanel");
    handle = root.querySelector("#mxcHandle");
    teaser = root.querySelector("#mxcTeaser");
    list = root.querySelector("#mxcList");
    input = root.querySelector("#mxcInput");
    sendBtn = root.querySelector("#mxcSend");
    chipsBox = root.querySelector("#mxcChips");

    handle.addEventListener("click", open);
    teaser.querySelector("button").addEventListener("click", function(){ hideTeaser(true); });
    teaser.addEventListener("click", function(e){ if(e.target.tagName !== "BUTTON") open(); });
    root.querySelector("#mxcClose").addEventListener("click", close);
    root.querySelector("#mxcClear").addEventListener("click", reset);
    sendBtn.addEventListener("click", function(){ send(input.value); });
    input.addEventListener("keydown", function(e){
      if(e.key === "Enter" && !e.shiftKey && !e.isComposing){ e.preventDefault(); send(input.value); }
    });
    input.addEventListener("input", function(){
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 120) + "px";
    });
    document.addEventListener("keydown", function(e){
      if(e.key === "Escape" && root.classList.contains("open")) close();
    });

    new MutationObserver(syncTheme).observe(document.documentElement, { attributes:true, attributeFilter:["data-theme","class"] });
    new MutationObserver(syncTheme).observe(document.body, { attributes:true, attributeFilter:["class"] });
    syncTheme();

    loadHistory();
    renderAll();
  }

  function renderChips(){
    chipsBox.innerHTML = "";
    if(history.length) return;
    SUGGESTIONS.slice(0,4).forEach(function(t){
      const b = document.createElement("button");
      b.type = "button"; b.className = "mxc-chip"; b.textContent = t;
      b.addEventListener("click", function(){ send(t); });
      chipsBox.appendChild(b);
    });
  }

  function scrollDown(){ list.scrollTop = list.scrollHeight; }

  function addBubble(role, text, cls){
    const d = document.createElement("div");
    d.className = "mxc-msg " + (role === "user" ? "mxc-user" : "mxc-bot") + (cls ? " " + cls : "");
    d.innerHTML = role === "user" ? "<p>" + esc(text).replace(/\n/g,"<br>") + "</p>" : fmt(text);
    list.appendChild(d);
    scrollDown();
    return d;
  }

  function addNav(n){
    const b = document.createElement("button");
    b.type = "button"; b.className = "mxc-nav";
    b.innerHTML = "فتح " + esc(n.label) + " ←";
    b.addEventListener("click", function(){ location.href = n.page; });
    list.appendChild(b);
    scrollDown();
  }

  function addProposal(p){
    const c = document.createElement("div");
    c.className = "mxc-card";
    const rows = (p.lines || []).map(function(l){
      const from = l.from ? "<s>" + esc(l.from) + "</s>" : "";
      return "<b>" + esc(FIELD_AR[l.field] || l.field) + "</b><span>" + from + esc(l.to) + "</span>";
    }).join("");
    c.innerHTML = "<h4>" + esc(p.title) + "</h4><div class=\"mxc-row\">" + rows + "</div>" +
      "<div class=\"mxc-actions\"><button type=\"button\" class=\"mxc-btn pri\">تأكيد وتنفيذ</button><button type=\"button\" class=\"mxc-btn gho\">إلغاء</button></div>";
    const [ok, no] = c.querySelectorAll("button");
    ok.addEventListener("click", async function(){
      ok.disabled = no.disabled = true; ok.textContent = "جاري التنفيذ…";
      try{
        const r = await call({ confirm:{ name:p.name, args:p.args } });
        c.querySelector(".mxc-actions").remove();
        addBubble("bot", r.message || "تم ✓");
        history.push({ role:"assistant", content: r.message || "تم ✓" });
        saveHistory();
      }catch(e){
        ok.disabled = no.disabled = false; ok.textContent = "تأكيد وتنفيذ";
        addBubble("bot", errText(e), "err");
      }
    });
    no.addEventListener("click", function(){
      c.querySelector(".mxc-actions").remove();
      const s = document.createElement("div");
      s.style.cssText = "font-size:12px;color:var(--c-mut)";
      s.textContent = "اتلغى";
      c.appendChild(s);
    });
    list.appendChild(c);
    scrollDown();
  }

  function renderAll(){
    list.innerHTML = "";
    if(!history.length){
      addBubble("bot", "أهلاً بيك.\nأنا مساعدك جوه البرنامج. أقدر أجيبلك بيانات الطلاب والحضور والمدفوعات والامتحانات، وأعدّل بيانات طالب أو أضيف ملاحظة بعد تأكيدك، وأفتحلك أي صفحة.\nاختار سؤال من تحت أو اكتب طلبك.");
    }else{
      history.forEach(function(m){ addBubble(m.role === "user" ? "user" : "bot", m.content); });
    }
    renderChips();
  }

  function reset(){
    history = [];
    saveHistory();
    renderAll();
    input.focus();
  }

  function errText(e){
    const s = String((e && e.message) || e);
    if(s === "not_configured") return "المساعد لسه متفعّلش على السيرفر: لازم تضيف مفتاح OPENAI_API_KEY في أسرار Supabase.";
    if(s === "404") return "دالة المساعد لسه ما اتنشرتش على Supabase. انشر الدالة milex-copilot الأول.";
    if(s === "401" || s === "unauthorized") return "الجلسة انتهت. سجّل خروج وادخل كمدرس تاني.";
    if(s === "403" || s === "forbidden") return "الحساب ده مش مدرس، فالمساعد مش متاح ليه.";
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

  async function send(text){
    text = String(text || "").trim();
    if(!text || busy) return;
    busy = true; sendBtn.disabled = true;
    input.value = ""; input.style.height = "auto";
    chipsBox.innerHTML = "";
    history.push({ role:"user", content:text });
    saveHistory();
    addBubble("user", text);
    const typing = addBubble("bot", "");
    typing.innerHTML = '<span class="mxc-typing"><i></i><i></i><i></i></span>';
    try{
      const r = await call({ messages: history.slice(-14) });
      typing.remove();
      if(r.reply){
        addBubble("bot", r.reply);
        history.push({ role:"assistant", content:r.reply });
        saveHistory();
      }
      (r.navigate || []).forEach(addNav);
      (r.proposals || []).forEach(addProposal);
    }catch(e){
      typing.remove();
      history.pop();
      saveHistory();
      addBubble("bot", errText(e), "err");
    }finally{
      busy = false; sendBtn.disabled = false; input.focus();
    }
  }

  function open(){
    build();
    hideTeaser(true);
    root.classList.add("open");
    setTimeout(function(){ input.focus(); scrollDown(); }, 360);
  }
  function close(){
    if(root) root.classList.remove("open");
  }
  function hideTeaser(mark){
    clearTimeout(teaserTimer);
    if(teaser) teaser.hidden = true;
    if(mark){ try{ sessionStorage.setItem(SEEN_KEY, "1"); }catch(e){} }
  }
  function showTeaser(){
    let seen = false;
    try{ seen = sessionStorage.getItem(SEEN_KEY) === "1"; }catch(e){}
    if(seen || !teaser) return;
    teaser.hidden = false;
    teaserTimer = setTimeout(function(){ hideTeaser(true); }, 9000);
  }

  function refresh(){
    if(isTeacher()){
      build();
      root.hidden = false;
      if(!root.classList.contains("open") && /(^|\/)(index\.html)?$/.test(location.pathname)) setTimeout(showTeaser, 900);
    }else{
      if(root){ root.hidden = true; root.classList.remove("open"); }
      try{ sessionStorage.removeItem(HIST_KEY); sessionStorage.removeItem(SEEN_KEY); }catch(e){}
      history = [];
    }
  }

  window.MILEX_COPILOT = { refresh:refresh, open:open, close:close };

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
