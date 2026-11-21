/* بحث سريع في كل الصفحات: بالاسم أو الباركود (QR) أو رقم الموبايل
   - زر 🔍 عايم، أو اضغط Ctrl+K أو  /
   - جهاز الباركود (USB) بيكتب الكود ويدوس Enter → لو لقى طالب واحد بيفتح كارته علطول  */
(function(){
  const M = window.MILEX; if(!M) return;
  if(!(M.teacherOk() || M.assistantOk())) return;
  if(!M.can('search') && !M.can('attendance') && !M.can('payments')) return;
  const PATH = location.pathname;
  if(PATH.endsWith('/') || PATH.endsWith('index.html')) return;
  const NO_SLASH = /scanner\.html$/.test(PATH);   // الباركود ممكن يحتوي /

  const URL_ = "https://evbjulsahncllewwvlxp.supabase.co";
  const KEY_ = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2Ymp1bHNhaG5jbGxld3d2bHhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NzE5MjUsImV4cCI6MjA5OTI0NzkyNX0.Xg9sU6ZenUU3kC2RNIbvZmK19KvE28MM2oyGcKNn8UA";
  const GRADES = M.GRADES;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function token(){
    try{
      const key = 'sb-' + URL_.replace(/^https?:\/\//,'').split('.')[0] + '-auth-token';
      const j = JSON.parse(localStorage.getItem(key) || 'null');
      const t = j && j.access_token;
      if(t && (!j.expires_at || Date.now()/1000 < j.expires_at + 30)) return t;
    }catch(e){}
    return KEY_;
  }

  function dark(){
    const de = document.documentElement;
    return de.getAttribute('data-theme') === 'dark' || document.body.classList.contains('dark');
  }
  function pal(){
    return dark()
      ? { bg:'#1F1F1F', ink:'#E3EBF7', mut:'#9FB3D4', line:'rgba(180,205,240,.18)', soft:'#2A2A2A', acc:'#6AA0EA', accInk:'#0b1220', ok:'#6FCF73', err:'#FF8A80' }
      : { bg:'#FFFFFF', ink:'#101B33', mut:'#5C6A80', line:'rgba(16,27,51,.14)', soft:'#F3F6FB', acc:'#0B3A87', accInk:'#FFFFFF', ok:'#2E7D32', err:'#B3261E' };
  }

  async function searchTable(gradeKey, q){
    const g = GRADES[gradeKey];
    const safe = q.replace(/[,()*%\\]/g, ' ').trim();
    if(!safe) return [];
    const like = '*' + safe + '*';
    const or = `(full_name.ilike.${like},qr_code.ilike.${like},student_phone.ilike.${like},parent_phone.ilike.${like})`;
    const url = `${URL_}/rest/v1/${encodeURIComponent(g.att)}?select=*&or=${encodeURIComponent(or)}&limit=8`;
    const res = await fetch(url, { headers:{ apikey:KEY_, Authorization:'Bearer ' + token() } });
    if(!res.ok) throw new Error(res.status);
    const rows = await res.json();
    return rows.map(r => ({ grade:gradeKey, gradeAr:g.ar, qr:String(r.qr_code ?? ''), name:r.full_name || '', group:r.group_name || '',
      sp:r.student_phone || '', pp:r.parent_phone || '', att:r.attendance_count, abs:r.absence_count, last:r.last_attendance_date }));
  }

  let overlay, input, list, detail, seq = 0, timer, results = [];

  function build(){
    if(overlay) return;
    const css = document.createElement('style');
    css.textContent = `
      #mxSearchFab{position:fixed;bottom:16px;right:16px;z-index:8990;width:46px;height:46px;border-radius:50%;border:0;cursor:pointer;font-size:19px;
        background:#0B3A87;color:#fff;box-shadow:0 6px 18px rgba(6,31,85,.35)}
      #mxSearchFab:hover{transform:scale(1.06)}
      #mxSrch{position:fixed;inset:0;z-index:2147482000;display:none;align-items:flex-start;justify-content:center;padding:8vh 12px 12px;background:rgba(8,16,30,.55);font-family:Cairo,system-ui,sans-serif}
      #mxSrch.open{display:flex}
      #mxSrch .box{width:100%;max-width:560px;border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.45);max-height:84vh;display:flex;flex-direction:column}
      #mxSrch input{width:100%;border:0;outline:0;padding:16px 18px;font:600 16px Cairo,system-ui,sans-serif;background:transparent}
      #mxSrch .res{overflow:auto;flex:1}
      #mxSrch .it{display:block;width:100%;text-align:right;border:0;border-top:1px solid;padding:10px 16px;cursor:pointer;font:inherit;background:transparent}
      #mxSrch .it b{display:block;font-size:14.5px}
      #mxSrch .it span{font-size:12px}
      #mxSrch .hint{padding:14px 18px;font-size:13px}
      #mxSrch .det{padding:14px 16px;border-top:1px solid}
      #mxSrch .det .ln{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
      #mxSrch .chip{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:20px;border:1px solid;font:600 12.5px Cairo,system-ui,sans-serif;text-decoration:none;cursor:pointer;background:transparent}
    `;
    document.head.appendChild(css);

    const fab = document.createElement('button');
    fab.id = 'mxSearchFab'; fab.type = 'button'; fab.title = 'بحث سريع (Ctrl+K)'; fab.textContent = '🔍';
    fab.className = 'no-print';
    fab.onclick = open;
    document.body.appendChild(fab);

    overlay = document.createElement('div');
    overlay.id = 'mxSrch'; overlay.setAttribute('dir','rtl');
    overlay.innerHTML = `<div class="box"><input type="search" id="mxSrchIn" placeholder="ابحث بالاسم أو الباركود أو رقم الموبايل…" autocomplete="off">
      <div class="res" id="mxSrchRes"></div><div id="mxSrchDet"></div></div>`;
    overlay.addEventListener('mousedown', e => { if(e.target === overlay) close(); });
    document.body.appendChild(overlay);
    input = overlay.querySelector('#mxSrchIn'); list = overlay.querySelector('#mxSrchRes'); detail = overlay.querySelector('#mxSrchDet');
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 220); });
    input.addEventListener('keydown', async e => {
      if(e.key === 'Escape'){ close(); }
      if(e.key === 'Enter'){
        e.preventDefault(); clearTimeout(timer); await run();
        const q = input.value.trim().toLowerCase();
        const exact = results.filter(r => r.qr.toLowerCase() === q);
        if(exact.length === 1) show(exact[0]); else if(results.length === 1) show(results[0]);
      }
    });
  }

  function paint(){
    const p = pal();
    const box = overlay.querySelector('.box');
    box.style.background = p.bg; box.style.color = p.ink;
    input.style.color = p.ink;
    overlay.querySelectorAll('.it,.det').forEach(el => el.style.borderColor = p.line);
  }

  async function run(){
    const q = input.value.trim(); const my = ++seq;
    const p = pal();
    if(q.length < 2){ results = []; list.innerHTML = `<div class="hint" style="color:${p.mut}">اكتب حرفين على الأقل…</div>`; detail.innerHTML = ''; return; }
    list.innerHTML = `<div class="hint" style="color:${p.mut}">جاري البحث…</div>`;
    try{
      const parts = await Promise.all(Object.keys(GRADES).map(k => searchTable(k, q).catch(() => [])));
      if(my !== seq) return;
      results = parts.flat();
      const ql = q.toLowerCase();
      results.sort((a,b) => (b.qr.toLowerCase() === ql) - (a.qr.toLowerCase() === ql) || a.name.localeCompare(b.name, 'ar'));
      results = results.slice(0, 20);
      detail.innerHTML = '';
      if(!results.length){ list.innerHTML = `<div class="hint" style="color:${p.mut}">مفيش نتائج</div>`; return; }
      list.innerHTML = results.map((r,i) => `<button type="button" class="it" data-i="${i}" style="border-color:${p.line};color:${p.ink}">
        <b>${esc(r.name)}</b><span style="color:${p.mut}">${esc(r.gradeAr)}${r.group ? ' · ' + esc(r.group) : ''} · <bdi>${esc(r.qr)}</bdi></span></button>`).join('');
      list.querySelectorAll('.it').forEach(b => b.onclick = () => show(results[+b.dataset.i]));
    }catch(e){
      list.innerHTML = `<div class="hint" style="color:${p.err}">تعذر البحث — اتأكد من الاتصال أو سجّل دخول تاني</div>`;
    }
  }

  function show(r){
    const p = pal();
    const q = `grade=${encodeURIComponent(r.grade)}&qr=${encodeURIComponent(r.qr)}`;
    const link = (href, label, perm) => (!perm || M.can(perm))
      ? `<a class="chip" href="${href}" style="border-color:${p.line};color:${p.ink}">${label}</a>` : '';
    const wa = (num, label) => num ? `<a class="chip" target="_blank" rel="noopener" href="https://wa.me/${esc(waNum(num))}" style="border-color:${p.line};color:${p.ok}">${label}</a>` : '';
    detail.innerHTML = `<div class="det" style="border-color:${p.line};background:${p.soft}">
      <b style="font-size:16px">${esc(r.name)}</b>
      <div style="font-size:12.5px;color:${p.mut};margin-top:2px">${esc(r.gradeAr)}${r.group ? ' · ' + esc(r.group) : ''} · QR: <bdi>${esc(r.qr)}</bdi></div>
      <div style="font-size:13px;margin-top:6px">حضور: <b>${esc(r.att ?? '–')}</b> · غياب: <b>${esc(r.abs ?? '–')}</b>${r.last ? ' · آخر حضور: ' + esc(String(r.last).slice(0,10)) : ''}</div>
      <div style="font-size:12.5px;color:${p.mut};margin-top:4px">طالب: <bdi>${esc(r.sp || '—')}</bdi> · ولي أمر: <bdi>${esc(r.pp || '—')}</bdi></div>
      <div class="ln">
        ${link('student_serch.html?q=' + encodeURIComponent(r.qr), '🔍 كل البيانات', 'search')}
        ${link('student_edit.html?q=' + encodeURIComponent(r.qr), '✏️ تعديل', 'edit')}
        ${link('student_report.html?' + q, '📄 تقرير شهري', 'reports')}
        ${link('receipts.html?' + q, '🧾 إيصالات', 'payments')}
        ${link('student_notes.html?' + q, '📝 ملاحظات', 'notes')}
        ${wa(r.pp, '💬 ولي الأمر')}${wa(r.sp, '💬 الطالب')}
      </div></div>`;
    detail.scrollIntoView({ block:'nearest' });
  }
  function waNum(phone){
    let d = String(phone || '').replace(/[^\d+]/g,'').replace(/^\+/,'');
    if(d.startsWith('00')) d = d.slice(2);
    if(d.startsWith('0')) d = '20' + d.slice(1);
    else if(d.length === 10 && d.startsWith('1')) d = '20' + d;
    return d;
  }

  function open(){ build(); paint(); overlay.classList.add('open'); input.value = ''; list.innerHTML = ''; detail.innerHTML = ''; results = []; setTimeout(() => input.focus(), 30); }
  function close(){ if(overlay) overlay.classList.remove('open'); }

  function init(){
    build();
    document.addEventListener('keydown', e => {
      const tag = (e.target && e.target.tagName) || '';
      const typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); open(); }
      else if(e.key === '/' && !typing && !NO_SLASH){ e.preventDefault(); open(); }
      else if(e.key === 'Escape'){ close(); }
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.MX_SEARCH = { open, close };
})();
