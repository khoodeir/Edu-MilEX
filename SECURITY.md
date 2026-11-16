# أمان MilEX EDU — نسخة الترحيل الآمن

## تم إصلاحه في الكود

- تسجيل دخول المدرس والمساعد أصبح عبر Supabase Auth بإيميل وكلمة مرور، وليس hash محفوظًا في LocalStorage.
- كل مساعد يمكن أن يملك حساب Auth منفصلًا، وبالتالي يمكن ربط سجل العمليات بحسابه.
- إصلاح Trend والدرجات عند اختلاف نوع `exam_id` أو `student_code` بين استجابة Supabase والواجهة.
- مساعد توليد الأسئلة يعمل عبر Edge Function محمية بجلسة Auth، ومفتاح OpenAI لا يصل إلى المتصفح.

## مطلوب في Supabase

شغّل `supabase_security_rls.sql` بعد إنشاء مستخدم Auth للمدرس ولكل مساعد وإضافة UUID والدور في `milex_profiles`. الملف يفعّل RLS على جداول النظام ويمنع anon من الوصول المباشر.

## تحذير بوابة ولي الأمر

النسخة القديمة من بوابة ولي الأمر تقرأ بعض الجداول مباشرة بمفتاح anon. لا تضف سياسات anon عامة بعد تفعيل RLS؛ انقل البحث إلى RPC من نوع `SECURITY DEFINER` يعيد بيانات الطفل المطلوب فقط مع تحقق ومعدل طلبات. ملف SQL يترك هذه الخطوة معلّقة عمدًا حتى لا يتم فتح بيانات كل الطلاب.

## دالة الذكاء الاصطناعي

```bash
supabase functions deploy generate-exam-content
supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_KEY
```

وتحتاج الدالة إلى `SUPABASE_SERVICE_ROLE_KEY` الافتراضي المتاح داخل Edge Functions للتحقق من `milex_profiles`. لا تضع هذا المفتاح في HTML أو JavaScript.
