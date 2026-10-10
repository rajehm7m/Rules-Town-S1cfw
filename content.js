/* ===== intelligence-content.js ===== */
// Atmospheric role introductions. Edit the copy here as server lore develops.
window.MT_DOSSIERS = [
  {name:'R.I.F', code:'F-0', image:'abdulsamad.webp', tone:'#ff3f45',
    title:'المعلومة تسبق كل خطوة.', unit:'الاستخبارات', classification:'RESTRICTED / 01',
    intro:'في مدينة تتقاطع فيها الأسرار، لا تكفي رؤية ما يحدث. الفارق هو أن تفهم ما لم يُقل بعد.',
    brief:['اقرأ ما بين السطور.','اتبع الأثر، ولا تترك أثرك.','تذكّر كل شيء.'],
    words:['المعلومة','المراقبة','السرّ'], quote:'TRUST NO ONE. REMEMBER EVERYTHING.'},
  {name:'FIB', code:'P-1', image:'mhna.webp', tone:'#e86b6f',
    title:'الحضور الذي يغيّر الموازين.', unit:'المارينز', classification:'RESTRICTED / 02',
    intro:'حين تصبح المدينة على حافة القرار، يتقدّم من يعرف معنى الانضباط. لكل خطوة وزن، ولكل قرار أثر.',
    brief:['ثبات تحت الضغط.','القرار قبل الحركة.','القوة مسؤولية.'],
    words:['الانضباط','القيادة','القوة'], quote:'POWER ISN’T GIVEN. IT’S TAKEN.'},
  {name:'S.W.A.T', code:'P-2', image:'vladi.webp', tone:'#80c4d1',
    title:'كل ثانية تصنع الفارق.', unit:'القوات الخاصة', classification:'RESTRICTED / 03',
    intro:'تركيز لا يتشتّت، وعين تقرأ التفاصيل. في اللحظة الحاسمة، تتحوّل الدقّة إلى الخطوة التي تغيّر المشهد.',
    brief:['راقب المشهد كاملًا.','تحرّك بدقّة.','احمِ المدينة.'],
    words:['الدقّة','الاستجابة','الحماية'], quote:'THE CITY WATCHES. THE CITY REMEMBERS.'},
  {name:'ANONYMOUS', code:'X-?', image:'Snake.webp', tone:'#b9c687',
    title:'خلف الإشارة… حكاية أخرى.', unit:'هوية غير معلنة', classification:'IDENTITY / UNKNOWN',
    intro:'اسم لا يكشف صاحبه، وأثر يترك أسئلة أكثر من الإجابات. هنا يبدأ الغموض من القرار الذي لم يتوقّعه أحد.',
    brief:['راقب الإشارة.','فكّ الرمز.','اكتب احتمالك القادم.'],
    words:['الهوية','الإشارة','الاحتمال'], quote:'ONE DECISION CAN CHANGE EVERYTHING.'}
];

// Awaiting the owner's confirmed locations. x/y are percentages of the supplied
// map image, measured from its top-left corner. No invented headquarters.
// Example shape: {id, name, label, x, y, description, image?}.
window.MT_MAP_LOCATIONS = [];

;
/* ===== memory-content.js ===== */
/* Edit each memory here. Blocks support paragraphs, headings, images and videos.
   Examples:
   { type: 'text', text: 'اكتب تفاصيل الحدث هنا' },
   { type: 'heading', text: 'عنوان داخل الذكرى' },
   { type: 'image', src: 'assets/images/my-photo.webp', alt: 'وصف الصورة', caption: 'تعليق الصورة' },
   { type: 'video', src: 'assets/images/my-video.mp4', poster: 'assets/images/my-photo.webp', caption: 'عنوان المقطع' }
   Add blocks to the matching event below; the window renders them in that order.
*/
window.MT_MEMORIES = [
  { id: 'mtz-end', title: 'MTZ END', label: '001 / THE END OF AN ERA', cover: 'assets/images/memory-mtz-end.webp', blocks: [] },
  { id: 'killer-abdulsamad', title: 'الحرب بين كيلر وعبد الصمد', label: '002 / THE BATTLE OF ROXWOOD', cover: 'assets/images/memory-killer-abdulsamad.webp', blocks: [
  {
    "type": "text",
    "text": "عملية عسكرية معقدة يقودها عبد الصمد ضد كيلر تشاندلر لاستعادة ثلاثة رهائن من ضباط القوات (عبد الله الشمري، جاكس سلي، وفهد المطيري). يمكن تلخيص مجريات هذه الحرب في النقاط التالية:"
  },
  {
    "type": "heading",
    "text": "1. التخطيط والمواجهة"
  },
  {
    "type": "text",
    "text": "بدأت بتعطيل أنظمة الدفاع الجوي التابعة للعدو، تلاها سلسلة من المفاوضات المتوترة بين عبد الصمد وكيلر الذي طالب بمبالغ مالية كبيرة (10 مليون) والسيطرة على جزيرة مقابل الإفراج عن الرهائن. تميزت هذه المرحلة بمحاولات كيلر المستمرة للتلاعب والمراوغة."
  },
  {
    "type": "heading",
    "text": "2. العمليات العسكرية المكثفة"
  },
  {
    "type": "text",
    "text": "تصاعدت حدة الحرب بانطلاق هجوم شامل شمل دبابات ومروحيات (الهايدرا والاباتشي) في موقع الجسر. تم تدمير أسطول كيلر الميداني واستنزاف عتاده بالكامل، مع التركيز على تدمير الدبابات والوحدات الجوية للعدو لمنع أي محاولة هروب."
  },
  {
    "type": "heading",
    "text": "3. مرحلة التفاوض الحاسمة والتبادل"
  },
  {
    "type": "text",
    "text": "بعد قرار التصويت بتبادل الرهائن في نفس اليوم، توجهت القوات إلى مطار ساندي. تمت عملية التبادل تحت مراقبة أمنية دقيقة وتهديد مباشر من عبد الصمد باستهداف كيلر في حال حدوث أي غدر. نجحت المهمة في استعادة الرهائن الثلاثة."
  },
  {
    "type": "heading",
    "text": "4. ما بعد الحرب والتحقيقات"
  },
  {
    "type": "text",
    "text": "كشفت التحقيقات عن ثغرات أمنية وتصرفات فردية من بعض الضباط (جاكس وفهد) أدت إلى اختطافهم، مما دفع القادة لاتخاذ إجراءات صارمة شملت إيقافهم عن العمل وإحالتهم للتحقيق. انتهت الحرب بانتصار تكتيكي، لكن بوعود من عبد الصمد بمواصلة البحث عن كيلر الغدار."
  }
] },
  { id: 'final-war', title: 'الحرب الأخيرة', label: '003 / THE FINAL WAR', cover: 'assets/images/memory-final-war.webp', blocks: [] },
  { id: 'formula-founding-day', title: 'الفورميلا — يوم التأسيس', label: '004 / FOUNDING DAY', cover: 'assets/images/memory-formula-founding-day.webp', blocks: [] }
];

;
/* ===== evolution-content.js ===== */
// Trial section: set enabled to false to remove it, including its scroll space.
// History supplied by the site owner. Add a historical image to any image field.
window.MT_EVOLUTION = {
  enabled: true,
  chapters: [
    {year:'2019', label:'2019', tag:'THE BEGINNING', title:'ولادة Rules Town',
      text:'تأسست RT RP كمجتمع لعب أدوار GTA V، ووضعت الأساس لما سيصبح واحدة من أكبر منصات لعب الأدوار في الشرق الأوسط.',
      metric:'RT RP', detail:'من هنا بدأت الحكاية', image:'', motif:'origin'},
    {year:'2020', label:'2020', tag:'A GROWING WORLD', title:'نمو المجتمع',
      text:'توسع المجتمع بسرعة ليشمل عشرات الآلاف من اللاعبين المسجلين، مع أنظمة متقدمة للاقتصاد والعصابات وإنفاذ القانون.',
      metric:'COMMUNITY', detail:'اقتصاد · عصابات · إنفاذ القانون', image:'', motif:'network'},
    {year:'2021', label:'2021–2022', tag:'VOICES OF THE CITY', title:'شراكات مع صناع المحتوى',
      text:'تعاونت RT RP مع أكثر من 100 صانع محتوى عبر تويتش وكيك ويوتيوب ووسائل التواصل الاجتماعي.',
      metric:'100+', detail:'صانع محتوى', image:'', motif:'signal'},
    {year:'2023', label:'2023', tag:'THE NEXT CHAPTER', title:'تحديث كبير',
      text:'جلب تحديث كبير ميكانيكيات جديدة وأداء محسن وجذب موجة من اللاعبين الجدد وصناع المحتوى.',
      metric:'EVOLUTION', detail:'ميكانيكيات جديدة · أداء محسن', image:'', motif:'evolution'},
    {year:'2024', label:'2024', tag:'BEYOND THE NUMBERS', title:'أكثر من 300 ألف لاعب',
      text:'وصلت Rules Town لأكثر من 300,000 لاعب مسجل، مما عزز مكانتها كمنصة لعب الأدوار الرائدة في المنطقة العربية.',
      metric:'300K+', detail:'لاعب مسجل', image:'', motif:'community'},
    {year:'2026', label:'2026 — اليوم', tag:'BEYOND THE HORIZON', title:'التوسع في UGC والانطلاق عالمياً',
      text:'تتوسع RT Studios عبر منصات UGC مثل GTA و RDR، مع التركيز على بناء مجتمع لعب أدوار عالمي والتحول إلى رائد عالمي في الترفيه التفاعلي.',
      metric:'UGC', detail:'GTA · RDR · RT STUDIOS', image:'', motif:'global'}
  ]
};

