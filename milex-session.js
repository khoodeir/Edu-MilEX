/* MilEX — تذكّر الدخول على الجهاز + رجوع آمن
   - لازم يتحمّل أول سكريبت في <head> (قبل أي فحص للجلسة).
   - جلسة المدرس/المساعد كانت بتتخزّن في sessionStorage (بتضيع مع كل تاب/إغلاق).
     هنا بنحتفظ بنسخة منها في localStorage ونرجّعها تلقائي، فالدخول بيبقى مرة واحدة لكل جهاز.
   - الخروج الفعلي (تسجيل الخروج) بيمسح النسخة دي، فتتطلب بيانات الدخول من جديد. */
(function(){
  if(window.__mxSession) return;
  window.__mxSession = true;

  var ss, ls;
  try{ ss = window.sessionStorage; ls = window.localStorage; }catch(e){ return; }

  var PREFIX   = 'mxp:';
  var KEYS     = ['milexTeacherSession','milexAssistantSession','milexStaff','milexActiveRole'];
  var EXP_KEYS = ['milexTeacherSession','milexAssistantSession'];
  var LIFETIME = 365 * 24 * 60 * 60 * 1000;            // سنة (بيتجدّد مع كل دخول)
  var SB_KEY   = 'sb-evbjulsahncllewwvlxp-auth-token'; // جلسة Supabase الدائمة

  function isKey(k){ return KEYS.indexOf(k) >= 0; }
  function hasExp(k){ return EXP_KEYS.indexOf(k) >= 0; }

  function extend(raw){
    try{
      var d = JSON.parse(raw) || {};
      d.exp = Date.now() + LIFETIME;
      return JSON.stringify(d);
    }catch(e){ return raw; }
  }

  /* 1) رجّع الجلسة المحفوظة (لو لسه جلسة Supabase موجودة على الجهاز) */
  try{
    var signedIn = !!ls.getItem(SB_KEY);
    KEYS.forEach(function(k){
      if(ss.getItem(k) != null) return;
      var raw = ls.getItem(PREFIX + k);
      if(raw == null) return;
      if(!signedIn){ ls.removeItem(PREFIX + k); return; }
      if(hasExp(k)){
        var d = JSON.parse(raw);
        if(!d || !d.exp || Date.now() >= d.exp){ ls.removeItem(PREFIX + k); return; }
      }
      ss.setItem(k, raw);
    });
  }catch(e){}

  /* 2) أي كتابة/مسح للمفاتيح دي في sessionStorage بتتنسخ في localStorage */
  try{
    var P = Object.getPrototypeOf(ss);
    var _set = P.setItem, _rem = P.removeItem, _clr = P.clear;

    P.setItem = function(k, v){
      if(this === ss && isKey(k)){
        if(hasExp(k)) v = extend(v);
        try{ ls.setItem(PREFIX + k, String(v)); }catch(e){}
      }
      return _set.call(this, k, v);
    };
    P.removeItem = function(k){
      if(this === ss && isKey(k)){ try{ ls.removeItem(PREFIX + k); }catch(e){} }
      return _rem.call(this, k);
    };
    P.clear = function(){
      if(this === ss){ KEYS.forEach(function(k){ try{ ls.removeItem(PREFIX + k); }catch(e){} }); }
      return _clr.call(this);
    };
  }catch(e){}

  /* 3) رجوع للصفحة اللي قبلها فقط (ولو مفيش صفحة قبلها من التطبيق → الصفحة الرئيسية) */
  window.milexBack = function(fallback){
    fallback = fallback || 'index.html';
    var same = false;
    try{ same = !!document.referrer && new URL(document.referrer).origin === location.origin; }catch(e){}
    if(same && history.length > 1){ history.back(); }
    else{ location.href = fallback; }
  };
})();
