/* مزامنة الدارك مود واللغة بين كل الصفحات.
   - الاختيار بيتغيّر من صفحة «الإعدادات» عند المدرس (settings.html) بس، وبيتطبّق على كل الصفحات.
   - الثيم محفوظ في mxTheme واللغة في mxLang، والسكريبت بيكتبهم في مفاتيح كل صفحة قبل ما الصفحة تقراهم.
   - كل صفحة قديمة كانت بتخزّن الثيم بمفتاح مختلف (mgTheme, dashTheme, eduTrackTheme, scannerTheme, editDark).
     السكريبت ده بيحفظ اختيار واحد (mxTheme) وبيكتبه في كل المفاتيح قبل ما الصفحة تقراها.
   - الصفحات الجديدة/اللي ملهاش دارك مود: حط على السكريبت data-apply="1".  */
(function(){
  var KEYS = { mgTheme:['dark','light'], dashTheme:['dark','light'], eduTrackTheme:['dark','light'], scannerTheme:['dark','light'], editDark:['1','0'], studentSearchDarkMode:['1','0'] };
  var LANG_KEYS = ['dashLang','eduTrackLang','parentPortalLang','scannerLang','regLang','studentSearchLang'];
  var MASTER = 'mxTheme', MASTER_LANG = 'mxLang', de = document.documentElement;
  var me = document.currentScript, apply = !!(me && me.dataset.apply);
  function ls(fn){ try{ return fn(); }catch(e){ return null; } }
  function writeKeys(dark){ ls(function(){ for(var k in KEYS) localStorage.setItem(k, KEYS[k][dark ? 0 : 1]); }); }
  function writeLang(l){ ls(function(){ for(var i=0;i<LANG_KEYS.length;i++) localStorage.setItem(LANG_KEYS[i], l); }); }
  function validLang(l){ return l === 'ar' || l === 'en' ? l : null; }
  var master = ls(function(){ return localStorage.getItem(MASTER); });
  if(master) writeKeys(master === 'dark');
  // اللغة: أول مرة بناخد اللغة اللي كانت مختارة قبل كده في اللوحة (لو فيه)، وإلا العربي
  var lang = validLang(ls(function(){ return localStorage.getItem(MASTER_LANG); }));
  if(!lang){
    lang = validLang(ls(function(){ return localStorage.getItem('dashLang'); })) || 'ar';
    ls(function(){ localStorage.setItem(MASTER_LANG, lang); });
  }
  writeLang(lang);
  var loadedTheme = master || null, loadedLang = lang;
  if(apply && master === 'dark') de.setAttribute('data-theme','dark');

  function isDark(){ return de.getAttribute('data-theme') === 'dark' || !!(document.body && document.body.classList.contains('dark')); }
  var touched = false;
  ['pointerdown','keydown','touchstart'].forEach(function(ev){ addEventListener(ev, function(){ touched = true; }, { capture:true, passive:true }); });
  function persist(){
    if(!touched) return;
    var d = isDark(), m = ls(function(){ return localStorage.getItem(MASTER); });
    if(m !== (d ? 'dark' : 'light')){ ls(function(){ localStorage.setItem(MASTER, d ? 'dark' : 'light'); }); writeKeys(d); }
  }
  new MutationObserver(persist).observe(de, { attributes:true, attributeFilter:['data-theme'] });
  document.addEventListener('DOMContentLoaded', function(){
    if(document.body) new MutationObserver(persist).observe(document.body, { attributes:true, attributeFilter:['class'] });
    /* الزر العايم اتشال — الثيم واللغة بيتغيّروا من صفحة الإعدادات بس */
  });
  window.MX_LANG = {
    get: function(){ return validLang(ls(function(){ return localStorage.getItem(MASTER_LANG); })) || 'ar'; },
    set: function(l){ l = validLang(l) || 'ar'; ls(function(){ localStorage.setItem(MASTER_LANG, l); }); writeLang(l); }
  };
  // لو الإعدادات اتغيّرت من تاب تانية: الثيم بيتطبّق فورًا، واللغة بتتطبّق أول ما الصفحة تتفتح/ترجع
  addEventListener('storage', function(e){
    if(e.key === MASTER && e.newValue && window.MX_THEME) window.MX_THEME.set(e.newValue === 'dark');
  });
  addEventListener('pageshow', function(e){
    if(!e.persisted) return;
    var t = ls(function(){ return localStorage.getItem(MASTER); }), l = window.MX_LANG.get();
    if(l !== loadedLang || (t && loadedTheme && t !== loadedTheme)) location.reload();
  });
  window.MX_THEME = {
    isDark: isDark,
    set: function(dark){
      if(dark) de.setAttribute('data-theme','dark'); else de.setAttribute('data-theme','light');
      if(document.body) document.body.classList.toggle('dark', dark);
      ls(function(){ localStorage.setItem(MASTER, dark ? 'dark' : 'light'); }); writeKeys(dark);
    },
    toggle: function(){ this.set(!isDark()); }
  };
})();
