
(function(){
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', function(){ deferred = null; try{ localStorage.setItem('milexInstalled','1'); }catch(e){} });

  function lang(){ return (document.documentElement.getAttribute('lang') || 'ar').indexOf('en') === 0 ? 'en' : 'ar'; }
  function t(ar, en){ return lang() === 'en' ? en : ar; }
  function standalone(){
    return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }
  function isIOS(){
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function modal(title, steps){
    var old = document.getElementById('milexInstallModal'); if(old) old.remove();
    var wrap = document.createElement('div'); wrap.id = 'milexInstallModal';
    wrap.setAttribute('dir', lang() === 'en' ? 'ltr' : 'rtl');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(6,31,85,.55);backdrop-filter:blur(3px)';
    var card = document.createElement('div');
    card.style.cssText = 'background:var(--card,#fff);color:var(--ink,#101B33);max-width:380px;width:100%;border-radius:18px;padding:22px 22px 18px;box-shadow:0 24px 60px rgba(6,31,85,.35);border-top:5px solid #A8D400;font-family:Cairo,Inter,system-ui,sans-serif';
    var h = document.createElement('h3'); h.textContent = title; h.style.cssText = 'margin:0 0 12px;font-size:18px;color:var(--ink-2,#061F55)';
    var ol = document.createElement('ol'); ol.style.cssText = 'margin:0 0 16px;padding-inline-start:22px;line-height:1.9;font-size:14.5px';
    steps.forEach(function(s){ var li = document.createElement('li'); li.textContent = s; ol.appendChild(li); });
    var b = document.createElement('button'); b.type = 'button'; b.textContent = t('تمام', 'Got it');
    b.style.cssText = 'width:100%;padding:12px;border:0;border-radius:12px;cursor:pointer;font:700 15px Cairo,Inter,sans-serif;background:#0B3A87;color:#fff';
    b.onclick = function(){ wrap.remove(); };
    wrap.onclick = function(e){ if(e.target === wrap) wrap.remove(); };
    card.appendChild(h); card.appendChild(ol); card.appendChild(b); wrap.appendChild(card); document.body.appendChild(wrap);
  }

  window.MILEX_INSTALL = {
    start: function(role){
      try{ if(role) localStorage.setItem('milexInstallRole', role); }catch(e){}
      if(standalone()){ modal(t('البرنامج متثبّت', 'App already installed'), [t('إنت فاتح البرنامج دلوقتي كتطبيق مثبّت.', 'You are already running the installed app.')]); return; }
      if(deferred){
        var p = deferred; deferred = null;
        p.prompt();
        if(p.userChoice && p.userChoice.catch) p.userChoice.catch(function(){});
        return;
      }
      if(isIOS()){
        modal(t('تثبيت MilEX على الأيفون', 'Install MilEX on iPhone / iPad'), [
          t('افتح الموقع من Safari.', 'Open this site in Safari.'),
          t('اضغط زر المشاركة (Share) تحت.', 'Tap the Share button.'),
          t('اختار "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).', 'Choose "Add to Home Screen".')
        ]);
        return;
      }
      modal(t('تثبيت MilEX', 'Install MilEX'), [
        t('افتح الموقع من Chrome أو Edge على رابط https.', 'Open the site in Chrome or Edge over https.'),
        t('من قائمة المتصفح (⋮) اختار "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".', 'From the browser menu (⋮) choose "Install app" or "Add to Home screen".')
      ]);
    }
  };
})();
