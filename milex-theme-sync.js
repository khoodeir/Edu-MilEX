/* مزامنة الدارك مود بين كل الصفحات.
   - كل صفحة قديمة كانت بتخزّن الثيم بمفتاح مختلف (mgTheme, dashTheme, eduTrackTheme, scannerTheme, editDark).
     السكريبت ده بيحفظ اختيار واحد (mxTheme) وبيكتبه في كل المفاتيح قبل ما الصفحة تقراها.
   - الصفحات الجديدة/اللي ملهاش دارك مود: حط على السكريبت data-apply="1"، ولو عايز زر عايم حط data-float="1".  */
(function(){
  var KEYS = { mgTheme:['dark','light'], dashTheme:['dark','light'], eduTrackTheme:['dark','light'], scannerTheme:['dark','light'], editDark:['1','0'], studentSearchDarkMode:['1','0'] };
  var MASTER = 'mxTheme', de = document.documentElement;
  var me = document.currentScript, apply = !!(me && me.dataset.apply), float = !!(me && me.dataset.float);
  function ls(fn){ try{ return fn(); }catch(e){ return null; } }
  function writeKeys(dark){ ls(function(){ for(var k in KEYS) localStorage.setItem(k, KEYS[k][dark ? 0 : 1]); }); }
  var master = ls(function(){ return localStorage.getItem(MASTER); });
  if(master) writeKeys(master === 'dark');
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
    if(float){
      var b = document.createElement('button');
      b.id = 'mxThemeFab'; b.type = 'button'; b.title = 'الوضع الداكن / الفاتح';
      b.style.cssText = 'position:fixed;bottom:16px;left:16px;z-index:9000;width:42px;height:42px;border-radius:50%;border:1px solid rgba(128,128,128,.35);background:var(--card,#fff);color:var(--ink,#101B33);font-size:18px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.18)';
      function paint(){ b.textContent = de.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙'; }
      b.onclick = function(){ window.MX_THEME.toggle(); };
      document.body.appendChild(b); paint();
      new MutationObserver(paint).observe(de, { attributes:true, attributeFilter:['data-theme'] });
    }
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
