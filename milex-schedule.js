/* منطق جدول الحصص + كشف التعارض (بيتشارك بين schedule.html و manage_groups.html)
   المدخل: إعدادات app_config (reg_form_data):  stages[].grades[].groups[] = { value, dayAr, time } */
(function(){
  const norm = s => String(s || '').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,' ').trim();
  // 0=الأحد ... 6=السبت
  const DAYS = [
    { n:0, ar:'الأحد',    re:/(^|\s|و|ال)(احد|حد)(?=\s|$|و)/ },
    { n:1, ar:'الاثنين',  re:/(اتنين|اثنين|تنين)/ },
    { n:2, ar:'الثلاثاء', re:/(تلات|ثلاث)/ },
    { n:3, ar:'الأربعاء', re:/(اربع)/ },
    { n:4, ar:'الخميس',   re:/(خميس)/ },
    { n:5, ar:'الجمعة',   re:/(جمع)/ },
    { n:6, ar:'السبت',    re:/(سبت)/ }
  ];
  function parseDays(dayAr){
    const t = norm(dayAr);
    return DAYS.filter(d => d.re.test(t)).map(d => d.n);
  }
  // "3:00" → دقايق من بداية اليوم. الساعات 1–8 بعد الضهر، 9–11 صباحًا، 12 ضهرًا
  function parseTime(str){
    const m = String(str || '').match(/(\d{1,2})(?::(\d{2}))?/);
    if(!m) return null;
    let h = +m[1]; const min = +(m[2] || 0);
    if(h >= 1 && h <= 8) h += 12;
    return h * 60 + min;
  }
  function fmt(mins){ const h = Math.floor(mins / 60), m = mins % 60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }

  // يطلّع قايمة حصص: { grade, gradeAr, group, days[], start }
  function sessions(cfg, GRADES){
    const out = [];
    const byReg = {}; Object.keys(GRADES).forEach(k => byReg[GRADES[k].reg] = k);
    ((cfg && cfg.stages) || []).forEach(st => (st.grades || []).forEach(gr => {
      const key = byReg[gr.value]; if(!key) return;
      (gr.groups || []).forEach(g => {
        const days = parseDays(g.dayAr), start = parseTime(g.time);
        out.push({ grade:key, gradeAr:GRADES[key].ar, group:`${g.dayAr} ${String(g.time||'').replace(':00','')}`, dayAr:g.dayAr, timeRaw:g.time, days, start, bad:(!days.length || start == null) });
      });
    }));
    return out;
  }
  // تعارض = نفس اليوم والحصتين متداخلتين (حسب مدة الحصة بالدقايق)
  function conflicts(list, durMin){
    const res = [];
    for(let i = 0; i < list.length; i++) for(let j = i + 1; j < list.length; j++){
      const a = list[i], b = list[j];
      if(a.bad || b.bad) continue;
      const shared = a.days.filter(d => b.days.includes(d));
      if(!shared.length) continue;
      if(a.start < b.start + durMin && b.start < a.start + durMin) res.push({ a, b, days:shared });
    }
    return res;
  }
  window.MX_SCHED = { parseDays, parseTime, fmt, sessions, conflicts, DAYS };
})();
