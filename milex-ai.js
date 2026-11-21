/* MilEX — تقييم تفصيلي للامتحانات
   مفيش أي مفتاح هنا. المفتاح على السيرفر بس. */
(function(){
  const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const num = n => { n = Number(n) || 0; return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100); };

  if(!document.getElementById('milexAiCss')){
    const st = document.createElement('style'); st.id = 'milexAiCss';
    st.textContent = `
    .mai{ background:#fff; border:1px solid #DCE3ED; border-radius:16px; padding:18px; margin:0 0 16px; text-align:right; color:#101B33; line-height:1.9; }
    .mai h3{ margin:0 0 6px; font-size:17px; color:#0B3A87; }
    .mai .lvl{ display:inline-block; background:#E8EFFA; color:#0B3A87; border-radius:999px; padding:2px 12px; font-weight:700; font-size:13px; margin-bottom:8px; }
    .mai ul{ margin:4px 0 10px; padding-inline-start:20px; }
    .mai h4{ margin:10px 0 2px; font-size:14px; }
    .mai .g{ color:#1F8A5B; } .mai .b{ color:#C0392B; } .mai .a{ color:#B7791F; }
    .mai .note{ font-size:12px; color:#5C6A80; margin-top:8px; }
    .mai .load{ color:#5C6A80; font-size:14px; }
    .mai-q{ background:#F2F6FB; border:1px dashed #C6D2E3; border-radius:12px; padding:10px 12px; margin-top:10px; font-size:14px; line-height:1.9; color:#101B33; }
    .mai-q b{ color:#0B3A87; }
    .mai-q .ideal{ background:#E8F6EF; border-radius:8px; padding:8px 10px; margin-top:6px; }
    .mai-ov{ position:fixed; inset:0; background:rgba(5,15,43,.55); z-index:9999; display:flex; align-items:center; justify-content:center; padding:14px; }
    .mai-box{ background:#fff; border-radius:16px; max-width:720px; width:100%; max-height:88vh; overflow:auto; padding:18px; direction:rtl; font-family:'Cairo',sans-serif; }
    .mai-box .x{ float:left; border:1px solid #DCE3ED; background:#fff; border-radius:10px; padding:4px 12px; cursor:pointer; font:600 14px 'Cairo',sans-serif; }
    `;
    document.head.appendChild(st);
  }

  async function fetchReport(supa, token, code){
    const ck = 'milexAi:' + token + ':' + code;
    try{ const c = JSON.parse(localStorage.getItem(ck) || 'null'); if(c && c.ok && !c.pending && Date.now() - (c._t||0) < 6*3600e3) return c; }catch(e){}
    const { data, error } = await supa.functions.invoke('ai-exam-grader', { body: { token, code } });
    if(error) throw error;
    if(data && data.ok && !data.pending){ try{ localStorage.setItem(ck, JSON.stringify(Object.assign({_t:Date.now()}, data))); }catch(e){} }
    return data;
  }

  function evalHtml(ev){
    if(!ev) return '';
    const li = a => (a||[]).length ? '<ul>' + a.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '';
    return `<span class="lvl">${esc(ev.level)}</span><div>${esc(ev.summary)}</div>`
      + ((ev.strengths||[]).length ? `<h4 class="g">✅ نقاط القوة</h4>${li(ev.strengths)}` : '')
      + ((ev.weaknesses||[]).length ? `<h4 class="b">⚠️ نقاط الضعف</h4>${li(ev.weaknesses)}` : '')
      + ((ev.advice||[]).length ? `<h4 class="a">💡 نصايح</h4>${li(ev.advice)}` : '');
  }

  function questionHtml(x, review){
    const q = (review || [])[x.index];
    const pts = q && q.points != null ? ' من ' + num(q.points) : '';
    const tag = {correct:'✔ صح', partial:'◐ جزء من الدرجة', wrong:'✖ غلط', blank:'— من غير إجابة'}[x.verdict] || '';
    return `<div class="mai-q"><b>📝 تقييم الإجابات:</b> ${tag} (${num(x.ai_score)}${pts})`
      + (x.feedback ? `<div>${esc(x.feedback)}</div>` : '')
      + (x.ideal_answer ? `<div class="ideal"><b>الإجابة الصح:</b> ${esc(x.ideal_answer)}</div>` : '') + `</div>`;
  }

  function fullHtml(rep, review){
    if(!rep || !rep.ok) return '<div class="load">تعذّر تحميل التقييم دلوقتي.</div>';
    if(rep.pending) return '<div class="load">تصحيح الأسئلة المقالية لسه جاري… جرّب بعد شوية.</div>';
    let h = '<h3>📝 تقييم الإجابات</h3>' + evalHtml(rep.evaluation);
    if(review && (rep.questions||[]).length){
      h += '<h4>تفاصيل الأسئلة</h4>' + rep.questions.map(x => {
        const q = review[x.index];
        return `<div style="margin-top:8px"><b>سؤال ${x.index + 1}:</b> ${esc(q ? q.text : '')}${questionHtml(x, review)}</div>`;
      }).join('');
    }
    return h + '<div class="note">التقييم ده استرشادي، والدرجة الرسمية هي اللي ظاهرة فوق.</div>';
  }

  window.MILEX_AI = {
    fetchReport, fullHtml, questionHtml, evalHtml,

    // صفحة الطالب: بيحط كارت التقييم فوق تفاصيل الأسئلة وبيضيف ملاحظة تحت كل سؤال
    async mountForStudent(supa, token, code, container){
      if(!container) return;
      let box = document.getElementById('maiBox');
      if(!box){ box = document.createElement('div'); box.id = 'maiBox'; box.className = 'mai'; container.parentNode.insertBefore(box, container); }
      box.innerHTML = '<h3>📝 تقييم الإجابات</h3><div class="load">بنجهّز تقييمك… ⏳</div>';
      try{
        const rep = await fetchReport(supa, token, code);
        if(!rep || !rep.ok || rep.pending){ box.innerHTML = fullHtml(rep); return; }
        box.innerHTML = '<h3>📝 تقييم الإجابات</h3>' + evalHtml(rep.evaluation)
          + '<div class="note">التقييم ده استرشادي، والدرجة الرسمية هي اللي ظاهرة فوق.</div>';
        const cards = container.querySelectorAll('.qcard');
        (rep.questions || []).forEach(x => {
          const c = cards[x.index]; if(!c || c.querySelector('.mai-q')) return;
          c.insertAdjacentHTML('beforeend', questionHtml(x, null));
        });
      }catch(e){ console.warn('ai', e); box.innerHTML = '<h3>📝 تقييم الإجابات</h3><div class="load">التقييم مش متاح دلوقتي.</div>'; }
    },

    // صفحة المدرس/المساعد: نافذة بتقرير طالب واحد
    async openModal(supa, token, code, name){
      const ov = document.createElement('div'); ov.className = 'mai-ov';
      ov.innerHTML = `<div class="mai-box"><button class="x" type="button">إغلاق</button><div class="mai" style="border:0;padding:0"><h3>📝 ${esc(name || code)}</h3><div class="load">جاري التقييم… ⏳</div></div></div>`;
      ov.addEventListener('click', e => { if(e.target === ov || e.target.classList.contains('x')) ov.remove(); });
      document.body.appendChild(ov);
      const body = ov.querySelector('.mai');
      try{
        const rep = await fetchReport(supa, token, code);
        body.innerHTML = `<h3>📝 ${esc(name || code)}</h3>` + fullHtml(rep, null).replace('<h3>📝 تقييم الإجابات</h3>', '');
        if(rep && rep.ok && !rep.pending){
          const withTxt = (rep.questions||[]).filter(x => x.feedback || x.ideal_answer);
          if(withTxt.length){
            body.insertAdjacentHTML('beforeend', '<h4>الأسئلة</h4>' + withTxt.map(x => `<div style="margin-top:8px"><b>سؤال ${x.index+1}</b>${questionHtml(x, null)}</div>`).join(''));
          }
        }
      }catch(e){ body.innerHTML = '<div class="load">التقييم مش متاح. اتأكد إن خدمة التقييم متفعّلة.</div>'; }
    }
  };
})();
