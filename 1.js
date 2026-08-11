// ================= INPUT =================
const userQuestion =
  $json.query?.chatInput || $input.first()?.json?.query?.chatInput || "";
const sessionId =
  $json.query?.sessionId || $input.first()?.json?.query?.sessionId || "";

// ================= GOOGLE SHEET DYNAMIC QUESTIONS =================
let sheetQuestions = [];
let cacheSource = 'none';
try {
  // 1. Try static data first
  try {
    const staticData = $getWorkflowStaticData('global');
    sheetQuestions = staticData.sheetQuestions || [];
    if (sheetQuestions.length > 0) {
      cacheSource = 'staticData';
    }
  } catch (err) {
    // Ignore static data error
  }

  // 2. If static data is empty, try file cache
  if (!sheetQuestions || sheetQuestions.length === 0) {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const cachePath = path.join(os.tmpdir(), 'n8n_sheet_questions_cache.json');
    if (fs.existsSync(cachePath)) {
      const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      sheetQuestions = cacheData.questions || [];
      if (sheetQuestions.length > 0) {
        cacheSource = 'fileCache';
      }
    }
  }
} catch (e) {
  // Fallback
}

// ================= PREDEFINED QUESTIONS =================
const hardcodedQuestions = [
  "Is it safe if I have a pacemaker?",
  "Can I use NerveSpa if I’m pregnant?",
  "Is this safe after surgery?",
  "Is it safe for seniors?",
  "Is the treatment painful?",
  "Are there any side effects?",
  "Can I overuse the therapy?",
  "What happens if I miss a session?",
  "Can NerveSpa help with plantar fasciitis?",
  "plantar fasciitis treatment",
  "How much does NerveSpa cost?",
  "How much does it cost?",
  "cost",
  "How to manage discomfort or adverse sensations?",
  "adverse sensations management",
  "Is continuing education provided?",
  "Does NerveSpa provide ongoing training?",
  "Are there any side effects?",
  "side effects",
  "Is it safe if I have a pacemaker?",
  "pacemaker safety",
  "how much this cost",
  "Is there a setup guide for first-time users?",
  "Can I use it for both feet at the same time?",
  "What is the difference between the LED wrap and the laser?",
  "How long does shipping usually take?",
  "How can I track my order?",
  "What payment methods do you accept?",
  "Can I return it if it does not work for me?",
  "What is NerveSpa?",
  "What are the best things and benefits about NerveSpa?",
  "Is NerveSpa a medical company?",
  "Can you explain what NerveSpa?",
  "Could you describe what NerveSpa?",
  "Tell me about NerveSpa",
  "Explain NerveSpa to me",
  "Who owns NerveSpa?",
  "How do providers implement NerveSpa?",
  "What conditions can NerveSpa support?",
  "How can clinics order NerveSpa or request a demo?",
  "Where can I find NerveSpa sell sheets and tech specs?",
  "What are NerveSpa\u2019s pricing options?",
  "Is NerveSpa FDA-registered?",
  "Is NerveSpa covered by insurance?",
  "What warranty and return policy does NerveSpa offer?",
  "Tell me about the NerveSpa return policy",
  "What is the return policy for NerveSpa devices?",
  "Can I return a used product to NerveSpa?",
  "Where is NerveSpa manufactured?",
  "How long has PMT been in business?",
  "Who is PMT?",
  "Who is Pain Management Technologies?",
  "Where can FDA listings be verified?",
  "What certifications does PMT hold?",
  "Does NerveSpa replace medical care?",
  "Who decides if NerveSpa is appropriate or right for me?",
  "Am I a good candidate for NerveSpa? Is it suitable for my condition?",
  "Is NerveSpa a US based company?",
  "How does NerveSpa compare to other nerve therapy systems?",
  "What makes NerveSpa unique?",
  "How does the NerveSpa family of products work together?",
  "Can patients purchase NerveSpa directly?",
  "Are starter kits or bundles available for clinics?",
  "Are NerveSpa programs difficult to implement?",
  "How long is a typical NerveSpa program?",
  "Is NerveSpa safe for most patients?",
  "Does NerveSpa offer training for clinics?",
  "How do clinics contact NerveSpa for support?",
  "Does NerveSpa replace medical treatment?",
  "Who determines if a patient is a good candidate for NerveSpa?",
  "Does NerveSpa support insurance reimbursement?",
  "What is HCPCS code E0720?",
  "How quickly are products shipped?",
  "How does NerveSpa work?",
  "How quickly does NerveSpa work?",
  "Can NerveSpa be combined with in-clinic treatments?",
  "What outcomes do patients commonly report?",
  "Can patients travel with NerveSpa devices?",
  "What is the NerveSpa Nerve Bath?",
  "How does the NerveSpa Nerve Bath work?",
  "How should the NerveSpa Nerve Bath be set up?",
  "How long is a typical NerveSpa Nerve Bath session?",
  "How often should the NerveSpa Nerve Bath be used?",
  "Why water-based therapy for the NerveSpa Nerve Bath?",
  "What improvements do patients report with the NerveSpa Nerve Bath?",
  "What consumables does the NerveSpa Nerve Bath use?",
  "What are NerveSpa conductive foot pads, socks, and gloves?",
  "How are the NerveSpa conductive foot pads and gloves used in therapy?",
  "Who should not use NerveSpa conductive garments?",
  "What is the NerveSpa Quake Plate?",
  "How do I set up and use the Quake Plate?",
  "How long and how often should I use the Quake Plate?",
  "Who should not use the Quake Plate?",
  "What is the NerveBeam LED Light Therapy Wrap?",
  "How is the NerveBeam LED Wrap used?",
  "Who should not use the NerveBeam LED Wrap?",
  "What outcomes are expected with LED wrap therapy?",
  "What is the NerveBeam Cold Laser?",
  "How is the NerveBeam Cold Laser used?",
  "Who should not use the NerveBeam Cold Laser?",
  "What outcomes are expected with Cold Laser therapy?",
  "What is the Knee Pro?",
  "How is the Knee Pro used?",
  "Who should not use the Knee Pro?",
  "What outcomes are expected with the Knee Pro?",
  "What is the Shoulder Pro?",
  "How is the Shoulder Pro used?",
  "Who should not use the Shoulder Pro?",
  "What outcomes are expected with the Shoulder Pro?",
  "What is the PowerWrap?",
  "How is the PowerWrap used?",
  "Who should not use the PowerWrap?",
  "What outcomes are expected with PowerWrap therapy?",
  "What are the NerveSpa Performance Diabetic Socks?",
  "How do I put on the Diabetic Socks correctly?",
  "How should the Diabetic Socks be washed or cared for?",
  "Can the Diabetic Socks be worn all day?",
  "What is the NerveSpa Neuropathy Program?",
  "How does the Neuropathy Program work?",
  "What devices are used in the Neuropathy Program?",
  "Do patients need all the devices in the Neuropathy Program?",
  "How long does the Neuropathy Program take?",
  "Why is consistency important in the Neuropathy Program?",
  "What happens after the initial Neuropathy Program is completed?",
  "Can the Neuropathy Program be adjusted over time?",
  "How do supplements fit into the Neuropathy Program?",
  "Can supplements be used alone without devices?",
  "How long is a typical Nerve Bath session?",
  "Can the Nerve Bath be used with other devices the same day?",
  "What should patients feel during a Nerve Bath session?",
  "How often should the Quake Plate be used?",
  "How long should a Quake Plate session last?",
  "Can Quake Plate be used with other neuropathy devices?",
  "What should patients feel during Quake Plate therapy?",
  "How often should the NerveBeam LED Wrap be used?",
  "How long is an LED Wrap session?",
  "What should patients feel during LED Wrap therapy?",
  "How should the LED Wrap be positioned for treatment?",
  "Who should not use the LED Wrap?",
  "How often should the NerveBeam Cold Laser be used?",
  "How long is a Cold Laser session?",
  "How should the Cold Laser be positioned during treatment?",
  "What should patients feel during Cold Laser therapy?",
  "Who should not use the Cold Laser?",
  "Can Cold Laser be combined with other neuropathy modalities?",
  "What supplements are commonly used in the Neuropathy Program?",
  "When should Nerve Rebuilder be taken?",
  "When should Nerve Regeneration be taken?",
  "When should Blood Flow Super Formula be taken?",
  "How do supplements support the Neuropathy Program?",
  "Can supplements be used alone without devices?",
  "What is the NerveSpa Joint & Mobility Program?",
  "How does the Joint & Mobility Program work?",
  "What devices are used in the Joint & Mobility Program?",
  "How long does the Joint & Mobility Program take?",
  "Can the Joint & Mobility Program be adjusted over time?",
  "How often should patients use the Knee Pro?",
  "How long is a Knee Pro session?",
  "Can Knee Pro be used with other joint therapies?",
  "What should patients feel during Knee Pro therapy?",
  "How often should patients use the Shoulder Pro?",
  "How long is a Shoulder Pro session?",
  "Can Shoulder Pro be used with other joint therapies?",
  "What should patients feel during Shoulder Pro therapy?",
  "What joint supplements are commonly used in the Joint & Mobility Program?",
  "When should Super Flex Joint Formula \u2013 Rebuild + Maintain be used?",
  "When should OA & RA Relief Cream be used?",
  "When should Nerve Target Roll-On be used?",
  "How do joint supplements fit into the Joint & Mobility Program?",
  "Can joint supplements be used alone without devices?",
  "What is the PowerWrap used for in the Clinical Program?",
  "How long is a PowerWrap session?",
  "How often can I use PowerWrap in a day?",
  "What power level should I start with on PowerWrap?",
  "How do I choose Constant vs Pulse mode on PowerWrap?",
  "What are the key safety rules for PowerWrap use?",
  "Can PowerWrap be combined with other therapies?",
  "What is NerveWave used for in the Clinical Program?",
  "How do I start a program on NerveWave?",
  "What intensity should NerveWave be set to?",
  "What is the recommended schedule for NerveWave regenerative pain control?",
  "How is NerveWave typically used for neuropathy?",
  "What is the recommended schedule for NerveWave restorative recovery?",
  "How does NerveWave track usage?",
  "Can NerveWave be used with accessory tools?",
  "What is the recommended schedule for NerveWave vagus nerve therapy?",
  "How long should Vibe be used in a typical session?",
  "How is Vibe typically used within a clinical plan?",
  "What should I do if my Nerve Bath device is frozen?",
  "What if there is no stimulation or weak stimulation in the Nerve Bath?",
  "What if the Nerve Bath device does not power on?",
  "What if stimulation stops or the program ends short of 30 minutes?",
  "What should I do if the LED Wrap lights are flickering or powering down early?",
  "Which treatment mode should I use on the LED Wrap?",
  "What should I avoid doing with the LED Wrap?",
  "How do I power the Knee Pro on/off and change modes?",
  "What if I\u2019m having issues with stimulation on Knee Pro?",
  "What should I know before using the Quake Plate?",
  "What if the Quake Plate makes a loud grinding noise?",
  "What if the Quake Plate remote does not work?",
  "What battery does the Quake Plate remote use?",
  "What should I do if stimulation feels weak with conductive socks or gloves?",
  "How do I clean conductive socks, gloves, or garments?",
  "How often should conductive garments be replaced?",
  "What should I do if the Cold Laser does not turn on?",
  "What if the Cold Laser shuts off during treatment?",
  "What should I do if the LED Wrap does not turn on?",
  "What if the LED Wrap lights flicker during use?",
  "What should I do if the LED Wrap powers down early?",
  "How do I clean the LED Wrap?",
  "What should I do if the PowerWrap does not turn on?",
  "What should I do if my skin feels too sensitive after PowerWrap use?",
  "What if the PowerWrap remote does not respond?",
  "What should I do if NerveWave does not power on?",
  "What if I feel no sensation during NerveWave use?",
  "What should I do if NerveWave stimulation feels too strong?",
  "What if the electrodes are not sticking properly?",
  "How do I place electrodes correctly?",
  "What should I do if NerveWave shuts off during treatment?",
  "What should I do if the Vibe device does not turn on?",
  "What if the Vibe stops during a session?",
  "What should patients feel during Vibe use?",
  "What should I do if Knee Pro does not power on?",
  "What if stimulation feels weak on Knee Pro?",
  "How do I change Knee Pro modes?",
  "What should I do if Shoulder Pro does not power on?",
  "What if stimulation feels weak on Shoulder Pro?",
  "How do I change Shoulder Pro modes?",
  "What if I feel little or no sensation during a Nerve Bath session?",
  "What should I do if the Nerve Bath unit does not turn on?",
  "Is tingling or warmth normal during a Nerve Bath session?",
  "What if the LED wrap does not turn on?",
  "What should I feel during LED wrap therapy?",
  "What if the Cold Laser does not activate?",
  "What should I feel during Cold Laser therapy?",
  "What if the Quake Plate feels too intense?",
  "What if the Quake Plate does not start vibrating?",
  "Is muscle fatigue normal after using the Quake Plate?",
  "What should I do if the PowerWrap does not power on?",
  "What if PowerWrap feels uncomfortable during use?",
  "What if I feel little or no sensation during NerveWave use?",
  "What should I feel during a NerveWave session?",
  "What if NerveWave does not turn on?",
  "When should I contact support for device issues?",
  "What if my device will not charge?",

  "What if stimulation feels too strong or uncomfortable?",
  "Can I continue treatment if I experience skin irritation?",
  "What if my conductive socks or garments do not work properly?",
  "How do I clean conductive garments?",
  "Where can I find setup guides and manuals?",
  "What if I feel no sensation during a Nerve Bath session?",
  "What if the water feels too hot or uncomfortable?",

  "What if stimulation feels uneven between hands or feet?",
  "What if the PowerWrap does not turn on?",
  "What if the wrap feels too warm?",
  "What if I do not feel stimulation with NerveWave?",
  "What if electrodes lose adhesion during use?",
  "What if the NerveWave unit will not power on?",
  "What if the Vibe device does not start?",
  "What if vibration feels uncomfortable?",
  "What if the Knee Pro does not deliver sensation?",
  "What if the Knee Pro strap feels too tight or loose?",
  "What if the Shoulder Pro feels uncomfortable during use?",
  "What if the Shoulder Pro does not power on?",
  "What if I don\u2019t feel stimulation in the water?",
  "What if stimulation feels uneven between feet or hands?",

  "What if the Cold Laser does not emit light?",
  "What if treatment feels ineffective?",
  "What if vibration feels too intense?",
  "What if the Quake Plate does not power on?",
  "What if conductive socks or gloves feel dry during use?",
  "What if stimulation cuts in and out when using conductive garments?",
  "What if the garment no longer conducts stimulation well?",
  "What if Knee Pro shuts off during a session?",
  "What if the Knee Pro feels uncomfortable around the knee?",
  "What if the Shoulder Pro shifts during use?",
  "What if the Shoulder Pro shuts off unexpectedly?",
  "What if the screen does not respond or freezes?",
  "What if lead wires appear damaged?",
  "When should I stop treatment and contact my provider?",
  "What if a device will not power on?",
  "What if stimulation feels weaker than expected?",
  "What if the device becomes warm during use?",
  "What if an error message appears on the screen?",
  "What if the battery drains faster than expected?",
  "What if accessories are lost or damaged?",
  "Can devices be shared between patients?",
  "How should devices be cleaned after use?",
  "When should I contact NerveSpa support?",
  "What if there is no sensation during a NerveSpa Nerve Bath session?",
  "What if the sensation feels uneven between feet or hands?",
  "What if the water feels too warm or too cool?",
  "What if the session stops",
  "What if the session stops before 30 minutes?",
  "What if the device will not power on?",
  "What if stimulation feels too strong?",
  "What if the wrap shuts off during a session?",
  "What if I do not feel anything during treatment?",
  "What if the Cold Laser does not power on?",
  "What if the laser shuts off during treatment?",
  "What if I do not feel any sensation from the laser?",
  "What should I do if the device overheats?",
  "What if the wrap does not stay secured?",
  "What if the LEDs appear dim?",
  "What if the Knee Pro does not power on?",
  "What if the stimulation feels too strong?",
  "What if the stimulation feels too weak?",
  "How do clinics measure patient engagement with NerveSpa?",
  "What non-diagnostic indicators can providers monitor when using NerveSpa?",
  "How does NerveSpa support patient-reported comfort or function tracking?",
  "Can clinics document changes in patient experience over time with NerveSpa?",
  "Does NerveSpa provide usage or adherence data to clinics?",
  "How can providers discuss progress with patients without making medical claims?",
  "What types of patient feedback are most commonly reported with NerveSpa use?",
  "How should front-desk staff explain NerveSpa to patients in simple terms?",
  "What should staff say if a patient asks whether NerveSpa replaces medical treatment?",
  "How should staff respond if a patient asks whether NerveSpa is FDA approved?",
  "What should staff say if a patient asks about insurance coverage?",
  "How should staff explain home use versus in-clinic guidance?",
  "What is the best way for staff to set expectations before a patient begins using NerveSpa?",
  "How should staff handle common patient misconceptions about NerveSpa?",
  "How is NerveSpa different from consumer-grade nerve stimulation devices?",
  "What makes NerveSpa a clinic-grade system rather than a retail product?",
  "Why do clinics choose NerveSpa over generic home wellness devices?",
  "How does NerveSpa integrate into existing clinical workflows?",
  "What design principles guide the NerveSpa system?",
  "How does NerveSpa support consistency and repeatability in patient use?",
  "When should clinics pause or discontinue use of NerveSpa?",
  "What should providers do if a patient reports discomfort during use?",
  "When should a clinic contact NerveSpa support versus handling an issue internally?",
  "What situations require clinical judgment before continuing NerveSpa use?",
  "Are there any patient scenarios where NerveSpa may not be appropriate?",
  "How does NerveSpa support safe use alongside other clinical modalities?",
  "Is NerveSpa available outside the United States?",
  "Are international certifications or markets planned for NerveSpa?",
  "Can clinics outside the U.S. request information or express interest?",
  "How does NerveSpa evaluate expansion into new regions or care settings?",
  "Show me a demo",
  "Show me demos for all devices",
  "Show me a demo for Footbath",
  "Show me a demo for Conductive Garments",
  "Show me a demo for LED Wrap",
  "Show me a demo for Power Wrap",
  "Show me a demo for QuakePlate",
  "Show me a demo for Knee Pro",
  "Show me a demo for Shoulder Pro",
  "Where do I download the user manual?",
  "Where do I download the user manual for all devices?",
  "Where do I download the user manual for Footbath?",
  "Where do I download the user manual for Conductive Garments?",
  "Where do I download the user manual for LED Wrap?",
  "Where do I download the user manual for Power Wrap?",
  "Where do I download the user manual for QuakePlate?",
  "Where do I download the user manual for Knee Pro?",
  "Where do I download the user manual for Shoulder Pro?",
  "all",
  "quick-start guide",
  "guide",
  "Troubleshoot Knee Pro",
  "Troubleshoot Shoulder Pro",
  "How do I clean and store Knee Pro?",
  "How do I clean and store Shoulder Pro?",
  "How long is a QuakePlate session?",
  "How often should QuakePlate be used?",
  "How do I clean and maintain the conductive garments?",
  "How often should the LED Wrap be used?",
  "How often should the Power Wrap be used?",
  "Troubleshoot QuakePlate",
  "Do you ship internationally?",
  "contact info",
  "phone number",
  "email id",
  "Where can I read your privacy policy?",
  "Where can I read your terms and conditions?",
  "Do you have an FAQ page I can browse?",
  "How will my items be shipped?",
  "When will my order arrive?",
  "How do I pay for my order?",
  "Why did my order fail?",
  "Do you charge sales tax?",
  "Is my product under warranty?",
  "How do I file a warranty claim?",
  "I don't want this product, can I return my order?",
  "How do I return my order?",
  "How long to charge and how to maintain the battery?",
  "How much water to add?",
  "Do the carbon rubber pads need replaced?",
  "How often should I use the NerveSpa?",
  "What do the modes do?",
  "Why is it recommended to rotate the pads from treatment to treatment?",
  "Which light therapy device should I purchase?",
  "Can I use two LED therapy wraps at the same time?",
  "Will my insurance cover the NerveSpa?",
  "What is the HCPCS code for the NerveSpa?",
  "What if my skin feels too sensitive after PowerWrap use?",
  "What if the Nerve Bath unit does not turn on?",
  "What if stimulation feels too weak?",
  "Where do I download the user manual for Shoulder Pro",
  "Do you ship to Canada?",
  "Who are the doctors or clinicians associated with NerveSpa?",
  "What therapies are included in NerveSpa?",
  "Is NerveSpa a clinic, a product, or a treatment program?",
  "What kind of patients usually use NerveSpa?",
  "Will this help with balance issues caused by neuropathy?",
  "Is NerveSpa only for foot problems, or can it help hands too?",
  "Why is water used in the treatment?",
  "Do you offer financing?",
  "How do I find a provider near me?",
  "Do I need a prescription?",
  "Describe what training is needed for staff to use NerveSpa.",
  "Explain how to monitor patients using NerveSpa",
  'Should a healthy hand be able to feel the "tingle" in the glove?',
  "What is the difference between the NerveSpa Single and the NerveSpa Dual",
  "What is the set-up for treating both hands",
  "How do I get the best results from the NerveSpa program",
  "Is conductive spray required for efficacy?",
  "Where is NerveSpa located?",
  "How easy is it for patients to use at home and what compliance rates are typically observed?",
  "What level of staff training is required and how long does onboarding take?",
  "What is the recommended treatment protocol (duration, frequency, modalities) and how soon can patients expect results?",
  "What is the protocol for the Nerve and Neuropathy supplements?",
  "We have a patient that is using NervSspa at home for foot neuropathy and he is reporting that his feet swell up shortly after using it",
  "What should I do if my feet swell after using NerveSpa?",
];


// Merge: Sheet questions first, then hardcoded (keeping unique ones)
const predefinedQuestions = [...new Set([...sheetQuestions, ...hardcodedQuestions])];

// ================= SYNONYMS =================
const synonyms = {
  made: "manufactured",
  produced: "manufactured",
  created: "manufactured",
  built: "manufactured",
  origin: "manufactured",
  cost: "pricing",
  pay: "pricing",
  price: "pricing",
  purchase: "pricing",
  buy: "pricing",
  amount: "pricing",
  clinics: "clinic",
  providers: "clinic",
  provider: "clinic",
  practice: "clinic",
  physician: "clinic",
  offering: "start",
  begin: "start",
  starting: "start",
  ordering: "order",
  usa: "us",
  america: "us",
  united: "us",
  states: "us",
  vibration: "quake plate",
  platform: "quake plate",
  vibrational: "quake plate",
  knee: "knee pro",
  shoulder: "shoulder pro",
  laser: "cold laser",
  led: "led wrap",
  socks: "diabetic socks",
  garments: "conductive garments",
  bath: "nerve bath",
  aquatic: "nerve bath",
  water: "nerve bath",
  footbath: "nerve bath",
  participation: "consistency",
  engagement: "consistency",
  consistency: "repeatability",
  issues: "conditions",
  concerns: "conditions",
  problems: "conditions",
  symptoms: "conditions",
  address: "location",
  location: "location",
  located: "location",
  situated: "location",
  lokated: "location",
  headquarter: "location",
  manage: "support",
  help: "support",
  impacted: "replace",
  impacts: "replace",
  interfere: "replace",
  interference: "replace",
  treatment: "medical",
  care: "medical",
  supplies: "consumables",
  materials: "consumables",
  items: "consumables",
  parts: "consumables",
  canada: "internationally",
  uk: "internationally",
  europe: "internationally",
  overseas: "internationally",
  global: "internationally",
  international: "internationally",
  faq: "faq",
  blog: "faq",
  education: "faq",
  newsletter: "faq",
  bulk: "bulk pricing",
  wholesale: "bulk pricing",
  discount: "pricing",
  coupon: "pricing",
  veteran: "pricing",
  senior: "pricing",
  lease: "pricing",
  hsa: "insurance",
  fsa: "insurance",
  paypal: "pay",
  apple: "pay",
  credit: "pay",
  ship: "shipped",
  shipping: "shipped",
  product: "products",
  products: "products",
  catalog: "products",
  portfolio: "products",
  offerings: "products",
  device: "nervespa",
  devices: "nervespa",
  nervespa: "nerve spa",
  powerwrap: "power wrap",
  quakeplate: "quake plate",
  nervewave: "nerve wave",
  nervebath: "nerve bath",
  nervebeam: "nerve beam",
  approved: "registered",
  approval: "registered",
  listings: "registered",
  legality: "registered",
  certified: "registered",
  certification: "registered",
  authorized: "registered",
  best: "recommend",
  choose: "recommend",
  pick: "recommend",
  select: "recommend",
  suggestion: "recommend",
  suggest: "recommend",

  appropriate: "suitable",
  candidate: "suitable",
  fit: "suitable",
  right: "suitable",
  eligibility: "suitable",
  eligible: "suitable",

  decide: "determine",
  decides: "determine",
  determine: "determine",
  determines: "determine",
  know: "determine",
  tell: "determine",
  education: "training",
  adverse: "discomfort",
  sensations: "discomfort",
  nervebeam: "nerve beam",

  length: "long",
  duration: "long",
  time: "long",
  info: "about",
  information: "about",
  details: "about",
  details: "about",

  fda: "registered",
  track: "shipped",
  tracking: "shipped",
  arrive: "shipped",
  delivery: "shipped",
  return: "return",
  exchange: "return",
  refund: "return",
  cancel: "return",
  policy: "return",
  used: "return",
  opened: "return",
  unboxed: "return",
  damage: "warranty",
  broken: "warranty",
  repair: "warranty",
  lifespan: "warranty",
  video: "demo",
  videos: "demo",
  guide: "manuals",
  manual: "manuals",
  locator: "contact",
  chat: "contact",
  human: "contact",
  sales: "contact",
  book: "contact",
  callback: "contact",
  person: "contact",
  onboarding: "implement",
  marketing: "implement",
  "multi-location": "clinic",
  certification: "training",
  credits: "training",
  staff: "training",
  schedule: "often",
  morning: "often",
  evening: "often",
  exercise: "often",
  tv: "often",
  lotion: "pad",
  intensity: "strong",
  beginner: "strong",
  both: "same",
  household: "share",
  sanitize: "clean",
  store: "clean",
  diagnose: "medical",
  medication: "medical",
  medications: "medical",
  medicine: "medical",
  medicines: "medical",
  treatment: "medical",
  treatments: "medical",
  care: "medical",
  doctor: "clinic",
  physician: "clinic",
  emergency: "medical",
  plan: "program",
  clinician: "medical",

  tens: "compare",
  gabapentin: "compare",
  pregabalin: "compare",
  physical: "compare",
  massage: "compare",
  acupuncture: "compare",

  evidence: "certified",
  research: "certified",
  data: "certified",
  outcome: "certified",

  password: "login",
  account: "login",

  recommended: "recommend",
  recommendation: "recommend",
  recommendations: "recommend",
  advice: "recommend",
  pick: "choose",
  select: "choose",
  best: "right",

  customer: "patient",
  customers: "patient",
  review: "feedback",
  reviews: "feedback",
  testimonial: "feedback",
  testimonials: "feedback",
  setup: "set up",
  sensation: "tingle",
  shock: "tingle",
  zap: "tingle",
  feeling: "feel",
  normal: "healthy",
  mitt: "glove",
  mitts: "glove",
  versus: "difference",
  vs: "difference",
  one: "single",
  two: "dual",
  bilateral: "dual",
  simultaneous: "dual",
  prepare: "set up",
  preparation: "set up",
  outcomes: "results",
  outcome: "results",
  optimal: "recommend",
  protocol: "program",
  regimen: "program",
  need: "required",
  necessary: "required",
  must: "required",
  liquid: "spray",
  benefit: "results",
  benefits: "results",
  improvement: "results",
  improvements: "results",
  wholesale: "pricing",
  adherence: "compliance",
  retention: "compliance",
  implementation: "implement",
  operational: "implement",
  frequency: "often",
  modalities: "modality",
  modality: "modality",
  duration: "length",
  expect: "expected",
  expects: "expected",
  expected: "results",
  soon: "expected",
  swell: "swelling",
  edema: "swelling",
  supplement: "supplements",
  phases: "phase",
};

// ================= STOPWORDS =================
const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "if",
  "in",
  "into",
  "is",
  "it",
  "no",
  "of",
  "on",
  "or",
  "such",
  "that",
  "the",
  "their",
  "then",
  "there",
  "these",
  "they",
  "this",
  "to",
  "was",
  "will",
  "with",
  "do",
  "does",
  "did",
  "can",
  "could",
  "should",
  "would",
  "i",
  "you",
  "he",
  "she",
  "we",
  "my",
  "your",
  "his",
  "her",
  "our",
  "how",
  "what",
  "why",
  "where",
  "when",
  "who",
  "has",
  "been",
  "hold",
  "u",
  "s",
  "me",
  "about",
  "some",
  "more",
  "much",
  "very",
  "give",
  "get",
  "please",
  "current",
  "go",
  "doing",
  "today",
  "day",
  "hello",
  "hi",
  "hey",
  "there",
  "thanks",
  "thank",
  "yes",
  "no",
  "ok",
  "okay",
]);

// ================= NORMALIZE =================
function normalize(text) {
  if (!text) return "";

  let base = text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let words = base.split(" ");
  for (let i = 0; i < words.length; i++) {
    if (synonyms[words[i]]) {
      words[i] = synonyms[words[i]];
    }
  }

  return words.join(" ").trim();
}

// ================= STEM =================
function stem(word) {
  if (!word || word.length <= 3) return word;
  return word.replace(/(ing|ly|ed|er|es|s|ion)$/, "");
}

// ================= TOKENIZE =================
function getTokens(text) {
  const tokens = normalize(text)
    .split(" ")
    .filter((w) => w && !stopWords.has(w))
    .map(stem);
  return [...new Set(tokens)];
}

// ================= LEVENSHTEIN =================
function levenshteinDistance(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: b.length + 1 }, () => []);

  for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j - 1] + 1,
            );
    }
  }

  return matrix[b.length][a.length];
}

// ================= JACCARD =================
function jaccardScore(a, b) {
  const setA = new Set(getTokens(a));
  const setB = new Set(getTokens(b));

  const union = new Set([...setA, ...setB]).size;
  if (union === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }

  return intersection / union;
}

// ================= IDF PRECALC =================
const docCount = predefinedQuestions.length;
const freqMap = {};

predefinedQuestions.forEach((q) => {
  const uniqueTokens = new Set(getTokens(q));
  uniqueTokens.forEach((t) => {
    freqMap[t] = (freqMap[t] || 0) + 1;
  });
});

const idfWeights = {};
Object.keys(freqMap).forEach((t) => {
  idfWeights[t] = Math.log(docCount / freqMap[t]) + 1.0;
});

// ================= SEMANTIC SCORE =================
function getSemanticScore(input, target) {
  const tokens1 = getTokens(input);
  const tokens2 = getTokens(target);

  if (!tokens1.length || !tokens2.length) return 0;

  let weightedIntersection = 0;
  let totalInputWeight = 0;
  let totalTargetWeight = 0;

  tokens1.forEach((t) => (totalInputWeight += idfWeights[t] || 1.0));
  tokens2.forEach((t) => (totalTargetWeight += idfWeights[t] || 1.0));

  const matched2 = new Set();

  for (let i = 0; i < tokens1.length; i++) {
    const w1 = tokens1[i];
    const w1Weight = idfWeights[w1] || 1.0;

    let bestMatchScore = 0;
    let bestMatchIndex = -1;

    for (let j = 0; j < tokens2.length; j++) {
      if (matched2.has(j)) continue;

      const w2 = tokens2[j];

      if (w1 === w2) {
        bestMatchScore = 1;
        bestMatchIndex = j;
        break;
      }

      if (w1.length >= 4 && w2.length >= 4) {
        const dist = levenshteinDistance(w1, w2);
        const maxLen = Math.max(w1.length, w2.length);
        const similarity = 1 - dist / maxLen;

        if (similarity >= 0.75 && similarity > bestMatchScore) {
          bestMatchScore = similarity;
          bestMatchIndex = j;
        } else if (
          (w1.includes(w2) || w2.includes(w1)) &&
          0.6 > bestMatchScore
        ) {
          bestMatchScore = 0.6;
          bestMatchIndex = j;
        }
      }
    }

    if (bestMatchIndex !== -1) {
      weightedIntersection += bestMatchScore * w1Weight;
      matched2.add(bestMatchIndex);
    }
  }

  const inputCoverage = totalInputWeight
    ? weightedIntersection / totalInputWeight
    : 0;
  const targetCoverage = totalTargetWeight
    ? weightedIntersection / totalTargetWeight
    : 0;

  let finalScore = inputCoverage * 0.7 + targetCoverage * 0.3;

  if (tokens1.length >= 5 && weightedIntersection < 2.0) {
    finalScore *= 0.7;
  }

  return Math.max(0, Math.min(1, finalScore));
}

// ================= FINAL COMBINED SCORE =================
function combinedScore(input, target) {
  const normInput = normalize(input);
  const normTarget = normalize(target);

  const charDist = levenshteinDistance(normInput, normTarget);
  const maxLen = Math.max(normInput.length, normTarget.length, 1);
  const charSimilarity = 1 - charDist / maxLen;

  const semantic = getSemanticScore(input, target);
  const jaccard = jaccardScore(input, target);

  // Weighted final score
  return semantic * 0.55 + jaccard * 0.25 + charSimilarity * 0.2;
}

// ================= MATCH FINDING =================
let bestScore = 0;
let bestIndex = -1;

const sheetQuestionsSet = new Set(sheetQuestions.map(q => q.toLowerCase().trim()));

for (let i = 0; i < predefinedQuestions.length; i++) {
  const q = predefinedQuestions[i];
  let score = combinedScore(userQuestion, q);

  // Prioritize Google Sheet questions by adding a score boost (up to 1.0)
  if (sheetQuestionsSet.has(q.toLowerCase().trim())) {
    score = Math.min(1.0, score + 0.15);
  }

  if (score > bestScore) {
    bestScore = score;
    bestIndex = i;
  }
}

// ================= THRESHOLD =================
// You can tune this between 0.45 and 0.65 depending on strictness
const threshold = 0.5;
let matchFound = bestScore >= threshold;

// ================= PROHIBITED INTENT OVERRIDE =================
const prohibitedKeywords = [
  "joke",
  "poem",
  "write me a",
  "write an email",
  "write a message",
  "how you work",
  "what you can do",
  "what can you do",
  "explain yourself",
  "monitor patients",
  "do you have",
  "do you sell",
];
const isProhibited = prohibitedKeywords.some((keyword) =>
  userQuestion.toLowerCase().includes(keyword),
);

if (isProhibited) {
  matchFound = false;
}

// ================= PRODUCT OVERRIDE =================
const products = [
  "rebuilder",
  "builder",
  "regeneration",
  "blood flow",
  "super formula",
  "target roll",
  "relief cream",
  "super flex",
  "quake plate",
  "quakeplate",
  "knee pro",
  "shoulder pro",
  "cold laser",
  "led wrap",
  "power wrap",
  "powerwrap",
  "nervewave",
  "nerve wave",
  "nerve bath",
  "nervebath",
  "diabetic socks",
  "conductive",
  "vibe",
  "immunogut",
  "immuno gut",
  "skinny",
  "sleep",
  "n1",
  "oa cream",
  "ra cream",
  "nervespa pro",
  "nerve spa pro",
  "classic",
  "foot bath supply",
  "joint health",
  "support kit",
  "gut support",
];

if (matchFound && bestScore < 0.85) {
  const normQ = userQuestion.toLowerCase();
  const mentionedProduct = products.find((p) => normQ.includes(p));

  if (mentionedProduct) {
    const isInfoSeeking =
      /(tell me|what is|information|something about|details|explain|more about|more info|what are|how to use|how does it work)/.test(
        normQ,
      );
    const matchedQNorm = predefinedQuestions[bestIndex].toLowerCase();
    const pName = mentionedProduct.replace(/\s+/g, "");
    const matchedHasProduct = matchedQNorm.replace(/\s+/g, "").includes(pName);

    // If it's an info query, or if it incorrectly matched a question about a completely different topic
    if (isInfoSeeking || !matchedHasProduct) {
      matchFound = false;
    }
  }
}

// ================= INTENT OVERRIDE =================
if (bestScore < 0.85) {
  const normQ = userQuestion.toLowerCase();

  // Specific Override for timeline question
  if (
    normQ.includes("how quickly") &&
    normQ.includes("nervespa") &&
    normQ.includes("work")
  ) {
    const timelineIndex = predefinedQuestions.findIndex(
      (q) => q === "How quickly does NerveSpa work?",
    );
    if (timelineIndex !== -1) {
      matchFound = true;
      bestIndex = timelineIndex;
      bestScore = 1.0;
    }
  }

  // Specific Override for mechanism question
  if (
    !normQ.includes("quickly") &&
    normQ.includes("how") &&
    normQ.includes("nervespa") &&
    normQ.includes("work")
  ) {
    const workIndex = predefinedQuestions.findIndex(
      (q) => q === "How does NerveSpa work?",
    );
    if (workIndex !== -1) {
      matchFound = true;
      bestIndex = workIndex;
      bestScore = 1.0;
    }
  }

  const isFindingProvider =
    /(list of|find a|looking for|where is|locate a|provide me list|list of) .*?(clinic|provider|doctor|location)/.test(
      normQ,
    ) ||
    /(find|list|locate|where).*?(clinic|provider|doctor|location)/.test(normQ);

  if (isFindingProvider) {
    const providerIndex = predefinedQuestions.findIndex(
      (q) => q === "How do I find a provider near me?",
    );
    if (providerIndex !== -1) {
      matchFound = true;
      bestIndex = providerIndex;
      bestScore = 1.0;
    }
  }

  // Specific Override for sell sheets and tech specs
  if (
    normQ.includes("sell sheet") ||
    normQ.includes("tech spec") ||
    normQ.includes("specifications")
  ) {
    const specIndex = predefinedQuestions.findIndex(
      (q) => q === "Where can I find NerveSpa sell sheets and tech specs?",
    );
    if (specIndex !== -1) {
      matchFound = true;
      bestIndex = specIndex;
      bestScore = 1.0;
    }
  }

  const isSideEffects =
    /(adverse impact|side effect|negative effect|bad effect|side-effect|adverse effect|adverse reaction|concern.*?customer|customer.*?concern|concern.*?patient|patient.*?concern|safety concern|what concern)/.test(
      normQ,
    );
  if (isSideEffects) {
    const sideEffectIndex = predefinedQuestions.findIndex(
      (q) => q === "Are there any side effects?",
    );
    if (sideEffectIndex !== -1) {
      matchFound = true;
      bestIndex = sideEffectIndex;
      bestScore = 1.0;
    }
  }

  const isCompanyLocation =
    /(where is|location of|situated|address of|headquarter|physical office|office location).*?(nervespa|company|your)/.test(
      normQ,
    ) ||
    /(nervespa|company).*?(where|location|situated|address|headquarter)/.test(
      normQ,
    );
  if (isCompanyLocation) {
    const locationIndex = predefinedQuestions.findIndex(
      (q) => q === "Where is NerveSpa located?",
    );
    if (locationIndex !== -1) {
      matchFound = true;
      bestIndex = locationIndex;
      bestScore = 1.0;
    }
  }

  const isContactSupport =
    /(support|contact|help|email|phone|nervespa support|customer support|support team|tech support|contact us|contact nervespa|how to contact|phone number|email address|help desk|customer service)/.test(
      normQ,
    ) && !/(joint health support|support kit|gut support|sleep support)/.test(normQ);
  if (isContactSupport) {
    const supportIndex = predefinedQuestions.findIndex(
      (q) => q === "contact info",
    );
    if (supportIndex !== -1) {
      matchFound = true;
      bestIndex = supportIndex;
      bestScore = 1.0;
    }
  }
}

// ================= AMBIGUITY OVERRIDE =================
if (matchFound) {
  const normQ = userQuestion.toLowerCase();
  
  // Generic terms that usually imply a missing subject
  const genericTerms = ["unit", "device", "machine", "wrap", "system", "it", "this", "these", "they", "them"];
  
  // Check if they used a standalone generic term
  const hasGeneric = genericTerms.some((t) => new RegExp(`\\b${t}\\b`).test(normQ));
  const hasSpecificProduct = products.some((p) => normQ.includes(p));
  const hasCompany = normQ.includes("nervespa") || normQ.includes("pmt");
  const isClearContext = hasSpecificProduct || hasCompany;

  // 1. If it has a generic term but no clear product/company context, it's ambiguous
  if (hasGeneric && !isClearContext) {
    matchFound = false;
  }
  
  // 2. If the query is very short (e.g. <= 4 words) and lacks context, treat as ambiguous 
  // to force LLM clarification (e.g., "cost?", "does it work?", "help?", "why?")
  const wordCount = normQ.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount <= 6 && !isClearContext) {
    matchFound = false;
  }
}

// ================= CONTEXT FOLLOW-UP OVERRIDE =================
// If the user's query is highly likely to be a follow-up answer to "Which product?" 
// (e.g., "I mean the NerveBath", "Talking about the power wrap", "For the Knee Pro"),
// we MUST force it to the LLM so the LLM can combine it with the conversation history.
if (matchFound) {
  const normQ = userQuestion.toLowerCase().trim();
  const isContextFollowUp = /^(i mean|i am asking about|i'm asking about|talking about|for|specifically)?\s*(the|just the|it is the|it's the)?\s*(nerve|knee|shoulder|quake|cold laser|led wrap|power wrap|vibe|bath|socks)/.test(normQ);
  
  if (isContextFollowUp && !normQ.includes("how") && !normQ.includes("what") && !normQ.includes("why") && !normQ.includes("where") && !normQ.includes("when")) {
    matchFound = false;
  }
}

// ================= OUTPUT =================
let resultOutput = "";
let bestMatch = "";

if (matchFound) {
  bestMatch = predefinedQuestions[bestIndex];
  resultOutput = "Matched with defined questions. Please see the details below";
} else {
  resultOutput =
    "I am your dedicated NerveSpa assistant, here to support your journey toward better health with our advanced wellness technology. To ensure you receive the most relevant assistance, I specialize exclusively in NerveSpa-related topics. How can I help you explore our products or provide support today? 💙";
}

return [
  {
    json: {
      match: matchFound,
      matchIndex: matchFound ? bestIndex : -1,
      normalizedQuestion: normalize(userQuestion),
      similarityScore: Number(bestScore.toFixed(4)),
      sessionId: sessionId,
      output: resultOutput,
      matched_question: matchFound ? bestMatch : "",
      debug: {
        cacheSource: cacheSource,
        sheetQuestionsCount: sheetQuestions.length,
        totalQuestionsCount: predefinedQuestions.length,
        hasMatchInSheet: matchFound ? sheetQuestionsSet.has(bestMatch.toLowerCase().trim()) : false
      }
    },
  },
];
