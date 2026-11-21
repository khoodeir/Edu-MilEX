/* دوال مشتركة للصفحات الجديدة. لازم تتحمّل بعد supabase-js و milex-common.js */
(function(){
  const URL_ = "https://evbjulsahncllewwvlxp.supabase.co";
  const KEY_ = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2Ymp1bHNhaG5jbGxld3d2bHhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NzE5MjUsImV4cCI6MjA5OTI0NzkyNX0.Xg9sU6ZenUU3kC2RNIbvZmK19KvE28MM2oyGcKNn8UA";
  const GRADES = (window.MILEX && MILEX.GRADES) || {};
  const GRADE_KEYS = Object.keys(GRADES);
  const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  let _client = null;
  function client(){
    if(!_client) _client = window.supabase.createClient(URL_, KEY_);
    return _client;
  }

  let _toastT;
  function toast(msg, isErr){
    let t = $('mxToast');
    if(!t){ t = document.createElement('div'); t.id = 'mxToast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.toggle('err', !!isErr); t.style.display = 'block';
    clearTimeout(_toastT); _toastT = setTimeout(() => t.style.display = 'none', isErr ? 4200 : 2600);
  }

  function goBack(){ if(history.length > 1 && document.referrer) history.back(); else location.href = 'index.html'; }

  // ---- أرقام وتواريخ ----
  const pad2 = n => String(n).padStart(2,'0');
  function fmtDate(v){
    if(!v) return '—';
    const d = new Date(v); if(isNaN(d)) return String(v).slice(0,10);
    return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;
  }
  function fmtDateTime(v){
    const d = new Date(v); if(isNaN(d)) return '—';
    return `${fmtDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  const fmtMoney = n => (Number(n) || 0).toLocaleString('en-US') + ' ج.م';
  const ymNow = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`; };

  // رقم مصري → صيغة دولية لواتساب
  function waNumber(phone){
    let d = String(phone || '').replace(/[^\d+]/g,'');
    if(!d) return '';
    d = d.replace(/^\+/,'');
    if(d.startsWith('00')) d = d.slice(2);
    if(d.startsWith('0')) d = '20' + d.slice(1);
    else if(d.length === 10 && d.startsWith('1')) d = '20' + d;
    return d;
  }
  function waLink(phone, text){
    const n = waNumber(phone);
    return `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}`;
  }

  function download(name, blob){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  async function copyText(txt){
    try{ await navigator.clipboard.writeText(txt); return true; }
    catch(e){
      const ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try{ ok = document.execCommand('copy'); }catch(_){}
      ta.remove(); return ok;
    }
  }

  // ---- طلاب كل الصفوف ----
  // بيرجّع صف لكل طالب من جدول الحضور + بيانات الدفع (لو موجودة)
  async function loadStudents(gradeKeys, withPay){
    const keys = (gradeKeys && gradeKeys.length) ? gradeKeys : GRADE_KEYS;
    const c = client();
    const parts = await Promise.all(keys.map(async k => {
      const g = GRADES[k];
      const jobs = [c.from(g.att).select('*')];
      if(withPay) jobs.push(c.from(g.pay).select('*'));
      const res = await Promise.all(jobs);
      if(res[0].error) throw new Error(`${g.att}: ${res[0].error.message}`);
      const payBy = {};
      if(withPay && !res[1].error) (res[1].data || []).forEach(r => payBy[r.qr_code] = r);
      return (res[0].data || []).map(r => {
        const p = payBy[r.qr_code] || {};
        return {
          grade:k, gradeAr:g.ar, qr:String(r.qr_code ?? ''), name:r.full_name || '',
          studentPhone:r.student_phone || '', parentPhone:r.parent_phone || '', city:r.city || '',
          group:r.group_name || '', att:Number(r.attendance_count) || 0, abs:Number(r.absence_count) || 0,
          lastAtt:r.last_attendance_date || null, created:r.created_at || null,
          payStatus:p.payment_status || '', amount:Number(p.amount_paid) || 0, lastPay:p.last_payment_date || null, raw:r
        };
      });
    }));
    return parts.flat();
  }

  // رسالة خطأ مفهومة من أخطاء الـ RPC
  const RPC_ERR = {
    not_allowed:'مش مسموح — الإجراء ده للمدرس فقط', invalid_email:'الإيميل مش صحيح',
    weak_password:'كلمة المرور لازم تكون 8 حروف على الأقل', email_exists:'الإيميل ده مستخدم قبل كده',
    not_an_assistant:'الحساب ده مش حساب مساعد', user_not_found:'الحساب مش موجود', already_linked:'الحساب ده متسجل بالفعل'
  };
  function rpcMsg(err){
    const m = String((err && (err.message || err.details)) || err || '');
    for(const k in RPC_ERR) if(m.indexOf(k) >= 0) return RPC_ERR[k];
    if(/Could not find the function|PGRST202|does not exist/i.test(m)) return 'لازم تشغّل ملف supabase_milex_upgrade.sql في Supabase الأول';
    return m || 'حصل خطأ غير متوقع';
  }

  // بيجيب كل الصفوف على دفعات (السيرفر بيقطع عند 1000 صف). mk(from,to) بترجّع query
  async function fetchAll(mk){
    const out = [], PAGE = 1000;
    for(let from = 0; from < 100000; from += PAGE){
      const { data, error } = await mk(from, from + PAGE - 1);
      if(error) throw error;
      out.push(...(data || []));
      if(!data || data.length < PAGE) break;
    }
    return out;
  }

  window.MX = { fetchAll, $, esc, client, toast, goBack, fmtDate, fmtDateTime, fmtMoney, ymNow, MONTHS_AR, pad2,
    waNumber, waLink, download, copyText, loadStudents, rpcMsg, GRADES, GRADE_KEYS,
    toggleTheme(){ window.MX_THEME ? window.MX_THEME.toggle() : null; },
    themeIcon(){ return (window.MX_THEME && MX_THEME.isDark()) ? '☀️' : '🌙'; } };
})();
