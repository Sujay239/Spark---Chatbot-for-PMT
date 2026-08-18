const incomingQuestion =
  $input.first()?.json?.chatInput ||
  $input.first()?.json?.query?.chatInput ||
  $("Webhook").first()?.json?.query?.chatInput ||
  "";

// ================= CODE-LEVEL GUARDRAILS (NO LLM NEEDED) =================
const DOMAIN_WHITELIST = new Set([
  "tens", "ems", "ifc", "nmes", "microcurrent", "galvanic", "transcutaneous",
  "interferential", "electrotherapy", "electrodes", "electrode", "leadwires",
  "leadwire", "rechargeable", "u5", "u1", "u11", "u20", "u3t", "jstim", "qfiber",
  "pmt", "thermotech", "thermacycle", "theratrac", "theralamp", "thermorelief",
  "neuropathy", "sciatica", "fibromyalgia", "lumbago", "arthritis", "contraindication",
  "contraindications", "waveform", "waveforms", "hz", "hertz", "microseconds"
]);

function isNonEnglish(text) {
  if (!text) return false;
  // 1. Non-Latin scripts (Cyrillic, Arabic, CJK, Devanagari, Hebrew, Greek, Thai)
  const nonLatinRegex = /[\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0900-\u097F\u0590-\u05FF\u0370-\u03FF\u0E00-\u0E7F]/;
  if (nonLatinRegex.test(text)) return true;

  // 2. Distinctive non-English phrases/words
  const foreignPhrases = [
    /¿|¡/,
    /\b(hola|buenos dias|buenas tardes|buenas noches|como estas|cómo estás|que es|qué es|donde esta|dónde está|para que sirve|para qué sirve|gracias|por favor|ayuda me|ayudame|dolor de|cuanto cuesta|cuánto cuesta)\b/i,
    /\b(bonjour|bonsoir|comment ca va|comment ça va|merci|s'il vous plait|s'il vous plaît|aidez-moi|pourquoi|combien coute|combien coûte)\b/i,
    /\b(guten tag|guten morgen|hallo wie|danke schon|danke schön|bitte hilfe|wie funktioniert|wie viel kostet)\b/i,
    /\b(olá|bom dia|boa tarde|obrigado|por favor me ajude|como funciona|quanto custa)\b/i,
    /\b(ciao come|buongiorno|grazie mille|per favore|come funciona|quanto costa)\b/i
  ];
  return foreignPhrases.some(regex => regex.test(text));
}

function isGibberishOrKeyboardMash(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;

  // Symbols only or punctuation only
  if (/^[^a-zA-Z0-9]+$/.test(trimmed)) return true;

  const words = trimmed.split(/\s+/);
  for (const word of words) {
    const cleanWord = word.replace(/[^a-zA-Z]/g, '');
    if (cleanWord.length === 0) continue;
    if (DOMAIN_WHITELIST.has(cleanWord.toLowerCase())) continue;

    // 1. Extreme mixed case inside a single word (e.g. fuihDfuhnsDIO, gfjpISDJgfpisSDJGF)
    let caseTransitions = 0;
    for (let i = 0; i < cleanWord.length - 1; i++) {
      const isCurrUpper = cleanWord[i] === cleanWord[i].toUpperCase();
      const isNextUpper = cleanWord[i + 1] === cleanWord[i + 1].toUpperCase();
      if (isCurrUpper !== isNextUpper) caseTransitions++;
    }
    if (cleanWord.length >= 7 && caseTransitions >= 3) return true;

    // 2. Consonant clusters >= 6 in a row
    if (/[bcdfghjklmnpqrstvwxyz]{6,}/i.test(cleanWord)) return true;

    // 3. Long word (>= 6 chars) with zero vowels
    if (cleanWord.length >= 6 && !/[aeiouy]/i.test(cleanWord)) return true;

    // 4. Repeated character sequence 4+ times
    if (/(.)\1{4,}/.test(cleanWord) || /([a-zA-Z]{2,4})\1{3,}/.test(cleanWord)) return true;

    // 5. Very low vowel-to-consonant ratio in long words (>= 8 chars with < 13% vowels)
    if (cleanWord.length >= 8) {
      const vowels = (cleanWord.match(/[aeiouy]/gi) || []).length;
      if (vowels / cleanWord.length < 0.13) return true;
    }
  }
  return false;
}

// Intercept non-English language queries directly in code
if (isNonEnglish(incomingQuestion)) {
  return [
    {
      json: {
        output: "I can only assist you in English. Please ask your question in English.",
        debug: { guardrail: "non-english" }
      }
    }
  ];
}

// Intercept gibberish / keyboard mash / severe typos directly in code
if (isGibberishOrKeyboardMash(incomingQuestion)) {
  return [
    {
      json: {
        output: "Typo detected. Please check your question and try again.",
        debug: { guardrail: "typo-detected" }
      }
    }
  ];
}

// ================= GOOGLE SHEET DYNAMIC Q&A =================
let sheetQAPairs = [];
let cacheSource = 'none';
try {
  // 1. Try static data first
  try {
    const staticData = $getWorkflowStaticData('global');
    sheetQAPairs = staticData.sheetQAPairs || [];
    if (sheetQAPairs.length > 0) {
      cacheSource = 'staticData';
    }
  } catch (err) {
    // Ignore static data error
  }

  // 2. If static data is empty, try file cache
  if (!sheetQAPairs || sheetQAPairs.length === 0) {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const cachePath = path.join(os.tmpdir(), 'n8n_sheet_questions_cache.json');
    if (fs.existsSync(cachePath)) {
      const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      sheetQAPairs = cacheData.qaPairs || [];
      if (sheetQAPairs.length > 0) {
        cacheSource = 'fileCache';
      }
    }
  }
} catch (e) {
  // Fallback
}

// JSON Q&A pairs
const hardcodedQAPairs = [
  {
    "question": "contact info",
    "answer": "You can contact Pain Management Technologies (PMT) using the following details:\n\nPhone: 1-800-239-7880\nFax: 1-330-564-0118\nEmail: info@paintechnology.com\nAddress: 1760 Wadsworth Road | Akron Ohio 44320\n\nContact Page: https://paintechnology.com/contact"
  },
  {
    "question": "How can I contact Pain Management Technologies?",
    "answer": "You can contact Pain Management Technologies (PMT) using the following details:\n\nPhone: 1-800-239-7880\nFax: 1-330-564-0118\nEmail: info@paintechnology.com\nAddress: 1760 Wadsworth Road | Akron Ohio 44320\n\nContact Page: https://paintechnology.com/contact"
  },
  {
    "question": "What is the phone number and email for PMT customer support?",
    "answer": "You can contact Pain Management Technologies (PMT) using the following details:\n\nPhone: 1-800-239-7880\nFax: 1-330-564-0118\nEmail: info@paintechnology.com\nAddress: 1760 Wadsworth Road | Akron Ohio 44320\n\nContact Page: https://paintechnology.com/contact"
  },
  {
    "question": "Where can I find the Ultima 5 User Manual?",
    "answer": "You can download the official Ultima 5 User Manual here: [Ultima 5 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-5-User-Manual.pdf)\n\nAdditional tips: [Tips on using the Ultima 5 TENS device](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20the%20Ultima%205%20TENS%20device.doc)"
  },
  {
    "question": "Where can I download the Ultima 1 User Manual?",
    "answer": "You can view or download the Ultima 1 User Manual here: [Ultima 1 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-1-User-Manual.pdf)"
  },
  {
    "question": "Where can I download the Ultima 11 User Manual?",
    "answer": "You can view or download the Ultima 11 User Manual here: [Ultima 11 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-11-User-Manual.pdf)"
  },
  {
    "question": "Where can I download the Ultima 20 User Manual?",
    "answer": "You can view or download the Ultima 20 User Manual here: [Ultima 20 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-20-User-Manual.pdf)\n\nAdditional tips: [Tips on using a TENS device (Ultima 20)](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20a%20TENS%20device%20%28ultima%2020%29.doc)"
  },
  {
    "question": "Where can I find the Ultima Neo User Manual?",
    "answer": "You can access the Ultima Neo manuals here:\n- [Manual ULTIMA NEO Español](https://paintechnology.s3.amazonaws.com/pdf/Manual-ULTIMA-NEO-Espa%C3%B1ol.pdf)\n- [TENS IFC EMS MI Ultima Neo Guide](https://paintechnology.s3.amazonaws.com/pdf/TENS-IFC-EMS-MI-Ultima-Neo.pdf)"
  },
  {
    "question": "Where can I find instructions for Thermotech?",
    "answer": "You can view Thermotech user instructions here:\n- [Thermotech Analogue Instructions](https://paintechnology.s3.amazonaws.com/pdf/Thermotech-Users-Instructions-analogue.pdf)\n- [Thermotech Digital Instructions](https://paintechnology.s3.amazonaws.com/pdf/Thermotech-Users-instructions-digital.pdf)"
  },
  {
    "question": "Where can I find the Soft Cycle instructions?",
    "answer": "You can access Soft Cycle guides here:\n- [Soft Cycle Instructions](https://paintechnology.s3.amazonaws.com/pdf/soft-cycle.pdf)\n- [Soft Cycle Tri-Fold Sales Literature](https://paintechnology.s3.amazonaws.com/pdf/Softcycle-Tri-Fold.pdf)"
  },
  {
    "question": "Where can I find the TENS Electrode Placement Chart?",
    "answer": "You can download the official TENS Electrode Placement Chart here: [TENS Electrode Placement Chart](https://paintechnology.s3.amazonaws.com/pdf/placementchart.pdf)"
  },
  {
    "question": "How do I pair a Thermacycle remote control?",
    "answer": "You can view the step-by-step pairing instructions here: [Pairing method between remote control and unit](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Pairing%20method%20between%20remote%20control%20and%20unit.docx)"
  },
  {
    "question": "Where can I find PMT forms like ARS, JStim, or TENS CMN forms?",
    "answer": "You can download PMT forms here:\n- [ARS Form](https://paintechnology.s3.amazonaws.com/pdf/ARS-Tpump.pdf)\n- [JStim Form](https://paintechnology.s3.amazonaws.com/pdf/JStim-LMN.pdf)\n- [TENS CMN Form](https://paintechnology.s3.amazonaws.com/pdf/TENS-CMN.pdf)"
  },
  {
    "question": "Where can I find educational guides for microcurrent, Galvanic, or IF devices?",
    "answer": "You can access educational guides and troubleshooting documents here:\n- [Tips on using a Microcurrent Device](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20a%20micro%20current%20device.doc)\n- [Tips on using a Galvanic Device](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20a%20Galvanic%20device.doc)\n- [Tips on using an IF Device](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20a%20IF%20device.doc)\n- [Tips on using Russian Stim Device](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20Russian%20Stim%20device.doc)\n- [Tips on using Ucombo TENS EMS](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20Ucombo%20TENS%20EMS.doc)\n- [Electrotherapy Device Troubleshooting Guide](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Electrotherapy%20device%20TROUBLESHOOTING.docx)\n- [General TENS Info](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/general%20TENS%20info.docx)\n- [Microcurrent Cheatsheet v1.1](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Microcurrent-Cheatsheet-v1.1.pdf)"
  },
  {
    "question": "Where can I view PMT product catalog or product pages?",
    "answer": "You can browse the PMT Product Catalog and Resources page here:\n- [PMT Print Catalog](https://paintechnology.com/catalog)\n- [PMT Product Catalog PDF](https://s3.us-east-2.amazonaws.com/cdn.hmsctl.com/media/pmt/pdf/PMTCatalog_260410.pdf)\n- [PMT Resources Page](https://paintechnology.com/resources)\n- [PMT Contact Page](https://paintechnology.com/contact)"
  },
  {
    "question": "Where can I find video demonstrations for PMT devices?",
    "answer": "You can watch video demonstrations and guides on YouTube:\n- [Ultima 5 Video Guide](https://www.youtube.com/watch?v=Evm1mGxXUMU)\n- [Ultima 20 Video Guide](https://www.youtube.com/watch?v=fpvKQy4_GcI)\n- [Ultima 3T Video Guide](https://www.youtube.com/watch?v=jOzd3t6V3Wc)\n- [Ultima Neuro Video Guide](https://www.youtube.com/watch?v=s-UrvonrYZg)\n- [VA TENS Device Features Video](https://youtu.be/7Ofy4oNEjqA)\n- [Electrotherapy Principles Video](https://youtu.be/VL6lRHAT3fU)\n\nCheck out the full video library on the [PMT Resources Page](https://paintechnology.com/resources)."
  },
  {
    "question": "How does a TENS unit work?",
    "answer": "A Transcutaneous Electrical Nerve Stimulation (TENS) unit is a small, battery-powered device that helps relieve pain by sending low-voltage electrical pulses through electrode pads placed on the skin. These gentle electrical impulses stimulate the nerves beneath the skin and can help reduce the way your body perceives pain.\n\nUseful Resources & Links:\n📘 [Manual ULTIMA NEO Español](https://paintechnology.s3.amazonaws.com/pdf/Manual-ULTIMA-NEO-Espa%C3%B1ol.pdf)\n📄 [TENS IFC EMS MI Ultima Neo Guide](https://paintechnology.s3.amazonaws.com/pdf/TENS-IFC-EMS-MI-Ultima-Neo.pdf)\n🎥 [Ultima Neo Video Guide](https://youtu.be/8vhPXlfp3lc)"
  },
  {
    "question": "What does a TENS unit feel like?",
    "answer": "Most users describe the sensation as: a gentle tingling, a light buzzing, mild tapping or pulsing, or a comfortable vibration. The intensity should be strong, but comfortable. A TENS unit should never be painful. If you experience sharp, burning, or uncomfortable sensations, reduce the intensity or check that the electrode pads are properly positioned and making good contact with your skin.\n\nUseful Resources & Links:\n🛠️ [Electrotherapy Device Troubleshooting Guide](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Electrotherapy%20device%20TROUBLESHOOTING.docx)"
  },
  {
    "question": "What does a TENS unit actually do?",
    "answer": "A TENS unit helps relieve pain by sending gentle electrical pulses through electrode pads placed on the skin. These pulses stimulate the nerves, helping block pain signals before they reach the brain, while also encouraging the release of endorphins - your body's natural pain relievers. A TENS unit is designed to manage pain, not cure underlying conditions. It can provide temporary relief from discomfort caused by conditions such as back pain, arthritis, sciatica, muscle soreness, and joint pain, making it easier to stay active and complete everyday tasks."
  },
  {
    "question": "Does TENS help reduce inflammation?",
    "answer": "TENS is not designed to directly reduce inflammation. Its primary purpose is to help manage pain by interrupting pain signals and stimulating the body's natural pain-relief response."
  },
  {
    "question": "How long does it take to feel relief?",
    "answer": "Many users will experience relief within 5 to 15 minutes of starting a TENS session, while others may need several treatments before noticing consistent results. The amount of relief varies depending on the person, the type of pain, and the TENS setting being used. Some users will experience relief during treatment, while others may continue to feel the effects afterward."
  },
  {
    "question": "Can I use a TENS unit every day?",
    "answer": "Yes, many people can use a TENS unit daily for pain management. Treatment frequency depends on your specific needs, the type of pain you are experiencing, and the recommendations provided with your device. For the best results, follow the reommended session times and avoid using TENS on irritated skin or the same area for extended periods without breaks."
  },
  {
    "question": "How often should I use a TENS unit?",
    "answer": "The frequency of TENS use depends on your pain level, condition, and personal response. Many users use a TENS unit once or multiple times per day for short sessions, typically lasting 20-30 minutes. For best results, use your TENS unit as needed and follow the recommended settings and guidelines provided with your device."
  },
  {
    "question": "Where should I place the pads for lower back pain?",
    "answer": "For lower back pain, place the TENS pads on either side of the painful area, near the muscles surrounding the spine. Avoid placing pads directly over the spine or on bony areas. Common placements include: Two pads on each side of the lower back, above the hips or surrounding the area where you feel pain.\n\nUseful Resources & Links:\n📋 [TENS Electrode Placement Chart](https://paintechnology.s3.amazonaws.com/pdf/placementchart.pdf)"
  },
  {
    "question": "Where do I put the pads for neck pain?",
    "answer": "For neck pain, place the TENS pads on the muscles along the sides and back of the neck, near the area of discomfort. Avoid placing pads directly on the front or sides of the throat, the head, or over the spine. Common placements include: one pad on each side of the neck muscles, or putting the pads above and below the painful area along the upper shoulders and neck."
  },
  {
    "question": "Can I place the pads directly over where the pain is?",
    "answer": "Yes. Tens PADS can often be placed near or around the area of pain to help target discomfort. However, avoid placing pads directly over the areas where they are not recommended, such as the front of the neck, head, open wounds, irritated skin, or directly over bony areas. For the best results, try placing the pads around the painful area rather than directly on the most sensitive spot.\n\nUseful Resources & Links:\n📋 [TENS Electrode Placement Chart](https://paintechnology.s3.amazonaws.com/pdf/placementchart.pdf)"
  },
  {
    "question": "Can the pads touch each other?",
    "answer": "No. TENS pads should not touch each other during use. Keep the pads separated to allow the electrical stimulation to flow properly through the targeted area. For the best results, place pads a few inches apart and avoid overlapping or placing them directly on top of one another."
  },
  {
    "question": "How far apart should the pads be?",
    "answer": "TENS pads should generally be placed about 1-3 inches apart, depending on the treatment area and the size of the pads. The pads should be close enough to target the area of discomfort but far enough apart to allow the electrical stimulation to travel effectively. For larger areas of pain, such as the lower back or shoulder, pads may be placed farther apart to cover more space."
  },
  {
    "question": "Can I use more than one channel at a time?",
    "answer": "Yes, if your TENS unit has multiple channels, you can typically use more than one channel at the time. This allows you to treat multiple areas of discomfort or use additional electrode pads for a larger treatment area. For example, one channel can be used on the lower back while another targets the hip or leg area. Always follow your device instructions and keep the intensity at a comfortable level."
  },
  {
    "question": "Which mode should I use?",
    "answer": "The best TENS mode depends on your type of pain and personal comfort level. Most users start with a normal or continuous mode and adjust based on how their body responds. Common modes include Normal/Continuous Mode: Provides a steady stimulation is commonly used for general pain relief and everyday discomfort. Burst Mode: Delivers pulses in groups and may be helpful for stronger or more persistent pain. Modulation Mode: Automatically varies the stimulation pattern to help prevent your body from getting used to the sensation."
  },
  {
    "question": "What frequency is best for chronic pain?",
    "answer": "For chronic pain, many TENS users find relief within lower frequencies (around 1-10 Hz), which may encourage the release of natural pain-relieving chemicals like endorphins. Some users also benefit from higher frequencies (around 50-120Hz), which may help block pain signals and provide more immediate relief."
  },
  {
    "question": "What frequency works best for acute pain?",
    "answer": "For acute pain (new or short-term pain from an injury, procedure, or strain), many users find higher frequencies around 50-120 Hz helpful. These settings may provide faster relief by helping interrupt pain signals traveling to the brain. Lower frequencies may also be used depending on the type of pain and individual response."
  },
  {
    "question": "How high should I turn up the intensity?",
    "answer": "Set the intensity to a level that feels strong but comfortable. You should feel a noticeable tingling, pulsing, or buzzing sensation, but it should never be painful or cause discomfort. Start at a low setting and gradually increase the intensity until you feel a strong sensation without muscle strain, sharpness, or irritation."
  },
  {
    "question": "Should the stimulation feel strong or gentle?",
    "answer": "TENS stimulation should feel strong but comfortable. You should notice a clear tingling, buzzing, or pulsing sensation without pain, burning, or excessive muscle discomfort. The goal is to provide enough stimulation to be effective while keeping the treatment comfortable throughout the session.\n\nUseful Resources & Links:\n🛠️ [Electrotherapy Device Troubleshooting Guide](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Electrotherapy%20device%20TROUBLESHOOTING.docx)"
  },
  {
    "question": "Why does the sensation fade after a few minutes?",
    "answer": "It is common for the TENS sensation to feel less noticeable after a few minutes. This happens because your nerves can adapt to the stimulation, making the sensation feel weaker over time. If this happens, you can try slightly increasing the intensity, adjusting the pad placement, or using a modulation mode (if available) to vary the stimulation pattern.\n\nUseful Resources & Links:\n📋 [TENS Electrode Placement Chart](https://paintechnology.s3.amazonaws.com/pdf/placementchart.pdf)\n🛠️ [Electrotherapy Device Troubleshooting Guide](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Electrotherapy%20device%20TROUBLESHOOTING.docx)"
  },
  {
    "question": "What pain conditions does TENS help with?",
    "answer": "TENS can help with multiple conditions such as Sciatica, Plantar Fasciitis, Arthritis, Knee Pain, Shoulder Pain, Neck Pain, Tennis Elbow, Carpal Tunnel, Fibromyalgia, Neuropathy, Muscle Spasms, Menstrual Cramps, and Post-Surgical Pain.\n\nUseful Resources & Links:\n📄 [Microcurrent Cheatsheet v1.1](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Microcurrent-Cheatsheet-v1.1.pdf)\n📄 [Tips on using Microcurrent](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20a%20micro%20current%20device.doc)"
  },
  {
    "question": "Is it safe to use a TENS unit while sleeping?",
    "answer": "It is generally not recommended to use a TENS unit while sleeping unless specifically instructed by a healthcare professional. While TENS is considered safe for many people, you may not notice skin irritation, discomfort, or changes in sensation while sleeping. For best results, use your TENS unit while you are awake and able to monitor the stimulation level and skin condition."
  },
  {
    "question": "Can I wear a TENS unit all day?",
    "answer": "It is generally not recommended to wear a TENS unit continuously all day without breaks. While TENS can often be used multiple times throughout the day, extended use may increase the risk of skin irritation, reduced effectiveness, or discomfort. For best results: Use TENS in scheduled sessions as needed. Give your skin breaks between treatments. Move electrode placement if using the same area frequently. Follow your device's recommended usage guidelines."
  },
  {
    "question": "Can I use TENS with a pacemaker?",
    "answer": "If you have a pacemaker or implanted electronic device, you should consult your healthcare provider before using a TENS unit. Electrical stimulation may potentially interfere with some implanted devices."
  },
  {
    "question": "Is a TENS unit safe to use during pregnancy?",
    "answer": "TENS may be used during pregnancy in some cases, but it is best to consult with your healthcare provider before use. Many providers recommend avoiding certain areas, especially the abdomen, lower back, pelvis, and acupuncture points that may stimulate contractions. When approved by a healthcare professional, TENS is sometimes used during pregnancy for issues such as back discomfort or labor related pain."
  },
  {
    "question": "Can I use a TENS unit if I have diabetes?",
    "answer": "Many people with diabetes can use a TENS unit, but it is important to check with your healthcare provider first, especially if you have diabetic neuropathy or reduced sensation. If you have decreased feeling in an area, you may not notice skin irritation or discomfort from the stimulation. Always check your skin before and after use and avoid placing pads over damaged skin, sores, or areas with poor circulation."
  },
  {
    "question": "Can I use a TENS unit if I have metal implants?",
    "answer": "In many cases, yes, TENS can be used with metal implants, such as joint replacements or surgical hardware. The electrical stimulation from a TENS unit typically does not affect non-electronic metal implants. However, you should check with your healthcare provider before use, especially if the implant is near the treatment area or if you have any type of electronic implant (such as a pacemaker, defibrillator, or nerve stimulator)."
  },
  {
    "question": "Where should I never place TENS pads?",
    "answer": "TENS pads should never be placed on certain areas where stimulation could be unsafe, including: front or sides of neck (near the throat or carotid arteries). Across the chest or directly over the heart. On the head, face, or near the eyes. Inside the mouth or on broken skin. Over open wounds, sores, infections, or irritated skin. Directly over the spine or major bony areas. Across the abdomen or lower back during pregnancy UNLESS approved by a healthcare provider. Near implanted electronic devices (such as pacemakers or defibrillators)."
  },
  {
    "question": "Can I drive while using a TENS unit?",
    "answer": "It is not recommended to drive or operate heavy machinery while using a TENS unit. The stimulation can be distracting, and changes in intensity or muscle responses may affect your ability to drive safely. For your safety, use your TENS unit before or after driving rather than while operating a vehicle."
  },
  {
    "question": "How long do TENS pads last?",
    "answer": "TENS electrodes typically last 10-30 uses,depending on the quality of the pads, how often they are used, skin condition, and how well they are cared for. To help extend the lifespan of an electrode: Apply pads to clean, dry skin. Store them properly on the provided backing sheet. Avoid using lotions or oils before application. Replace pads when they lose stickiness or stimulation becomes uneven."
  },
  {
    "question": "Why won't my pads stick anymore?",
    "answer": "TENS pads can lose their stickiness over time due to repeated use, moisture, oils, lotions, dirt, or improper storage. As the gel dries out or the pads are used, the pads may not make proper contact with the skin, which will reduce stimulation quality. Once you are noticing that your pads are sticking less, or are starting to fall off the skin, it is recommended to swap out your pads for new. To improve pad life: Clean and dry your skin before applying pads. Avoid using lotions, oils, or creams before treatment. Store pads on their backing sheet in a sealed bag or container. Replace pads when the gel becomes dry, dirty, or no longer adheres well."
  },
  {
    "question": "How do I make my pads sticky again?",
    "answer": "TENS pads cannot usually be made fully sticky again, as once the conductive gel has dried out, it is not recommended to try and make them sticky again. This can cause burns or rash due to the gel drying out. Once pads have started to lose their adhesive, it is recommended to swap out with new electrodes for proper use and safety purposes."
  },
  {
    "question": "Can I wash or clean electrode pads?",
    "answer": "No, TENS electrode pads should not be washed or soaked in water. Cleaning them can damage the conductive gel and reduce their ability to stick and deliver consistent stimulation."
  },
  {
    "question": "Are generic pads compatible with my unit?",
    "answer": "In most cases, yes, generic TENS pads are compatible as long as they use the same standard pin size for connection and are designed for TENS/EMS devices. Before purchasing, check the following: The connector type (most use a standard 2mm pin or snap connection). The pad size and shape are the correct size for your treatment area. The manufacturer's recommendations for your specific device. Higher-quality electrodes often provide better adhesion, comfort, and consistent stimulation compared to lower-quality alternatives."
  },
  {
    "question": "What pads are compatible with my unit?",
    "answer": "Most TENS units work with standard snap-style electrode pads, but compatibility depends on your device's connector type. Most units follow a standard 2mm pin or snap connector size for electrodes. Before purchasing, check the following: The connector style on your TENS unit. The recommended pad size from your device manufacturer. Whether the pads are labeled for TENS use (not just other stimulation devices)."
  },
  {
    "question": "What's the difference between 2 inch and 4 inch pads?",
    "answer": "The main difference is coverage area. Larger pads spread stimulation over a wider area, while smaller pads provide more targeted treatment. 2 Inch Pads: Best for smaller or more precise areas like the wrist, ankle, neck muscles, or smaller joints. 4 Inch Pads: Better for larger muscle groups, like the lower back, shoulders, thighs, or areas with broader discomfort. Larger pads may also feel more comfortable because the stimulation is distributed across a bigger surface area."
  },
  {
    "question": "How do I know which pads are best for me?",
    "answer": "The best TENS pads depend on where you are treating, the size of the area, and your comfort preference. Consider: Small pads: Best for targeted areas like wrists, ankles, elbows, or smaller joints. Large pads: Best for larger areas like the lower back, shoulders, hips or thighs. Longer Lasting Pads: Better for frequent users who need more repeated sessions. Flexible Pads: Helpful for areas that move often, like knees, shoulders, or joints. For the best results, choose pads that provide good skin contact,comfortable stimulation, and proper coverage for your treatment area."
  },
  {
    "question": "Why isn't my TENS unit producing sensation?",
    "answer": "If you don't feel any simulation from your TENS unit, check these common causes; Intensity is too low: Gradually increase the intensity until you feel a comfortable tingling or pulsing sensation. Pads are not making good contact: Make sure pads are fully attached to clean, dry skin. Electrodes are worn out: Old or dry pads may not transfer stimulation properly. Pad placement needs adjustment: Try moving the pads closer to the area of treatment or adjusting their postion. Cable or connection issue: Make sure the leads are securely connected to both the unit and the pads. Low Battery: Replace or recharge the battery if the device is not powering correctly.\n\nUseful Resources & Links:\n📋 [TENS Electrode Placement Chart](https://paintechnology.s3.amazonaws.com/pdf/placementchart.pdf)"
  },
  {
    "question": "Why is only one pad working?",
    "answer": "If only one pad seems to be producing a sensation, the issue is usually related to pad contact, connections, or the electrode itself. Try these steps: Check the pad connection: Make sure both lead wires are firmly connected to the TENS unit and electrode pads. Test the pads: Swap the pads or cables to see if the issue follows the pad or the channel. Replace the pad: A worn or dried-out electrode may not conduct properly. Improve the skin contact: Clean and dry the skin, then reapply the pads firmly. Check the channel settings: Make sure both channels are turned on if your unit has multiple channels."
  },
  {
    "question": "Why does the stimulation feel sharp instead of comfortable?",
    "answer": "TENS stimulation should feel like a comfortable tingling, pulsing, or buzzing sensation - not shart or painful. A sharp sensation usually means the stimulation is too intense or the pads are not making proper contact. Try: Lowering the intensity until the sensation becomes comfortable. Checking pad placement and moving pads away from bony areas or sensitive spots. Replacing old pads that may have dried out or lost even contact. Cleaning and drying your skin before applying electrodes.\n\nUseful Resources & Links:\n📋 [TENS Electrode Placement Chart](https://paintechnology.s3.amazonaws.com/pdf/placementchart.pdf)"
  },
  {
    "question": "Why does my skin turn red after treatment?",
    "answer": "Mild redness after using a TENS unit can be normal and is often caused by increased circulation, pressure from the electrode, or mild skin sensitivity. It should typically fade shortly after removing the pads. To reduce skin irritation: Make sure your skin is clean and dry before use. Avoid placing pads on irritated or damaged skin. Rotate pad placement between treatments. Reduce treatment intensity if the sensation feels uncomfortable. Replace electrodes when the gel becomes old or irritating.\n\nUseful Resources & Links:\n📋 [TENS Electrode Placement Chart](https://paintechnology.s3.amazonaws.com/pdf/placementchart.pdf)"
  },
  {
    "question": "Why does my unit keep turning off?",
    "answer": "If your TENS unit keeps shutting off, it is usually caused by a power, connection, or safety feature issue. Common issues include: Low battery: Replace or recharge the batteries to ensure the unit has enough power. Automatic Shutoff Timer: Many TENS units turn off automatically after a set treatment time. Loose connections: Check that the lead wires are fully connected to the unit and electrode pads. Poor pad contact: If the pads lose contact with the skin, some units may pause or stop stimulation. Damaged cables or electrodes: Worn pads or faulty wires can interrupt the connection. Intensity set too high: Some devices may stop if they detect an issue with the electrical connection."
  },
  {
    "question": "Why does the intensity suddenly decrease?",
    "answer": "A sudden drop in intensity is usually caused by changes in pad contact, skin resistance, or the unit's built-in adjustments. Common causes include: Your body adapting to the stimulation: Nerve can become less sensitive to the sensation over time. Pads losting contact: Sweat, movement, or worn adhesive can reduce conductivity. Automatic modulation: Some TENS modes adjust the stimulation level or pattern to keep the sensation comfortable. Low battery: Reduced power can affect stimulation strength. Loose connections: Check that the lead wires and pads are securely attached."
  },
  {
    "question": "How long does the battery last?",
    "answer": "Battery life depends on the type of battery, intensity setting, and how often you use your TENS unit. Rechargable batteries: Typically provide 8-20 hours per charge. Disposable batteries: Can often last 20-50 hours of treatment, depending on the device and settings. Higher intensity levels and longer treatment sessions may shorten battery life."
  },
  {
    "question": "Should I buy a rechargable batteries?",
    "answer": "If your TENS unit is compatible, rechargable batteries are a great option for frequent users. They can save money over time, reduce waste, and provide consistent performance. Disposable batteries may be a better choice if you use your TENS unit only on occasion or need a quick replacement while traveling."
  },
  {
    "question": "What's the difference between TENS and EMS?",
    "answer": "Although they both use electrical stimulation, TENS and EMS are designed for different purposes. TENS: Primarily used to help relieve pain by stimulating the nerves and reducing pain signals. EMS: Designed to stimulate muscles, helping with muscle strengthening, recovery, re-education, and reducing muscle atrophy. Some devices combine both TENS and EMS modes, allowing you to switch between pain relief and muscle stimulation."
  },
  {
    "question": "Can one device do both TENS and EMS?",
    "answer": "Yes. Many modern electrotherapy devices combine both TENS and EMS in a single unit, allowing you to switch between pain relief and muscle stimulation. If you device includes both functions, you can select the mode that best fits your treatment goals."
  },
  {
    "question": "Does TENS actually work?",
    "answer": "Yes. TENS has been proven to help relieve pain for many people, although results can vary depending on the individual and the condition being treated. It works by stimulating the nerves, which may help reduce pain signals and encourage the relese of the body's natural pain-relieving chemicals. For best results, use the TENS unit as directed with proper pad placement and comfortable intensity settings.\n\nUseful Resources & Links:\n📋 [TENS Electrode Placement Chart](https://paintechnology.s3.amazonaws.com/pdf/placementchart.pdf)"
  },
  {
    "question": "Is pain relief immediate or temporary?",
    "answer": "TENS relief can be immediate for some users, while others may need several sessions to notice improvement. The effects are often temporary, lasting anywhere from minutes to several hours after treatment. Some people experience longer-lasting benefits when TENS is used consistently as part of a broader pain management routine."
  },
  {
    "question": "Will my body get used to TENS?",
    "answer": "Yes, your body can adapt to TENS stimulation over time, which may make the sensation feel less noticeable. This a normal response called habituation. To help maintain effectiveness: Increase the intensity slightly as needed (while keeping it comfortable), Adjust pad placement between sessions, Use different modes or settings if your device offers them, Avoid using the same exact settings every time.\n\nUseful Resources & Links:\n📋 [TENS Electrode Placement Chart](https://paintechnology.s3.amazonaws.com/pdf/placementchart.pdf)"
  },
  {
    "question": "Can TENS help me avoid pain medication?",
    "answer": "TENS may help some people reduce their reliance on pain medication by providing a drug-free option for managing discomfort. However, it does not replace prescribed medications for everyone or treat the underlying cause of pain. Many people use TENS as part of a broader pain management plan alongside other treatments recommended by their healthcare provider."
  },
  {
    "question": "Can TENS speed up healing or does it only mask pain?",
    "answer": "TENS is primarily used for pain relief, not to directly heal injuries. It helps by changing how pain signals are processed by the nervous system, which can make discomfort more manageable. By reducing pain, TENS may help some people move more comfortable, particupate in physical therapy, and stay active, which can support the overall recovery process. However, it does not repair damaged tissue or speed up healing on its own."
  },
  {
    "question": "What TENS unit is best for home use?",
    "answer": "The best TENS unit for home use depends on your needs, but a good home unit should have: Adjustable intensity levels, multiple modes, dual channels, rechargable batteries, easy controls and a clear display. For most home users, a reliable dual channel TENS unit with adjustable programs is a good choice because it offers flexibility for areas like the back, neck, shoulders, knees, and joints."
  },
  {
    "question": "Is a prescription required?",
    "answer": "No, most TENS units do not require a prescription and are available for purchase without one. Many people use TENS at home as a drug-free option for managing pain. However, it is recommended to consult a healthcare provider before use if you have certain conditions, such as an implanted electronic device (like a pacemaker), pregnancy, epilepsy, or significant loss of sensation."
  },
  {
    "question": "What accessories should I buy with a TENS unit?",
    "answer": "The most useful accessories depend on how often you use your TENS unit, but these are the most common add-ons: Extra electrode pads, Different Pad Sizes, Replacement Lead Wires, Carrying Case, Rechargable batteries or charging cable, Electrode storage bag or container."
  },
  {
    "question": "What program should I use for my condition?",
    "answer": "The best TENS program depends on your type of pain, where it is located, and how your body responds to stimulation. There is no single setting that works best for everyone. Start with a comfortable setting and adjust based on how your body responds."
  },
  {
    "question": "How many minutes should I do per session?",
    "answer": "Most TENS sessions typically last 15-60 minutes, depending on your comfort level, the device settings, and your specific needs. General guidelines: Start with 15-30 minutes to see how your body responds. Common session lengths: 30-60 minutes. Repeat Sessions: Many people use TENS multiple times throughout the day if needed, allowing breaks between treatments. Avoid using TENS for extended periods without breaks, and always follow your device's instructions."
  },
  {
    "question": "Can I use TENS more than once a day?",
    "answer": "Yes, many people use a TENS unit more than once per day if needed. Multiple short sessions may be more comfortable and effective than using it continuously for long periods. Important notes: Allow your skin to rest between sessions. Avoid placing pads on the exact same spot for too many hours. Adjust intensity if the sensation becomes uncomfortable. Follow your device's recommended usage guidelines."
  },
  {
    "question": "When should I replace the pads?",
    "answer": "Replace your TENS pads when they no longer provide good skin contact or consistent stimulation. Signs it's time for new pads: They stop sticking well to your skin. The edges begin to lift or curl. Stimulation feels uneven, weak, or uncomfortable. The gel looks dry, dirty, or damaged. Skin irritation occurs after use. With proper care, reusable electrode pads typically last 10-30 uses, but lifespan varies based on skin type, storage, and frequency of use.\n\nUseful Resources & Links:\n📋 [TENS Electrode Placement Chart](https://paintechnology.s3.amazonaws.com/pdf/placementchart.pdf)"
  },
  {
    "question": "How do I clean and store the unit?",
    "answer": "Proper cleaning and storage can help extend the life of your TENS unit, cables, and electrode pads. To clean your unit: Turn the device off. Wipe the unit and cables with a soft, dry, or slightly damp cloth. Avoid getting water or cleaning liquids inside the device. Do not submerge the unit or rinse it with water. To store the unit: Remove electrodes from your skin gently after use. Return pads to their original backing sheet. Store pads in a sealed bag or container to prevent drying out. Keep the unit in a cool, dry place away from heat direct sunlight. Store cables neatly to prevent bending or damage."
  },
  {
    "question": "How do I maximize pain relief?",
    "answer": "To get the best results from your TENS unit, focus on proper placement, comfortable settings, and consistent use. Tips to maximize relief: Place pads correctly: Position electrodes around the painful area or along the related nerve pathways as recommended. Use a comfortable intensity: The sensation should feel strong but comfortable - not painful or irritating. Adjust settings: Try different modes, pulse rates, and durations to find what works best for you. Use fresh electrodes - Good pad contact helps deliver consistent stimulation. Keep skin clean and dry: Remove oils, lotions, and sweat before applying pads. Use consistently: Regular sessions may provide better results than occasional use."
  },
  {
    "question": "What are the theories behind how TENS units work?",
    "answer": "There are two leading theories that explain why TENS provides relief, and understanding them can help you get more out of your device. The first is the Gate Control Theory of Pain. It suggests that the electrical pulses from your TENS unit travel along nerve fibers faster than pain signals do, effectively closing a \"gate\" in your spinal cord so fewer pain signals reach your brain. This is generally associated with higher frequency settings and tends to provide faster, more immediate relief. The second is the Endorphin Release Theory, which suggests that certain settings, typically lower frequencies, encourage your body to release endorphins, its own natural pain-relieving chemicals. This effect tends to build more gradually and can last longer after your session ends. Many people find that combining both approaches, or simply experimenting with frequency over a few sessions, helps them find what works best for their body."
  },
  {
    "question": "How should I approach electrode placement?",
    "answer": "Proper electrode placement can make a big difference in how comfortable and effective your TENS treatment feels. The goal is to place pads where they can best influence the area of discomfort. Helpful Guidelines: Place pads around the painful area: Position electrodes on either side of the pain or along the surrounding muscles. Avoid placing pads directly over irritated or damaged skin. Keep pads evenly spaced: Proper spacing helps create a consistent stimulation pathway. Use both channels when available: This allows you to treat larger areas or multiple areas at the same time. Adjust placement if needed: Small changes in the pad location can improve comfort and sensation. Follow your device's instructions: Some conditions may have recommended placement patterns."
  },
  {
    "question": "Is there contradictions with medication?",
    "answer": "TENS generally does not interact with most medications because it works through electrical stimulation rather than through the bloodstream. However, your health condition and medications may still be important to discuss with a healthcare provider. Use caution and seek medical guidance if you: Take medications that affect sensation, nerve function, or heart rhythm. Have reduced ability to feel stimulation. Use medications that increase skin sensitivity or irritation risk. TENS should also be used carefully with certain medical conditions, such as: Implanted electronic devices (like pacemakers or defibrillators), Pregnancy, Epilepsy, Seizure Disorders, Areas with reduced sensation or damaged skin."
  },
  {
    "question": "Why am I not feeling sensation?",
    "answer": "If you are not feeling any stimulation, the issue is usually related to settings, connections, or electrode contact. Try these steps: increase the intensity slowly: The setting may simply be too low to feel. Check electrode placement: Move the pads slightly closer together or reposition them around the treatment area. Make sure pads are fully attached; Poor contact can prevent stimulation from being felt. Clean and dry your skin: Oils, lotions, or sweat can interfere with conductivity. Replace old electrode pads: Dry or worn pads may not transfer stimulation properly. Check cables and connections: Ensure lead wires are securely connected to the unit and pads. Confirm the correct mode/channel is active: Some programs have different sensation levels."
  },
  {
    "question": "Why does the stimulation seem weak?",
    "answer": "If your TENS unit feels weaker than usual, it is often caused by pad contact, settings, or power issues. Common causes include: Intensity is set too low: Gradually increase the intensity to a strong but comfortable level. Electrode pads are worn: Older pads may lose conductivity and reduce stimulation strength. Poor skin contact: Clean and dry your skin, then firmly apply the pads. Loose connections: Check that lead wires are securely attached to both the unit and pads. Low battery: Replace or recharge the battery if the device is losing power. Your body has adapted: Over time, you may notice the sensation less as your nerves become accustomed to the stimulation."
  },
  {
    "question": "Stimulation feels sharp or uncomfortable",
    "answer": "TENS stimulation should feel like a comfortable tingling, pulsing, or buzzing sensation - not sharp or painful. A sharp sensation usually means the stimulation is too intense or the pads are not making proper contact. Try: Lowering the intensity until the sensation becomes comfortable. Checking pad placement and moving pads away from bony areas or sensitive spots. Replacing old pads that may have dried out or lost even contact. Cleaning and drying your skin before applying electrodes.\n\nUseful Resources & Links:\n📋 [TENS Electrode Placement Chart](https://paintechnology.s3.amazonaws.com/pdf/placementchart.pdf)"
  },
  {
    "question": "Why does intensity drop during use?",
    "answer": "A decrease in intensity during a session is usually caused by your body adapting to the stimulation, changes in skin contact, or device settings. Common causes include: Your body is adjusting to the sensation: It is normal to notice the stimulation less over time as your nerves become accustomed to it. Pads are losing contact: Movement, sweat, or drying electrodes can reduce conductivity. Automatic adjustment features: Some TENS programs change the stimulation pattern or strength to keep treatment comfortable. Low battery: Reduce power can affect stimulation strength. Loose connections: Check that the lead wires are securely attached."
  },
  {
    "question": "Why won't my TENS unit turn on?",
    "answer": "If your TENS unit will not power on, the issue is usually related to the battery, charging, or a connection problem. Try these steps: Check the battery: Replace disposable batteries or fully charge the device if it is rechargable. Confirm proper battery placement: Make sure batteries are inserted correctly and making contact. Try a different charger or cable: If rechargable, check that the charging cable and power source are working. Hold the power button: Some units require pressing and holding the button for a few seconds. Check for damage: Look for cracks, loose parts, or signs of moisture exposure. Disconnect accessories: Remove lead wires and pads, then try turning the unit on again. Review the user manual: Some devices have specific startup steps or safety locks."
  },
  {
    "question": "I am experiencing skin irritation -- why is that?",
    "answer": "Skin irriation after using a TENS unit is usually caused by skin sensitivity, electrode adhesive, or improper pad use. Common causes include: Sensitivity to the electrode gel or adhesive: Some people may have mild skin reactions to the materials in the pads. Using pads for too long: Extended use in the same area can irritate the skin. Worn or dirty electrodes: Old pads may not distribute stimulation evenly and can increase irritation. Applying pads to unprepared skin: Lotions, oils, sweat, or dirt can affect adhesion and skin comfort. Stimulation intensity is too high: Excessive intensity may cause discomfort or irritation. To reduce irritation: Apply pads to clean, dry skin. Rotate pad placement between sessions. Avoid using pads on irritated, broken, or sensitive skin. Lower the intensity if the sensation feels uncomfortable. Replace pads when they become dry or worn.\n\nUseful Resources & Links:\n📋 [TENS Electrode Placement Chart](https://paintechnology.s3.amazonaws.com/pdf/placementchart.pdf)"
  },
  {
    "question": "How do I use a TENS unit, step by step?",
    "answer": "Start with clean, dry skin. Connect the lead wires to the pads, then plug them into the unit. Place the pads around the painful area, a few inches apart. Turn on the device, choose a mode, and slowly raise intensity until you feel a strong but comfortable tingling. Run the session 15-60 minutes, then power down and store the pads on their backing.\n\nUseful Resources & Links:\n📋 [TENS Electrode Placement Chart](https://paintechnology.s3.amazonaws.com/pdf/placementchart.pdf)"
  },
  {
    "question": "What are typical troubleshooting issues with TENS units?",
    "answer": "Most issues come down to power, connections, pad contact, or settings. No sensation? Check the lead wires are seated and pads are on clean skin with intensity turned up. Weak or uneven feel? Replace worn electrodes. Unexpected shutoff? Usually the timer, low battery, or a safety response to poor contact. Your Ultima 5's Pad Contact Alarm flashes \"CH1\"/\"CH2\" if a connection starts failing.\n\nUseful Resources & Links:\n📘 [Ultima 5 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-5-User-Manual.pdf)\n🎥 [Ultima 5 Video Guide](https://www.youtube.com/watch?v=Evm1mGxXUMU)\n📄 [Tips on using Ultima 5 TENS](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20the%20Ultima%205%20TENS%20device.doc)"
  },
  {
    "question": "What is the Ultima 5 (U5)?",
    "answer": "The Ultima 5 is PMT's dual-channel digital TENS unit, built for robust relief at home, work, or on the go. It offers 10 intensity levels, 9 preset modes (27 combinations), 3 wave forms, and a timer up to 60 minutes. A built-in Compliance Monitor and Pad Contact Alarm add extra confidence.\n\nUseful Resources & Links:\n📘 [Ultima 5 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-5-User-Manual.pdf)\n🎥 [Ultima 5 Video Guide](https://www.youtube.com/watch?v=Evm1mGxXUMU)\n📄 [Tips on using Ultima 5 TENS](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20the%20Ultima%205%20TENS%20device.doc)"
  },
  {
    "question": "What comes in my Ultima 5 kit?",
    "answer": "Your kit includes the TENS device, manual, Quick Start Guide, one pack of 2\" square electrodes, an AA charger, two pairs of leadwires, two rechargeable Li-ion batteries, a soft carrying case, and an instruction card, everything you need for your first session.\n\nUseful Resources & Links:\n📘 [Ultima 5 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-5-User-Manual.pdf)\n🎥 [Ultima 5 Video Guide](https://www.youtube.com/watch?v=Evm1mGxXUMU)\n📄 [Tips on using Ultima 5 TENS](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20the%20Ultima%205%20TENS%20device.doc)"
  },
  {
    "question": "What's different between the current Ultima 5 and the earlier model?",
    "answer": "Core performance is unchanged: dual channel, up to 130 mA, the same pulse width and rate range, 3 wave forms, and 9 modes. What's improved: more timer options (15-90 minutes plus continuous), a compliance lock feature, an upgraded carrying case, a manual with an electrode placement chart, and five color options instead of one.\n\nUseful Resources & Links:\n📘 [Ultima 5 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-5-User-Manual.pdf)\n🎥 [Ultima 5 Video Guide](https://www.youtube.com/watch?v=Evm1mGxXUMU)\n📄 [Tips on using Ultima 5 TENS](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20the%20Ultima%205%20TENS%20device.doc)"
  },
  {
    "question": "What are Soft-Touch electrodes, and why do they matter?",
    "answer": "Soft-Touch electrodes are PMT's premium reusable line: a non-porous tricot backing, conductive wire-mount layer, high-quality carbon layer, and extra-thick gel, with a snug pigtail connector. Oval corners minimize edge curl, and every pad uses latex-free USA gel in a resealable bag to stay fresh. They work well across TENS, EMS, interferential, microcurrent, and galvanic devices.\n\nUseful Resources & Links:\n📄 [Microcurrent Cheatsheet v1.1](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Microcurrent-Cheatsheet-v1.1.pdf)\n📄 [Tips on using Microcurrent](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20a%20micro%20current%20device.doc)\n📄 [Tips on using Galvanic Device](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20a%20Galvanic%20device.doc)"
  },
  {
    "question": "What's the difference between the Soft-Touch Silver and Clinical Grade electrode lines?",
    "answer": "Both are premium reusable electrodes. The Silver series (SPS) uses a silver backing with ultra-low impedance and a gentle blue gel, great for sensitive skin, in sizes from 1.25\" round up to 3\" round. The Clinical Grade series (SP) uses a carbon backing with low-impedance blue gel and the widest size range, from a 1\" round up to a 3.3\"x6\" butterfly pad."
  },
  {
    "question": "What does the Pad Contact Interruption Alarm do on my Ultima 5?",
    "answer": "It watches your connection for you. If contact weakens, \"CH1\" and/or \"CH2\" flashes on the display. After 3 seconds of poor contact, intensity automatically drops to 60%. If contact returns within 30 seconds, it climbs back to your original setting; if not, intensity resets to zero. It's off by default, hold \"PR+\" and \"MODE\" together to turn it on.\n\nUseful Resources & Links:\n📘 [Ultima 5 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-5-User-Manual.pdf)\n🎥 [Ultima 5 Video Guide](https://www.youtube.com/watch?v=Evm1mGxXUMU)\n📄 [Tips on using Ultima 5 TENS](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20the%20Ultima%205%20TENS%20device.doc)"
  },
  {
    "question": "What does the Compliance Monitor track, and why does it matter?",
    "answer": "It keeps a running total of your usage time, a simple way to track how consistently you're following your treatment plan. Press and hold the timer button to view your total; it clears from the display after about 2 seconds. To reset the count to zero, hold MODE and TIMER together."
  },
  {
    "question": "What wave forms does the Ultima 5 offer, and which one should I use?",
    "answer": "You get three: asymmetrical, symmetrical, and monophasic. Switch between them by pressing \"PR-\" and \"PW-\" together. For your first session, start with asymmetrical bi-phasic rectangular, the most comfortable default for most people. From there, try symmetrical for a more even feel during longer sessions, or monophasic for smaller, more sensitive areas.\n\nUseful Resources & Links:\n📘 [Ultima 5 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-5-User-Manual.pdf)\n🎥 [Ultima 5 Video Guide](https://www.youtube.com/watch?v=Evm1mGxXUMU)\n📄 [Tips on using Ultima 5 TENS](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20the%20Ultima%205%20TENS%20device.doc)"
  },
  {
    "question": "How do I turn my Ultima 5 on and off?",
    "answer": "Press and hold the power button for about 3 seconds to turn your Ultima 5 on. You'll see the green LED light up along with the display, and intensity always starts at zero so you can ease in comfortably. To power down, press and hold the same button again for 3 seconds.\n\nUseful Resources & Links:\n📘 [Ultima 5 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-5-User-Manual.pdf)\n🎥 [Ultima 5 Video Guide](https://www.youtube.com/watch?v=Evm1mGxXUMU)\n📄 [Tips on using Ultima 5 TENS](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20the%20Ultima%205%20TENS%20device.doc)"
  },
  {
    "question": "Why does the intensity reset to zero when I switch modes?",
    "answer": "This is expected behavior, not a malfunction. Any time you change modes on your Ultima 5, the intensity automatically drops back to zero as a safety measure, so you don't accidentally jump into a new mode at a high setting. Just turn the intensity knob back up to a comfortable level once you've selected your mode.\n\nUseful Resources & Links:\n📘 [Ultima 5 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-5-User-Manual.pdf)\n🎥 [Ultima 5 Video Guide](https://www.youtube.com/watch?v=Evm1mGxXUMU)\n📄 [Tips on using Ultima 5 TENS](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20the%20Ultima%205%20TENS%20device.doc)"
  },
  {
    "question": "Does my Ultima 5 remember my last settings when I turn it back on?",
    "answer": "Yes. When you power your Ultima 5 back on, it automatically returns to the mode it was running in before you turned it off, so you don't have to reconfigure everything each time. Intensity will still start at zero, as it does on every power-up.\n\nUseful Resources & Links:\n📘 [Ultima 5 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-5-User-Manual.pdf)\n🎥 [Ultima 5 Video Guide](https://www.youtube.com/watch?v=Evm1mGxXUMU)\n📄 [Tips on using Ultima 5 TENS](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20the%20Ultima%205%20TENS%20device.doc)"
  },
  {
    "question": "What is the auto-repeat feature when adjusting pulse rate or pulse width?",
    "answer": "Once you make your first adjustment to pulse rate or pulse width, an auto-repeat function kicks in. If you press and hold the \"PR+\", \"PR-\", \"PW+\", or \"PW-\" key for about 1 second, the value will keep increasing or decreasing automatically, one step every quarter-second, so you can dial in your setting faster without repeatedly tapping the button."
  },
  {
    "question": "How do the intensity knobs work on my Ultima 5?",
    "answer": "Your Ultima 5 has two knobs on top of the unit, one for each channel. Turn a knob clockwise to increase intensity on that channel, or counterclockwise to decrease it. This lets you fine-tune each channel independently if you're treating two different areas at once.\n\nUseful Resources & Links:\n📘 [Ultima 5 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-5-User-Manual.pdf)\n🎥 [Ultima 5 Video Guide](https://www.youtube.com/watch?v=Evm1mGxXUMU)\n📄 [Tips on using Ultima 5 TENS](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20the%20Ultima%205%20TENS%20device.doc)"
  },
  {
    "question": "How do I read the battery level indicator on my Ultima 5?",
    "answer": "The battery icon on your display uses a simple 2-bar system. Both bars showing means your battery is fully charged. One bar means you're at a mid-level charge. If the battery symbol starts flashing, that's your cue that the batteries are running low and should be recharged or replaced soon.\n\nUseful Resources & Links:\n📘 [Ultima 5 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-5-User-Manual.pdf)\n🎥 [Ultima 5 Video Guide](https://www.youtube.com/watch?v=Evm1mGxXUMU)\n📄 [Tips on using Ultima 5 TENS](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20the%20Ultima%205%20TENS%20device.doc)"
  },
  {
    "question": "Does my Ultima 5 automatically shut off if I forget to turn it off?",
    "answer": "Yes. If the intensity on both channels is set to zero and the unit hasn't been used for 5 minutes, it will automatically power down on its own, so you don't have to worry about it running down the battery if you step away.\n\nUseful Resources & Links:\n📘 [Ultima 5 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-5-User-Manual.pdf)\n🎥 [Ultima 5 Video Guide](https://www.youtube.com/watch?v=Evm1mGxXUMU)\n📄 [Tips on using Ultima 5 TENS](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20the%20Ultima%205%20TENS%20device.doc)"
  },
  {
    "question": "What is the Lock/Unlock feature, and how do I use it?",
    "answer": "The Lock/Unlock feature lets you hold your current intensity steady so it can't be accidentally bumped up or down mid-session, handy if the unit is clipped to your belt or moving around while you're active. With the unit on, give the power button a short press to lock it; your intensity level will be held in place. Give it another short press to unlock and resume adjusting normally."
  },
  {
    "question": "What settings should I use for my very first Ultima 5 session?",
    "answer": "Your Quick Start Guide recommends a simple starting point: set the frequency to 150Hz, the pulse width to 250us, and the mode to Constant. Turn the intensity up to a level that feels strong but comfortable, and use the unit for 30-45 minutes, or as long as needed. For your wave form, start with the Asymmetrical Bi-Phasic Rectangular setting, it's the recommended starting point for initial treatment. From there, feel free to adjust based on comfort and results.\n\nUseful Resources & Links:\n📘 [Ultima 5 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-5-User-Manual.pdf)\n🎥 [Ultima 5 Video Guide](https://www.youtube.com/watch?v=Evm1mGxXUMU)\n📄 [Tips on using Ultima 5 TENS](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20the%20Ultima%205%20TENS%20device.doc)"
  },
  {
    "question": "How far apart should the electrode pads be on my Ultima 5?",
    "answer": "Per the Quick Start Guide, place the pads from each channel so they're straddling the area of pain, making sure the pads from each channel aren't touching one another and aren't more than 6 inches apart. This spacing helps the stimulation flow properly between the pads on each channel.\n\nUseful Resources & Links:\n📘 [Ultima 5 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-5-User-Manual.pdf)\n🎥 [Ultima 5 Video Guide](https://www.youtube.com/watch?v=Evm1mGxXUMU)\n📄 [Tips on using Ultima 5 TENS](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20the%20Ultima%205%20TENS%20device.doc)"
  },
  {
    "question": "Where can I learn more about my Ultima 5?",
    "answer": "For additional resources and information beyond your manual and Quick Start Guide, you can visit paintechnology.com.\n\nUseful Resources & Links:\n📘 [Ultima 5 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-5-User-Manual.pdf)\n🎥 [Ultima 5 Video Guide](https://www.youtube.com/watch?v=Evm1mGxXUMU)\n📄 [Tips on using Ultima 5 TENS](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20the%20Ultima%205%20TENS%20device.doc)"
  }
];


// Merge: Sheet pairs first, then hardcoded
// We want to filter out hardcoded pairs that are overridden by the sheet
const sheetQuestionSet = new Set(sheetQAPairs.map(p => p.question.toLowerCase().trim()));
const filteredHardcodedPairs = hardcodedQAPairs.filter(p => !sheetQuestionSet.has(p.question.toLowerCase().trim()));
const qaPairs = [...sheetQAPairs, ...filteredHardcodedPairs];

// Synonym map
const synonyms = {
  // Device / unit names
  "device": "tens unit",
  "unit": "tens unit",
  "machine": "tens unit",
  "stimulator": "tens unit",
  "massager": "tens unit",
  "electrotherapy": "tens unit",
  "e stim": "tens unit",
  "estim": "tens unit",
  "electrical stimulation": "tens unit",

  // Product model synonyms
  "u5": "ultima 5",
  "u 5": "ultima 5",
  "u1": "ultima 1",
  "u 1": "ultima 1",
  "u11": "ultima 11",
  "u 11": "ultima 11",
  "u20": "ultima 20",
  "u 20": "ultima 20",
  "u3t": "ultima 3t",
  "u 3t": "ultima 3t",
  "neo": "ultima neo",

  // Electrode / pad synonyms
  "pads": "electrodes",
  "pad": "electrodes",
  "electrode": "electrodes",
  "patch": "electrodes",
  "patches": "electrodes",
  "gelpad": "electrodes",
  "gelpads": "electrodes",
  "stickers": "electrodes",
  "sticker": "electrodes",
  "sticky pads": "electrodes",

  // Lead wire synonyms
  "wires": "lead wires",
  "wire": "lead wires",
  "lead": "lead wires",
  "leads": "lead wires",
  "cable": "lead wires",
  "cables": "lead wires",
  "cord": "lead wires",
  "cords": "lead wires",
  "connector": "lead wires",
  "connectors": "lead wires",

  // Intensity / strength synonyms
  "strength": "intensity",
  "level": "intensity",
  "amplitude": "intensity",
  "volume": "intensity",
  "strong": "intensity",
  "stronger": "intensity",
  "weaker": "intensity",
  "weak": "intensity",

  // Frequency / pulse rate synonyms
  "rate": "frequency",
  "speed": "frequency",
  "hz": "frequency",
  "hertz": "frequency",
  "pulses": "frequency",
  "pulse rate": "frequency",

  // Pulse width synonyms
  "width": "pulse width",
  "microseconds": "pulse width",
  "us": "pulse width",

  // Time / relief synonyms (paraphrase support)
  "soon": "quickly",
  "fast": "quickly",
  "rapid": "quickly",
  "quickly": "quickly",
  "difference": "relief",
  "benefit": "relief",
  "helping": "relief",
  "improvement": "relief",
  "notice": "feel",

  // Medical term synonyms (paraphrase support)
  "surgical hardware": "metal implants",
  "surgical": "metal implants",
  "hardware": "metal implants",
  "screw": "metal implants",
  "plate": "metal implants",
  "rod": "metal implants",
  "joint replacement": "metal implants",
  "red marks": "redness",
  "red mark": "redness",
  "redness": "redness",
  "irritation": "redness",
  "drug": "medication",
  "drugs": "medication",
  "medicine": "medication",
  "medicines": "medication",
  "interaction": "contraindication",
  "interactions": "contraindication",

  // Placement / position synonyms
  "placement": "position",
  "place": "position",
  "location": "position",
  "put": "position",
  "apply": "position",
  "stick": "position",
  "attach": "position",
  "where to put": "position",

  // Pain / discomfort synonyms
  "ache": "pain",
  "soreness": "pain",
  "discomfort": "pain",
  "stiffness": "pain",
  "hurt": "pain",
  "hurts": "pain",
  "hurting": "pain",
  "spasm": "pain",
  "spasms": "pain",
  "cramp": "pain",
  "cramps": "pain",
  "cramping": "pain",
  "tingling": "pain",
  "numbness": "pain",
  "numb": "pain",
  "burning": "pain",
  "throbbing": "pain",
  "sore": "pain",

  // Body part synonyms
  "lower back": "back pain",
  "lumbar": "back pain",
  "lumbago": "back pain",
  "sciatica": "back pain",
  "sciatic": "back pain",
  "kneecap": "knee",
  "knees": "knee",
  "shoulders": "shoulder",
  "cervical": "neck",
  "feet": "foot",
  "ankle": "foot",
  "wrist": "hand",
  "elbow": "arm",
  "hip": "joint",
  "hips": "joint",
  "arthritis": "joint pain",
  "neuropathy": "nerve pain",

  // Battery / power synonyms
  "power": "battery",
  "batteries": "battery",
  "rechargeable": "battery",
  "charging": "battery",
  "charge": "battery",
  "charger": "battery",
  "aa": "battery",
  "lithium": "battery",

  // Mode / program synonyms
  "setting": "mode",
  "settings": "mode",
  "program": "mode",
  "programs": "mode",
  "channel": "mode",
  "channels": "mode",
  "burst": "burst mode",
  "normal": "normal mode",
  "modulation": "modulation mode",
  "continuous": "continuous mode",
  "waveform": "wave form",
  "waveforms": "wave form",

  // Therapy type synonyms
  "ems": "electrical muscle stimulation",
  "ifc": "interferential",
  "interferential": "interferential therapy",
  "galvanic": "galvanic stimulation",
  "russian": "russian stimulation",
  "microcurrent": "micro current",
  "mens": "micro current",

  // Safety / contraindication synonyms
  "side effect": "safety",
  "side effects": "safety",
  "adverse": "safety",
  "risk": "safety",
  "risks": "safety",
  "dangers": "safety",
  "danger": "safety",
  "harmful": "safety",
  "safe": "safety",
  "precaution": "safety",
  "precautions": "safety",
  "caution": "safety",
  "warning": "safety",

  // Contraindication synonyms
  "pacemaker": "contraindications",
  "implant": "contraindications",
  "implants": "contraindications",
  "pregnant": "contraindications",
  "pregnancy": "contraindications",
  "diabetes": "contraindications",
  "diabetic": "contraindications",
  "heart": "contraindications",
  "cardiac": "contraindications",
  "epilepsy": "contraindications",
  "seizure": "contraindications",

  // Warranty / return synonyms
  "guarantee": "warranty",
  "replacement": "warranty",
  "repair": "warranty",
  "return": "warranty",
  "refund": "warranty",
  "defective": "warranty",
  "broken": "warranty",

  // Prescription / insurance synonyms
  "rx": "prescription",
  "doctor": "prescription",
  "physician": "prescription",
  "prescribed": "prescription",
  "coverage": "insurance",
  "reimbursement": "insurance",
  "va": "insurance",
  "veteran": "insurance",
  "medicare": "insurance",
  "medicaid": "insurance",

  // Manual / guide synonyms
  "guide": "user manual",
  "instructions": "user manual",
  "manual": "user manual",
  "pdf": "user manual",
  "documentation": "user manual",
  "booklet": "user manual",
  "quick start": "user manual",

  // Contact / support synonyms
  // NOTE: "help", "support", "service", "call" removed - too generic, corrupts semantic matching
  // These are handled by the INTENT OVERRIDE section instead
  "phone number": "contact info",
  "email address": "contact info",
  "customer service": "contact info",
  "reach out": "contact info",
  "fax": "contact info",

  // Pricing synonyms
  "cost": "pricing",
  "price": "pricing",
  "pay": "pricing",
  "buy": "pricing",
  "purchase": "pricing",
  "order": "pricing",
  "affordable": "pricing",
  "expensive": "pricing",
  "cheap": "pricing",

  // Company synonyms
  "seller": "pmt",
  "company": "pmt",
  "manufacturer": "pmt",
  "brand": "pmt",
  "pain management technologies": "pmt",
  "paintechnology": "pmt",
  "pain technology": "pmt",

  // Accessory synonyms
  "carrying case": "case",
  "pouch": "case",
  "belt clip": "clip",
  "clip": "clip",

  // Troubleshooting synonyms
  "not working": "troubleshooting",
  "broken": "troubleshooting",
  "malfunction": "troubleshooting",
  "problem": "troubleshooting",
  "issue": "troubleshooting",
  "fix": "troubleshooting",
  "reset": "troubleshooting"
};

// Stop words
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

function stem(word) {
  if (!word || word.length <= 3) return word;
  return word.replace(/(ing|ly|ed|er|es|s|ion)$/, "");
}

function getTokens(text) {
  const tokens = normalize(text)
    .split(" ")
    .filter((w) => w && !stopWords.has(w))
    .map(stem);
  return [...new Set(tokens)];
}

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

// Pre-calc IDF
const docCount = qaPairs.length;
const freqMap = {};

qaPairs.forEach((pair) => {
  const uniqueTokens = new Set(getTokens(pair.question));
  uniqueTokens.forEach((t) => {
    freqMap[t] = (freqMap[t] || 0) + 1;
  });
});

const idfWeights = {};
Object.keys(freqMap).forEach((t) => {
  idfWeights[t] = Math.log(docCount / freqMap[t]) + 1.0;
});

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
        const sim = 1 - dist / maxLen;

        if (sim >= 0.75 && sim > bestMatchScore) {
          bestMatchScore = sim;
          bestMatchIndex = j;
        } else if (
          (w1.includes(w2) || w2.includes(w1)) &&
          bestMatchScore < 0.6
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

function combinedScore(input, target) {
  const normInput = normalize(input);
  const normTarget = normalize(target);

  const charDist = levenshteinDistance(normInput, normTarget);
  const maxLen = Math.max(normInput.length, normTarget.length, 1);
  const charSimilarity = 1 - charDist / maxLen;

  const semantic = getSemanticScore(input, target);
  const jaccard = jaccardScore(input, target);

  return semantic * 0.55 + jaccard * 0.25 + charSimilarity * 0.2;
}

// 1) exact normalized match first
const normalizedIncoming = normalize(incomingQuestion);
let bestScore = 0;
let match = qaPairs.find((pair) => {
  if (normalize(pair.question) === normalizedIncoming) {
    bestScore = 1.0;
    return true;
  }
  return false;
});

// 2) fuzzy fallback
if (!match) {
  bestScore = 0;
  let bestMatch = null;

  for (const pair of qaPairs) {
    const scoreQ = combinedScore(incomingQuestion, pair.question);

    // Evaluate the answer field (which now contains context)
    // We omit charSimilarity because answer length differences penalize it heavily.
    const semanticA = getSemanticScore(incomingQuestion, pair.answer);
    const jaccardA = jaccardScore(incomingQuestion, pair.answer);
    const scoreA = semanticA * 0.65 + jaccardA * 0.35;

    let score = Math.max(scoreQ, scoreA);

    // Prioritize Google Sheet Q&A pairs by adding a score boost (up to 1.0)
    if (sheetQuestionSet.has(pair.question.toLowerCase().trim())) {
      score = Math.min(1.0, score + 0.15);
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = pair;
    }
  }

  const threshold = 0.5;
  if (bestScore >= threshold) {
    match = bestMatch;
  }
}
// ================= PRODUCT OVERRIDE =================
if (match && bestScore < 0.85) {
  const normQ = incomingQuestion.toLowerCase();
  const products = ["tens", "ultima", "ultima 5", "ultima 20", "ultima 3t", "ultima neo", "electrodes", "lead wires", "battery", "pmt"];

  const mentionedProduct = products.find((p) => normQ.includes(p));

  if (mentionedProduct) {
    const isInfoSeeking =
      /(tell me|what is|information|something about|details|explain|more about|more info|what are|how to use|how does it work)/.test(
        normQ,
      );
    const matchedQNorm = match.question.toLowerCase();
    const pName = mentionedProduct.replace(/\s+/g, "");
    const matchedHasProduct = matchedQNorm.replace(/\s+/g, "").includes(pName);

    // If it's an info query, or if it incorrectly matched a question about a completely different topic
    if (isInfoSeeking || !matchedHasProduct) {
      match = null;
    }
  }
}

// ================= PARAPHRASE INTENT MATCHING =================
// Catches natural language paraphrases that token-level matching misses
if (!match || bestScore < 0.7) {
  const normQ = incomingQuestion.toLowerCase();
  const paraphraseMap = [
    // 1. Pacemaker / Cardiac implant (checked before general metal implants)
    {
      patterns: [
        /(pacemaker|cardiac device|defibrillator|icd|implanted cardiac)/i,
        /tens with a pacemaker/i
      ],
      target: "Can I use TENS with a pacemaker?"
    },
    // 2. Relief onset & timeline
    {
      patterns: [
        /how (soon|quickly|fast|long|rapidly).*?(help|relief|work|difference|benefit|feel|notice|start|kick)/i,
        /when.*(start|begin|feel|notice|kick in|take effect)/i,
        /(time|duration).*(relief|help|feel|notice|benefit)/i,
        /(start|begin).*help/i,
        /notice.*(difference|relief|benefit|improvement)/i
      ],
      target: "How long does it take to feel relief?"
    },
    // 3. Metal implants / surgical hardware / titanium
    {
      patterns: [
        /(surgical|metal|hardware|joint replacement|knee replacement|hip replacement|titanium|screw|plate|rod).*(tens|safe|use|ok|device|problem)/i,
        /tens.*(surgical|metal|implant|hardware|joint replacement|knee replacement|hip replacement|titanium|screw|plate|rod)/i,
        /use.*(over|with|near).*(surgical|metal|implant|hardware|titanium)/i
      ],
      target: "Can I use a TENS unit if I have metal implants?"
    },
    // 4. Skin redness & irritation / breaking out
    {
      patterns: [
        /(red|redness|mark|marks|irritat|rash|burn|itchy|break|breaking out|skin).*(after|session|treatment|use|every|under|where the pad|where the electrode)/i,
        /skin.*(red|mark|marks|irritat|rash|itchy|break|color)/i,
        /(breaking out|break out).*(electrode|pad|skin)/i,
        /(red mark|red spot|redness).*(bad|normal|worried|concern|ok|okay)/i
      ],
      target: "Why does my skin turn red after treatment?"
    },
    // 5. Treatment / session duration
    {
      patterns: [
        /(recommend|typical|ideal|proper|best|suggested|optimal).*(duration|length|time|long|minute|session)/i,
        /(duration|length|time).*(treatment|session|therapy|recommend)/i,
        /how (long|many minute).*(session|treatment|use|per)/i
      ],
      target: "How many minutes should I do per session?"
    },
    // 6. Drug / medication interactions
    {
      patterns: [
        /(drug|medication|medicine|pharma|prescription).*(interact|contradict|conflict|combine|mix|safe|interfere)/i,
        /(interact|contradict|conflict|interfere).*(drug|medication|medicine|prescription)/i,
        /drug interaction/i,
        /medication.*(safe|ok|concern|worry|interact)/i
      ],
      target: "Is there contradictions with medication?"
    },
    // 7. U5 Waveform options
    {
      patterns: [
        /(wave|waveform).*(option|type|kind|offer|have|available).*(u5|ultima 5)/i,
        /(u5|ultima 5).*(wave|waveform).*(option|type|kind|offer|have)/i,
        /(wave|waveform).*(option|type).*(u5|ultima 5|ultima5)/i
      ],
      target: "What wave forms does the Ultima 5 offer, and which one should I use?"
    },
    // 8. Pad size (small vs big / 2 inch vs 4 inch)
    {
      patterns: [
        /(small pads?|big (ones|pads?)|pad sizes?|size.*(pad|electrode)|which pad.*best|2 inch.*4 inch)/i,
        /(difference|between).*(2 inch|4 inch|small.*big).*pad/i
      ],
      target: "What's the difference between 2 inch and 4 inch pads?"
    },
    // 9. First time use & step by step
    {
      patterns: [
        /(walk me through|how (do|to) use|steps to (set up|run)|first time (user|session|using)|get started).*(tens|device|unit|session|this)/i,
        /(step by step|how to set up).*(tens|session|unit)/i
      ],
      target: "How do I use a TENS unit, step by step?"
    },
    // 10. Does TENS work / Evidence / Placebo
    {
      patterns: [
        /(do tens units? actually (help|work)|real evidence|placebo|actually (help|work) people)/i,
        /(evidence|proof).*(works|effective|placebo)/i
      ],
      target: "Does TENS actually work?"
    },
    // 11. Intensity setting & pain/hurt
    {
      patterns: [
        /(right|proper|correct|ideal|recommended).*(intensity|level|strength|knob)/i,
        /(how high|what intensity|intensity level).*(turn up|set|use)/i,
        /(supposed|meant|should).*(hurt|painful)/i
      ],
      target: "How high should I turn up the intensity?"
    },
    // 12. Pad Contact Interruption Alarm (U5 beeps)
    {
      patterns: [
        /(beep|beeps|beeping|alert|alarm).*(pad|contact|u5|ultima 5)/i,
        /pad contact (alert|alarm|interruption|beep)/i
      ],
      target: "What does the Pad Contact Interruption Alarm do on my Ultima 5?"
    },
    // 13. Usage frequency & schedule
    {
      patterns: [
        /(how often|how many times|how many session|frequency|how many hours).*(day|week|month|daily|weekly|use|using|session)/i,
        /(reasonable|recommended|typical|proper|schedule|usage).*(frequency|times a week|times per week|per day|per week)/i,
        /(can|safe|ok).*(use|wear).*(tens|device|unit|this|it).*(every ?day|daily)/i,
        /(every ?day|daily|weekly).*(use|wear).*(tens|device|unit|this|it)/i
      ],
      target: "How often should I use a TENS unit?"
    },
    // 14. Stinging / Sharp / Uncomfortable sensation
    {
      patterns: [
        /(sting|stinging|bite|biting|sharp|uncomfortable|prick|pricking|pinch).*(instead of|tingle|tingling|feel|stimulation)/i,
        /(sharp|uncomfortable).*(stimulation|sensation|feel)/i
      ],
      target: "Stimulation feels sharp or uncomfortable"
    },
    // 15. Sleep / Overnight use
    {
      patterns: [
        /(overnight|all night|fall asleep|sleeping|while (i|we) sleep).*(tens|device|unit|leave|wear|on|safe|okay)/i,
        /(safe|okay).*(sleep|sleeping|overnight|all night)/i
      ],
      target: "Is it safe to use a TENS unit while sleeping?"
    },
    // 16. What's in the box / U5 kit contents
    {
      patterns: [
        /(what('s| is) (included|in the box|in my kit)|what do i get (when|if) i buy).*(ultima 5|u5|kit)/i,
        /(comes in|included with).*(ultima 5|u5)/i
      ],
      target: "What comes in my Ultima 5 kit?"
    },
    // 17. Placing directly over sore spot / pain area
    {
      patterns: [
        /(directly|right|on top of).*(pain|painful|sore spot|sore area|hurt)/i,
        /pads.*(on top of|over).*(pain|sore spot)/i
      ],
      target: "Can I place the pads directly over where the pain is?"
    },
    // 18. Unit shuts off / powers down mid session
    {
      patterns: [
        /(shuts|turns|powers).*(itself|down|off).*(mid|during|own|automatically)/i,
        /(device|unit).*(turn off|shut off|power down|stops).*(by itself|on its own|mid-session)/i
      ],
      target: "Why does my unit keep turning off?"
    },
    // 19. Swelling & inflammation
    {
      patterns: [
        /(bring down|reduce|help).*(swelling|inflammation|edema)/i,
        /tens.*(swelling|inflammation|edema)/i
      ],
      target: "Does TENS help reduce inflammation?"
    },
    // 20. One pad / one side working
    {
      patterns: [
        /(one (side|channel|pad|lead) works.*(other|second) doesn't|only one (pad|channel|side) (is )?working)/i,
        /one pad working/i
      ],
      target: "Why is only one pad working?"
    },
    // 21. Sensation fading / adaptation / tingling goes away
    {
      patterns: [
        /(tingling|sensation).*(goes away|fades|stops|less|disappear).*(partway|during|after a few minute|normal)/i,
        /(after a few minute.*stop feeling|stop feeling.*after a few minute)/i,
        /(stop working|get used to).*if i use.*(too much|often)/i
      ],
      target: "Why does the sensation fade after a few minutes?"
    },
    // 22. Pads touching / overlapping / separated
    {
      patterns: [
        /(electrodes|pads).*(stay separated|touch|touching|overlap|overlapping)/i,
        /can.*(pads|electrodes).*touch/i,
        /(pads|electrodes).*(separated|overlap)/i
      ],
      target: "Can the pads touch each other?"
    },
    // 23. Prescription / Doctor's note
    {
      patterns: [
        /(doctor('s)? note|rx|prescription.*only|require.*prescription|need a prescription|prescription required)/i,
        /prescription-only/i
      ],
      target: "Is a prescription required?"
    },
    // 24. Dead / won't power up / power button does nothing
    {
      patterns: [
        /(power button.*does nothing|won't (turn|power)|completely dead|won't power up|not powering up|won't turn on)/i,
        /why won't.*turn on/i
      ],
      target: "Why won't my TENS unit turn on?"
    },
    // 25. Neck & shoulder electrode placement
    {
      patterns: [
        /(stiff neck|neck and shoulder|neck pain).*(where|stick|place|pad|electrode|position)/i,
        /(pads?|electrodes?).*(neck|shoulder tension|neck pain)/i
      ],
      target: "Where do I put the pads for neck pain?"
    },
    // 26. All four pads / both channels together
    {
      patterns: [
        /(all four pads|both channels|2 channels|multiple channels).*(at once|together|simultaneously|run both)/i,
        /use more than one channel/i
      ],
      target: "Can I use more than one channel at a time?"
    },
    // 27. Driving / Commute / Behind the wheel
    {
      patterns: [
        /(behind the wheel|commute|drive to work|while driving|operating a vehicle|running on my commute)/i,
        /can i drive/i
      ],
      target: "Can I drive while using a TENS unit?"
    },
    // 28. Pad spacing / gap between pads
    {
      patterns: [
        /(how much gap|gap.*between|spacing between|how far apart|right spacing).*(pads|electrodes)/i,
        /how far apart/i
      ],
      target: "How far apart should the pads be?"
    },
    // 29. Pregnancy / Expecting
    {
      patterns: [
        /(while expecting|pregnant|pregnancy|trimester|weeks pregnant|belly at \d+ weeks)/i,
        /safe.*during pregnancy/i
      ],
      target: "Is a TENS unit safe to use during pregnancy?"
    },
    // 30. What is U5 / Device type
    {
      patterns: [
        /(what kind of device is (the )?(u5|ultima 5)|tell me about (the )?(u5|ultima 5)|what is (the )?ultima 5)/i
      ],
      target: "What is the Ultima 5 (U5)?"
    },
    // 31. Diabetes / Diabetic
    {
      patterns: [
        /(type 2 diabetic|type 1 diabetic|diabetes|diabetic|with diabetes)/i,
        /tens.*if i have diabetes/i
      ],
      target: "Can I use a TENS unit if I have diabetes?"
    },
    // 32. First session setup for U5
    {
      patterns: [
        /(starting setup|first.*session setup|recommended settings).*(u5|ultima 5|new.*user)/i
      ],
      target: "What settings should I use for my very first Ultima 5 session?"
    },
    // 33. Intensity knobs on U5
    {
      patterns: [
        /(intensity controls|intensity knobs|knobs work).*(u5|ultima 5)/i
      ],
      target: "How do the intensity knobs work on my Ultima 5?"
    },
    // 34. Turned on but no sensation / feel nothing
    {
      patterns: [
        /(turned it on.*feel (absolutely )?nothing|running.*no sensation at all|not feeling (any )?sensation|no sensation)/i,
        /producing sensation/i
      ],
      target: "Why isn't my TENS unit producing sensation?"
    },
    // 35. Pad lifespan / How many uses
    {
      patterns: [
        /(how many uses|how long.*last).*(pads|electrodes|set of pads)/i,
        /how long do tens pads last/i
      ],
      target: "How long do TENS pads last?"
    },
    // 36. Acute pain / Fresh injury / Hurt yesterday
    {
      patterns: [
        /(fresh injury|hurt.*yesterday|acute pain|new injury|recent strain).*(frequency|hz|setting)/i,
        /(which hz|what frequency).*(fresh|acute|recent|new injury|yesterday)/i
      ],
      target: "What frequency works best for acute pain?"
    },
    // 37. Chronic pain frequency / SMS slang
    {
      patterns: [
        /(wat freqency|chronik pane|chronic pain)/i,
        /what frequency is best for chronic/i
      ],
      target: "What frequency is best for chronic pain?"
    },
    // 38. Sticky again / Tackiness / Revive old pads / Pads won't stick
    {
      patterns: [
        /(tackiness back|sticky again|revive (old )?pads|restore.*adhes)/i,
        /how do i make my pads sticky/i
      ],
      target: "How do I make my pads sticky again?"
    },
    {
      patterns: [
        /(pads? (lost their grip|won't stick|aren't sticking|wont stick)|electrodes? won't stay|pads wont stick)/i
      ],
      target: "Why won't my pads stick anymore?"
    },
    // 39. Lumbar / Lower back placement
    {
      patterns: [
        /(lumbar|lower back).*(pad positions?|placement|where|stick|put)/i,
        /pads for lower back/i
      ],
      target: "Where should I place the pads for lower back pain?"
    },
    // 40. Auto power-off on U5
    {
      patterns: [
        /(auto power-off|automatic(ally)? shut off|auto-off).*(u5|ultima 5)/i
      ],
      target: "Does my Ultima 5 automatically shut off if I forget to turn it off?"
    },
    // 41. All-day continuous wear
    {
      patterns: [
        /(continuous all-day wear|wear.*all day|wear.*continuously)/i
      ],
      target: "Can I wear a TENS unit all day?"
    }
  ];

  for (const entry of paraphraseMap) {
    for (const pattern of entry.patterns) {
      if (pattern.test(normQ)) {
        const paraphraseMatch = qaPairs.find(
          (p) => p.question === entry.target
        );
        if (paraphraseMatch) {
          match = paraphraseMatch;
          bestScore = 0.95;
          break;
        }
      }
    }
    if (match && bestScore >= 0.95) break;
  }
}

// ================= INTENT OVERRIDE =================
if (bestScore < 0.85) {
  const normQ = incomingQuestion.toLowerCase();

  // Specific Override for timeline question
  if (
    normQ.includes("how quickly") &&
    (normQ.includes("tens") || normQ.includes("pmt") || normQ.includes("spark")) &&
    normQ.includes("work")
  ) {
    const timelineMatch = qaPairs.find(
      (p) => p.question === "How long does it take to feel relief?",
    );
    if (timelineMatch) {
      match = timelineMatch;
      bestScore = 1.0;
    }
  }

  // Specific Override for mechanism question
  if (
    !normQ.includes("quickly") &&
    normQ.includes("how") &&
    (normQ.includes("tens") || normQ.includes("pmt") || normQ.includes("spark")) &&
    normQ.includes("work")
  ) {
    const workMatch = qaPairs.find(
      (p) => p.question === "How does a TENS unit work?",
    );
    if (workMatch) {
      match = workMatch;
      bestScore = 1.0;
    }
  }

  const isFindingProvider =
    /(list of|find a|looking for|where is|locate a|provide me list|list of) .*?(clinic|provider|doctor|location)/.test(
      normQ,
    ) ||
    /(find|list|locate|where).*?(clinic|provider|doctor|location)/.test(normQ);

  if (isFindingProvider) {
    const providerMatch = qaPairs.find(
      (p) => p.question === "How do I find a provider near me?",
    );
    if (providerMatch) {
      match = providerMatch;
      bestScore = 1.0;
    }
  }

  const isSideEffects =
    /(adverse impact|side effect|negative effect|bad effect|side-effect|adverse effect|adverse reaction|concern.*?customer|customer.*?concern|concern.*?patient|patient.*?concern|safety concern|what concern)/.test(
      normQ,
    );
  if (isSideEffects) {
    const sideEffectMatch = qaPairs.find(
      (p) => p.question === "Are there any side effects?",
    );
    if (sideEffectMatch) {
      match = sideEffectMatch;
      bestScore = 1.0;
    }
  }

  // Specific Override for sell sheets and tech specs
  if (
    normQ.includes("sell sheet") ||
    normQ.includes("tech spec") ||
    normQ.includes("specifications")
  ) {
    const specMatch = qaPairs.find(
      (p) => p.question === "Where can I find the user manual for my device?",
    );
    if (specMatch) {
      match = specMatch;
      bestScore = 1.0;
    }
  }

  const isCompanyLocation =
    /(where is|location of|situated|address of|headquarter|physical office|office location).*?(pmt|company|your)/.test(
      normQ,
    ) ||
    /(pmt|company).*?(where|location|situated|address|headquarter)/.test(
      normQ,
    );
  if (isCompanyLocation) {
    const locationMatch = qaPairs.find(
      (p) => p.question === "contact info",
    );
    if (locationMatch) {
      match = locationMatch;
      bestScore = 1.0;
    }
  }

  // Strictly match intentional contact requests (not general "help" or "contact" words)
  const isContactSupport =
    /(contact (pmt|us|support|company|team)|customer (support|service)|reach (out to|pmt|support)|phone number|email address|how (can|do) i contact|how to (contact|reach)|support team|help desk)/i.test(
      normQ,
    ) && !/(joint health support|support kit|gut support|sleep support|pad contact|help (people|with|me|reduce)|actually help)/i.test(normQ);
  if (isContactSupport) {
    const supportMatch = qaPairs.find((p) => p.question === "contact info");
    if (supportMatch) {
      match = supportMatch;
      bestScore = 1.0;
    }
  }
}

// ================= AMBIGUITY OVERRIDE =================
// If the match is weak or the query is very short/generic, force fallback (only for bestScore < 0.9)
if (match && bestScore < 0.9) {
  const normQ = incomingQuestion.toLowerCase();

  // Domain-specific words that indicate a valid TENS/electrotherapy question
  const domainContextWords = [
    "session", "treatment", "therapy", "stimulation", "electrode",
    "relief", "frequency", "intensity", "waveform", "implant",
    "placement", "chronic", "acute", "pain", "nerve",
    "muscle", "skin", "redness", "irritation", "medication",
    "drug", "interaction", "duration", "minutes", "surgical",
    "hardware", "pacemaker", "pregnancy", "diabetes", "healing",
    "red", "marks", "mark", "helping", "difference", "notice",
    "wave", "waveforms", "implants", "metal", "pads", "pad"
  ];
  const hasDomainContext = domainContextWords.some((w) => normQ.includes(w));

  const products = ["tens", "ultima", "ultima 5", "ultima 20", "ultima 3t", "ultima neo", "electrodes", "lead wires", "battery", "pmt"];
  const hasSpecificProduct = products.some((p) => normQ.includes(p));
  const hasCompany = (normQ.includes("tens") || normQ.includes("pmt") || normQ.includes("spark")) || normQ.includes("pmt");
  const isClearContext = hasSpecificProduct || hasCompany || hasDomainContext;

  const wordCount = normQ.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount <= 3 && !isClearContext) {
    match = null;
  }
}

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
  incomingQuestion.toLowerCase().includes(keyword),
);

if (isProhibited) {
  match = null;
}

let resultOutput = "";

if (match) {
  resultOutput = match.answer;
} else {
  resultOutput =
    "I am Spark, your dedicated assistant from Pain Management Technologies (PMT). I am here to support your pain management journey with our advanced electrotherapy devices and TENS units. How can I help you today? ⚡";
}

return [
  {
    json: {
      output: resultOutput,
      debug: {
        cacheSource: cacheSource,
        sheetQuestionsCount: sheetQAPairs.length,
        totalQuestionsCount: qaPairs.length,
        matchedQuestion: match ? match.question : "",
        similarityScore: Number(bestScore.toFixed(4)),
        hasMatchInSheet: match ? sheetQuestionSet.has(match.question.toLowerCase().trim()) : false
      }
    },
  },
];
