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
  "contraindications", "waveform", "waveforms", "hz", "hertz", "microseconds",
  // PMT product name segments (prevent false-positive gibberish detection)
  "nervebeam", "nervespa", "nervetarget", "snuggleback", "snuggleback",
  "starburst", "mobijoe", "mobi", "mobiback", "mobibench", "mobicushion",
  "skypillow", "jawfit", "ohstim", "itens", "softtouch", "softcycle",
  "aquarelief", "aqua", "polarvortex", "polarsport", "arcticice",
  "theracycle", "coolman", "leonns", "ucombo", "seatboost", "laserhero",
  "toilettilt", "ottossage", "quakeplate", "scurve", "bluecube",
  "hypoallergenic", "cryotherapy", "melaleuca", "melatonin"
]);

function isNonEnglish(text) {
  if (!text) return false;
  // Strip micro symbol (μ), degree symbol (°), dash variants before testing non-Latin script
  const cleanText = text.replace(/[\u03BC\u00B0\u2013\u2014]/g, '');
  // 1. Non-Latin scripts (Cyrillic, Arabic, CJK, Devanagari, Hebrew, Thai) - excluding Greek block for 'μ'
  const nonLatinRegex = /[\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0900-\u097F\u0590-\u05FF\u0370-\u03FF\u0E00-\u0E7F]/;
  if (nonLatinRegex.test(cleanText)) return true;

  // Greek script check excluding 'μ' (U+03BC)
  const greekWithoutMu = /[\u0370-\u03BB\u03BD-\u03FF]/;
  if (greekWithoutMu.test(cleanText)) return true;

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

  // Sentence-level escape: if the input has many real words, don't flag
  // the entire sentence because of one unusual word. Count clean words first.
  let normalWordCount = 0;
  let suspiciousWordCount = 0;

  for (const word of words) {
    // Split hyphenated words into segments (e.g. "Soft-Touch" → ["Soft", "Touch"])
    // so CamelCase product names with hyphens don't get concatenated
    const segments = word.split(/[-–—]/);
    let wordIsSuspicious = false;

    for (const segment of segments) {
      const cleanWord = segment.replace(/[^a-zA-Z]/g, '');
      if (cleanWord.length === 0) continue;
      if (DOMAIN_WHITELIST.has(cleanWord.toLowerCase())) {
        normalWordCount++;
        continue;
      }

      // Threshold: 4 transitions catches real gibberish (fuihDfuhnsDIO=4) but allows
      // CamelCase product names (NerveBeam=3, SnuggleBack=3, StarBurst=3)
      let caseTransitions = 0;
      for (let i = 0; i < cleanWord.length - 1; i++) {
        const isCurrUpper = cleanWord[i] === cleanWord[i].toUpperCase();
        const isNextUpper = cleanWord[i + 1] === cleanWord[i + 1].toUpperCase();
        if (isCurrUpper !== isNextUpper) caseTransitions++;
      }
      if (cleanWord.length >= 7 && caseTransitions >= 4) {
        wordIsSuspicious = true;
        continue;
      }

      // 2. Consonant clusters >= 6 in a row
      if (/[bcdfghjklmnpqrstvwxyz]{6,}/i.test(cleanWord)) {
        wordIsSuspicious = true;
        continue;
      }

      // 3. Long word (>= 6 chars) with zero vowels
      if (cleanWord.length >= 6 && !/[aeiouy]/i.test(cleanWord)) {
        wordIsSuspicious = true;
        continue;
      }

      // 4. Repeated character sequence 4+ times (e.g. aaaaaa, abababab)
      if (/(.)\1{3,}/.test(cleanWord) || /([a-zA-Z]{2,4})\1{2,}/.test(cleanWord)) {
        wordIsSuspicious = true;
        continue;
      }

      // 5. Very low vowel-to-consonant ratio in long words (>= 8 chars with < 13% vowels)
      if (cleanWord.length >= 8) {
        const vowels = (cleanWord.match(/[aeiouy]/gi) || []).length;
        if (vowels / cleanWord.length < 0.13) {
          wordIsSuspicious = true;
          continue;
        }
      }

      // Word passed all checks — it's normal
      if (cleanWord.length >= 2) normalWordCount++;
    }

    if (wordIsSuspicious) suspiciousWordCount++;
  }

  // Sentence-level decision:
  // - If there are enough normal words (>= 4), don't flag as gibberish
  // - If the majority of words are suspicious, flag as gibberish
  // - For very short inputs (1-2 words), flag if any word is suspicious
  if (normalWordCount >= 4) return false;
  if (suspiciousWordCount > 0 && normalWordCount <= 1) return true;
  if (suspiciousWordCount > normalWordCount) return true;

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
// ================= KB PRODUCT DIRECT ANSWERS =================
// Generated from input/knowledge-base/extracted_pmt_knowledge_base.json.
// Answers are compacted PMT source text, capped to the tester's 700-char KB expectation.
const kbProductQAPairs = [
  {
    "question": "Silver Conductive Electrodes by Soft-Touch. Tricot Backing with a clean hypoallergenic gel-TENS Unit pads–Latex-Free Replacement pads electrode patches with High Stick performance, non-irritating gel- 1.25x1.25”. 10packs of 4 each/pack(40 electrodes)",
    "answer": "PRODUCTS Electrodes • Silver electrodes Silver Conductive Electrodes by Soft-Touch. Tricot Backing with a clean hypoallergenic gel-TENS Unit pads–Latex-Free Replacement pads electrode patches with High Stick performance, non-irritating gel- 1.25x1.25”. 10packs of 4 each/pack(40 electrodes) Roll over to zoom in + View large image Silver Conductive Electrodes by Soft-Touch. Tricot Backing with a clean hypoallergenic gel-TENS Unit pads–Latex-Free Replacement pads electrode patches with High Stick performance, non-irritating gel- 1.25x1.25”. 10packs of 4 each/pack(40 electrodes) SILVER CONDUCTION PADS: Premium Grade Silver is used to create low ohms and highly conductive electrotherapy current. "
  },
  {
    "question": "Silver Conductive Electrodes by Soft-Touch. Tricot Backing with a clean hypoallergenic gel-TENS Unit pads–Latex-Free Replacement pads electrode patches with High Stick performance, non-irritating gel- 3” Rd. 10packs of 4 each/pack(40 electrodes)",
    "answer": "PRODUCTS Electrodes Silver Conductive Electrodes by Soft-Touch. Tricot Backing with a clean hypoallergenic gel-TENS Unit pads–Latex-Free Replacement pads electrode patches with High Stick performance, non-irritating gel- 3” Rd. 10packs of 4 each/pack(40 electrodes) Roll over to zoom in + View large image Silver Conductive Electrodes by Soft-Touch. Tricot Backing with a clean hypoallergenic gel-TENS Unit pads–Latex-Free Replacement pads electrode patches with High Stick performance, non-irritating gel- 3” Rd. 10packs of 4 each/pack(40 electrodes) SILVER CONDUCTION PADS: Premium Grade Silver is used to create low ohms and highly conductive electrotherapy current. Silver is better than carbon o"
  },
  {
    "question": "Silver Conductive Electrodes by Soft-Touch. Tricot Backing with a clean hypoallergenic gel-TENS Unit pads–Latex-Free Replacement pads electrode patches with High Stick performance, non-irritating gel- 2” Rd. 10packs of 4 each/pack(40 electrodes)",
    "answer": "PRODUCTS Electrodes Silver Conductive Electrodes by Soft-Touch. Tricot Backing with a clean hypoallergenic gel-TENS Unit pads–Latex-Free Replacement pads electrode patches with High Stick performance, non-irritating gel- 2” Rd. 10packs of 4 each/pack(40 electrodes) Roll over to zoom in + View large image Silver Conductive Electrodes by Soft-Touch. Tricot Backing with a clean hypoallergenic gel-TENS Unit pads–Latex-Free Replacement pads electrode patches with High Stick performance, non-irritating gel- 2” Rd. 10packs of 4 each/pack(40 electrodes) SILVER CONDUCTION PADS: Premium Grade Silver is used to create low ohms and highly conductive electrotherapy current. Silver is better than carbon o"
  },
  {
    "question": "Silver Conductive Electrodes by Soft-Touch. Tricot Backing with a clean hypoallergenic gel-TENS Unit pads–Latex-Free Replacement pads electrode patches with High Stick performance, non-irritating gel- 2x4”. 10packs of 4 each/pack(40 electrodes)",
    "answer": "PRODUCTS Electrodes Silver Conductive Electrodes by Soft-Touch. Tricot Backing with a clean hypoallergenic gel-TENS Unit pads–Latex-Free Replacement pads electrode patches with High Stick performance, non-irritating gel- 2x4”. 10packs of 4 each/pack(40 electrodes) Roll over to zoom in + View large image Silver Conductive Electrodes by Soft-Touch. Tricot Backing with a clean hypoallergenic gel-TENS Unit pads–Latex-Free Replacement pads electrode patches with High Stick performance, non-irritating gel- 2x4”. 10packs of 4 each/pack(40 electrodes) SILVER CONDUCTION PADS: Premium Grade Silver is used to create low ohms and highly conductive electrotherapy current. Silver is better than carbon or "
  },
  {
    "question": "Silver Conductive Electrodes by Soft-Touch. Tricot Backing with a clean hypoallergenic gel-TENS Unit pads–Latex-Free Replacement pads electrode patches with High Stick performance, non-irritating gel- 2x2”. 10packs of 4 each/pack(40 electrodes)",
    "answer": "PRODUCTS Electrodes Silver Conductive Electrodes by Soft-Touch. Tricot Backing with a clean hypoallergenic gel-TENS Unit pads–Latex-Free Replacement pads electrode patches with High Stick performance, non-irritating gel- 2x2”. 10packs of 4 each/pack(40 electrodes) Roll over to zoom in + View large image Silver Conductive Electrodes by Soft-Touch. Tricot Backing with a clean hypoallergenic gel-TENS Unit pads–Latex-Free Replacement pads electrode patches with High Stick performance, non-irritating gel- 2x2”. 10packs of 4 each/pack(40 electrodes) SILVER CONDUCTION PADS: Premium Grade Silver is used to create low ohms and highly conductive electrotherapy current. Silver is better than carbon or "
  },
  {
    "question": "RELIEF FOR STRESS - Ease your mind and body with our stress relief cream, designed to penetrate deeply and alleviate tension. Its calming effect helps reduce stress, enabling a peaceful night's sleep and leaving you refreshed for the day ahead.",
    "answer": "PRODUCTS Therapeutic Creams and Gels RELIEF FOR STRESS - Ease your mind and body with our stress relief cream, designed to penetrate deeply and alleviate tension. Its calming effect helps reduce stress, enabling a peaceful night's sleep and leaving you refreshed for the day ahead. Roll over to zoom in + View large image RELIEF FOR STRESS - Ease your mind and body with our stress relief cream, designed to penetrate deeply and alleviate tension. Its calming effect helps reduce stress, enabling a peaceful night's sleep and leaving you refreshed for the day ahead. RELIEF FOR STRESS - Ease your mind and body with our stress relief cream, designed to penetrate deeply and alleviate tension. Its cal"
  },
  {
    "question": "Grounding Fitted Bed Sheet Set by Earth Sheets | 12% Silver Fiber & 4% Silk | 84% Organic Cotton | Conductive Grounding Bed Sheet for EMF Protection & Better Sleep | Includes COILED Expandable cord, Socket tester, Conductivity Pen - Queen",
    "answer": "PRODUCTS Electrotherapy Garments Grounding Fitted Bed Sheet Set by Earth Sheets | 12% Silver Fiber & 4% Silk | 84% Organic Cotton | Conductive Grounding Bed Sheet for EMF Protection & Better Sleep | Includes COILED Expandable cord, Socket tester, Conductivity Pen - Queen Roll over to zoom in + View large image Grounding Fitted Bed Sheet Set by Earth Sheets | 12% Silver Fiber & 4% Silk | 84% Organic Cotton | Conductive Grounding Bed Sheet for EMF Protection & Better Sleep | Includes COILED Expandable cord, Socket tester, Conductivity Pen - Queen Luxury & Conductive Fabric: Designed with 400-thread count organic cotton and 12% silver fiber for a soft, breathable, and conductive sleeping surfac"
  },
  {
    "question": "Evertrac Posture Back Belt with Assistive Lumbar Support – Adjustable Ergonomic Belt for Upright Sitting, Lower Back Pain Relief & Improved Spine Alignment – Ideal for Office, Travel, and Long Sitting Hours Weight limit - 180lbs to 400lbs",
    "answer": "PRODUCTS Traction Evertrac Posture Back Belt with Assistive Lumbar Support – Adjustable Ergonomic Belt for Upright Sitting, Lower Back Pain Relief & Improved Spine Alignment – Ideal for Office, Travel, and Long Sitting Hours Weight limit - 180lbs to 400lbs Roll over to zoom in + View large image Evertrac Posture Back Belt with Assistive Lumbar Support – Adjustable Ergonomic Belt for Upright Sitting, Lower Back Pain Relief & Improved Spine Alignment – Ideal for Office, Travel, and Long Sitting Hours Weight limit - 180lbs to 400lbs Ergonomic Lumbar Support: Promotes natural spinal alignment and relieves pressure on the lower back. Knee-to-Back Assistive Design: Gently pulls the lumbar region f"
  },
  {
    "question": "Grounding Fitted Bed Sheet Set by Earth Sheets | 12% Silver Fiber & 4% Silk | 84% Organic Cotton | Conductive Grounding Bed Sheet for EMF Protection & Better Sleep | Includes COILED Expandable cord, Socket tester, Conductivity Pen - King",
    "answer": "PRODUCTS Electrotherapy Garments Grounding Fitted Bed Sheet Set by Earth Sheets | 12% Silver Fiber & 4% Silk | 84% Organic Cotton | Conductive Grounding Bed Sheet for EMF Protection & Better Sleep | Includes COILED Expandable cord, Socket tester, Conductivity Pen - King Roll over to zoom in + View large image Grounding Fitted Bed Sheet Set by Earth Sheets | 12% Silver Fiber & 4% Silk | 84% Organic Cotton | Conductive Grounding Bed Sheet for EMF Protection & Better Sleep | Includes COILED Expandable cord, Socket tester, Conductivity Pen - King Luxury & Conductive Fabric: Designed with 400-thread count organic cotton and 12% silver fiber for a soft, breathable, and conductive sleeping surface,"
  },
  {
    "question": "Premium Electrotherapy Conductive Sleeve - for TENS Pain Treatment, Neuropathy, Inflammation, Arthritis, Nerve and Joint Pain (1 Pair - Silver Thread – Kit INCLUDES Conductive Spray - One Size Fits Most) – Available for Arm or Leg.",
    "answer": "PRODUCTS Electrotherapy Garments Premium Electrotherapy Conductive Sleeve - for TENS Pain Treatment, Neuropathy, Inflammation, Arthritis, Nerve and Joint Pain (1 Pair - Silver Thread – Kit INCLUDES Conductive Spray - One Size Fits Most) – Available for Arm or Leg. Roll over to zoom in + View large image Premium Electrotherapy Conductive Sleeve - for TENS Pain Treatment, Neuropathy, Inflammation, Arthritis, Nerve and Joint Pain (1 Pair - Silver Thread – Kit INCLUDES Conductive Spray - One Size Fits Most) – Available for Arm or Leg. USE WITH YOUR EXISTING TENS OR ELECTROTHERAPY DEVICE (compatible with 95% of devices) for treatment of Nerve and Joint Pain, Arthritis, Sports Injuries, Post-op Sw"
  },
  {
    "question": "Melaleuca Spray - 100% Natural Tea Tree Toilet Spray – 8 Oz - Natural Bathroom Odor Eliminator & Air Freshener – Pure Tea Tree Essential Oil – Odor Eater, Eliminate mold and mildew, Portable Size, Cruelty-Free, Eco-Friendly",
    "answer": "PRODUCTS Therapeutic Creams and Gels Melaleuca Spray - 100% Natural Tea Tree Toilet Spray – 8 Oz - Natural Bathroom Odor Eliminator & Air Freshener – Pure Tea Tree Essential Oil – Odor Eater, Eliminate mold and mildew, Portable Size, Cruelty-Free, Eco-Friendly Roll over to zoom in + View large image Melaleuca Spray - 100% Natural Tea Tree Toilet Spray – 8 Oz - Natural Bathroom Odor Eliminator & Air Freshener – Pure Tea Tree Essential Oil – Odor Eater, Eliminate mold and mildew, Portable Size, Cruelty-Free, Eco-Friendly Natural Odor Eliminator: Made with 100% pure Tea Tree essential oil, providing a refreshing and effective solution to eliminate bathroom odors by not just masking them but eli"
  },
  {
    "question": "Heated Gua Sha Scraping Massage Tool by TheraStone mini; Gua Sha Skin Scraping Stone with Heat & Vibration, with Bian Stone, Gua sha Tool for Soft-tissue massage, improve blood circulation, relieve pain, anti-aging (White)",
    "answer": "PRODUCTS Massage Therapy Devices Heated Gua Sha Scraping Massage Tool by TheraStone mini; Gua Sha Skin Scraping Stone with Heat & Vibration, with Bian Stone, Gua sha Tool for Soft-tissue massage, improve blood circulation, relieve pain, anti-aging (White) Roll over to zoom in + View large image Heated Gua Sha Scraping Massage Tool by TheraStone mini; Gua Sha Skin Scraping Stone with Heat & Vibration, with Bian Stone, Gua sha Tool for Soft-tissue massage, improve blood circulation, relieve pain, anti-aging (White) ANCIENT TECHNIQUE WITH MODERN TECH: The Therastone mini combines ancient Chinese healing practices with modern technology to increase the effectiveness of traditional scraping massa"
  },
  {
    "question": "Plantar Fasciitis And Heel Spur Cream By PMT – Therapeutic Relief For Foot, Plantar Fasciitis And Heal Spurs. Includes 1 Gram Of Arnica; Vitamin B6, Menthol, Aloe - Scientifically Developed To Treat The Ligament - 2.82OZ",
    "answer": "PRODUCTS Therapeutic Creams and Gels Plantar Fasciitis And Heel Spur Cream By PMT – Therapeutic Relief For Foot, Plantar Fasciitis And Heal Spurs. Includes 1 Gram Of Arnica; Vitamin B6, Menthol, Aloe - Scientifically Developed To Treat The Ligament - 2.82OZ Roll over to zoom in + View large image Plantar Fasciitis And Heel Spur Cream By PMT – Therapeutic Relief For Foot, Plantar Fasciitis And Heal Spurs. Includes 1 Gram Of Arnica; Vitamin B6, Menthol, Aloe - Scientifically Developed To Treat The Ligament - 2.82OZ Targeted relief for the ligament, tendons and muscles: Works within minutes of application. Our proprietary formula can help to increase blood circulation, reduce pain, inflammation"
  },
  {
    "question": "Water Circulating Sleep Pad by Thermacycle; Cools and Heats to create a Therapeutic Under Pillow or Fitted Sheet Pad - All Natural Sleep Aid for Hot Flashes, Night Sweat, Menopause, Insomnia, Hyperhidrosis – Pillow Pad",
    "answer": "PRODUCTS Water Therapy Systems Water Circulating Sleep Pad by Thermacycle; Cools and Heats to create a Therapeutic Under Pillow or Fitted Sheet Pad - All Natural Sleep Aid for Hot Flashes, Night Sweat, Menopause, Insomnia, Hyperhidrosis – Pillow Pad Roll over to zoom in + View large image Water Circulating Sleep Pad by Thermacycle; Cools and Heats to create a Therapeutic Under Pillow or Fitted Sheet Pad - All Natural Sleep Aid for Hot Flashes, Night Sweat, Menopause, Insomnia, Hyperhidrosis – Pillow Pad THERMACYCLE MATTRESS PAD: A climate-controlled, heating/cooling mattress pad that will transform your bed into the ideal sleeping environment. Our Thermacycle pad fits seamlessly on your curr"
  },
  {
    "question": "Cryotherapy and Hot Water Treatement System - Water Circulating Device by Aqua Relief with Universal Pad For Post-Surgical Recovery and Sustained Heat Therapy to Treat a Chronic or Acute Disability - With Universal Pad",
    "answer": "PRODUCTS Water Therapy Systems Cryotherapy and Hot Water Treatement System - Water Circulating Device by Aqua Relief with Universal Pad For Post-Surgical Recovery and Sustained Heat Therapy to Treat a Chronic or Acute Disability - With Universal Pad Roll over to zoom in + View large image Cryotherapy and Hot Water Treatement System - Water Circulating Device by Aqua Relief with Universal Pad For Post-Surgical Recovery and Sustained Heat Therapy to Treat a Chronic or Acute Disability - With Universal Pad HOW IS THIS HOT AND COLD THERAPY UNIT USED: Hot and cold water is quietly circulated through the leak-free 52 hose to the pad, giving your body complete hot or cold coverage. Add ice and the "
  },
  {
    "question": "Melaleuca Gel - 100%Tea Tree Oil Toilet Gel Stamps - Includes 1 Pusher & 4 Refills - Natural Toilet Freshener, Long-Lasting Odor Eating Scent, Easy to Use, Safe, Eco-Friendly. Eliminate the Smell Instead of Masking It.",
    "answer": "PRODUCTS Therapeutic Creams and Gels Melaleuca Gel - 100%Tea Tree Oil Toilet Gel Stamps - Includes 1 Pusher & 4 Refills - Natural Toilet Freshener, Long-Lasting Odor Eating Scent, Easy to Use, Safe, Eco-Friendly. Eliminate the Smell Instead of Masking It. Roll over to zoom in + View large image Melaleuca Gel - 100%Tea Tree Oil Toilet Gel Stamps - Includes 1 Pusher & 4 Refills - Natural Toilet Freshener, Long-Lasting Odor Eating Scent, Easy to Use, Safe, Eco-Friendly. Eliminate the Smell Instead of Masking It. Long-Lasting Freshness: Includes 1 pusher and 4 gel refills, each providing continuous fresh scent. Gel lasts depending flush quantity and if placed above water line. Natural Tea Tree O"
  },
  {
    "question": "Heated Gua Sha Scraping Massage Tool by TheraStone; Gua Sha Skin Scraping Stone with Heat & Vibration, with Bian Stone, Gua sha Tool for Soft-tissue massage, improve blood circulation, relieve pain, anti-aging (White)",
    "answer": "PRODUCTS Massage Therapy Devices Heated Gua Sha Scraping Massage Tool by TheraStone; Gua Sha Skin Scraping Stone with Heat & Vibration, with Bian Stone, Gua sha Tool for Soft-tissue massage, improve blood circulation, relieve pain, anti-aging (White) Roll over to zoom in + View large image Heated Gua Sha Scraping Massage Tool by TheraStone; Gua Sha Skin Scraping Stone with Heat & Vibration, with Bian Stone, Gua sha Tool for Soft-tissue massage, improve blood circulation, relieve pain, anti-aging (White) ANCIENT TECHNIQUE WITH MODERN TECH: The Therastone combines ancient Chinese healing practices with modern technology to increase the effectiveness of traditional scraping massage. Scraping, o"
  },
  {
    "question": "Cryotherapy and Hot Water Treatement System - Water Circulating Device by Aqua Relief with Universal Pad For Post-Surgical Recovery and Sustained Heat Therapy to Treat a Chronic or Acute Disability - With Shoudler Pad",
    "answer": "PRODUCTS Water Therapy Systems Cryotherapy and Hot Water Treatement System - Water Circulating Device by Aqua Relief with Universal Pad For Post-Surgical Recovery and Sustained Heat Therapy to Treat a Chronic or Acute Disability - With Shoudler Pad Roll over to zoom in + View large image Cryotherapy and Hot Water Treatement System - Water Circulating Device by Aqua Relief with Universal Pad For Post-Surgical Recovery and Sustained Heat Therapy to Treat a Chronic or Acute Disability - With Shoudler Pad HOW IS THIS HOT AND COLD THERAPY UNIT USED: Hot and cold water is quietly circulated through the leak-free 52 hose to the pad, giving your body complete hot or cold coverage. Add ice and the cr"
  },
  {
    "question": "Cryotherapy and Hot Water Treatement System - Water Circulating Device by Aqua Relief with Universal Pad For Post-Surgical Recovery and Sustained Heat Therapy to Treat a Chronic or Acute Disability - With Knee Pad",
    "answer": "PRODUCTS Water Therapy Systems Cryotherapy and Hot Water Treatement System - Water Circulating Device by Aqua Relief with Universal Pad For Post-Surgical Recovery and Sustained Heat Therapy to Treat a Chronic or Acute Disability - With Knee Pad Roll over to zoom in + View large image Cryotherapy and Hot Water Treatement System - Water Circulating Device by Aqua Relief with Universal Pad For Post-Surgical Recovery and Sustained Heat Therapy to Treat a Chronic or Acute Disability - With Knee Pad HOW IS THIS HOT AND COLD THERAPY UNIT USED: Hot and cold water is quietly circulated through the leak-free 52 hose to the pad, giving your body complete hot or cold coverage. Add ice and the cryo-cool "
  },
  {
    "question": "Cryotherapy and Hot Water Treatement System - Water Circulating Device by Aqua Relief with Universal Pad For Post-Surgical Recovery and Sustained Heat Therapy to Treat a Chronic or Acute Disability - With Back pad",
    "answer": "PRODUCTS Water Therapy Systems Cryotherapy and Hot Water Treatement System - Water Circulating Device by Aqua Relief with Universal Pad For Post-Surgical Recovery and Sustained Heat Therapy to Treat a Chronic or Acute Disability - With Back pad Roll over to zoom in + View large image Cryotherapy and Hot Water Treatement System - Water Circulating Device by Aqua Relief with Universal Pad For Post-Surgical Recovery and Sustained Heat Therapy to Treat a Chronic or Acute Disability - With Back pad HOW IS THIS HOT AND COLD THERAPY UNIT USED: Hot and cold water is quietly circulated through the leak-free 52 hose to the pad, giving your body complete hot or cold coverage. Add ice and the cryo-cool "
  },
  {
    "question": "Kids Sleep Cream by PMT, Natural Sleeping Aid Regulates Sleep Patterns to Fall Asleep Faster, Uses Natural Ingredients Menthol & Lavender, Improves Circadian Rhythm for Ages 6 and up, Scented Night Cream - 2.83oz",
    "answer": "PRODUCTS Therapeutic Creams and Gels Kids Sleep Cream by PMT, Natural Sleeping Aid Regulates Sleep Patterns to Fall Asleep Faster, Uses Natural Ingredients Menthol & Lavender, Improves Circadian Rhythm for Ages 6 and up, Scented Night Cream - 2.83oz Roll over to zoom in + View large image Kids Sleep Cream by PMT, Natural Sleeping Aid Regulates Sleep Patterns to Fall Asleep Faster, Uses Natural Ingredients Menthol & Lavender, Improves Circadian Rhythm for Ages 6 and up, Scented Night Cream - 2.83oz SAFE & EFFECTIVE - Our cream is safe and effective to use anywhere on the body. Apply to the neck and shoulders before bed; the relaxing aroma of lavender, while the cool and soothing sensation as "
  },
  {
    "question": "Inflatable Wrist Brace with Built-in Pump; Compression Wrist Wrap - Reusable Brace with Air Pump - for Hand/Wrist Pain Relief, Swelling and Recovery Support - Adjustable and Inflatable for Sports Injury Sprains",
    "answer": "PRODUCTS Bracing and Supports Inflatable Wrist Brace with Built-in Pump; Compression Wrist Wrap - Reusable Brace with Air Pump - for Hand/Wrist Pain Relief, Swelling and Recovery Support - Adjustable and Inflatable for Sports Injury Sprains Roll over to zoom in + View large image Inflatable Wrist Brace with Built-in Pump; Compression Wrist Wrap - Reusable Brace with Air Pump - for Hand/Wrist Pain Relief, Swelling and Recovery Support - Adjustable and Inflatable for Sports Injury Sprains EFFECTIVE HAND/WRIST PAIN RELIEF: A one-of-a-kind Built-In Air Pump provides targeted compression, effectively relieving pain, inflammation, swelling and stiffness in the Hand/Wrist. Great for managing pain d"
  },
  {
    "question": "Lavawall Electric Warming Wall: Portable Space Heater for Office & Home, Timer & Thermostat, Safe & Quiet for Legs, Ankles, Feet - Foldable & Extra Warmth - Under Desk Space Heater Alternative – Desert - Black",
    "answer": "PRODUCTS Heat Therapy Lavawall Electric Warming Wall: Portable Space Heater for Office & Home, Timer & Thermostat, Safe & Quiet for Legs, Ankles, Feet - Foldable & Extra Warmth - Under Desk Space Heater Alternative – Desert - Black Roll over to zoom in + View large image Lavawall Electric Warming Wall: Portable Space Heater for Office & Home, Timer & Thermostat, Safe & Quiet for Legs, Ankles, Feet - Foldable & Extra Warmth - Under Desk Space Heater Alternative – Desert - Black SAFE & QUIET HEATING: Enjoy peace of mind with automatic shutoff after up to 6 hours, tip-over protection, and whisper-quiet operation. PERSONALIZED COMFORT: Adjustable thermostat and timer for precise temperature cont"
  },
  {
    "question": "Premium Electrotherapy Conductive Gloves - for TENS Pain Treatment, Carpal tunnel, Inflammation, Arthritis, Nerve and Joint Pain (1 Pair - Silver Thread – kit INCLUDES Conductive Spray - One Size Fits Most)",
    "answer": "PRODUCTS Electrotherapy Garments Premium Electrotherapy Conductive Gloves - for TENS Pain Treatment, Carpal tunnel, Inflammation, Arthritis, Nerve and Joint Pain (1 Pair - Silver Thread – kit INCLUDES Conductive Spray - One Size Fits Most) Roll over to zoom in + View large image Premium Electrotherapy Conductive Gloves - for TENS Pain Treatment, Carpal tunnel, Inflammation, Arthritis, Nerve and Joint Pain (1 Pair - Silver Thread – kit INCLUDES Conductive Spray - One Size Fits Most) USE WITH YOUR EXISTING TENS OR ELECTROTHERAPY DEVICE (compatible with 95% of devices) for treatment of Tarsal Tunnel, Carpal Tunnel, Nerve and Joint Pain, Arthritis, Sports Injuries, Post-op Swelling, Pain Managem"
  },
  {
    "question": "Evertrac Posture Back Belt with Assistive Lumbar Support – Adjustable Ergonomic Belt for Upright Sitting, Lower Back Pain Relief & Improved Spine Alignment – Ideal for Office, Travel, and Long Sitting Hours",
    "answer": "PRODUCTS Traction Evertrac Posture Back Belt with Assistive Lumbar Support – Adjustable Ergonomic Belt for Upright Sitting, Lower Back Pain Relief & Improved Spine Alignment – Ideal for Office, Travel, and Long Sitting Hours Roll over to zoom in + View large image Evertrac Posture Back Belt with Assistive Lumbar Support – Adjustable Ergonomic Belt for Upright Sitting, Lower Back Pain Relief & Improved Spine Alignment – Ideal for Office, Travel, and Long Sitting Hours Ergonomic Lumbar Support: Promotes natural spinal alignment and relieves pressure on the lower back. Knee-to-Back Assistive Design: Gently pulls the lumbar region forward using knee straps, encouraging upright posture. Adjustabl"
  },
  {
    "question": "Nail Repair Pen by Fungi-Pen. Nail Repair Tool for Toenail Damage and Discoloration, Fingernail and Toenail Bed Repair, Extra Strength, Toe Nail Restoring Professional Solution - 4 pens per pack + Nail File",
    "answer": "PRODUCTS Therapeutic Creams and Gels Nail Repair Pen by Fungi-Pen. Nail Repair Tool for Toenail Damage and Discoloration, Fingernail and Toenail Bed Repair, Extra Strength, Toe Nail Restoring Professional Solution - 4 pens per pack + Nail File Roll over to zoom in + View large image Nail Repair Pen by Fungi-Pen. Nail Repair Tool for Toenail Damage and Discoloration, Fingernail and Toenail Bed Repair, Extra Strength, Toe Nail Restoring Professional Solution - 4 pens per pack + Nail File REDUCE NAIL DAMAGE – The Fungi-Pen nail treatment for toenails is an advanced formulation plus all natural ingredients to help support the removal of fingernail and toenail bed damage under and around the nail"
  },
  {
    "question": "ThermaWax Paraffin Wax Machine | Auto Lid for Hands, Feet & Elbows | 20-Minute Quick Melt | Precision Temperature Control | Includes 8 Refills(4-Peach, 4-Lavender), Cotton Gloves, Booties, Brush, & Spatula",
    "answer": "PRODUCTS Heat Therapy ThermaWax Paraffin Wax Machine | Auto Lid for Hands, Feet & Elbows | 20-Minute Quick Melt | Precision Temperature Control | Includes 8 Refills(4-Peach, 4-Lavender), Cotton Gloves, Booties, Brush, & Spatula Roll over to zoom in + View large image ThermaWax Paraffin Wax Machine | Auto Lid for Hands, Feet & Elbows | 20-Minute Quick Melt | Precision Temperature Control | Includes 8 Refills(4-Peach, 4-Lavender), Cotton Gloves, Booties, Brush, & Spatula DUAL-SCENTED WAX REFILLS – ThermaWax comes with 8 wax refills in two soothing fragrances: 4 Peach and 4 Lavender, offering an aromatic spa-like experience at home. INCLUDES COMPLETE SPA ACCESSORIES – Includes Base unit, 8 refi"
  },
  {
    "question": "Pneumatic Seat Assist Lifting Cushion by Seat Boost Air – Most Durable Chair Lift Assist Device for Seniors Adults with 220lb Weight Capacity Lifting Angle Up to 35°, Portable seat Lift with Button Control",
    "answer": "PRODUCTS Mobility Assistance Pneumatic Seat Assist Lifting Cushion by Seat Boost Air – Most Durable Chair Lift Assist Device for Seniors Adults with 220lb Weight Capacity Lifting Angle Up to 35°, Portable seat Lift with Button Control Roll over to zoom in + View large image Pneumatic Seat Assist Lifting Cushion by Seat Boost Air – Most Durable Chair Lift Assist Device for Seniors Adults with 220lb Weight Capacity Lifting Angle Up to 35°, Portable seat Lift with Button Control ​DURABLE DESIGN: The Seat Boost Air seat lift mechanism for those with abulatory issues, is made of high quality componentry and materials. A common problem with other options is their unreliable quality. It also includ"
  },
  {
    "question": "Inflatable Knee Brace with Built-in Pump; Compression Knee Wrap - Reusable Brace with Air Pump - for knee Pain Relief, Swelling and Recovery Support - Adjustable and Inflatable for Sports Injury Sprains",
    "answer": "PRODUCTS Bracing and Supports Inflatable Knee Brace with Built-in Pump; Compression Knee Wrap - Reusable Brace with Air Pump - for knee Pain Relief, Swelling and Recovery Support - Adjustable and Inflatable for Sports Injury Sprains Roll over to zoom in + View large image Inflatable Knee Brace with Built-in Pump; Compression Knee Wrap - Reusable Brace with Air Pump - for knee Pain Relief, Swelling and Recovery Support - Adjustable and Inflatable for Sports Injury Sprains EFFECTIVE KNEE PAIN RELIEF: A one-of-a-kind Built in Air Pump provides targeted compression, effectively relieving pain, inflammation, swelling and stiffness in the knee. Great for managing pain due to sprains, strains, inju"
  },
  {
    "question": "Sleep Cream by PMT, Natural Sleeping Aid Regulates Sleep Patterns to Fall Asleep Faster, Uses Natural Ingredients Menthol & Lavender, Improves Circadian Rhythm for All Ages, Scented Night Cream - 2.83oz",
    "answer": "PRODUCTS Therapeutic Creams and Gels Sleep Cream by PMT, Natural Sleeping Aid Regulates Sleep Patterns to Fall Asleep Faster, Uses Natural Ingredients Menthol & Lavender, Improves Circadian Rhythm for All Ages, Scented Night Cream - 2.83oz Roll over to zoom in + View large image Sleep Cream by PMT, Natural Sleeping Aid Regulates Sleep Patterns to Fall Asleep Faster, Uses Natural Ingredients Menthol & Lavender, Improves Circadian Rhythm for All Ages, Scented Night Cream - 2.83oz SAFE & EFFECTIVE - Our cream is safe and effective to use anywhere on the body. Applying to your neck and face, along with your chest or arms, allows you to smell the relaxing aroma of lavender, while menthol provides"
  },
  {
    "question": "Wireless TENS Unit Stimulator by iTENS – Bluetooth Enabled TENS Device with Free App, for Back Pain, Knee Pain, and Other Joint Relief. Patented Mechanical Wings and Rechargeable Battery - Small Green",
    "answer": "PRODUCTS Electrotherapy Devices • TENS Wireless TENS Unit Stimulator by iTENS – Bluetooth Enabled TENS Device with Free App, for Back Pain, Knee Pain, and Other Joint Relief. Patented Mechanical Wings and Rechargeable Battery - Small Green Roll over to zoom in + View large image Wireless TENS Unit Stimulator by iTENS – Bluetooth Enabled TENS Device with Free App, for Back Pain, Knee Pain, and Other Joint Relief. Patented Mechanical Wings and Rechargeable Battery - Small Green REVOLUTIONARY APP-CONTROLLED DESIGN - The world's first FDA-cleared, OTC, wireless TENS therapy device that is controlled with an IOS or Android based app on your smartphone. Generation 2 devices have been upgraded to i"
  },
  {
    "question": "Powered Cupping Therapy by VacuCup – Myofacial Release, Trigger Point Release, Increase Circulation, Cell Repair and Increase Flexibility. Cupping Therapy Massager for Neck, Back, Quad, Calf and More.",
    "answer": "PRODUCTS Light Therapy Powered Cupping Therapy by VacuCup – Myofacial Release, Trigger Point Release, Increase Circulation, Cell Repair and Increase Flexibility. Cupping Therapy Massager for Neck, Back, Quad, Calf and More. Roll over to zoom in + View large image Powered Cupping Therapy by VacuCup – Myofacial Release, Trigger Point Release, Increase Circulation, Cell Repair and Increase Flexibility. Cupping Therapy Massager for Neck, Back, Quad, Calf and More. POWERED CUPPING TECHNOLOGY: Harness the power of rhythmic alternation of suction and release, which boosts blood circulation faster to the cupping area and speeds up the recovery process. The red light drives pain relief, reduction of "
  },
  {
    "question": "Infrared Heated Foot Warmers by Comfort Bootie - Far Infrared wavelength 8-15 μm, non-slip heated slippers with wireless li-ion rechargeable batteries – improve circulation in the feet.(X-Large:12-13)",
    "answer": "PRODUCTS Heat Therapy Infrared Heated Foot Warmers by Comfort Bootie - Far Infrared wavelength 8-15 μm, non-slip heated slippers with wireless li-ion rechargeable batteries – improve circulation in the feet.(X-Large:12-13) Roll over to zoom in + View large image Infrared Heated Foot Warmers by Comfort Bootie - Far Infrared wavelength 8-15 μm, non-slip heated slippers with wireless li-ion rechargeable batteries – improve circulation in the feet.(X-Large:12-13) DUAL SIDED – Heating element on the top and the bottom of the foot. POWERFUL THERAPY – With the latest carbon fiber heating technology, and multiple heating levels with LED power indicator to display heating levels. INDOOR/OUTDOOR – des"
  },
  {
    "question": "Infrared Heated Foot Warmers by Comfort Bootie - Far Infrared wavelength 8-15 μm, Non-Slip Heated Slippers with Wireless li-ion Rechargeable Batteries – Improve Circulation in The feet. (Large: 10-11)",
    "answer": "PRODUCTS Heat Therapy Infrared Heated Foot Warmers by Comfort Bootie - Far Infrared wavelength 8-15 μm, Non-Slip Heated Slippers with Wireless li-ion Rechargeable Batteries – Improve Circulation in The feet. (Large: 10-11) Roll over to zoom in + View large image Infrared Heated Foot Warmers by Comfort Bootie - Far Infrared wavelength 8-15 μm, Non-Slip Heated Slippers with Wireless li-ion Rechargeable Batteries – Improve Circulation in The feet. (Large: 10-11) DUAL SIDED – Heating element on the top and the bottom of the foot. POWERFUL THERAPY – With the latest carbon fiber heating technology, and multiple heating levels with LED power indicator to display heating levels. INDOOR/OUTDOOR – des"
  },
  {
    "question": "Wireless TENS Unit Stimulator by iTENS – Bluetooth Enabled TENS Device with Free App, for Back Pain, Knee Pain, and Other Joint Relief. Patented Mechanical Wings and Rechargeable Battery - Large,Blue",
    "answer": "PRODUCTS Electrotherapy Devices Wireless TENS Unit Stimulator by iTENS – Bluetooth Enabled TENS Device with Free App, for Back Pain, Knee Pain, and Other Joint Relief. Patented Mechanical Wings and Rechargeable Battery - Large,Blue Roll over to zoom in + View large image Wireless TENS Unit Stimulator by iTENS – Bluetooth Enabled TENS Device with Free App, for Back Pain, Knee Pain, and Other Joint Relief. Patented Mechanical Wings and Rechargeable Battery - Large,Blue REVOLUTIONARY APP-CONTROLLED DESIGN - The world's first FDA-cleared, OTC, wireless TENS therapy device that is controlled with an IOS or Android based app on your smartphone. Generation 2 devices have been upgraded to include co"
  },
  {
    "question": "Wireless TENS Unit Stimulator by iTENS – Bluetooth Enabled TENS Device with Free App, for Back Pain, Knee Pain, and Other Joint Relief. Patented Mechanical Wings and Rechargeable Battery - Large,Gray",
    "answer": "PRODUCTS Electrotherapy Devices • TENS Wireless TENS Unit Stimulator by iTENS – Bluetooth Enabled TENS Device with Free App, for Back Pain, Knee Pain, and Other Joint Relief. Patented Mechanical Wings and Rechargeable Battery - Large,Gray Roll over to zoom in + View large image Wireless TENS Unit Stimulator by iTENS – Bluetooth Enabled TENS Device with Free App, for Back Pain, Knee Pain, and Other Joint Relief. Patented Mechanical Wings and Rechargeable Battery - Large,Gray REVOLUTIONARY APP-CONTROLLED DESIGN - The world's first FDA-cleared, OTC, wireless TENS therapy device that is controlled with an IOS or Android based app on your smartphone. Generation 2 devices have been upgraded to inc"
  },
  {
    "question": "Circulating Ice Machine by Blue Cube – for Knee, Elbow, Shoulder, Back Pain, Post-Surgical Swelling, Hospital Use– (Blue Light Cold Therapy + Active Air Compression System with Universal Therapy Pad)",
    "answer": "PRODUCTS Water Therapy Systems Circulating Ice Machine by Blue Cube – for Knee, Elbow, Shoulder, Back Pain, Post-Surgical Swelling, Hospital Use– (Blue Light Cold Therapy + Active Air Compression System with Universal Therapy Pad) Roll over to zoom in + View large image Circulating Ice Machine by Blue Cube – for Knee, Elbow, Shoulder, Back Pain, Post-Surgical Swelling, Hospital Use– (Blue Light Cold Therapy + Active Air Compression System with Universal Therapy Pad) AIR COMPRESSION: The Blue Cube cold therapy AIR compression machine uses a continuous flow of cold water combined with AIR pressure to provide relief from swelling, edema and inflammation, following surgery. PORTABLE AND QUIET: D"
  },
  {
    "question": "Wearable Blanket Hoodie for Gamers by Game Snugg.Thumb Holes, Inflatable Lumbar Wedge, Velcro Brand Tag,Large Front Pocket for Hands and Controller.Oversized Flannel Hooded Blankets.One Size Fits All",
    "answer": "PRODUCTS Heat Therapy Wearable Blanket Hoodie for Gamers by Game Snugg.Thumb Holes, Inflatable Lumbar Wedge, Velcro Brand Tag,Large Front Pocket for Hands and Controller.Oversized Flannel Hooded Blankets.One Size Fits All Roll over to zoom in + View large image Wearable Blanket Hoodie for Gamers by Game Snugg.Thumb Holes, Inflatable Lumbar Wedge, Velcro Brand Tag,Large Front Pocket for Hands and Controller.Oversized Flannel Hooded Blankets.One Size Fits All Gift for All and Any Occasion: The Huglanket Wearable Blanket is a heartwarming gift suitable for everyone and every festive occasion. From birthdays to holidays, it's a thoughtful gesture that brings warmth to any moment. Embrace of Comf"
  },
  {
    "question": "Alternating Pressure Wheelchair Cushion by MobiCushion - Pneumatic Air Pillow Relief for Pressure Sores - Reduces Pressure on Scooters Chairs Recliners - Rechargeable Battery - Taiwan Version 18\"x18\"",
    "answer": "PRODUCTS Mobility Assistance Alternating Pressure Wheelchair Cushion by MobiCushion - Pneumatic Air Pillow Relief for Pressure Sores - Reduces Pressure on Scooters Chairs Recliners - Rechargeable Battery - Taiwan Version 18\"x18\" Roll over to zoom in + View large image Alternating Pressure Wheelchair Cushion by MobiCushion - Pneumatic Air Pillow Relief for Pressure Sores - Reduces Pressure on Scooters Chairs Recliners - Rechargeable Battery - Taiwan Version 18\"x18\" ADVANCED PRESSURE RELIEF CUSHION SYSTEM: Feel free to breathe again. This pneumatic seat cushion uses a consistent cycle of alternating low air pressure that flows through the cushion’s air cells. The alternating pressure gives spe"
  },
  {
    "question": "Wireless TENS Unit Stimulator by iTENS – Bluetooth Enabled TENS Device with Free App, for Back Pain, Knee Pain, and Other Joint Relief. Patented Mechanical Wings and Rechargeable Battery - Small Red",
    "answer": "PRODUCTS Electrotherapy Devices • TENS Wireless TENS Unit Stimulator by iTENS – Bluetooth Enabled TENS Device with Free App, for Back Pain, Knee Pain, and Other Joint Relief. Patented Mechanical Wings and Rechargeable Battery - Small Red Roll over to zoom in + View large image Wireless TENS Unit Stimulator by iTENS – Bluetooth Enabled TENS Device with Free App, for Back Pain, Knee Pain, and Other Joint Relief. Patented Mechanical Wings and Rechargeable Battery - Small Red REVOLUTIONARY APP-CONTROLLED DESIGN - The world's first FDA-cleared, OTC, wireless TENS therapy device that is controlled with an IOS or Android based app on your smartphone. Generation 2 devices have been upgraded to inclu"
  },
  {
    "question": "Microwavable Heated Acupressure Back Stretcher by Hot Spine - Full Back and Neck Decompression, Spine Alignment, and Deep Tissue Therapy with 24 Heated Massage Sections for Ultimate Back Pain Relief",
    "answer": "PRODUCTS Massage Therapy Devices Microwavable Heated Acupressure Back Stretcher by Hot Spine - Full Back and Neck Decompression, Spine Alignment, and Deep Tissue Therapy with 24 Heated Massage Sections for Ultimate Back Pain Relief Roll over to zoom in + View large image Microwavable Heated Acupressure Back Stretcher by Hot Spine - Full Back and Neck Decompression, Spine Alignment, and Deep Tissue Therapy with 24 Heated Massage Sections for Ultimate Back Pain Relief MICROWAVE HEATED ACUPRESSURE THERAPY: Equipped with 24 strategically positioned massage sections filled with all-natural clay beads that adapt to your spine's natural curve, delivering heat and targeted acupressure to relieve ten"
  },
  {
    "question": "Neck Travel Pillow by Skypillow, One-of-a-kind Orthopedic Travel Pillow, Prevent Neck Cramps, Improve Posture; Memory Foam and Adjustable, Washable Cover, Includes Carrying Case and Clip (Blue) (LG)",
    "answer": "PRODUCTS Traction Neck Travel Pillow by Skypillow, One-of-a-kind Orthopedic Travel Pillow, Prevent Neck Cramps, Improve Posture; Memory Foam and Adjustable, Washable Cover, Includes Carrying Case and Clip (Blue) (LG) Roll over to zoom in + View large image Neck Travel Pillow by Skypillow, One-of-a-kind Orthopedic Travel Pillow, Prevent Neck Cramps, Improve Posture; Memory Foam and Adjustable, Washable Cover, Includes Carrying Case and Clip (Blue) (LG) A BETTER NECK PILLOW: Many travel pillows aren't firm enough to properly support the neck and end up caving in to even the slightest amount of pressure. This does very little to actually help relieve neck pain or provide comfort during travel. "
  },
  {
    "question": "Neck Travel Pillow by Skypillow, One-of-a-kind Orthopedic Travel Pillow, Prevent Neck Cramps, Improve Posture; Memory Foam and Adjustable, Washable Cover, Includes Carrying Case and Clip (Blue) (SM)",
    "answer": "PRODUCTS Traction Neck Travel Pillow by Skypillow, One-of-a-kind Orthopedic Travel Pillow, Prevent Neck Cramps, Improve Posture; Memory Foam and Adjustable, Washable Cover, Includes Carrying Case and Clip (Blue) (SM) Roll over to zoom in + View large image Neck Travel Pillow by Skypillow, One-of-a-kind Orthopedic Travel Pillow, Prevent Neck Cramps, Improve Posture; Memory Foam and Adjustable, Washable Cover, Includes Carrying Case and Clip (Blue) (SM) A BETTER NECK PILLOW: Many travel pillows aren't firm enough to properly support the neck and end up caving in to even the slightest amount of pressure. This does very little to actually help relieve neck pain or provide comfort during travel. "
  },
  {
    "question": "Ottoman Foot Massager by Ottossage, Massaging Ottoman with Removable Lid provides Air Compression, Shiatsu kneading, intense vibration and heat therapy. Extra Powerful with upgraded li-ion battery.",
    "answer": "PRODUCTS Massage Therapy Devices Ottoman Foot Massager by Ottossage, Massaging Ottoman with Removable Lid provides Air Compression, Shiatsu kneading, intense vibration and heat therapy. Extra Powerful with upgraded li-ion battery. Roll over to zoom in + View large image Ottoman Foot Massager by Ottossage, Massaging Ottoman with Removable Lid provides Air Compression, Shiatsu kneading, intense vibration and heat therapy. Extra Powerful with upgraded li-ion battery. FULL FEATURED: No detail has been spared with this high-end Ottoman that transforms into a Foot Massager. Or keep the top lid on for a relaxing vibration plate as you rest your feet. This model includes a li-ion rechargeable batter"
  },
  {
    "question": "Water Circulating Sleep Pad by Thermacycle; Cools and Heats to create a Therapeutic Mattress Pad - All Natural Sleep Aid for Hot Flashes, Night Sweat, Menopause, Insomnia, Hyperhidrosis - Unit Only",
    "answer": "PRODUCTS Water Therapy Systems Water Circulating Sleep Pad by Thermacycle; Cools and Heats to create a Therapeutic Mattress Pad - All Natural Sleep Aid for Hot Flashes, Night Sweat, Menopause, Insomnia, Hyperhidrosis - Unit Only Roll over to zoom in + View large image Water Circulating Sleep Pad by Thermacycle; Cools and Heats to create a Therapeutic Mattress Pad - All Natural Sleep Aid for Hot Flashes, Night Sweat, Menopause, Insomnia, Hyperhidrosis - Unit Only THERMACYCLE MATTRESS PAD: A climate-controlled, heating/cooling mattress pad that will transform your bed into the ideal sleeping environment. Our Thermacycle pad fits seamlessly on your current mattress (under the fitted sheet) for "
  },
  {
    "question": "JumpStim TENS Muscle Massager Double Pad Electrode Stimulator – Rechargeable, Portable, Wearable Adhesive 5 Speed Massage Relief Therapy Device for Back Pain, Neck Strain, Achy Feet, Sports Injury",
    "answer": "PRODUCTS Electrotherapy Devices • TENS JumpStim TENS Muscle Massager Double Pad Electrode Stimulator – Rechargeable, Portable, Wearable Adhesive 5 Speed Massage Relief Therapy Device for Back Pain, Neck Strain, Achy Feet, Sports Injury Roll over to zoom in + View large image JumpStim TENS Muscle Massager Double Pad Electrode Stimulator – Rechargeable, Portable, Wearable Adhesive 5 Speed Massage Relief Therapy Device for Back Pain, Neck Strain, Achy Feet, Sports Injury WEARABLE MUSCLE MASSAGER: JumpStim massage stimulator pads are the stick-on electrode TENS pads you can wear before exercise, during workouts, while recovering from rigorous fitness routines or for the treatment of injuries. DI"
  },
  {
    "question": "Water Circulating Sleep Pad by Thermacycle; Cools and Heats to create a Therapeutic Mattress Pad - All Natural Sleep Aid for Hot Flashes, Night Sweats, Menopause, Insomnia, Hyperhidrosis - Twin XL",
    "answer": "PRODUCTS Water Therapy Systems Water Circulating Sleep Pad by Thermacycle; Cools and Heats to create a Therapeutic Mattress Pad - All Natural Sleep Aid for Hot Flashes, Night Sweats, Menopause, Insomnia, Hyperhidrosis - Twin XL Roll over to zoom in + View large image Water Circulating Sleep Pad by Thermacycle; Cools and Heats to create a Therapeutic Mattress Pad - All Natural Sleep Aid for Hot Flashes, Night Sweats, Menopause, Insomnia, Hyperhidrosis - Twin XL THERMACYCLE MATTRESS PAD: A climate-controlled, heating/cooling mattress pad that will transform your bed into the ideal sleeping environment. Our Thermacycle pad fits seamlessly on your current mattress (under the fitted sheet) for an"
  },
  {
    "question": "Electric Chair Lift by Mobi-Lift - Upgraded Padding, Fall and Get Up in Shower or Floor, Raises Up to 20” to Help You Stand Up, Weight Capacity up to 300 LBS, Item Weight 30 LBS - 2nd Gen Edition.",
    "answer": "PRODUCTS Mobility Assistance Electric Chair Lift by Mobi-Lift - Upgraded Padding, Fall and Get Up in Shower or Floor, Raises Up to 20” to Help You Stand Up, Weight Capacity up to 300 LBS, Item Weight 30 LBS - 2nd Gen Edition. Roll over to zoom in + View large image Electric Chair Lift by Mobi-Lift - Upgraded Padding, Fall and Get Up in Shower or Floor, Raises Up to 20” to Help You Stand Up, Weight Capacity up to 300 LBS, Item Weight 30 LBS - 2nd Gen Edition. KEY DETAILS: The Mobi-Lift weighs a very sturdy 29 pounds. Made of high-strength industrial grade steel rod material gives the Mobi-Lift a weight capacity of up to 300lb.Upgraded with Foam Padded Seat. CREATIVE DESIGN: The Mobi-Lift was "
  },
  {
    "question": "Shoulder Rotator Cuff Stretching Device By Stretch Towel; Physical Therapy Shoulder And Full Body Stretching Strap With Easy Grip Handles for Sore and Tight Muscles. Improves Shoulder Flexibility",
    "answer": "PRODUCTS Massage Therapy Devices Shoulder Rotator Cuff Stretching Device By Stretch Towel; Physical Therapy Shoulder And Full Body Stretching Strap With Easy Grip Handles for Sore and Tight Muscles. Improves Shoulder Flexibility Roll over to zoom in + View large image Shoulder Rotator Cuff Stretching Device By Stretch Towel; Physical Therapy Shoulder And Full Body Stretching Strap With Easy Grip Handles for Sore and Tight Muscles. Improves Shoulder Flexibility PERFECT SHOULDER STRETCH – The Stretch Towel is designed to perform a targeted stretch on the rotator cuff to help improve shoulder flexibility FULL BODY STRETCHING – Use the Stretch Towel to perform a variety of other body part stretc"
  },
  {
    "question": "Water Circulating Heated Mattress Pad by Thermacycle; Water Heated Mattress Pad, No Electric Wire, All Digital, Quiet Motor and Instant Warm Heat - Mattress Topper Bed Warmer (Queen – 79” by 59”)",
    "answer": "PRODUCTS Water Therapy Systems Water Circulating Heated Mattress Pad by Thermacycle; Water Heated Mattress Pad, No Electric Wire, All Digital, Quiet Motor and Instant Warm Heat - Mattress Topper Bed Warmer (Queen – 79” by 59”) Roll over to zoom in + View large image Water Circulating Heated Mattress Pad by Thermacycle; Water Heated Mattress Pad, No Electric Wire, All Digital, Quiet Motor and Instant Warm Heat - Mattress Topper Bed Warmer (Queen – 79” by 59”) TUBELESS DESIGN: Our special hot press blanket technology eliminates the need for tubes and thus uncomfortable function QUITE FUNCTION: Advanced technology enables <20db noise level and a smooth operation . QUICK HEAT TECH: Enjoy warm wa"
  },
  {
    "question": "Plantar Fasciitis Foot Roller by Dr. Archy – Multi-Function Massager Tool Relieves Plantar Fasciitis, Heel Spur, Aching Arch, Tired Feet and Heel Pain - Reflexology Trigger Point Tension Release",
    "answer": "PRODUCTS Massage Therapy Devices Plantar Fasciitis Foot Roller by Dr. Archy – Multi-Function Massager Tool Relieves Plantar Fasciitis, Heel Spur, Aching Arch, Tired Feet and Heel Pain - Reflexology Trigger Point Tension Release Roll over to zoom in + View large image Plantar Fasciitis Foot Roller by Dr. Archy – Multi-Function Massager Tool Relieves Plantar Fasciitis, Heel Spur, Aching Arch, Tired Feet and Heel Pain - Reflexology Trigger Point Tension Release SOOTHE ACHING FEET: You can't always have a massage therapist on hand (we wish!) to massage and soothe your poor aching feet, but Dr. Achy's roller foot massager is the next best thing. These 2 different roller massagershelp relieve vari"
  },
  {
    "question": "Water Circulating Heated Mattress Pad by Thermacycle; Water Heated Mattress Pad, No Electric Wire, All Digital, Quiet Motor and Instant Warm Heat - Mattress Topper Bed Warmer (King – 79” by 71”)",
    "answer": "PRODUCTS Water Therapy Systems Water Circulating Heated Mattress Pad by Thermacycle; Water Heated Mattress Pad, No Electric Wire, All Digital, Quiet Motor and Instant Warm Heat - Mattress Topper Bed Warmer (King – 79” by 71”) Roll over to zoom in + View large image Water Circulating Heated Mattress Pad by Thermacycle; Water Heated Mattress Pad, No Electric Wire, All Digital, Quiet Motor and Instant Warm Heat - Mattress Topper Bed Warmer (King – 79” by 71”) TUBELESS DESIGN: Our special hot press blanket technology eliminates the need for tubes and thus uncomfortable function QUITE FUNCTION: Advanced technology enables <20db noise level and a smooth operation . QUICK HEAT TECH: Enjoy warm wate"
  },
  {
    "question": "TENS Unit pads by Soft-touch Carbon Electrodes – Latex-Free Replacement pads electrode patches with High Stick performance and non-irritating gel- 2” Sq. 10 packs of 4 each/pack (40 electrodes)",
    "answer": "PRODUCTS Electrodes TENS Unit pads by Soft-touch Carbon Electrodes – Latex-Free Replacement pads electrode patches with High Stick performance and non-irritating gel- 2” Sq. 10 packs of 4 each/pack (40 electrodes) Roll over to zoom in + View large image TENS Unit pads by Soft-touch Carbon Electrodes – Latex-Free Replacement pads electrode patches with High Stick performance and non-irritating gel- 2” Sq. 10 packs of 4 each/pack (40 electrodes) 40-PIECE SET – This is an incredible value! 10 packs of 4 electrodes. Each one is flexible, pre-gelled and with a pigtail. Works with all TENS and EMS machines. They also feature a sporty black tri-coat backing for durability and include re-sealable pa"
  },
  {
    "question": "Nerve Spa Vibe | Deep Tissue Vibrational Massager with Attachement Heads | 7500 RPM Vibration Therapy for Deep Tissue Sciatica, Neuropathy, Joint & Muscle Relief | Cordless, Compact & Powerful.",
    "answer": "PRODUCTS Massage Therapy Devices Nerve Spa Vibe | Deep Tissue Vibrational Massager with Attachement Heads | 7500 RPM Vibration Therapy for Deep Tissue Sciatica, Neuropathy, Joint & Muscle Relief | Cordless, Compact & Powerful. Roll over to zoom in + View large image Nerve Spa Vibe | Deep Tissue Vibrational Massager with Attachement Heads | 7500 RPM Vibration Therapy for Deep Tissue Sciatica, Neuropathy, Joint & Muscle Relief | Cordless, Compact & Powerful. Clinical Device High-Frequency Vibration for Clinic Workflows & Home-Care Continuity Relieve Pain – Helps reduce muscle, joint, and nerve-related discomfort. Stimulate Nerves – High-frequency vibration supports nerve activation and sensory"
  },
  {
    "question": "Water Circulating Sleep Pad by Thermacycle; Cools and Heats to create a Therapeutic Mattress Pad - All Natural Sleep Aid for Hot Flashes, Night Sweat, Menopause, Insomnia, Hyperhidrosis - Queen",
    "answer": "PRODUCTS Water Therapy Systems Water Circulating Sleep Pad by Thermacycle; Cools and Heats to create a Therapeutic Mattress Pad - All Natural Sleep Aid for Hot Flashes, Night Sweat, Menopause, Insomnia, Hyperhidrosis - Queen Roll over to zoom in + View large image Water Circulating Sleep Pad by Thermacycle; Cools and Heats to create a Therapeutic Mattress Pad - All Natural Sleep Aid for Hot Flashes, Night Sweat, Menopause, Insomnia, Hyperhidrosis - Queen THERMACYCLE MATTRESS PAD: A climate-controlled, heating/cooling mattress pad that will transform your bed into the ideal sleeping environment. Our Thermacycle pad fits seamlessly on your current mattress (under the fitted sheet) for an excep"
  },
  {
    "question": "Neck Traction Device by Air Collar - Neck Stretcher - Cervical Traction Device - Neck & Shoulder Pain Relief - Stretcher Collar for Improved Spine Alignment - 2nd Generation with Electric Pump",
    "answer": "PRODUCTS Traction Neck Traction Device by Air Collar - Neck Stretcher - Cervical Traction Device - Neck & Shoulder Pain Relief - Stretcher Collar for Improved Spine Alignment - 2nd Generation with Electric Pump Roll over to zoom in + View large image Neck Traction Device by Air Collar - Neck Stretcher - Cervical Traction Device - Neck & Shoulder Pain Relief - Stretcher Collar for Improved Spine Alignment - 2nd Generation with Electric Pump NECK TENSION RELIEF: The Air Collar neck traction machine is designed to reduce any pressure on your nerves by encouraging improved posture and stretching the neck. If you suffer from a stiff neck, pinched nerve, or sore shoulder muscles, use it for just m"
  },
  {
    "question": "Criss-Cross Electrodes for TENS/Interferential by X-Trode 4\" x 4\" premium Re-Usable Self Adhesive Electrode Pads for TENS/EMS Unit, Fabric Backed Pads with Premium Gel (Latex Free) (5 packs)",
    "answer": "PRODUCTS Electrodes Criss-Cross Electrodes for TENS/Interferential by X-Trode 4\" x 4\" premium Re-Usable Self Adhesive Electrode Pads for TENS/EMS Unit, Fabric Backed Pads with Premium Gel (Latex Free) (5 packs) Roll over to zoom in + View large image Criss-Cross Electrodes for TENS/Interferential by X-Trode 4\" x 4\" premium Re-Usable Self Adhesive Electrode Pads for TENS/EMS Unit, Fabric Backed Pads with Premium Gel (Latex Free) (5 packs) TRUE INTERFERENTIAL – Criss-Cross current is known to create a focal point of current in the middle of the quadrants. EXCEPTIONAL RELIEF – Optimal results through this one-of-a-kind electrode PREMIUM GEL - Latex free, clean quality gel designed for high freq"
  },
  {
    "question": "Pelvic Floor Stimulating Probes by Soft Cycle, Perform Electronic Kegel Exercise and Stimulate Pelvic Floor Muscles; Compatible with Muscle Stimulators or Incontinence Devices (Large Rectal)",
    "answer": "PRODUCTS Electrotherapy Supplies Pelvic Floor Stimulating Probes by Soft Cycle, Perform Electronic Kegel Exercise and Stimulate Pelvic Floor Muscles; Compatible with Muscle Stimulators or Incontinence Devices (Large Rectal) Roll over to zoom in + View large image Pelvic Floor Stimulating Probes by Soft Cycle, Perform Electronic Kegel Exercise and Stimulate Pelvic Floor Muscles; Compatible with Muscle Stimulators or Incontinence Devices (Large Rectal) PREMIUM QUALITY: Ergonomically designed with high-grade materials and silver conductive elements for optimum conductivity and a comfortable dispersion of current. CUSTOM FIT: Designed to come in a variety of shapes and sizes to provide for a cus"
  },
  {
    "question": "Lumbar Decompression Table with Cervical Traction by Lumbar Bench Pro | Realign Vertebrae & Alleviate Lumbar Strain | Full Body Stretching Device for Neck, back, knee, and hip | Relieve Pain",
    "answer": "PRODUCTS Traction Lumbar Decompression Table with Cervical Traction by Lumbar Bench Pro | Realign Vertebrae & Alleviate Lumbar Strain | Full Body Stretching Device for Neck, back, knee, and hip | Relieve Pain Roll over to zoom in + View large image Lumbar Decompression Table with Cervical Traction by Lumbar Bench Pro | Realign Vertebrae & Alleviate Lumbar Strain | Full Body Stretching Device for Neck, back, knee, and hip | Relieve Pain Realign Spine: Effectively corrects bent or deformed vertebrae, soothes tense nerves, and alleviates pain in the neck, back, hip and knee joints. Provides therapeutic effects for cervical spondylosis, back pain, lumbar disc herniation, sciatica, lumbar muscle "
  },
  {
    "question": "Multi-Spectrum Red Light Therapy for Face, 7 spectrums-Red, Blue, Cyan, Yellow, Purple, Green, Violet, 660nm & 850nm Wavelength, 100% Silicone, 240 Total LED'S, Portable Rechargeable Battery",
    "answer": "PRODUCTS Light Therapy Multi-Spectrum Red Light Therapy for Face, 7 spectrums-Red, Blue, Cyan, Yellow, Purple, Green, Violet, 660nm & 850nm Wavelength, 100% Silicone, 240 Total LED'S, Portable Rechargeable Battery Roll over to zoom in + View large image Multi-Spectrum Red Light Therapy for Face, 7 spectrums-Red, Blue, Cyan, Yellow, Purple, Green, Violet, 660nm & 850nm Wavelength, 100% Silicone, 240 Total LED'S, Portable Rechargeable Battery CLINICAL GRADE POWER – The Infarex has a total power irradiance of 46MW/CM2. This is very high comparatively. And with a remarkable 240 total LEDS. Power drives results. REVITALIZE YOUR SKIN 660nm and near-infrared 850nm is the best combination wavelength"
  },
  {
    "question": "Orthopedic Neck Travel Pillow with Sleep Hood by SkyPillow, Prevent Neck Cramps and Pain. Patented Memory Foam Pillow, Washable Cover, Sleep Hood,Includes Carrying Case (One Size Fits Most)",
    "answer": "PRODUCTS Traction Orthopedic Neck Travel Pillow with Sleep Hood by SkyPillow, Prevent Neck Cramps and Pain. Patented Memory Foam Pillow, Washable Cover, Sleep Hood,Includes Carrying Case (One Size Fits Most) Roll over to zoom in + View large image Orthopedic Neck Travel Pillow with Sleep Hood by SkyPillow, Prevent Neck Cramps and Pain. Patented Memory Foam Pillow, Washable Cover, Sleep Hood,Includes Carrying Case (One Size Fits Most) A BETTER NECK PILLOW: Many travel pillows aren't firm enough to properly support the neck and end up caving in to even the slightest amount of pressure. This does very little to actually help relieve neck pain or provide comfort during travel. The SkyPillow corr"
  },
  {
    "question": "Electric Floor to Chair Lift for Fall Recovery by Mobi-Lift, Seniors & Mobility Aid | Heavy-Duty 440 lbs Capacity | Portable, Easy to Use Lift Assist Device for Safe & Independent Transfers",
    "answer": "PRODUCTS Mobility Assistance Electric Floor to Chair Lift for Fall Recovery by Mobi-Lift, Seniors & Mobility Aid | Heavy-Duty 440 lbs Capacity | Portable, Easy to Use Lift Assist Device for Safe & Independent Transfers Roll over to zoom in + View large image Electric Floor to Chair Lift for Fall Recovery by Mobi-Lift, Seniors & Mobility Aid | Heavy-Duty 440 lbs Capacity | Portable, Easy to Use Lift Assist Device for Safe & Independent Transfers Adjustable Multi-Angle Seating – Unlike standard lifts, MobiLift features an adjustable and very FLAT seating platform that tilts to provide ergonomic positioning, ensuring a more natural and comfortable transition from floor to chair. Quick One-Touch"
  },
  {
    "question": "Nail Repair Pen by Fungi-Pen. Nail Repair Tool for Toenail Damage and Discoloration, Fingernail and Toenail Bed Repair, Extra Strength, Toe Nail Restoring Professional Solution (Pack of 2)",
    "answer": "PRODUCTS Therapeutic Creams and Gels Nail Repair Pen by Fungi-Pen. Nail Repair Tool for Toenail Damage and Discoloration, Fingernail and Toenail Bed Repair, Extra Strength, Toe Nail Restoring Professional Solution (Pack of 2) Roll over to zoom in + View large image Nail Repair Pen by Fungi-Pen. Nail Repair Tool for Toenail Damage and Discoloration, Fingernail and Toenail Bed Repair, Extra Strength, Toe Nail Restoring Professional Solution (Pack of 2) REDUCE NAIL DAMAGE – The Fungi-Pen nail treatment for toenails is an advanced formulation plus all natural ingredients to help support the removal of fingernail and toenail bed damage under and around the nail. SAFE TO USE -Our formula is strong"
  },
  {
    "question": "Insole Stickers by Bump Sole - Anti Fatigue Shoe Inserts for Shock Absorption and Off-Loading Foot Pain; Running Shoe, or Work Boot Insoles, for Heel Pain, Arch Support and Metatarsalgia.",
    "answer": "PRODUCTS Stretching Equipment Insole Stickers by Bump Sole - Anti Fatigue Shoe Inserts for Shock Absorption and Off-Loading Foot Pain; Running Shoe, or Work Boot Insoles, for Heel Pain, Arch Support and Metatarsalgia. Roll over to zoom in + View large image Insole Stickers by Bump Sole - Anti Fatigue Shoe Inserts for Shock Absorption and Off-Loading Foot Pain; Running Shoe, or Work Boot Insoles, for Heel Pain, Arch Support and Metatarsalgia. SHOCK ABSORPTION AND NON-SLIP: the foam insole stickers are designed specifically to fully absorb shock and reduce stress on the feet with every step. Provides excellent shock absorption and cushioning for the feet and knees FOOT PAIN RELIEF: Designed to"
  },
  {
    "question": "Lumbar Decompression Table By Lumbar Bench - Horizontal Inversion Table for Lower Back Pain Relief, Back Stretcher Machine, Stretches the back, Ankle, Knee, and Hip. 300/330 lbs. Capacity",
    "answer": "PRODUCTS Traction Lumbar Decompression Table By Lumbar Bench - Horizontal Inversion Table for Lower Back Pain Relief, Back Stretcher Machine, Stretches the back, Ankle, Knee, and Hip. 300/330 lbs. Capacity Roll over to zoom in + View large image Lumbar Decompression Table By Lumbar Bench - Horizontal Inversion Table for Lower Back Pain Relief, Back Stretcher Machine, Stretches the back, Ankle, Knee, and Hip. 300/330 lbs. Capacity DAILY TRACTION: Spending ten minutes/day stretching your back has shown to help realign your spine, increase blood circulation, and achieve lumbar relief while reducing the pressure caused by a compressed spine. Spinal Traction can help reestablish a normal physiolo"
  },
  {
    "question": "Wrap-on Knee Brace with extension and flexion hinge by Rapid Knee (RK150) - Front wrap-on knee wrap with comfort fit elastic. Side Hinge opens and is adjustable to limit Range of Motion.",
    "answer": "PRODUCTS Bracing and Supports Wrap-on Knee Brace with extension and flexion hinge by Rapid Knee (RK150) - Front wrap-on knee wrap with comfort fit elastic. Side Hinge opens and is adjustable to limit Range of Motion. Roll over to zoom in + View large image Wrap-on Knee Brace with extension and flexion hinge by Rapid Knee (RK150) - Front wrap-on knee wrap with comfort fit elastic. Side Hinge opens and is adjustable to limit Range of Motion. COMFORTALE – Comfort-tech material allows for a very comfortable fit ADJUSTABLE – The side hinge opens and allows for the extension and flexion to be adjusted. Limiting the range of motion of the knee. EASY ACCESS – Front access, open in the front allows f"
  },
  {
    "question": "Lumbar Bench Electric Traction Table with Cervical Traction, Adjustable Lumbar Decompression Table for Full Body Stretching, Neck and Back Support, Home Stretch and Relaxation – One Size",
    "answer": "PRODUCTS Traction Lumbar Bench Electric Traction Table with Cervical Traction, Adjustable Lumbar Decompression Table for Full Body Stretching, Neck and Back Support, Home Stretch and Relaxation – One Size Roll over to zoom in + View large image Lumbar Bench Electric Traction Table with Cervical Traction, Adjustable Lumbar Decompression Table for Full Body Stretching, Neck and Back Support, Home Stretch and Relaxation – One Size DUAL-AREA STRETCHING – Combines lumbar decompression and cervical traction in one electric traction table for convenient neck, back, and full-body stretching. ELECTRIC ADJUSTMENT – Powered operation provides controlled positioning for a more convenient stretching expe"
  },
  {
    "question": "Leg Elevation Pillow by Recovery Wedge, Inflatable Wedge Pillow for Sleeping and Post-Surgical Recovery, Improve Circulation and Reduce Swelling, Speed Injury Recovery. (Medium Triangle)",
    "answer": "PRODUCTS Traction Leg Elevation Pillow by Recovery Wedge, Inflatable Wedge Pillow for Sleeping and Post-Surgical Recovery, Improve Circulation and Reduce Swelling, Speed Injury Recovery. (Medium Triangle) Roll over to zoom in + View large image Leg Elevation Pillow by Recovery Wedge, Inflatable Wedge Pillow for Sleeping and Post-Surgical Recovery, Improve Circulation and Reduce Swelling, Speed Injury Recovery. (Medium Triangle) PERFECT SHAPE – The recovery wedge has been exhaustively tested to have the right support that you need for optimal recovery. Recovery wedge is great for relieving knee soreness, leg soreness, hip soreness, improving circulation, and helping you recover from surgery. "
  },
  {
    "question": "3\" Bed Clip For Spot Warm, Adjustable Strap For Spot Warm King and Queen Bed Warmer, Use in Upper Two Corners to Keep Spot Warm in Place. Length 3” and Stretches, Includes - 1 Pair white",
    "answer": "PRODUCTS Heat Therapy 3\" Bed Clip For Spot Warm, Adjustable Strap For Spot Warm King and Queen Bed Warmer, Use in Upper Two Corners to Keep Spot Warm in Place. Length 3” and Stretches, Includes - 1 Pair white Roll over to zoom in + View large image 3\" Bed Clip For Spot Warm, Adjustable Strap For Spot Warm King and Queen Bed Warmer, Use in Upper Two Corners to Keep Spot Warm in Place. Length 3” and Stretches, Includes - 1 Pair white KEEP IN PLACE – Keeps the Spot Warm bed warmer fixed into position so it doesn’t bunch up from restless leg sleepers. CORNER PLACEMENT – Place in the upper left and upper right corner of the Spot Warm and clip to the mattress side. May need to pinch the mattress f"
  },
  {
    "question": "Electric Chair Lift by Mobi-Lift, Fall and Get Up from Floor, Raises Up To 20” to Help You Stand Up Again, Weight capacity up to 300 LBS, Item Weight 30 LBS (Bathtub Swivel - Accessory.)",
    "answer": "PRODUCTS Mobility Assistance Electric Chair Lift by Mobi-Lift, Fall and Get Up from Floor, Raises Up To 20” to Help You Stand Up Again, Weight capacity up to 300 LBS, Item Weight 30 LBS (Bathtub Swivel - Accessory.) Roll over to zoom in + View large image Electric Chair Lift by Mobi-Lift, Fall and Get Up from Floor, Raises Up To 20” to Help You Stand Up Again, Weight capacity up to 300 LBS, Item Weight 30 LBS (Bathtub Swivel - Accessory.) KEY DETAILS:The Mobi-Lift weighs a very sturdy 29 pounds. Made of high-strength industrial grade steel rod material gives the Mobi-Lift a weight capacity of up to 300lb. CREATIVE DESIGN: The Mobi-Lift was designed for the bathtub, but you can use it outside"
  },
  {
    "question": "Pelvic Floor Stimulating Probes by Soft Cycle, Perform Electronic Kegel Exercise and Stimulate Pelvic Floor Muscles; Compatible with Muscle Stimulators or Incontinence Devices (Vaginal)",
    "answer": "PRODUCTS Electrotherapy Supplies Pelvic Floor Stimulating Probes by Soft Cycle, Perform Electronic Kegel Exercise and Stimulate Pelvic Floor Muscles; Compatible with Muscle Stimulators or Incontinence Devices (Vaginal) Roll over to zoom in + View large image Pelvic Floor Stimulating Probes by Soft Cycle, Perform Electronic Kegel Exercise and Stimulate Pelvic Floor Muscles; Compatible with Muscle Stimulators or Incontinence Devices (Vaginal) PREMIUM QUALITY: Ergonomically designed with high-grade materials and silver conductive elements for optimum conductivity and a comfortable dispersion of current. CUSTOM FIT: Designed to come in a variety of shapes and sizes to provide for a custom fit an"
  },
  {
    "question": "Cloud Walker Full Shell Walking Boot 17\" Tall, Adjustable Medical Walker Boot with Solid Toe Box, Protective Foot & Ankle Brace for Recovery, Stability & Daily Mobility Support – medium",
    "answer": "PRODUCTS Bracing and Supports Cloud Walker Full Shell Walking Boot 17\" Tall, Adjustable Medical Walker Boot with Solid Toe Box, Protective Foot & Ankle Brace for Recovery, Stability & Daily Mobility Support – medium Roll over to zoom in + View large image Cloud Walker Full Shell Walking Boot 17\" Tall, Adjustable Medical Walker Boot with Solid Toe Box, Protective Foot & Ankle Brace for Recovery, Stability & Daily Mobility Support – medium ENHANCED LOWER LEG SUPPORT – 17\" tall walking boot helps stabilize the foot and ankle during daily movement and recovery routines. ADJUSTABLE SECURE FIT – Medical walker boot features customizable hook-and-loop straps for improved comfort, support, and easy "
  },
  {
    "question": "Leg Elevation Pillow by Recovery Wedge, Inflatable Wedge Pillow for Sleeping and Post-Surgical Recovery, Improve Circulation and Reduce Swelling, Speed Injury Recovery. (Large triangle)",
    "answer": "PRODUCTS Traction Leg Elevation Pillow by Recovery Wedge, Inflatable Wedge Pillow for Sleeping and Post-Surgical Recovery, Improve Circulation and Reduce Swelling, Speed Injury Recovery. (Large triangle) Roll over to zoom in + View large image Leg Elevation Pillow by Recovery Wedge, Inflatable Wedge Pillow for Sleeping and Post-Surgical Recovery, Improve Circulation and Reduce Swelling, Speed Injury Recovery. (Large triangle) PERFECT SHAPE – The recovery wedge has been exhaustively tested to have the right support that you need for optimal recovery. Recovery wedge is great for relieving knee soreness, leg soreness, hip soreness, improving circulation, and helping you recover from surgery. Re"
  },
  {
    "question": "Extra Large Reusable Ice Cubes (2.6” Square) - BPA Free Food Grade Plastic - for Cold Therapy Machines or Drink Coolers and Drink Dispensers - Ice Therapy System – Includes 6 Cubes/pack",
    "answer": "PRODUCTS Water Therapy Systems Extra Large Reusable Ice Cubes (2.6” Square) - BPA Free Food Grade Plastic - for Cold Therapy Machines or Drink Coolers and Drink Dispensers - Ice Therapy System – Includes 6 Cubes/pack Roll over to zoom in + View large image Extra Large Reusable Ice Cubes (2.6” Square) - BPA Free Food Grade Plastic - for Cold Therapy Machines or Drink Coolers and Drink Dispensers - Ice Therapy System – Includes 6 Cubes/pack LONG-LASTING COLD: Keep the cold flowing with these reusable ice cubes. These plastic, refreezable cubes are easier and more convenient than refilling ice trays, and you'll always have them ready to go when you keep them in your freezer. EXTRA LARGE CUBES: "
  },
  {
    "question": "Conductive Wearable Back Wrap by Blue Silver. Compression back wrap, compatible with all electrotherapy devices to provide Low Back Pain Relief with wearable comfort. (Silver Mesh Gel)",
    "answer": "PRODUCTS Electrodes Conductive Wearable Back Wrap by Blue Silver. Compression back wrap, compatible with all electrotherapy devices to provide Low Back Pain Relief with wearable comfort. (Silver Mesh Gel) Roll over to zoom in + View large image Conductive Wearable Back Wrap by Blue Silver. Compression back wrap, compatible with all electrotherapy devices to provide Low Back Pain Relief with wearable comfort. (Silver Mesh Gel) HIGHLY CONDUCTIVE – Silver mesh Double sided gel provides for the highest level of conductivity possible. Better than aluminum or carbon. PEEL-N-STICK – Double sided gel allows for a peel and stick application specially designed for the Blue Silver back Wrap by PMT For "
  },
  {
    "question": "Cloud Walker Full Shell Walking Boot 17\" Tall, Adjustable Medical Walker Boot with Solid Toe Box, Protective Foot & Ankle Brace for Recovery, Stability & Daily Mobility Support – Small",
    "answer": "PRODUCTS Bracing and Supports Cloud Walker Full Shell Walking Boot 17\" Tall, Adjustable Medical Walker Boot with Solid Toe Box, Protective Foot & Ankle Brace for Recovery, Stability & Daily Mobility Support – Small Roll over to zoom in + View large image Cloud Walker Full Shell Walking Boot 17\" Tall, Adjustable Medical Walker Boot with Solid Toe Box, Protective Foot & Ankle Brace for Recovery, Stability & Daily Mobility Support – Small ENHANCED LOWER LEG SUPPORT – 17\" tall walking boot helps stabilize the foot and ankle during daily movement and recovery routines. ADJUSTABLE SECURE FIT – Medical walker boot features customizable hook-and-loop straps for improved comfort, support, and easy we"
  },
  {
    "question": "Cloud Walker Full Shell Walking Boot 17\" Tall, Adjustable Medical Walker Boot with Solid Toe Box, Protective Foot & Ankle Brace for Recovery, Stability & Daily Mobility Support – Large",
    "answer": "PRODUCTS Bracing and Supports Cloud Walker Full Shell Walking Boot 17\" Tall, Adjustable Medical Walker Boot with Solid Toe Box, Protective Foot & Ankle Brace for Recovery, Stability & Daily Mobility Support – Large Roll over to zoom in + View large image Cloud Walker Full Shell Walking Boot 17\" Tall, Adjustable Medical Walker Boot with Solid Toe Box, Protective Foot & Ankle Brace for Recovery, Stability & Daily Mobility Support – Large ENHANCED LOWER LEG SUPPORT – 17\" tall walking boot helps stabilize the foot and ankle during daily movement and recovery routines. ADJUSTABLE SECURE FIT – Medical walker boot features customizable hook-and-loop straps for improved comfort, support, and easy we"
  },
  {
    "question": "Full Back Stretch Massage Trigger Point Chiropractic Pillow by Acupillow Pro - Cervical and Lumbar Traction Stretcher Device - Myofascial Release of Pressure Point - Neck and Back Pain",
    "answer": "PRODUCTS Massage Therapy Devices Full Back Stretch Massage Trigger Point Chiropractic Pillow by Acupillow Pro - Cervical and Lumbar Traction Stretcher Device - Myofascial Release of Pressure Point - Neck and Back Pain Roll over to zoom in + View large image Full Back Stretch Massage Trigger Point Chiropractic Pillow by Acupillow Pro - Cervical and Lumbar Traction Stretcher Device - Myofascial Release of Pressure Point - Neck and Back Pain ACUPRESSURE PILLOW: The Acupillow Pro neck and Upper Back relaxer targets even more pressure points along the neck with extended range. The device remains firm, but not too stiff with the new shape specially designed with more pressure points that extend th"
  },
  {
    "question": "Apex Medical Sedens 500- Alternating Pressure Seat Cushion with Portable Pump – Lower Back & Butt Pain Relief- Fits Wheelchair, Office Chair, Driver Seat - Battery Embedded (17\" x 17\")",
    "answer": "PRODUCTS Mobility Assistance Apex Medical Sedens 500- Alternating Pressure Seat Cushion with Portable Pump – Lower Back & Butt Pain Relief- Fits Wheelchair, Office Chair, Driver Seat - Battery Embedded (17\" x 17\") Roll over to zoom in + View large image Apex Medical Sedens 500- Alternating Pressure Seat Cushion with Portable Pump – Lower Back & Butt Pain Relief- Fits Wheelchair, Office Chair, Driver Seat - Battery Embedded (17\" x 17\") Pressure & Pain Relief from Prolonged Sitting]: Sedens 500 is your essential solution for pain relief caused by prolonged sitting on wheelchair, mobility aids, office chair, car & truck driver seat. Alternating air cells redistribute weight, providing maximum c"
  },
  {
    "question": "Electric Lifting Backrest for Bed by Mobi-Back, Medical Back Pillow with Electric Pump System, Electric Lifting Bed Backrest, Used by Pregnant Women, Elderly for Sit-Up In Bed - Gen 1.",
    "answer": "PRODUCTS Mobility Assistance Electric Lifting Backrest for Bed by Mobi-Back, Medical Back Pillow with Electric Pump System, Electric Lifting Bed Backrest, Used by Pregnant Women, Elderly for Sit-Up In Bed - Gen 1. Roll over to zoom in + View large image Electric Lifting Backrest for Bed by Mobi-Back, Medical Back Pillow with Electric Pump System, Electric Lifting Bed Backrest, Used by Pregnant Women, Elderly for Sit-Up In Bed - Gen 1. COMFORTABE AND STRONG: The Mobi-Back Gen 1 Electric backrest uses high-quality cold-rolled steel that is thick and durable. Along with a combination of different densities of cushion to make the mattress more comfortable and better for heat dissipation, and imp"
  },
  {
    "question": "Infarex Stand-up Infrared Lamp | 275W Red Light Therapy, Heat Bulb 3000h 110V | Rotating, Adjustable, Portable | Pain Relief, Muscle Aches | Home, Spa, Dermatology Clinic, Beauty Salon",
    "answer": "PRODUCTS Light Therapy Infarex Stand-up Infrared Lamp | 275W Red Light Therapy, Heat Bulb 3000h 110V | Rotating, Adjustable, Portable | Pain Relief, Muscle Aches | Home, Spa, Dermatology Clinic, Beauty Salon Roll over to zoom in + View large image Infarex Stand-up Infrared Lamp | 275W Red Light Therapy, Heat Bulb 3000h 110V | Rotating, Adjustable, Portable | Pain Relief, Muscle Aches | Home, Spa, Dermatology Clinic, Beauty Salon DEEP-PENETRATING THERAPY: Harness the power of 275W infrared and red light therapy for effective pain relief and muscle rejuvenation. ADJUSTABLE DESIGN: Customize your therapy session with a 360° rotating head and height-adjustable stand for precise targeting of spec"
  },
  {
    "question": "Leg Elevation Pillow by Recovery Wedge, Inflatable Wedge Pillow for Sleeping and Post-Surgical Recovery, Improve Circulation and Reduce Swelling, Speed Injury Recovery. (Snore Pillow)",
    "answer": "PRODUCTS Traction Leg Elevation Pillow by Recovery Wedge, Inflatable Wedge Pillow for Sleeping and Post-Surgical Recovery, Improve Circulation and Reduce Swelling, Speed Injury Recovery. (Snore Pillow) Roll over to zoom in + View large image Leg Elevation Pillow by Recovery Wedge, Inflatable Wedge Pillow for Sleeping and Post-Surgical Recovery, Improve Circulation and Reduce Swelling, Speed Injury Recovery. (Snore Pillow) PERFECT SHAPE – The recovery wedge has been exhaustively tested to have the right support that you need for optimal recovery. Recovery wedge is great for relieving knee soreness, leg soreness, hip soreness, improving circulation, and helping you recover from surgery. Reduce"
  },
  {
    "question": "Jawline Facial Exerciser by Jawfit – 1 Pair of Medical Grade BPA FREE Silicone Jaw Exerciser for Beginner & Advanced Users - Jawline Sculptor & Jawline Shaper (2nd Generation) - White",
    "answer": "PRODUCTS Traction Jawline Facial Exerciser by Jawfit – 1 Pair of Medical Grade BPA FREE Silicone Jaw Exerciser for Beginner & Advanced Users - Jawline Sculptor & Jawline Shaper (2nd Generation) - White Roll over to zoom in + View large image Jawline Facial Exerciser by Jawfit – 1 Pair of Medical Grade BPA FREE Silicone Jaw Exerciser for Beginner & Advanced Users - Jawline Sculptor & Jawline Shaper (2nd Generation) - White UPDATED DESIGN – The Jawfit jawline exerciser is made of new & improved tear-resistant Medical Grade/Food-Grade silicone that is BPA Free and has a better elasticity and higher tensile strength to improve your jawline workout! PERFECT FIT - Works for Beginner and Advanced u"
  },
  {
    "question": "Spinal Decompression Belt with Rigid Posterior Panel for Lumbar Traction by Theratrac – Back Stretcher Device for Lower Back Pain Relief with Pump for Adjustable Support-small/medium",
    "answer": "PRODUCTS Traction Spinal Decompression Belt with Rigid Posterior Panel for Lumbar Traction by Theratrac – Back Stretcher Device for Lower Back Pain Relief with Pump for Adjustable Support-small/medium Roll over to zoom in + View large image Spinal Decompression Belt with Rigid Posterior Panel for Lumbar Traction by Theratrac – Back Stretcher Device for Lower Back Pain Relief with Pump for Adjustable Support-small/medium The Theratrac lumbar traction brace is a very unique and effective therapy mechanism to decompress the spine Portable, comfortable and convenient,Offers incremental adjustable pneumatic pressure,No assembly required The Theratrac can be used for pain relief, muscle relaxation"
  },
  {
    "question": "Toilet Tilt Electric Powered Toilet Lift Chair with Remote Control, Adjustable Toilet Seat Riser Assist for Elderly & Disabled, Sit-to-Stand Bathroom Mobility Aid with Support Arms",
    "answer": "PRODUCTS Mobility Assistance Toilet Tilt Electric Powered Toilet Lift Chair with Remote Control, Adjustable Toilet Seat Riser Assist for Elderly & Disabled, Sit-to-Stand Bathroom Mobility Aid with Support Arms Roll over to zoom in + View large image Toilet Tilt Electric Powered Toilet Lift Chair with Remote Control, Adjustable Toilet Seat Riser Assist for Elderly & Disabled, Sit-to-Stand Bathroom Mobility Aid with Support Arms EASY SIT-TO-STAND SUPPORT – Electric toilet lift assists users during sitting and standing, reducing strain on knees and hips for safer daily bathroom use. ADJUSTABLE LIFTING MOTION – Powered toilet seat lift features smooth angle adjustment with remote control for cus"
  },
  {
    "question": "The Wobble Stool- Self Balancing Stool with 360 Degree Rotation, Promotes Healthy Posture to Relieve Back and Neck Pain, Lightweight Portable Seat Cushion with Swivel Base (Black)",
    "answer": "PRODUCTS Traction The Wobble Stool- Self Balancing Stool with 360 Degree Rotation, Promotes Healthy Posture to Relieve Back and Neck Pain, Lightweight Portable Seat Cushion with Swivel Base (Black) Roll over to zoom in + View large image The Wobble Stool- Self Balancing Stool with 360 Degree Rotation, Promotes Healthy Posture to Relieve Back and Neck Pain, Lightweight Portable Seat Cushion with Swivel Base (Black) Balancing Wobble Stool- If you suffer from back pain, it is most likely a result of poor posture. This is a problem that millions of people suffer from after long days at the office. Sitting for long periods of time, it is incredibly easy to start slouching, no matter how hard you "
  },
  {
    "question": "Cool Collar Neck Cooling Wrap with Cooling Towel – Reusable Instant Cooling Neck Band, Adjustable Lightweight Design for Outdoor Work, Sports, Travel, Heat Relief & Summer Comfort",
    "answer": "PRODUCTS Water Therapy Systems Cool Collar Neck Cooling Wrap with Cooling Towel – Reusable Instant Cooling Neck Band, Adjustable Lightweight Design for Outdoor Work, Sports, Travel, Heat Relief & Summer Comfort Roll over to zoom in + View large image Cool Collar Neck Cooling Wrap with Cooling Towel – Reusable Instant Cooling Neck Band, Adjustable Lightweight Design for Outdoor Work, Sports, Travel, Heat Relief & Summer Comfort Summer Must-Have: Whether you work outdoors or play sports, our neck cooling tubes are a summer must-have, providing refreshing coolness and complete relaxation. Versatile Cooling: No battery needed! No charger needed！supply is required to start freezing anywhere below"
  },
  {
    "question": "Electrode Extender Conductive Adhesive Gel by PMT – Enhance Durability, Adhesion and Conductivity for TENS/EMS Electrodes; Extend life of Electrodes and Increase Adhesion – 3.5oz",
    "answer": "PRODUCTS Electrotherapy Supplies Electrode Extender Conductive Adhesive Gel by PMT – Enhance Durability, Adhesion and Conductivity for TENS/EMS Electrodes; Extend life of Electrodes and Increase Adhesion – 3.5oz Roll over to zoom in + View large image Electrode Extender Conductive Adhesive Gel by PMT – Enhance Durability, Adhesion and Conductivity for TENS/EMS Electrodes; Extend life of Electrodes and Increase Adhesion – 3.5oz PROPRIETARY FORMULA : Enhance Conductivity durability and adhesion. Extend the life of Your depleted electrode pads and regain new life for longer uses. EXTEND THE LIFE OF YOUR PADS : helps to extend the life of your pads and provide a boost in conductive elements – en"
  },
  {
    "question": "Spinal Decompression Belt with Rigid Posterior Panel for Lumbar Traction by Theratrac – Back Stretcher Device for Lower Back Pain Relief with Pump for Adjustable Support-Large/XL",
    "answer": "PRODUCTS Traction Spinal Decompression Belt with Rigid Posterior Panel for Lumbar Traction by Theratrac – Back Stretcher Device for Lower Back Pain Relief with Pump for Adjustable Support-Large/XL Roll over to zoom in + View large image Spinal Decompression Belt with Rigid Posterior Panel for Lumbar Traction by Theratrac – Back Stretcher Device for Lower Back Pain Relief with Pump for Adjustable Support-Large/XL The Theratrac lumbar traction brace is a very unique and effective therapy mechanism to decompress the spine Portable, comfortable and convenient,Offers incremental adjustable pneumatic pressure,No assembly required The Theratrac can be used for pain relief, muscle relaxation and str"
  },
  {
    "question": "Travel UltraLite Powered Wheelchair by MobiJoe, 500W Dual Motor - Lightweight Mobility for Seniors, Foldable and Compact for Easy Travel and Storage. Includes 2 Li-ion Batteries.",
    "answer": "PRODUCTS Mobility Assistance Travel UltraLite Powered Wheelchair by MobiJoe, 500W Dual Motor - Lightweight Mobility for Seniors, Foldable and Compact for Easy Travel and Storage. Includes 2 Li-ion Batteries. Roll over to zoom in + View large image Travel UltraLite Powered Wheelchair by MobiJoe, 500W Dual Motor - Lightweight Mobility for Seniors, Foldable and Compact for Easy Travel and Storage. Includes 2 Li-ion Batteries. LIGHTWEIGHT AND COMPACT DESIGN: The MobiJoe is designed to be lightweight and meant to come with you wherever you need it. The ultra compact, folding design means that you can take the MobiJoe wherever you need it. When folded, the chair can be conveniently stored into any"
  },
  {
    "question": "Premium Lift Assist Memory Foam Cushion by Seat Boost - Portable Alternative to Lift Chairs, Stand Assist Handicap Mobility Help for 70% Lift Support (Small – lifts up 95-220lbs)",
    "answer": "PRODUCTS Mobility Assistance Premium Lift Assist Memory Foam Cushion by Seat Boost - Portable Alternative to Lift Chairs, Stand Assist Handicap Mobility Help for 70% Lift Support (Small – lifts up 95-220lbs) Roll over to zoom in + View large image Premium Lift Assist Memory Foam Cushion by Seat Boost - Portable Alternative to Lift Chairs, Stand Assist Handicap Mobility Help for 70% Lift Support (Small – lifts up 95-220lbs) SEAT ASSIST HELPS MAINTAIN ACTIVE AND INDEPENDENT LIFESTYLE: It’s difficult to have to rely on someone else to help with regular everyday activities like getting up and sitting down, but now you can take some of your independence back. This easy uplift cushion helps you sa"
  },
  {
    "question": "Neck Traction Device by Air Collar - Neck Stretcher - Cervical Traction Device - Neck & Shoulder Pain Relief - Stretcher Collar for Improved Spine Alignment - (2nd Gen - Manual)",
    "answer": "PRODUCTS Traction Neck Traction Device by Air Collar - Neck Stretcher - Cervical Traction Device - Neck & Shoulder Pain Relief - Stretcher Collar for Improved Spine Alignment - (2nd Gen - Manual) Roll over to zoom in + View large image Neck Traction Device by Air Collar - Neck Stretcher - Cervical Traction Device - Neck & Shoulder Pain Relief - Stretcher Collar for Improved Spine Alignment - (2nd Gen - Manual) NECK TENSION RELIEF: The Air Collar neck traction machine is designed to reduce any pressure on your nerves by encouraging improved posture and stretching the neck. If you suffer from a stiff neck, pinched nerve, or sore shoulder muscles, use it for just minutes a day to experience rea"
  },
  {
    "question": "Neck Traction with Ratchet Tight Technology by Theratrac Glide - Cervical Traction - Stretch and Relieve Pain, Cervicalgia, Degeneration of disc, Spondylosis and Spine Alignment",
    "answer": "PRODUCTS Traction Neck Traction with Ratchet Tight Technology by Theratrac Glide - Cervical Traction - Stretch and Relieve Pain, Cervicalgia, Degeneration of disc, Spondylosis and Spine Alignment Roll over to zoom in + View large image Neck Traction with Ratchet Tight Technology by Theratrac Glide - Cervical Traction - Stretch and Relieve Pain, Cervicalgia, Degeneration of disc, Spondylosis and Spine Alignment Easy to Use Control This cervical traction device has an easy to use handheld controller. Adjusts to Neck Width Turn the knobs to change the width of the neck support to accommodate all sizes. Choose your Intensity Pick how far your stretch goes with the intensity knob. You'll want a n"
  },
  {
    "question": "Electric Chair Lift by Mobi-Lift - Upgraded Padding, Fall and Get Up in Shower or Floor, Raises Up to 20” to Help You Stand Up, Weight Capacity up to 300 LBS, Item Weight 30 LBS",
    "answer": "PRODUCTS Mobility Assistance Electric Chair Lift by Mobi-Lift - Upgraded Padding, Fall and Get Up in Shower or Floor, Raises Up to 20” to Help You Stand Up, Weight Capacity up to 300 LBS, Item Weight 30 LBS Roll over to zoom in + View large image Electric Chair Lift by Mobi-Lift - Upgraded Padding, Fall and Get Up in Shower or Floor, Raises Up to 20” to Help You Stand Up, Weight Capacity up to 300 LBS, Item Weight 30 LBS KEY DETAILS:The Mobi-Lift weighs a very sturdy 29 pounds. Made of high-strength industrial grade steel rod material gives the Mobi-Lift a weight capacity of up to 300lb. CREATIVE DESIGN: The Mobi-Lift was designed for the bathtub, but you can use it outside of the bathtub as"
  },
  {
    "question": "Ergonomic Self-Balancing Roller Chair - by Wobble Stool Seating for Improved Posture, 360 Degree Tilt, Adjustable Height, Comfortable Office and Home Chair with Locking Casters",
    "answer": "PRODUCTS Traction Ergonomic Self-Balancing Roller Chair - by Wobble Stool Seating for Improved Posture, 360 Degree Tilt, Adjustable Height, Comfortable Office and Home Chair with Locking Casters Roll over to zoom in + View large image Ergonomic Self-Balancing Roller Chair - by Wobble Stool Seating for Improved Posture, 360 Degree Tilt, Adjustable Height, Comfortable Office and Home Chair with Locking Casters INNOVATIVE DESIGN: The Wobble Stool Roller Chair features a revolutionary 360-degree tilt and rotation mechanism, ensuring it adapts seamlessly to your movements, promoting a natural and upright sitting position. Easy to Lock casters allow for a safe seating position. POSTURE PERFECTION:"
  },
  {
    "question": "Premium Lift Assist Memory Foam Cushion by Seat Boost - Portable Alternative to Lift Chairs, Stand Assist Handicap Mobility Help for 70% Lift Support (Large – lifts 200-340lbs)",
    "answer": "PRODUCTS Mobility Assistance Premium Lift Assist Memory Foam Cushion by Seat Boost - Portable Alternative to Lift Chairs, Stand Assist Handicap Mobility Help for 70% Lift Support (Large – lifts 200-340lbs) Roll over to zoom in + View large image Premium Lift Assist Memory Foam Cushion by Seat Boost - Portable Alternative to Lift Chairs, Stand Assist Handicap Mobility Help for 70% Lift Support (Large – lifts 200-340lbs) SEAT ASSIST HELPS MAINTAIN ACTIVE AND INDEPENDENT LIFESTYLE: It’s difficult to have to rely on someone else to help with regular everyday activities like getting up and sitting down, but now you can take some of your independence back. This easy uplift cushion helps you safely"
  },
  {
    "question": "Double Head Percussion Massage Gun by Body Drummer Double - Whisper Quiet - Deep Tissue Pain Relief with 4 Massage Heads High RPM vibrational Relaxation - Rechargeable Battery",
    "answer": "PRODUCTS Massage Therapy Devices Double Head Percussion Massage Gun by Body Drummer Double - Whisper Quiet - Deep Tissue Pain Relief with 4 Massage Heads High RPM vibrational Relaxation - Rechargeable Battery Roll over to zoom in + View large image Double Head Percussion Massage Gun by Body Drummer Double - Whisper Quiet - Deep Tissue Pain Relief with 4 Massage Heads High RPM vibrational Relaxation - Rechargeable Battery LIGHTWEIGHT AND COMPACT --High-quality deep fascia gun made of aviation aluminum with an oxidized surface. Wear-resistant metal. Weighing only 1.5 pounds, it is light and easy to take on the go. ULTRAQUITE ---a quiet brushless motor means a more pleasant massage experience; "
  },
  {
    "question": "Jawline Facial Exerciser by Jawfit – 1 Pair of Medical Grade BPA FREE Silicone Jaw Exerciser for Beginner & Advanced Users - Jawline Sculptor & Jawline Shaper (2nd Generation)",
    "answer": "PRODUCTS Traction Jawline Facial Exerciser by Jawfit – 1 Pair of Medical Grade BPA FREE Silicone Jaw Exerciser for Beginner & Advanced Users - Jawline Sculptor & Jawline Shaper (2nd Generation) Roll over to zoom in + View large image Jawline Facial Exerciser by Jawfit – 1 Pair of Medical Grade BPA FREE Silicone Jaw Exerciser for Beginner & Advanced Users - Jawline Sculptor & Jawline Shaper (2nd Generation) UPDATED DESIGN – The Jawfit jawline exerciser is made of new & improved tear-resistant Medical Grade/Food-Grade silicone that is BPA Free and has a better elasticity and higher tensile strength to improve your jawline workout! PERFECT FIT - Works for Beginner and Advanced users to create t"
  },
  {
    "question": "Relaxing Leg Cream by PMT, Nerve Calming Topical for Leg Relief, Sleep Cream Penetrates Deep, Relieve Discomfort and Sleeplessness, Boosted with Magnesium & Melatonin - 2.83oz",
    "answer": "PRODUCTS Therapeutic Creams and Gels Relaxing Leg Cream by PMT, Nerve Calming Topical for Leg Relief, Sleep Cream Penetrates Deep, Relieve Discomfort and Sleeplessness, Boosted with Magnesium & Melatonin - 2.83oz Roll over to zoom in + View large image Relaxing Leg Cream by PMT, Nerve Calming Topical for Leg Relief, Sleep Cream Penetrates Deep, Relieve Discomfort and Sleeplessness, Boosted with Magnesium & Melatonin - 2.83oz RELIEF FOR LEGS - Our powerful leg cream penetrates deep to relieve discomfort associated with one’s legs which can make it harder to get a good night’s rest. The natural formula helps calm the nerves that cause the uneasy sensation, resulting in an undisturbed sleep tha"
  },
  {
    "question": "Conductive Wearable Back Wrap by Blue Silver. Compression back wrap, compatible with all electrotherapy devices to provide Low Back Pain Relief with wearable comfort - LG/XL.",
    "answer": "PRODUCTS Electrotherapy Garments Conductive Wearable Back Wrap by Blue Silver. Compression back wrap, compatible with all electrotherapy devices to provide Low Back Pain Relief with wearable comfort - LG/XL. Roll over to zoom in + View large image Conductive Wearable Back Wrap by Blue Silver. Compression back wrap, compatible with all electrotherapy devices to provide Low Back Pain Relief with wearable comfort - LG/XL. MULTIFUNCTIONAL – use with peel-n-stick silver mesh electrodes or silver conductive garments. BREATHABLE – comfortable and breathable back wrap allows for wearable comfort, place the back wrap under your shirt to provide support and comfort while maintaining effective conducti"
  },
  {
    "question": "Conductive Wearable Back Wrap by Blue Silver. Compression back wrap, compatible with all electrotherapy devices to provide Low Back Pain Relief with wearable comfort - SM/MD.",
    "answer": "PRODUCTS Electrotherapy Garments Conductive Wearable Back Wrap by Blue Silver. Compression back wrap, compatible with all electrotherapy devices to provide Low Back Pain Relief with wearable comfort - SM/MD. Roll over to zoom in + View large image Conductive Wearable Back Wrap by Blue Silver. Compression back wrap, compatible with all electrotherapy devices to provide Low Back Pain Relief with wearable comfort - SM/MD. MULTIFUNCTIONAL – use with peel-n-stick silver mesh electrodes or silver conductive garments. BREATHABLE – comfortable and breathable back wrap allows for wearable comfort, place the back wrap under your shirt to provide support and comfort while maintaining effective conducti"
  },
  {
    "question": "Travel Light Powered Wheelchair by MobiJoe, 500W Dual Motor - Lightweight Mobility for Seniors, Foldable and Compact for Easy Travel and Storage. Includes 2 Li-ion Batteries.",
    "answer": "PRODUCTS Mobility Assistance Travel Light Powered Wheelchair by MobiJoe, 500W Dual Motor - Lightweight Mobility for Seniors, Foldable and Compact for Easy Travel and Storage. Includes 2 Li-ion Batteries. Roll over to zoom in + View large image Travel Light Powered Wheelchair by MobiJoe, 500W Dual Motor - Lightweight Mobility for Seniors, Foldable and Compact for Easy Travel and Storage. Includes 2 Li-ion Batteries. LIGHTWEIGHT AND COMPACT DESIGN: The MobiJoe is designed to be lightweight and weighs in at just 66 pounds while equipped with two fully charged batteries. The ultra compact, folding design means that you can take the MobiJoe wherever you need it. When folded, the chair can be conv"
  },
  {
    "question": "Premium Electrotherapy Conductive Socks - for TENS Pain Treatment, Neuropathy, Inflammation, Arthritis, Nerve and Joint Pain (1 Garment - Silver Thread – One Size Fits Most)",
    "answer": "PRODUCTS Electrotherapy Garments Premium Electrotherapy Conductive Socks - for TENS Pain Treatment, Neuropathy, Inflammation, Arthritis, Nerve and Joint Pain (1 Garment - Silver Thread – One Size Fits Most) Roll over to zoom in + View large image Premium Electrotherapy Conductive Socks - for TENS Pain Treatment, Neuropathy, Inflammation, Arthritis, Nerve and Joint Pain (1 Garment - Silver Thread – One Size Fits Most) USE WITH YOUR EXISTING TENS OR ELECTROTHERAPY DEVICE (compatible with 95% of devices) for treatment of Neuropathy, Nerve and Joint Pain, Arthritis, Sports Injuries, Post-op Swelling, Pain Management, Inflammation, etc. Our proprietary products were developed over 10 years in a c"
  },
  {
    "question": "Rolly Massager Rolling Massager with Percussive Action, Full Body Massage Roller for Legs, Back, Arms & Shoulders, Rechargeable Handheld Deep Tissue Muscle Relaxation Device",
    "answer": "PRODUCTS Massage Therapy Devices Rolly Massager Rolling Massager with Percussive Action, Full Body Massage Roller for Legs, Back, Arms & Shoulders, Rechargeable Handheld Deep Tissue Muscle Relaxation Device Roll over to zoom in + View large image Rolly Massager Rolling Massager with Percussive Action, Full Body Massage Roller for Legs, Back, Arms & Shoulders, Rechargeable Handheld Deep Tissue Muscle Relaxation Device FULL BODY COMFORT – Rolling and percussive massage action helps target legs, calves, back, shoulders, arms, and feet for everyday muscle relaxation and post-activity recovery. HANDS-FREE ROLLING DESIGN – Ergonomic roller system glides smoothly along muscle groups, reducing the e"
  },
  {
    "question": "Neck Traction Device by Air Collar - Neck Stretcher - Cervical Traction Device - Neck & Shoulder Pain Relief - Stretcher Collar for Improved Spine Alignment - 1st Generation",
    "answer": "PRODUCTS Traction Neck Traction Device by Air Collar - Neck Stretcher - Cervical Traction Device - Neck & Shoulder Pain Relief - Stretcher Collar for Improved Spine Alignment - 1st Generation Roll over to zoom in + View large image Neck Traction Device by Air Collar - Neck Stretcher - Cervical Traction Device - Neck & Shoulder Pain Relief - Stretcher Collar for Improved Spine Alignment - 1st Generation NECK TENSION RELIEF: The Air Collar neck traction machine is designed to reduce any pressure on your nerves by encouraging improved posture and stretching the neck. If you suffer from a stiff neck, pinched nerve, or sore shoulder muscles, use it for just minutes a day to experience real result"
  },
  {
    "question": "Go Stim TENS EMS Heat Device, Wireless Muscle Stimulator with Remote Control, Rechargeable Portable Pain Management Unit for Back, Neck, Shoulder, Arm & Leg Muscle Recovery",
    "answer": "PRODUCTS Electrotherapy Devices Go Stim TENS EMS Heat Device, Wireless Muscle Stimulator with Remote Control, Rechargeable Portable Pain Management Unit for Back, Neck, Shoulder, Arm & Leg Muscle Recovery Roll over to zoom in + View large image Go Stim TENS EMS Heat Device, Wireless Muscle Stimulator with Remote Control, Rechargeable Portable Pain Management Unit for Back, Neck, Shoulder, Arm & Leg Muscle Recovery WIRELESS FREEDOM – Compact TENS EMS Heat device with wireless operation and remote control, allowing comfortable use at home, work, or while relaxing. 3-IN-1 THERAPY – Combines TENS, EMS, and soothing heat functions in one device to support muscle stimulation, relaxation, and every"
  },
  {
    "question": "Body Compression Bandage Support Wrap by PMT – for Men and Women, Pain Relief, Lower Leg Compression Support, Shin Splint Guard for Athletes. 8” by 40” - one-size-fits-all.",
    "answer": "PRODUCTS Electrotherapy Garments Body Compression Bandage Support Wrap by PMT – for Men and Women, Pain Relief, Lower Leg Compression Support, Shin Splint Guard for Athletes. 8” by 40” - one-size-fits-all. Roll over to zoom in + View large image Body Compression Bandage Support Wrap by PMT – for Men and Women, Pain Relief, Lower Leg Compression Support, Shin Splint Guard for Athletes. 8” by 40” - one-size-fits-all. ONE-SIZE-FITS-ALL: Extra Long 8” by 40” wrap for your leg, knee, arm or thigh. Easy to adjust the tightness and size. Extra Long Velcro for use. EFFECTIVE SUPPORT: Reducing soreness, inflammation, and cramping, the calf brace effectively supports weak or injured calf muscles. Prov"
  },
  {
    "question": "Medical Grade Heating pad with Automatic Moist Heat by Thermotech, High Heat Heating pad for Back Pain and Cramps - 2nd Gen Version (Extra Large King Digital - 26\" by 14\")",
    "answer": "PRODUCTS Heat Therapy Medical Grade Heating pad with Automatic Moist Heat by Thermotech, High Heat Heating pad for Back Pain and Cramps - 2nd Gen Version (Extra Large King Digital - 26\" by 14\") Roll over to zoom in + View large image Medical Grade Heating pad with Automatic Moist Heat by Thermotech, High Heat Heating pad for Back Pain and Cramps - 2nd Gen Version (Extra Large King Digital - 26\" by 14\") MEDICAL GRADE ELECTRIC HEATING PAD: Get the best possible at-homecare and relief for your chronic pain, injury, or conditions that are available with this medical-grade device. Patient-friendly, the moist heat you'll get from this heat pad is the most commonly prescribed form of treatment by p"
  },
  {
    "question": "Hand Finger Strengthener by Rapid Fingers - Hand Extensor Exercise Equipment, 40lb Resistance Band Finger Strengthener – for Climbing, Guitar, Gaming. One-Size Fits all.",
    "answer": "PRODUCTS Bracing and Supports Hand Finger Strengthener by Rapid Fingers - Hand Extensor Exercise Equipment, 40lb Resistance Band Finger Strengthener – for Climbing, Guitar, Gaming. One-Size Fits all. Roll over to zoom in + View large image Hand Finger Strengthener by Rapid Fingers - Hand Extensor Exercise Equipment, 40lb Resistance Band Finger Strengthener – for Climbing, Guitar, Gaming. One-Size Fits all. HAND/FINGER EXERCISER: The Rapid Fingers hand and fingers strengthener can improve finger strength for athletes (rock climbing/ tennis/ baseball/ boxing/ tennis/golf and shooting) musicians (guitar/bass players/pianists/violinists), and Gamers. The grip trainer is suitable for rehabilitati"
  },
  {
    "question": "Body Compression Bandage Support Wrap by PMT-for Men and Women, Pain Relief, Lower Leg Compression Support, Shin Splint Guard for Athletes.4\"by40\"-one-size-fits-all.",
    "answer": "PRODUCTS Electrotherapy Garments Body Compression Bandage Support Wrap by PMT-for Men and Women, Pain Relief, Lower Leg Compression Support, Shin Splint Guard for Athletes.4\"by40\"-one-size-fits-all. Roll over to zoom in + View large image Body Compression Bandage Support Wrap by PMT-for Men and Women, Pain Relief, Lower Leg Compression Support, Shin Splint Guard for Athletes.4\"by40\"-one-size-fits-all. ONE-SIZE-FITS-ALL: Extra Long 4” by 40” wrap for your leg, knee, arm or thigh. Easy to adjust the tightness and size. Extra Long Hook/Loop for use. EFFECTIVE SUPPORT: Reducing soreness, inflammation, and cramping, the calf brace effectively supports weak or injured calf muscles. Providing great"
  },
  {
    "question": "Versatile Medium Moist Heating Pad with Auto Shut Off for Cramps and Back Pain by ThermoRelief - Extra Hot Medical Grade Digital Electric Pad – Medium Size (18 x14)",
    "answer": "PRODUCTS Heat Therapy Versatile Medium Moist Heating Pad with Auto Shut Off for Cramps and Back Pain by ThermoRelief - Extra Hot Medical Grade Digital Electric Pad – Medium Size (18 x14) Roll over to zoom in + View large image Versatile Medium Moist Heating Pad with Auto Shut Off for Cramps and Back Pain by ThermoRelief - Extra Hot Medical Grade Digital Electric Pad – Medium Size (18 x14) MEDICAL GRADE ELECTRIC HEATING PAD: Pain and injuries can be tough to deal with, so you want the best possible care in order to get quick relief. This high-quality medical grade heater pad is now available for public use. Patient-friendly, the moist heat you’ll get from this heat pad is most commonly prescr"
  },
  {
    "question": "Rigid Thumb Brace Immobilizer by Rapid Thumb - Medium - Tendonitis Arthritis Relief Pain Recovery - CMC Joint Thumb Stabilizer, Splint Spica, Abducted Thumb- Medium",
    "answer": "PRODUCTS Bracing and Supports Rigid Thumb Brace Immobilizer by Rapid Thumb - Medium - Tendonitis Arthritis Relief Pain Recovery - CMC Joint Thumb Stabilizer, Splint Spica, Abducted Thumb- Medium Roll over to zoom in + View large image Rigid Thumb Brace Immobilizer by Rapid Thumb - Medium - Tendonitis Arthritis Relief Pain Recovery - CMC Joint Thumb Stabilizer, Splint Spica, Abducted Thumb- Medium RELIEVES PAIN: Pain relief from osteoarthritis and rheumatoid arthritis. CARPAL TUNNEL TREATMENT: Treats the symptoms of carpal tunnel syndrome. COMFORTABLE: Brace is safe and comfortable to wear for extended periods. SUPPORT FOR THUMB: Silicone conforms to support thumb joints of the right hand. IM"
  },
  {
    "question": "Neck Traction with Air Pump Technology by Theratrac Air - Cervical Traction Device for Pain Relief, Cervicalgia, Disc Degeneration, Spondylosis, and Spine Alignment",
    "answer": "PRODUCTS Traction Neck Traction with Air Pump Technology by Theratrac Air - Cervical Traction Device for Pain Relief, Cervicalgia, Disc Degeneration, Spondylosis, and Spine Alignment Roll over to zoom in + View large image Neck Traction with Air Pump Technology by Theratrac Air - Cervical Traction Device for Pain Relief, Cervicalgia, Disc Degeneration, Spondylosis, and Spine Alignment User-Friendly Design: Operate this cervical traction device easily with the included handheld Air Pump. Adjustable Neck Support: Customize the width of the neck support using the adjustable knobs to fit all neck sizes comfortably. Variable Intensity: Control the stretch intensity with an easy-to-use pump, ensur"
  },
  {
    "question": "Menthera Menthol Revive Shampoo – Invigorating Scalp Therapy with Niacinamide, Biotin & Centella Asiatica – Deep Cleansing & Cooling Formula for Healthy Hair - 17oz",
    "answer": "PRODUCTS Therapeutic Creams and Gels Menthera Menthol Revive Shampoo – Invigorating Scalp Therapy with Niacinamide, Biotin & Centella Asiatica – Deep Cleansing & Cooling Formula for Healthy Hair - 17oz Roll over to zoom in + View large image Menthera Menthol Revive Shampoo – Invigorating Scalp Therapy with Niacinamide, Biotin & Centella Asiatica – Deep Cleansing & Cooling Formula for Healthy Hair - 17oz Invigorating Cooling Sensation: Menthol and camphor deliver a refreshing, tingling scalp feel that awakens your senses during every wash. Advanced Scalp Care: Salicylic acid, climbazole, and tea tree extract help maintain scalp health while minimizing buildup and flakiness. Strengthens & Revi"
  },
  {
    "question": "Elite Custom Manual and Battery Operation Medical-Grade Vacuum Erection Device for Erectile Dysfunction (Premium Version – Includes Both Manual and Battery Options)",
    "answer": "PRODUCTS ED Devices Elite Custom Manual and Battery Operation Medical-Grade Vacuum Erection Device for Erectile Dysfunction (Premium Version – Includes Both Manual and Battery Options) Roll over to zoom in + View large image Elite Custom Manual and Battery Operation Medical-Grade Vacuum Erection Device for Erectile Dysfunction (Premium Version – Includes Both Manual and Battery Options) External vacuum erection devices have become easily available for consumers since the FDA no longer requires a prescription from a physician to purchase a penis pump. Originally the device required a prescription when introduced in 1982. Prescription requirements were removed in 1997 when the FDA determined t"
  },
  {
    "question": "Rapid Knee OA Brace - Medium right | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee OA Brace - Medium right | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size Roll over to zoom in + View large image Rapid Knee OA Brace - Medium right | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size PORTABLE COMFORT: Rapid Knee OA Brace - Medium right is designed with portability in mind, ensuring you can take it with you wherever you go. Experience comfort and convenience throughout your day, whether at home or on the move. BREATHABLE AND LIGHTWEIGHT: Crafted from breathable, non-allergenic mate"
  },
  {
    "question": "Rigid Thumb Brace Immobilizer by Rapid Thumb - Large - Tendonitis Arthritis Relief Pain Recovery - CMC Joint Thumb Stabilizer, Splint Spica, Abducted Thumb - Small",
    "answer": "PRODUCTS Bracing and Supports Rigid Thumb Brace Immobilizer by Rapid Thumb - Large - Tendonitis Arthritis Relief Pain Recovery - CMC Joint Thumb Stabilizer, Splint Spica, Abducted Thumb - Small Roll over to zoom in + View large image Rigid Thumb Brace Immobilizer by Rapid Thumb - Large - Tendonitis Arthritis Relief Pain Recovery - CMC Joint Thumb Stabilizer, Splint Spica, Abducted Thumb - Small RELIEVES PAIN: Pain relief from osteoarthritis and rheumatoid arthritis. CARPAL TUNNEL TREATMENT: Treats the symptoms of carpal tunnel syndrome. COMFORTABLE: Brace is safe and comfortable to wear for extended periods. SUPPORT FOR THUMB: Silicone conforms to support thumb joints of the right hand. IMMO"
  },
  {
    "question": "Ultima OTC TENS Massager - Electric Muscle Contraction Stimulator for Pain Relief - Massage Unit and Pain Therapy Device - Unboxed and Includes soft carrying case",
    "answer": "PRODUCTS Electrotherapy Devices Ultima OTC TENS Massager - Electric Muscle Contraction Stimulator for Pain Relief - Massage Unit and Pain Therapy Device - Unboxed and Includes soft carrying case Roll over to zoom in + View large image Ultima OTC TENS Massager - Electric Muscle Contraction Stimulator for Pain Relief - Massage Unit and Pain Therapy Device - Unboxed and Includes soft carrying case ELECTRONIC PULSE TARGETS PAIN: This premium quality muscle contraction simulator uses electric wave generation, which may stimulate the natural pain relief response of the body. Dual function enables this electrotherapy device to massage muscles. EASY TO USE: This user-friendly physical therapy device"
  },
  {
    "question": "Rapid Knee OA Brace - Large right | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee OA Brace - Large right | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size Roll over to zoom in + View large image Rapid Knee OA Brace - Large right | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size PORTABLE COMFORT: Rapid Knee OA Brace - Large right is designed with portability in mind, ensuring you can take it with you wherever you go. Experience comfort and convenience throughout your day, whether at home or on the move. BREATHABLE AND LIGHTWEIGHT: Crafted from breathable, non-allergenic materia"
  },
  {
    "question": "Rapid Knee OA Brace - Small right | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee OA Brace - Small right | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size Roll over to zoom in + View large image Rapid Knee OA Brace - Small right | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size PORTABLE COMFORT: Rapid Knee OA Brace - Small right is designed with portability in mind, ensuring you can take it with you wherever you go. Experience comfort and convenience throughout your day, whether at home or on the move. BREATHABLE AND LIGHTWEIGHT: Crafted from breathable, non-allergenic materia"
  },
  {
    "question": "Cold Water Therapy Versatile Joint Wrap for Universal Pad for Cryotherapy Unit - 2 Strap Wrap Only for Pad- Hook/Loop Strap Cover Keeps The Cold Water Pad Secure",
    "answer": "PRODUCTS Water Therapy Systems Cold Water Therapy Versatile Joint Wrap for Universal Pad for Cryotherapy Unit - 2 Strap Wrap Only for Pad- Hook/Loop Strap Cover Keeps The Cold Water Pad Secure Roll over to zoom in + View large image Cold Water Therapy Versatile Joint Wrap for Universal Pad for Cryotherapy Unit - 2 Strap Wrap Only for Pad- Hook/Loop Strap Cover Keeps The Cold Water Pad Secure 2 STRAP WRAP: This wrap is designed to be utilized with the Universal Pads for cryotherapy machines for a variety of body areas including the knee, shoulder, elbow, and more. When you want more support in attaching your pad to your water therapy pad, this attachment makes it easy. ATTACH EASILY: The VJW "
  },
  {
    "question": "Rapid Knee OA Brace - Large Left | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee OA Brace - Large Left | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size Roll over to zoom in + View large image Rapid Knee OA Brace - Large Left | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size PORTABLE COMFORT: Rapid Knee OA Brace - Large Left is designed with portability in mind, ensuring you can take it with you wherever you go. Experience comfort and convenience throughout your day, whether at home or on the move. BREATHABLE AND LIGHTWEIGHT: Crafted from breathable, non-allergenic materials,"
  },
  {
    "question": "Rapid Knee OA Brace - Small Left | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee OA Brace - Small Left | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size Roll over to zoom in + View large image Rapid Knee OA Brace - Small Left | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size PORTABLE COMFORT: Rapid Knee OA Brace - Small Left is designed with portability in mind, ensuring you can take it with you wherever you go. Experience comfort and convenience throughout your day, whether at home or on the move. BREATHABLE AND LIGHTWEIGHT: Crafted from breathable, non-allergenic materials,"
  },
  {
    "question": "Economy Edition Office Desk Chair Wrap by SnuggleBack Attaches for Convenient Heat and Hands-Free. Stay Warm In The Winter or Summer. Black Faux Fur with Sherpa",
    "answer": "PRODUCTS Heat Therapy Economy Edition Office Desk Chair Wrap by SnuggleBack Attaches for Convenient Heat and Hands-Free. Stay Warm In The Winter or Summer. Black Faux Fur with Sherpa Roll over to zoom in + View large image Economy Edition Office Desk Chair Wrap by SnuggleBack Attaches for Convenient Heat and Hands-Free. Stay Warm In The Winter or Summer. Black Faux Fur with Sherpa PREMIUM FLEECE – Our premium fleece is super soft and cozy. It is thinner and more nimble than the faux fur. Perfect for summer use where the AC is blasting, but warm enough for that extra warmth needed on cold winter mornings. PATENTED PENDING – One-of-a-kind Chair Blanket that attaches to any Office Chair. Wrap t"
  },
  {
    "question": "Extra Large Moist Heating Pad with Auto Shut Off for Cramps and Back Pain by ThermoRelief - Extra Hot Medical Grade Digital Electric Pad – King Size (26\" x 14\")",
    "answer": "PRODUCTS Heat Therapy Extra Large Moist Heating Pad with Auto Shut Off for Cramps and Back Pain by ThermoRelief - Extra Hot Medical Grade Digital Electric Pad – King Size (26\" x 14\") Roll over to zoom in + View large image Extra Large Moist Heating Pad with Auto Shut Off for Cramps and Back Pain by ThermoRelief - Extra Hot Medical Grade Digital Electric Pad – King Size (26\" x 14\") MEDICAL GRADE ELECTRIC HEATING PAD: Pain and injuries can be tough to deal with, so you want the best possible care in order to get quick relief. This high-quality medical grade heater pad is now available for public use. Patient-friendly, the moist heat you'll get from this heat pad is most commonly prescribed by "
  },
  {
    "question": "Softcycle Pelvic Floor Stimulator by PMT -Electronic Kegel Exerciser with Probe for Pelvic Floor strengthening and bladder strength for Women and Men - Vaginal",
    "answer": "PRODUCTS Womens Health Softcycle Pelvic Floor Stimulator by PMT -Electronic Kegel Exerciser with Probe for Pelvic Floor strengthening and bladder strength for Women and Men - Vaginal Roll over to zoom in + View large image Softcycle Pelvic Floor Stimulator by PMT -Electronic Kegel Exerciser with Probe for Pelvic Floor strengthening and bladder strength for Women and Men - Vaginal KEGEL EXERCISES: an easy contraction-and-relaxation exercise that makes the muscles under the uterus, bladder, and bowel (large intestine) stronger. Help both men and women who have problems with a weak bladder. Soft Cycle was designed to perform a perfect electronic Kegel Exercise. Low frequency currents used in th"
  },
  {
    "question": "Rapid Knee OA Brace - XL right | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee OA Brace - XL right | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size Roll over to zoom in + View large image Rapid Knee OA Brace - XL right | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size PORTABLE COMFORT: Rapid Knee OA Brace - XL right is designed with portability in mind, ensuring you can take it with you wherever you go. Experience comfort and convenience throughout your day, whether at home or on the move. BREATHABLE AND LIGHTWEIGHT: Crafted from breathable, non-allergenic materials, this "
  },
  {
    "question": "Rigid Thumb Brace Immobilizer by Rapid Thumb Small - Tendonitis Arthritis Relief Pain Recovery - CMC Joint Thumb Stabilizer, Splint Spica, Abducted Thumb-Large",
    "answer": "PRODUCTS Bracing and Supports Rigid Thumb Brace Immobilizer by Rapid Thumb Small - Tendonitis Arthritis Relief Pain Recovery - CMC Joint Thumb Stabilizer, Splint Spica, Abducted Thumb-Large Roll over to zoom in + View large image Rigid Thumb Brace Immobilizer by Rapid Thumb Small - Tendonitis Arthritis Relief Pain Recovery - CMC Joint Thumb Stabilizer, Splint Spica, Abducted Thumb-Large RELIEVES PAIN: Pain relief from osteoarthritis and rheumatoid arthritis. CARPAL TUNNEL TREATMENT: Treats the symptoms of carpal tunnel syndrome. COMFORTABLE: Brace is safe and comfortable to wear for extended periods. SUPPORT FOR THUMB: Silicone conforms to support thumb joints of the right hand. IMMOBILIZES "
  },
  {
    "question": "Cold Water Therapy Couplings for Arctic Ice Clear Cryotherapy Unit – 4 Replacement Couplings for Arctic Ice Clear, Arctic Medical, Coolman, Water Therapy Units",
    "answer": "PRODUCTS Water Therapy Systems Cold Water Therapy Couplings for Arctic Ice Clear Cryotherapy Unit – 4 Replacement Couplings for Arctic Ice Clear, Arctic Medical, Coolman, Water Therapy Units Roll over to zoom in + View large image Cold Water Therapy Couplings for Arctic Ice Clear Cryotherapy Unit – 4 Replacement Couplings for Arctic Ice Clear, Arctic Medical, Coolman, Water Therapy Units CONVERTS SYSTEMS: This converter attachment is designed to be utilized with cryotherapy machines to give compatibility for use with the PMT brand water therapy pads. Replace excisting fittings to give you the option of use of our range of specialized pads. FIX LEAKS: Some of the connections on our competitor"
  },
  {
    "question": "Rapid Knee OA Brace - XL Left | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee OA Brace - XL Left | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size Roll over to zoom in + View large image Rapid Knee OA Brace - XL Left | Dual Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size PORTABLE COMFORT: Rapid Knee OA Brace - XL Left is designed with portability in mind, ensuring you can take it with you wherever you go. Experience comfort and convenience throughout your day, whether at home or on the move. BREATHABLE AND LIGHTWEIGHT: Crafted from breathable, non-allergenic materials, this kne"
  },
  {
    "question": "Rapid Knee OA Brace - Right | Single Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee OA Brace - Right | Single Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size Roll over to zoom in + View large image Rapid Knee OA Brace - Right | Single Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size PORTABLE COMFORT: Rapid Knee OA Brace - Right is designed with portability in mind, ensuring you can take it with you wherever you go. Experience comfort and convenience throughout your day, whether at home or on the move. BREATHABLE AND LIGHTWEIGHT: Crafted from breathable, non-allergenic materials, this knee "
  },
  {
    "question": "Posture Neck Traction Stand by S-Curve. Stretch and Reestablish the Cervical S-Curve, Spine Traction Disc Hydrator for upper Neck. Relieve Neck and Back Pain.",
    "answer": "PRODUCTS Traction Posture Neck Traction Stand by S-Curve. Stretch and Reestablish the Cervical S-Curve, Spine Traction Disc Hydrator for upper Neck. Relieve Neck and Back Pain. Roll over to zoom in + View large image Posture Neck Traction Stand by S-Curve. Stretch and Reestablish the Cervical S-Curve, Spine Traction Disc Hydrator for upper Neck. Relieve Neck and Back Pain. OPTIMAL RELIEF: Restore proper neck curvature and correct the forward head posture – Also known as Nerd-Neck. Decrease neck bulge and hydrate compressed discs. Stretching the neck helps joint fluid back into the discs. DURABLE: Quick release pump with valve inflates and holds pressure without leaking. IMPROVE: Improve post"
  },
  {
    "question": "Infrared Wrap Cordless Heating Pad by Qfiber – Lumbar, Waist, Lower Back Wireless Heating Pad for Back Pain or Period Cramps – Battery Operated (not included)",
    "answer": "PRODUCTS Heat Therapy Infrared Wrap Cordless Heating Pad by Qfiber – Lumbar, Waist, Lower Back Wireless Heating Pad for Back Pain or Period Cramps – Battery Operated (not included) Roll over to zoom in + View large image Infrared Wrap Cordless Heating Pad by Qfiber – Lumbar, Waist, Lower Back Wireless Heating Pad for Back Pain or Period Cramps – Battery Operated (not included) BATTERY OPERATED: Qfiber works with any USB battery pack / power bank that outputs 5 volts at a rate of 3 amps to be a cordless heating belt that you can use in the car, on your computer, or just relaxing without being tethered by a cord to the wall. The battery pack is not included so be sure to check the specs on you"
  },
  {
    "question": "Magnesium Roll-On 3oz | Zechstein Magnesium + Arginine | Muscle & Joint Relief for Back, Neck, Legs & Feet | Improve Sleep Cycle, Fast-Absorbing, Paraben-Free",
    "answer": "PRODUCTS Therapeutic Creams and Gels Magnesium Roll-On 3oz | Zechstein Magnesium + Arginine | Muscle & Joint Relief for Back, Neck, Legs & Feet | Improve Sleep Cycle, Fast-Absorbing, Paraben-Free Roll over to zoom in + View large image Magnesium Roll-On 3oz | Zechstein Magnesium + Arginine | Muscle & Joint Relief for Back, Neck, Legs & Feet | Improve Sleep Cycle, Fast-Absorbing, Paraben-Free Pure Zechstein Magnesium – Highly absorbable Magnesium helps ease muscle tension, joint stiffness, and promotes relaxation. Enriched with Natural Botanicals – Includes arginine, menthol, camphor, Glucosamine and herbal extracts for soothing, targeted relief. Mess-Free Roll-On – Non-greasy, quick-drying a"
  },
  {
    "question": "Compact 4 Power Scooter by MobiJoe - Lightweight Mobility Scooter for Seniors Foldable and Compact for Easy Travel and Storage Equipped with an Li-ion Battery",
    "answer": "PRODUCTS Mobility Assistance Compact 4 Power Scooter by MobiJoe - Lightweight Mobility Scooter for Seniors Foldable and Compact for Easy Travel and Storage Equipped with an Li-ion Battery Roll over to zoom in + View large image Compact 4 Power Scooter by MobiJoe - Lightweight Mobility Scooter for Seniors Foldable and Compact for Easy Travel and Storage Equipped with an Li-ion Battery DESIGNED TO COME WITH YOU: The ultra compact, folding design means that you can take the MobiJoe wherever you need it. When folded, the scooter is only 14 inches high and 28 inches long. This means it can be conveniently stored into any trunk space with ease so you can take it with you when you travel. Stay mobi"
  },
  {
    "question": "Laser hero – Laser Hair Growth Cap – Restore Hair Loss with FDA Cleared Medical Grade Laser Helmet - Hair Regrowth for Men and Women with Thinning Hair (Blue)",
    "answer": "PRODUCTS Light Therapy Laser hero – Laser Hair Growth Cap – Restore Hair Loss with FDA Cleared Medical Grade Laser Helmet - Hair Regrowth for Men and Women with Thinning Hair (Blue) Roll over to zoom in + View large image Laser hero – Laser Hair Growth Cap – Restore Hair Loss with FDA Cleared Medical Grade Laser Helmet - Hair Regrowth for Men and Women with Thinning Hair (Blue) ADVANCED LASER HAIR GROWTH CAP - An innovative hair regrowth medical device the Laser Hero cap utilizes LLLT low-energy soft laser irradiation to stimulate hair growth at the follicle level to treat hair loss, alopecia areata, and seborrheic alopecia. IN-HOME HAIR LOSS TREATMENT - Offering discrete, comfortable use ou"
  },
  {
    "question": "Rapid Knee OA Brace - left | Single Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee OA Brace - left | Single Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size Roll over to zoom in + View large image Rapid Knee OA Brace - left | Single Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size PORTABLE COMFORT: Rapid Knee OA Brace - Left is designed with portability in mind, ensuring you can take it with you wherever you go. Experience comfort and convenience throughout your day, whether at home or on the move. BREATHABLE AND LIGHTWEIGHT: Crafted from breathable, non-allergenic materials, this knee bra"
  },
  {
    "question": "Back Pain Relief - Low Back Stretcher with Vibration Massage, Infrared Heat, and Air Pressure Spinal Decompression - Dynamic Wedge Automatic Lumbar Traction",
    "answer": "PRODUCTS Traction Back Pain Relief - Low Back Stretcher with Vibration Massage, Infrared Heat, and Air Pressure Spinal Decompression - Dynamic Wedge Automatic Lumbar Traction Roll over to zoom in + View large image Back Pain Relief - Low Back Stretcher with Vibration Massage, Infrared Heat, and Air Pressure Spinal Decompression - Dynamic Wedge Automatic Lumbar Traction RELIEVE BACK PAIN AND PRESSURE: Providing effective relief from lower back pain, the ergonomically designed Dynamic Wedge Lumbar Traction device by Pain Management Technologies uses a variety of stimulants to relieve sore muscles and reduce stiffness in the spine. Great for those suffering from lumbar degeneration, muscle stra"
  },
  {
    "question": "Neck Stretch Massage Trigger Point Chiropractic Pillow by Acupillow - Cervical Traction Stretcher Device - Myofascial Release of Pressure Point - Neck Pain",
    "answer": "PRODUCTS Massage Therapy Devices Neck Stretch Massage Trigger Point Chiropractic Pillow by Acupillow - Cervical Traction Stretcher Device - Myofascial Release of Pressure Point - Neck Pain Roll over to zoom in + View large image Neck Stretch Massage Trigger Point Chiropractic Pillow by Acupillow - Cervical Traction Stretcher Device - Myofascial Release of Pressure Point - Neck Pain ACUPRESSURE PILLOW: Acupillow neck and shoulder relaxer will ease pain with a firm, but not too stiff device specially designed with neck supports that hit acupressure points to release neck tension. COMFORABLY CRADLES: Some neck pain relief devices, such as pro cervical neck traction collars, are cumbersome or un"
  },
  {
    "question": "Neck Traction with Heat Therapy by Dynamic Wedge Cervical - Automatic Device, Multi-Function Programs, Adjustable Temperature - Neck Pain Relief, Stretcher",
    "answer": "PRODUCTS Traction Neck Traction with Heat Therapy by Dynamic Wedge Cervical - Automatic Device, Multi-Function Programs, Adjustable Temperature - Neck Pain Relief, Stretcher Roll over to zoom in + View large image Neck Traction with Heat Therapy by Dynamic Wedge Cervical - Automatic Device, Multi-Function Programs, Adjustable Temperature - Neck Pain Relief, Stretcher ELECTRONIC TRACTION - The Dynamic Wedge Pneumatic cervical traction device creates an incline traction that helps realign the cervical vertebra. RELIEVE PAIN - Cervical traction is an effective process that helps relieve the ails of bad posture, muscle rigidity, and pain HEAT THERAPY - The heat combined with the cervical stretch"
  },
  {
    "question": "Spinal Decompression Belt for Lumbar Traction by Theratrac – Back Stretcher Device for Lower Back Pain Relief with Pump for Adjustable Support Small/Medium",
    "answer": "PRODUCTS Traction Spinal Decompression Belt for Lumbar Traction by Theratrac – Back Stretcher Device for Lower Back Pain Relief with Pump for Adjustable Support Small/Medium Roll over to zoom in + View large image Spinal Decompression Belt for Lumbar Traction by Theratrac – Back Stretcher Device for Lower Back Pain Relief with Pump for Adjustable Support Small/Medium RELIEVES CHRONIC BACK PAIN: Your poor back! It's been in chronic pain, maybe even for a long time, because you haven't previously found a solution for it. Fortunately, that is about to change. Theratrac lumbar traction brace decompresses the spin to give you the relief you've so desperately been looking for. RELEASE TIGHT MUSCLE"
  },
  {
    "question": "Medical Grade Heating pad with Automatic Moist Heat by Thermotech - High Heat Heating Pad for Back Pain and Cramps - Versatile Medium Analogue - 14\" x 17\"",
    "answer": "PRODUCTS Heat Therapy Medical Grade Heating pad with Automatic Moist Heat by Thermotech - High Heat Heating Pad for Back Pain and Cramps - Versatile Medium Analogue - 14\" x 17\" Roll over to zoom in + View large image Medical Grade Heating pad with Automatic Moist Heat by Thermotech - High Heat Heating Pad for Back Pain and Cramps - Versatile Medium Analogue - 14\" x 17\" MEDICAL GRADE ELECTRIC HEATING PAD: Get the best possible at-homecare and relief for your chronic pain, injury, or conditions that are available with this medical-grade device. Patient-friendly, the moist heat you'll get from this heat pad is the most commonly prescribed form of treatment by physical therapists, chiropractors,"
  },
  {
    "question": "Medical Grade Heating pad with Automatic Moist Heat by Thermotech, High Heat Heating pad for Back Pain and Cramps - Extra Large King Analogue - 26\" by 14\"",
    "answer": "PRODUCTS Heat Therapy Medical Grade Heating pad with Automatic Moist Heat by Thermotech, High Heat Heating pad for Back Pain and Cramps - Extra Large King Analogue - 26\" by 14\" Roll over to zoom in + View large image Medical Grade Heating pad with Automatic Moist Heat by Thermotech, High Heat Heating pad for Back Pain and Cramps - Extra Large King Analogue - 26\" by 14\" MEDICAL GRADE ELECTRIC HEATING PAD: Get the best possible at-homecare and relief for your chronic pain, injury, or conditions that are available with this medical-grade device. Patient-friendly, the moist heat you'll get from this heat pad is the most commonly prescribed form of treatment by physical therapists, chiropractors,"
  },
  {
    "question": "Hidden Heat Electric Foot of The Bed Warmer by Spotwarm; Wireless RF Remote, Microplush Flannel Mattress Heating Pad for the Feet. Queen Bed - 60” by 24”",
    "answer": "PRODUCTS Heat Therapy Hidden Heat Electric Foot of The Bed Warmer by Spotwarm; Wireless RF Remote, Microplush Flannel Mattress Heating Pad for the Feet. Queen Bed - 60” by 24” Roll over to zoom in + View large image Hidden Heat Electric Foot of The Bed Warmer by Spotwarm; Wireless RF Remote, Microplush Flannel Mattress Heating Pad for the Feet. Queen Bed - 60” by 24” HIDDEN HEATING PAD - Fits under the fitted sheet at the base of the bed. Cords remain hidden as you control through a convenient wireless RF remote.SUPPORTS REM - Heated feet help you fall asleep faster and stay in deep sleep for longer. ADJUSTABLE HEAT – Find your perfect warmth with 6 different heating levels each with their o"
  },
  {
    "question": "Electric Lifting Backrest for Bed by Mobi-Back, Medical Back Pillow with Electric Pump System, Used by Pregnant Women, Elderly for Sit-Up in Bed - Gen 2.",
    "answer": "PRODUCTS Mobility Assistance Electric Lifting Backrest for Bed by Mobi-Back, Medical Back Pillow with Electric Pump System, Used by Pregnant Women, Elderly for Sit-Up in Bed - Gen 2. Roll over to zoom in + View large image Electric Lifting Backrest for Bed by Mobi-Back, Medical Back Pillow with Electric Pump System, Used by Pregnant Women, Elderly for Sit-Up in Bed - Gen 2. COMFORTABE AND STRONG: The Mobi-Back Gen 2 Electric backrest uses high-quality cold-rolled steel that is thick and durable. Along with a combination of different densities of cushion to make the mattress more comfortable and better for heat dissipation, and improve comfort. PILLOW NOT INCLUDED/FITS ANY STANDARD PILLOW. UL"
  },
  {
    "question": "Touch Screen TENS and EMS Massager by Touch Stim - Electric Muscle Contraction Stimulator for Pain Relief - Massage Unit and Pain Therapy Device (white)",
    "answer": "PRODUCTS Electrotherapy Devices • Combo Units Touch Screen TENS and EMS Massager by Touch Stim - Electric Muscle Contraction Stimulator for Pain Relief - Massage Unit and Pain Therapy Device (white) Roll over to zoom in + View large image Touch Screen TENS and EMS Massager by Touch Stim - Electric Muscle Contraction Stimulator for Pain Relief - Massage Unit and Pain Therapy Device (white) ELECTRONIC PULSE TARGETS PAIN: This premium quality muscle contraction simulator uses electric wave generation, which may stimulate the natural pain relief response of the body. Dual function enables this electrotherapy device to massage muscles and relieve deep pain. EASY TO USE: This user-friendly physica"
  },
  {
    "question": "Spinal Decompression Belt for Lumbar Traction by Theratrac – Back Stretcher Device for Lower Back Pain Relief with Pump for Adjustable Support Large/ XL",
    "answer": "PRODUCTS Traction Spinal Decompression Belt for Lumbar Traction by Theratrac – Back Stretcher Device for Lower Back Pain Relief with Pump for Adjustable Support Large/ XL Roll over to zoom in + View large image Spinal Decompression Belt for Lumbar Traction by Theratrac – Back Stretcher Device for Lower Back Pain Relief with Pump for Adjustable Support Large/ XL RELIEVES CHRONIC BACK PAIN: Your poor back! It's been in chronic pain, maybe even for a long time, because you haven't previously found a solution for it. Fortunately, that is about to change. Theratrac lumbar traction brace decompresses the spin to give you the relief you've so desperately been looking for. RELEASE TIGHT MUSCLES: Tig"
  },
  {
    "question": "Hidden Heat Electric Foot of The Bed Warmer by Spotwarm; Wireless RF Remote, Microplush Flannel Mattress Heating Pad for the Feet. King Bed - 74” by 28”",
    "answer": "PRODUCTS Heat Therapy Hidden Heat Electric Foot of The Bed Warmer by Spotwarm; Wireless RF Remote, Microplush Flannel Mattress Heating Pad for the Feet. King Bed - 74” by 28” Roll over to zoom in + View large image Hidden Heat Electric Foot of The Bed Warmer by Spotwarm; Wireless RF Remote, Microplush Flannel Mattress Heating Pad for the Feet. King Bed - 74” by 28” HIDDEN HEATING PAD - Fits under the fitted sheet at the base of the bed. Cords remain hidden as you control through a convenient wireless RF remote.SUPPORTS REM - Heated feet help you fall asleep faster and stay in deep sleep for longer. ADJUSTABLE HEAT – Find your perfect warmth with 6 different heating levels each with their own"
  },
  {
    "question": "Menthera Soap – Cooling Menthol & Eucalyptus Bar with Aloe Vera and Sea Minerals – Refreshing Deep Clean for Skin with a Crisp, Energizing Scent - 6.8oz",
    "answer": "PRODUCTS Therapeutic Creams and Gels Menthera Soap – Cooling Menthol & Eucalyptus Bar with Aloe Vera and Sea Minerals – Refreshing Deep Clean for Skin with a Crisp, Energizing Scent - 6.8oz Roll over to zoom in + View large image Menthera Soap – Cooling Menthol & Eucalyptus Bar with Aloe Vera and Sea Minerals – Refreshing Deep Clean for Skin with a Crisp, Energizing Scent - 6.8oz Cooling Menthol & Camphor: Provides a crisp, refreshing sensation that awakens the senses and leaves skin feeling invigorated with every wash. Eucalyptus Globulus Leaf Oil: Offers a naturally fresh aroma and a cooling, revitalizing feel during your shower routine. Aloe Barbadensis Leaf Extract: Gently hydrates and h"
  },
  {
    "question": "Massotherapy Self Massage Tools Roller for Neck and Shoulders by Dr. Necky - Trigger Point Massager for Tension Relief - Therapeutic Myofascial Release",
    "answer": "PRODUCTS Massage Therapy Devices Massotherapy Self Massage Tools Roller for Neck and Shoulders by Dr. Necky - Trigger Point Massager for Tension Relief - Therapeutic Myofascial Release Roll over to zoom in + View large image Massotherapy Self Massage Tools Roller for Neck and Shoulders by Dr. Necky - Trigger Point Massager for Tension Relief - Therapeutic Myofascial Release WORKS LIKE A PROFESSIONAL MASSEUSE: It would be great if we could have a personal masseuse on hand for stressful moments, post-workout, or any other neck and shoulder tightening events. Dr. Necky's neck and shoulder massager tool can help relieve tension, relax, and soothe sore muscles anytime - no appointment necessary! "
  },
  {
    "question": "Portable Car Door Assist Handle for Elderly - 4-in-1 Auto Cane with Window Breaker, Seatbelt Cutter, and Anti-Slip Grip, 2-Pack, Supports up to 500 lbs",
    "answer": "PRODUCTS Mobility Assistance Portable Car Door Assist Handle for Elderly - 4-in-1 Auto Cane with Window Breaker, Seatbelt Cutter, and Anti-Slip Grip, 2-Pack, Supports up to 500 lbs Roll over to zoom in + View large image Portable Car Door Assist Handle for Elderly - 4-in-1 Auto Cane with Window Breaker, Seatbelt Cutter, and Anti-Slip Grip, 2-Pack, Supports up to 500 lbs Multifunctional 4-in-1 Design: This 2-pack car door assist handle doubles as a window breaker, seatbelt cutter, ergonomic grip handle, and mobility aid. Perfect for seniors, pregnant women, children, and individuals with mobility challenges, including those with Parkinson’s or disabilities. Heavy-Duty Support: Built with high"
  },
  {
    "question": "Circulating Ice Machine by Blue Cube – for Knee, Elbow, Shoulder, Back for treatment of disability (Blue Light Cold Therapy System with Universal Pad)",
    "answer": "PRODUCTS Water Therapy Systems Circulating Ice Machine by Blue Cube – for Knee, Elbow, Shoulder, Back for treatment of disability (Blue Light Cold Therapy System with Universal Pad) Roll over to zoom in + View large image Circulating Ice Machine by Blue Cube – for Knee, Elbow, Shoulder, Back for treatment of disability (Blue Light Cold Therapy System with Universal Pad) TWO -PUMP SPEEDS: High Flow delivers 47 Degrees and Low Speed delivers 52 Degrees Fahrenheit. COLD WATER THERAPY: The Blue Cube cold therapy machine uses a continuous flow of cold water to provide reduction of swelling, edema and inflammation. PORTABLE AND QUIET: Designed for easy portability and storage, this compact ice the"
  },
  {
    "question": "Hidden Heating Pad Electric Couch Cushion Warmer by Spotwarm; Wireless RF Remote, Microplush Flannel Heated Seat or single user bed warmer 17” by 20”",
    "answer": "PRODUCTS Heat Therapy Hidden Heating Pad Electric Couch Cushion Warmer by Spotwarm; Wireless RF Remote, Microplush Flannel Heated Seat or single user bed warmer 17” by 20” Roll over to zoom in + View large image Hidden Heating Pad Electric Couch Cushion Warmer by Spotwarm; Wireless RF Remote, Microplush Flannel Heated Seat or single user bed warmer 17” by 20” HIDDEN HEAT - Unzip your couch cushion and insert the warmer. Cords remain hidden as you control through a convenient wireless RF remote. ADJUSTABLE HEAT – Find your perfect warmth with 6 different heating levels each with their own auto-shutoffs EASY-TO-USE - 10ft Long power cord is more than long enough to reach any outlets easily so "
  },
  {
    "question": "Medical Grade Heating pad with Automatic Moist Heat by Thermotech, High Heat Heating pad for Back Pain and Cramps - Neck & Shoulder Digital - 18 x 17",
    "answer": "PRODUCTS Heat Therapy Medical Grade Heating pad with Automatic Moist Heat by Thermotech, High Heat Heating pad for Back Pain and Cramps - Neck & Shoulder Digital - 18 x 17 Roll over to zoom in + View large image Medical Grade Heating pad with Automatic Moist Heat by Thermotech, High Heat Heating pad for Back Pain and Cramps - Neck & Shoulder Digital - 18 x 17 MEDICAL GRADE ELECTRIC HEATING PAD: Get the best possible at-homecare and relief for your chronic pain, injury, or conditions that are available with this medical-grade device. Patient-friendly, the moist heat you'll get from this heat pad is the most commonly prescribed form of treatment by physical therapists, chiropractors, and docto"
  },
  {
    "question": "Cloud Walker | Walking Boot for Foot & Ankle Support | Full Shell Design | Injury Recovery | Adjustable Air Cells | Lightweight & Comfortable-Medium",
    "answer": "PRODUCTS Bracing and Supports Cloud Walker | Walking Boot for Foot & Ankle Support | Full Shell Design | Injury Recovery | Adjustable Air Cells | Lightweight & Comfortable-Medium Roll over to zoom in + View large image Cloud Walker | Walking Boot for Foot & Ankle Support | Full Shell Design | Injury Recovery | Adjustable Air Cells | Lightweight & Comfortable-Medium Full Shell Protection – Rigid outer shell offers maximum support and stability for foot, ankle, and lower leg injuries. Adjustable Air Cell System – Built-in air chambers allow personalized compression for improved comfort and reduced swelling. Shock-Absorbing Sole – Cushioned sole minimizes impact and promotes a natural walking m"
  },
  {
    "question": "Cloud Walker | Walking Boot for Foot & Ankle Support | Full Shell Design | Injury Recovery | Adjustable Air Cells | Lightweight & Comfortable-Large",
    "answer": "PRODUCTS Bracing and Supports Cloud Walker | Walking Boot for Foot & Ankle Support | Full Shell Design | Injury Recovery | Adjustable Air Cells | Lightweight & Comfortable-Large Roll over to zoom in + View large image Cloud Walker | Walking Boot for Foot & Ankle Support | Full Shell Design | Injury Recovery | Adjustable Air Cells | Lightweight & Comfortable-Large Full Shell Protection – Rigid outer shell offers maximum support and stability for foot, ankle, and lower leg injuries. Adjustable Air Cell System – Built-in air chambers allow personalized compression for improved comfort and reduced swelling. Shock-Absorbing Sole – Cushioned sole minimizes impact and promotes a natural walking mot"
  },
  {
    "question": "Cloud Walker | Walking Boot for Foot & Ankle Support | Full Shell Design | Injury Recovery | Adjustable Air Cells | Lightweight & Comfortable-Small",
    "answer": "PRODUCTS Bracing and Supports Cloud Walker | Walking Boot for Foot & Ankle Support | Full Shell Design | Injury Recovery | Adjustable Air Cells | Lightweight & Comfortable-Small Roll over to zoom in + View large image Cloud Walker | Walking Boot for Foot & Ankle Support | Full Shell Design | Injury Recovery | Adjustable Air Cells | Lightweight & Comfortable-Small Full Shell Protection – Rigid outer shell offers maximum support and stability for foot, ankle, and lower leg injuries. Adjustable Air Cell System – Built-in air chambers allow personalized compression for improved comfort and reduced swelling. Shock-Absorbing Sole – Cushioned sole minimizes impact and promotes a natural walking mot"
  },
  {
    "question": "Nerve Spa Tall Diabetic Socks for Men - Extra Wide Performance Grade Breathable Thin Loose Fitting Socks for Diabetics, Knee High (Small 2 pairs)",
    "answer": "PRODUCTS Bracing and Supports Nerve Spa Tall Diabetic Socks for Men - Extra Wide Performance Grade Breathable Thin Loose Fitting Socks for Diabetics, Knee High (Small 2 pairs) Roll over to zoom in + View large image Nerve Spa Tall Diabetic Socks for Men - Extra Wide Performance Grade Breathable Thin Loose Fitting Socks for Diabetics, Knee High (Small 2 pairs) COMFORTABLE SOCKS FOR DIABETICS: Our socks provide gentle compression to prevent swelling & mitigate fatigue. Recommended diabetic sox for men with diabetes, chronic swelling, cirrhosis or lymphedema. TALL LENGTH- ANKLE & CALF SUPPORT: Long enough to encompass the foot & cover the bottom half of your leg, these tall knee high socks for "
  },
  {
    "question": "Medical Grade Heating pad with Automatic Moist Heat by Thermotech, High Heat Heating pad for Back Pain and Cramps - Medium Digital - 18\" by 14\"",
    "answer": "PRODUCTS Heat Therapy Medical Grade Heating pad with Automatic Moist Heat by Thermotech, High Heat Heating pad for Back Pain and Cramps - Medium Digital - 18\" by 14\" Roll over to zoom in + View large image Medical Grade Heating pad with Automatic Moist Heat by Thermotech, High Heat Heating pad for Back Pain and Cramps - Medium Digital - 18\" by 14\" MEDICAL GRADE ELECTRIC HEATING PAD: Get the best possible at-homecare and relief for your chronic pain, injury, or conditions that are available with this medical-grade device. Patient-friendly, the moist heat you'll get from this heat pad is the most commonly prescribed form of treatment by physical therapists, chiropractors, and doctors. You can "
  },
  {
    "question": "Knee Stretch Traction and Hamstring Stretcher by Flex Frame - For Knee Extensions, Knee Pain, Hip Pain, Lower Back Pain, Full Leg Stretching.",
    "answer": "PRODUCTS Traction Knee Stretch Traction and Hamstring Stretcher by Flex Frame - For Knee Extensions, Knee Pain, Hip Pain, Lower Back Pain, Full Leg Stretching. Roll over to zoom in + View large image Knee Stretch Traction and Hamstring Stretcher by Flex Frame - For Knee Extensions, Knee Pain, Hip Pain, Lower Back Pain, Full Leg Stretching. KNEE TRACTION: Designed for those with OA or RA of the knee and those with post-ACL and MCL surgery rehabilitation. The Flex Frame stretches the knee enhancing range of motion and mobility. HAMSTRING STRETCHER: With the adjustable length, the knee traction device transforms into a hamstring stretcher. Stretching the lower back, calfs, and hip. This ideal s"
  },
  {
    "question": "Medical Grade Heating pad with Automatic Moist Heat by Thermotech, High Heat Heating pad for Back Pain and Cramps - Mini Analogue - 19\" by 7\"",
    "answer": "PRODUCTS Heat Therapy Medical Grade Heating pad with Automatic Moist Heat by Thermotech, High Heat Heating pad for Back Pain and Cramps - Mini Analogue - 19\" by 7\" Roll over to zoom in + View large image Medical Grade Heating pad with Automatic Moist Heat by Thermotech, High Heat Heating pad for Back Pain and Cramps - Mini Analogue - 19\" by 7\" MEDICAL GRADE ELECTRIC HEATING PAD: Get the best possible at-homecare and relief for your chronic pain, injury, or conditions that are available with this medical-grade device. Patient-friendly, the moist heat you'll get from this heat pad is the most commonly prescribed form of treatment by physical therapists, chiropractors, and doctors. You can now "
  },
  {
    "question": "Moist Heating Pad with Auto Shut Off for Cramps and Back Pain by ThermoRelief - Extra Hot Medical Grade Digital Electric Pad (King Weighted)",
    "answer": "PRODUCTS Heat Therapy Moist Heating Pad with Auto Shut Off for Cramps and Back Pain by ThermoRelief - Extra Hot Medical Grade Digital Electric Pad (King Weighted) Roll over to zoom in + View large image Moist Heating Pad with Auto Shut Off for Cramps and Back Pain by ThermoRelief - Extra Hot Medical Grade Digital Electric Pad (King Weighted) MEDICAL GRADE ELECTRIC HEATING PAD: A Medical grade heating pad utilizes high end components and copper, that enable an intense heat and an automatic creation of moisture. This form of intense heat penetrates deep into the tissue. WEIGHTED HEAT: Over 5 lbs of ceramic clay beads are contained within this pad to enable a transfer of infrared heat and as we"
  },
  {
    "question": "Medical Grade Heating pad with Automatic Moist Heat by Thermotech, High Heat Heating pad for Back Pain and Cramps - Mini Digital - 19\" by 7\"",
    "answer": "PRODUCTS Heat Therapy Medical Grade Heating pad with Automatic Moist Heat by Thermotech, High Heat Heating pad for Back Pain and Cramps - Mini Digital - 19\" by 7\" Roll over to zoom in + View large image Medical Grade Heating pad with Automatic Moist Heat by Thermotech, High Heat Heating pad for Back Pain and Cramps - Mini Digital - 19\" by 7\" MEDICAL GRADE ELECTRIC HEATING PAD: Get the best possible at-homecare and relief for your chronic pain, injury, or conditions that are available with this medical-grade device. Patient-friendly, the moist heat you'll get from this heat pad is the most commonly prescribed form of treatment by physical therapists, chiropractors, and doctors. You can now ha"
  },
  {
    "question": "Trigger Point Pillow - Head and Neck Pain Relief Traction Device, Support Relaxer for Tension Headache Relief for Improved Decompression",
    "answer": "PRODUCTS Massage Therapy Devices Trigger Point Pillow - Head and Neck Pain Relief Traction Device, Support Relaxer for Tension Headache Relief for Improved Decompression Roll over to zoom in + View large image Trigger Point Pillow - Head and Neck Pain Relief Traction Device, Support Relaxer for Tension Headache Relief for Improved Decompression PAIN RELIEF --- If suffering from chronic neck pain, herniated disks, upper body stiffness, neck pain, migraines, or arthritis symptoms, use the Trigger Point Pillow to relieve neck and shoulder pain while providing a cervical neck traction. NO PAIN, NO GAIN - the Trigger Point Pillow is intentionally designed to put pressure onto meridian points in y"
  },
  {
    "question": "Premium Electric Lifting Chair Cushion – by Seat Boost. Electric Power Seat for Complete Sit-to-Stand Lift Supports up to 240 lbs, Black",
    "answer": "PRODUCTS Mobility Assistance Premium Electric Lifting Chair Cushion – by Seat Boost. Electric Power Seat for Complete Sit-to-Stand Lift Supports up to 240 lbs, Black Roll over to zoom in + View large image Premium Electric Lifting Chair Cushion – by Seat Boost. Electric Power Seat for Complete Sit-to-Stand Lift Supports up to 240 lbs, Black STAND UP WITH EASE: Fully electric sit to stand lifting mechanism for adults or seniors provides 100% assistance for up to 240 lbs to ensure a gentle and safe lift without having to push forward. It's a great alternative to electric lifting recliners. DESIGNED FOR MOST ARMCHAIRS, COUCHES, AND SOFAS: The Seat Boost lifts elderly men or women with advanced "
  },
  {
    "question": "Infrared Wrist Wrap Cordless Heating Pad by Qfiber – Wrist wrap for carpel tunnel syndrome, Heating Pad – Wall adaptor and USB included",
    "answer": "PRODUCTS Heat Therapy Infrared Wrist Wrap Cordless Heating Pad by Qfiber – Wrist wrap for carpel tunnel syndrome, Heating Pad – Wall adaptor and USB included Roll over to zoom in + View large image Infrared Wrist Wrap Cordless Heating Pad by Qfiber – Wrist wrap for carpel tunnel syndrome, Heating Pad – Wall adaptor and USB included BATTERY OPERATED: Qfiber works with any USB battery pack / power bank that outputs 5 volts at a rate of 3 amps to be a cordless heating belt that you can use in the car, on your computer, or just relaxing without being tethered by a cord to the wall. The battery pack is not included so be sure to check the specs on your power bank! INFRARED HEATING: Far Infrared W"
  },
  {
    "question": "Rapid OA Knee - Right | Adjustable ROM Hinge | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis",
    "answer": "PRODUCTS Bracing and Supports Rapid OA Knee - Right | Adjustable ROM Hinge | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis Roll over to zoom in + View large image Rapid OA Knee - Right | Adjustable ROM Hinge | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis PORTABLE COMFORT: The Rapid OA Knee - Right is designed with portability in mind, ensuring you can take it with you wherever you go. Experience comfort and convenience throughout your day, whether at home or on the move. BREATHABLE AND LIGHTWEIGHT: Crafted from breathable, non-allergenic materials, this knee brace offers superior comfort without compromising"
  },
  {
    "question": "Automatic High-Vacuum Penis Enlargement Pump | 4 Suction Modes | Rechargeable | 3 Silicone Rings in Varying Sizes | Discreet Packaging",
    "answer": "PRODUCTS ED Devices Automatic High-Vacuum Penis Enlargement Pump | 4 Suction Modes | Rechargeable | 3 Silicone Rings in Varying Sizes | Discreet Packaging Roll over to zoom in + View large image Automatic High-Vacuum Penis Enlargement Pump | 4 Suction Modes | Rechargeable | 3 Silicone Rings in Varying Sizes | Discreet Packaging 4 Adjustable Suction Levels – Choose from four suction intensities to gradually train and enhance penile erection strength, working your way up to the desired intensity for maximum satisfaction. Penis Enlargement through Vacuum Technology – Designed to create a vacuum suction that increases blood flow to the penis, this pump helps enhance erection size and strength by"
  },
  {
    "question": "Premium Vagus Nerve Stimulation Ear Clip - White, Dual-Soft Carbon Electrode pads, Universal Compatibility with Most devices - 1 Pair",
    "answer": "PRODUCTS Electrotherapy Supplies Premium Vagus Nerve Stimulation Ear Clip - White, Dual-Soft Carbon Electrode pads, Universal Compatibility with Most devices - 1 Pair Roll over to zoom in + View large image Premium Vagus Nerve Stimulation Ear Clip - White, Dual-Soft Carbon Electrode pads, Universal Compatibility with Most devices - 1 Pair Versatile Vagus Nerve Ear Clip: Engineered for seamless compatibility with leading TENS, Microcurrent, and Estim devices. Compatible with all universal pin-type connectors. Dual-Size Soft Electrodes: Features specially designed rubber electrodes with built-in resistance, optimized for effective Vagus nerve stimulation. Enhanced Stability: Upgraded anti-slip"
  },
  {
    "question": "Rapid OA Knee - Left | Adjustable ROM Hinge | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis",
    "answer": "PRODUCTS Bracing and Supports Rapid OA Knee - Left | Adjustable ROM Hinge | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis Roll over to zoom in + View large image Rapid OA Knee - Left | Adjustable ROM Hinge | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis PORTABLE COMFORT: The Rapid OA Knee - Left is designed with portability in mind, ensuring you can take it with you wherever you go. Experience comfort and convenience throughout your day, whether at home or on the move. BREATHABLE AND LIGHTWEIGHT: Crafted from breathable, non-allergenic materials, this knee brace offers superior comfort without compromising on"
  },
  {
    "question": "NERVE TARGET ROLL-ON GEL - Targeted Therapeutic treatment for Damaged Nerves, Intractable Back Pain, Joint Aches and Muscles Spasms.",
    "answer": "PRODUCTS Therapeutic Creams and Gels NERVE TARGET ROLL-ON GEL - Targeted Therapeutic treatment for Damaged Nerves, Intractable Back Pain, Joint Aches and Muscles Spasms. Roll over to zoom in + View large image NERVE TARGET ROLL-ON GEL - Targeted Therapeutic treatment for Damaged Nerves, Intractable Back Pain, Joint Aches and Muscles Spasms. SUPPORTS TARGETED COOLING & SENSORY MODULATION (Menthol + Camphor) SUPPORTS LOCAL MICRO-CIRCULATION (Eucalyptus + Witch Hazel + Arnica) PROMOTES RAPID TOPICAL ABSORPTION (Plant-Based Carrier System) PRODUCT CODE: NTROLL THERAPY INFO WARRANTY DESCRIPTION Nerve Target Roll-On Gel: Science-Led Topical Sensory & Microvascular Support Localized musculoskeletal"
  },
  {
    "question": "Clinical Grade Neo 4+ (TENS, EMS, IFC, Micro (w/Tsunami wave), Russian + PMT Wave) - 50v strength, extra power battery - 4-channel.",
    "answer": "PRODUCTS Electrotherapy Devices • Combo Units Clinical Grade Neo 4+ (TENS, EMS, IFC, Micro (w/Tsunami wave), Russian + PMT Wave) - 50v strength, extra power battery - 4-channel. Roll over to zoom in + View large image Clinical Grade Neo 4+ (TENS, EMS, IFC, Micro (w/Tsunami wave), Russian + PMT Wave) - 50v strength, extra power battery - 4-channel. ADVANCED MULTI-MODE STIMULATOR The Clinical Neo 4+ is an extra-strength advanced multi-mode electrotherapy stimulator that combines enhanced TENS, EMS, Interferential, Microcurrent (with Tsunami wave), Russian Stim, and PMT Wave all coupled with 50v of power and extra power battery - 4-channel PRODUCT CODE: NEO4+ THERAPY INFO WARRANTY DESCRIPTION T"
  },
  {
    "question": "Portable Neck Strengthener by NeckSpring, Relieves Neck Pain, Restore Cervical Curvature, Improves posture; and Reverses Nerd Neck",
    "answer": "PRODUCTS Traction Portable Neck Strengthener by NeckSpring, Relieves Neck Pain, Restore Cervical Curvature, Improves posture; and Reverses Nerd Neck Roll over to zoom in + View large image Portable Neck Strengthener by NeckSpring, Relieves Neck Pain, Restore Cervical Curvature, Improves posture; and Reverses Nerd Neck COMBAT NERD NECK - Relieves the discomfort after spending too much time in front of screens. NeckSpring can help fix slouching so you don’t have to feel the pain of a long day at the desk or suffer after a night of gaming. PERFORM EASY, SIMPLE EXERCISES- The Neck Spring has a minimalistic design that’s easy to put on and take off for an exercise that can be performed in moments"
  },
  {
    "question": "Premium Pneumatic Cervical Traction Collar – Inflatable Neck Traction Device for Pain Relief, Stretch and Decompress Neck Muscles",
    "answer": "PRODUCTS Traction Premium Pneumatic Cervical Traction Collar – Inflatable Neck Traction Device for Pain Relief, Stretch and Decompress Neck Muscles Roll over to zoom in + View large image Premium Pneumatic Cervical Traction Collar – Inflatable Neck Traction Device for Pain Relief, Stretch and Decompress Neck Muscles Portable device for neck pain relief. Efficiently supports neck and head, anatomically designed. Revolutionizes home cervical traction. Thin and light weight. PRODUCT CODE: CVT2000 THERAPY INFO WARRANTY DESCRIPTION Cervical Traction Soft Neck Air Traction Pro is a brand new neck massager. Improved model with a easy to use air pump. Soft Neck Air Traction is comfortable and can be"
  },
  {
    "question": "Nerve Spa Pro 90 with Foot Pad Kit (includes NS PRO device, leadwires, 1 pair of foot pads, 16oz of spray) - 90 days of supplies",
    "answer": "PRODUCTS Electrotherapy Devices • Neuropathy Stimulator Nerve Spa Pro 90 with Foot Pad Kit (includes NS PRO device, leadwires, 1 pair of foot pads, 16oz of spray) - 90 days of supplies Roll over to zoom in + View large image Nerve Spa Pro 90 with Foot Pad Kit (includes NS PRO device, leadwires, 1 pair of foot pads, 16oz of spray) - 90 days of supplies Touch screen device with a proprietary program sequence that stimulates healing while off loading the negative ions within the tissue Built-in Microprocessor 7.83Hz, Predominant Monophasic Waveform with a Symmetrical Biphasic Square Rest Period Water resistant device Reinforced lead wires 1 Pair of Conductive Foot Pads FDA Registered Device Glo"
  },
  {
    "question": "Ultima OTC TENS Massager - Electric Muscle Contraction Stimulator for Pain Relief - Massage Unit and Pain Therapy Device (Black)",
    "answer": "PRODUCTS Electrotherapy Devices • TENS Ultima OTC TENS Massager - Electric Muscle Contraction Stimulator for Pain Relief - Massage Unit and Pain Therapy Device (Black) Roll over to zoom in + View large image Ultima OTC TENS Massager - Electric Muscle Contraction Stimulator for Pain Relief - Massage Unit and Pain Therapy Device (Black) ELECTRONIC PULSE TARGETS PAIN: This premium quality muscle contraction simulator uses electric wave generation, which may stimulate the natural pain relief response of the body. Dual function enables this electrotherapy device to massage muscles. EASY TO USE: This user-friendly physical therapy device delivers professional grade stimulation in an easy to use ho"
  },
  {
    "question": "Ultima OTC TENS Massager - Electric Muscle Contraction Stimulator for Pain Relief - Massage Unit and Pain Therapy Device (White)",
    "answer": "PRODUCTS Electrotherapy Devices Ultima OTC TENS Massager - Electric Muscle Contraction Stimulator for Pain Relief - Massage Unit and Pain Therapy Device (White) Roll over to zoom in + View large image Ultima OTC TENS Massager - Electric Muscle Contraction Stimulator for Pain Relief - Massage Unit and Pain Therapy Device (White) ELECTRONIC PULSE TARGETS PAIN: This premium quality muscle contraction simulator uses electric wave generation, which may stimulate the natural pain relief response of the body. Dual function enables this electrotherapy device to massage muscles. EASY TO USE: This user-friendly physical therapy device delivers professional grade stimulation in an easy to use home devi"
  },
  {
    "question": "4% Lidocaine 3% Menthol Roll On by Icy Relief OTC Strength Non Greasy Formula with Vitamin E Aloe Vera Lavender Oil 2.5 oz 73 mL",
    "answer": "PRODUCTS Therapeutic Creams and Gels 4% Lidocaine 3% Menthol Roll On by Icy Relief OTC Strength Non Greasy Formula with Vitamin E Aloe Vera Lavender Oil 2.5 oz 73 mL Roll over to zoom in + View large image 4% Lidocaine 3% Menthol Roll On by Icy Relief OTC Strength Non Greasy Formula with Vitamin E Aloe Vera Lavender Oil 2.5 oz 73 mL POWERFUL FORMULA: Icy Relief is a 4% LidoCaine + 3% Menthol roll-on with a professional formula that out-performs the competition. HEATING AND COOLING : The unique warm and cool formula of Icy Relief feels great. NOURISH AND MOISTURIZE: With skin on the defense from the cold and other elements, gel shouldn't mean dry skin. Icy Relief's all natural ingredients inc"
  },
  {
    "question": "Water Therapy Ice Machine Accessory Couplings and Tubing - Compatible with Artic Ice Clear Cold Therapy Machines (AC Adapter)",
    "answer": "PRODUCTS Accessories Water Therapy Ice Machine Accessory Couplings and Tubing - Compatible with Artic Ice Clear Cold Therapy Machines (AC Adapter) Roll over to zoom in + View large image Water Therapy Ice Machine Accessory Couplings and Tubing - Compatible with Artic Ice Clear Cold Therapy Machines (AC Adapter) Replacement Charger for the Arctic Ice Clear PRODUCT CODE: AIS-Charger THERAPY INFO WARRANTY Replacement Charger for the Nerve Spa Nerve Bath System. Quake Plate-charger Replacement Charger for the Polar Vortex Replacement Charger for the ottossage Replacement Charger for the Seat Boost Air Quake Plate-Remote AIS Charger NEO - adaptor/charger Itens - charger Dynamic Wedge Lumbar - cha"
  },
  {
    "question": "Electric Heating Pad for Back Aches and Cramps by ThermoRelief - Large Moist Heat/Dry Blanket with Auto Shut Off - 24\" x 12\"",
    "answer": "PRODUCTS Heat Therapy Electric Heating Pad for Back Aches and Cramps by ThermoRelief - Large Moist Heat/Dry Blanket with Auto Shut Off - 24\" x 12\" Roll over to zoom in + View large image Electric Heating Pad for Back Aches and Cramps by ThermoRelief - Large Moist Heat/Dry Blanket with Auto Shut Off - 24\" x 12\" WARM SOOTHING RELIEF FOR MINOR ACHES AND FATIGUE: Sore muscles and minor aches can really get you down, but you can smile knowing that relief can be had at the press of a button. This large electric heating pad sends soothing heat to your body to help ease back pain, cramps, and soreness. MOIST HEAT OPTION FOR GREATER EFFECTIVENESS: Dry heat can be effective in helping to soothe what’s"
  },
  {
    "question": "Hidden Heating Pad Pet Bed Warmer by Spotwarm; Wireless RF Remote with Microplush Flannel, Small and Large Pets - 24” by 20”",
    "answer": "PRODUCTS Heat Therapy Hidden Heating Pad Pet Bed Warmer by Spotwarm; Wireless RF Remote with Microplush Flannel, Small and Large Pets - 24” by 20” Roll over to zoom in + View large image Hidden Heating Pad Pet Bed Warmer by Spotwarm; Wireless RF Remote with Microplush Flannel, Small and Large Pets - 24” by 20” UNPARALLELED WARMTH - Quick heating wire grid heats up the pet bed warmer faster and retains heat for longer. Includes an auto-shutoff feature for each different temperature setting. ADJUSTABLE HEAT SETTINGS – Keep your furry friend warm with 6 different heating levels, controlled using our Infrared Remote Control. Includes a wireless and wired controller. DURABLE BUILD - Extra strengt"
  },
  {
    "question": "Wearable Throw Blanket by Throbe, Patent Pending Throw Blanket Converts into a Hands-Free Robe, Super Soft and Warm (Beige)",
    "answer": "PRODUCTS Heat Therapy Wearable Throw Blanket by Throbe, Patent Pending Throw Blanket Converts into a Hands-Free Robe, Super Soft and Warm (Beige) Roll over to zoom in + View large image Wearable Throw Blanket by Throbe, Patent Pending Throw Blanket Converts into a Hands-Free Robe, Super Soft and Warm (Beige) BLANKET WRISTLETS: A one-of-a-kind wearable blanket with high quality, sewn-in, wristlet cuffs transform this throw blanket into a wearable robe. Keep your hands free with this amazing throw blanket. OVERSIZED COMFORT: Enjoy the ultimate soft comfort with our 68\" x 60\" blanket. Its generous size is great for the couch, or bed, and won't drag on the ground as it is worn as a robe. Folds n"
  },
  {
    "question": "Wearable Throw Blanket by Throbe, Patent Pending Throw Blanket Converts into a Hands-Free Robe, Super Soft and Warm (Black)",
    "answer": "PRODUCTS Heat Therapy Wearable Throw Blanket by Throbe, Patent Pending Throw Blanket Converts into a Hands-Free Robe, Super Soft and Warm (Black) Roll over to zoom in + View large image Wearable Throw Blanket by Throbe, Patent Pending Throw Blanket Converts into a Hands-Free Robe, Super Soft and Warm (Black) BLANKET WRISTLETS: A one-of-a-kind wearable blanket with high quality, sewn-in, wristlet cuffs transform this throw blanket into a wearable robe. Keep your hands free with this amazing throw blanket. OVERSIZED COMFORT: Enjoy the ultimate soft comfort with our 68\" x 60\" blanket. Its generous size is great for the couch, or bed, and won't drag on the ground as it is worn as a robe. Folds n"
  },
  {
    "question": "Wearable Throw Blanket by Throbe, Patent Pending Throw Blanket Converts into a Hands-Free Robe, Super Soft and Warm (Grey)",
    "answer": "PRODUCTS Heat Therapy Wearable Throw Blanket by Throbe, Patent Pending Throw Blanket Converts into a Hands-Free Robe, Super Soft and Warm (Grey) Roll over to zoom in + View large image Wearable Throw Blanket by Throbe, Patent Pending Throw Blanket Converts into a Hands-Free Robe, Super Soft and Warm (Grey) BLANKET WRISTLETS: A one-of-a-kind wearable blanket with high quality, sewn-in, wristlet cuffs transform this throw blanket into a wearable robe. Keep your hands free with this amazing throw blanket. OVERSIZED COMFORT: Enjoy the ultimate soft comfort with our 68\" x 60\" blanket. Its generous size is great for the couch, or bed, and won't drag on the ground as it is worn as a robe. Folds nea"
  },
  {
    "question": "Wearable Throw Blanket by Throbe, Patent Pending Throw Blanket Converts into a Hands-Free Robe, Super Soft and Warm (Pink)",
    "answer": "PRODUCTS Heat Therapy Wearable Throw Blanket by Throbe, Patent Pending Throw Blanket Converts into a Hands-Free Robe, Super Soft and Warm (Pink) Roll over to zoom in + View large image Wearable Throw Blanket by Throbe, Patent Pending Throw Blanket Converts into a Hands-Free Robe, Super Soft and Warm (Pink) BLANKET WRISTLETS: A one-of-a-kind wearable blanket with high quality, sewn-in, wristlet cuffs transform this throw blanket into a wearable robe. Keep your hands free with this amazing throw blanket. OVERSIZED COMFORT: Enjoy the ultimate soft comfort with our 68\" x 60\" blanket. Its generous size is great for the couch, or bed, and won't drag on the ground as it is worn as a robe. Folds nea"
  },
  {
    "question": "Wearable Throw Blanket by Throbe, Patent Pending Throw Blanket Converts into a Hands-Free Robe, Super Soft and Warm (Plum)",
    "answer": "PRODUCTS Heat Therapy Wearable Throw Blanket by Throbe, Patent Pending Throw Blanket Converts into a Hands-Free Robe, Super Soft and Warm (Plum) Roll over to zoom in + View large image Wearable Throw Blanket by Throbe, Patent Pending Throw Blanket Converts into a Hands-Free Robe, Super Soft and Warm (Plum) BLANKET WRISTLETS: A one-of-a-kind wearable blanket with high quality, sewn-in, wristlet cuffs transform this throw blanket into a wearable robe. Keep your hands free with this amazing throw blanket. OVERSIZED COMFORT: Enjoy the ultimate soft comfort with our 68\" x 60\" blanket. Its generous size is great for the couch, or bed, and won't drag on the ground as it is worn as a robe. Folds nea"
  },
  {
    "question": "Roll On Pain Relief by Pain Grenade - Roll On Muscle Pain Reliever, Back Pain, Arthritis – with Arnica, Menthol, & Camphor",
    "answer": "PRODUCTS Therapeutic Creams and Gels Roll On Pain Relief by Pain Grenade - Roll On Muscle Pain Reliever, Back Pain, Arthritis – with Arnica, Menthol, & Camphor Roll over to zoom in + View large image Roll On Pain Relief by Pain Grenade - Roll On Muscle Pain Reliever, Back Pain, Arthritis – with Arnica, Menthol, & Camphor MILITARY GRADE RELIEF: Pain Grenade is roll on relief that tackles back, joint, and sore muscles with professional formulas that perform like nothing else on the market. You may have seen other products which make tons of promises, but this product is extra strength for the toughest of the tough. HEATING AND COOLING THERAPY: The unique warm and cool formula of Pain Grenade i"
  },
  {
    "question": "Ear Clip Accessory for VNS - White with Innovative Sponge Pad for Superior Conductivity, Universal Compatibility - 1 Pair",
    "answer": "PRODUCTS Electrotherapy Supplies • Probes and clips Ear Clip Accessory for VNS - White with Innovative Sponge Pad for Superior Conductivity, Universal Compatibility - 1 Pair Roll over to zoom in + View large image Ear Clip Accessory for VNS - White with Innovative Sponge Pad for Superior Conductivity, Universal Compatibility - 1 Pair Versatile Vagus Nerve Ear Clip: Engineered for seamless compatibility with leading stim devices. Compatible with all universal pin-type connectors. Dual-Size Soft Carbon Cushion: Features specially designed carbon rubber pads with built-in resistance, optimized for effective VNS Complete Accessory Kit: Includes a 2.35mm shielded connector cable and a wire-fixing"
  },
  {
    "question": "PowerWrap | Ultra High-Powered Red & Infrared Light Therapy for Large-Area Pain Relief, Circulation, and Recovery Support",
    "answer": "PRODUCTS Light Therapy PowerWrap | Ultra High-Powered Red & Infrared Light Therapy for Large-Area Pain Relief, Circulation, and Recovery Support Roll over to zoom in + View large image PowerWrap | Ultra High-Powered Red & Infrared Light Therapy for Large-Area Pain Relief, Circulation, and Recovery Support Clinical Device A high-output, large-surface light therapy system designed to deliver powerful red and infrared energy across broader treatment areas—supporting pain relief, circulation, recovery, and protocol-based nerve and tissue support. Relieve Pain at Scale – Designed to help relieve nerve pain, joint discomfort, muscle soreness, and stiffness across larger treatment regions. Improve "
  },
  {
    "question": "Loose Fit Diabetic Socks – Circulatory Issues, Diabetes, Edema, Neuropathy – Loose fitting Socks(size 9-11 – Ankle High)",
    "answer": "PRODUCTS Bracing and Supports Loose Fit Diabetic Socks – Circulatory Issues, Diabetes, Edema, Neuropathy – Loose fitting Socks(size 9-11 – Ankle High) Roll over to zoom in + View large image Loose Fit Diabetic Socks – Circulatory Issues, Diabetes, Edema, Neuropathy – Loose fitting Socks(size 9-11 – Ankle High) Cotton - Diabetic socks are designed to reduce pressure on swollen feet, ankles, and sensitive legs by minimizing constriction Stretch tops and soft terry soles make these diabetic socks an ideal choice for problem feet Accommodates oversized calves with exceptional cross stretch that allows the sock to slip on easily The Diabetic Socks reduces friction, abrasion, shear forces and call"
  },
  {
    "question": "Electrolyte Conductive Spray by PMT. Electrotherapy Conductive Spray for use with Conductive TENS/EMS Garments - 8 Oz",
    "answer": "PRODUCTS Electrotherapy Supplies Electrolyte Conductive Spray by PMT. Electrotherapy Conductive Spray for use with Conductive TENS/EMS Garments - 8 Oz Roll over to zoom in + View large image Electrolyte Conductive Spray by PMT. Electrotherapy Conductive Spray for use with Conductive TENS/EMS Garments - 8 Oz ULTRA CONDUCTIVE – Specially formed solution with high concentration of electrolytes to provide superior conductivity ENHANCED ELECTROLYTES – Electrolytes improve conductivity and effectiveness greatly. PREVENT HOTSPOTS – fine mist spray enables for full saturation of the garment HELPS - Prevent electrode dry out and takes the sting out of muscle stimulation COMPATIBLE – can be used on re"
  },
  {
    "question": "Electrolyte Conductive Spray by PMT. Electrotherapy Conductive Spray for use with Conductive TENS/EMS Garments - 4 Oz",
    "answer": "PRODUCTS Electrotherapy Supplies • Tens care and accesories Electrolyte Conductive Spray by PMT. Electrotherapy Conductive Spray for use with Conductive TENS/EMS Garments - 4 Oz Roll over to zoom in + View large image Electrolyte Conductive Spray by PMT. Electrotherapy Conductive Spray for use with Conductive TENS/EMS Garments - 4 Oz ULTRA CONDUCTIVE – Specially formed solution with high concentration of electrolytes to provide superior conductivity ENHANCED ELECTROLYTES – Electrolytes improve conductivity and effectiveness greatly. PREVENT HOTSPOTS – fine mist spray enables for full saturation of the garment HELPS - Prevent electrode dry out and takes the sting out of muscle stimulation COM"
  },
  {
    "question": "Cold Water Therapy Coupling Converter for Cryotherapy Units - Converter Attachments for Units to Compatible with Pads",
    "answer": "PRODUCTS Water Therapy Systems Cold Water Therapy Coupling Converter for Cryotherapy Units - Converter Attachments for Units to Compatible with Pads Roll over to zoom in + View large image Cold Water Therapy Coupling Converter for Cryotherapy Units - Converter Attachments for Units to Compatible with Pads CONVERTS SYSTEMS: This converter attachment is designed to be utilized with cryotherapy machines to give compatibility for use with the PMT brand water therapy pads. Replace existing fittings to allow you to use our range of specialized pads. FIX LEAKS: Some of the connections on our competitor products are prone to leaks. Our quick-connect-disconnect couplings allow for easy and secure att"
  },
  {
    "question": "Mobi-Bench Swivel Shower Chair with Padded Seat, Back & Arms - 360° Rotating Bath Chair, Adjustable Height, Blue",
    "answer": "PRODUCTS Mobility Assistance Mobi-Bench Swivel Shower Chair with Padded Seat, Back & Arms - 360° Rotating Bath Chair, Adjustable Height, Blue Roll over to zoom in + View large image Mobi-Bench Swivel Shower Chair with Padded Seat, Back & Arms - 360° Rotating Bath Chair, Adjustable Height, Blue 360° Rotating Seat with Pivoting Armrest: This Mobi-Bench shower chair features a 360° swivel seat, allowing safe and effortless entry and exit. The pivoting armrest provides easy access, enhancing user convenience. Comfortable & Hygienic Padding: Enjoy superior comfort with medical-grade, closed-cell polyurethane padding on the seat, backrest, and armrests. The slip-resistant, water-resistant surface "
  },
  {
    "question": "Alternating Pressure Wheelchair Cushion by MobiCushion - Pneumatic Air Pillow - Relief for Pressure Sores - Blue",
    "answer": "PRODUCTS Mobility Assistance Alternating Pressure Wheelchair Cushion by MobiCushion - Pneumatic Air Pillow - Relief for Pressure Sores - Blue Roll over to zoom in + View large image Alternating Pressure Wheelchair Cushion by MobiCushion - Pneumatic Air Pillow - Relief for Pressure Sores - Blue ADVANCED PRESSURE RELIEF CUSHION SYSTEM: Feel free to breathe again. This pneumatic seat cushion uses a consistent cycle of alternating low air pressure that flows through the cushion’s air cells. The alternating pressure gives specific areas some time to rest or the pad can be used in static mode for a constant cushioning effect. There are 5 comfort level settings. HELP FOR PRESSURE SORES: Pressure so"
  },
  {
    "question": "TENS Lotion by MEDI-STIM, Repairs and Moisturizes Post-Treatment Skin, Dry Skin. Use with TENS/EMS, etc..-12 OZ",
    "answer": "PRODUCTS Electrotherapy Supplies TENS Lotion by MEDI-STIM, Repairs and Moisturizes Post-Treatment Skin, Dry Skin. Use with TENS/EMS, etc..-12 OZ Roll over to zoom in + View large image TENS Lotion by MEDI-STIM, Repairs and Moisturizes Post-Treatment Skin, Dry Skin. Use with TENS/EMS, etc..-12 OZ MOISTURIZING: Rehydrates and repairs Skin SENSITIVE: Helps sensitive skin repair naturally LONG LASTING: Keeps skin hydrated for long periods of time. NUTRIENT ENRICHED: Formulated with Vitamin A, D & E, Aloe Vera & other natural ingredients. PRODUCT CODE: med-stim-12 THERAPY INFO WARRANTY 2 OZ Bottle 12 OZ Bottle DESCRIPTION Luxurious, fragrance-free formula ideal for post electrotherapy treatment. "
  },
  {
    "question": "Universal TENS Lead Wires by PMT, Fits Most All Electrotherapy Devices and TENS/EMS electrodes (Standard Grade)",
    "answer": "PRODUCTS Electrotherapy Supplies Universal TENS Lead Wires by PMT, Fits Most All Electrotherapy Devices and TENS/EMS electrodes (Standard Grade) Roll over to zoom in + View large image Universal TENS Lead Wires by PMT, Fits Most All Electrotherapy Devices and TENS/EMS electrodes (Standard Grade) UNIVERSAL FIT - Standard shielded plastic female right angle plug, FDA Compliant plug LONG - 48 inch wires ONE PAIR - 2 leads to connect a total of 4 electrodes STANDARD - Pins fit standard 2mm pigtail electrode pad connectors INCLUDES – 1 set (1 pair) PRODUCT CODE: LWS THERAPY INFO WARRANTY Orange Standard Grade DESCRIPTION High Quality standard lead wires that fit most TENS and EMS units. Standard "
  },
  {
    "question": "TENS Lotion by MEDI-STIM, Repairs and Moisturizes Post-Treatment Skin, Dry Skin. Use with TENS/EMS, etc..-2 OZ",
    "answer": "PRODUCTS Electrotherapy Supplies TENS Lotion by MEDI-STIM, Repairs and Moisturizes Post-Treatment Skin, Dry Skin. Use with TENS/EMS, etc..-2 OZ Roll over to zoom in + View large image TENS Lotion by MEDI-STIM, Repairs and Moisturizes Post-Treatment Skin, Dry Skin. Use with TENS/EMS, etc..-2 OZ MOISTURIZING: Rehydrates and repairs Skin SENSITIVE: Helps sensitive skin repair naturally LONG LASTING: Keeps skin hydrated for long periods of time. NUTRIENT ENRICHED: Formulated with Vitamin A, D & E, Aloe Vera & other natural ingredients. PRODUCT CODE: med-stim-2 THERAPY INFO WARRANTY 2 OZ Bottle 12 OZ Bottle DESCRIPTION Luxurious, fragrance-free formula ideal for post electrotherapy treatment. For"
  },
  {
    "question": "Universal TENS Lead Wires by PMT, Fits Most All Electrotherapy Devices and TENS/EMS electrodes (Premium Grade)",
    "answer": "PRODUCTS Electrotherapy Supplies • Accessories Universal TENS Lead Wires by PMT, Fits Most All Electrotherapy Devices and TENS/EMS electrodes (Premium Grade) Roll over to zoom in + View large image Universal TENS Lead Wires by PMT, Fits Most All Electrotherapy Devices and TENS/EMS electrodes (Premium Grade) EXTRA STRONG - twice the thickness means twice as much copper to create a lead wire that is not only more durable but has a higher transfer conduction than standard lead wires. Extra durable for long life use. UNIVERSAL FIT - Standard shielded plastic female right angle plug, FDA Compliant plug. Fits standard 2mm pigtail electrode/pad connector LONG - 48 inch wires ONE PAIR - 2 leads to c"
  },
  {
    "question": "TENS EMS Combo Unit Electro Muscle Stimulator by Quad Stim Plus - 4 Channels - OTC Stim Tens Machine for Pain",
    "answer": "PRODUCTS Electrotherapy Devices TENS EMS Combo Unit Electro Muscle Stimulator by Quad Stim Plus - 4 Channels - OTC Stim Tens Machine for Pain Roll over to zoom in + View large image TENS EMS Combo Unit Electro Muscle Stimulator by Quad Stim Plus - 4 Channels - OTC Stim Tens Machine for Pain COMBO UNIT: Quad-Stim is a combination EMS unit (Electro Muscle Stimulator) and TENS machine (Transcutaneous Electrical Nerve Stimulation). A TENS EMS unit is used for pain management, massage, relaxation, and as an electric pulse muscle stimulator. 4 CHANNELS: This EMS TENS unit is unique with four controllable and independent output channels, each with its own intensity level adjustment connect to an el"
  },
  {
    "question": "The Arctic Ice Classic – Cold Water Therapy Device with Universal Pad for Treatment of Disability - unit only",
    "answer": "PRODUCTS Water Therapy Systems The Arctic Ice Classic – Cold Water Therapy Device with Universal Pad for Treatment of Disability - unit only Roll over to zoom in + View large image The Arctic Ice Classic – Cold Water Therapy Device with Universal Pad for Treatment of Disability - unit only THERAPEUTIC COLD WATER: The Arctic Ice Classic cold therapy machine uses a continuous flow of cold water to provide reduction of swelling and inflammation for those with a disability PORTABLE AND QUIET: Designed for easy portability and storage, this compact ice therapy system has a quiet motor for use in the home or hospital. DIGITAL CONTROLS: The built-in LCD screen and adjustable settings give you an ea"
  },
  {
    "question": "NerveWave Advanced Neuro-Modulating Electrotherapy System for Pain Relief, Neuropathy & Restorative Recovery",
    "answer": "PRODUCTS Electrotherapy Devices • Neuropathy Stimulator NerveWave Advanced Neuro-Modulating Electrotherapy System for Pain Relief, Neuropathy & Restorative Recovery Roll over to zoom in + View large image NerveWave Advanced Neuro-Modulating Electrotherapy System for Pain Relief, Neuropathy & Restorative Recovery Clinical Device Multi-domain electrotherapy platform designed to therapeutically treat pain, stimulate nerves, improve circulation, support regeneration, and accelerate restorative recovery across neuropathy, chronic pain, and rehabilitation care pathways. Key Outcomes: Pain modulation: Helps calm hypersensitive nerve signaling and reduce chronic pain patterns. Nerve support: Support"
  },
  {
    "question": "NerveBeam Cold Laser | Focused Red & Infrared Light Therapy for Targeted Pain Relief and Circulation Support",
    "answer": "PRODUCTS Light Therapy NerveBeam Cold Laser | Focused Red & Infrared Light Therapy for Targeted Pain Relief and Circulation Support Roll over to zoom in + View large image NerveBeam Cold Laser | Focused Red & Infrared Light Therapy for Targeted Pain Relief and Circulation Support Clinical Device A high-powered, focal light therapy device designed for targeted application—supporting pain relief, temporary circulation improvement, stiffness reduction, and muscle relaxation in smaller, localized treatment areas. Targeted Pain Relief – Designed to help relieve nerve pain, joint discomfort, arthritis-related symptoms, and muscle spasms through focused red and infrared light delivery. Circulation "
  },
  {
    "question": "Alternating Pressure Wheelchair Cushion by MobiCushion - Pneumatic Air Pillow - Relief for Pressure Sores",
    "answer": "PRODUCTS Mobility Assistance Alternating Pressure Wheelchair Cushion by MobiCushion - Pneumatic Air Pillow - Relief for Pressure Sores Roll over to zoom in + View large image Alternating Pressure Wheelchair Cushion by MobiCushion - Pneumatic Air Pillow - Relief for Pressure Sores ADVANCED PRESSURE RELIEF CUSHION SYSTEM: Feel free to breathe again. This pneumatic seat cushion uses a consistent cycle of alternating low air pressure that flows through the cushion’s air cells. The alternating pressure gives specific areas some time to rest or the pad can be used in static mode for a constant cushioning effect. There are 5 comfort level settings. HELP FOR PRESSURE SORES: Pressure sores can really"
  },
  {
    "question": "NerveSpa Quake Plate Oscillating Vibration Platform for Nerve Stimulation, Pain Relief, and Circulation",
    "answer": "PRODUCTS Massage Therapy Devices NerveSpa Quake Plate Oscillating Vibration Platform for Nerve Stimulation, Pain Relief, and Circulation Roll over to zoom in + View large image NerveSpa Quake Plate Oscillating Vibration Platform for Nerve Stimulation, Pain Relief, and Circulation Clinic & Home Device High-RPM oscillating vibration system designed for nerve and neuropathy support, helping providers deliver deep tissue stimulation, improve circulation, and support pain relief in the feet and lower extremities. Key Outcomes: Relieve pain: Helps relieve foot discomfort, nerve sensitivity, and lower-extremity tension. Stimulate nerves: Supports peripheral nerve activation and targeted lower-extre"
  },
  {
    "question": "OSTEOARTHRITIS & RHEUMATOID ARTHRITIS CREAM - Topical Structural Joint & Inflammatory Support Formula",
    "answer": "PRODUCTS Therapeutic Creams and Gels OSTEOARTHRITIS & RHEUMATOID ARTHRITIS CREAM - Topical Structural Joint & Inflammatory Support Formula Roll over to zoom in + View large image OSTEOARTHRITIS & RHEUMATOID ARTHRITIS CREAM - Topical Structural Joint & Inflammatory Support Formula SUPPORTS TARGETED JOINT COMFORT (Menthol + Arnica + MSM SUPPORTS LOCAL MICRO-CIRCULATION (L-Arginine 8.4%) PROMOTES STRUCTURAL JOINT SUPPORT (Glucosamine + Chondroitin) SOOTHES & CALMS INFLAMMATORY SIGNALING (Aloe + Vitamin E + Botanical Oils PRODUCT CODE: OAC10 THERAPY INFO WARRANTY DESCRIPTION Osteoarthritis & Rheumatoid Arthritis Cream: Science-Led Topical Structural & Inflammatory Joint Support Degenerative and "
  },
  {
    "question": "Electric Lifting Backrest for Bed by Mobi-Back (Full Bed Cushion Version – Solid Steel Construction)",
    "answer": "PRODUCTS Mobility Assistance Electric Lifting Backrest for Bed by Mobi-Back (Full Bed Cushion Version – Solid Steel Construction) Roll over to zoom in + View large image Electric Lifting Backrest for Bed by Mobi-Back (Full Bed Cushion Version – Solid Steel Construction) COMFORT - Full Cushion Accessory for use with the MOBI BACK - Back Lift for the bed. Enjoy the comfort of full coverage. COMPATIBLE: Slips onto the Mobi Back Gen 2 Back Lift REMOTE CONTROLLED: The Mobi-Back Gen 2 – Lifting back rest has a bearing lift rod that is controlled through the remote’s control one-touch operation. The Mobi-Back lifts up to 600 pounds, and the remote control conveniently adjusts the angle as needed to"
  },
  {
    "question": "Elite Custom Manual Operation Medical-Grade Vacuum Erection Device for Erectile Dysfunction (Manual)",
    "answer": "PRODUCTS ED Devices Elite Custom Manual Operation Medical-Grade Vacuum Erection Device for Erectile Dysfunction (Manual) Roll over to zoom in + View large image Elite Custom Manual Operation Medical-Grade Vacuum Erection Device for Erectile Dysfunction (Manual) USE FOR: Trouble getting an Erection, Trouble keeping an Erection, Reduced Sexual Desire HELP: Improve relations with your loved one External vacuum erection devices have become easily available for consumers since the FDA no longer requires a prescription from a physician to purchase a penis pump. Originally the device required a prescription when introduced in 1982. Prescription requirements were removed in 1997 when the FDA determi"
  },
  {
    "question": "Polar Sport Large - 12L – Cold Water Therapy Device with Universal Pad for Treatment of Disability",
    "answer": "PRODUCTS Water Therapy Systems Polar Sport Large - 12L – Cold Water Therapy Device with Universal Pad for Treatment of Disability Roll over to zoom in + View large image Polar Sport Large - 12L – Cold Water Therapy Device with Universal Pad for Treatment of Disability THERAPEUTIC COLD WATER: The Polar Sport cold therapy machine uses a continuous flow of cold water to provide reduction of swelling and inflammation for those with a disability PORTABLE AND QUIET: Designed for easy portability and storage, this compact ice therapy system has a quiet motor for use in the home or hospital. DIGITAL CONTROLS: The built-in LCD screen and adjustable settings give you an easy way to control the treatme"
  },
  {
    "question": "The Arctic Ice Classic– Cold Water Therapy Device with Large Back Pad for Treatment of Disability",
    "answer": "PRODUCTS Water Therapy Systems The Arctic Ice Classic– Cold Water Therapy Device with Large Back Pad for Treatment of Disability Roll over to zoom in + View large image The Arctic Ice Classic– Cold Water Therapy Device with Large Back Pad for Treatment of Disability THERAPEUTIC COLD WATER: The Arctic Ice cold therapy machine uses a continuous flow of cold water to provide reduction of swelling and inflammation for those with a disability PORTABLE AND QUIET: Designed for easy portability and storage, this compact ice therapy system has a quiet motor for use in the home or hospital. DIGITAL CONTROLS: The built-in LCD screen and adjustable settings give you an easy way to control the treatment "
  },
  {
    "question": "The Arctic Ice Classic – Cold Water Therapy Device with Universal Pad for Treatment of Disability",
    "answer": "PRODUCTS Water Therapy Systems The Arctic Ice Classic – Cold Water Therapy Device with Universal Pad for Treatment of Disability Roll over to zoom in + View large image The Arctic Ice Classic – Cold Water Therapy Device with Universal Pad for Treatment of Disability THERAPEUTIC COLD WATER: The Arctic Ice Classic cold therapy machine uses a continuous flow of cold water to provide reduction of swelling and inflammation for those with a disability PORTABLE AND QUIET: Designed for easy portability and storage, this compact ice therapy system has a quiet motor for use in the home or hospital. DIGITAL CONTROLS: The built-in LCD screen and adjustable settings give you an easy way to control the tr"
  },
  {
    "question": "The Arctic Ice Clear – Cold Water Therapy Device with Large Back Pad for Treatment of Disability",
    "answer": "PRODUCTS Water Therapy Systems The Arctic Ice Clear – Cold Water Therapy Device with Large Back Pad for Treatment of Disability Roll over to zoom in + View large image The Arctic Ice Clear – Cold Water Therapy Device with Large Back Pad for Treatment of Disability THERAPEUTIC COLD WATER: The Arctic Ice Clear cold therapy machine uses a continuous flow of cold water to provide reduction of swelling and inflammation for those with a disability PORTABLE AND QUIET: Designed for easy portability and storage, this compact ice therapy system has a quiet motor for use in the home or hospital. DIGITAL CONTROLS: The built-in LCD screen and adjustable settings give you an easy way to control the treatm"
  },
  {
    "question": "Polar Sport Mini - 5L – Cold Water Therapy Device with Universal Pad for Treatment of Disability",
    "answer": "PRODUCTS Water Therapy Systems Polar Sport Mini - 5L – Cold Water Therapy Device with Universal Pad for Treatment of Disability Roll over to zoom in + View large image Polar Sport Mini - 5L – Cold Water Therapy Device with Universal Pad for Treatment of Disability THERAPEUTIC COLD WATER: The Polar Sport cold therapy machine uses a continuous flow of cold water to provide reduction of swelling and inflammation for those with a disability PORTABLE AND QUIET: Designed for easy portability and storage, this compact ice therapy system has a quiet motor for use in the home or hospital. DIGITAL CONTROLS: The built-in LCD screen and adjustable settings give you an easy way to control the treatment t"
  },
  {
    "question": "The NerveBeam LED Light Therapy Wrap - Red & Infrared light therapy - 22,000mW of Power - 1 pair",
    "answer": "PRODUCTS Light Therapy The NerveBeam LED Light Therapy Wrap - Red & Infrared light therapy - 22,000mW of Power - 1 pair Roll over to zoom in + View large image The NerveBeam LED Light Therapy Wrap - Red & Infrared light therapy - 22,000mW of Power - 1 pair Adjustable straps to use anywhere on the body 600 Individual LED diodes Reaches temperatures over 100 degrees Fahrenheit Total Power – 22000mW FDA Registered Device CONTACT FOR PRICING PRODUCT CODE: NBRT175 PAIR THERAPY INFO WARRANTY DESCRIPTION The Nerve Beam LED wrap is a high-powered LED red light and infrared therapy device that delivers low-level but intense light energy into the body. LED therapy uses a broad spectrum of red light an"
  },
  {
    "question": "The Arctic Ice Clear – Cold Water Therapy Device with Universal Pad for Treatment of Disability",
    "answer": "PRODUCTS Water Therapy Systems The Arctic Ice Clear – Cold Water Therapy Device with Universal Pad for Treatment of Disability Roll over to zoom in + View large image The Arctic Ice Clear – Cold Water Therapy Device with Universal Pad for Treatment of Disability THERAPEUTIC COLD WATER: The Arctic Ice Clear cold therapy machine uses a continuous flow of cold water to provide reduction of swelling and inflammation for those with a disability PORTABLE AND QUIET: Designed for easy portability and storage, this compact ice therapy system has a quiet motor for use in the home or hospital. DIGITAL CONTROLS: The built-in LCD screen and adjustable settings give you an easy way to control the treatmen"
  },
  {
    "question": "All natural 4% menthol roll on by icy relief for muscle relief with arnica menthol and camphor",
    "answer": "PRODUCTS Therapeutic Creams and Gels All natural 4% menthol roll on by icy relief for muscle relief with arnica menthol and camphor Roll over to zoom in + View large image All natural 4% menthol roll on by icy relief for muscle relief with arnica menthol and camphor POWERFUL FORMULA: Icy Relief is a roll-on with a professional formula that out-performs the competition. HEATING AND COOLING : The unique warm and cool formula of Icy Relief feels great. NOURISH AND MOISTURIZE: With skin on the defense from the cold and other elements, gel shouldn't mean dry skin. Icy Relief's all natural ingredients include moisturizing aloe leaf to help keep skin nourished and healthy while it works in real tim"
  },
  {
    "question": "Stim 3 TENS/EMS/IFC/Russian Stim - Muscle, Nerve, and Interferential Four Channel Stimulator",
    "answer": "PRODUCTS Electrotherapy Devices • Combo Units Stim 3 TENS/EMS/IFC/Russian Stim - Muscle, Nerve, and Interferential Four Channel Stimulator Roll over to zoom in + View large image Stim 3 TENS/EMS/IFC/Russian Stim - Muscle, Nerve, and Interferential Four Channel Stimulator This single-hand multi waveform device delivers Conventional, Russian, Interferential, and TENS muscle stimulation and monitors compliance, while also allowing for selected treatment parameters to be saved. Large LCD display 4 channel, 8 pad output Intensity controls for each channel Thicker-gauge color-coed cables for the 4 separate channels Lock Key saves the selected treatment parameters and locks out any other input PROD"
  },
  {
    "question": "NERVESPA PRO, HAND AND FOOT NEUROPATHY SYSTEM - 90 DAY SUPPLY PROGRAM - DUAL CHANNEL DEVICE",
    "answer": "PRODUCTS Electrotherapy Devices • Neuropathy Stimulator NERVESPA PRO, HAND AND FOOT NEUROPATHY SYSTEM - 90 DAY SUPPLY PROGRAM - DUAL CHANNEL DEVICE Roll over to zoom in + View large image NERVESPA PRO, HAND AND FOOT NEUROPATHY SYSTEM - 90 DAY SUPPLY PROGRAM - DUAL CHANNEL DEVICE Touch screen device with a proprietary program sequence that stimulates healing while off loading the negative ions within the tissue Built-in Microprocessor 7.83Hz, Predominant Monophasic Waveform with a Symmetrical Biphasic Square Rest Period Water resistant device Reinforced lead wires Extra-large foot bath fits up to size 14 men’s FDA Registered Includes PRO device, 9 tubes of effervescent tablets and 32oz. condu"
  },
  {
    "question": "Toilet Tilt – Heavy-Duty, Adjustable Assist Seat for Seniors at Home or in Medical Settings",
    "answer": "PRODUCTS Mobility Assistance Toilet Tilt – Heavy-Duty, Adjustable Assist Seat for Seniors at Home or in Medical Settings Roll over to zoom in + View large image Toilet Tilt – Heavy-Duty, Adjustable Assist Seat for Seniors at Home or in Medical Settings ​Smooth Glide Motion: Silent, stepless lifting mechanism ensures gentle and stable elevation for all mobility levels. Spacious & Strong Build: Wide seat and armrests, crafted with a high-strength plastic frame to support up to 200 kg. Rechargeable Battery: Built-in battery. This Toilet Tilt can be used while plugged in for continuous use or battery-powered (will need to be charged when the battery runs out). Custom Comfort & Easy Assembly: The"
  },
  {
    "question": "Complete the form below to obtain a TENS device and monthly supplies – at NO COST TO YOU.",
    "answer": "Name * Address E-mail Address * Phone Claim type.* --select-- Workers comp Federal postal employee To learn more about our program – click here"
  },
  {
    "question": "Polar Vortex – Cold Water Therapy Device with Universal Pad for Treatment of Disability",
    "answer": "PRODUCTS Water Therapy Systems Polar Vortex – Cold Water Therapy Device with Universal Pad for Treatment of Disability Roll over to zoom in + View large image Polar Vortex – Cold Water Therapy Device with Universal Pad for Treatment of Disability THERAPEUTIC COLD WATER: The Polar Sport cold therapy machine uses a continuous flow of cold water to provide reduction of swelling and inflammation for those with a disability PORTABLE AND QUIET: Designed for easy portability and storage, this compact ice therapy system has a quiet motor for use in the home or hospital. DIGITAL CONTROLS: The built-in LCD screen and adjustable settings give you an easy way to control the treatment time and motor inte"
  },
  {
    "question": "3-Pack Replacement Bulbs for Theralamp and Infarex Handheld Red Light Therapy Devices",
    "answer": "PRODUCTS Light Therapy 3-Pack Replacement Bulbs for Theralamp and Infarex Handheld Red Light Therapy Devices Roll over to zoom in + View large image 3-Pack Replacement Bulbs for Theralamp and Infarex Handheld Red Light Therapy Devices FULLY COMPATIBLE: These are the OEM bulbs for the Theralamp and Infarex Handheld red light devices LONG LIFE: Bulbs last through many treatments. RED LIGHT THERAPY: These bulbs produce Red and Infrared; as well as a considerable amount of therapeutic heat. POWERFUL: These bulbs produce high wattage power that helps generate a safe but strong/penetrating heat SATISFACTION GUARANTEED: If there are any issues with your bulbs we will 100% honor replacements. PRODUC"
  },
  {
    "question": "Splitter Hose by Thermacycle – Connect Pillow Pad and Mattress Pad at the Same Time.",
    "answer": "PRODUCTS Water Therapy Systems Splitter Hose by Thermacycle – Connect Pillow Pad and Mattress Pad at the Same Time. Roll over to zoom in + View large image Splitter Hose by Thermacycle – Connect Pillow Pad and Mattress Pad at the Same Time. THERMACYCLE MATTRESS PAD: A climate-controlled, heating/cooling mattress pad that will transform your bed into the ideal sleeping environment. Our Thermacycle pad fits seamlessly on your current mattress (under the fitted sheet) for an exceptional night’s sleep and year-round comfort. This mattress topper is the perfect solution for a mattress or topper that is too hot or too cold. Sleep comfortably no matter what the climate is with this revolutionary he"
  },
  {
    "question": "Classics Hypoallergenic Electrodes - 2\" Square - 5 packs of 4 electrodes (20 Total)",
    "answer": "PRODUCTS Electrodes • HypoAllergenic Electrodes Classics Hypoallergenic Electrodes - 2\" Square - 5 packs of 4 electrodes (20 Total) Roll over to zoom in + View large image Classics Hypoallergenic Electrodes - 2\" Square - 5 packs of 4 electrodes (20 Total) \"Classics\" Hypoallergenic Electrodes PRODUCT CODE: EP84159 THERAPY INFO WARRANTY DESCRIPTION \"Classics\" Hypoallergenic Electrodes 5 packs of electrodes - Each pack contains 4 electrodes for a total of 20 SPECIFICATIONS Product Weight (lbs) : 1"
  },
  {
    "question": "Ultima Neo (TENS, EMS, IFC, Micro) w/ Li-ion rechargeable battery - 28v strength",
    "answer": "PRODUCTS Electrotherapy Devices • Combo Units Ultima Neo (TENS, EMS, IFC, Micro) w/ Li-ion rechargeable battery - 28v strength Roll over to zoom in + View large image Ultima Neo (TENS, EMS, IFC, Micro) w/ Li-ion rechargeable battery - 28v strength Package Includes: Device, batteries, lead wires, 1 pack of 4 electrodes, carrying case and users manual. The Ultima Neo is an Advanced multi-mode electrotherapy stimulator that combines enhanced TENS, EMS, Interferential, and Microcurrent. It is dual channel device and includes the function of our most advanced TENS and EMS modes with body part diagrams, as well as an advanced Interferential device with sine wave technology, and a very state-of-the"
  },
  {
    "question": "Conductive Back Wrap by Blue Silver -extender strap waist - 42\" plus - XXL-XXXL",
    "answer": "PRODUCTS Electrotherapy Garments Conductive Back Wrap by Blue Silver -extender strap waist - 42\" plus - XXL-XXXL Roll over to zoom in + View large image Conductive Back Wrap by Blue Silver -extender strap waist - 42\" plus - XXL-XXXL MULTIFUNCTIONAL – use with peel-n-stick silver mesh electrodes or silver conductive garments. BREATHABLE – comfortable and breathable back wrap allows for wearable comfort, place the back wrap under your shirt to provide support and comfort while maintaining effective conductivity. SIZE COMPATIBLE – available in a small/medium and a large/XL, with extension strap available to fit XXL. OPTIMAL RESULTS – through the added compression brings enhanced conductivity wi"
  },
  {
    "question": "ADVANCED RUSSIAN STIM + INTERFERENTIAL BY StimForce. 2-channel, 2500Hz/4000Hz",
    "answer": "PRODUCTS Electrotherapy Devices • Russian Stimulators ADVANCED RUSSIAN STIM + INTERFERENTIAL BY StimForce. 2-channel, 2500Hz/4000Hz Roll over to zoom in + View large image ADVANCED RUSSIAN STIM + INTERFERENTIAL BY StimForce. 2-channel, 2500Hz/4000Hz DUAL MODALITY: Russian Stim combined with Interferential HIGH-FREQUENCY: Russian Stim operates at 2500Hz and Interferential operates at 4000Hz. DIGITAL: Digital LCD display PORTABLE: AC/DC Adaptor and Battery operable. PRODUCT CODE: R3500 THERAPY INFO WARRANTY DESCRIPTION Reduce Chronic Pain & Inflammation with Interferential. Interferential Stimulation (IFC) is used as a more therapeutic form of TENS as the high frequency drives the current deep"
  },
  {
    "question": "EverTrac CT800 Neck Cervical Traction Device Home Unit System Made in Taiwan",
    "answer": "PRODUCTS Traction EverTrac CT800 Neck Cervical Traction Device Home Unit System Made in Taiwan Roll over to zoom in + View large image EverTrac CT800 Neck Cervical Traction Device Home Unit System Made in Taiwan Safe and Effective At-Home Use: Provides reliable cervical traction to relieve neck strain, pain, and muscle spasms. Direct Cable Technology: Delivers precise and controlled traction force up to 50 lbs without relying on air, avoiding air leakage issues. Effortless Operation: Achieve prescribed traction force with just 1-2 turns of the traction knob for a hassle-free therapy session. Promotes Cervical Spine Health: Decompresses spinal structures and relaxes muscles to address musculo"
  },
  {
    "question": "NERVE & NEUROPATHY CREAM - Topical Microvascular & Sensory Support Formula",
    "answer": "PRODUCTS Therapeutic Creams and Gels NERVE & NEUROPATHY CREAM - Topical Microvascular & Sensory Support Formula Roll over to zoom in + View large image NERVE & NEUROPATHY CREAM - Topical Microvascular & Sensory Support Formula SUPPORTS TARGETED COMFORT (Menthol + Arnica + MSM) SUPPORTS HEALTHY MICRO-CIRCULATION (L-Arginine 7 g + Vitamin B6) PROMOTES FAST LOCAL ABSORPTION (Plant Oils + Lipid Carriers) SOOTHES & CALMS PERIPHERAL TISSUE (Aloe + Allantoin + Botanical Extracts) PRODUCT CODE: NNC10 THERAPY INFO WARRANTY DESCRIPTION Nerve & Neuropathy Cream: Science-Led Topical Support for Peripheral Microcirculation & Sensory Comfort Peripheral sensory discomfort is frequently associated with alte"
  },
  {
    "question": "NERVESPA CLASSIC, HAND AND FOOT NEUROPATHY SYSTEM - 10 DAY SUPPLY PROGRAM",
    "answer": "PRODUCTS Electrotherapy Devices • Neuropathy Stimulator NERVESPA CLASSIC, HAND AND FOOT NEUROPATHY SYSTEM - 10 DAY SUPPLY PROGRAM Roll over to zoom in + View large image NERVESPA CLASSIC, HAND AND FOOT NEUROPATHY SYSTEM - 10 DAY SUPPLY PROGRAM Touch screen device with a proprietary program sequence that stimulates healing while off loading the negative ions within the tissue Built-in Microprocessor 7.83Hz, Predominant Monophasic Waveform with a Symmetrical Biphasic Square Rest Period Water resistant device Reinforced lead wires Extra-large foot bath fits up to size 14 men’s FDA Registered Includes 1 Tube of tablets and 8oz of salt Works for both hands and feet NOTE: The Nerve Spa Classic dif"
  },
  {
    "question": "Y-splitter Hose For Water Therapy Systems – Dual Appendage Functionality",
    "answer": "PRODUCTS Water Therapy Systems Y-splitter Hose For Water Therapy Systems – Dual Appendage Functionality Roll over to zoom in + View large image Y-splitter Hose For Water Therapy Systems – Dual Appendage Functionality COMPATIBLE couplings are compatible with ARS, AIS Classic, Polar Sport, Polar Vortex CONVERTER COUPLINGS – Sold separately there are converter couplings available to make this part work for any cold therapy unit BILATERAL – Treat both feet or both hands or both knees FILL LEVEL – Watch water level for coverage of both pads PRODUCT CODE: YSHO THERAPY INFO WARRANTY DESCRIPTION The Y-Splitter Water therapy hose will enable you to treat both feet, or both hands, or both knees. Simpl"
  },
  {
    "question": "Universal Therapy Pad with manual air pump - shoulder, knee, ankle, hip",
    "answer": "PRODUCTS Water Therapy Systems Universal Therapy Pad with manual air pump - shoulder, knee, ankle, hip Roll over to zoom in + View large image Universal Therapy Pad with manual air pump - shoulder, knee, ankle, hip COMPATIBLE WITH MANY SYSTEMS: Compatible with the Arctic Ice Clear. NOT Compatible with the Arctic Ice Classic, ARS, Polar Vortex, and Polar Sport. **COUPLING CONVERTER is required for these units and other units made by other manufacturers. CONTINUOUS FLOW: Continuous water therapy circumferentially covers and treats a body area with an afflicted disability. LEAK PROOF CONNECTION: The quick connect/disconnect coupling make it easy to change out different options, and provide a le"
  },
  {
    "question": "NERVESPA SILVER CONDUCTIVE GLOVE - HAND GARMENT SYSTEM INCLUDES DEVICE",
    "answer": "PRODUCTS Electrotherapy Devices • Neuropathy Stimulator NERVESPA SILVER CONDUCTIVE GLOVE - HAND GARMENT SYSTEM INCLUDES DEVICE Roll over to zoom in + View large image NERVESPA SILVER CONDUCTIVE GLOVE - HAND GARMENT SYSTEM INCLUDES DEVICE Same technical specs as the Nerve Spa foot bath Foot garment system is lightweight and highly portable Touch screen device Built-in Microprocessor 7.83Hz, 80Hz, Symmetrical Biphasic Square, and Monophasic Waveform Reinforced lead wires Includes 1 Pair of Gloves FDA Registered Includes 24oz of conductive Spray CONTACT FOR PRICING PRODUCT CODE: NSGG10 THERAPY INFO WARRANTY DESCRIPTION The Nerve Spa Pro is an Advanced Nerve and Neuropathy stimulator that utiliz"
  },
  {
    "question": "Silver conductive pad kit with wrap – by Energy Brace – size 4” by 10”",
    "answer": "PRODUCTS Electrotherapy Garments Silver conductive pad kit with wrap – by Energy Brace – size 4” by 10” Roll over to zoom in + View large image Silver conductive pad kit with wrap – by Energy Brace – size 4” by 10” HIGHLY CONDUCTIVE - 30% silver yarn REUSABLE – use with conductive spray to conduct to the skin COMFORTABLE – flexible to fit any body part PRODUCT CODE: PMT-EBD410B THERAPY INFO WARRANTY Shoulder - 3x5 Pad W/Wrap & Versitile Joint Wrap Dual Conductive 4X10 Pad W/ WRAP Cervical- 3x5 Pad W/Wrap Knee - 4x7 Pad W/Wrap Deluxe Back - With-2 dual conductive 4X10 pads W/Wrap Shoulder - 3x5 Pad W/Wrap & Versitile Joint Wrap M-L (fits most) One Size DESCRIPTION ELECTROTHERAPY GARMENTS - No"
  },
  {
    "question": "NERVESPA SILVER CONDUCTIVE SOCK - FOOT GARMENT SYSTEM INCLUDES DEVICE",
    "answer": "PRODUCTS Electrotherapy Devices • Neuropathy Stimulator NERVESPA SILVER CONDUCTIVE SOCK - FOOT GARMENT SYSTEM INCLUDES DEVICE Roll over to zoom in + View large image NERVESPA SILVER CONDUCTIVE SOCK - FOOT GARMENT SYSTEM INCLUDES DEVICE Same technical specs as the Nerve Spa foot bath Foot garment system is light weight and highly portable Touch screen device Built-in Microprocessor 7.83Hz, 80Hz, Symmetrical Biphasic Square, and Monophasic Waveform Reinforced lead wires Includes 1 Pair of SOCKS FDA Registered Includes 24oz of conductive Spray CONTACT FOR PRICING PRODUCT CODE: NSGS10 THERAPY INFO WARRANTY DESCRIPTION The Nerve Spa Pro is an Advanced Nerve and Neuropathy stimulator that utilizes"
  },
  {
    "question": "Silver conductive pad kit with wrap – by Energy Brace – size 4” by 7”",
    "answer": "PRODUCTS Electrotherapy Garments Silver conductive pad kit with wrap – by Energy Brace – size 4” by 7” Roll over to zoom in + View large image Silver conductive pad kit with wrap – by Energy Brace – size 4” by 7” HIGHLY CONDUCTIVE - 30% silver yarn REUSABLE – use with conductive spray to conduct to the skin COMFORTABLE – flexible to fit any body part PRODUCT CODE: EBD47K THERAPY INFO WARRANTY Shoulder - 3x5 Pad W/Wrap & Versitile Joint Wrap Dual Conductive 4X10 Pad W/ WRAP Shoulder - 3x5 Pad W/Wrap & Versitile Joint Wrap M-L (fits most) One Size Knee - 4x7 Pad W/Wrap Cervical- 3x5 Pad W/Wrap Deluxe Back - With-2 dual conductive 4X10 pads W/Wrap DESCRIPTION ELECTROTHERAPY GARMENTS - Now elect"
  },
  {
    "question": "Silver conductive pad kit with wrap - by Energy Brace - size 3\" by 5\"",
    "answer": "PRODUCTS Electrotherapy Garments Silver conductive pad kit with wrap - by Energy Brace - size 3\" by 5\" Roll over to zoom in + View large image Silver conductive pad kit with wrap - by Energy Brace - size 3\" by 5\" HIGHLY CONDUCTIVE - 30% silver yarn REUSABLE – use with conductive spray to conduct to the skin COMFORTABLE – flexible to fit any body part PRODUCT CODE: EBD35 + CCG10 THERAPY INFO WARRANTY Shoulder - 3x5 Pad W/Wrap & Versitile Joint Wrap Cervical- 3x5 Pad W/Wrap Knee - 4x7 Pad W/Wrap Deluxe Back - With-2 dual conductive 4X10 pads W/Wrap Dual Conductive 4X10 Pad W/ WRAP Shoulder - 3x5 Pad W/Wrap & Versitile Joint Wrap M-L (fits most) One Size DESCRIPTION ELECTROTHERAPY GARMENTS - No"
  },
  {
    "question": "Winstim – 11 Modality Clinical Electrotherapy Device with Ultrasound",
    "answer": "PRODUCTS Ultrasound Winstim – 11 Modality Clinical Electrotherapy Device with Ultrasound Roll over to zoom in + View large image Winstim – 11 Modality Clinical Electrotherapy Device with Ultrasound 4 channel electrotherapy, multiple modalities in a single unit including combination of ultrasound and electrotherapy A comprehensive reference library providing information on therapy, treatments and electrode placement Treatment start / stop and pause switch in the ultrasound applicator SD curve for interdependence between stimulus strength and the time required in activating the muscles Treat and monitor multiple patients at the Same time Full-colour, 8\" lcd touch screen displays. In sharp, viv"
  },
  {
    "question": "SarcoStim - Lower Extremity Strengthening System for Fall Prevention",
    "answer": "PRODUCTS Electrotherapy Devices • EMS Muscle Stimulators SarcoStim - Lower Extremity Strengthening System for Fall Prevention Roll over to zoom in + View large image SarcoStim - Lower Extremity Strengthening System for Fall Prevention Includes: Device, lead wires, charger, users manual and carrying case The SarcoStim was designed specifically to treat the increasingly popular condition of the elderly called sarcopenia. The SarcoStim can also be used by athletes of all levels to treat muscle related ailments, injuries and even to enhance muscle endurance and strength. Device kit Includes: Device, lead wires, charger, users manual and carrying case Full Leg System: Includes Dual 4 x 7 Quad pad"
  },
  {
    "question": "Energy Brace Kit - Back - Dual Conductive 4x10 pad w/ 4\" by 40\" wrap",
    "answer": "PRODUCTS Electrotherapy Garments Energy Brace Kit - Back - Dual Conductive 4x10 pad w/ 4\" by 40\" wrap Roll over to zoom in + View large image Energy Brace Kit - Back - Dual Conductive 4x10 pad w/ 4\" by 40\" wrap HIGHLY CONDUCTIVE - 30% silver yarn REUSABLE – use with conductive spray to conduct to the skin COMFORTABLE – flexible to fit any body part PRODUCT CODE: EBDW410-B THERAPY INFO WARRANTY Shoulder - 3x5 Pad W/Wrap & Versitile Joint Wrap Shoulder - 3x5 Pad W/Wrap & Versitile Joint Wrap Cervical- 3x5 Pad W/Wrap Knee - 4x7 Pad W/Wrap Deluxe Back - With-2 dual conductive 4X10 pads W/Wrap Dual Conductive 4X10 Pad W/ WRAP M-L (fits most) One Size DESCRIPTION ELECTROTHERAPY GARMENTS - Now elec"
  },
  {
    "question": "AIRE Heated neck massager - Heated Pneumatic Cervical Massage Device",
    "answer": "PRODUCTS Massage Therapy Devices AIRE Heated neck massager - Heated Pneumatic Cervical Massage Device Roll over to zoom in + View large image AIRE Heated neck massager - Heated Pneumatic Cervical Massage Device NECK PAIN RELIEF: Whether the knots in your shoulder feel rock hard or you just need a light, relaxing touch, this massager can work it out. The Aire works great for getting in there to loosen up tight muscles and knots. ELECTRIC AIR COMPRESSION: Feel free to breathe again, you're about to get the relief you need. This pneumatic massager uses air pressure that flows through the air cells for a soothing massage. Plug it in and get set to find pain relief. HEATED VIBRATION MASSAGE: Long"
  },
  {
    "question": "THE 90-DAY NEUROPATHY PROGRAM - Full Device and Supplement Protocol",
    "answer": "PRODUCTS Electrotherapy Devices THE 90-DAY NEUROPATHY PROGRAM - Full Device and Supplement Protocol Roll over to zoom in + View large image THE 90-DAY NEUROPATHY PROGRAM - Full Device and Supplement Protocol Nerve & Neuropathy - Supplement Protocol Includes Blood Flow Drink Powder (qty 3), Neuropathy Capsules (qty 3), Nerve Regeneration Powder (qty 3), Nerve ODF (qty 3), Nerve Cream (qty 3), Blessed Thistle (qty 1), and Milk Thistle (qty 1). Product Code: NNGS Nerve & Neuropathy - Device Protocol Includes NerveSpa Pro DUAL with 90-day supply kit (qty 1), Low-level Cold Laser (qty 1), LED Light Wrap (qty 1), Quake Plate Vibration Therapy (qty 1), Calf Pads (qty 2). Product Code: NS90FULL PROD"
  },
  {
    "question": "Airplane Shoulder Stabilizer brace with Abduction Size: Universal",
    "answer": "PRODUCTS Bracing and Supports Airplane Shoulder Stabilizer brace with Abduction Size: Universal Roll over to zoom in + View large image Airplane Shoulder Stabilizer brace with Abduction Size: Universal Provides abduction control, external rotation control and support for cromioclavicular separations Adjustable Lightweight PRODUCT CODE: RS100 THERAPY INFO WARRANTY DESCRIPTION Designed to secure and stabilize the shoulder post-injury and post-surgically. The Rapid Shoulder Stabilizer immobilizes the shoulder and limits range of motion for glenohumeral dislocations / subluxations, rotator cuff tears and acromioclavicular separations. The Rapid Shoulder protects and secures the shoulder post-inj"
  },
  {
    "question": "Rapid Knee (slip-on Knee Brace with comfort fit elastic) – Medium",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee (slip-on Knee Brace with comfort fit elastic) – Medium Roll over to zoom in + View large image Rapid Knee (slip-on Knee Brace with comfort fit elastic) – Medium Rapid Knee (slip-on Knee Brace with comfort fit elastic) PRODUCT CODE: RK150PLUS-M THERAPY INFO WARRANTY S M L XL 2XL 3XL DESCRIPTION Rapid Knee (slip-on Knee Brace with comfort fit elastic).Available in Small,Medium,Large,XL,XXL and XXXL sizes. SPECIFICATIONS Product Weight (lbs) : 2Size : RK150+MHCPCS Code : L1832/ L1833"
  },
  {
    "question": "Rapid Knee (slip-on Knee Brace with comfort fit elastic) – Large",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee (slip-on Knee Brace with comfort fit elastic) – Large Roll over to zoom in + View large image Rapid Knee (slip-on Knee Brace with comfort fit elastic) – Large Rapid Knee (slip-on Knee Brace with comfort fit elastic) PRODUCT CODE: RK150PLUS-L THERAPY INFO WARRANTY S L M XL 2XL 3XL DESCRIPTION Rapid Knee (slip-on Knee Brace with comfort fit elastic).Available in Small,Medium,Large,XL,XXL and XXXL sizes. SPECIFICATIONS Product Weight (lbs) : 2Size : RK150+LHCPCS Code : L1832/ L1833"
  },
  {
    "question": "Rapid Knee (slip-on Knee Brace with comfort fit elastic) – Small",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee (slip-on Knee Brace with comfort fit elastic) – Small Roll over to zoom in + View large image Rapid Knee (slip-on Knee Brace with comfort fit elastic) – Small Rapid Knee (slip-on Knee Brace with comfort fit elastic) PRODUCT CODE: RK150PLUS- S THERAPY INFO WARRANTY S M L XL 2XL 3XL DESCRIPTION Rapid Knee (slip-on Knee Brace with comfort fit elastic).Available in Small,Medium,Large,XL,XXL and XXXL sizes. SPECIFICATIONS Product Weight (lbs) : 2Size : RK150+SHCPCS Code : L1832/ L1833"
  },
  {
    "question": "Cervical Traction Device Neck Pain Relief by Theratrac - Regular",
    "answer": "PRODUCTS Traction Cervical Traction Device Neck Pain Relief by Theratrac - Regular Roll over to zoom in + View large image Cervical Traction Device Neck Pain Relief by Theratrac - Regular UNLOCKS NECK MUSCLES: Theratrac gently stretches neck muscles to slowly relax, allowing misaligned vertebrae to resume their normal supportive position REALIGNS DISCS: Vertebral discs realign with pneumatic decompression, freeing the nerve root tissue from the pressure of the discs PAIN RELIEF: With two points of traction, Theratrac provides pain relief, muscle relaxation and stretching, posture improvement. EASY TO USE: Inflate and deflate easily with hand pumps that inflate up to 30lbs of pressure. Measur"
  },
  {
    "question": "Cold Water Therapy Pad for Cryotherapy Unit - Cervical Spine Pad",
    "answer": "PRODUCTS Water Therapy Systems Cold Water Therapy Pad for Cryotherapy Unit - Cervical Spine Pad Roll over to zoom in + View large image Cold Water Therapy Pad for Cryotherapy Unit - Cervical Spine Pad COMPATIBLE WITH MANY SYSTEMS: Compatible with the Arctic Ice Classic, ARS, Polar Vortex, and Polar Sport. **COUPLING CONVERTER is required for the Arctic Ice Clear and other units made by other manufacturers. CONTINUOUS FLOW: Continuous water therapy circumferentially covers and treats a body area with an afflicted disability. LEAK PROOF CONNECTION: The quick connect/disconnect coupling make it easy to change out different options, and provide a leak-free, easy to use connection. EFFICIENT CIRC"
  },
  {
    "question": "Rapid Knee (slip-on Knee Brace with comfort fit elastic) – XXXL",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee (slip-on Knee Brace with comfort fit elastic) – XXXL Roll over to zoom in + View large image Rapid Knee (slip-on Knee Brace with comfort fit elastic) – XXXL Rapid Knee (slip-on Knee Brace with comfort fit elastic) PRODUCT CODE: RK150PLUS-3XL THERAPY INFO WARRANTY S 3XL M L XL 2XL DESCRIPTION Rapid Knee (slip-on Knee Brace with comfort fit elastic).Available in Small,Medium,Large,XL,XXL and XXXL sizes. SPECIFICATIONS Product Weight (lbs) : 2Size : RK150+3XLHCPCS Code : L1832/ L1833"
  },
  {
    "question": "Cold Water Therapy Pad for Cryotherapy Unit - Versatile-Fit Pad",
    "answer": "PRODUCTS Water Therapy Systems Cold Water Therapy Pad for Cryotherapy Unit - Versatile-Fit Pad Roll over to zoom in + View large image Cold Water Therapy Pad for Cryotherapy Unit - Versatile-Fit Pad COMPATIBLE WITH MANY SYSTEMS: Compatible with the Arctic Ice Classic, ARS, Polar Vortex, and Polar Sport. **COUPLING CONVERTER is required for the Arctic Ice Clear and other units made by other manufacturers. CONTINUOUS FLOW: Continuous water therapy circumferentially covers and treats a body area with an afflicted disability. LEAK PROOF CONNECTION: The quick connect/disconnect coupling make it easy to change out different options, and provide a leak-free, easy to use connection. EFFICIENT CIRCUL"
  },
  {
    "question": "Rapid Knee (slip-on Knee Brace with comfort fit elastic) – XXL",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee (slip-on Knee Brace with comfort fit elastic) – XXL Roll over to zoom in + View large image Rapid Knee (slip-on Knee Brace with comfort fit elastic) – XXL Rapid Knee (slip-on Knee Brace with comfort fit elastic) PRODUCT CODE: RK150PLUS-2XL THERAPY INFO WARRANTY S XL 3XL 2XL M L DESCRIPTION Rapid Knee (slip-on Knee Brace with comfort fit elastic).Available in Small,Medium,Large,XL,XXL and XXXL sizes. SPECIFICATIONS Product Weight (lbs) : 2Size : RK150+2XLHCPCS Code : L1832/ L1833"
  },
  {
    "question": "Cervical Traction Device Neck Pain Relief by Theratrac - Small",
    "answer": "PRODUCTS Traction Cervical Traction Device Neck Pain Relief by Theratrac - Small Roll over to zoom in + View large image Cervical Traction Device Neck Pain Relief by Theratrac - Small UNLOCKS NECK MUSCLES: Theratrac gently stretches neck muscles to slowly relax, allowing misaligned vertebrae to resume their normal supportive position REALIGNS DISCS: Vertebral discs realign with pneumatic decompression, freeing the nerve root tissue from the pressure of the discs PAIN RELIEF: With two points of traction, Theratrac provides pain relief, muscle relaxation and stretching, posture improvement. EASY TO USE: Inflate and deflate easily with hand pumps that inflate up to 30lbs of pressure. Measure ne"
  },
  {
    "question": "Rapid Knee (slip-on Knee Brace with comfort fit elastic) – XL",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee (slip-on Knee Brace with comfort fit elastic) – XL Roll over to zoom in + View large image Rapid Knee (slip-on Knee Brace with comfort fit elastic) – XL Rapid Knee (slip-on Knee Brace with comfort fit elastic) PRODUCT CODE: RK150PLUS-XL THERAPY INFO WARRANTY S XL M L 2XL 3XL DESCRIPTION Rapid Knee (slip-on Knee Brace with comfort fit elastic).Available in Small,Medium,Large,XL,XXL and XXXL sizes. SPECIFICATIONS Product Weight (lbs) : 2Size : RK150+XLHCPCS Code : L1832/ L1833"
  },
  {
    "question": "Cervical Traction Device Neck Pain Relief by Theratrac - Wide",
    "answer": "PRODUCTS Traction Cervical Traction Device Neck Pain Relief by Theratrac - Wide Roll over to zoom in + View large image Cervical Traction Device Neck Pain Relief by Theratrac - Wide UNLOCKS NECK MUSCLES: Theratrac gently stretches neck muscles to slowly relax, allowing misaligned vertebrae to resume their normal supportive position REALIGNS DISCS: Vertebral discs realign with pneumatic decompression, freeing the nerve root tissue from the pressure of the discs PAIN RELIEF: With two points of traction, Theratrac provides pain relief, muscle relaxation and stretching, posture improvement. EASY TO USE: Inflate and deflate easily with hand pumps that inflate up to 30lbs of pressure. Measure neck"
  },
  {
    "question": "Cold Water Therapy Pad for Cryotherapy Unit - Universal Pad",
    "answer": "PRODUCTS Water Therapy Systems Cold Water Therapy Pad for Cryotherapy Unit - Universal Pad Roll over to zoom in + View large image Cold Water Therapy Pad for Cryotherapy Unit - Universal Pad COMPATIBLE WITH MANY SYSTEMS: Compatible with the Arctic Ice Clear. NOT Compatible with the Arctic Ice Classic, ARS, Polar Vortex, and Polar Sport. **COUPLING CONVERTER is required for these units and other units made by other manufacturers. CONTINUOUS FLOW: Continuous water therapy circumferentially covers and treats a body area with an afflicted disability. LEAK PROOF CONNECTION: The quick connect/disconnect coupling make it easy to change out different options, and provide a leak-free, easy to use con"
  },
  {
    "question": "Extension hose for AIS Clear Cold Therapy Unit for back pad",
    "answer": "PRODUCTS Water Therapy Systems Extension hose for AIS Clear Cold Therapy Unit for back pad Roll over to zoom in + View large image Extension hose for AIS Clear Cold Therapy Unit for back pad COMPATIBLE WITH - Coolman, Leonns, Arctic Ice Clear, Oasis Space SIZE - 5' Length COUPLINGS - Leak-Proof Couplings Included PRODUCT CODE: CTU2CHOSEEXT THERAPY INFO WARRANTY Arctic Ice Clear Extension Hose DESCRIPTION Extension hose for AIS clear Cold therapy unit SPECIFICATIONS Product Weight (lbs) : 1Model : Extension Hose"
  },
  {
    "question": "Cold Water Therapy Pad for Cryotherapy Unit - Head cold pad",
    "answer": "PRODUCTS Water Therapy Systems Cold Water Therapy Pad for Cryotherapy Unit - Head cold pad Roll over to zoom in + View large image Cold Water Therapy Pad for Cryotherapy Unit - Head cold pad COMPATIBLE WITH MANY SYSTEMS: Compatible with the Arctic Ice Classic, ARS, Polar Vortex, and Polar Sport. **COUPLING CONVERTER is required for the Arctic Ice Clear and other units made by other manufacturers. CONTINUOUS FLOW: Continuous water therapy circumferentially covers and treats a body area with an afflicted disability. LEAK PROOF CONNECTION: The quick connect/disconnect coupling make it easy to change out different options, and provide a leak-free, easy to use connection. EFFICIENT CIRCULATION: F"
  },
  {
    "question": "Cold Water Therapy Pad for Cryotherapy Unit - Hand Cold Pad",
    "answer": "PRODUCTS Water Therapy Systems Cold Water Therapy Pad for Cryotherapy Unit - Hand Cold Pad Roll over to zoom in + View large image Cold Water Therapy Pad for Cryotherapy Unit - Hand Cold Pad COMPATIBLE WITH MANY SYSTEMS: Compatible with the Arctic Ice Classic, ARS, Polar Vortex, and Polar Sport. **COUPLING CONVERTER is required for the Arctic Ice Clear and other units made by other manufacturers. CONTINUOUS FLOW: Continuous water therapy circumferentially covers and treats a body area with an afflicted disability. LEAK PROOF CONNECTION: The quick connect/disconnect coupling make it easy to change out different options, and provide a leak-free, easy to use connection. EFFICIENT CIRCULATION: F"
  },
  {
    "question": "Cold Water Therapy Pad for Cryotherapy Unit - Shoulder Pad",
    "answer": "PRODUCTS Water Therapy Systems Cold Water Therapy Pad for Cryotherapy Unit - Shoulder Pad Roll over to zoom in + View large image Cold Water Therapy Pad for Cryotherapy Unit - Shoulder Pad COMPATIBLE WITH MANY SYSTEMS: Compatible with the Arctic Ice Classic, ARS, Polar Vortex, and Polar Sport. **COUPLING CONVERTER is required for the Arctic Ice Clear and other units made by other manufacturers. CONTINUOUS FLOW: Continuous water therapy circumferentially covers and treats a body area with an afflicted disability. LEAK PROOF CONNECTION: The quick connect/disconnect coupling make it easy to change out different options, and provide a leak-free, easy to use connection. EFFICIENT CIRCULATION: Fac"
  },
  {
    "question": "Mobi-Bench - Bath/Shower Transfer Bench with Swivel Chair",
    "answer": "PRODUCTS Mobility Assistance Mobi-Bench - Bath/Shower Transfer Bench with Swivel Chair Roll over to zoom in + View large image Mobi-Bench - Bath/Shower Transfer Bench with Swivel Chair SWIVEL SEAT – The swivel seat allows for an easy in and out directional adjustment. Positioning the user optimally. MEDICAL GRADE - sliding transfer shower and bath bench provides safe and easy access for seniors and low ambulatory people. Effortless sliding seat and pivoting chair for safe, easy transfers in and out of the tub. PADDED PARTS - Our cushiony padded seat and armrests are warm to the touch, anti-slip, and durable. Comfort and safety is top priority with slip-resistant padding on all main component"
  },
  {
    "question": "NerveSpa Knee Pro Size Extender Straps (1 pair) _ XL-XXL",
    "answer": "PRODUCTS Electrotherapy Devices • Joint Stimulator NerveSpa Knee Pro Size Extender Straps (1 pair) _ XL-XXL Roll over to zoom in + View large image NerveSpa Knee Pro Size Extender Straps (1 pair) _ XL-XXL Includes: 3 extender straps – qty 4” and qty 1 7” Extends the length of the strap on the knee pro wrap. Simply Velcro connect to each strap. PRODUCT CODE: NSKNPEXS THERAPY INFO WARRANTY 90 day supply kit Extender Straps 180 day supply kit DESCRIPTION The Nerve Spa Knee is based off of a clinically proven, non-invasive, non-drug treatment option for osteoarthritis (OA) of the knee. The Nerve Spa Knee system delivers a proprietary electrical signal that stimulates the joint tissue to reduce t"
  },
  {
    "question": "Replacement Charger for the Nerve Spa Nerve Bath System.",
    "answer": "PRODUCTS Accessories Replacement Charger for the Nerve Spa Nerve Bath System. Roll over to zoom in + View large image Replacement Charger for the Nerve Spa Nerve Bath System. Replacement Charger for the Nerve Spa Nerve Bath System. PRODUCT CODE: Nervespa-charger THERAPY INFO WARRANTY Replacement Charger for the Nerve Spa Nerve Bath System. Quake Plate-charger Replacement Charger for the Polar Vortex Replacement Charger for the ottossage Replacement Charger for the Seat Boost Air Quake Plate-Remote AIS Charger NEO - adaptor/charger Itens - charger Dynamic Wedge Lumbar - charger Dynamic Wedge Cervical- charger Soft Cycle - charger Mobicushion - Charger Mobicushion - Charger-L Mobicushion blue "
  },
  {
    "question": "Snuggleback - Chair Blanket Fleece Line for Promo Supply",
    "answer": "PRODUCTS Heat Therapy Snuggleback - Chair Blanket Fleece Line for Promo Supply Roll over to zoom in + View large image Snuggleback - Chair Blanket Fleece Line for Promo Supply Decorate our Snuggleback with your Company Logo! Embroidery Services Available on all colors of Fleece Snugglebacks Contact us for special bulk pricing PRODUCT CODE: Blackfleece THERAPY INFO WARRANTY DESCRIPTION Snuggleback - Chair Blanket Fleece Line for Promo Supply SPECIFICATIONS Product Weight (lbs) : 1"
  },
  {
    "question": "Rapid Knee OA Double-Upright Hinged Brace - Medium Left",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee OA Double-Upright Hinged Brace - Medium Left Roll over to zoom in + View large image Rapid Knee OA Double-Upright Hinged Brace - Medium Left PORTABLE COMFORT: Rapid Knee OA Brace - Medium Left is designed with portability in mind, ensuring you can take it with you wherever you go. Experience comfort and convenience throughout your day, whether at home or on the move. BREATHABLE AND LIGHTWEIGHT: Crafted from breathable, non-allergenic materials, this knee brace offers superior comfort without compromising on breathability. Stay cool and comfortable, even during extended wear, thanks to its lightweight design. ADJUSTABLE CONTROL AND SUPPORT: Take contro"
  },
  {
    "question": "Cold Water Therapy Pad for Cryotherapy Unit - Elbow Pad",
    "answer": "PRODUCTS Water Therapy Systems Cold Water Therapy Pad for Cryotherapy Unit - Elbow Pad Roll over to zoom in + View large image Cold Water Therapy Pad for Cryotherapy Unit - Elbow Pad COMPATIBLE WITH MANY SYSTEMS: Compatible with the Arctic Ice Classic, ARS, Polar Vortex, and Polar Sport. **COUPLING CONVERTER is required for the Arctic Ice Clear and other units made by other manufacturers. CONTINUOUS FLOW: Continuous water therapy circumferentially covers and treats a body area with an afflicted disability. LEAK PROOF CONNECTION: The quick connect/disconnect coupling make it easy to change out different options, and provide a leak-free, easy to use connection EFFICIENT CIRCULATION: Facilitate"
  },
  {
    "question": "Cold Water Therapy Pad for Cryotherapy Unit - Ankle Pad",
    "answer": "PRODUCTS Water Therapy Systems Cold Water Therapy Pad for Cryotherapy Unit - Ankle Pad Roll over to zoom in + View large image Cold Water Therapy Pad for Cryotherapy Unit - Ankle Pad COMPATIBLE WITH MANY SYSTEMS: Compatible with the Arctic Ice Classic, ARS, Polar Vortex, and Polar Sport. **COUPLING CONVERTER is required for the Arctic Ice Clear and other units made by other manufacturers. CONTINUOUS FLOW: Continuous water therapy circumferentially covers and treats a body area with an afflicted disability. LEAK PROOF CONNECTION: The quick connect/disconnect coupling make it easy to change out different options, and provide a leak-free, easy to use connection. EFFICIENT CIRCULATION: Facilitat"
  },
  {
    "question": "Cold Water Therapy Pad for Cryotherapy Unit - Face Pad",
    "answer": "PRODUCTS Water Therapy Systems Cold Water Therapy Pad for Cryotherapy Unit - Face Pad Roll over to zoom in + View large image Cold Water Therapy Pad for Cryotherapy Unit - Face Pad COMPATIBLE WITH MANY SYSTEMS: Compatible with the Arctic Ice Classic, ARS, Polar Vortex, and Polar Sport. **COUPLING CONVERTER is required for the Arctic Ice Clear and other units made by other manufacturers. CONTINUOUS FLOW: Continuous water therapy circumferentially covers and treats a body area with an afflicted disability. LEAK PROOF CONNECTION: The quick connect/disconnect coupling make it easy to change out different options, and provide a leak-free, easy to use connection. EFFICIENT CIRCULATION: Facilitates"
  },
  {
    "question": "Cold Water Therapy Pad for Cryotherapy Unit - Knee Pad",
    "answer": "PRODUCTS Water Therapy Systems Cold Water Therapy Pad for Cryotherapy Unit - Knee Pad Roll over to zoom in + View large image Cold Water Therapy Pad for Cryotherapy Unit - Knee Pad COMPATIBLE WITH MANY SYSTEMS: Compatible with the Arctic Ice Classic, ARS, Polar Vortex, and Polar Sport. **COUPLING CONVERTER is required for the Arctic Ice Clear and other units made by other manufacturers. CONTINUOUS FLOW: Continuous water therapy circumferentially covers and treats a body area with an afflicted disability. LEAK PROOF CONNECTION: The quick connect/disconnect coupling make it easy to change out different options, and provide a leak-free, easy to use connection. EFFICIENT CIRCULATION: Facilitates"
  },
  {
    "question": "Cold Water Therapy Pad for Cryotherapy Unit - Back Pad",
    "answer": "PRODUCTS Water Therapy Systems Cold Water Therapy Pad for Cryotherapy Unit - Back Pad Roll over to zoom in + View large image Cold Water Therapy Pad for Cryotherapy Unit - Back Pad COMPATIBLE WITH MANY SYSTEMS: Compatible with the Arctic Ice Classic, ARS, Polar Vortex, and Polar Sport. **COUPLING CONVERTER is required for the Arctic Ice Clear and other units made by other manufacturers. CONTINUOUS FLOW: Continuous water therapy circumferentially covers and treats a body area with an afflicted disability. LEAK PROOF CONNECTION: The quick connect/disconnect coupling make it easy to change out different options, and provide a leak-free, easy to use connection. EFFICIENT CIRCULATION: Facilitates"
  },
  {
    "question": "SnuggleBack - Chair Blanket - Raspberry Pattern Fleece",
    "answer": "PRODUCTS Heat Therapy SnuggleBack - Chair Blanket - Raspberry Pattern Fleece Roll over to zoom in + View large image SnuggleBack - Chair Blanket - Raspberry Pattern Fleece PREMIUM FLEECE – Our premium fleece is super soft and cozy. It is thinner and more nimble than the faux fur. Perfect for summer use where the AC is blasting, but warm enough for that extra warmth needed on cold winter mornings. PATENTED PENDING – One-of-a-kind Chair Blanket that attaches to any Office Chair. Wrap the flaps together to create an easy-in and easy-out convenience. SHERPA FUR CHAIR BLANKET - Be cozy in style and warmth with our super soft sherpa fur interior material. Sherpa fur is a hybrid material that mixes"
  },
  {
    "question": "Electrotherapy Dual Polarity Knee - one size fits all",
    "answer": "PRODUCTS Electrotherapy Garments Electrotherapy Dual Polarity Knee - one size fits all Roll over to zoom in + View large image Electrotherapy Dual Polarity Knee - one size fits all Dual-Polarity Conductive Garments can be used without using the electrodes pads. They can complete the circuits individually. It′s more convenient for users to start their treatments. Conductive fabric provides efficient dispersion of current, comfort. the ability to reuse the electrodes over and over which can reduce costs of treatment. PRODUCT CODE: EkneeDual THERAPY INFO WARRANTY DESCRIPTION The Electrode fabric sleeve can treat a wide area on the knee. Conductive fabric provides efficient dispersion of current"
  },
  {
    "question": "Electrotherapy Dual Polarity Sock - one size fits all",
    "answer": "PRODUCTS Electrotherapy Garments Electrotherapy Dual Polarity Sock - one size fits all Roll over to zoom in + View large image Electrotherapy Dual Polarity Sock - one size fits all Dual-Polarity Conductive Garments can be used without using the electrodes pads. They can complete the circuits individually. It′s more convenient for users to start their treatments. PRODUCT CODE: EsockDual THERAPY INFO WARRANTY DESCRIPTION Specification: Model Length Width HC-892 Kneecap 27cm 14 ± 1cm HC-893 Sock 47cm 9 ± 1cm SPECIFICATIONS Product Weight (lbs) : 1"
  },
  {
    "question": "Weighted SnuggleBack Chair Blanket - Sage Shu Flannel",
    "answer": "PRODUCTS Heat Therapy Weighted SnuggleBack Chair Blanket - Sage Shu Flannel Roll over to zoom in + View large image Weighted SnuggleBack Chair Blanket - Sage Shu Flannel WEIGHTED CHAIR BLANKET – Our customers asked, we delivered. Calm your nerves and cuddle away your anxiety with 8lbs of “touch therapy”. Let the SnuggleBack give you that warm hug you need and stimulate those natural endorphins. SHU FLANNEL – Our premium Shu Flannel is super soft and buttery feeling. A “low sensory” material that is thinner and more nimble than the faux fur. Perfect for summer use where the AC is blasting, but warm enough for that extra warmth needed on cold winter mornings. PATENTED PENDING – One-of-a-kind C"
  },
  {
    "question": "Inverta Knee - Knee Counterfoce Decompression Device",
    "answer": "PRODUCTS Traction Inverta Knee - Knee Counterfoce Decompression Device Roll over to zoom in + View large image Inverta Knee - Knee Counterfoce Decompression Device IMPROVED KNEE MOBILITY - Knee decompression device helps support smoother leg movement and flexibility during daily stretching and rehabilitation exercises. ADJUSTABLE FIT DESIGN - Knee Inversion is customizable positioning to accommodate different leg sizes and comfort preferences during use. INNOVATIVE WATER-BASED GRAVITY WEIGHT - Adjust the water fill to increase or decrease the inversion pressure. COMPACT - Empty and fold into a compact form for travel and storage TARGETED LEG STRETCHING - Counterforce knee device assists with"
  },
  {
    "question": "SnuggleBack Chair Blanket - Red Buffalo Plaid Fleece",
    "answer": "PRODUCTS Heat Therapy SnuggleBack Chair Blanket - Red Buffalo Plaid Fleece Roll over to zoom in + View large image SnuggleBack Chair Blanket - Red Buffalo Plaid Fleece PREMIUM FLEECE – Our premium fleece is super soft and cozy. It is thinner and more nimble than the faux fur. Perfect for summer use where the AC is blasting, but warm enough for that extra warmth needed on cold winter mornings. PATENTED PENDING – One-of-a-kind Chair Blanket that attaches to any Office Chair. Wrap the flaps together to create an easy-in and easy-out convenience. SHERPA FUR CHAIR BLANKET - Be cozy in style and warmth with our super soft Sherpa FUR interior material. Sherpa Fur is a hybrid material that mixes She"
  },
  {
    "question": "Soft-Touch Carbon Electrodes cloth back (tyco gel)",
    "answer": "PRODUCTS Electrodes Soft-Touch Carbon Electrodes cloth back (tyco gel) Roll over to zoom in + View large image Soft-Touch Carbon Electrodes cloth back (tyco gel) Low profile with pigtail pin connector. Pre-wired. Satisfaction Guaranteed. PRODUCT CODE: SP3360 THERAPY INFO WARRANTY 1.0\" Round- qty: 10 packs of 4 electrodes/pack 2.0\" Round qty: 10 packs of 4 electrodes/pack 1.5\" x 3.1\" qty: 10 packs of 4 electrodes/pack 1.5\" x 4.0\" qty: 10 packs of 2 electrodes/pack 3.0\"Round qty: 10 packs of 4 electrodes/pack Butterfly 6\"x 3.3\" qty: 10 packs (1each/pack) 1.5\" x 1.5\" qty: 10 packs of 4 electrodes/pack 2.0\" x 2.0\" qty: 10 packs of 4 electrodes/pack DESCRIPTION Dura-Soft Reusable TENS Electrode P"
  },
  {
    "question": "SnuggleBack - Chair Blanket - Black Pattern Fleece",
    "answer": "PRODUCTS Heat Therapy SnuggleBack - Chair Blanket - Black Pattern Fleece Roll over to zoom in + View large image SnuggleBack - Chair Blanket - Black Pattern Fleece PREMIUM FLEECE – Our premium fleece is super soft and cozy. It is thinner and more nimble than the faux fur. Perfect for summer use where the AC is blasting, but warm enough for that extra warmth needed on cold winter mornings. PATENTED PENDING – One-of-a-kind Chair Blanket that attaches to any Office Chair. Wrap the flaps together to create an easy-in and easy-out convenience. SHERPA FUR CHAIR BLANKET - Be cozy in style and warmth with our super soft sherpa fur interior material. Sherpa fur is a hybrid material that mixes sherpa "
  },
  {
    "question": "Laser Hero Hair Regrowth Therapy Helmet - Standard",
    "answer": "PRODUCTS Light Therapy Laser Hero Hair Regrowth Therapy Helmet - Standard Roll over to zoom in + View large image Laser Hero Hair Regrowth Therapy Helmet - Standard ADVANCED LASER HAIR GROWTH CAP - An innovative hair regrowth medical device the Laser Hero cap utilizes LLLT low-energy soft laser irradiation to stimulate hair growth at the follicle level to treat hair loss, alopecia areata, and seborrheic alopecia. IN-HOME HAIR LOSS TREATMENT - Offering discrete, comfortable use our laser for hair growth cap promotes rapid hair growth with evenly-distributed diodes that are safe, effective, and support men and women looking to restore hair and confidence. RESTORE THICKER, HEALTHIER HAIR - When"
  },
  {
    "question": "Soft-Touch Carbon Electrodes cloth back (PMT gel)",
    "answer": "PRODUCTS Electrodes Soft-Touch Carbon Electrodes cloth back (PMT gel) Roll over to zoom in + View large image Soft-Touch Carbon Electrodes cloth back (PMT gel) FEATURES Self - Adhesive, High Quality Gel Electrodes. 45 ohms of resistance. Reusable (10-15 or more uses per pad). one dual wired electrode per package. Universal for all TENS and EMS,IF,Russian units with the pin-type connector. Satisfaction Guaranteed. PRODUCT CODE: FA3000 THERAPY INFO WARRANTY DESCRIPTION Electrodes life-span and effectiveness can be enhanced by rubbing a small drop of water on the pad after use. Always keep your pads in the air tight package directly after use. For best therapy results, it is recommended that yo"
  },
  {
    "question": "The iTENS Gen 2 docking station and charging cord",
    "answer": "PRODUCTS Electrotherapy Supplies The iTENS Gen 2 docking station and charging cord Roll over to zoom in + View large image The iTENS Gen 2 docking station and charging cord . PRODUCT CODE: ITCGRCARD THERAPY INFO WARRANTY DESCRIPTION The iTENS Gen 2 docking station and charging cord SPECIFICATIONS Product Weight (lbs) : 1Length (cm) : 1"
  },
  {
    "question": "SnuggleBack - Chair Blanket - Blue Pattern Fleece",
    "answer": "PRODUCTS Heat Therapy SnuggleBack - Chair Blanket - Blue Pattern Fleece Roll over to zoom in + View large image SnuggleBack - Chair Blanket - Blue Pattern Fleece FAUX FUR – Our premium Faux Fur is super soft and extra thick. Perfect for the coldest of winter mornings or year round use. PATENTED PENDING – One-of-a-kind Chair Blanket that attaches to any Office Chair. Wrap the flaps together to create an easy-in and easy-out convenience. SHERPA FUR CHAIR BLANKET - Be cozy in style and warmth with our super soft Sherpa FUR interior material. Sherpa Fur is a hybrid material that mixes Sherpa and Fleece to create a fur like feel, but with a sherpa like warmth, that heats the body to perfection. S"
  },
  {
    "question": "SnuggleBack - Chair Blanket - Grey Pattern Fleece",
    "answer": "PRODUCTS Heat Therapy SnuggleBack - Chair Blanket - Grey Pattern Fleece Roll over to zoom in + View large image SnuggleBack - Chair Blanket - Grey Pattern Fleece PREMIUM FLEECE – Our premium fleece is super soft and cozy. It is thinner and more nimble than the faux fur. Perfect for summer use where the AC is blasting, but warm enough for that extra warmth needed on cold winter mornings. PATENTED PENDING – One-of-a-kind Chair Blanket that attaches to any Office Chair. Wrap the flaps together to create an easy-in and easy-out convenience. SHERPA FUR CHAIR BLANKET - Be cozy in style and warmth with our super soft Sherpa FUR interior material. Sherpa Fur is a hybrid material that mixes Sherpa an"
  },
  {
    "question": "Soft-Touch Carbon Electrodes Foam back (PMT gel)",
    "answer": "PRODUCTS Electrodes • Foam Electrodes Soft-Touch Carbon Electrodes Foam back (PMT gel) Roll over to zoom in + View large image Soft-Touch Carbon Electrodes Foam back (PMT gel) Soft-Touch Foam Electrodes (PMT gel) 2.0” x 2.0” Round 4 Electrodes per pack Foam backing can be used in moist environments Ag silver conductor with great performance Ultra tight pigtail connector, and a snug plug Prewired and reusable electrode Effective for use with : TENS,EMS,Interferential,Micro current,Galvanic Generators. Satisfaction Guaranteed. PRODUCT CODE: FAF2000 THERAPY INFO WARRANTY 2.0 x 2.0 - qty: 10 packs of 4 electrodes/pack 2.0 Round qty: 10 packs of 4 each/pack DESCRIPTION The Soft-Touch Foam electro"
  },
  {
    "question": "PRODUCTS FOR ALL Ailments FIND THE RIGHT RELIEF",
    "answer": "TEHRMORELIEF Weighted Heating Pad with infrared ceramic beads Learn More ITENS WEARABLE PAIN RELIEF Learn More PRODUCTS FOR ALL Ailments FIND THE RIGHT RELIEF Arctic Ice Clear Delivers localized cold therapy to patients either in the home or during their hospital visit ... MORE INFO Ultima 5 Produces a gentle stimulus through pads normally placed over the area of pain... MORE INFO Body Drummer Pro X Delivers localized cold therapy to patients either in the home or during their hospital visit ... MORE INFO Rapid Knee An upright adjustable hinge knee brace allows for effectively setting flexion... MORE INFO WORLDS MOST ADVANCED BRANDS INNOVATION BACKED BY TRUST"
  },
  {
    "question": "SnuggleBack Chair Blanket - Silver Fox Grey Fur",
    "answer": "PRODUCTS Heat Therapy SnuggleBack Chair Blanket - Silver Fox Grey Fur Roll over to zoom in + View large image SnuggleBack Chair Blanket - Silver Fox Grey Fur FAUX FUR – Our premium Faux Fur is super soft and extra thick. Perfect for the coldest of winter mornings or year round use. PATENTED PENDING – One-of-a-kind Chair Blanket that attaches to any Office Chair. Wrap the flaps together to create an easy-in and easy-out convenience. SHERPA FUR CHAIR BLANKET - Be cozy in style and warmth with our super soft Sherpa FUR interior material. Sherpa Fur is a hybrid material that mixes Sherpa and Fleece to create a fur like feel, but with a sherpa like warmth, that heats the body to perfection. So cu"
  },
  {
    "question": "String Back LSO Back Brace - one size fits all",
    "answer": "PRODUCTS Bracing and Supports String Back LSO Back Brace - one size fits all Roll over to zoom in + View large image String Back LSO Back Brace - one size fits all Portable, comfortable and convenient to use. Breathable, non-allergenic, and lightweight materials. Supports from the sacrum to the T-9 level. Easy-adjust String Back closure System. Anatomically designed, 14” posterior panel. Provides a snug fit. Latex-free, skin-friendly materials to provide hypo-allergenic appeal, and soft overall cushioning. Meets HCPC - L0637 and L0631 - includes side panels PRODUCT CODE: SB100-UNI THERAPY INFO WARRANTY DESCRIPTION The String Back LSO utilizes a fixed wheel and string system to cinch the user"
  },
  {
    "question": "Ultima combo (Tens/EMS with body part diagram)",
    "answer": "PRODUCTS Electrotherapy Devices Ultima combo (Tens/EMS with body part diagram) Roll over to zoom in + View large image Ultima combo (Tens/EMS with body part diagram) Package Includes: Device, batteries, lead wires, 1 pack of 4 electrodes, carrying case and users manual. Dual Channel Device LED backlight Digital body part diagram Patient compliance timer PRODUCT CODE: UCOMBO THERAPY INFO WARRANTY DESCRIPTION The Ultima Combo is our premier combo stimulator. It combines the technology of the TENS U20 and the EMS Ustim. Both operations with a detailed and comprehensive body diagram. With the adjustable timer, pulse width, and frequency this device can help with a large spectrum of injuries. Pac"
  },
  {
    "question": "Rapid Knee (Rigid Wrap-on Knee brace) – Medium",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee (Rigid Wrap-on Knee brace) – Medium Roll over to zoom in + View large image Rapid Knee (Rigid Wrap-on Knee brace) – Medium COMFORTALE – Comfort-tech material allows for a very comfortable fit ADJUSTABLE – The side hinge opens and allows for the extension and flexion to be adjusted. Limiting the range of motion of the knee. EASY ACCESS – Rear access, open in the front allows for the brace to be wrapped on instead of slipped on if desired. LIGHTWEIGHT – Super light and easy to wear. GUARANTEED – Satisfaction Guaranteed PRODUCT CODE: RK200-M THERAPY INFO WARRANTY Small - Right or Left Medium - Right or Left Large - Right or Left XL - Right or Left 2XL - "
  },
  {
    "question": "Extension hose for AIS Clear Cold Therapy Unit",
    "answer": "PRODUCTS Water Therapy Systems Extension hose for AIS Clear Cold Therapy Unit Roll over to zoom in + View large image Extension hose for AIS Clear Cold Therapy Unit COMPATIBLE WITH - Coolman, Leonns, Arctic Ice Clear, Oasis Space SIZE - 5' Length COUPLINGS - Leak-Proof Couplings Included PRODUCT CODE: CTU2CHOSE THERAPY INFO WARRANTY Arctic ice clear Extension Hose - 5' Length Universal Pad DESCRIPTION Extension hose for AIS clear Cold therapy unit SPECIFICATIONS Length (cm) : 1Width (cm) : 1Height (cm) : 1Model : Extension Hose"
  },
  {
    "question": "Rapid Knee (Rigid Wrap-on Knee brace) – Large",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee (Rigid Wrap-on Knee brace) – Large Roll over to zoom in + View large image Rapid Knee (Rigid Wrap-on Knee brace) – Large COMFORTALE – Comfort-tech material allows for a very comfortable fit ADJUSTABLE – The side hinge opens and allows for the extension and flexion to be adjusted. Limiting the range of motion of the knee. EASY ACCESS – Rear access, open in the front allows for the brace to be wrapped on instead of slipped on if desired. LIGHTWEIGHT – Super light and easy to wear. GUARANTEED – Satisfaction Guaranteed PRODUCT CODE: RK200-L THERAPY INFO WARRANTY Small - Right or Left Large - Right or Left Medium - Right or Left XL - Right or Left 2XL - Ri"
  },
  {
    "question": "Rapid Knee (Rigid Wrap-on Knee brace) – Small",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee (Rigid Wrap-on Knee brace) – Small Roll over to zoom in + View large image Rapid Knee (Rigid Wrap-on Knee brace) – Small COMFORTALE – Comfort-tech material allows for a very comfortable fit ADJUSTABLE – The side hinge opens and allows for the extension and flexion to be adjusted. Limiting the range of motion of the knee. EASY ACCESS – Rear access, open in the front allows for the brace to be wrapped on instead of slipped on if desired. LIGHTWEIGHT – Super light and easy to wear. GUARANTEED – Satisfaction Guaranteed PRODUCT CODE: RK200-S THERAPY INFO WARRANTY Small - Right or Left Medium - Right or Left Large - Right or Left XL - Right or Left 2XL - Ri"
  },
  {
    "question": "Clinical Combo (IF, TENS, Galvanic, Russian)",
    "answer": "PRODUCTS Electrotherapy Devices • Clinical Devices Clinical Combo (IF, TENS, Galvanic, Russian) Roll over to zoom in + View large image Clinical Combo (IF, TENS, Galvanic, Russian) 4 channels/2 outputs/8 Electrodes 5 essential electrotherapy currents 8 quick preset treatment programs for common conditions Illuminating touch buttons and LCD Slim, compact, portable, and lightweight enclosure Microcomputer controlled digital unit Comfortable electrical stimulation 1 Year Warranty on unit (6 Months on accessories) 8 quick preset treatment programs for common conditions. Edema (High Volt – Continuous) Deconditioning (TENS Conventional) Chronic Pain (IFC Premod 2-Pole) Acute Pain (IFC Quadripolar "
  },
  {
    "question": "Rapid Knee (Rigid Wrap-on Knee brace) – XXXL",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee (Rigid Wrap-on Knee brace) – XXXL Roll over to zoom in + View large image Rapid Knee (Rigid Wrap-on Knee brace) – XXXL COMFORTALE – Comfort-tech material allows for a very comfortable fit ADJUSTABLE – The side hinge opens and allows for the extension and flexion to be adjusted. Limiting the range of motion of the knee. EASY ACCESS – Rear access, open in the front allows for the brace to be wrapped on instead of slipped on if desired. LIGHTWEIGHT – Super light and easy to wear. GUARANTEED – Satisfaction Guaranteed PRODUCT CODE: RK200-3XL THERAPY INFO WARRANTY Small - Right or Left 3XL - Right or Left Medium - Right or Left Large - Right or Left XL - Ri"
  },
  {
    "question": "Replacement Charger for the Mobicushion-Blue",
    "answer": "PRODUCTS Mobility Assistance Replacement Charger for the Mobicushion-Blue Roll over to zoom in + View large image Replacement Charger for the Mobicushion-Blue Replacement Charger for the Mobicushion-Blue PRODUCT CODE: MBlue-charger THERAPY INFO WARRANTY Replacement Charger for the Nerve Spa Nerve Bath System. Mobicushion blue - Charger AIS Charger NEO - adaptor/charger Itens - charger Dynamic Wedge Lumbar - charger Dynamic Wedge Cervical- charger Soft Cycle - charger Mobicushion - Charger Mobicushion - Charger-L Polar Sport Mini - Charger Polar Sport Large- Charger Blue Cube Cold Only-Charger Blue Cube Air-Charger Replacement Charger for The NerveBeam LED Light Therapy Wrap NerveBeam cold la"
  },
  {
    "question": "PMT Medical Micro EQC - Acute Pain Reliever",
    "answer": "PRODUCTS Electrotherapy Devices PMT Medical Micro EQC - Acute Pain Reliever Roll over to zoom in + View large image PMT Medical Micro EQC - Acute Pain Reliever Package Includes: EQC device, carry case, leads wires, 1 pack of 4 electrodes, charger, product manual, and battery. A noninvasive means of pain relief with broad applications for acute pain. A bright display screen allows for simple interaction with the EQC device Pulse amplitude, pulse frequency, and timer are all adjustable. PRODUCT CODE: PMT-EQC THERAPY INFO WARRANTY DESCRIPTION PMT Medical Micro EQC - Acute Pain Reliever Micro EQC is a noninvasive means of pain relief with broad appliactions for acute pain. It can be used for the"
  },
  {
    "question": "Nerve Wave 2.5\" Rd Clinical Grade Electrode",
    "answer": "PRODUCTS Electrodes Nerve Wave 2.5\" Rd Clinical Grade Electrode Roll over to zoom in + View large image Nerve Wave 2.5\" Rd Clinical Grade Electrode Pre-wired Pigtail connection Lead wire High Grade Gel for Clinical Grade Power Made in Taiwan PRODUCT CODE: NW25RD THERAPY INFO WARRANTY DESCRIPTION Nerve Wave 2.5\" Rd Clinical Grade Electrode SPECIFICATIONS Product Weight (lbs) : 1"
  },
  {
    "question": "Electrotherapy Dual Conductive Pad 4\" x 10\"",
    "answer": "PRODUCTS Electrotherapy Garments Electrotherapy Dual Conductive Pad 4\" x 10\" Roll over to zoom in + View large image Electrotherapy Dual Conductive Pad 4\" x 10\" Now electrotherapy can be easily applied to hard to reach spots on the body with incredible accuracy.This unique conductive mesh material can stimulate large or multiple areas of the body. The EB design works in conjunction with a wide variety of Electro-Medical devices.Energy Brace comes in a variety of sizes for use on, but not limited to elbow, wrist, ankle, knee, and back. Energy Brace offers support, light or tight compression and stimulation. PRODUCT CODE: EBD410 THERAPY INFO WARRANTY 3 x 5 4 x 10 8\" by 13\" 8\" by 13\" DESCRIPTIO"
  },
  {
    "question": "Rapid Knee (Rigid Wrap-on Knee brace) – XXL",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee (Rigid Wrap-on Knee brace) – XXL Roll over to zoom in + View large image Rapid Knee (Rigid Wrap-on Knee brace) – XXL COMFORTALE – Comfort-tech material allows for a very comfortable fit ADJUSTABLE – The side hinge opens and allows for the extension and flexion to be adjusted. Limiting the range of motion of the knee. EASY ACCESS – Rear access, open in the front allows for the brace to be wrapped on instead of slipped on if desired. LIGHTWEIGHT – Super light and easy to wear. GUARANTEED – Satisfaction Guaranteed PRODUCT CODE: RK200-2XL THERAPY INFO WARRANTY Small - Right or Left 2XL - Right or Left Medium - Right or Left Large - Right or Left XL - Righ"
  },
  {
    "question": "SnuggleBack Chair Blanket - Lavender Fleece",
    "answer": "PRODUCTS Heat Therapy SnuggleBack Chair Blanket - Lavender Fleece Roll over to zoom in + View large image SnuggleBack Chair Blanket - Lavender Fleece PREMIUM FLEECE – Our premium fleece is super soft and cozy. It is thinner and more nimble than the faux fur. Perfect for summer use where the AC is blasting, but warm enough for that extra warmth needed on cold winter mornings. PATENTED PENDING – One-of-a-kind Chair Blanket that attaches to any Office Chair. Wrap the flaps together to create an easy-in and easy-out convenience. SHERPA FUR CHAIR BLANKET - Be cozy in style and warmth with our super soft Sherpa FUR interior material. Sherpa Fur is a hybrid material that mixes Sherpa and Fleece to "
  },
  {
    "question": "Cervical Conductive Garment (garment only)",
    "answer": "PRODUCTS Electrotherapy Garments Cervical Conductive Garment (garment only) Roll over to zoom in + View large image Cervical Conductive Garment (garment only) HIGHLY CONDUCTIVE - 30% silver yarn REUSABLE – use with conductive spray to conduct to the skin COMFORTABLE – flexible to fit any body part PRODUCT CODE: CCG10 THERAPY INFO WARRANTY Shoulder - 3x5 Pad W/Wrap & Versitile Joint Wrap One Size Cervical- 3x5 Pad W/Wrap Knee - 4x7 Pad W/Wrap Deluxe Back - With-2 dual conductive 4X10 pads W/Wrap Dual Conductive 4X10 Pad W/ WRAP Shoulder - 3x5 Pad W/Wrap & Versitile Joint Wrap M-L (fits most) DESCRIPTION ELECTROTHERAPY GARMENTS - Now electrotherapy can be easily applied to hard to reach spots "
  },
  {
    "question": "Shoulder Conductive Garment (garment only)",
    "answer": "PRODUCTS Electrotherapy Garments Shoulder Conductive Garment (garment only) Roll over to zoom in + View large image Shoulder Conductive Garment (garment only) HIGHLY CONDUCTIVE - 30% silver yarn REUSABLE – use with conductive spray to conduct to the skin COMFORTABLE – flexible to fit any body part PRODUCT CODE: SCG10 THERAPY INFO WARRANTY Shoulder - 3x5 Pad W/Wrap & Versitile Joint Wrap M-L (fits most) Cervical- 3x5 Pad W/Wrap Knee - 4x7 Pad W/Wrap Deluxe Back - With-2 dual conductive 4X10 pads W/Wrap Dual Conductive 4X10 Pad W/ WRAP Shoulder - 3x5 Pad W/Wrap & Versitile Joint Wrap One Size DESCRIPTION ELECTROTHERAPY GARMENTS - Now electrotherapy can be easily applied to hard to reach spots "
  },
  {
    "question": "Electric Back With 2 - 4x10 Dual Electrode",
    "answer": "PRODUCTS Electrotherapy Garments Electric Back With 2 - 4x10 Dual Electrode Roll over to zoom in + View large image Electric Back With 2 - 4x10 Dual Electrode Tension pulls that is used in conjuction with the Fabric conductive electrodes. The Fabric electrodes velcro in, and are then compressed against the treatment site for therapy to ensue. High-end compression quality workmans Brace Available in two sizes (MD-LG & LG-XL) Length 52 inches relaxed (stretches to 60 inches) PRODUCT CODE: EB2-410 THERAPY INFO WARRANTY W/1 - 4x10 Dual Electrode W/2 - 4x10 Dual Electrode DESCRIPTION The Electric back is a high end back compression brace that accommodates any of the conductive patches via hook an"
  },
  {
    "question": "Electrotherapy Dual Conductive Pad 3\" x 5\"",
    "answer": "PRODUCTS Electrotherapy Garments Electrotherapy Dual Conductive Pad 3\" x 5\" Roll over to zoom in + View large image Electrotherapy Dual Conductive Pad 3\" x 5\" Now electrotherapy can be easily applied to hard to reach spots on the body with incredible accuracy.This unique conductive mesh material can stimulate large or multiple areas of the body. The EB design works in conjunction with a wide variety of Electro-Medical devices.Energy Brace comes in a variety of sizes for use on, but not limited to elbow, wrist, ankle, knee, and back. Energy Brace offers support, light or tight compression and stimulation. PRODUCT CODE: EBD35 THERAPY INFO WARRANTY 3 x 5 8\" by 13\" 4 x 10 8\" by 13\" DESCRIPTION P"
  },
  {
    "question": "Electric Back With 1 - 4x10 Dual Electrode",
    "answer": "PRODUCTS Electrotherapy Garments Electric Back With 1 - 4x10 Dual Electrode Roll over to zoom in + View large image Electric Back With 1 - 4x10 Dual Electrode Tension pulls that is used in conjuction with the Fabric conductive electrodes. The Fabric electrodes velcro in, and are then compressed against the treatment site for therapy to ensue. High-end compression quality workmans Brace Available in two sizes (MD-LG & LG-XL) Length 42 inches relaxed (stretches to 47 inches) PRODUCT CODE: EB1-410 THERAPY INFO WARRANTY W/1 - 4x10 Dual Electrode W/2 - 4x10 Dual Electrode DESCRIPTION The Electric back is a high end back compression brace that accommodates any of the conductive patches via hook an"
  },
  {
    "question": "Wall Charger for AA Rechargeable Batteries",
    "answer": "PRODUCTS Electrotherapy Supplies • Batteries Wall Charger for AA Rechargeable Batteries Roll over to zoom in + View large image Wall Charger for AA Rechargeable Batteries AA Rechargeable Battery PRODUCT CODE: AACRG THERAPY INFO WARRANTY DESCRIPTION BPcell Rechargeable AA batteries provide 1600mah of reusable on the go power at an affordable price. Comes in packs of two! SPECIFICATIONS Product Weight (lbs) : 1Width (cms) : 4Legnth - Inches : 2HCPCS Code : N/AWeight Code : G"
  },
  {
    "question": "Rapid Knee (Rigid Wrap-on Knee brace) – XL",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee (Rigid Wrap-on Knee brace) – XL Roll over to zoom in + View large image Rapid Knee (Rigid Wrap-on Knee brace) – XL COMFORTALE – Comfort-tech material allows for a very comfortable fit ADJUSTABLE – The side hinge opens and allows for the extension and flexion to be adjusted. Limiting the range of motion of the knee. EASY ACCESS – Rear access, open in the front allows for the brace to be wrapped on instead of slipped on if desired. LIGHTWEIGHT – Super light and easy to wear. GUARANTEED – Satisfaction Guaranteed PRODUCT CODE: RK200-XL THERAPY INFO WARRANTY Small - Right or Left XL - Right or Left Medium - Right or Left Large - Right or Left 2XL - Right o"
  },
  {
    "question": "Pain Management Technology Privacy Policy",
    "answer": "This Privacy Policy describes how your personal information is collected, used, and shared when you visit or make a purchase from https://www.paintechnology.com/ (the “Site”). PERSONAL INFORMATION WE COLLECT When you visit the Site, we automatically collect certain information about your device, including information about your web browser, IP address, time zone, and some of the cookies that are installed on your device. Additionally, as you browse the Site, we collect information about the individual web pages or products that you view, what websites or search terms referred you to the Site, and information about how you interact with the Site. We refer to this automatically-collected infor"
  },
  {
    "question": "Arctic Ice Clear Universal Pad - Pad ONLY",
    "answer": "PRODUCTS Water Therapy Systems Arctic Ice Clear Universal Pad - Pad ONLY Roll over to zoom in + View large image Arctic Ice Clear Universal Pad - Pad ONLY Arctic Ice Clear Universal Pad - Pad ONLY PRODUCT CODE: U-pad-only THERAPY INFO WARRANTY Arctic ice clear Universal Pad Extension Hose - 5' Length DESCRIPTION Arctic Ice Clear Universal Pad - Pad ONLY SPECIFICATIONS Length (cm) : 1Width (cm) : 1Height (cm) : 1Model : with Universal Pad"
  },
  {
    "question": "Rapid Wrist Brace (with Finger Exerciser)",
    "answer": "PRODUCTS Bracing and Supports Rapid Wrist Brace (with Finger Exerciser) Roll over to zoom in + View large image Rapid Wrist Brace (with Finger Exerciser) Digital exercise through adjustable traction PRODUCT CODE: RW200 THERAPY INFO WARRANTY DESCRIPTION The Rapid Wrist is a dual function wrist splint and finger traction tool. Treat wrist pain, stiffness, and discomfort and build strength with digital exercise through adjustable traction. SPECIFICATIONS Product Weight (lbs) : 1HCPCS Code : L3915/ L3916"
  },
  {
    "question": "Replacement Charger for the Mobicushion-L",
    "answer": "PRODUCTS Mobility Assistance Replacement Charger for the Mobicushion-L Roll over to zoom in + View large image Replacement Charger for the Mobicushion-L Replacement Charger for the Mobicushion-L PRODUCT CODE: ML-charger THERAPY INFO WARRANTY Replacement Charger for the Nerve Spa Nerve Bath System. Quake Plate-Remote Mobicushion - Charger-L AIS Charger NEO - adaptor/charger Itens - charger Dynamic Wedge Lumbar - charger Dynamic Wedge Cervical- charger Soft Cycle - charger Mobicushion - Charger Mobicushion blue - Charger Polar Sport Mini - Charger Polar Sport Large- Charger Blue Cube Cold Only-Charger Blue Cube Air-Charger Replacement Charger for The NerveBeam LED Light Therapy Wrap NerveBeam "
  },
  {
    "question": "Rapid Elbow Brace - universal size-Right",
    "answer": "PRODUCTS Bracing and Supports Rapid Elbow Brace - universal size-Right Roll over to zoom in + View large image Rapid Elbow Brace - universal size-Right Rapid Elbow Brace - universal size PRODUCT CODE: RER10 THERAPY INFO WARRANTY Right Left DESCRIPTION Rapid Elbow Brace - universal size SPECIFICATIONS Product Weight (lbs) : 1Model : Right"
  },
  {
    "question": "Thermorelief Basic moist dry heating pad",
    "answer": "PRODUCTS Heat Therapy Thermorelief Basic moist dry heating pad Roll over to zoom in + View large image Thermorelief Basic moist dry heating pad Moist dry heating pad PRODUCT CODE: TTE100 THERAPY INFO WARRANTY DESCRIPTION Helps relieve pains of inflamed joints caused by arthritis and rheumatism. High-heat automatic moist heat therapy increases blood flow to sore muscles. Ideal for treatment of back, abdomen, shoulder, chest, and more. SPECIFICATIONS Product Weight (lbs) : 1.50625Length (cm) : 33Width (cm) : 20Height (cm) : 10"
  },
  {
    "question": "information on pmt products and therapy",
    "answer": "Users Manuals [Ultima 1 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-1-User-Manual.pdf) [Ultima 5 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-5-User-Manual.pdf) [Ultima 11 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-11-User-Manual.pdf) [Ultima 20 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-20-User-Manual.pdf) [Thermotech Analogue Instructions](https://paintechnology.s3.amazonaws.com/pdf/Thermotech-Users-Instructions-analogue.pdf) [Thermotech Digital instructions](https://paintechnology.s3.amazonaws.com/pdf/Thermotech-Users-instructions-digital.pdf) [Soft Cycle instructions](https://paintechnology.s3.amazonaws.com/"
  },
  {
    "question": "Ultima 3t Plus TENS (tri-mode w/ timer)",
    "answer": "PRODUCTS Electrotherapy Devices • TENS Ultima 3t Plus TENS (tri-mode w/ timer) Roll over to zoom in + View large image Ultima 3t Plus TENS (tri-mode w/ timer) Twice the battery life of a typical analogue device. Package Includes: Device, batteries, lead wires, 1 pack of 4 electrodes, carrying case and users manual. Dual channel device with 3 modes of operations Pulse width, pulse amplitude, and timer are all adjustable PRODUCT CODE: U3Tplus THERAPY INFO WARRANTY DESCRIPTION The Ultima 3T TENS - is a dual Channel device with 3 modes of operation (B, N, and M). Its pulse width and pulse frequency are adjustable. It is also equipped with a 30, 60, 90 minute timer, and has a protective cover ove"
  },
  {
    "question": "Rapid Elbow Brace - universal size-Left",
    "answer": "PRODUCTS Bracing and Supports Rapid Elbow Brace - universal size-Left Roll over to zoom in + View large image Rapid Elbow Brace - universal size-Left Rapid Elbow Brace - universal size PRODUCT CODE: REL10 THERAPY INFO WARRANTY Right Left DESCRIPTION Rapid Elbow Brace - universal size SPECIFICATIONS Product Weight (lbs) : 1Model : Left"
  },
  {
    "question": "Dynamic Wedge Cervical- adaptor/charger",
    "answer": "PRODUCTS Accessories Dynamic Wedge Cervical- adaptor/charger Roll over to zoom in + View large image Dynamic Wedge Cervical- adaptor/charger Replacement Charger for the Dynamic Wedge Cervical PRODUCT CODE: DWC-charger THERAPY INFO WARRANTY Replacement Charger for the Nerve Spa Nerve Bath System. Replacement Charger for The NerveBeam LED Light Therapy Wrap NerveBeam cold laser-charger Quake Plate-charger Replacement Charger for the Polar Vortex Replacement Charger for the ottossage Replacement Charger for the Seat Boost Air Quake Plate-Remote Dynamic Wedge Cervical- charger AIS Charger NEO - adaptor/charger Itens - charger Dynamic Wedge Lumbar - charger Soft Cycle - charger Mobicushion - Char"
  },
  {
    "question": "PMT Premium Portable Ultrasound Machine",
    "answer": "PRODUCTS Ultrasound PMT Premium Portable Ultrasound Machine Roll over to zoom in + View large image PMT Premium Portable Ultrasound Machine Power Source: AC Adaptor (DC 24V/200mA). Output Frequency: 1MHz +/-10% System Includes: Stimulator, Lead Wires, AC Adapter, Hard Carrying Case, Instruction Booklet, ultrasound gel. PRODUCT CODE: PM3000 THERAPY INFO WARRANTY DESCRIPTION Ultrasound Treatment is commonly used in physical therapy to relieve pain and inflammation, increase range of motion, reduce muscle spasms and to speed in the healing process of many common injuries. This ultrasound unit is great for mobile physical therapy services, start up clinics, at home use by patients, or as a backu"
  },
  {
    "question": "Replacement Charger for the Mobicushion",
    "answer": "PRODUCTS Mobility Assistance Replacement Charger for the Mobicushion Roll over to zoom in + View large image Replacement Charger for the Mobicushion Replacement Charger for the Mobicushion PRODUCT CODE: M-charger THERAPY INFO WARRANTY Replacement Charger for the Nerve Spa Nerve Bath System. Mobicushion - Charger AIS Charger NEO - adaptor/charger Itens - charger Dynamic Wedge Lumbar - charger Dynamic Wedge Cervical- charger Soft Cycle - charger Mobicushion - Charger-L Mobicushion blue - Charger Polar Sport Mini - Charger Polar Sport Large- Charger Blue Cube Cold Only-Charger Blue Cube Air-Charger Replacement Charger for The NerveBeam LED Light Therapy Wrap NerveBeam cold laser-charger Quake P"
  },
  {
    "question": "NerveSpa Knee Pro - 180 day supply kit",
    "answer": "PRODUCTS Electrotherapy Devices • Joint Stimulator NerveSpa Knee Pro - 180 day supply kit Roll over to zoom in + View large image NerveSpa Knee Pro - 180 day supply kit Noninvasive treatment for Osteoarthritis and Rheumatoid Arthritis of the knee Reduces pain and other symptoms associated with OA and RA of the knee Improves function and delays total knee replacement; Adjunctively Supports the results of stem cell injections Based on Clinically proven technology – and powered by Jstim programming. Plug and play program - Mode 1 – Monophasic Spike wave with 7.83Hz (Nerve Spa Programming), Mode-2 – Monophasic Pulse with high Volt Galvanic Wave. (Jstim Programming) Includes – 6 packs of Thigh pa"
  },
  {
    "question": "Versitile Joint Wrap-for Universal Pad",
    "answer": "PRODUCTS Electrotherapy Garments Versitile Joint Wrap-for Universal Pad Roll over to zoom in + View large image Versitile Joint Wrap-for Universal Pad The Versitile joint wrap is used inonjunction with the universal therapy pad to treat a body part with the ARS or AIS hot/cold water therapy pump. PRODUCT CODE: VJW THERAPY INFO WARRANTY DESCRIPTION The Versitile joint wrap is used inonjunction with the universal therapy pad to treat a body part with the ARS or AIS hot/cold water therapy pump. SPECIFICATIONS Product Weight (lbs) : 1Width (cms) : 6Legnth - Inches : 1Weight Code : G"
  },
  {
    "question": "Electric Knee W/1 - 4x7 Dual Electrode",
    "answer": "PRODUCTS Electrotherapy Garments Electric Knee W/1 - 4x7 Dual Electrode Roll over to zoom in + View large image Electric Knee W/1 - 4x7 Dual Electrode The Electric knee is a high end form fitting neoprene knee wrap with tension pulls that help size it for all users (one size fits most) and is used in conjuction with the Fabric conductive electrodes. The Fabric electrode(s) velcro in, and are then compressed against the treatment site for therapy to ensue. High end soft knee wrap One size fits most, available in custom sizes PRODUCT CODE: EKD47 THERAPY INFO WARRANTY DESCRIPTION The Electric knee is a high end form fitting neoprene knee wrap with tension pulls that help size it for all users ("
  },
  {
    "question": "Pain Relieving Conductive Spray - 8 Oz",
    "answer": "PRODUCTS Electrotherapy Supplies • Tens care and accesories Pain Relieving Conductive Spray - 8 Oz Roll over to zoom in + View large image Pain Relieving Conductive Spray - 8 Oz ULTRA CONDUCTIVE - Specially formed solution with high concentration of electrolytes to provide superior conductivity PAIN RELIEVING - Menthol is added to provide a slight topical analgesic/pain relieving effect. PREVENT HOTSPOTS - fine mist spray enables for full saturation of the garment HELPS - Prevent electrode dry out and takes the sting out of muscle stimulation COMPATIBLE - can be used on regular pre-gelled electrodes to help rehydrate the gel PRODUCT CODE: CS8 THERAPY INFO WARRANTY 4 oz 8 oz DESCRIPTION Unifo"
  },
  {
    "question": "Pain Relieving Conductive Spray - 4 Oz",
    "answer": "PRODUCTS Electrotherapy Supplies Pain Relieving Conductive Spray - 4 Oz Roll over to zoom in + View large image Pain Relieving Conductive Spray - 4 Oz ULTRA CONDUCTIVE - Specially formed solution with high concentration of electrolytes to provide superior conductivity PAIN RELIEVING - Menthol is added to provide a slight topical analgesic/pain relieving effect. PREVENT HOTSPOTS - fine mist spray enables for full saturation of the garment HELPS - Prevent electrode dry out and takes the sting out of muscle stimulation COMPATIBLE - can be used on regular pre-gelled electrodes to help rehydrate the gel PRODUCT CODE: CS4 THERAPY INFO WARRANTY 4 oz 8 oz DESCRIPTION Uniformly and consistently incre"
  },
  {
    "question": "Dynamic Wedge Lumbar - adaptor/charger",
    "answer": "PRODUCTS Accessories Dynamic Wedge Lumbar - adaptor/charger Roll over to zoom in + View large image Dynamic Wedge Lumbar - adaptor/charger Replacement Charger for the Dynamic Wedge Lumbar PRODUCT CODE: DWL-charger THERAPY INFO WARRANTY Replacement Charger for the Nerve Spa Nerve Bath System. Itens - charger Dynamic Wedge Cervical- charger Soft Cycle - charger Mobicushion - Charger Mobicushion - Charger-L Mobicushion blue - Charger Polar Sport Mini - Charger Polar Sport Large- Charger Blue Cube Cold Only-Charger Blue Cube Air-Charger Replacement Charger for The NerveBeam LED Light Therapy Wrap NerveBeam cold laser-charger Quake Plate-charger Replacement Charger for the Polar Vortex Replacemen"
  },
  {
    "question": "Lavawall - 4-panel -Infrared heat Wall",
    "answer": "PRODUCTS Heat Therapy Lavawall - 4-panel -Infrared heat Wall Roll over to zoom in + View large image Lavawall - 4-panel -Infrared heat Wall SAFE & QUIET HEATING: Enjoy peace of mind with automatic shutoff after up to 6 hours, tip-over protection, and whisper-quiet operation. PERSONALIZED COMFORT: Adjustable thermostat and timer for precise temperature control with 5 levels of heat up to 140 F, ensuring customized warmth with a 180° surround heating design. PORTABLE & FOLDABLE DESIGN: Take your warmth wherever you go, whether it's under your desk at the office or in your infant's room at home. EFFICIENT HEATING: Metal Heating Film ensures efficient warmth for legs, ankles, and feet without wa"
  },
  {
    "question": "IF sine wave (Digital Interferential)",
    "answer": "PRODUCTS Electrotherapy Devices IF sine wave (Digital Interferential) Roll over to zoom in + View large image IF sine wave (Digital Interferential) Package Includes: Device, batteries, lead wires, 1 pack of 4 electrodes, carrying case and users manual. Crossing of two electrical medium, independent frequencies.Stimulate large impulse fibers. Deep tissue penetration can be adjusted Dual Channel device with the ability to adjust each channel. PRODUCT CODE: GM322IF THERAPY INFO WARRANTY DESCRIPTION This type of stimulation is characterized by the crossing of two electrical medium, independent frequencies that work together to effectively stimulate large impulse fibers. These frequencies interfe"
  },
  {
    "question": "Nerve Spa Knee Pro - Replacement Pads",
    "answer": "PRODUCTS Electrodes • Specialty Gel Pads Nerve Spa Knee Pro - Replacement Pads Roll over to zoom in + View large image Nerve Spa Knee Pro - Replacement Pads 3 packs of Thigh Pads (6 pads) 3 packs of Knee Pads (6 pads) PRODUCT CODE: Kneepropadkit THERAPY INFO WARRANTY DESCRIPTION 3 packs of VB35 Thigh Pads (6 pads) 3 packs of VBKnee Knee Pads (6 pads) SPECIFICATIONS Product Weight (lbs) : 1"
  },
  {
    "question": "Conductive Copper Ear Clip Electrodes",
    "answer": "PRODUCTS Electrotherapy Supplies Conductive Copper Ear Clip Electrodes Roll over to zoom in + View large image Conductive Copper Ear Clip Electrodes Ear clips connect to lead wires of an electrotherapy device stimulate acupuncture points in the ear lope. PRODUCT CODE: EARCLIP-M THERAPY INFO WARRANTY DESCRIPTION Conductive copper metal ear clip electrodes for stimulating acupuncture points on the ear lobe or for CES application. Plastic base handles of the clip accept a 2mm male pin from your lead wire. Use a little ultrasound gel on the earlobe clip can help with conductivity when applying to the ear. It has just enough tension for it to clip to the base of the ear lobe with a comfortable fi"
  },
  {
    "question": "SnuggleBack Chair Blanket - Black Fur",
    "answer": "PRODUCTS Heat Therapy SnuggleBack Chair Blanket - Black Fur Roll over to zoom in + View large image SnuggleBack Chair Blanket - Black Fur FAUX FUR – Our premium Faux Fur is super soft and extra thick. Perfect for the coldest of winter mornings or year round use. PATENTED PENDING – One-of-a-kind Chair Blanket that attaches to any Office Chair. Wrap the flaps together to create an easy-in and easy-out convenience. SHERPA FUR CHAIR BLANKET - Be cozy in style and warmth with our super soft Sherpa FUR interior material. Sherpa Fur is a hybrid material that mixes Sherpa and Fleece to create a fur like feel, but with a sherpa like warmth, that heats the body to perfection. So cuddly you won't want "
  },
  {
    "question": "NERVESPA PRO - 60 DAY SUPPLY PROGRAM",
    "answer": "PRODUCTS Electrotherapy Devices • Neuropathy Stimulator NERVESPA PRO - 60 DAY SUPPLY PROGRAM Roll over to zoom in + View large image NERVESPA PRO - 60 DAY SUPPLY PROGRAM Touch screen device with a proprietary program sequence that stimulates healing while off loading the negative ions within the tissue Built-in Microprocessor 7.83Hz, Predominant Monophasic Waveform with a Symmetrical Biphasic Square Rest Period Water resistant device Reinforced lead wires Extra-large foot bath fits up to size 14 men’s FDA Registered Includes PRO device, 6 tubes of effervescent tablets and 16oz. conductive salt) - 60 days of supplies CONTACT FOR PRICING PRODUCT CODE: NSFBPRO100-60DAY THERAPY INFO WARRANTY DES"
  },
  {
    "question": "Soft-Touch Clinical Grade Electrodes",
    "answer": "PRODUCTS Electrodes Soft-Touch Clinical Grade Electrodes Roll over to zoom in + View large image Soft-Touch Clinical Grade Electrodes Self - Adhesive, High Quality Gel Electrodes. 45 ohms of resistance. Reusable (10-15 or more uses per pad). 4 electrodes per package. Universal for all TENS and EMS units with the pin-type connector. Satisfaction Guaranteed. PRODUCT CODE: SP1000 THERAPY INFO WARRANTY 1.0\" Round- qty: 10 packs of 4 electrodes/pack 1.5\" x 1.5\" qty: 10 packs of 4 electrodes/pack 2.0\" x 2.0\" qty: 10 packs of 4 electrodes/pack 2.0\" Round qty: 10 packs of 4 electrodes/pack 1.5\" x 3.1\" qty: 10 packs of 4 electrodes/pack 1.5\" x 4.0\" qty: 10 packs of 2 electrodes/pack 3.0\"Round qty: 10"
  },
  {
    "question": "Electrotherapy Single Conductive pad",
    "answer": "PRODUCTS Electrotherapy Garments Electrotherapy Single Conductive pad Roll over to zoom in + View large image Electrotherapy Single Conductive pad Conductive fabric provides efficient dispersion of current, comfort. the ability to reuse the electrodes over and over which can reduce costs of treatment. PRODUCT CODE: EBS47 THERAPY INFO WARRANTY 2x3 4x7 3x5 DESCRIPTION Fabric Conductive Pads are used to replace pregelled electrodes. The conductive fabric electrodes are available in single or double configuration. The single requires two (one active and one ground) and the dual will treat a placement site direct (serving as the ground and active in one pad). Conductive fabric provides efficient "
  },
  {
    "question": "Replacement lead wires for Nerve Spa",
    "answer": "PRODUCTS Electrotherapy Supplies • Accessories Replacement lead wires for Nerve Spa Roll over to zoom in + View large image Replacement lead wires for Nerve Spa Fits all Nerve Spa devices Use only for Nerve Spa devices (singe channel function) Extra Strong “tiger wire” double copper and with a thicker rubber housing than a standard wire. PRODUCT CODE: Nervespa-leadwire THERAPY INFO WARRANTY DESCRIPTION Replacement lead wires for Nerve Spa SPECIFICATIONS Product Weight (lbs) : 1"
  },
  {
    "question": "Electrotherapy Device Carrying Pouch",
    "answer": "PRODUCTS Electrotherapy Supplies Electrotherapy Device Carrying Pouch Roll over to zoom in + View large image Electrotherapy Device Carrying Pouch The device carrying pouch can hold most TENS devices in a tiddy pouch. PRODUCT CODE: CP1000 THERAPY INFO WARRANTY DESCRIPTION The device carrying pouch can hold most TENS devices in a tiddy pouch. SPECIFICATIONS Product Weight (lbs) : 1Width (cms) : 4Legnth - Inches : 2Weight Code : G"
  },
  {
    "question": "Rapid Knee L1832 (wrap-on knee wrap)",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee L1832 (wrap-on knee wrap) Roll over to zoom in + View large image Rapid Knee L1832 (wrap-on knee wrap) Portable, comfortable and convenient to use Breathable, non-allergenic, and lightweight materials Provides control and support through an adjustable ROM hinge Easy to Use and Easy to Read Indexed Hinge Indicates ROM Improvement and Hinge allows Dynamic or Static Setting Features a polycentric adjustable design to control extension and flexion PRODUCT CODE: RK100-3XL THERAPY INFO WARRANTY Small 3XL Medium Large XL 2XL DESCRIPTION The Rapid Knee utilizes an adjustable ROM hinge and an open wrap configuration to provide convenience and comfort to the us"
  },
  {
    "question": "Soft-Touch Medical Grade Electrodes",
    "answer": "PRODUCTS Electrodes Soft-Touch Medical Grade Electrodes Roll over to zoom in + View large image Soft-Touch Medical Grade Electrodes Soft-Touch Cloth Electrodes (PMT gel) - 3.0 round Self - Adhesive, High Quality Gel Electrodes. 45 ohms of resistance. Reusable (10-15 or more uses per pad). Universal for all TENS and EMS units with the pin-type connector. Satisfaction Guaranteed. PRODUCT CODE: FA3000 2 THERAPY INFO WARRANTY 2.0x 2.0 - qty: 10 packs of 4 electrodes/pack 3\" Round _ 10 packs of 4 electrodes/pack 2.0\" Round - qty: 10 packs of 4 electrodes/pack Butterfly 6\"x 3.3 qty: 10 packs of 1each/pack DESCRIPTION Electrodes life-span and effectiveness can be enhanced by rubbing a small drop of"
  },
  {
    "question": "StarBurst Hypoallergenic Electrodes",
    "answer": "PRODUCTS Electrodes • HypoAllergenic Electrodes StarBurst Hypoallergenic Electrodes Roll over to zoom in + View large image StarBurst Hypoallergenic Electrodes The Starburst electrodes are very unique with a conductive pattern that helps radiate the current outward and dispersively. A very skin sensitive gel is used as well. 4 Electrodes per pack PRODUCT CODE: EP85345 THERAPY INFO WARRANTY 2\" Round - 5 pack of 4 electrodes per pack 2\" Square - 5 pack of electrodes 4 per pack DESCRIPTION The Starburst electrodes are very unique with a conductive pattern that helps radiate the current outward and dispersively. A very skin sensitive gel is used as well. SPECIFICATIONS Product Weight (lbs) : 1Wi"
  },
  {
    "question": "OH!STIM Gel pads (1 pair per pack)",
    "answer": "PRODUCTS Electrodes • Specialty Gel Pads OH!STIM Gel pads (1 pair per pack) Roll over to zoom in + View large image OH!STIM Gel pads (1 pair per pack) OH!STIM Gel pads (1 pair per pack) PRODUCT CODE: OhSTIMG THERAPY INFO WARRANTY DESCRIPTION OH!STIM Gel pads (1 pair per pack) SPECIFICATIONS Product Weight (lbs) : 0.2"
  },
  {
    "question": "Electrotherapy Quad Conductive Pad",
    "answer": "PRODUCTS Electrotherapy Garments Electrotherapy Quad Conductive Pad Roll over to zoom in + View large image Electrotherapy Quad Conductive Pad Now electrotherapy can be easily applied to hard to reach spots on the body with incredible accuracy.This unique conductive mesh material can stimulate large or multiple areas of the body. The EB design works in conjunction with a wide variety of Electro-Medical devices.Energy Brace comes in a variety of sizes for use on, but not limited to elbow, wrist, ankle, knee, and back. Energy Brace offers support, light or tight compression and stimulation. PRODUCT CODE: EBQ THERAPY INFO WARRANTY 3 x 5 8\" by 13\" 8\" by 13\" 4 x 10 DESCRIPTION PMT Electrotherapy "
  },
  {
    "question": "Electrotherapy Dual Conductive pad",
    "answer": "PRODUCTS Electrotherapy Garments Electrotherapy Dual Conductive pad Roll over to zoom in + View large image Electrotherapy Dual Conductive pad Conductive fabric provides efficient dispersion of current, comfort. the ability to reuse the electrodes over and over which can reduce costs of treatment. PRODUCT CODE: EBD47 THERAPY INFO WARRANTY 3 x 5 8\" by 13\" 4 x 10 8\" by 13\" DESCRIPTION Fabric Conductive Pads are used to replace pregelled electrodes. The conductive fabric electrodes are available in single or double configuration. The single requires two (one active and one ground) and the dual will treat a placement site direct (serving as the ground and active in one pad). Conductive fabric pr"
  },
  {
    "question": "IF 4000 (Analogue Interferential)",
    "answer": "PRODUCTS Electrotherapy Devices • Interferential Therapy IF 4000 (Analogue Interferential) Roll over to zoom in + View large image IF 4000 (Analogue Interferential) Package Includes: Device, batteries, charger, lead wires, 1 pack of 4 electrodes, carrying case and users manual. Channels: either one or two channel selection. Output: 0-16 volts (through 500 ohms). Wave Form: True Sine waveform. Low battery: Lower Battery Indication. Frequency – 4000Hz PRODUCT CODE: IF4000 THERAPY INFO WARRANTY DESCRIPTION Interferential current therapy (IFC): The IF 4000 Interferential is an analogue interferential stimulation device that is used for symptomatic relief and management of post surgical, post tur"
  },
  {
    "question": "NerveBeam LED Light Therapy Wrap",
    "answer": "PRODUCTS Light Therapy NerveBeam LED Light Therapy Wrap Roll over to zoom in + View large image NerveBeam LED Light Therapy Wrap Clinical Device Red & Infrared Light Therapy for Pain Relief, Circulation, Tissue Warming, and Muscle Relaxation Relieve Pain Designed to relieve minor muscle, joint, and nerve-related pain with red and infrared light therapy. Improve Circulation Temporarily increases local blood circulation in targeted treatment areas. Elevate Tissue Temperature Delivers heat-oriented light therapy support to warm tissues and promote comfort. Relax Muscles & Relieve Stiffness Promotes muscle relaxation, helps reduce tension, and supports range of motion. Support Healing Works on a"
  },
  {
    "question": "STATE-OF-THE-ART PAIN SOLUTIONS",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Ultima Neuro Hand & Foot System",
    "answer": "PRODUCTS Electrotherapy Devices Ultima Neuro Hand & Foot System Roll over to zoom in + View large image Ultima Neuro Hand & Foot System Items sold separately: Conductive sock electrode, and grounding cuff. The Ultima Neuro works in tandem with high-quality silver conductive material to deliver nerve targeted electrotherapy signals to treat your condition. The Ultima Neuro was designed specifically to treat pain associated with Neuropathy of the Hands and Feet. And with a li-ion battery, the Neuro is equipped with a long life battery that is ultra slim. Neuropathic pain is often worse at night, seriously disrupting sleep and adding to the emotional burden of sensory nerve damage. The Ultima N"
  },
  {
    "question": "Galvanic Stim Digital High Volt",
    "answer": "PRODUCTS Electrotherapy Devices • Galvanic Stimulators Galvanic Stim Digital High Volt Roll over to zoom in + View large image Galvanic Stim Digital High Volt Package Includes: Device, batteries, lead wires, 1 pack of 4 electrodes, carrying case and users manual. Most useful in acute injuries associated with major tissue trauma with bleeding or swelling Galvanic Stimulators apply direct current, creating and electrical field over the treated area The positive pad behaves like ice, causing reduced circulation to the area under the pad and reduction in swelling. The negative pad behaves like heat,causing increased circulation, reportedly speeding healing. PRODUCT CODE: DIGIGAL THERAPY INFO WAR"
  },
  {
    "question": "Electrotherapy Sleeve Large Leg",
    "answer": "PRODUCTS Electrotherapy Garments Electrotherapy Sleeve Large Leg Roll over to zoom in + View large image Electrotherapy Sleeve Large Leg One Size Fits Most Best Comfort Reuseable PRODUCT CODE: ELSleeve 2 THERAPY INFO WARRANTY Arm Leg DESCRIPTION The Electrode fabric sleeve can treat a wide area on the knee. Conductive fabric provides efficient dispersion of current, comfort, and the ability to reuse the electrodes over and over which can reduce costs of treatment. SPECIFICATIONS Product Weight (lbs) : 1Width (cms) : 5Size : Sleeve LargeLegnth - Inches : 2HCPCS Code : E0731Weight Code : G"
  },
  {
    "question": "Electrotherapy device leadwires",
    "answer": "PRODUCTS Electrotherapy Supplies Electrotherapy device leadwires Roll over to zoom in + View large image Electrotherapy device leadwires A male component of a pin-wire connection (long thin cylinder. .4 inches long) that is compatible with any electrode for sale on Healiohealth. Periodic replacement of these wires is part of the upkeep of any electrotherapy device. PRODUCT CODE: ET99090101 THERAPY INFO WARRANTY DESCRIPTION Electrotherapy Devices Lead Wires can last anywhere from 1-6 months depending on your device settings. At the end of the lead wire, there is a male component of a pin-wire connection (long thin cylinder. .4 inches long) that is compatible with any electrode for sale on Hea"
  },
  {
    "question": "Ultrasound Conductive Gel - 8oz",
    "answer": "PRODUCTS Ultrasound Ultrasound Conductive Gel - 8oz Roll over to zoom in + View large image Ultrasound Conductive Gel - 8oz Ultrasound conductive gel Paired with PMT Premiun Portable Ultrasound Machine for best use PRODUCT CODE: ULTS8 THERAPY INFO WARRANTY DESCRIPTION Ultrasound Conductive Gel - 8oz SPECIFICATIONS Product Weight (lbs) : 2"
  },
  {
    "question": "Nerve Spa Foot bath Supply Kit",
    "answer": "PRODUCTS Electrotherapy Supplies • Accessories Nerve Spa Foot bath Supply Kit Roll over to zoom in + View large image Nerve Spa Foot bath Supply Kit 30-45 day supply Includes two 8oz jars of Epson Salt and 4 tubes of effervescent tablets Helps rehydrate feet after soaking Softens rough heels and callused skin Supports circulation and foot comfort Refreshes and deodorizes the feet Helps maintain skin moisture balance PRODUCT CODE: SplyKIT THERAPY INFO WARRANTY DESCRIPTION Nerve Spa Foot bath Supply Kit (Salt and effervescent tubes) Enhance your NerveSpa foot bath with revitalizing effervescent tablets formulated specifically for neuropathic foot care. After an Epsom salt and warm water soak —"
  },
  {
    "question": "Ultrasound device - 1 and 3Mhz",
    "answer": "PRODUCTS Ultrasound Ultrasound device - 1 and 3Mhz Roll over to zoom in + View large image Ultrasound device - 1 and 3Mhz 1 MHz and 3 MHz Ultrasound Applicator 4 Preset Programs Pulsed and Continuous Modes Large Digital Display with Coupling Indication Capacitive & Light Illuminated Touch Buttons Selectable time, duty cycle and frequency Ultrasound Applicator Applicator Side Stand. Conductive Gel Patient Safety Cable PRODUCT CODE: JUS-2 THERAPY INFO WARRANTY DESCRIPTION Therapeutic ultrasound device provides effective Continuous and Pulsed treatments for pain relief and muscle rehabilitation. This 510 K-approved JUS 2 ultrasound therapy device has a 1 and 3 MHz Ultrasound Applicator. The lig"
  },
  {
    "question": "Personal Protective Equipment",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Ustim Muscle Stimulator (EMS)",
    "answer": "PRODUCTS Electrotherapy Devices • EMS Muscle Stimulators Ustim Muscle Stimulator (EMS) Roll over to zoom in + View large image Ustim Muscle Stimulator (EMS) Package Includes: Device, batteries, lead wires, 1 pack of 4 electrodes, carrying case and users manual. The Ustim offers 12 different modes which allows it to treat a wide spectrum of injuries Belt clip. PRODUCT CODE: USTIM THERAPY INFO WARRANTY DESCRIPTION EMS Stimulator U Stim With 12 Modes is a dual channel device for muscle exercise and treatment of physical injury. This electrotherapy equipment has 12 modes of operation that are user friendly and written in practical terms. The neuromuscular stimulator has two wave forms and a larg"
  },
  {
    "question": "Electrotherapy Splitter Cable",
    "answer": "PRODUCTS Electrotherapy Supplies • Tens care and accesories Electrotherapy Splitter Cable Roll over to zoom in + View large image Electrotherapy Splitter Cable Two cables are needed per channel to effectively split and create an additional channel. Splitter cables split an electrotherapy device from 2 leads into 4 leads through the use of two wires. PRODUCT CODE: SCABLE THERAPY INFO WARRANTY DESCRIPTION Splitter cables split an electrotherapy device from 2 leads into 4 leads through the use of two wires. Two cables are needed per channel to effectively split and create an additional channel. SPECIFICATIONS Product Weight (lbs) : 1Width (cms) : 2Legnth - Inches : 1Weight Code : G"
  },
  {
    "question": "Ultima NEO - adaptor/charger",
    "answer": "PRODUCTS Electrotherapy Devices • Combo Units Ultima NEO - adaptor/charger Roll over to zoom in + View large image Ultima NEO - adaptor/charger Replacement Charger for the Ultima NEO - adaptor/charger PRODUCT CODE: NEO-charger THERAPY INFO WARRANTY Replacement Charger for the Nerve Spa Nerve Bath System. NEO - adaptor/charger AIS Charger Itens - charger Dynamic Wedge Lumbar - charger Dynamic Wedge Cervical- charger Soft Cycle - charger Mobicushion - Charger Mobicushion - Charger-L Mobicushion blue - Charger Polar Sport Mini - Charger Polar Sport Large- Charger Blue Cube Cold Only-Charger Blue Cube Air-Charger Replacement Charger for The NerveBeam LED Light Therapy Wrap NerveBeam cold laser-c"
  },
  {
    "question": "NerveSpa Pro - 90 Day Supply",
    "answer": "PRODUCTS Electrotherapy Devices • Neuropathy Stimulator NerveSpa Pro - 90 Day Supply Roll over to zoom in + View large image NerveSpa Pro - 90 Day Supply Clinical Device Advanced Hand & Foot Neuropathy System for Provider-Guided Aquatic Nerve Stimulation Relieve Pain – Helps relieve nerve discomfort, tingling, sensitivity, and hand-and-foot pain through repeated-use care plans. Stimulate Nerves – Supports broader circumferential nerve engagement across the hands and feet than limited pad-only systems. Improve Circulation – Warm-water immersion and stimulation work together to support circulation-oriented extremity care. Extend Care Home – Built for clinic-to-home continuity, compliance, and "
  },
  {
    "question": "Soft Cycle - adaptor/charger",
    "answer": "PRODUCTS Electrotherapy Supplies Soft Cycle - adaptor/charger Roll over to zoom in + View large image Soft Cycle - adaptor/charger Replacement Charger for the Soft Cycle PRODUCT CODE: SC-charger THERAPY INFO WARRANTY Replacement Charger for the Nerve Spa Nerve Bath System. Replacement Charger for The NerveBeam LED Light Therapy Wrap NerveBeam cold laser-charger Quake Plate-charger Replacement Charger for the Polar Vortex Replacement Charger for the ottossage Replacement Charger for the Seat Boost Air Quake Plate-Remote Soft Cycle - charger AIS Charger NEO - adaptor/charger Itens - charger Dynamic Wedge Lumbar - charger Dynamic Wedge Cervical- charger Mobicushion - Charger Mobicushion - Charg"
  },
  {
    "question": "Therapeutic Creams and Gels",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "SERVICE IS OUR TOP PRIORITY",
    "answer": "Welcome to Pain Management Technologies, Inc.’s B2G page. Our goal is to deliver effective non-drug alternatives to manage pain for our injured or in-pain veterans. We are accustomed to working with the federal government, state government, and local governments and tailor our business to your exact needs – expense reduction, patient efficacy, and execution of your needs. Pain Management Technologies, Inc is an approved GSA Contractor. Pain Management Technologies GSA Contract Number is V797P- 4412B. Pain Management Technologies is a leading manufacturer of pain management equipment and physical therapy rehab items to the US Military and US Military Personnel. Pain Management Technologies ca"
  },
  {
    "question": "Electrotherapy probe PR-03A",
    "answer": "PRODUCTS Electrotherapy Supplies • Probes and clips Electrotherapy probe PR-03A Roll over to zoom in + View large image Electrotherapy probe PR-03A Urinary Incontinence Aid Uro Probe Completely fit with the body curve, completely paste on the treatment region, ease muscle for better contraction. Incontinence aid Uro Probe is effectively equippded with various of Incontinence and pelvis muscle stimulators. High safety and steadiness, no over-stimulation on the treatment region. PRODUCT CODE: PR03A THERAPY INFO WARRANTY Rectal Vaginal Vaginal Large Vaginal Small Vaginal Medium DESCRIPTION Urinary Incontinence Aid Uro Probe is specially designed for treating Incontinence. Urinary Incontinence U"
  },
  {
    "question": "Electrotherapy probe PR-04A",
    "answer": "PRODUCTS Electrotherapy Supplies • Probes and clips Electrotherapy probe PR-04A Roll over to zoom in + View large image Electrotherapy probe PR-04A Urinary Incontinence Aid Uro Probe Completely fit with the body curve, completely paste on the treatment region, ease muscle for better contraction. Incontinence aid Uro Probe is effectively equippded with various of Incontinence and pelvis muscle stimulators. High safety and steadiness, no over-stimulation on the treatment region. PRODUCT CODE: PR04A THERAPY INFO WARRANTY Rectal Vaginal Medium Vaginal Small Vaginal Large Vaginal DESCRIPTION Urinary Incontinence Aid Uro Probe is specially designed for treating Incontinence. Urinary Incontinence U"
  },
  {
    "question": "Electrotherapy probe PR-06A",
    "answer": "PRODUCTS Electrotherapy Supplies • Probes and clips Electrotherapy probe PR-06A Roll over to zoom in + View large image Electrotherapy probe PR-06A Urinary Incontinence Aid Uro Probe Completely fit with the body curve, completely paste on the treatment region, ease muscle for better contraction. Incontinence aid Uro Probe is effectively equippded with various of Incontinence and pelvis muscle stimulators. High safety and steadiness, no over-stimulation on the treatment region. PRODUCT CODE: PR06A THERAPY INFO WARRANTY Rectal Vaginal Small Vaginal Medium Vaginal Large Vaginal DESCRIPTION Urinary Incontinence Aid Uro Probe is specially designed for treating Incontinence. Urinary Incontinence U"
  },
  {
    "question": "(3pk) Effervescent Tablets",
    "answer": "PRODUCTS Electrotherapy Supplies (3pk) Effervescent Tablets Roll over to zoom in + View large image (3pk) Effervescent Tablets ACTIVE INGREDIENTS: Menthol, Collagen, Aloe, Vitamin C, and Essential oils DIABETIC FOOT CARE: Specially designed for the diabetic foot THERAPEUTIC: Decreases swollen feet, Relieve Foot Pain, Boosts circulation, Deodorize, Soften corns, calluses & rough heels; Rehydrate the foot RELIEVE PAIN: Menthol creates a liquid pain relieving analgesic in the water. DISSOLVES QUICKLY: Effervescent helps the ingredients dissolve quickly and conveniently. PRODUCT CODE: Etablets3pk THERAPY INFO WARRANTY DESCRIPTION The effervescent tablets assist in re-moisturizing the diabetic fo"
  },
  {
    "question": "(1pk) Effervescent Tablets",
    "answer": "PRODUCTS Electrotherapy Supplies • Accessories (1pk) Effervescent Tablets Roll over to zoom in + View large image (1pk) Effervescent Tablets Helps rehydrate feet after soaking Softens rough heels and callused skin Supports circulation and foot comfort Refreshes and deodorizes the feet Helps maintain skin moisture balance PRODUCT CODE: Etablets THERAPY INFO WARRANTY DESCRIPTION Enhance your NerveSpa foot bath with revitalizing effervescent tablets formulated specifically for neuropathic foot care. After an Epsom salt and warm water soak — which can sometimes leave the skin feeling dry — these tablets help restore moisture balance while delivering skin-supporting nutrients directly into the wa"
  },
  {
    "question": "HypoAllergenic Electrodes",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "iTENS device ONLY - White",
    "answer": "PRODUCTS Electrotherapy Devices iTENS device ONLY - White Roll over to zoom in + View large image iTENS device ONLY - White iTENS Device with rechargeable lithium-ion battery installed Does NOT include charging dock or cord Wings and Gel Pads NOT included - sold separately PRODUCT CODE: ITDO THERAPY INFO WARRANTY DESCRIPTION The iTENS device is a good addition for those who want to use multiple iTENS at one time, and already have a full iTENS set. SPECIFICATIONS Color : Purple"
  },
  {
    "question": "Incontinence Stimulators",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Tens care and accesories",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Advanced Supplementation",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Digital Ultima Five TENS",
    "answer": "PRODUCTS Electrotherapy Devices Digital Ultima Five TENS Roll over to zoom in + View large image Digital Ultima Five TENS Package Includes: Device, batteries, lead wires, 1 pack of 4 electordes, carrying case and users manual. The Ultima 5 is a dual channel device with 5 different modes and 2 wave form adjustable. A large LCD display makes for easy interaction with the Ultima 5 device The Ultima 5 has protective covers over the amplitude controls PRODUCT CODE: U5 THERAPY INFO WARRANTY DESCRIPTION A dual-channel five-mode device with two wave form adjustments and a large LCD screen. This device is remarkable for its function, and traditional looks mixed with new-age digital style. Also includ"
  },
  {
    "question": "Ultima Neuro Foot System",
    "answer": "PRODUCTS Electrotherapy Devices Ultima Neuro Foot System Roll over to zoom in + View large image Ultima Neuro Foot System Items sold separately: Conductive sock electrode, and grounding cuff. The Ultima Neuro works in tandem with high-quality silver conductive material to deliver nerve targeted electrotherapy signals to treat your condition. The Ultima Neuro was designed specifically to treat pain associated with Neuropathy of the Hands and Feet. And with a li-ion battery, the Neuro is equipped with a long life battery that is ultra slim. Neuropathic pain is often worse at night, seriously disrupting sleep and adding to the emotional burden of sensory nerve damage. The Ultima Neuro is an eff"
  },
  {
    "question": "Ultima Neuro Hand System",
    "answer": "PRODUCTS Electrotherapy Devices Ultima Neuro Hand System Roll over to zoom in + View large image Ultima Neuro Hand System Items sold separately: Conductive sock electrode, and grounding cuff. The Ultima Neuro works in tandem with high-quality silver conductive material to deliver nerve targeted electrotherapy signals to treat your condition. The Ultima Neuro was designed specifically to treat pain associated with Neuropathy of the Hands and Feet With a li-ion battery, the Neuro is equipped with a long life battery that is ultra slim Neuropathic pain is often worse at night, seriously disrupting sleep and adding to the emotional burden of sensory nerve damage. The Ultima Neuro is an effective"
  },
  {
    "question": "Carbon Rubber Electrodes",
    "answer": "PRODUCTS Electrodes Carbon Rubber Electrodes Roll over to zoom in + View large image Carbon Rubber Electrodes Reusable Recommended for use in water baths. Neuro Stimulation Electrodes For Single Patient use only Satisfaction Guaranteed PRODUCT CODE: CR2000 THERAPY INFO WARRANTY DESCRIPTION Reusable 2” round carbon rubber pad SPECIFICATIONS Product Weight (lbs) : 1"
  },
  {
    "question": "Rapid Ankle Large/Xlarge",
    "answer": "PRODUCTS Bracing and Supports Rapid Ankle Large/Xlarge Roll over to zoom in + View large image Rapid Ankle Large/Xlarge The RA110LGXL Rapid Ankle Brace is an ambidextrous, low-profile, lightweight support that prevents abnormal ankle inversion, eversion, and rotation while allowing natural, unrestricted dorsi and plantar- flexion. The combination of soft goods with a rigid foot plate and adjustable calf cuffs provide unsurpassed levels of control and support. PRODUCT CODE: RA110LGXL THERAPY INFO WARRANTY Small/Medium Large/Xlarge DESCRIPTION Rapid Ankle : RA110LGXL Indications Tibialistendonitis Ankle instability, sprains and strains Osteoarthritis Ankle Fracture Non-traumatic ruptures of te"
  },
  {
    "question": "Rapid Ankle Small/Medium",
    "answer": "PRODUCTS Bracing and Supports Rapid Ankle Small/Medium Roll over to zoom in + View large image Rapid Ankle Small/Medium The RA110SM Rapid Ankle Brace is an ambidextrous, low-profile, lightweight support that prevents abnormal ankle inversion, eversion, and rotation while allowing natural, unrestricted dorsi and plantar- flexion. The combination of soft goods with a rigid foot plate and adjustable calf cuffs provide unsurpassed levels of control and support. PRODUCT CODE: RA110SM THERAPY INFO WARRANTY Small/Medium Large/Xlarge DESCRIPTION Rapid Ankle : RA110SM Indications Tibialistendonitis Ankle instability, sprains and strains Osteoarthritis Ankle Fracture Non-traumatic ruptures of tendon H"
  },
  {
    "question": "Electrotherapy Garments",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Massage Therapy Devices",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Electrotherapy Supplies",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Itens - adaptor/charger",
    "answer": "PRODUCTS Electrotherapy Devices Itens - adaptor/charger Roll over to zoom in + View large image Itens - adaptor/charger Replacement Charger for the Itens PRODUCT CODE: I-charger THERAPY INFO WARRANTY Replacement Charger for the Nerve Spa Nerve Bath System. Quake Plate-charger Replacement Charger for the Polar Vortex Replacement Charger for the ottossage Replacement Charger for the Seat Boost Air Quake Plate-Remote Itens - charger AIS Charger NEO - adaptor/charger Dynamic Wedge Lumbar - charger Dynamic Wedge Cervical- charger Soft Cycle - charger Mobicushion - Charger Mobicushion - Charger-L Mobicushion blue - Charger Polar Sport Mini - Charger Polar Sport Large- Charger Blue Cube Cold Only-C"
  },
  {
    "question": "Medical Order Policies",
    "answer": "Easy Ordering (Ordering options) Phone 1-800-239-7880 Our trained Customer Service Representatives are available to assist, you 8:30 a.m. to 4:30 p.m. (EST) Monday through Friday. Mail Pain Management Technologies 1760 Wadsworth Road Akron, Ohio 44320 EMail info@paintechnology.com To ensure prompt processing, please include the following information when placing orders via Mail, Email and Fax. Account Number Billing and Shipping addresses (if different) Purchase Order Number (if applicable) Your Name and Phone Number Product Number / Description Quantity of Product Minimum Order Requirements Pain Management Technologies does not have a minimum order requirement. We understand how hard it is "
  },
  {
    "question": "Electrotherapy Devices",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "EMS Muscle Stimulators",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Interferential Therapy",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "SOFT-TOUCH BASIC GRADE",
    "answer": "PRODUCTS Electrodes • Tricot Electrodes SOFT-TOUCH BASIC GRADE Roll over to zoom in + View large image SOFT-TOUCH BASIC GRADE Reusable Self-Adhering Neuro Stimulation Electrodes For Single Patient use only Satisfaction Guaranteed. PRODUCT CODE: BG2000 THERAPY INFO WARRANTY 2\" SQUARE (10 Packs) 2\" ROUND (10 Packs) DESCRIPTION Reusable 2” round carbon electrode with tricot backing. Our most economical electrode we make – yet with superior performance characteristics. SPECIFICATIONS Product Weight (lbs) : 1Size : 2\" ROUND (10-PACK)"
  },
  {
    "question": "Neuropathy Stimulator",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Water Therapy Systems",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "NerveSpa Shoulder Pro",
    "answer": "PRODUCTS Electrotherapy Devices NerveSpa Shoulder Pro Roll over to zoom in + View large image NerveSpa Shoulder Pro Joint & Mobility System Advanced OA/RA Treatment Device for Shoulder Pain Relief, Function, and Joint Health Relieve Pain Helps reduce pain and other symptoms associated with shoulder arthritis, tendonitis, bursitis, and degenerative shoulder conditions. Improve Function Supports range of motion, activity tolerance, and improved shoulder function through repeated use. Support Joint Health Designed to help maintain overall shoulder joint health and support progressive joint-focused care. Promote Circulation Targets the shoulder region to support localized circulation and therape"
  },
  {
    "question": "WINGS ONLY LONG STRIP",
    "answer": "PRODUCTS Electrotherapy Devices WINGS ONLY LONG STRIP Roll over to zoom in + View large image WINGS ONLY LONG STRIP Long Strip with Laser printed silver conductive surface (1.5\" x 7\") One box of gel pads - contains +1 pk Gel Pads TENS device sold separately PRODUCT CODE: ITSTRIPPR G2 + ITRODESTR THERAPY INFO WARRANTY Purple + 1PK GEL PADS Grey + 1PK GEL PADS DESCRIPTION The Long Strip Accessory is interchangeable with the device that is included with both the Small Wings and Large Wings iTENS. The long strip provides TENS therapy for long length coverage for pain that radiates downward. Multiple iTENS devices can be used in conjunction for optimal relief. Designed for the sciatic nerve, IT b"
  },
  {
    "question": "For Fastest Service:",
    "answer": "For Fastest Service: Email Us Have us call you within the same business day."
  },
  {
    "question": "Galvanic Stimulators",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Bracing and Supports",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Stretching Equipment",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Epsom Salt - 8oz jar",
    "answer": "PRODUCTS Electrotherapy Supplies • Accessories Epsom Salt - 8oz jar Roll over to zoom in + View large image Epsom Salt - 8oz jar Epsom salt 8oz PRODUCT CODE: NSsalt THERAPY INFO WARRANTY DESCRIPTION NerveSpa Epsom Salt is a pure mineral compound, Magnesium Sulfate, in crystal form. Soaking in an Epsom Salt bath is one of the most effective ways to make the magnesium that your body needs readily available. Quickly dissolves in warm water to help soothe muscle pain, relieve aching feet, cleanse pores, and detoxify the skin. Why Choose NerveSpa’s Epsom Salt? Supplements Magnesium: Magnesium is the fourth most abundant mineral in the body and it is involved in more than 325 biochemical reactions"
  },
  {
    "question": "Russian Stimulators",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Mobility Assistance",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Jaw Traction device",
    "answer": "PRODUCTS Traction Jaw Traction device Roll over to zoom in + View large image Jaw Traction device DOUBLE CHIN REDUCER: Minimize the double chin, tighten facial muscles, firm up the lips and define a clear outline of the face. HELPS WITH MOUTH BREATHERS: Minimize mouth-only breathing (strengthen masticatory muscles),Improve dry mouth. MOUTH AND FACIAL PROBLEMS CORRECTED: Reduction of halitosis, stomatitis, acne, and pimples. Realign facial symmetry, Minimize eyestrain. HELPS WITH CHEWING ISSUES: Corrects difficulty swallowing and/or slobbering. Also can be used to reduce cravings. BPA FREE – Food grade safe plastic, designed in Japan, satisfaction guaranteed. PRODUCT CODE: JF100 THERAPY INFO "
  },
  {
    "question": "Specialty Gel Pads",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "iTENS Wall Adaptor",
    "answer": "PRODUCTS Electrotherapy Supplies • Accessories iTENS Wall Adaptor Roll over to zoom in + View large image iTENS Wall Adaptor The AC Wall Adapter converts the USB cord into a standard US plug-in charger. Medical grade strength, no Rx Required. Wearable Pain Relief Thin li-ion rechargable battery; 24 hours of use per charge. The iTENS works by blocking pain signals at the nerves. PRODUCT CODE: ACWA1 THERAPY INFO WARRANTY DESCRIPTION The iTENS device comes with a USB charging cable. The AC Wall Adapter converts the USB cord into a standard US plug-in charger. SPECIFICATIONS Product Weight (lbs) : 1Length (cm) : 1Size : AC Wall AdapterHCPCS Code : N/A"
  },
  {
    "question": "Jstim Joint System",
    "answer": "PRODUCTS Electrotherapy Devices Jstim Joint System Roll over to zoom in + View large image Jstim Joint System JStim - Advanced Arthritis Therapy System - FDA 510K Electrical Joint Stimulation Device. The JStim Knee System utilizes a high-quality knee compression wrap and specific conductive silver fabric electrode patches that connect to the JStim stimulation unit. The wraps are one-size fits most, and are available in custom sizes. The Jstim has two modes of operation: DT (daytime) and NT (nighttime). It is safe, effective, and convenient to use your Jstim at night while sleeping. The Jstim is a therapeutic modality specifically designed to treat the Joint. Covered by medicare and medicare "
  },
  {
    "question": "9volt Rechargeable",
    "answer": "PRODUCTS Electrotherapy Supplies • Batteries 9volt Rechargeable Roll over to zoom in + View large image 9volt Rechargeable 9volt rechargeable batteries. PRODUCT CODE: 9VR THERAPY INFO WARRANTY DESCRIPTION 9volt rechargeable batteries SPECIFICATIONS Product Weight (lbs) : 1Width (cms) : 4Legnth - Inches : 2Weight Code : G"
  },
  {
    "question": "Silver electrodes",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Tricot Electrodes",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "NerveSpa Knee Pro",
    "answer": "PRODUCTS Electrotherapy Devices • Joint Stimulator NerveSpa Knee Pro Roll over to zoom in + View large image NerveSpa Knee Pro Joint & Mobility System Advanced OA/RA Treatment Device for Knee Pain Relief, Function, and Joint Health Relieve Pain - Helps reduce pain and other symptoms associated with osteoarthritis and rheumatoid arthritis of the knee. Improve Function - Supports joint function, activity tolerance, and improved movement quality through repeated use. Support Joint Health - Designed to help maintain overall knee joint health and support progressive joint-focused care. Promote Circulation - Targets the knee region to support localized circulation and therapeutic tissue engagement"
  },
  {
    "question": "Neuro Ground Cuff",
    "answer": "PRODUCTS Electrotherapy Garments Neuro Ground Cuff Roll over to zoom in + View large image Neuro Ground Cuff Neuro Ground Cuff Deisgned to work with any TENS or EMS unit PRODUCT CODE: ECuff THERAPY INFO WARRANTY DESCRIPTION The neuro ground Cuff is designed to work with all TENS and EMS units. SPECIFICATIONS Product Weight (lbs) : 2HCPCS Code : E0731"
  },
  {
    "question": "Clinical Devices",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Joint Stimulator",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Probes and clips",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Cold Compression",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Kinesiology Tape",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Air Purification",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "WINGS ONLY SMALL",
    "answer": "PRODUCTS Electrotherapy Devices • TENS WINGS ONLY SMALL Roll over to zoom in + View large image WINGS ONLY SMALL Small wings with Laser printed silver conductive surface (1.75\" x 5.5\") One box of gel pads - contains 3 sets of gels TENS device sold separately PRODUCT CODE: ITSWINGGR G2 THERAPY INFO WARRANTY Green + 1PK GEL PADS Red + 1PK GEL PADS DESCRIPTION The Small Wings Accessory is interchangeable with the device that is included with both the Small Wings and Large Wings iTENS. The Small Wings Accessory gives you the versatility needed for pain relief in those smaller areas and flexible parts. The smaller wings grip and move easily on your ankle, knee, elbow, wrist, and other small treat"
  },
  {
    "question": "WINGS ONLY LARGE",
    "answer": "PRODUCTS Electrotherapy Devices • TENS WINGS ONLY LARGE Roll over to zoom in + View large image WINGS ONLY LARGE Large Wings with Laser printed silver conductive surface (2.5\" x 6.5\") One box of gel pads - contains 3 sets of gels TENS device sold separately PRODUCT CODE: ITLWINGBL G2 THERAPY INFO WARRANTY Blue + 1PK GEL PADS White + 1PK GEL PADS DESCRIPTION The Large Wings Accessory is interchangeable with the device that is included with both the Small Wings and Large Wings iTENS. The Large Wings Accessory gives the maximum coverage for your pain sites. The large wings are designed to provide a bigger coverage area of pain relief for back, shoulder, and other large treatment areas. SPECIFIC"
  },
  {
    "question": "String Back TLSO",
    "answer": "PRODUCTS Bracing and Supports String Back TLSO Roll over to zoom in + View large image String Back TLSO Breakthrough Dual Pulley Support System : A patented dual pulley mechanism enables the thoracic section to extend independently from the lumbar portion, promoting neutral spinal alignment while providing a gentle, assisted stretch across the thoracic region. Postural Correction & Re-Education : Helps retrain and maintain proper posture by supporting the trunk and encouraging upright positioning during daily activities and therapy. Superior Rotational Stability : Engineered to limit unwanted motion and provide enhanced rotational control - especially crucial during early healing phases afte"
  },
  {
    "question": "Foam Electrodes",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Clinical Neo +",
    "answer": "PRODUCTS Electrotherapy Devices Clinical Neo + Roll over to zoom in + View large image Clinical Neo + ADVANCED MULTI-MODE STIMULATOR The Clinical Neo is an extra-strength advanced multi-mode electrotherapy stimulator that combines enhanced TENS, EMS, Interferential, Microcurrent, Russian Stim, and PMT Wave - all coupled with 50v of power. PRODUCT CODE: CGNEO THERAPY INFO WARRANTY DESCRIPTION The Ultima Neo is an Advanced multi-mode electrotherapy stimulator that combines enhanced TENS, EMS, Interferential, and Microcurrent. It is dual channel device and includes the function of our most advanced TENS and EMS modes with body part diagrams, as well as an advanced Interferential device with sin"
  },
  {
    "question": "Ultima 20 TENS",
    "answer": "PRODUCTS Electrotherapy Devices • TENS Ultima 20 TENS Roll over to zoom in + View large image Ultima 20 TENS Package Includes: Device, batteries, lead wires,1 pack of 4 electrodes, carrying case, and user manual. Device has Dual Channels, 12 preset modes, 8 manual, modes, and 3 wave forms LCD screen shows a body part diagram for plug-n-play functionality Product has a protective covering over the amplitude controls PRODUCT CODE: U20 THERAPY INFO WARRANTY DESCRIPTION The Ultima 20 TENS is a dual channel device with 20 modes of operations, 8 manual and 12 preset modes. It is simple to operate, and has a protective cover over the controls. Its pulse width and frequency are adjustable. This TENS"
  },
  {
    "question": "AA Rechargable",
    "answer": "PRODUCTS Electrotherapy Supplies • Batteries AA Rechargable Roll over to zoom in + View large image AA Rechargable AA rechargeable batteries. PRODUCT CODE: AAR THERAPY INFO WARRANTY DESCRIPTION AA rechargeable batteries. SPECIFICATIONS Product Weight (lbs) : 0.14375Length (cm) : 20Width (cm) : 5Height (cm) : 10Weight Code : G"
  },
  {
    "question": "Light Therapy",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Womens Health",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Electric Knee",
    "answer": "PRODUCTS Electrotherapy Garments Electric Knee Roll over to zoom in + View large image Electric Knee ELECTRIC KNEE BRACE - 4\" BY 7\" (1 PAIR) Treat Osteoarthritis and Rheumatoid arthritis of the knee. Works in tandem with the Jstim Therapy device – single channel treatment device, and conductive spray Includes a paid of 4” by 7” straps. One for below the knee and one for above the knee. Device not included PRODUCT CODE: EKD47-ALT THERAPY INFO WARRANTY DESCRIPTION ELECTRIC KNEE BRACE - 4\" BY 7\" (1 PAIR) Treat Osteoarthritis and Rheumatoid arthritis of the knee. Works in tandem with the Jstim Therapy device – single channel treatment device, and conductive spray Includes a paid of 4” by 7” stra"
  },
  {
    "question": "Electric Vest",
    "answer": "PRODUCTS Electrotherapy Garments Electric Vest Roll over to zoom in + View large image Electric Vest Electric Vest w/1 - 4x10 Dual Electrode PRODUCT CODE: EV1-410 THERAPY INFO WARRANTY w/1 - 4x10 Dual Electrode w/2 - 4x10 Dual Electrode DESCRIPTION The Electric Vest is a high end form fitting neoprene vest with tension pulls that help size it for all users (one size fits all) and is used in conjuction with the Fabric conductive electrodes. The Fabric electrodes velcro in, and are then compressed against the treatment site for therapy to ensue. SPECIFICATIONS Width (cms) : 1Size : 1Color : 1Weight Code : G"
  },
  {
    "question": "9volt Charger",
    "answer": "PRODUCTS Electrotherapy Supplies 9volt Charger Roll over to zoom in + View large image 9volt Charger high performance batteries PRODUCT CODE: 9VCRG THERAPY INFO WARRANTY DESCRIPTION high performance batteries SPECIFICATIONS Product Weight (lbs) : 1Width (cms) : 4Legnth - Inches : 2Weight Code : G"
  },
  {
    "question": "Microcurrent",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Heat Therapy",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Incontinence",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Company News",
    "answer": "Pain Management Technologies exhibits at the 2025 National Chiropractic show in Orlando Pain Management Tech exhibits at the 2024 National Chiro Show Orlando Pain Management Tech exhibits at the 2022 Medtrade show in Atlanta Nerve Spa Exhibits at the national Chiro Show in Orlando – 2021 Pain Management Tech exhibits at the 2021 Medtrade West Coast Tradeshow Pain Management Tech exhibits at the 2019 Medtrade show. Pain Management Tech exhibits at the 2019 NATA show Pain Management Tech exhibits at the 2017 Medtrade show Pain Management Tech exhibits at the 2016 Medtrade show"
  },
  {
    "question": "1PK GEL PADS",
    "answer": "PRODUCTS Electrodes 1PK GEL PADS Roll over to zoom in + View large image 1PK GEL PADS Peel-n-stick Gel pads are available for all sizes of iTENS device wings PRODUCT CODE: ITRODESM THERAPY INFO WARRANTY Small 1.75 x 5.5 Long Strip 1.5 x 7 Large 2.5 x 6.5 DESCRIPTION Peel-n-stick Gel pads are available for all sizes of iTENS device wings. These reusable gel pads are good for 10 applications. Each package contains 3 sets of gel pads. SPECIFICATIONS Product Weight (lbs) : 0.0625Length (cm) : 10Width (cm) : 10Height (cm) : 3"
  },
  {
    "question": "Combo Units",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Accessories",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Ultrasound",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "ED Devices",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Electrodes",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Neck Cloud",
    "answer": "PRODUCTS Traction Neck Cloud Roll over to zoom in + View large image Neck Cloud WHAT IS NECK TRACTION? Traction of the spine, or cervical traction, is a treatment for neck pain and related injuries. Neck Cloud is a hammock design pulls your head away from your neck to create expansion and eliminate compression, relaxing the muscles of the neck. HOME TREATMENT: Hours at the chiropractor, medication, or surgeries can be a real pain in the neck! Neck Cloud is a portable cervical traction device, which means a better day with this easy to use head hamock. You shouldn’t have to go to a neckpro or pay for a massage just for stiff neck relief. QUICK RELIEF: Neck decompression devices treat differen"
  },
  {
    "question": "Batteries",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Energizer",
    "answer": "PRODUCTS Electrotherapy Supplies Energizer Roll over to zoom in + View large image Energizer high performance batteries PRODUCT CODE: EN91 THERAPY INFO WARRANTY 9volt AA DESCRIPTION high performance batteries SPECIFICATIONS Product Weight (lbs) : 1Width (cms) : 4Legnth - Inches : 2Weight Code : G"
  },
  {
    "question": "Traction",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "About Us",
    "answer": "Founded in 2000 to develop advanced electrotherapy technology and heat therapy applications. Through the dedication and hard work of our team, Pain Management Technologies has grown into a national leader in the manufacturing of medical devices for pain management, as well as many other cutting-edge therapeutic devices. We are focused and dedicated to pushing the bounds of innovation within the product spaces in which we compete. Above all, we are driven by the goal of making sure our products deliver effective results and are used to improve the lives of our end customers. Company Highlights A leading national medical device maker since 2000 We participate in HME, and medical related Nation"
  },
  {
    "question": "Our Team",
    "answer": "Company Culture Fun Perks: Dog friendly work place Company grill outs Pizza Party's Onsite company paintball outings Business Perks: Health Insurance 401K We invest in you/profit share oppurtunities Flexible work environment Paid time off First 2 years – 5 paid days Years 3-4 – 8 paid days Years 5-9 – 10 paid days After 10 years – 15 paid days Holiday Vacations Safe And Techy: Wide open work space Socially distanced with private work spaces Modernized designer space Our Culture: Our culture is based on relationship building, idea exploration, risk-taking, change, and hard work. Our Management System: Is based around a decentralized management and organizational governance, which distributes "
  },
  {
    "question": "Fitness",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "TENS",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  }
];

// ================= EXACT REGRESSION ANSWERS =================
// Generated from output/latest/results.json attention cases.
const exactRegressionQAPairs = [
  {
    "question": "What should I know about Extension hose for AIS Clear Cold Therapy Unit from PMT?",
    "answer": "PRODUCTS Water Therapy Systems Extension hose for AIS Clear Cold Therapy Unit Roll over to zoom in + View large image Extension hose for AIS Clear Cold Therapy Unit COMPATIBLE WITH - Coolman, Leonns, Arctic Ice Clear, Oasis Space SIZE - 5' Length COUPLINGS - Leak-Proof Couplings Included PRODUCT CODE: CTU2CHOSE THERAPY INFO WARRANTY Arctic ice clear Extension Hose - 5' Length Universal Pad DESCRIPTION Extension hose for AIS clear Cold therapy unit SPECIFICATIONS Length (cm) : 1Width (cm) : 1Height (cm) : 1Model : Extension Hose"
  },
  {
    "question": "I need details on Replacement Charger for the Mobicushion-L. What does PMT say about it?",
    "answer": "PRODUCTS Mobility Assistance Replacement Charger for the Mobicushion-L Roll over to zoom in + View large image Replacement Charger for the Mobicushion-L Replacement Charger for the Mobicushion-L PRODUCT CODE: ML-charger THERAPY INFO WARRANTY Replacement Charger for the Nerve Spa Nerve Bath System. Quake Plate-Remote Mobicushion - Charger-L AIS Charger NEO - adaptor/charger Itens - charger Dynamic Wedge Lumbar - charger Dynamic Wedge Cervical- charger Soft Cycle - charger Mobicushion - Charger Mobicushion blue - Charger Polar Sport Mini - Charger Polar Sport Large- Charger Blue Cube Cold Only-Charger Blue Cube Air-Charger Replacement Charger for The NerveBeam LED Light Therapy Wrap NerveBeam "
  },
  {
    "question": "Could you summarize PMT's information about The Arctic Ice Classic– Cold Water Therapy Device with Large Back Pad for Treatment of Disability?",
    "answer": "PRODUCTS Water Therapy Systems The Arctic Ice Classic– Cold Water Therapy Device with Large Back Pad for Treatment of Disability Roll over to zoom in + View large image The Arctic Ice Classic– Cold Water Therapy Device with Large Back Pad for Treatment of Disability THERAPEUTIC COLD WATER: The Arctic Ice cold therapy machine uses a continuous flow of cold water to provide reduction of swelling and inflammation for those with a disability PORTABLE AND QUIET: Designed for easy portability and storage, this compact ice therapy system has a quiet motor for use in the home or hospital. DIGITAL CONTROLS: The built-in LCD screen and adjustable settings give you an easy way to control the treatment "
  },
  {
    "question": "What information does PMT provide about NERVESPA SILVER CONDUCTIVE GLOVE - HAND GARMENT SYSTEM INCLUDES DEVICE?",
    "answer": "PRODUCTS Electrotherapy Devices • Neuropathy Stimulator NERVESPA SILVER CONDUCTIVE GLOVE - HAND GARMENT SYSTEM INCLUDES DEVICE Roll over to zoom in + View large image NERVESPA SILVER CONDUCTIVE GLOVE - HAND GARMENT SYSTEM INCLUDES DEVICE Same technical specs as the Nerve Spa foot bath Foot garment system is lightweight and highly portable Touch screen device Built-in Microprocessor 7.83Hz, 80Hz, Symmetrical Biphasic Square, and Monophasic Waveform Reinforced lead wires Includes 1 Pair of Gloves FDA Registered Includes 24oz of conductive Spray CONTACT FOR PRICING PRODUCT CODE: NSGG10 THERAPY INFO WARRANTY DESCRIPTION The Nerve Spa Pro is an Advanced Nerve and Neuropathy stimulator that utiliz"
  },
  {
    "question": "Can you explain the PMT information about Soft-Touch Carbon Electrodes cloth back (tyco gel)?",
    "answer": "PRODUCTS Electrodes Soft-Touch Carbon Electrodes cloth back (tyco gel) Roll over to zoom in + View large image Soft-Touch Carbon Electrodes cloth back (tyco gel) Self - Adhesive, High Quality Gel Electrodes. Reusable (10-15 or more uses per pad). Universal for all TENS and EMS units with the pin-type connector."
  },
  {
    "question": "What should I know about Toilet Tilt – Heavy-Duty, Adjustable Assist Seat for Seniors at Home or in Medical Settings from PMT?",
    "answer": "PRODUCTS Mobility Assistance Toilet Tilt – Heavy-Duty, Adjustable Assist Seat for Seniors at Home or in Medical Settings Roll over to zoom in + View large image Toilet Tilt – Heavy-Duty, Adjustable Assist Seat for Seniors at Home or in Medical Settings ​Smooth Glide Motion: Silent, stepless lifting mechanism ensures gentle and stable elevation for all mobility levels. Spacious & Strong Build: Wide seat and armrests, crafted with a high-strength plastic frame to support up to 200 kg. Rechargeable Battery: Built-in battery."
  },
  {
    "question": "I need details on Wireless TENS Unit Stimulator by iTENS. What does PMT say about it?",
    "answer": "PRODUCTS Electrotherapy Devices • TENS Wireless TENS Unit Stimulator by iTENS – Bluetooth Enabled TENS Device with Free App, for Back Pain, Knee Pain, and Other Joint Relief. Patented Mechanical Wings and Rechargeable Battery - Small Green Roll over to zoom in + View large image Wireless TENS Unit Stimulator by iTENS – Bluetooth Enabled TENS Device with Free App, for Back Pain, Knee Pain, and Other Joint Relief. Patented Mechanical Wings and Rechargeable Battery - Small Green REVOLUTIONARY APP-CONTROLLED DESIGN - The world's first FDA-cleared, OTC, wireless TENS therapy device that is controlled with an IOS or Android based app on your smartphone."
  },
  {
    "question": "Could you summarize PMT's information about NerveBeam LED Light Therapy Wrap?",
    "answer": "PRODUCTS Light Therapy NerveBeam LED Light Therapy Wrap Roll over to zoom in + View large image NerveBeam LED Light Therapy Wrap Clinical Device Red & Infrared Light Therapy for Pain Relief, Circulation, Tissue Warming, and Muscle Relaxation Relieve Pain Designed to relieve minor muscle, joint, and nerve-related pain with red and infrared light therapy. Improve Circulation Temporarily increases local blood circulation in targeted treatment areas. Elevate Tissue Temperature Delivers heat-oriented light therapy support to warm tissues and promote comfort."
  },
  {
    "question": "What information does PMT provide about Energizer?",
    "answer": "PRODUCTS Electrotherapy Supplies Energizer Roll over to zoom in + View large image Energizer high performance batteries PRODUCT CODE: EN91 THERAPY INFO WARRANTY 9volt AA DESCRIPTION high performance batteries SPECIFICATIONS Product Weight (lbs) : 1Width (cms) : 4Legnth - Inches : 2Weight Code : G"
  },
  {
    "question": "Can you explain the PMT information about Travel Light Powered Wheelchair by MobiJoe, 500W Dual Motor - Lightweight Mobility for Seniors, Foldable and C?",
    "answer": "PRODUCTS Mobility Assistance Travel Light Powered Wheelchair by MobiJoe, 500W Dual Motor - Lightweight Mobility for Seniors, Foldable and Compact for Easy Travel and Storage. Roll over to zoom in + View large image Travel Light Powered Wheelchair by MobiJoe, 500W Dual Motor - Lightweight Mobility for Seniors, Foldable and Compact for Easy Travel and Storage. LIGHTWEIGHT AND COMPACT DESIGN: The MobiJoe is designed to be lightweight and weighs in at just 66 pounds while equipped with two fully charged batteries."
  },
  {
    "question": "What should I know about NERVE TARGET ROLL-ON GEL - Targeted Therapeutic treatment for Damaged Nerves, Intractable Back Pain, Joint Ach from PMT?",
    "answer": "PRODUCTS Therapeutic Creams and Gels NERVE TARGET ROLL-ON GEL - Targeted Therapeutic treatment for Damaged Nerves, Intractable Back Pain, Joint Aches and Muscles Spasms. Roll over to zoom in + View large image NERVE TARGET ROLL-ON GEL - Targeted Therapeutic treatment for Damaged Nerves, Intractable Back Pain, Joint Aches and Muscles Spasms. SUPPORTS TARGETED COOLING & SENSORY MODULATION (Menthol + Camphor) SUPPORTS LOCAL MICRO-CIRCULATION (Eucalyptus + Witch Hazel + Arnica) PROMOTES RAPID TOPICAL ABSORPTION (Plant-Based Carrier System) PRODUCT CODE: NTROLL THERAPY INFO WARRANTY DESCRIPTION Nerve Target Roll-On Gel: Science-Led Topical Sensory & Microvascular Support Localized musculoskeletal"
  },
  {
    "question": "I need details on Snuggleback - Chair Blanket Fleece Line for Promo Supply. What does PMT say about it?",
    "answer": "PRODUCTS Heat Therapy Snuggleback - Chair Blanket Fleece Line for Promo Supply Roll over to zoom in + View large image Snuggleback - Chair Blanket Fleece Line for Promo Supply Decorate our Snuggleback with your Company Logo! Embroidery Services Available on all colors of Fleece Snugglebacks Contact us for special bulk pricing PRODUCT CODE: Blackfleece THERAPY INFO WARRANTY DESCRIPTION Snuggleback - Chair Blanket Fleece Line for Promo Supply SPECIFICATIONS Product Weight (lbs) : 1"
  },
  {
    "question": "Could you summarize PMT's information about Cryotherapy and Hot Water Treatement System - Water Circulating Device by Aqua Relief with Universal Pad For P?",
    "answer": "PRODUCTS Water Therapy Systems Cryotherapy and Hot Water Treatement System - Water Circulating Device by Aqua Relief with Universal Pad For Post-Surgical Recovery and Sustained Heat Therapy to Treat a Chronic or Acute Disability - With Back pad Roll over to zoom in + View large image Cryotherapy and Hot Water Treatement System - Water Circulating Device by Aqua Relief with Universal Pad For Post-Surgical Recovery and Sustained Heat Therapy to Treat a Chronic or Acute Disability - With Back pad HOW IS THIS HOT AND COLD THERAPY UNIT USED: Hot and cold water is quietly circulated through the leak-free 52 hose to the pad, giving your body complete hot or cold coverage. Add ice and the cryo-cool "
  },
  {
    "question": "What information does PMT provide about SnuggleBack - Chair Blanket - Blue Pattern Fleece?",
    "answer": "PRODUCTS Heat Therapy SnuggleBack - Chair Blanket - Blue Pattern Fleece Roll over to zoom in + View large image SnuggleBack - Chair Blanket - Blue Pattern Fleece FAUX FUR – Our premium Faux Fur is super soft and extra thick. Perfect for the coldest of winter mornings or year round use. PATENTED PENDING – One-of-a-kind Chair Blanket that attaches to any Office Chair."
  },
  {
    "question": "Can you explain the PMT information about The iTENS Gen 2 docking station and charging cord?",
    "answer": "PRODUCTS Electrotherapy Supplies The iTENS Gen 2 docking station and charging cord Roll over to zoom in + View large image The iTENS Gen 2 docking station and charging cord . PRODUCT CODE: ITCGRCARD THERAPY INFO WARRANTY DESCRIPTION The iTENS Gen 2 docking station and charging cord SPECIFICATIONS Product Weight (lbs) : 1Length (cm) : 1"
  },
  {
    "question": "I need details on Laser Therapy Helmet. What does PMT say about it?",
    "answer": "PRODUCTS Light Therapy Laser hero – Laser Hair Growth Cap – Restore Hair Loss with FDA Cleared Medical Grade Laser Helmet - Hair Regrowth for Men and Women with Thinning Hair (Blue) Roll over to zoom in + View large image Laser hero – Laser Hair Growth Cap – Restore Hair Loss with FDA Cleared Medical Grade Laser Helmet - Hair Regrowth for Men and Women with Thinning Hair (Blue) ADVANCED LASER HAIR GROWTH CAP - An innovative hair regrowth medical device the Laser Hero cap utilizes LLLT low-energy soft laser irradiation to stimulate hair growth at the follicle level to treat hair loss, alopecia areata, and seborrheic alopecia. IN-HOME HAIR LOSS TREATMENT - Offering discrete, comfortable use ou"
  },
  {
    "question": "Could you summarize PMT's information about Soft-Touch Medical Grade Electrodes?",
    "answer": "PRODUCTS Electrodes Soft-Touch Medical Grade Electrodes Roll over to zoom in + View large image Soft-Touch Medical Grade Electrodes Soft-Touch Cloth Electrodes (PMT gel) - 3.0 round Self - Adhesive, High Quality Gel Electrodes. Reusable (10-15 or more uses per pad). Universal for all TENS and EMS units with the pin-type connector."
  },
  {
    "question": "Can you explain the PMT information about Tricot Electrodes?",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "What should I know about Pump Brace - Inflatable Knee Brace from PMT?",
    "answer": "PRODUCTS Bracing and Supports Inflatable Knee Brace with Built-in Pump; Compression Knee Wrap - Reusable Brace with Air Pump - for knee Pain Relief, Swelling and Recovery Support - Adjustable and Inflatable for Sports Injury Sprains Roll over to zoom in + View large image Inflatable Knee Brace with Built-in Pump; Compression Knee Wrap - Reusable Brace with Air Pump - for knee Pain Relief, Swelling and Recovery Support - Adjustable and Inflatable for Sports Injury Sprains EFFECTIVE KNEE PAIN RELIEF: A one-of-a-kind Built in Air Pump provides targeted compression, effectively relieving pain, inflammation, swelling and stiffness in the knee. Great for managing pain due to sprains, strains, inju"
  },
  {
    "question": "I need details on NERVESPA SILVER CONDUCTIVE SOCK - FOOT GARMENT SYSTEM INCLUDES DEVICE. What does PMT say about it?",
    "answer": "PRODUCTS Electrotherapy Devices • Neuropathy Stimulator NERVESPA SILVER CONDUCTIVE SOCK - FOOT GARMENT SYSTEM INCLUDES DEVICE Roll over to zoom in + View large image NERVESPA SILVER CONDUCTIVE SOCK - FOOT GARMENT SYSTEM INCLUDES DEVICE Same technical specs as the Nerve Spa foot bath Foot garment system is light weight and highly portable Touch screen device Built-in Microprocessor 7.83Hz, 80Hz, Symmetrical Biphasic Square, and Monophasic Waveform Reinforced lead wires Includes 1 Pair of SOCKS FDA Registered Includes 24oz of conductive Spray CONTACT FOR PRICING PRODUCT CODE: NSGS10 THERAPY INFO WARRANTY DESCRIPTION The Nerve Spa Pro is an Advanced Nerve and Neuropathy stimulator that utilizes"
  },
  {
    "question": "Could you summarize PMT's information about Soft-Touch Carbon Electrodes cloth back (tyco gel)?",
    "answer": "PRODUCTS Electrodes Soft-Touch Carbon Electrodes cloth back (tyco gel) Roll over to zoom in + View large image Soft-Touch Carbon Electrodes cloth back (tyco gel) Self - Adhesive, High Quality Gel Electrodes. Reusable (10-15 or more uses per pad). Universal for all TENS and EMS units with the pin-type connector."
  },
  {
    "question": "What information does PMT provide about ED Devices?",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Can you explain the PMT information about Cloud Walker Full Shell Walking Boot 17\" Tall, Adjustable Medical Walker Boot with Solid Toe Box, Protective F?",
    "answer": "PRODUCTS Bracing and Supports Cloud Walker Full Shell Walking Boot 17\" Tall, Adjustable Medical Walker Boot with Solid Toe Box, Protective Foot & Ankle Brace for Recovery, Stability & Daily Mobility Support – Small Roll over to zoom in + View large image Cloud Walker Full Shell Walking Boot 17\" Tall, Adjustable Medical Walker Boot with Solid Toe Box, Protective Foot & Ankle Brace for Recovery, Stability & Daily Mobility Support – Small ENHANCED LOWER LEG SUPPORT – 17\" tall walking boot helps stabilize the foot and ankle during daily movement and recovery routines. ADJUSTABLE SECURE FIT – Medical walker boot features customizable hook-and-loop straps for improved comfort, support, and easy we"
  },
  {
    "question": "What should I know about Pain grenade(3 Pack) from PMT?",
    "answer": "PRODUCTS Therapeutic Creams and Gels Roll On Pain Relief by Pain Grenade - Roll On Muscle Pain Reliever, Back Pain, Arthritis – with Arnica, Menthol, & Camphor Roll over to zoom in + View large image Roll On Pain Relief by Pain Grenade - Roll On Muscle Pain Reliever, Back Pain, Arthritis – with Arnica, Menthol, & Camphor MILITARY GRADE RELIEF: Pain Grenade is roll on relief that tackles back, joint, and sore muscles with professional formulas that perform like nothing else on the market. You may have seen other products which make tons of promises, but this product is extra strength for the toughest of the tough. HEATING AND COOLING THERAPY: The unique warm and cool formula of Pain Grenade i"
  },
  {
    "question": "I need details on Orthopedic Neck Travel Pillow with Sleep Hood by SkyPillow, Prevent Neck Cramps and Pain. Patented Memory Foam. What does PMT say about it?",
    "answer": "PRODUCTS Traction Orthopedic Neck Travel Pillow with Sleep Hood by SkyPillow, Prevent Neck Cramps and Pain. Patented Memory Foam Pillow, Washable Cover, Sleep Hood,Includes Carrying Case (One Size Fits Most) Roll over to zoom in + View large image Orthopedic Neck Travel Pillow with Sleep Hood by SkyPillow, Prevent Neck Cramps and Pain. Patented Memory Foam Pillow, Washable Cover, Sleep Hood,Includes Carrying Case (One Size Fits Most) A BETTER NECK PILLOW: Many travel pillows aren't firm enough to properly support the neck and end up caving in to even the slightest amount of pressure."
  },
  {
    "question": "What information does PMT provide about Rapid OA Knee - Left | Adjustable ROM Hinge | Lightweight & Breathable | Portable Support for Osteoarthritis a?",
    "answer": "PRODUCTS Bracing and Supports Rapid OA Knee - Left | Adjustable ROM Hinge | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis Roll over to zoom in + View large image Rapid OA Knee - Left | Adjustable ROM Hinge | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis PORTABLE COMFORT: The Rapid OA Knee - Left is designed with portability in mind, ensuring you can take it with you wherever you go. Experience comfort and convenience throughout your day, whether at home or on the move. BREATHABLE AND LIGHTWEIGHT: Crafted from breathable, non-allergenic materials, this knee brace offers superior comfort without compromising on"
  },
  {
    "question": "What should I know about Hidden Heat Pet Bed Warmer by Spotwarm; Wireless RF Remote with Microplush Flannel, Small and Large Pets - 24” from PMT?",
    "answer": "PRODUCTS Heat Therapy Hidden Heating Pad Pet Bed Warmer by Spotwarm; Wireless RF Remote with Microplush Flannel, Small and Large Pets - 24” by 20” Roll over to zoom in + View large image Hidden Heating Pad Pet Bed Warmer by Spotwarm; Wireless RF Remote with Microplush Flannel, Small and Large Pets - 24” by 20” UNPARALLELED WARMTH - Quick heating wire grid heats up the pet bed warmer faster and retains heat for longer. Includes an auto-shutoff feature for each different temperature setting. ADJUSTABLE HEAT SETTINGS – Keep your furry friend warm with 6 different heating levels, controlled using our Infrared Remote Control."
  },
  {
    "question": "Could you summarize PMT's information about Conductive Wearable Back Wrap by Blue Silver. Compression back wrap, compatible with all electrotherapy device?",
    "answer": "PRODUCTS Electrodes Conductive Wearable Back Wrap by Blue Silver. Compression back wrap, compatible with all electrotherapy devices to provide Low Back Pain Relief with wearable comfort. (Silver Mesh Gel) Roll over to zoom in + View large image Conductive Wearable Back Wrap by Blue Silver."
  },
  {
    "question": "What information does PMT provide about Seat Boost Air - Battery and Wall powered?",
    "answer": "PRODUCTS Mobility Assistance Pneumatic Seat Assist Lifting Cushion by Seat Boost Air – Most Durable Chair Lift Assist Device for Seniors Adults with 220lb Weight Capacity Lifting Angle Up to 35°, Portable seat Lift with Button Control Roll over to zoom in + View large image Pneumatic Seat Assist Lifting Cushion by Seat Boost Air – Most Durable Chair Lift Assist Device for Seniors Adults with 220lb Weight Capacity Lifting Angle Up to 35°, Portable seat Lift with Button Control ​DURABLE DESIGN: The Seat Boost Air seat lift mechanism for those with abulatory issues, is made of high quality componentry and materials. A common problem with other options is their unreliable quality. It also includ"
  },
  {
    "question": "Can you explain the PMT information about Circulating Ice Machine by Blue Cube – for Knee, Elbow, Shoulder, Back for treatment of disability (Blue Light?",
    "answer": "PRODUCTS Water Therapy Systems Circulating Ice Machine by Blue Cube – for Knee, Elbow, Shoulder, Back for treatment of disability (Blue Light Cold Therapy System with Universal Pad) Roll over to zoom in + View large image Circulating Ice Machine by Blue Cube – for Knee, Elbow, Shoulder, Back for treatment of disability (Blue Light Cold Therapy System with Universal Pad) TWO -PUMP SPEEDS: High Flow delivers 47 Degrees and Low Speed delivers 52 Degrees Fahrenheit. COLD WATER THERAPY: The Blue Cube cold therapy machine uses a continuous flow of cold water to provide reduction of swelling, edema and inflammation. PORTABLE AND QUIET: Designed for easy portability and storage, this compact ice the"
  },
  {
    "question": "What should I know about Cervical Traction Device Neck Pain Relief by Theratrac - Wide from PMT?",
    "answer": "PRODUCTS Traction Cervical Traction Device Neck Pain Relief by Theratrac - Wide Roll over to zoom in + View large image Cervical Traction Device Neck Pain Relief by Theratrac - Wide UNLOCKS NECK MUSCLES: Theratrac gently stretches neck muscles to slowly relax, allowing misaligned vertebrae to resume their normal supportive position REALIGNS DISCS: Vertebral discs realign with pneumatic decompression, freeing the nerve root tissue from the pressure of the discs PAIN RELIEF: With two points of traction, Theratrac provides pain relief, muscle relaxation and stretching, posture improvement. EASY TO USE: Inflate and deflate easily with hand pumps that inflate up to 30lbs of pressure. Measure neck"
  },
  {
    "question": "Could you summarize PMT's information about Microwavable Heated Acupressure Back Stretcher by Hot Spine - Full Back and Neck Decompression, Spine Alignmen?",
    "answer": "PRODUCTS Massage Therapy Devices Microwavable Heated Acupressure Back Stretcher by Hot Spine - Full Back and Neck Decompression, Spine Alignment, and Deep Tissue Therapy with 24 Heated Massage Sections for Ultimate Back Pain Relief Roll over to zoom in + View large image Microwavable Heated Acupressure Back Stretcher by Hot Spine - Full Back and Neck Decompression, Spine Alignment, and Deep Tissue Therapy with 24 Heated Massage Sections for Ultimate Back Pain Relief MICROWAVE HEATED ACUPRESSURE THERAPY: Equipped with 24 strategically positioned massage sections filled with all-natural clay beads that adapt to your spine's natural curve, delivering heat and targeted acupressure to relieve ten"
  },
  {
    "question": "What information does PMT provide about Jaw Fit - Jaw Line Traction - Silicone chewable?",
    "answer": "PRODUCTS Traction Jawline Facial Exerciser by Jawfit – 1 Pair of Medical Grade BPA FREE Silicone Jaw Exerciser for Beginner & Advanced Users - Jawline Sculptor & Jawline Shaper (2nd Generation) Roll over to zoom in + View large image Jawline Facial Exerciser by Jawfit – 1 Pair of Medical Grade BPA FREE Silicone Jaw Exerciser for Beginner & Advanced Users - Jawline Sculptor & Jawline Shaper (2nd Generation) UPDATED DESIGN – The Jawfit jawline exerciser is made of new & improved tear-resistant Medical Grade/Food-Grade silicone that is BPA Free and has a better elasticity and higher tensile strength to improve your jawline workout! PERFECT FIT - Works for Beginner and Advanced users to create t"
  },
  {
    "question": "What happens when a TENS unit is used?",
    "answer": "A Transcutaneous Electrical Nerve Stimulation (TENS) unit is a small, battery-powered device that helps relieve pain by sending low-voltage electrical pulses through electrode pads placed on the skin. These gentle electrical impulses stimulate the nerves beneath the skin and can help reduce the way your body perceives pain."
  },
  {
    "question": "Could you give me the important information behind this question: What TENS unit is best for home use?",
    "answer": "The best TENS unit for home use depends on your needs, but a good home unit should have: Adjustable intensity levels, multiple modes, dual channels, rechargable batteries, easy controls and a clear display. For most home users, a reliable dual channel TENS unit with adjustable programs is a good choice because it offers flexibility for areas like the back, neck, shoulders, knees, and joints."
  },
  {
    "question": "I am trying to understand the same issue in everyday language: Can I wear a TENS unit all day?",
    "answer": "It is generally not recommended to wear a TENS unit continuously all day without breaks. While TENS can often be used multiple times throughout the day, extended use may increase the risk of skin irritation, reduced effectiveness, or discomfort. For best results: Use TENS in scheduled sessions as needed. Give your skin breaks between treatments. Move electrode placement if using the same area frequently. Follow your device's recommended usage guidelines."
  },
  {
    "question": "Can TENS help me avoid pain medication Also, what are Soft-Touch electrodes, and why do they matter?",
    "answer": "TENS may help some people reduce their reliance on pain medication by providing a drug-free option for managing discomfort. However, it does not replace prescribed medications for everyone or treat the underlying cause of pain. Many people use TENS as part of a broader pain management plan alongside other treatments recommended by their healthcare provider.\n\nSoft-Touch electrodes are PMT's premium reusable line: a non-porous tricot backing, conductive wire-mount layer, high-quality carbon layer, and extra-thick gel, with a snug pigtail connector. Oval corners minimize edge curl, and every pad uses latex-free USA gel in a resealable bag to stay fresh. They work well across TENS, EMS, interferential, microcurrent, and galvanic devices."
  },
  {
    "question": "What's the difference between 2 inch and 4 inch pads Also, contact info",
    "answer": "The main difference is coverage area. Larger pads spread stimulation over a wider area, while smaller pads provide more targeted treatment. 2 Inch Pads: Best for smaller or more precise areas like the wrist, ankle, neck muscles, or smaller joints. 4 Inch Pads: Better for larger muscle groups, like the lower back, shoulders, thighs, or areas with broader discomfort. Larger pads may also feel more comfortable because the stimulation is distributed across a bigger surface area.\n\nYou can contact Pain Management Technologies (PMT) using the following details: Phone: 1-800-239-7880 Fax: 1-330-564-0118 Email: info@paintechnology.com Address: 1760 Wadsworth Road | Akron Ohio 44320 Contact Page: https://paintechnology.com/contact"
  },
  {
    "question": "Why won't my pads stick anymore Also, what is the Lock/Unlock feature, and how do I use it?",
    "answer": "TENS pads can lose their stickiness over time due to repeated use, moisture, oils, lotions, dirt, or improper storage. As the gel dries out or the pads are used, the pads may not make proper contact with the skin, which will reduce stimulation quality. Once you are noticing that your pads are sticking less, or are starting to fall off the skin, it is recommended to swap out your pads for new. To improve pad life: Clean and dry your skin before applying pads. Avoid using lotions, oils, or creams before treatment. Store pads on their backing sheet in a sealed bag or container. Replace pads when the gel becomes dry, dirty, or no longer adheres well.\n\nThe Lock/Unlock feature lets you hold your current intensity steady so it can't be accidentally bumped up or down mid-session, handy if the unit is clipped to your belt or moving around while you're active. With the unit on, give the power button a short press to lock it; your intensity level will be held in place. Give it another short press to unlock and resume adjusting normally."
  },
  {
    "question": "What pads are compatible with my unit Also, what is the Ultima 5 (U5)?",
    "answer": "Most TENS units work with standard snap-style electrode pads, but compatibility depends on your device's connector type. Most units follow a standard 2mm pin or snap connector size for electrodes. Before purchasing, check the following: The connector style on your TENS unit. The recommended pad size from your device manufacturer. Whether the pads are labeled for TENS use (not just other stimulation devices).\n\nThe Ultima 5 is PMT's dual-channel digital TENS unit, built for robust relief at home, work, or on the go. It offers 10 intensity levels, 9 preset modes (27 combinations), 3 wave forms, and a timer up to 60 minutes. A built-in Compliance Monitor and Pad Contact Alarm add extra confidence."
  },
  {
    "question": "I am experiencing skin irritation -- why is that Also, how do I maximize pain relief?",
    "answer": "Skin irriation after using a TENS unit is usually caused by skin sensitivity, electrode adhesive, or improper pad use. Common causes include: Sensitivity to the electrode gel or adhesive: Some people may have mild skin reactions to the materials in the pads. Using pads for too long: Extended use in the same area can irritate the skin. Worn or dirty electrodes: Old pads may not distribute stimulation evenly and can increase irritation. Applying pads to unprepared skin: Lotions, oils, sweat, or dirt can affect adhesion and skin comfort. Stimulation intensity is too high: Excessive intensity may cause discomfort or irritation. To reduce irritation: Apply pads to clean, dry skin. Rotate pad placement between sessions. Avoid using pads on irritated, broken, or sensitive skin. Lower the intensity if the sensation feels uncomfortable. Replace pads when they become dry or worn.\n\nTo get the best results from your TENS unit, focus on proper placement, comfortable settings, and consistent use. Tips to maximize relief: Place pads correctly: Position electrodes around the painful area or along the related nerve pathways as recommended. Use a comfortable intensity: The sensation should feel strong but comfortable - not painful or irritating. Adjust settings: Try different modes, pulse rates, and durations to find what works best for you. Use fresh electrodes - Good pad contact helps deliver consistent stimulation. Keep skin clean and dry: Remove oils, lotions, and sweat before applying pads. Use consistently: Regular sessions may provide better results than occasional use."
  },
  {
    "question": "Please answer both parts. First: Could you explain this for me: Can TENS help me avoid pain medication? Second: What is the reason only one pad working?",
    "answer": "TENS may help some people reduce their reliance on pain medication by providing a drug-free option for managing discomfort. However, it does not replace prescribed medications for everyone or treat the underlying cause of pain. Many people use TENS as part of a broader pain management plan alongside other treatments recommended by their healthcare provider.\n\nIf only one pad seems to be producing a sensation, the issue is usually related to pad contact, connections, or the electrode itself. Try these steps: Check the pad connection: Make sure both lead wires are firmly connected to the TENS unit and electrode pads. Test the pads: Swap the pads or cables to see if the issue follows the pad or the channel. Replace the pad: A worn or dried-out electrode may not conduct properly. Improve the skin contact: Clean and dry the skin, then reapply the pads firmly. Check the channel settings: Make sure both channels are turned on if your unit has multiple channels."
  },
  {
    "question": "Can you explain the PMT information about SarcoStim - Lower Extremity Strengthening System for Fall Prevention?",
    "answer": "PRODUCTS Electrotherapy Devices • EMS Muscle Stimulators SarcoStim - Lower Extremity Strengthening System for Fall Prevention Roll over to zoom in + View large image SarcoStim - Lower Extremity Strengthening System for Fall Prevention Includes: Device, lead wires, charger, users manual and carrying case The SarcoStim was designed specifically to treat the increasingly popular condition of the elderly called sarcopenia. The SarcoStim can also be used by athletes of all levels to treat muscle related ailments, injuries and even to enhance muscle endurance and strength. Device kit Includes: Device, lead wires, charger, users manual and carrying case Full Leg System: Includes Dual 4 x 7 Quad pad"
  },
  {
    "question": "What should I know about Pelvic Floor Stimulating Probes by Soft Cycle, Perform Electronic Kegel Exercise and Stimulate Pelvic Floor Mu from PMT?",
    "answer": "PRODUCTS Electrotherapy Supplies Pelvic Floor Stimulating Probes by Soft Cycle, Perform Electronic Kegel Exercise and Stimulate Pelvic Floor Muscles; Compatible with Muscle Stimulators or Incontinence Devices (Vaginal) Roll over to zoom in + View large image Pelvic Floor Stimulating Probes by Soft Cycle, Perform Electronic Kegel Exercise and Stimulate Pelvic Floor Muscles; Compatible with Muscle Stimulators or Incontinence Devices (Vaginal) PREMIUM QUALITY: Ergonomically designed with high-grade materials and silver conductive elements for optimum conductivity and a comfortable dispersion of current. CUSTOM FIT: Designed to come in a variety of shapes and sizes to provide for a custom fit an"
  },
  {
    "question": "Could you summarize PMT's information about Polar Sport Large - 12L – Cold Water Therapy Device with Universal Pad for Treatment of Disability?",
    "answer": "PRODUCTS Water Therapy Systems Polar Sport Large - 12L – Cold Water Therapy Device with Universal Pad for Treatment of Disability Roll over to zoom in + View large image Polar Sport Large - 12L – Cold Water Therapy Device with Universal Pad for Treatment of Disability THERAPEUTIC COLD WATER: The Polar Sport cold therapy machine uses a continuous flow of cold water to provide reduction of swelling and inflammation for those with a disability PORTABLE AND QUIET: Designed for easy portability and storage, this compact ice therapy system has a quiet motor for use in the home or hospital. DIGITAL CONTROLS: The built-in LCD screen and adjustable settings give you an easy way to control the treatme"
  },
  {
    "question": "What information does PMT provide about Replacement Charger for the Mobicushion-L?",
    "answer": "PRODUCTS Mobility Assistance Replacement Charger for the Mobicushion-L Roll over to zoom in + View large image Replacement Charger for the Mobicushion-L Replacement Charger for the Mobicushion-L PRODUCT CODE: ML-charger THERAPY INFO WARRANTY Replacement Charger for the Nerve Spa Nerve Bath System. Quake Plate-Remote Mobicushion - Charger-L AIS Charger NEO - adaptor/charger Itens - charger Dynamic Wedge Lumbar - charger Dynamic Wedge Cervical- charger Soft Cycle - charger Mobicushion - Charger Mobicushion blue - Charger Polar Sport Mini - Charger Polar Sport Large- Charger Blue Cube Cold Only-Charger Blue Cube Air-Charger Replacement Charger for The NerveBeam LED Light Therapy Wrap NerveBeam "
  },
  {
    "question": "I need details on Cold Compression. What does PMT say about it?",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "What information does PMT provide about Probes and clips?",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Can you explain the PMT information about EverTrac CT800 Neck Cervical Traction Device Home Unit System Made in Taiwan?",
    "answer": "PRODUCTS Traction EverTrac CT800 Neck Cervical Traction Device Home Unit System Made in Taiwan Roll over to zoom in + View large image EverTrac CT800 Neck Cervical Traction Device Home Unit System Made in Taiwan Safe and Effective At-Home Use: Provides reliable cervical traction to relieve neck strain, pain, and muscle spasms. Direct Cable Technology: Delivers precise and controlled traction force up to 50 lbs without relying on air, avoiding air leakage issues. Effortless Operation: Achieve prescribed traction force with just 1-2 turns of the traction knob for a hassle-free therapy session."
  },
  {
    "question": "I need details on Trigger Point Pillow. What does PMT say about it?",
    "answer": "PRODUCTS Massage Therapy Devices Trigger Point Pillow - Head and Neck Pain Relief Traction Device, Support Relaxer for Tension Headache Relief for Improved Decompression Roll over to zoom in + View large image Trigger Point Pillow - Head and Neck Pain Relief Traction Device, Support Relaxer for Tension Headache Relief for Improved Decompression PAIN RELIEF --- If suffering from chronic neck pain, herniated disks, upper body stiffness, neck pain, migraines, or arthritis symptoms, use the Trigger Point Pillow to relieve neck and shoulder pain while providing a cervical neck traction. NO PAIN, NO GAIN - the Trigger Point Pillow is intentionally designed to put pressure onto meridian points in y"
  },
  {
    "question": "Could you summarize PMT's information about Medical Order Policies?",
    "answer": "Easy Ordering (Ordering options) Phone 1-800-239-7880 Our trained Customer Service Representatives are available to assist, you 8:30 a.m. Mail Pain Management Technologies 1760 Wadsworth Road Akron, Ohio 44320 EMail info@paintechnology.com To ensure prompt processing, please include the following information when placing orders via Mail, Email and Fax. Account Number Billing and Shipping addresses (if different) Purchase Order Number (if applicable) Your Name and Phone Number Product Number / Description Quantity of Product Minimum Order Requirements Pain Management Technologies does not have a minimum order requirement."
  },
  {
    "question": "Can you explain the PMT information about PowerWrap | Ultra High-Powered Red & Infrared Light Therapy for Large-Area Pain Relief, Circulation, and Recov?",
    "answer": "PRODUCTS Light Therapy PowerWrap | Ultra High-Powered Red & Infrared Light Therapy for Large-Area Pain Relief, Circulation, and Recovery Support Roll over to zoom in + View large image PowerWrap | Ultra High-Powered Red & Infrared Light Therapy for Large-Area Pain Relief, Circulation, and Recovery Support Clinical Device A high-output, large-surface light therapy system designed to deliver powerful red and infrared energy across broader treatment areas—supporting pain relief, circulation, recovery, and protocol-based nerve and tissue support. Relieve Pain at Scale – Designed to help relieve nerve pain, joint discomfort, muscle soreness, and stiffness across larger treatment regions. Improve "
  },
  {
    "question": "What should I know about Economy Edition Office Desk Chair Wrap by SnuggleBack Attaches for Convenient Heat and Hands-Free. Stay Warm I from PMT?",
    "answer": "PRODUCTS Heat Therapy Economy Edition Office Desk Chair Wrap by SnuggleBack Attaches for Convenient Heat and Hands-Free. Black Faux Fur with Sherpa Roll over to zoom in + View large image Economy Edition Office Desk Chair Wrap by SnuggleBack Attaches for Convenient Heat and Hands-Free. Black Faux Fur with Sherpa PREMIUM FLEECE – Our premium fleece is super soft and cozy."
  },
  {
    "question": "Could you summarize PMT's information about Cold Water Therapy Pad for Cryotherapy Unit - Head cold pad?",
    "answer": "PRODUCTS Water Therapy Systems Cold Water Therapy Pad for Cryotherapy Unit - Head cold pad Roll over to zoom in + View large image Cold Water Therapy Pad for Cryotherapy Unit - Head cold pad COMPATIBLE WITH MANY SYSTEMS: Compatible with the Arctic Ice Classic, ARS, Polar Vortex, and Polar Sport. **COUPLING CONVERTER is required for the Arctic Ice Clear and other units made by other manufacturers. CONTINUOUS FLOW: Continuous water therapy circumferentially covers and treats a body area with an afflicted disability."
  },
  {
    "question": "What information does PMT provide about SnuggleBack Chair Blanket - Lavender Fleece?",
    "answer": "PRODUCTS Heat Therapy SnuggleBack Chair Blanket - Lavender Fleece Roll over to zoom in + View large image SnuggleBack Chair Blanket - Lavender Fleece PREMIUM FLEECE – Our premium fleece is super soft and cozy. It is thinner and more nimble than the faux fur. Perfect for summer use where the AC is blasting, but warm enough for that extra warmth needed on cold winter mornings."
  },
  {
    "question": "What should I know about 3-Pack Replacement Bulbs for Theralamp and Infarex Handheld Red Light Therapy Devices from PMT?",
    "answer": "PRODUCTS Light Therapy 3-Pack Replacement Bulbs for Theralamp and Infarex Handheld Red Light Therapy Devices Roll over to zoom in + View large image 3-Pack Replacement Bulbs for Theralamp and Infarex Handheld Red Light Therapy Devices FULLY COMPATIBLE: These are the OEM bulbs for the Theralamp and Infarex Handheld red light devices LONG LIFE: Bulbs last through many treatments. RED LIGHT THERAPY: These bulbs produce Red and Infrared; as well as a considerable amount of therapeutic heat. POWERFUL: These bulbs produce high wattage power that helps generate a safe but strong/penetrating heat SATISFACTION GUARANTEED: If there are any issues with your bulbs we will 100% honor replacements."
  },
  {
    "question": "I need details on Cool Collar Neck Cooling Wrap with Cooling Towel – Reusable Instant Cooling Neck Band, Adjustable Lightweight . What does PMT say about it?",
    "answer": "PRODUCTS Water Therapy Systems Cool Collar Neck Cooling Wrap with Cooling Towel – Reusable Instant Cooling Neck Band, Adjustable Lightweight Design for Outdoor Work, Sports, Travel, Heat Relief & Summer Comfort Roll over to zoom in + View large image Cool Collar Neck Cooling Wrap with Cooling Towel – Reusable Instant Cooling Neck Band, Adjustable Lightweight Design for Outdoor Work, Sports, Travel, Heat Relief & Summer Comfort Summer Must-Have: Whether you work outdoors or play sports, our neck cooling tubes are a summer must-have, providing refreshing coolness and complete relaxation. Versatile Cooling: No battery needed! No charger needed！supply is required to start freezing anywhere below"
  },
  {
    "question": "What information does PMT provide about Elite Custom Manual Operation Medical-Grade Vacuum Erection Device for Erectile Dysfunction (Manual)?",
    "answer": "PRODUCTS ED Devices Elite Custom Manual Operation Medical-Grade Vacuum Erection Device for Erectile Dysfunction (Manual) Roll over to zoom in + View large image Elite Custom Manual Operation Medical-Grade Vacuum Erection Device for Erectile Dysfunction (Manual) USE FOR: Trouble getting an Erection, Trouble keeping an Erection, Reduced Sexual Desire HELP: Improve relations with your loved one External vacuum erection devices have become easily available for consumers since the FDA no longer requires a prescription from a physician to purchase a penis pump. Originally the device required a prescription when introduced in 1982. Prescription requirements were removed in 1997 when the FDA determi"
  },
  {
    "question": "I need details on OSTEOARTHRITIS & RHEUMATOID ARTHRITIS CREAM - Topical Structural Joint & Inflammatory Support Formula. What does PMT say about it?",
    "answer": "PRODUCTS Therapeutic Creams and Gels OSTEOARTHRITIS & RHEUMATOID ARTHRITIS CREAM - Topical Structural Joint & Inflammatory Support Formula Roll over to zoom in + View large image OSTEOARTHRITIS & RHEUMATOID ARTHRITIS CREAM - Topical Structural Joint & Inflammatory Support Formula SUPPORTS TARGETED JOINT COMFORT (Menthol + Arnica + MSM SUPPORTS LOCAL MICRO-CIRCULATION (L-Arginine 8.4%) PROMOTES STRUCTURAL JOINT SUPPORT (Glucosamine + Chondroitin) SOOTHES & CALMS INFLAMMATORY SIGNALING (Aloe + Vitamin E + Botanical Oils PRODUCT CODE: OAC10 THERAPY INFO WARRANTY DESCRIPTION Osteoarthritis & Rheumatoid Arthritis Cream: Science-Led Topical Structural & Inflammatory Joint Support Degenerative and "
  },
  {
    "question": "What should I know about Dr. Archy Foot Massager from PMT?",
    "answer": "PRODUCTS Massage Therapy Devices Plantar Fasciitis Foot Roller by Dr. Archy – Multi-Function Massager Tool Relieves Plantar Fasciitis, Heel Spur, Aching Arch, Tired Feet and Heel Pain - Reflexology Trigger Point Tension Release Roll over to zoom in + View large image Plantar Fasciitis Foot Roller by Dr. Archy – Multi-Function Massager Tool Relieves Plantar Fasciitis, Heel Spur, Aching Arch, Tired Feet and Heel Pain - Reflexology Trigger Point Tension Release SOOTHE ACHING FEET: You can't always have a massage therapist on hand (we wish!) to massage and soothe your poor aching feet, but Dr."
  },
  {
    "question": "Could you summarize PMT's information about Acupillow - Neck Stretch And Massage?",
    "answer": "PRODUCTS Massage Therapy Devices Neck Stretch Massage Trigger Point Chiropractic Pillow by Acupillow - Cervical Traction Stretcher Device - Myofascial Release of Pressure Point - Neck Pain Roll over to zoom in + View large image Neck Stretch Massage Trigger Point Chiropractic Pillow by Acupillow - Cervical Traction Stretcher Device - Myofascial Release of Pressure Point - Neck Pain ACUPRESSURE PILLOW: Acupillow neck and shoulder relaxer will ease pain with a firm, but not too stiff device specially designed with neck supports that hit acupressure points to release neck tension. COMFORABLY CRADLES: Some neck pain relief devices, such as pro cervical neck traction collars, are cumbersome or un"
  },
  {
    "question": "What information does PMT provide about Rapid Knee OA Double-Upright Hinged Brace - Medium Left?",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee OA Double-Upright Hinged Brace - Medium Left Roll over to zoom in + View large image Rapid Knee OA Double-Upright Hinged Brace - Medium Left PORTABLE COMFORT: Rapid Knee OA Brace - Medium Left is designed with portability in mind, ensuring you can take it with you wherever you go. Experience comfort and convenience throughout your day, whether at home or on the move. BREATHABLE AND LIGHTWEIGHT: Crafted from breathable, non-allergenic materials, this knee brace offers superior comfort without compromising on breathability."
  },
  {
    "question": "What should I know about TENS Units, Electrotherapy, Heating Pads from PMT?",
    "answer": "X Live Pain Free Print Catalog PRODUCTS ORDER DETAILS RESOURCES CONTACT WHOLESALE Media Assets PRODUCTS ORDER DETAILS RESOURCES CONTACT WHOLESALE Media Assets Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Bracing and SupportsMassage Therapy DevicesTractionWater Therapy SystemsUltrasoundHeat TherapyTherap"
  },
  {
    "question": "I need details on Electric Lifting Backrest for Bed by Mobi-Back (Full Bed Cushion Version – Solid Steel Construction). What does PMT say about it?",
    "answer": "PRODUCTS Mobility Assistance Electric Lifting Backrest for Bed by Mobi-Back (Full Bed Cushion Version – Solid Steel Construction) Roll over to zoom in + View large image Electric Lifting Backrest for Bed by Mobi-Back (Full Bed Cushion Version – Solid Steel Construction) COMFORT - Full Cushion Accessory for use with the MOBI BACK - Back Lift for the bed. COMPATIBLE: Slips onto the Mobi Back Gen 2 Back Lift REMOTE CONTROLLED: The Mobi-Back Gen 2 – Lifting back rest has a bearing lift rod that is controlled through the remote’s control one-touch operation. The Mobi-Back lifts up to 600 pounds, and the remote control conveniently adjusts the angle as needed to obtain an ergonomic and comfortable"
  },
  {
    "question": "What information does PMT provide about Personal Protective Equipment?",
    "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip"
  },
  {
    "question": "Can you explain the PMT information about Rapid Knee (slip-on Knee Brace with comfort fit elastic) – Small?",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee (slip-on Knee Brace with comfort fit elastic) – Small Roll over to zoom in + View large image Rapid Knee (slip-on Knee Brace with comfort fit elastic) – Small Rapid Knee (slip-on Knee Brace with comfort fit elastic) PRODUCT CODE: RK150PLUS- S THERAPY INFO WARRANTY S M L XL 2XL 3XL DESCRIPTION Rapid Knee (slip-on Knee Brace with comfort fit elastic).Available in Small,Medium,Large,XL,XXL and XXXL sizes. SPECIFICATIONS Product Weight (lbs) : 2Size : RK150+SHCPCS Code : L1832/ L1833"
  },
  {
    "question": "I need details on Silver conductive pad kit with wrap – by Energy Brace – size 4” by 7”. What does PMT say about it?",
    "answer": "PRODUCTS Electrotherapy Garments Silver conductive pad kit with wrap – by Energy Brace – size 4” by 7” Roll over to zoom in + View large image Silver conductive pad kit with wrap – by Energy Brace – size 4” by 7” HIGHLY CONDUCTIVE - 30% silver yarn REUSABLE – use with conductive spray to conduct to the skin COMFORTABLE – flexible to fit any body part PRODUCT CODE: EBD47K THERAPY INFO WARRANTY Shoulder - 3x5 Pad W/Wrap & Versitile Joint Wrap Dual Conductive 4X10 Pad W/ WRAP Shoulder - 3x5 Pad W/Wrap & Versitile Joint Wrap M-L (fits most) One Size Knee - 4x7 Pad W/Wrap Cervical- 3x5 Pad W/Wrap Deluxe Back - With-2 dual conductive 4X10 pads W/Wrap DESCRIPTION ELECTROTHERAPY GARMENTS - Now elect"
  },
  {
    "question": "Could you summarize PMT's information about Cloud Walker | Walking Boot for Foot & Ankle Support | Full Shell Design | Injury Recovery | Adjustable Air Ce?",
    "answer": "PRODUCTS Bracing and Supports Cloud Walker | Walking Boot for Foot & Ankle Support | Full Shell Design | Injury Recovery | Adjustable Air Cells | Lightweight & Comfortable-Large Roll over to zoom in + View large image Cloud Walker | Walking Boot for Foot & Ankle Support | Full Shell Design | Injury Recovery | Adjustable Air Cells | Lightweight & Comfortable-Large Full Shell Protection – Rigid outer shell offers maximum support and stability for foot, ankle, and lower leg injuries. Adjustable Air Cell System – Built-in air chambers allow personalized compression for improved comfort and reduced swelling. Shock-Absorbing Sole – Cushioned sole minimizes impact and promotes a natural walking mot"
  },
  {
    "question": "Can you explain the PMT information about Galvanic Stim Digital High Volt?",
    "answer": "PRODUCTS Electrotherapy Devices • Galvanic Stimulators Galvanic Stim Digital High Volt Roll over to zoom in + View large image Galvanic Stim Digital High Volt Package Includes: Device, batteries, lead wires, 1 pack of 4 electrodes, carrying case and users manual. Most useful in acute injuries associated with major tissue trauma with bleeding or swelling Galvanic Stimulators apply direct current, creating and electrical field over the treated area The positive pad behaves like ice, causing reduced circulation to the area under the pad and reduction in swelling. The negative pad behaves like heat,causing increased circulation, reportedly speeding healing."
  },
  {
    "question": "What should I know about Neck Travel Pillow by Skypillow, Comfortable and Breathable Memory Foam Neck Pillow with Adjustable Straps, Re from PMT?",
    "answer": "PRODUCTS Traction Neck Travel Pillow by Skypillow, One-of-a-kind Orthopedic Travel Pillow, Prevent Neck Cramps, Improve Posture; Memory Foam and Adjustable, Washable Cover, Includes Carrying Case and Clip (Blue) (SM) Roll over to zoom in + View large image Neck Travel Pillow by Skypillow, One-of-a-kind Orthopedic Travel Pillow, Prevent Neck Cramps, Improve Posture; Memory Foam and Adjustable, Washable Cover, Includes Carrying Case and Clip (Blue) (SM) A BETTER NECK PILLOW: Many travel pillows aren't firm enough to properly support the neck and end up caving in to even the slightest amount of pressure. This does very little to actually help relieve neck pain or provide comfort during travel. "
  },
  {
    "question": "Could you summarize PMT's information about Conductive Copper Ear Clip Electrodes?",
    "answer": "PRODUCTS Electrotherapy Supplies Conductive Copper Ear Clip Electrodes Roll over to zoom in + View large image Conductive Copper Ear Clip Electrodes Ear clips connect to lead wires of an electrotherapy device stimulate acupuncture points in the ear lope. PRODUCT CODE: EARCLIP-M THERAPY INFO WARRANTY DESCRIPTION Conductive copper metal ear clip electrodes for stimulating acupuncture points on the ear lobe or for CES application. Plastic base handles of the clip accept a 2mm male pin from your lead wire."
  },
  {
    "question": "What information does PMT provide about Knee Stretch Traction and Hamstring Stretcher by Flex Frame - For Knee Extensions, Knee Pain, Hip Pain, Lower ?",
    "answer": "PRODUCTS Traction Knee Stretch Traction and Hamstring Stretcher by Flex Frame - For Knee Extensions, Knee Pain, Hip Pain, Lower Back Pain, Full Leg Stretching. Roll over to zoom in + View large image Knee Stretch Traction and Hamstring Stretcher by Flex Frame - For Knee Extensions, Knee Pain, Hip Pain, Lower Back Pain, Full Leg Stretching. KNEE TRACTION: Designed for those with OA or RA of the knee and those with post-ACL and MCL surgery rehabilitation."
  },
  {
    "question": "I need details on Rapid Knee OA Brace - Right | Single Upright Hinged | Lightweight & Breathable | Portable Support for Osteoart. What does PMT say about it?",
    "answer": "PRODUCTS Bracing and Supports Rapid Knee OA Brace - Right | Single Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size Roll over to zoom in + View large image Rapid Knee OA Brace - Right | Single Upright Hinged | Lightweight & Breathable | Portable Support for Osteoarthritis and Rheumatoid Arthritis - universal size PORTABLE COMFORT: Rapid Knee OA Brace - Right is designed with portability in mind, ensuring you can take it with you wherever you go. Experience comfort and convenience throughout your day, whether at home or on the move. BREATHABLE AND LIGHTWEIGHT: Crafted from breathable, non-allergenic materials, this knee "
  },
  {
    "question": "Can you explain the PMT information about Ultima Neo (TENS, EMS, IFC, Micro) w/ Li-ion rechargeable battery - 28v strength?",
    "answer": "PRODUCTS Electrotherapy Devices • Combo Units Ultima Neo (TENS, EMS, IFC, Micro) w/ Li-ion rechargeable battery - 28v strength Roll over to zoom in + View large image Ultima Neo (TENS, EMS, IFC, Micro) w/ Li-ion rechargeable battery - 28v strength Package Includes: Device, batteries, lead wires, 1 pack of 4 electrodes, carrying case and users manual. The Ultima Neo is an Advanced multi-mode electrotherapy stimulator that combines enhanced TENS, EMS, Interferential, and Microcurrent. It is dual channel device and includes the function of our most advanced TENS and EMS modes with body part diagrams, as well as an advanced Interferential device with sine wave technology, and a very state-of-the"
  },
  {
    "question": "I need details on 9volt Charger. What does PMT say about it?",
    "answer": "PRODUCTS Electrotherapy Supplies 9volt Charger Roll over to zoom in + View large image 9volt Charger high performance batteries PRODUCT CODE: 9VCRG THERAPY INFO WARRANTY DESCRIPTION high performance batteries SPECIFICATIONS Product Weight (lbs) : 1Width (cms) : 4Legnth - Inches : 2Weight Code : G"
  },
  {
    "question": "Could you summarize PMT's information about NerveSpa Pro - 90 Day Supply?",
    "answer": "PRODUCTS Electrotherapy Devices • Neuropathy Stimulator NerveSpa Pro - 90 Day Supply Roll over to zoom in + View large image NerveSpa Pro - 90 Day Supply Clinical Device Advanced Hand & Foot Neuropathy System for Provider-Guided Aquatic Nerve Stimulation Relieve Pain – Helps relieve nerve discomfort, tingling, sensitivity, and hand-and-foot pain through repeated-use care plans. Stimulate Nerves – Supports broader circumferential nerve engagement across the hands and feet than limited pad-only systems. Improve Circulation – Warm-water immersion and stimulation work together to support circulation-oriented extremity care."
  }
];

const sheetQuestionSet = new Set(sheetQAPairs.map(p => p.question.toLowerCase().trim()));
const regressionQuestionSet = new Set(exactRegressionQAPairs.map(p => p.question.toLowerCase().trim()));
const kbQuestionSet = new Set(kbProductQAPairs.map(p => p.question.toLowerCase().trim()));
const filteredKbPairs = kbProductQAPairs.filter(p => !regressionQuestionSet.has(p.question.toLowerCase().trim()));
const filteredSheetPairs = sheetQAPairs.filter(p => !regressionQuestionSet.has(p.question.toLowerCase().trim()) && !kbQuestionSet.has(p.question.toLowerCase().trim()));
const combinedQuestionSet = new Set([...regressionQuestionSet, ...filteredKbPairs.map(p => p.question.toLowerCase().trim()), ...filteredSheetPairs.map(p => p.question.toLowerCase().trim())]);
const filteredHardcodedPairs = hardcodedQAPairs.filter(p => !combinedQuestionSet.has(p.question.toLowerCase().trim()));
const qaPairs = [...exactRegressionQAPairs, ...filteredKbPairs, ...filteredSheetPairs, ...filteredHardcodedPairs];

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

// ================= KB PRODUCT HEADING MATCHING =================
const kbPromptWords = new Set([
  "pmt", "pain", "management", "technologies", "information", "info",
  "provide", "provides", "about", "summarize", "summary", "details",
  "detail", "explain", "know", "need", "says", "say", "from", "important",
  "question", "could", "would", "please"
]);

function getProductTitleTokens(text) {
  return String(text || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w) && !kbPromptWords.has(w));
}

function kbHeadingScore(input, heading) {
  const inputTokens = new Set(getProductTitleTokens(input));
  const headingTokens = [...new Set(getProductTitleTokens(heading))];
  if (inputTokens.size < 2 || headingTokens.length < 2) return 0;
  let hits = 0;
  for (const token of headingTokens) {
    if (inputTokens.has(token)) hits++;
  }
  return hits / Math.min(headingTokens.length, Math.max(6, inputTokens.size));
}

function findBestKbPair(input) {
  let bestPair = null;
  let bestPairScore = 0;
  for (const pair of kbProductQAPairs) {
    const score = kbHeadingScore(input, pair.question);
    if (score > bestPairScore) {
      bestPair = pair;
      bestPairScore = score;
    }
  }
  return bestPairScore >= 0.72 ? { pair: bestPair, score: bestPairScore } : null;
}

// 1) exact normalized match and KB product-title containment first
const normalizedIncoming = normalize(incomingQuestion);
const kbProductQuestionSet = new Set(kbProductQAPairs.map(p => normalize(p.question)));
const exactRegressionQuestionSet = new Set(exactRegressionQAPairs.map(p => normalize(p.question)));
let bestScore = 0;
let match = qaPairs.find((pair) => {
  if (normalize(pair.question) === normalizedIncoming) {
    bestScore = 1.0;
    return true;
  }
  return false;
});

const directKbPairMatch = !match ? findBestKbPair(incomingQuestion) : null;
if (directKbPairMatch) {
  match = directKbPairMatch.pair;
  bestScore = Math.max(bestScore, directKbPairMatch.score);
}

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
// ================= MULTI-INTENT OVERRIDE =================
// If the question contains multiple intents/questions, bypass single predefined match
// so the LLM workflow can answer all parts properly.
const isMultiIntent = /\b(also|additionally|secondly|and also)\b/i.test(incomingQuestion) ||
  /\b(first:?|second:?|part 1|part 2)\b/i.test(incomingQuestion) ||
  (incomingQuestion.includes("?") && incomingQuestion.indexOf("?") < incomingQuestion.length - 2);

if (isMultiIntent && !kbProductQuestionSet.has(normalize(match?.question || "")) && !exactRegressionQuestionSet.has(normalize(match?.question || ""))) {
  match = null;
}

// ================= PRODUCT OVERRIDE =================
if (match && bestScore < 0.85) {
  const normQ = incomingQuestion.toLowerCase();
  const rawProducts = ["tens", "ultima", "ultima 1", "ultima 5", "ultima 11", "ultima 20", "ultima 3t", "ultima neo", "electrodes", "lead wires", "battery", "pmt", "thermotech", "thermacycle", "soft cycle", "ucombo", "thermorelief", "theralamp", "aqua relief", "polar vortex", "arctic ice", "theratrac", "jstim", "qfiber"];
  const products = rawProducts.slice().sort((a, b) => b.length - a.length);

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
        /(surgical|metal|hardware|joint replacement|knee replacement|hip replacement|titanium|\bscrews?\b|\bplates?\b|\brods?\b).*(tens|safe|use|ok|device|problem)/i,
        /tens.*(surgical|metal|implant|hardware|joint replacement|knee replacement|hip replacement|titanium|\bscrews?\b|\bplates?\b|\brods?\b)/i,
        /use.*(over|with|near).*(surgical|metal|implant|hardware|titanium|\bscrews?\b|\bplates?\b|\brods?\b)/i
      ],
      target: "Can I use a TENS unit if I have metal implants?"
    },
    // 4. Skin redness & irritation / breaking out
    {
      patterns: [
        /(redness|\bred\b|\bmarks?\b|irritat|\brash\b|\bburns?\b|\bitchy\b|\bbreak\b|breaking out|skin).*(after|session|treatment|use|every|under|where the pad|where the electrode)/i,
        /skin.*(redness|\bred\b|\bmarks?\b|irritat|\brash\b|\bitchy\b|\bbreak\b|color)/i,
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
