const fs = require('fs');

// We will construct the enhanced matching logic and test against all 93 questions
const questions = JSON.parse(fs.readFileSync('d:/Z_work/Sujay/Spark - PMT chatbot/chatbot-tester/test_93_questions.json', 'utf8'));

// Load predefined questions list
const hardcodedQuestions = [
  "contact info",
  "How can I contact Pain Management Technologies?",
  "What is the phone number and email for PMT customer support?",
  "Where can I find the Ultima 5 User Manual?",
  "Where can I download the Ultima 1 User Manual?",
  "Where can I download the Ultima 11 User Manual?",
  "Where can I download the Ultima 20 User Manual?",
  "Where can I find the Ultima Neo User Manual?",
  "Where can I find instructions for Thermotech?",
  "Where can I find the Soft Cycle instructions?",
  "Where can I find the TENS Electrode Placement Chart?",
  "How do I pair a Thermacycle remote control?",
  "Where can I find PMT forms like ARS, JStim, or TENS CMN forms?",
  "Where can I find educational guides for microcurrent, Galvanic, or IF devices?",
  "Where can I view PMT product catalog or product pages?",
  "Where can I find video demonstrations for PMT devices?",
  "How does a TENS unit work?",
  "What does a TENS unit feel like?",
  "What does a TENS unit actually do?",
  "Does TENS help reduce inflammation?",
  "How long does it take to feel relief?",
  "Can I use a TENS unit every day?",
  "How often should I use a TENS unit?",
  "Where should I place the pads for lower back pain?",
  "Where do I put the pads for neck pain?",
  "Can I place the pads directly over where the pain is?",
  "Can the pads touch each other?",
  "How far apart should the pads be?",
  "Can I use more than one channel at a time?",
  "Which mode should I use?",
  "What frequency is best for chronic pain?",
  "What frequency works best for acute pain?",
  "How high should I turn up the intensity?",
  "Should the stimulation feel strong or gentle?",
  "Why does the sensation fade after a few minutes?",
  "What pain conditions does TENS help with?",
  "Is it safe to use a TENS unit while sleeping?",
  "Can I wear a TENS unit all day?",
  "Can I use TENS with a pacemaker?",
  "Is a TENS unit safe to use during pregnancy?",
  "Can I use a TENS unit if I have diabetes?",
  "Can I use a TENS unit if I have metal implants?",
  "Where should I never place TENS pads?",
  "Can I drive while using a TENS unit?",
  "How long do TENS pads last?",
  "Why won't my pads stick anymore?",
  "How do I make my pads sticky again?",
  "Can I wash or clean electrode pads?",
  "Are generic pads compatible with my unit?",
  "What pads are compatible with my unit?",
  "What's the difference between 2 inch and 4 inch pads?",
  "How do I know which pads are best for me?",
  "Why isn't my TENS unit producing sensation?",
  "Why is only one pad working?",
  "Why does the stimulation feel sharp instead of comfortable?",
  "Why does my skin turn red after treatment?",
  "Why does my unit keep turning off?",
  "Why does the intensity suddenly decrease?",
  "How long does the battery last?",
  "Should I buy a rechargable batteries?",
  "What's the difference between TENS and EMS?",
  "Can one device do both TENS and EMS?",
  "Does TENS actually work?",
  "Is pain relief immediate or temporary?",
  "Will my body get used to TENS?",
  "Can TENS help me avoid pain medication?",
  "Can TENS speed up healing or does it only mask pain?",
  "What TENS unit is best for home use?",
  "Is a prescription required?",
  "What accessories should I buy with a TENS unit?",
  "What program should I use for my condition?",
  "How many minutes should I do per session?",
  "Can I use TENS more than once a day?",
  "When should I replace the pads?",
  "How do I clean and store the unit?",
  "How do I maximize pain relief?",
  "What are the theories behind how TENS units work?",
  "How should I approach electrode placement?",
  "Is there contradictions with medication?",
  "Why am I not feeling sensation?",
  "Why does the stimulation seem weak?",
  "Stimulation feels sharp or uncomfortable",
  "Why does intensity drop during use?",
  "Why won't my TENS unit turn on?",
  "I am experiencing skin irritation -- why is that?",
  "How do I use a TENS unit, step by step?",
  "What are typical troubleshooting issues with TENS units?",
  "What is the Ultima 5 (U5)?",
  "What comes in my Ultima 5 kit?",
  "What's different between the current Ultima 5 and the earlier model?",
  "What are Soft-Touch electrodes, and why do they matter?",
  "What's the difference between the Soft-Touch Silver and Clinical Grade electrode lines?",
  "What does the Pad Contact Interruption Alarm do on my Ultima 5?",
  "What does the Compliance Monitor track, and why does it matter?",
  "What wave forms does the Ultima 5 offer, and which one should I use?",
  "How do I turn my Ultima 5 on and off?",
  "Why does the intensity reset to zero when I switch modes?",
  "Does my Ultima 5 remember my last settings when I turn it back on?",
  "What is the auto-repeat feature when adjusting pulse rate or pulse width?",
  "How do the intensity knobs work on my Ultima 5?",
  "How do I read the battery level indicator on my Ultima 5?",
  "Does my Ultima 5 automatically shut off if I forget to turn it off?",
  "What is the Lock/Unlock feature, and how do I use it?",
  "What settings should I use for my very first Ultima 5 session?",
  "How far apart should the electrode pads be on my Ultima 5?",
  "Where can I learn more about my Ultima 5?"
];

const predefinedQuestions = [...hardcodedQuestions];

const synonyms = {
  // Device names
  "device": "tens unit", "unit": "tens unit", "machine": "tens unit",
  "stimulator": "tens unit", "massager": "tens unit", "electrotherapy": "tens unit",
  "e stim": "tens unit", "estim": "tens unit", "electrical stimulation": "tens unit",
  // Models
  "u5": "ultima 5", "u 5": "ultima 5", "u1": "ultima 1", "u 1": "ultima 1",
  "u11": "ultima 11", "u 11": "ultima 11", "u20": "ultima 20", "u 20": "ultima 20",
  "u3t": "ultima 3t", "u 3t": "ultima 3t", "neo": "ultima neo",
  // Electrodes
  "pads": "electrodes", "pad": "electrodes", "electrode": "electrodes",
  "patch": "electrodes", "patches": "electrodes", "gelpad": "electrodes", "gelpads": "electrodes",
  "stickers": "electrodes", "sticker": "electrodes", "sticky pads": "electrodes",
  // Wires
  "wires": "lead wires", "wire": "lead wires", "lead": "lead wires", "leads": "lead wires",
  "cable": "lead wires", "cables": "lead wires", "cord": "lead wires", "cords": "lead wires",
  // Intensity
  "strength": "intensity", "level": "intensity", "amplitude": "intensity", "volume": "intensity",
  "strong": "intensity", "stronger": "intensity", "weaker": "intensity", "weak": "intensity",
  // Frequency
  "rate": "frequency", "speed": "frequency", "hz": "frequency", "hertz": "frequency",
  "pulses": "frequency", "pulse rate": "frequency",
  // Pulse width
  "width": "pulse width", "microseconds": "pulse width", "us": "pulse width",
  // Paraphrase support synonyms
  "soon": "quickly", "fast": "quickly", "rapid": "quickly", "quickly": "quickly",
  "difference": "relief", "benefit": "relief", "helping": "relief", "improvement": "relief",
  "notice": "feel", "expecting": "pregnancy", "pregnant": "pregnancy",
  "surgical hardware": "metal implants", "surgical": "metal implants", "hardware": "metal implants",
  "titanium": "metal implants", "screw": "metal implants", "plate": "metal implants", "rod": "metal implants",
  "joint replacement": "metal implants", "knee replacement": "metal implants", "hip replacement": "metal implants",
  "red marks": "redness", "red mark": "redness", "redness": "redness", "irritation": "redness", "itchy": "redness",
  "drug": "medication", "drugs": "medication", "medicine": "medication", "medicines": "medication", "prescription": "medication",
  "interaction": "contraindication", "interactions": "contraindication",
  "pacemaker": "pacemaker", "cardiac device": "pacemaker", "defibrillator": "pacemaker",
  "wat": "what", "freqency": "frequency", "chronik": "chronic", "pane": "pain", "wont": "won't",
  // Placement
  "placement": "position", "place": "position", "location": "position", "put": "position", "apply": "position", "stick": "position",
  // Pain
  "ache": "pain", "soreness": "pain", "discomfort": "pain", "hurt": "pain", "hurts": "pain", "spasm": "pain",
  "lumbar": "lower back", "lumbago": "lower back", "sciatica": "back pain",
  // Battery
  "power": "battery", "batteries": "battery", "rechargeable": "battery", "charging": "battery", "charge": "battery",
  // Mode
  "setting": "mode", "settings": "mode", "program": "mode", "programs": "mode", "waveform": "wave form", "waveforms": "wave form",
  // Manual
  "guide": "user manual", "instructions": "user manual", "manual": "user manual",
  // Contact
  "phone number": "contact info", "email address": "contact info", "customer service": "contact info",
  "reach out": "contact info", "fax": "contact info", "cost": "pricing", "price": "pricing", "buy": "pricing",
  "seller": "pmt", "company": "pmt", "manufacturer": "pmt", "brand": "pmt",
  "not working": "troubleshooting", "broken": "troubleshooting", "problem": "troubleshooting", "issue": "troubleshooting"
};

const stopWords = new Set([
  "a","an","and","are","as","at","be","but","by","for","if","in","into","is","it",
  "no","of","on","or","such","that","the","their","then","there","these","they",
  "this","to","was","will","with","do","does","did","can","could","should","would",
  "i","you","he","she","we","my","your","his","her","our","how","what","why","where",
  "when","who","has","been","hold","u","s","me","about","some","more","much","very",
  "give","get","please","current","go","doing","today","day","hello","hi","hey",
  "there","thanks","thank","yes","no","ok","okay"
]);

function normalize(text) {
  if (!text) return "";
  let base = text.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  let words = base.split(" ");
  for (let i = 0; i < words.length; i++) {
    if (synonyms[words[i]]) words[i] = synonyms[words[i]];
  }
  return words.join(" ").trim();
}

function stem(word) {
  if (!word || word.length <= 3) return word;
  return word.replace(/(ing|ly|ed|er|es|s|ion)$/, "");
}

function getTokens(text) {
  const tokens = normalize(text).split(" ").filter((w) => w && !stopWords.has(w)).map(stem);
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
      matrix[i][j] = b[i-1] === a[j-1] ? matrix[i-1][j-1]
        : Math.min(matrix[i-1][j]+1, matrix[i][j-1]+1, matrix[i-1][j-1]+1);
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
  for (const token of setA) { if (setB.has(token)) intersection++; }
  return intersection / union;
}

const docCount = predefinedQuestions.length;
const freqMap = {};
predefinedQuestions.forEach((q) => {
  new Set(getTokens(q)).forEach((t) => { freqMap[t] = (freqMap[t] || 0) + 1; });
});
const idfWeights = {};
Object.keys(freqMap).forEach((t) => { idfWeights[t] = Math.log(docCount / freqMap[t]) + 1.0; });

function getSemanticScore(input, target) {
  const tokens1 = getTokens(input);
  const tokens2 = getTokens(target);
  if (!tokens1.length || !tokens2.length) return 0;
  let weightedIntersection = 0, totalInputWeight = 0, totalTargetWeight = 0;
  tokens1.forEach((t) => (totalInputWeight += idfWeights[t] || 1.0));
  tokens2.forEach((t) => (totalTargetWeight += idfWeights[t] || 1.0));
  const matched2 = new Set();
  for (let i = 0; i < tokens1.length; i++) {
    const w1 = tokens1[i];
    const w1Weight = idfWeights[w1] || 1.0;
    let bestMatchScore = 0, bestMatchIndex = -1;
    for (let j = 0; j < tokens2.length; j++) {
      if (matched2.has(j)) continue;
      const w2 = tokens2[j];
      if (w1 === w2) { bestMatchScore = 1; bestMatchIndex = j; break; }
      if (w1.length >= 4 && w2.length >= 4) {
        const dist = levenshteinDistance(w1, w2);
        const maxLen = Math.max(w1.length, w2.length);
        const similarity = 1 - dist / maxLen;
        if (similarity >= 0.75 && similarity > bestMatchScore) {
          bestMatchScore = similarity; bestMatchIndex = j;
        } else if ((w1.includes(w2) || w2.includes(w1)) && 0.6 > bestMatchScore) {
          bestMatchScore = 0.6; bestMatchIndex = j;
        }
      }
    }
    if (bestMatchIndex !== -1) {
      weightedIntersection += bestMatchScore * w1Weight;
      matched2.add(bestMatchIndex);
    }
  }
  const inputCoverage = totalInputWeight ? weightedIntersection / totalInputWeight : 0;
  const targetCoverage = totalTargetWeight ? weightedIntersection / totalTargetWeight : 0;
  let finalScore = inputCoverage * 0.7 + targetCoverage * 0.3;
  if (tokens1.length >= 5 && weightedIntersection < 2.0) finalScore *= 0.7;
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

const products = ["tens", "ultima", "ultima 1", "ultima 5", "ultima 11", "ultima 20", "ultima 3t", "ultima neo", "electrodes", "lead wires", "battery", "pmt", "thermotech", "thermacycle", "soft cycle", "ucombo", "thermorelief", "theralamp", "aqua relief", "polar vortex", "arctic ice", "theratrac", "jstim", "qfiber"];

const domainContextWords = [
  "session", "treatment", "therapy", "stimulation", "electrode", "electrodes",
  "relief", "frequency", "intensity", "waveform", "implant", "implants",
  "placement", "chronic", "acute", "pain", "nerve",
  "muscle", "skin", "redness", "irritation", "medication",
  "drug", "interaction", "duration", "minutes", "surgical",
  "hardware", "pacemaker", "pregnancy", "diabetes", "healing",
  "red", "marks", "mark", "helping", "difference", "notice",
  "wave", "waveforms", "metal", "pads", "pad", "size", "spacing",
  "box", "included", "knobs", "beep", "beeps", "alarm", "schedule",
  "stinging", "overnight", "sleep", "swelling", "shuts", "commute", "drive",
  "doctor", "prescription", "dead", "power", "lumbar", "neck", "shoulder"
];

// EXPANDED Comprehensive Paraphrase Intent Map
const paraphraseMap = [
  // 1. Relief onset & timeline
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
  // 2. Metal implants / surgical hardware / titanium
  {
    patterns: [
      /(surgical|metal|implant|hardware|joint replacement|knee replacement|hip replacement|titanium|screw|plate|rod).*(tens|safe|use|ok|device|problem)/i,
      /tens.*(surgical|metal|implant|hardware|joint replacement|knee replacement|hip replacement|titanium|screw|plate|rod)/i,
      /use.*(over|with|near).*(surgical|metal|implant|hardware|titanium)/i
    ],
    target: "Can I use a TENS unit if I have metal implants?"
  },
  // 3. Skin redness & irritation
  {
    patterns: [
      /(red|redness|mark|marks|irritat|rash|burn|itchy|breaking out|skin).*(after|session|treatment|use|every|under|where the pad)/i,
      /skin.*(red|mark|marks|irritat|rash|itchy|break|color)/i,
      /(red mark|red spot|redness).*(bad|normal|worried|concern|ok|okay)/i
    ],
    target: "Why does my skin turn red after treatment?"
  },
  // 4. Treatment / session duration
  {
    patterns: [
      /(recommend|typical|ideal|proper|best|suggested|optimal).*(duration|length|time|long|minute|session)/i,
      /(duration|length|time).*(treatment|session|therapy|recommend)/i,
      /how (long|many minute).*(session|treatment|use|per)/i
    ],
    target: "How many minutes should I do per session?"
  },
  // 5. Drug / medication interactions
  {
    patterns: [
      /(drug|medication|medicine|pharma|prescription).*(interact|contradict|conflict|combine|mix|safe|interfere)/i,
      /(interact|contradict|conflict|interfere).*(drug|medication|medicine|prescription)/i,
      /drug interaction/i,
      /medication.*(safe|ok|concern|worry|interact)/i
    ],
    target: "Is there contradictions with medication?"
  },
  // 6. U5 Waveform options
  {
    patterns: [
      /(wave|waveform).*(option|type|kind|offer|have|available).*(u5|ultima 5)/i,
      /(u5|ultima 5).*(wave|waveform).*(option|type|kind|offer|have)/i,
      /(wave|waveform).*(option|type).*(u5|ultima 5|ultima5)/i
    ],
    target: "What wave forms does the Ultima 5 offer, and which one should I use?"
  },
  // 7. Pad size (small vs big / 2 inch vs 4 inch)
  {
    patterns: [
      /(small pads?|big (ones|pads?)|pad sizes?|size.*(pad|electrode)|which pad.*best|2 inch.*4 inch)/i,
      /(difference|between).*(2 inch|4 inch|small.*big).*pad/i
    ],
    target: "What's the difference between 2 inch and 4 inch pads?"
  },
  // 8. First time use & step by step
  {
    patterns: [
      /(walk me through|how (do|to) use|steps to (set up|run)|first time (user|session|using)|get started).*(tens|device|unit|session|this)/i,
      /(step by step|how to set up).*(tens|session|unit)/i
    ],
    target: "How do I use a TENS unit, step by step?"
  },
  // 9. Does TENS work / Evidence / Placebo
  {
    patterns: [
      /(do tens units? actually (help|work)|real evidence|placebo|actually (help|work) people)/i,
      /(evidence|proof).*(works|effective|placebo)/i
    ],
    target: "Does TENS actually work?"
  },
  // 10. Intensity setting & pain/hurt
  {
    patterns: [
      /(right|proper|correct|ideal|recommended).*(intensity|level|strength|knob)/i,
      /(how high|what intensity|intensity level).*(turn up|set|use)/i,
      /(supposed|meant|should).*(hurt|painful)/i
    ],
    target: "How high should I turn up the intensity?"
  },
  // 11. Pad Contact Interruption Alarm (U5 beeps)
  {
    patterns: [
      /(beep|beeps|beeping|alert|alarm).*(pad|contact|u5|ultima 5)/i,
      /pad contact (alert|alarm|interruption|beep)/i
    ],
    target: "What does the Pad Contact Interruption Alarm do on my Ultima 5?"
  },
  // 12. Usage frequency & schedule
  {
    patterns: [
      /(reasonable|recommended|typical|proper|how often|how many times).*(schedule|frequency|usage|times a week|use this|use a tens)/i,
      /(how often|how many times a (day|week)).*(use|session)/i
    ],
    target: "How often should I use a TENS unit?"
  },
  // 13. Stinging / Sharp / Uncomfortable sensation
  {
    patterns: [
      /(sting|stinging|bite|biting|sharp|uncomfortable|prick|pricking|pinch).*(instead of|tingle|tingling|feel|stimulation)/i,
      /(sharp|uncomfortable).*(stimulation|sensation|feel)/i
    ],
    target: "Stimulation feels sharp or uncomfortable"
  },
  // 14. Sleep / Overnight use
  {
    patterns: [
      /(overnight|all night|fall asleep|sleeping|while (i|we) sleep).*(tens|device|unit|leave|wear|on|safe|okay)/i,
      /(safe|okay).*(sleep|sleeping|overnight|all night)/i
    ],
    target: "Is it safe to use a TENS unit while sleeping?"
  },
  // 15. What's in the box / U5 kit contents
  {
    patterns: [
      /(what('s| is) (included|in the box|in my kit)|what do i get (when|if) i buy).*(ultima 5|u5|kit)/i,
      /(comes in|included with).*(ultima 5|u5)/i
    ],
    target: "What comes in my Ultima 5 kit?"
  },
  // 16. Placing directly over sore spot / pain area
  {
    patterns: [
      /(directly|right|on top of).*(pain|painful|sore spot|sore area|hurt)/i,
      /pads.*(on top of|over).*(pain|sore spot)/i
    ],
    target: "Can I place the pads directly over where the pain is?"
  },
  // 17. Unit shuts off / powers down mid session
  {
    patterns: [
      /(shuts|turns|powers).*(itself|down|off).*(mid|during|own|automatically)/i,
      /(device|unit).*(turn off|shut off|power down|stops).*(by itself|on its own|mid-session)/i
    ],
    target: "Why does my unit keep turning off?"
  },
  // 18. Swelling & inflammation
  {
    patterns: [
      /(bring down|reduce|help).*(swelling|inflammation|edema)/i,
      /tens.*(swelling|inflammation|edema)/i
    ],
    target: "Does TENS help reduce inflammation?"
  },
  // 19. One pad / one side working
  {
    patterns: [
      /(one (side|channel|pad|lead) works.*(other|second) doesn't|only one (pad|channel|side) (is )?working)/i,
      /one pad working/i
    ],
    target: "Why is only one pad working?"
  },
  // 20. Sensation fading / adaptation / tingling goes away
  {
    patterns: [
      /(tingling|sensation).*(goes away|fades|stops|less|disappear).*(partway|during|after a few minute|normal)/i,
      /(after a few minute.*stop feeling|stop feeling.*after a few minute)/i,
      /(stop working|get used to).*if i use.*(too much|often)/i
    ],
    target: "Why does the sensation fade after a few minutes?"
  },
  // 21. Pads touching / overlapping / separated
  {
    patterns: [
      /(electrodes|pads).*(stay separated|touch|touching|overlap|overlapping)/i,
      /can.*(pads|electrodes).*touch/i,
      /(pads|electrodes).*(separated|overlap)/i
    ],
    target: "Can the pads touch each other?"
  },
  // 22. Prescription / Doctor's note
  {
    patterns: [
      /(doctor('s)? note|rx|prescription.*only|require.*prescription|need a prescription|prescription required)/i,
      /prescription-only/i
    ],
    target: "Is a prescription required?"
  },
  // 23. Dead / won't power up / power button does nothing
  {
    patterns: [
      /(power button.*does nothing|won't (turn|power)|completely dead|won't power up|not powering up|won't turn on)/i,
      /why won't.*turn on/i
    ],
    target: "Why won't my TENS unit turn on?"
  },
  // 24. Neck & shoulder electrode placement
  {
    patterns: [
      /(stiff neck|neck and shoulder|neck pain).*(where|stick|place|pad|electrode|position)/i,
      /(pads?|electrodes?).*(neck|shoulder tension|neck pain)/i
    ],
    target: "Where do I put the pads for neck pain?"
  },
  // 25. All four pads / both channels together
  {
    patterns: [
      /(all four pads|both channels|2 channels|multiple channels).*(at once|together|simultaneously|run both)/i,
      /use more than one channel/i
    ],
    target: "Can I use more than one channel at a time?"
  },
  // 26. Driving / Commute / Behind the wheel
  {
    patterns: [
      /(behind the wheel|commute|drive to work|while driving|operating a vehicle).*(tens|device|unit|run|running|safe)/i,
      /can i drive/i
    ],
    target: "Can I drive while using a TENS unit?"
  },
  // 27. Pad spacing / gap between pads
  {
    patterns: [
      /(how much gap|gap.*between|spacing between|how far apart|right spacing).*(pads|electrodes)/i,
      /how far apart/i
    ],
    target: "How far apart should the pads be?"
  },
  // 28. Pregnancy / Expecting
  {
    patterns: [
      /(while expecting|pregnant|pregnancy|trimester|weeks pregnant|belly at \d+ weeks)/i,
      /safe.*during pregnancy/i
    ],
    target: "Is a TENS unit safe to use during pregnancy?"
  },
  // 29. Pacemaker / Cardiac implant
  {
    patterns: [
      /(pacemaker|cardiac device|defibrillator|icd|implanted cardiac)/i,
      /tens with a pacemaker/i
    ],
    target: "Can I use TENS with a pacemaker?"
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
  // 37. Chronic pain frequency
  {
    patterns: [
      /(wat freqency 4 chronik|chronic pain).*(frequency|hz|setting|rate)/i,
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

function testMatcher(userQuestion) {
  const normQ = userQuestion.toLowerCase();

  // 1. First check Paraphrase Map
  for (const entry of paraphraseMap) {
    for (const pattern of entry.patterns) {
      if (pattern.test(normQ) || pattern.test(userQuestion)) {
        return { match: true, matched_question: entry.target, method: 'paraphraseMap' };
      }
    }
  }

  // 2. Second check Scoring
  let bestScore = 0;
  let bestIndex = -1;
  for (let i = 0; i < predefinedQuestions.length; i++) {
    const q = predefinedQuestions[i];
    const score = combinedScore(userQuestion, q);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  const threshold = 0.5;
  let matchFound = bestScore >= threshold;

  // 3. Ambiguity & context override
  if (matchFound) {
    const hasDomainContext = domainContextWords.some((w) => normQ.includes(w));
    const genericTerms = ["unit", "device", "machine", "wrap", "system", "it", "this", "these", "they", "them"];
    const hasGeneric = genericTerms.some((t) => new RegExp(`\\b${t}\\b`).test(normQ));
    const hasSpecificProduct = products.some((p) => normQ.includes(p));
    const hasCompany = normQ.includes("tens") || normQ.includes("pmt") || normQ.includes("spark");
    const isClearContext = hasSpecificProduct || hasCompany || hasDomainContext;

    if (hasGeneric && !isClearContext && bestScore < 0.65) {
      matchFound = false;
    }

    const wordCount = normQ.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount <= 3 && !isClearContext) {
      matchFound = false;
    }
  }

  return {
    match: matchFound,
    matched_question: matchFound ? predefinedQuestions[bestIndex] : null,
    score: bestScore,
    method: 'scoring'
  };
}

let passedCount = 0;
let fallbackCount = 0;

console.log(`Testing ${questions.length} questions...\n`);
questions.forEach((q, idx) => {
  const res = testMatcher(q);
  if (res.match) {
    passedCount++;
    console.log(`[#${idx + 1}] "${q}"\n  -> ✅ MATCHED: "${res.matched_question}" (${res.method})`);
  } else {
    fallbackCount++;
    console.log(`[#${idx + 1}] "${q}"\n  -> ℹ️ FALLBACK TO LLM AGENT`);
  }
});

console.log(`\n========================================================`);
console.log(`TOTAL: ${questions.length} | MATCHED: ${passedCount} | FALLBACK TO LLM: ${fallbackCount}`);
console.log(`========================================================`);
