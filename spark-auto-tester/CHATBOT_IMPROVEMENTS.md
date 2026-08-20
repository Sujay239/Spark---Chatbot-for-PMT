# CHATBOT IMPROVEMENTS — Coding Agent Handoff

Generated from automated run: **2026-08-20T11-04-49-277Z**

## How the coding agent should use this file

1. Treat the failed-test evidence below as the acceptance criteria.
2. Inspect the supplied n8n workflow, `input/examples/predefined-questions-node.js`, `input/examples/predefined-answers-node.js`, `input/prompts/prompt.txt`, predefined Q&A, and KB before changing behavior.
3. Fix the smallest responsible layer. Do not weaken safety, fallback, or grounding rules to make one test pass.
4. After changes, run `npm start` again and confirm the affected test IDs or equivalent regression questions pass.
5. Do not fabricate PMT facts. If source evidence is missing, improve fallback behavior instead of inventing an answer.

## Current Health

- Total tests: 100
- Pass rate: 70.00%
- Average score: 85.41/100
- Hallucination rate: 6.00%
- Webhook error rate: 0.00%
- Average latency: 3720.45 ms
- Quality gate: **FAILED**
- Failed/attention tests: 30

## Prioritized Problems

### IMP-001 — WRONG_ANSWER

- Priority: **HIGH**
- Frequency: 21
- Responsible layer to inspect: Predefined answer data, KB retrieval, response composition, or prompt rules
- Root-cause confidence: **POSSIBLE**
- Observed fact: 21 test(s) produced WRONG_ANSWER.
- Probable cause: Answer selection, source coverage, or response composition may be incomplete or incorrect.
- Recommended change: Compare expected source evidence with the actual answer for TEST-00017, TEST-00031, TEST-00037, TEST-00038, TEST-00042, TEST-00043. Correct the relevant predefined answer, KB entry, selection rule, or response-composition instruction without weakening unrelated cases.
- Affected tests: TEST-00017, TEST-00031, TEST-00037, TEST-00038, TEST-00042, TEST-00043, TEST-00044, TEST-00046, TEST-00047, TEST-00060, TEST-00061, TEST-00063, TEST-00064, TEST-00066, TEST-00078, TEST-00080, TEST-00081, TEST-00088, TEST-00096, TEST-00099, TEST-00100
- Expected impact: Reduce recurrence of this failure class in subsequent regression runs.

### IMP-002 — UNSUPPORTED_CLAIM

- Priority: **HIGH**
- Frequency: 6
- Responsible layer to inspect: Grounding/fallback policy and LLM response generation
- Root-cause confidence: **POSSIBLE**
- Observed fact: 6 test(s) produced UNSUPPORTED_CLAIM.
- Probable cause: Response generation or grounding controls may permit claims not supported by the supplied PMT sources.
- Recommended change: Tighten grounding and fallback behavior. When the matched PMT source does not contain the requested fact, return the configured fallback instead of completing the answer from model knowledge. Add 6 affected cases to permanent regression coverage.
- Affected tests: TEST-00019, TEST-00024, TEST-00031, TEST-00033, TEST-00078, TEST-00091
- Expected impact: Reduce recurrence of this failure class in subsequent regression runs.

### IMP-003 — MISSING_INFORMATION

- Priority: **MEDIUM**
- Frequency: 19
- Responsible layer to inspect: Predefined answer data, KB retrieval, response composition, or prompt rules
- Root-cause confidence: **POSSIBLE**
- Observed fact: 19 test(s) produced MISSING_INFORMATION.
- Probable cause: Answer selection, source coverage, or response composition may be incomplete or incorrect.
- Recommended change: Compare expected source evidence with the actual answer for TEST-00017, TEST-00037, TEST-00042, TEST-00043, TEST-00044, TEST-00047. Correct the relevant predefined answer, KB entry, selection rule, or response-composition instruction without weakening unrelated cases.
- Affected tests: TEST-00017, TEST-00037, TEST-00042, TEST-00043, TEST-00044, TEST-00047, TEST-00060, TEST-00061, TEST-00062, TEST-00063, TEST-00064, TEST-00066, TEST-00078, TEST-00080, TEST-00081, TEST-00088, TEST-00096, TEST-00099, TEST-00100
- Expected impact: Reduce recurrence of this failure class in subsequent regression runs.

### IMP-004 — INCOMPLETE_RESPONSE

- Priority: **MEDIUM**
- Frequency: 19
- Responsible layer to inspect: Predefined answer data, KB retrieval, response composition, or prompt rules
- Root-cause confidence: **POSSIBLE**
- Observed fact: 19 test(s) produced INCOMPLETE_RESPONSE.
- Probable cause: Answer selection, source coverage, or response composition may be incomplete or incorrect.
- Recommended change: Compare expected source evidence with the actual answer for TEST-00017, TEST-00037, TEST-00042, TEST-00043, TEST-00044, TEST-00047. Correct the relevant predefined answer, KB entry, selection rule, or response-composition instruction without weakening unrelated cases.
- Affected tests: TEST-00017, TEST-00037, TEST-00042, TEST-00043, TEST-00044, TEST-00047, TEST-00060, TEST-00061, TEST-00062, TEST-00063, TEST-00064, TEST-00066, TEST-00078, TEST-00080, TEST-00081, TEST-00088, TEST-00096, TEST-00099, TEST-00100
- Expected impact: Reduce recurrence of this failure class in subsequent regression runs.


## Failed-Test Evidence

### TEST-00017 — KB_KNOWLEDGE — FAILED

**Question**

> Can you explain the PMT information about Trigger Point Pillow?

**Expected behavior/source**

```json
{
  "answer": "PRODUCTS Massage Therapy Devices Trigger Point Pillow - Head and Neck Pain Relief Traction Device, Support Relaxer for Tension Headache Relief for Improved Decompression Roll over to zoom in + View large image Trigger Point Pillow - Head and Neck Pain Relief Traction Device, Support Relaxer for Tension Headache Relief for Improved Decompression PAIN RELIEF --- If suffering from chronic neck pain, herniated disks, upper body stiffness, neck pain, migraines, or arthritis symptoms, use the Trigger Point Pillow to relieve neck and shoulder pain while providing a cervical neck traction. NO PAIN, NO GAIN - the Trigger Point Pillow is intentionally designed to put pressure onto meridian points in y",
  "acceptableAnswers": [
    "PRODUCTS Massage Therapy Devices Trigger Point Pillow - Head and Neck Pain Relief Traction Device, Support Relaxer for Tension Headache Relief for Improved Decompression Roll over to zoom in + View large image Trigger Point Pillow - Head and Neck Pain Relief Traction Device, Support Relaxer for Tension Headache Relief for Improved Decompression PAIN RELIEF --- If suffering from chronic neck pain, herniated disks, upper body stiffness, neck pain, mi…
```

**Actual response**

```text
Trigger Point Pillow - Head and Neck Pain Relief Traction Device  
Product Code: TPP10

Description and purpose  
The Trigger Point Pillow is designed to release stress and pressure in the cervical (neck) and head region. It can help with:

- Neck and head pain  
- Tension headaches and migraines  
- Upper body stiffness  
- Jaw pain  
- Herniated discs, pinched nerves, muscle strain, and general soreness  
- Office fatigue, driver fatigue, back and neck fatigue  
- Insomnia and headaches related to muscle tension  

How it works / what to expect  
- The pillow is intentionally firm and shaped to press into meridian/trigger points in the upper shoulders, neck, and head.  
- It may not feel “relaxing” while you’re on it; the pressure is designed to work on tight trigger points, which can feel intense as they release.  
- After use, many people notice a sense of reduced tension or relaxation in the treated area.

Use guidelines  
- Typical use: 1–2 times per day.  
- Start by lying in place for about 3 minutes, gently stretching the neck and slowly moving the head side to side.  
- For continued results, increase use to about 4–5 minutes per session, as tolerated.  
- It is portable,…
```

**Evaluation**

- Score: 51/100
- Failure reasons: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- Status reason: Response is incorrect or materially fails expected behavior.
- Latency: 15548 ms
- Generated from: KB-ec8a444a3643

### TEST-00019 — KB_KNOWLEDGE — HALLUCINATION

**Question**

> I need details on Rapid Knee (Rigid Wrap-on Knee brace) – Large. What does PMT say about it?

**Expected behavior/source**

```json
{
  "answer": "PRODUCTS Bracing and Supports Rapid Knee (Rigid Wrap-on Knee brace) – Large Roll over to zoom in + View large image Rapid Knee (Rigid Wrap-on Knee brace) – Large COMFORTALE – Comfort-tech material allows for a very comfortable fit ADJUSTABLE – The side hinge opens and allows for the extension and flexion to be adjusted. Limiting the range of motion of the knee. EASY ACCESS – Rear access, open in the front allows for the brace to be wrapped on instead of slipped on if desired.",
  "acceptableAnswers": [
    "PRODUCTS Bracing and Supports Rapid Knee (Rigid Wrap-on Knee brace) – Large Roll over to zoom in + View large image Rapid Knee (Rigid Wrap-on Knee brace) – Large COMFORTALE – Comfort-tech material allows for a very comfortable fit ADJUSTABLE – The side hinge opens and allows for the extension and flexion to be adjusted. Limiting the range of motion of the knee. EASY ACCESS – Rear access, open in the front allows for the brace to be wrapped on instead of slipped on if desired."
  ],
  "behavior": "ANSWER_FROM_KB",
  "intent": null,
  "source": "knowledge_base",
  "sourceRef": [
    "input\\knowledge-base\\extracted_pmt_knowledge_base.json",
    "https://paintechnol…
```

**Actual response**

```text
PRODUCTS Bracing and Supports Rapid Knee (Rigid Wrap-on Knee brace) – Large Roll over to zoom in + View large image Rapid Knee (Rigid Wrap-on Knee brace) – Large COMFORTALE – Comfort-tech material allows for a very comfortable fit ADJUSTABLE – The side hinge opens and allows for the extension and flexion to be adjusted. Limiting the range of motion of the knee. EASY ACCESS – Rear access, open in the front allows for the brace to be wrapped on instead of slipped on if desired. LIGHTWEIGHT – Super light and easy to wear. GUARANTEED – Satisfaction Guaranteed PRODUCT CODE: RK200-L THERAPY INFO WARRANTY Small - Right or Left Large - Right or Left Medium - Right or Left XL - Right or Left 2XL - Ri
```

**Evaluation**

- Score: 68/100
- Failure reasons: UNSUPPORTED_CLAIM
- Status reason: Response contains unsupported or insufficiently grounded claims.
- Latency: 1935 ms
- Generated from: KB-7be8ffc958b4

### TEST-00024 — KB_KNOWLEDGE — HALLUCINATION

**Question**

> What information does PMT provide about Multi-Spectrum Red Light Therapy for Face, 7 spectrums-Red, Blue, Cyan, Yellow, Purple, Green, Violet, 660nm &?

**Expected behavior/source**

```json
{
  "answer": "PRODUCTS Light Therapy Multi-Spectrum Red Light Therapy for Face, 7 spectrums-Red, Blue, Cyan, Yellow, Purple, Green, Violet, 660nm & 850nm Wavelength, 100% Silicone, 240 Total LED'S, Portable Rechargeable Battery Roll over to zoom in + View large image Multi-Spectrum Red Light Therapy for Face, 7 spectrums-Red, Blue, Cyan, Yellow, Purple, Green, Violet, 660nm & 850nm Wavelength, 100% Silicone, 240 Total LED'S, Portable Rechargeable Battery CLINICAL GRADE POWER – The Infarex has a total power irradiance of 46MW/CM2. And with a remarkable 240 total LEDS. REVITALIZE YOUR SKIN 660nm and near-infrared 850nm is the best combination wavelength for cosmetic therapy.",
  "acceptableAnswers": [
    "PRODUCTS Light Therapy Multi-Spectrum Red Light Therapy for Face, 7 spectrums-Red, Blue, Cyan, Yellow, Purple, Green, Violet, 660nm & 850nm Wavelength, 100% Silicone, 240 Total LED'S, Portable Rechargeable Battery Roll over to zoom in + View large image Multi-Spectrum Red Light Therapy for Face, 7 spectrums-Red, Blue, Cyan, Yellow, Purple, Green, Violet, 660nm & 850nm Wavelength, 100% Silicone, 240 Total LED'S, Portable Rechargeable Battery CLINICAL GRADE POWER – The Infarex has a…
```

**Actual response**

```text
PRODUCTS Light Therapy Multi-Spectrum Red Light Therapy for Face, 7 spectrums-Red, Blue, Cyan, Yellow, Purple, Green, Violet, 660nm & 850nm Wavelength, 100% Silicone, 240 Total LED'S, Portable Rechargeable Battery Roll over to zoom in + View large image Multi-Spectrum Red Light Therapy for Face, 7 spectrums-Red, Blue, Cyan, Yellow, Purple, Green, Violet, 660nm & 850nm Wavelength, 100% Silicone, 240 Total LED'S, Portable Rechargeable Battery CLINICAL GRADE POWER – The Infarex has a total power irradiance of 46MW/CM2. This is very high comparatively. And with a remarkable 240 total LEDS. Power drives results. REVITALIZE YOUR SKIN 660nm and near-infrared 850nm is the best combination wavelength
```

**Evaluation**

- Score: 76/100
- Failure reasons: UNSUPPORTED_CLAIM
- Status reason: Response contains unsupported or insufficiently grounded claims.
- Latency: 2857 ms
- Generated from: KB-a11a779b384d

### TEST-00027 — KB_KNOWLEDGE — PARTIAL

**Question**

> What information does PMT provide about Infrared Heated Foot Warmers by Comfort Bootie - Far Infrared wavelength 8-15 μm, Non-Slip Heated Slippers wit?

**Expected behavior/source**

```json
{
  "answer": "PRODUCTS Heat Therapy Infrared Heated Foot Warmers by Comfort Bootie - Far Infrared wavelength 8-15 μm, Non-Slip Heated Slippers with Wireless li-ion Rechargeable Batteries – Improve Circulation in The feet. (Large: 10-11) Roll over to zoom in + View large image Infrared Heated Foot Warmers by Comfort Bootie - Far Infrared wavelength 8-15 μm, Non-Slip Heated Slippers with Wireless li-ion Rechargeable Batteries – Improve Circulation in The feet. (Large: 10-11) DUAL SIDED – Heating element on the top and the bottom of the foot.",
  "acceptableAnswers": [
    "PRODUCTS Heat Therapy Infrared Heated Foot Warmers by Comfort Bootie - Far Infrared wavelength 8-15 μm, Non-Slip Heated Slippers with Wireless li-ion Rechargeable Batteries – Improve Circulation in The feet. (Large: 10-11) Roll over to zoom in + View large image Infrared Heated Foot Warmers by Comfort Bootie - Far Infrared wavelength 8-15 μm, Non-Slip Heated Slippers with Wireless li-ion Rechargeable Batteries – Improve Circulation in The feet. (Large: 10-11) DUAL SIDED – Heating element on the top and the bottom of the foot."
  ],
  "behavior": "ANSWER_FROM_KB",
  "intent": null,
  "source": "knowledge_base",
  "…
```

**Actual response**

```text
PRODUCTS Heat Therapy Infrared Heated Foot Warmers by Comfort Bootie - Far Infrared wavelength 8-15 μm, non-slip heated slippers with wireless li-ion rechargeable batteries – improve circulation in the feet.(X-Large:12-13) Roll over to zoom in + View large image Infrared Heated Foot Warmers by Comfort Bootie - Far Infrared wavelength 8-15 μm, non-slip heated slippers with wireless li-ion rechargeable batteries – improve circulation in the feet.(X-Large:12-13) DUAL SIDED – Heating element on the top and the bottom of the foot. POWERFUL THERAPY – With the latest carbon fiber heating technology, and multiple heating levels with LED power indicator to display heating levels. INDOOR/OUTDOOR – des
```

**Evaluation**

- Score: 82/100
- Failure reasons: none
- Status reason: Response is materially useful but misses part of the expected behavior.
- Latency: 2840 ms
- Generated from: KB-1d2703e5eae6

### TEST-00031 — KB_KNOWLEDGE — HALLUCINATION

**Question**

> Can you explain the PMT information about Soft-Touch Medical Grade Electrodes?

**Expected behavior/source**

```json
{
  "answer": "PRODUCTS Electrodes • Tricot Electrodes Soft-Touch Medical Grade Electrodes Roll over to zoom in + View large image Soft-Touch Medical Grade Electrodes Soft-Touch Cloth Electrodes (PMT gel) - 2.0” x 2.0” Self - Adhesive, High Quality Gel Electrodes. Reusable (10-15 or more uses per pad). Universal for all TENS and EMS units with the pin-type connector.",
  "acceptableAnswers": [
    "PRODUCTS Electrodes • Tricot Electrodes Soft-Touch Medical Grade Electrodes Roll over to zoom in + View large image Soft-Touch Medical Grade Electrodes Soft-Touch Cloth Electrodes (PMT gel) - 2.0” x 2.0” Self - Adhesive, High Quality Gel Electrodes. Reusable (10-15 or more uses per pad). Universal for all TENS and EMS units with the pin-type connector."
  ],
  "behavior": "ANSWER_FROM_KB",
  "intent": null,
  "source": "knowledge_base",
  "sourceRef": [
    "input\\knowledge-base\\extracted_pmt_knowledge_base.json",
    "https://paintechnology.com/products/electrodes/soft-touch-medical-grade-electrodes-1143?pa=1"
  ]
}
```

**Actual response**

```text
PRODUCTS Electrodes Soft-Touch Medical Grade Electrodes Roll over to zoom in + View large image Soft-Touch Medical Grade Electrodes Soft-Touch Cloth Electrodes (PMT gel) - 3.0 round Self - Adhesive, High Quality Gel Electrodes. 45 ohms of resistance. Reusable (10-15 or more uses per pad). Universal for all TENS and EMS units with the pin-type connector. Satisfaction Guaranteed. PRODUCT CODE: FA3000 2 THERAPY INFO WARRANTY 2.0x 2.0 - qty: 10 packs of 4 electrodes/pack 3" Round _ 10 packs of 4 electrodes/pack 2.0" Round - qty: 10 packs of 4 electrodes/pack Butterfly 6"x 3.3 qty: 10 packs of 1each/pack DESCRIPTION Electrodes life-span and effectiveness can be enhanced by rubbing a small drop of
```

**Evaluation**

- Score: 60/100
- Failure reasons: WRONG_ANSWER, UNSUPPORTED_CLAIM
- Status reason: Response contains unsupported or insufficiently grounded claims.
- Latency: 1908 ms
- Generated from: KB-c0a1336b3bf3

### TEST-00033 — KB_KNOWLEDGE — HALLUCINATION

**Question**

> What information does PMT provide about Soft-Touch Clinical Grade Electrodes?

**Expected behavior/source**

```json
{
  "answer": "PRODUCTS Electrodes Soft-Touch Clinical Grade Electrodes Roll over to zoom in + View large image Soft-Touch Clinical Grade Electrodes Self - Adhesive, High Quality Gel Electrodes. Reusable (10-15 or more uses per pad). Universal for all TENS and EMS units with the pin-type connector.",
  "acceptableAnswers": [
    "PRODUCTS Electrodes Soft-Touch Clinical Grade Electrodes Roll over to zoom in + View large image Soft-Touch Clinical Grade Electrodes Self - Adhesive, High Quality Gel Electrodes. Reusable (10-15 or more uses per pad). Universal for all TENS and EMS units with the pin-type connector."
  ],
  "behavior": "ANSWER_FROM_KB",
  "intent": null,
  "source": "knowledge_base",
  "sourceRef": [
    "input\\knowledge-base\\extracted_pmt_knowledge_base.json",
    "https://paintechnology.com/products/electrodes/soft-touch-clinical-grade-electrodes-1192?pa=1"
  ]
}
```

**Actual response**

```text
PRODUCTS Electrodes Soft-Touch Clinical Grade Electrodes Roll over to zoom in + View large image Soft-Touch Clinical Grade Electrodes Self - Adhesive, High Quality Gel Electrodes. 45 ohms of resistance. Reusable (10-15 or more uses per pad). 4 electrodes per package. Universal for all TENS and EMS units with the pin-type connector. Satisfaction Guaranteed. PRODUCT CODE: SP1000 THERAPY INFO WARRANTY 1.0" Round- qty: 10 packs of 4 electrodes/pack 1.5" x 1.5" qty: 10 packs of 4 electrodes/pack 2.0" x 2.0" qty: 10 packs of 4 electrodes/pack 2.0" Round qty: 10 packs of 4 electrodes/pack 1.5" x 3.1" qty: 10 packs of 4 electrodes/pack 1.5" x 4.0" qty: 10 packs of 2 electrodes/pack 3.0"Round qty: 10
```

**Evaluation**

- Score: 64/100
- Failure reasons: UNSUPPORTED_CLAIM
- Status reason: Response contains unsupported or insufficiently grounded claims.
- Latency: 1964 ms
- Generated from: KB-ebc499697718

### TEST-00037 — DIRECT — FAILED

**Question**

> I want to understand the difference between the Soft-Touch Silver and Clinical Grade electrode lines.

**Expected behavior/source**

```json
{
  "answer": "Both are premium reusable electrodes. The Silver series (SPS) uses a silver backing with ultra-low impedance and a gentle blue gel, great for sensitive skin, in sizes from 1.25\" round up to 3\" round. The Clinical Grade series (SP) uses a carbon backing with low-impedance blue gel and the widest size range, from a 1\" round up to a 3.3\"x6\" butterfly pad.",
  "acceptableAnswers": [
    "Both are premium reusable electrodes. The Silver series (SPS) uses a silver backing with ultra-low impedance and a gentle blue gel, great for sensitive skin, in sizes from 1.25\" round up to 3\" round. The Clinical Grade series (SP) uses a carbon backing with low-impedance blue gel and the widest size range, from a 1\" round up to a 3.3\"x6\" butterfly pad."
  ],
  "behavior": "ANSWER_FROM_SOURCE",
  "intent": null,
  "source": "qa",
  "sourceRef": [
    "input\\qa\\Key - VA TENS Unit Bot.csv",
    "input\\examples\\predefined-answers-node.js"
  ]
}
```

**Actual response**

```text
PRODUCTS Electrodes Soft-Touch Clinical Grade Electrodes Roll over to zoom in + View large image Soft-Touch Clinical Grade Electrodes Self - Adhesive, High Quality Gel Electrodes. 45 ohms of resistance. Reusable (10-15 or more uses per pad). 4 electrodes per package. Universal for all TENS and EMS units with the pin-type connector. Satisfaction Guaranteed. PRODUCT CODE: SP1000 THERAPY INFO WARRANTY 1.0" Round- qty: 10 packs of 4 electrodes/pack 1.5" x 1.5" qty: 10 packs of 4 electrodes/pack 2.0" x 2.0" qty: 10 packs of 4 electrodes/pack 2.0" Round qty: 10 packs of 4 electrodes/pack 1.5" x 3.1" qty: 10 packs of 4 electrodes/pack 1.5" x 4.0" qty: 10 packs of 2 electrodes/pack 3.0"Round qty: 10
```

**Evaluation**

- Score: 46/100
- Failure reasons: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- Status reason: Response is incorrect or materially fails expected behavior.
- Latency: 2303 ms
- Generated from: QA-cfd7aa8ae7a5

### TEST-00038 — DIRECT — PARTIAL

**Question**

> What is the official place where I can find instructions for Thermotech?

**Expected behavior/source**

```json
{
  "answer": "You can view Thermotech user instructions here:\n- [Thermotech Analogue Instructions](https://paintechnology.s3.amazonaws.com/pdf/Thermotech-Users-Instructions-analogue.pdf)\n- [Thermotech Digital Instructions](https://paintechnology.s3.amazonaws.com/pdf/Thermotech-Users-instructions-digital.pdf)",
  "acceptableAnswers": [
    "You can view Thermotech user instructions here:\n- [Thermotech Analogue Instructions](https://paintechnology.s3.amazonaws.com/pdf/Thermotech-Users-Instructions-analogue.pdf)\n- [Thermotech Digital Instructions](https://paintechnology.s3.amazonaws.com/pdf/Thermotech-Users-instructions-digital.pdf)"
  ],
  "behavior": "ANSWER_FROM_SOURCE",
  "intent": null,
  "source": "qa",
  "sourceRef": [
    "input\\examples\\predefined-answers-node.js"
  ]
}
```

**Actual response**

```text
You can find the official Thermotech user manuals here:

• Thermotech Analogue Instructions:  
https://paintechnology.s3.amazonaws.com/pdf/Thermotech-Users-Instructions-analogue.pdf  

• Thermotech Digital Instructions:  
https://paintechnology.s3.amazonaws.com/pdf/Thermotech-Users-instructions-digital.pdf  

For additional manuals and resources, you can also browse the PMT resources page:  
https://paintechnology.com/resources
```

**Evaluation**

- Score: 77/100
- Failure reasons: WRONG_ANSWER
- Status reason: Response is materially useful but misses part of the expected behavior.
- Latency: 7384 ms
- Generated from: QA-349fe87f7312

### TEST-00042 — SEMANTIC — FAILED

**Question**

> Could you give me the important information behind this question: Why does intensity drop during use?

**Expected behavior/source**

```json
{
  "answer": "A decrease in intensity during a session is usually caused by your body adapting to the stimulation, changes in skin contact, or device settings. Common causes include: Your body is adjusting to the sensation: It is normal to notice the stimulation less over time as your nerves become accustomed to it. Pads are losing contact: Movement, sweat, or drying electrodes can reduce conductivity. Automatic adjustment features: Some TENS programs change the stimulation pattern or strength to keep treatment comfortable. Low battery: Reduce power can affect stimulation strength. Loose connections: Check that the lead wires are securely attached.",
  "acceptableAnswers": [
    "A decrease in intensity during a session is usually caused by your body adapting to the stimulation, changes in skin contact, or device settings. Common causes include: Your body is adjusting to the sensation: It is normal to notice the stimulation less over time as your nerves become accustomed to it. Pads are losing contact: Movement, sweat, or drying electrodes can reduce conductivity. Automatic adjustment features: Some TENS programs change the stimulation pattern or strength to keep treatment comfort…
```

**Actual response**

```text
A drop in intensity during use usually comes down to a few key factors:

1. Your body is adapting  
   - As nerves get used to the stimulation, the sensation feels weaker even though the output may be the same.  
   - This is normal “accommodation” to the signal.

2. Electrode pad contact is changing  
   - Pads starting to dry out  
   - Pads lifting at the edges from movement or sweat  
   - Poor skin contact reduces conductivity, so the current reaching the nerves effectively drops.

3. Program or settings changes  
   - Some modes automatically vary the pattern or strength over time to keep treatment comfortable, which can feel like a decrease.

4. Power and connection issues  
   - Low battery can reduce effective output.  
   - Loose lead wires or partially plugged-in cables can make the stimulation feel weaker or intermittent.

Those are the main “important” reasons behind intensity seeming to drop during a session.
```

**Evaluation**

- Score: 61/100
- Failure reasons: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- Status reason: Response is incorrect or materially fails expected behavior.
- Latency: 8519 ms
- Generated from: QA-aebe5f71fafc

### TEST-00043 — SEMANTIC — FAILED

**Question**

> I am trying to understand the same issue in everyday language: Are generic pads compatible with my unit?

**Expected behavior/source**

```json
{
  "answer": "In most cases, yes, generic TENS pads are compatible as long as they use the same standard pin size for connection and are designed for TENS/EMS devices. Before purchasing, check the following: The connector type (most use a standard 2mm pin or snap connection). The pad size and shape are the correct size for your treatment area. The manufacturer's recommendations for your specific device. Higher-quality electrodes often provide better adhesion, comfort, and consistent stimulation compared to lower-quality alternatives.",
  "acceptableAnswers": [
    "In most cases, yes, generic TENS pads are compatible as long as they use the same standard pin size for connection and are designed for TENS/EMS devices. Before purchasing, check the following: The connector type (most use a standard 2mm pin or snap connection). The pad size and shape are the correct size for your treatment area. The manufacturer's recommendations for your specific device. Higher-quality electrodes often provide better adhesion, comfort, and consistent stimulation compared to lower-quality alternatives."
  ],
  "behavior": "ANSWER_FROM_SOURCE",
  "intent": null,
  "source": "qa",
  "sourceRef": [
    "i…
```

**Actual response**

```text
It is generally not recommended to wear a TENS unit continuously all day without breaks. While TENS can often be used multiple times throughout the day, extended use may increase the risk of skin irritation, reduced effectiveness, or discomfort. For best results: Use TENS in scheduled sessions as needed. Give your skin breaks between treatments. Move electrode placement if using the same area frequently. Follow your device's recommended usage guidelines.
```

**Evaluation**

- Score: 43/100
- Failure reasons: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- Status reason: Response is incorrect or materially fails expected behavior.
- Latency: 6698 ms
- Generated from: QA-1ececb78f355

### TEST-00044 — SEMANTIC — FAILED

**Question**

> What should a PMT customer know about this: Should the stimulation feel strong or gentle?

**Expected behavior/source**

```json
{
  "answer": "TENS stimulation should feel strong but comfortable. You should notice a clear tingling, buzzing, or pulsing sensation without pain, burning, or excessive muscle discomfort. The goal is to provide enough stimulation to be effective while keeping the treatment comfortable throughout the session.",
  "acceptableAnswers": [
    "TENS stimulation should feel strong but comfortable. You should notice a clear tingling, buzzing, or pulsing sensation without pain, burning, or excessive muscle discomfort. The goal is to provide enough stimulation to be effective while keeping the treatment comfortable throughout the session.",
    "TENS stimulation should feel strong but comfortable. You should notice a clear tingling, buzzing, or pulsing sensation without pain, burning, or excessive muscle discomfort. The goal is to provide enough stimulation to be effective while keeping the treatment comfortable throughout the session.\n\nUseful Resources & Links:\n🛠️ [Electrotherapy Device Troubleshooting Guide](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Electrotherapy%20device%20TROUBLESHOOTING.docx)"
  ],
  "behavior": "ANSWER_FROM_SOURCE",
  "intent": null,
  "source": "qa"…
```

**Actual response**

```text
With PMT electrotherapy devices (like TENS, interferential, or Micro EQC), stimulation should be clearly **felt** but remain **comfortable**:

- You should feel a distinct sensation (tingling, tapping, pulsing, or gentle muscle contraction), not nothing at all.
- It should be **strong enough to notice and “do something”**, but still **gentle enough that you can relax and tolerate it for the full session**.
- It should **never be painful, burning, or sharp**. If it is, you should lower the intensity immediately or stop use.

General guidance:

1. **Start low and increase slowly** until you reach a strong but comfortable level.
2. The sensation may feel unusual at first, but you should be able to **get used to it within a minute or two**.
3. If you have to “brace yourself” or it makes your muscles jump violently, it is probably too high.

Always follow the specific instructions in your device’s user manual for intensity settings and usage time, and check with your healthcare provider if you are unsure whether a given level is appropriate for you.
```

**Evaluation**

- Score: 49/100
- Failure reasons: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- Status reason: Response is incorrect or materially fails expected behavior.
- Latency: 8062 ms
- Generated from: QA-2b5e75cefb51

### TEST-00046 — SEMANTIC — FAILED

**Question**

> Could you give me the important information behind this question: What program should I use for my condition?

**Expected behavior/source**

```json
{
  "answer": "The best TENS program depends on your type of pain, where it is located, and how your body responds to stimulation. There is no single setting that works best for everyone. Start with a comfortable setting and adjust based on how your body responds.",
  "acceptableAnswers": [
    "The best TENS program depends on your type of pain, where it is located, and how your body responds to stimulation. There is no single setting that works best for everyone. Start with a comfortable setting and adjust based on how your body responds."
  ],
  "behavior": "ANSWER_FROM_SOURCE",
  "intent": null,
  "source": "qa",
  "sourceRef": [
    "input\\qa\\Key - VA TENS Unit Bot.csv",
    "input\\examples\\predefined-answers-node.js"
  ]
}
```

**Actual response**

```text
When someone asks “what mode should I use for my condition?” on a TENS or electrotherapy unit, the key ideas behind that question are:

1. **Type of pain matters**  
   - Acute vs chronic  
   - Mild vs severe  
   - Constant vs occasional  
   - Location of pain (back, knee, shoulder, etc.)

2. **Mode = stimulation pattern**  
   They’re really asking how the different patterns work and which is most appropriate:
   - **Normal/Continuous** – steady stimulation, commonly used for general, everyday pain relief.  
   - **Burst** – pulses in groups, often used for stronger or more persistent pain.  
   - **Modulation** – varies the pattern automatically to reduce “getting used to” one feeling.

3. **No single “best” mode for everyone**  
   - The “best” mode depends on:
     - Their specific condition  
     - How sensitive they are to stimulation  
     - What feels comfortable and effective to them  
   - Most people are advised to **start with a standard setting** and adjust based on response.

4. **Typical starting approach**  
   A common quick-start framework in many TENS protocols is:
   - Start with a **normal/constant mode**  
   - Frequency around **50–150 Hz**  
   - Pulse …
```

**Evaluation**

- Score: 53/100
- Failure reasons: WRONG_ANSWER
- Status reason: Response is incorrect or materially fails expected behavior.
- Latency: 12560 ms
- Generated from: QA-6b58343e8b10

### TEST-00047 — SEMANTIC — FAILED

**Question**

> I am trying to understand the same issue in everyday language: When should I replace the pads?

**Expected behavior/source**

```json
{
  "answer": "Replace your TENS pads when they no longer provide good skin contact or consistent stimulation. Signs it's time for new pads: They stop sticking well to your skin. The edges begin to lift or curl. Stimulation feels uneven, weak, or uncomfortable. The gel looks dry, dirty, or damaged. Skin irritation occurs after use. With proper care, reusable electrode pads typically last 10-30 uses, but lifespan varies based on skin type, storage, and frequency of use.",
  "acceptableAnswers": [
    "Replace your TENS pads when they no longer provide good skin contact or consistent stimulation. Signs it's time for new pads: They stop sticking well to your skin. The edges begin to lift or curl. Stimulation feels uneven, weak, or uncomfortable. The gel looks dry, dirty, or damaged. Skin irritation occurs after use. With proper care, reusable electrode pads typically last 10-30 uses, but lifespan varies based on skin type, storage, and frequency of use.",
    "Replace your TENS pads when they no longer provide good skin contact or consistent stimulation. Signs it's time for new pads: They stop sticking well to your skin. The edges begin to lift or curl. Stimulation feels uneven, weak,…
```

**Actual response**

```text
It is generally not recommended to wear a TENS unit continuously all day without breaks. While TENS can often be used multiple times throughout the day, extended use may increase the risk of skin irritation, reduced effectiveness, or discomfort. For best results: Use TENS in scheduled sessions as needed. Give your skin breaks between treatments. Move electrode placement if using the same area frequently. Follow your device's recommended usage guidelines.
```

**Evaluation**

- Score: 42/100
- Failure reasons: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- Status reason: Response is incorrect or materially fails expected behavior.
- Latency: 6139 ms
- Generated from: QA-ae03b20e5f30

### TEST-00056 — INFORMAL — PARTIAL

**Question**

> contact info pls

**Expected behavior/source**

```json
{
  "answer": "You can contact Pain Management Technologies (PMT) using the following details:\n\nPhone: 1-800-239-7880\nFax: 1-330-564-0118\nEmail: info@paintechnology.com\nAddress: 1760 Wadsworth Road | Akron Ohio 44320\n\nContact Page: https://paintechnology.com/contact",
  "acceptableAnswers": [
    "You can contact Pain Management Technologies (PMT) using the following details:\n\nPhone: 1-800-239-7880\nFax: 1-330-564-0118\nEmail: info@paintechnology.com\nAddress: 1760 Wadsworth Road | Akron Ohio 44320\n\nContact Page: https://paintechnology.com/contact"
  ],
  "behavior": "ANSWER_FROM_SOURCE",
  "intent": null,
  "source": "qa",
  "sourceRef": [
    "input\\examples\\predefined-answers-node.js"
  ]
}
```

**Actual response**

```text
You can reach out for support in the following ways:

• Phone – 1-800-239-7880 (available during business hours)  
• Fax – 1-330-564-0118  
• Email – info@paintechnology.com  
• Address – 1760 Wadsworth Road | Akron Ohio 44320  
• Contact Page – https://paintechnology.com/contact
```

**Evaluation**

- Score: 78/100
- Failure reasons: none
- Status reason: Response is materially useful but misses part of the expected behavior.
- Latency: 4977 ms
- Generated from: QA-e84b71ed6966

### TEST-00060 — MULTI_INTENT — FAILED

**Question**

> Can TENS help me avoid pain medication Also, how do I know which pads are best for me?

**Expected behavior/source**

```json
{
  "answer": [
    "TENS may help some people reduce their reliance on pain medication by providing a drug-free option for managing discomfort. However, it does not replace prescribed medications for everyone or treat the underlying cause of pain. Many people use TENS as part of a broader pain management plan alongside other treatments recommended by their healthcare provider.",
    "The best TENS pads depend on where you are treating, the size of the area, and your comfort preference. Consider: Small pads: Best for targeted areas like wrists, ankles, elbows, or smaller joints. Large pads: Best for larger areas like the lower back, shoulders, hips or thighs. Longer Lasting Pads: Better for frequent users who need more repeated sessions. Flexible Pads: Helpful for areas that move often, like knees, shoulders, or joints. For the best results, choose pads that provide good skin contact,comfortable stimulation, and proper coverage for your treatment area."
  ],
  "behavior": "ANSWER_ALL_INTENTS",
  "intent": null,
  "source": "qa_pair",
  "sourceRef": [
    "input\\qa\\Key - VA TENS Unit Bot.csv",
    "input\\qa\\Key - VA TENS Unit Bot.csv"
  ]
}
```

**Actual response**

```text
The main difference is coverage area. Larger pads spread stimulation over a wider area, while smaller pads provide more targeted treatment. 2 Inch Pads: Best for smaller or more precise areas like the wrist, ankle, neck muscles, or smaller joints. 4 Inch Pads: Better for larger muscle groups, like the lower back, shoulders, thighs, or areas with broader discomfort. Larger pads may also feel more comfortable because the stimulation is distributed across a bigger surface area.
```

**Evaluation**

- Score: 51/100
- Failure reasons: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- Status reason: Response is incorrect or materially fails expected behavior.
- Latency: 5108 ms
- Generated from: QA-0c8b19b46327, QA-a0f6baa1d1d2

### TEST-00061 — MULTI_INTENT — PARTIAL

**Question**

> Where should I place the pads for lower back pain Also, what is the phone number and email for PMT customer support?

**Expected behavior/source**

```json
{
  "answer": [
    "For lower back pain, place the TENS pads on either side of the painful area, near the muscles surrounding the spine. Avoid placing pads directly over the spine or on bony areas. Common placements include: Two pads on each side of the lower back, above the hips or surrounding the area where you feel pain.",
    "You can contact Pain Management Technologies (PMT) using the following details:\n\nPhone: 1-800-239-7880\nFax: 1-330-564-0118\nEmail: info@paintechnology.com\nAddress: 1760 Wadsworth Road | Akron Ohio 44320\n\nContact Page: https://paintechnology.com/contact"
  ],
  "behavior": "ANSWER_ALL_INTENTS",
  "intent": null,
  "source": "qa_pair",
  "sourceRef": [
    "input\\qa\\Key - VA TENS Unit Bot.csv",
    "input\\examples\\predefined-answers-node.js"
  ]
}
```

**Actual response**

```text
For lower back pain, place the TENS pads on either side of the painful area, near the muscles surrounding the spine. Avoid placing pads directly over the spine or on bony areas. Common placements include: Two pads on each side of the lower back, above the hips or surrounding the area where you feel pain.

Useful Resources & Links:
📋 [TENS Electrode Placement Chart](https://paintechnology.s3.amazonaws.com/pdf/placementchart.pdf)
```

**Evaluation**

- Score: 66/100
- Failure reasons: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- Status reason: Response is materially useful but misses part of the expected behavior.
- Latency: 6166 ms
- Generated from: QA-c6cfa68ce2f7, QA-444b5a1764da

### TEST-00062 — MULTI_INTENT — PARTIAL

**Question**

> Is there contradictions with medication Also, will my body get used to TENS?

**Expected behavior/source**

```json
{
  "answer": [
    "TENS generally does not interact with most medications because it works through electrical stimulation rather than through the bloodstream. However, your health condition and medications may still be important to discuss with a healthcare provider. Use caution and seek medical guidance if you: Take medications that affect sensation, nerve function, or heart rhythm. Have reduced ability to feel stimulation. Use medications that increase skin sensitivity or irritation risk. TENS should also be used carefully with certain medical conditions, such as: Implanted electronic devices (like pacemakers or defibrillators), Pregnancy, Epilepsy, Seizure Disorders, Areas with reduced sensation or damaged skin.",
    "Yes, your body can adapt to TENS stimulation over time, which may make the sensation feel less noticeable. This a normal response called habituation. To help maintain effectiveness: Increase the intensity slightly as needed (while keeping it comfortable), Adjust pad placement between sessions, Use different modes or settings if your device offers them, Avoid using the same exact settings every time."
  ],
  "behavior": "ANSWER_ALL_INTENTS",
  "intent": null,
  "…
```

**Actual response**

```text
TENS generally does not interact with most medications because it works through electrical stimulation rather than through the bloodstream. However, your health condition and medications may still be important to discuss with a healthcare provider. Use caution and seek medical guidance if you: Take medications that affect sensation, nerve function, or heart rhythm. Have reduced ability to feel stimulation. Use medications that increase skin sensitivity or irritation risk. TENS should also be used carefully with certain medical conditions, such as: Implanted electronic devices (like pacemakers or defibrillators), Pregnancy, Epilepsy, Seizure Disorders, Areas with reduced sensation or damaged skin.
```

**Evaluation**

- Score: 76/100
- Failure reasons: MISSING_INFORMATION, INCOMPLETE_RESPONSE
- Status reason: Response is materially useful but misses part of the expected behavior.
- Latency: 4060 ms
- Generated from: QA-b913772810ed, QA-f7ddc10420d7

### TEST-00063 — MULTI_INTENT — FAILED

**Question**

> What are Soft-Touch electrodes, and why do they matter Also, can I use more than one channel at a time?

**Expected behavior/source**

```json
{
  "answer": [
    "Soft-Touch electrodes are PMT's premium reusable line: a non-porous tricot backing, conductive wire-mount layer, high-quality carbon layer, and extra-thick gel, with a snug pigtail connector. Oval corners minimize edge curl, and every pad uses latex-free USA gel in a resealable bag to stay fresh. They work well across TENS, EMS, interferential, microcurrent, and galvanic devices.",
    "Yes, if your TENS unit has multiple channels, you can typically use more than one channel at the time. This allows you to treat multiple areas of discomfort or use additional electrode pads for a larger treatment area. For example, one channel can be used on the lower back while another targets the hip or leg area. Always follow your device instructions and keep the intensity at a comfortable level."
  ],
  "behavior": "ANSWER_ALL_INTENTS",
  "intent": null,
  "source": "qa_pair",
  "sourceRef": [
    "input\\qa\\Key - VA TENS Unit Bot.csv",
    "input\\qa\\Key - VA TENS Unit Bot.csv"
  ]
}
```

**Actual response**

```text
Yes, if your TENS unit has multiple channels, you can typically use more than one channel at the time. This allows you to treat multiple areas of discomfort or use additional electrode pads for a larger treatment area. For example, one channel can be used on the lower back while another targets the hip or leg area. Always follow your device instructions and keep the intensity at a comfortable level.
```

**Evaluation**

- Score: 64/100
- Failure reasons: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- Status reason: Response is incorrect or materially fails expected behavior.
- Latency: 5028 ms
- Generated from: QA-41ccab5e42d9, QA-79e71f8bebf9

### TEST-00064 — MULTI_INTENT — FAILED

**Question**

> What's the difference between TENS and EMS Also, what is the auto-repeat feature when adjusting pulse rate or pulse width?

**Expected behavior/source**

```json
{
  "answer": [
    "Although they both use electrical stimulation, TENS and EMS are designed for different purposes. TENS: Primarily used to help relieve pain by stimulating the nerves and reducing pain signals. EMS: Designed to stimulate muscles, helping with muscle strengthening, recovery, re-education, and reducing muscle atrophy. Some devices combine both TENS and EMS modes, allowing you to switch between pain relief and muscle stimulation.",
    "Once you make your first adjustment to pulse rate or pulse width, an auto-repeat function kicks in. If you press and hold the \"PR+\", \"PR-\", \"PW+\", or \"PW-\" key for about 1 second, the value will keep increasing or decreasing automatically, one step every quarter-second, so you can dial in your setting faster without repeatedly tapping the button."
  ],
  "behavior": "ANSWER_ALL_INTENTS",
  "intent": null,
  "source": "qa_pair",
  "sourceRef": [
    "input\\qa\\Key - VA TENS Unit Bot.csv",
    "input\\qa\\Key - VA TENS Unit Bot.csv"
  ]
}
```

**Actual response**

```text
TENS vs. Electrical Muscle Stimulation (EMS)

TENS (Transcutaneous Electrical Nerve Stimulation):
- Purpose: Primarily used to help relieve pain.  
- How it works: Stimulates sensory nerves to help reduce pain signals traveling to the brain and may help stimulate endorphin production.  
- Typical use: Nerve-related pain (acute or chronic), such as back pain, joint pain, etc.

EMS (Electrical Muscle Stimulation):
- Purpose: Designed to stimulate muscles rather than just nerves.  
- How it works: Targets motor nerves to cause muscles to contract.  
- Typical use: Helping prevent or reduce muscle atrophy, improving muscle strength, recovery, re-education, range of motion, and blood flow.  
- Pain effect: Can help with muscle-related pain (spasms, sore or tight muscles), but its main role is muscle activation, not primarily pain blocking.

Some modern devices combine both TENS and EMS modes in one unit, letting you choose between pain relief (TENS) and muscle stimulation (EMS).

Auto Repeat feature for pulse frequency / pulse width

On some electrotherapy units, the “auto repeat” feature means that when you press and hold the button to adjust settings (such as pulse frequency or pulse …
```

**Evaluation**

- Score: 60/100
- Failure reasons: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- Status reason: Response is incorrect or materially fails expected behavior.
- Latency: 11054 ms
- Generated from: QA-28bcaf8d418a, QA-db83a5a4474e

### TEST-00065 — BOUNDARY — PARTIAL

**Question**

> qwrtyplkjhgfds214

**Expected behavior/source**

```json
{
  "answer": null,
  "behavior": "UNSPECIFIED_BOUNDARY",
  "source": "implementation_probe"
}
```

**Actual response**

```text
Typo detected. Please check your question and try again.
```

**Evaluation**

- Score: 74/100
- Failure reasons: none
- Status reason: Response is materially useful but misses part of the expected behavior.
- Latency: 663 ms
- Generated from: rule-based test

### TEST-00066 — LONG_CONTEXT — PARTIAL

**Question**

> Please answer both parts. First: What usage frequency is recommended if I use a TENS unit? Second: Would it be acceptable to drive while using a TENS unit?

**Expected behavior/source**

```json
{
  "answer": [
    "The frequency of TENS use depends on your pain level, condition, and personal response. Many users use a TENS unit once or multiple times per day for short sessions, typically lasting 20-30 minutes. For best results, use your TENS unit as needed and follow the recommended settings and guidelines provided with your device.",
    "It is not recommended to drive or operate heavy machinery while using a TENS unit. The stimulation can be distracting, and changes in intensity or muscle responses may affect your ability to drive safely. For your safety, use your TENS unit before or after driving rather than while operating a vehicle."
  ],
  "behavior": "ANSWER_ALL_INTENTS",
  "source": "qa_pair",
  "sourceRef": [
    "input\\qa\\Key - VA TENS Unit Bot.csv",
    "input\\qa\\Key - VA TENS Unit Bot.csv"
  ]
}
```

**Actual response**

```text
The frequency of TENS use depends on your pain level, condition, and personal response. Many users use a TENS unit once or multiple times per day for short sessions, typically lasting 20-30 minutes. For best results, use your TENS unit as needed and follow the recommended settings and guidelines provided with your device.
```

**Evaluation**

- Score: 71/100
- Failure reasons: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- Status reason: Response is materially useful but misses part of the expected behavior.
- Latency: 7783 ms
- Generated from: QA-05b6fd94cfa7, QA-47f1b9d53767

### TEST-00073 — KB_KNOWLEDGE — PARTIAL

**Question**

> Could you summarize PMT's information about Electrotherapy Single Conductive pad?

**Expected behavior/source**

```json
{
  "answer": "PRODUCTS Electrotherapy Garments Electrotherapy Single Conductive pad Roll over to zoom in + View large image Electrotherapy Single Conductive pad Conductive fabric provides efficient dispersion of current, comfort. The ability to reuse the electrodes over and over which can reduce costs of treatment. PRODUCT CODE: EBS23 THERAPY INFO WARRANTY 2x3 3x5 4x7 DESCRIPTION Fabric Conductive Pads are used to replace pregelled electrodes.",
  "acceptableAnswers": [
    "PRODUCTS Electrotherapy Garments Electrotherapy Single Conductive pad Roll over to zoom in + View large image Electrotherapy Single Conductive pad Conductive fabric provides efficient dispersion of current, comfort. The ability to reuse the electrodes over and over which can reduce costs of treatment. PRODUCT CODE: EBS23 THERAPY INFO WARRANTY 2x3 3x5 4x7 DESCRIPTION Fabric Conductive Pads are used to replace pregelled electrodes."
  ],
  "behavior": "ANSWER_FROM_KB",
  "intent": null,
  "source": "knowledge_base",
  "sourceRef": [
    "input\\knowledge-base\\extracted_pmt_knowledge_base.json",
    "https://paintechnology.com/products/electrotherapy-garments/electrotherapy-single-conductive-pad-1154?pa=1"
  ]
}
```

**Actual response**

```text
PRODUCTS Electrotherapy Garments Electrotherapy Single Conductive pad Roll over to zoom in + View large image Electrotherapy Single Conductive pad Conductive fabric provides efficient dispersion of current, comfort. the ability to reuse the electrodes over and over which can reduce costs of treatment. PRODUCT CODE: EBS47 THERAPY INFO WARRANTY 2x3 4x7 3x5 DESCRIPTION Fabric Conductive Pads are used to replace pregelled electrodes. The conductive fabric electrodes are available in single or double configuration. The single requires two (one active and one ground) and the dual will treat a placement site direct (serving as the ground and active in one pad). Conductive fabric provides efficient 
```

**Evaluation**

- Score: 83/100
- Failure reasons: none
- Status reason: Response is materially useful but misses part of the expected behavior.
- Latency: 2206 ms
- Generated from: KB-061e55d4b336

### TEST-00078 — KB_KNOWLEDGE — HALLUCINATION

**Question**

> Can you explain the PMT information about SOFT-TOUCH BASIC GRADE?

**Expected behavior/source**

```json
{
  "answer": "PRODUCTS Electrodes TENS Unit pads by Soft-touch Carbon Electrodes – Latex-Free Replacement pads electrode patches with High Stick performance and non-irritating gel- 2” Sq. 10 packs of 4 each/pack (40 electrodes) Roll over to zoom in + View large image TENS Unit pads by Soft-touch Carbon Electrodes – Latex-Free Replacement pads electrode patches with High Stick performance and non-irritating gel- 2” Sq. 10 packs of 4 each/pack (40 electrodes) 40-PIECE SET – This is an incredible value!",
  "acceptableAnswers": [
    "PRODUCTS Electrodes TENS Unit pads by Soft-touch Carbon Electrodes – Latex-Free Replacement pads electrode patches with High Stick performance and non-irritating gel- 2” Sq. 10 packs of 4 each/pack (40 electrodes) Roll over to zoom in + View large image TENS Unit pads by Soft-touch Carbon Electrodes – Latex-Free Replacement pads electrode patches with High Stick performance and non-irritating gel- 2” Sq. 10 packs of 4 each/pack (40 electrodes) 40-PIECE SET – This is an incredible value!"
  ],
  "behavior": "ANSWER_FROM_KB",
  "intent": null,
  "source": "knowledge_base",
  "sourceRef": [
    "input\\knowledge-base\\extracted_pmt_knowledge_base.json",
  …
```

**Actual response**

```text
PRODUCTS Electrodes • Tricot Electrodes SOFT-TOUCH BASIC GRADE Roll over to zoom in + View large image SOFT-TOUCH BASIC GRADE Reusable Self-Adhering Neuro Stimulation Electrodes For Single Patient use only Satisfaction Guaranteed. PRODUCT CODE: BG2000 THERAPY INFO WARRANTY 2" SQUARE (10 Packs) 2" ROUND (10 Packs) DESCRIPTION Reusable 2” round carbon electrode with tricot backing. Our most economical electrode we make – yet with superior performance characteristics. SPECIFICATIONS Product Weight (lbs) : 1Size : 2" ROUND (10-PACK)
```

**Evaluation**

- Score: 38/100
- Failure reasons: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE, UNSUPPORTED_CLAIM
- Status reason: Response contains unsupported or insufficiently grounded claims.
- Latency: 1651 ms
- Generated from: KB-6960c44a5f79

### TEST-00080 — KB_KNOWLEDGE — FAILED

**Question**

> Could you summarize PMT's information about Electrotherapy probe PR-13A?

**Expected behavior/source**

```json
{
  "answer": "PRODUCTS Electrotherapy Supplies Pelvic Floor Stimulating Probes by Soft Cycle, Perform Electronic Kegel Exercise and Stimulate Pelvic Floor Muscles; Compatible with Muscle Stimulators or Incontinence Devices (Large Rectal) Roll over to zoom in + View large image Pelvic Floor Stimulating Probes by Soft Cycle, Perform Electronic Kegel Exercise and Stimulate Pelvic Floor Muscles; Compatible with Muscle Stimulators or Incontinence Devices (Large Rectal) PREMIUM QUALITY: Ergonomically designed with high-grade materials and silver conductive elements for optimum conductivity and a comfortable dispersion of current. CUSTOM FIT: Designed to come in a variety of shapes and sizes to provide for a cus",
  "acceptableAnswers": [
    "PRODUCTS Electrotherapy Supplies Pelvic Floor Stimulating Probes by Soft Cycle, Perform Electronic Kegel Exercise and Stimulate Pelvic Floor Muscles; Compatible with Muscle Stimulators or Incontinence Devices (Large Rectal) Roll over to zoom in + View large image Pelvic Floor Stimulating Probes by Soft Cycle, Perform Electronic Kegel Exercise and Stimulate Pelvic Floor Muscles; Compatible with Muscle Stimulators or Incontinence Devices (Large Recta…
```

**Actual response**

```text
Electrotherapy Probe PR-13A – Summary

- Product type: Urinary Incontinence Aid Uro Probe  
- Model: Rectal  
- Intended use: Designed for people who have problems with urinary leakage or bowel control; can be used for both urge and stress incontinence.  
- Application: Rectal probe, used as part of pelvic muscle stimulation or kegel-exerciser type programs.  
- Device requirement: Must be used together with an EMS (electrical muscle stimulation) device in order to attain desired results.  
- Output limitation: For use with kegel exercisers or other pelvic muscle stimulators whose output is less than 0.25 W/cm².  
- Product weight: 1 lb  
- Product code: PR13A
```

**Evaluation**

- Score: 44/100
- Failure reasons: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- Status reason: Response is incorrect or materially fails expected behavior.
- Latency: 6979 ms
- Generated from: KB-06e3be2bc90d

### TEST-00081 — KB_KNOWLEDGE — FAILED

**Question**

> Could you summarize PMT's information about About Us?

**Expected behavior/source**

```json
{
  "answer": "Founded in 2000 to develop advanced electrotherapy technology and heat therapy applications. Through the dedication and hard work of our team, Pain Management Technologies has grown into a national leader in the manufacturing of medical devices for pain management, as well as many other cutting-edge therapeutic devices. We are focused and dedicated to pushing the bounds of innovation within the product spaces in which we compete.",
  "acceptableAnswers": [
    "Founded in 2000 to develop advanced electrotherapy technology and heat therapy applications. Through the dedication and hard work of our team, Pain Management Technologies has grown into a national leader in the manufacturing of medical devices for pain management, as well as many other cutting-edge therapeutic devices. We are focused and dedicated to pushing the bounds of innovation within the product spaces in which we compete."
  ],
  "behavior": "ANSWER_FROM_KB",
  "intent": null,
  "source": "knowledge_base",
  "sourceRef": [
    "input\\knowledge-base\\extracted_pmt_knowledge_base.json",
    "https://paintechnology.com/about"
  ]
}
```

**Actual response**

```text
From the information available, here’s how PMT devices handle pulse width:

1. Adjustable pulse width on many units  
   - Several PMT electrotherapy devices allow you to change pulse width (measured in microseconds, µs) in defined steps.  
   - Example ranges shown in PMT specs include:
     - 50–300 µs in specific steps
     - 50–400 µs in 50 µs increments  
   - This lets the user (or clinician) fine‑tune the stimulation “shape” for comfort and response.

2. Fixed pulse width on some microcurrent / specialized modes  
   - Certain microcurrent or specialty programs use fixed pulse widths, for example:
     - 25 µs (not adjustable) on the Micro EQC  
     - 250 µs in one microcurrent mode  
     - 2100 µs in another microcurrent mode  

3. Per‑channel and per‑mode behavior  
   - On multi‑mode units (e.g., TENS/EMS/IF/microcurrent in one device), each therapy type or program can have its own pulse width setting or fixed value.
   - Some channels share the same pulse width; in micro modes, each micro program can have different fixed pulse widths.

4. Auto‑repeat adjustment feature (where available)  
   - On devices that provide it, once you first adjust pulse width, holding the “…
```

**Evaluation**

- Score: 39/100
- Failure reasons: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- Status reason: Response is incorrect or materially fails expected behavior.
- Latency: 9706 ms
- Generated from: KB-d1028266878a

### TEST-00088 — KB_KNOWLEDGE — FAILED

**Question**

> What should I know about Wobble Stool - LG from PMT?

**Expected behavior/source**

```json
{
  "answer": "PRODUCTS Traction Ergonomic Self-Balancing Roller Chair - by Wobble Stool Seating for Improved Posture, 360 Degree Tilt, Adjustable Height, Comfortable Office and Home Chair with Locking Casters Roll over to zoom in + View large image Ergonomic Self-Balancing Roller Chair - by Wobble Stool Seating for Improved Posture, 360 Degree Tilt, Adjustable Height, Comfortable Office and Home Chair with Locking Casters INNOVATIVE DESIGN: The Wobble Stool Roller Chair features a revolutionary 360-degree tilt and rotation mechanism, ensuring it adapts seamlessly to your movements, promoting a natural and upright sitting position. Easy to Lock casters allow for a safe seating position. POSTURE PERFECTION:",
  "acceptableAnswers": [
    "PRODUCTS Traction Ergonomic Self-Balancing Roller Chair - by Wobble Stool Seating for Improved Posture, 360 Degree Tilt, Adjustable Height, Comfortable Office and Home Chair with Locking Casters Roll over to zoom in + View large image Ergonomic Self-Balancing Roller Chair - by Wobble Stool Seating for Improved Posture, 360 Degree Tilt, Adjustable Height, Comfortable Office and Home Chair with Locking Casters INNOVATIVE DESIGN: The Wobble Stool Roll…
```

**Actual response**

```text
The Wobble Stool from PMT is a self-balancing, ergonomic stool designed to promote better posture and help reduce back and neck discomfort associated with long periods of sitting.

Key points you should know:

- Product name: The Wobble Stool – Self Balancing Stool with 360 Degree Rotation  
- Product code: WS150  
- Purpose: Helps promote healthy, upright posture and reduce pain associated with poor posture, especially for people who sit for extended periods (e.g., office work).
- How it works:  
  - The stool tilts and rotates a full 360 degrees in any direction.  
  - As it tilts, your body naturally adjusts to keep balance, encouraging you to sit upright rather than slouch.
- Design features:  
  - Self-balancing wobble base that follows your movement and positioning.  
  - Adapts to each individual’s posture and balance.  
  - Thick foam cushion on top for comfort during long use.  
  - Lightweight and portable so you can easily move it between home and office.
- Construction:  
  - Built with high-quality, durable materials to withstand repeated sitting and standing.  
  - Color: Black  
  - Approximate product weight: 1 lb

If by “wobble stool lg” you mean a specific size or…
```

**Evaluation**

- Score: 50/100
- Failure reasons: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- Status reason: Response is incorrect or materially fails expected behavior.
- Latency: 10686 ms
- Generated from: KB-f7fa34aa2650

### TEST-00091 — KB_KNOWLEDGE — HALLUCINATION

**Question**

> I need details on Rapid Knee (Rigid Wrap-on Knee brace) – Medium. What does PMT say about it?

**Expected behavior/source**

```json
{
  "answer": "PRODUCTS Bracing and Supports Rapid Knee (Rigid Wrap-on Knee brace) – Medium Roll over to zoom in + View large image Rapid Knee (Rigid Wrap-on Knee brace) – Medium COMFORTALE – Comfort-tech material allows for a very comfortable fit ADJUSTABLE – The side hinge opens and allows for the extension and flexion to be adjusted. Limiting the range of motion of the knee. EASY ACCESS – Rear access, open in the front allows for the brace to be wrapped on instead of slipped on if desired.",
  "acceptableAnswers": [
    "PRODUCTS Bracing and Supports Rapid Knee (Rigid Wrap-on Knee brace) – Medium Roll over to zoom in + View large image Rapid Knee (Rigid Wrap-on Knee brace) – Medium COMFORTALE – Comfort-tech material allows for a very comfortable fit ADJUSTABLE – The side hinge opens and allows for the extension and flexion to be adjusted. Limiting the range of motion of the knee. EASY ACCESS – Rear access, open in the front allows for the brace to be wrapped on instead of slipped on if desired."
  ],
  "behavior": "ANSWER_FROM_KB",
  "intent": null,
  "source": "knowledge_base",
  "sourceRef": [
    "input\\knowledge-base\\extracted_pmt_knowledge_base.json",
    "https://paintec…
```

**Actual response**

```text
PRODUCTS Bracing and Supports Rapid Knee (Rigid Wrap-on Knee brace) – Medium Roll over to zoom in + View large image Rapid Knee (Rigid Wrap-on Knee brace) – Medium COMFORTALE – Comfort-tech material allows for a very comfortable fit ADJUSTABLE – The side hinge opens and allows for the extension and flexion to be adjusted. Limiting the range of motion of the knee. EASY ACCESS – Rear access, open in the front allows for the brace to be wrapped on instead of slipped on if desired. LIGHTWEIGHT – Super light and easy to wear. GUARANTEED – Satisfaction Guaranteed PRODUCT CODE: RK200-M THERAPY INFO WARRANTY Small - Right or Left Medium - Right or Left Large - Right or Left XL - Right or Left 2XL - 
```

**Evaluation**

- Score: 69/100
- Failure reasons: UNSUPPORTED_CLAIM
- Status reason: Response contains unsupported or insufficiently grounded claims.
- Latency: 2088 ms
- Generated from: KB-07bc13049618

### TEST-00096 — KB_KNOWLEDGE — FAILED

**Question**

> What should I know about Rapid Thumb from PMT?

**Expected behavior/source**

```json
{
  "answer": "PRODUCTS Bracing and Supports Rigid Thumb Brace Immobilizer by Rapid Thumb - Medium - Tendonitis Arthritis Relief Pain Recovery - CMC Joint Thumb Stabilizer, Splint Spica, Abducted Thumb- Medium Roll over to zoom in + View large image Rigid Thumb Brace Immobilizer by Rapid Thumb - Medium - Tendonitis Arthritis Relief Pain Recovery - CMC Joint Thumb Stabilizer, Splint Spica, Abducted Thumb- Medium RELIEVES PAIN: Pain relief from osteoarthritis and rheumatoid arthritis. CARPAL TUNNEL TREATMENT: Treats the symptoms of carpal tunnel syndrome. COMFORTABLE: Brace is safe and comfortable to wear for extended periods.",
  "acceptableAnswers": [
    "PRODUCTS Bracing and Supports Rigid Thumb Brace Immobilizer by Rapid Thumb - Medium - Tendonitis Arthritis Relief Pain Recovery - CMC Joint Thumb Stabilizer, Splint Spica, Abducted Thumb- Medium Roll over to zoom in + View large image Rigid Thumb Brace Immobilizer by Rapid Thumb - Medium - Tendonitis Arthritis Relief Pain Recovery - CMC Joint Thumb Stabilizer, Splint Spica, Abducted Thumb- Medium RELIEVES PAIN: Pain relief from osteoarthritis and rheumatoid arthritis. CARPAL TUNNEL TREATMENT: Treats the symptoms of carpal tunnel …
```

**Actual response**

```text
PRODUCTS Therapeutic Creams and Gels Roll On Pain Relief by Pain Grenade - Roll On Muscle Pain Reliever, Back Pain, Arthritis – with Arnica, Menthol, & Camphor Roll over to zoom in + View large image Roll On Pain Relief by Pain Grenade - Roll On Muscle Pain Reliever, Back Pain, Arthritis – with Arnica, Menthol, & Camphor MILITARY GRADE RELIEF: Pain Grenade is roll on relief that tackles back, joint, and sore muscles with professional formulas that perform like nothing else on the market. You may have seen other products which make tons of promises, but this product is extra strength for the toughest of the tough. HEATING AND COOLING THERAPY: The unique warm and cool formula of Pain Grenade i
```

**Evaluation**

- Score: 47/100
- Failure reasons: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- Status reason: Response is incorrect or materially fails expected behavior.
- Latency: 2877 ms
- Generated from: KB-b43cc20b6743

### TEST-00099 — KB_KNOWLEDGE — FAILED

**Question**

> What information does PMT provide about Electrotherapy Glove - one size fits all?

**Expected behavior/source**

```json
{
  "answer": "PRODUCTS Electrotherapy Garments Premium Electrotherapy Conductive Gloves - for TENS Pain Treatment, Carpal tunnel, Inflammation, Arthritis, Nerve and Joint Pain (1 Pair - Silver Thread – kit INCLUDES Conductive Spray - One Size Fits Most) Roll over to zoom in + View large image Premium Electrotherapy Conductive Gloves - for TENS Pain Treatment, Carpal tunnel, Inflammation, Arthritis, Nerve and Joint Pain (1 Pair - Silver Thread – kit INCLUDES Conductive Spray - One Size Fits Most) USE WITH YOUR EXISTING TENS OR ELECTROTHERAPY DEVICE (compatible with 95% of devices) for treatment of Tarsal Tunnel, Carpal Tunnel, Nerve and Joint Pain, Arthritis, Sports Injuries, Post-op Swelling, Pain Managem",
  "acceptableAnswers": [
    "PRODUCTS Electrotherapy Garments Premium Electrotherapy Conductive Gloves - for TENS Pain Treatment, Carpal tunnel, Inflammation, Arthritis, Nerve and Joint Pain (1 Pair - Silver Thread – kit INCLUDES Conductive Spray - One Size Fits Most) Roll over to zoom in + View large image Premium Electrotherapy Conductive Gloves - for TENS Pain Treatment, Carpal tunnel, Inflammation, Arthritis, Nerve and Joint Pain (1 Pair - Silver Thread – kit INCLUDES Cond…
```

**Actual response**

```text
Sorry, I couldn't find a relevant answer for your question. 🤔
I am Spark, your dedicated Pain Management Technologies (PMT) assistant, here to support your pain management journey. How can I help you explore our TENS devices or provide support today? ⚡

If you need direct support, you can also contact us at info@paintechnology.com or call 1-800-239-7880.
```

**Evaluation**

- Score: 40/100
- Failure reasons: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- Status reason: Response is incorrect or materially fails expected behavior.
- Latency: 5840 ms
- Generated from: KB-2e82b7b9d24d

### TEST-00100 — KB_KNOWLEDGE — FAILED

**Question**

> Can you explain the PMT information about Fitness?

**Expected behavior/source**

```json
{
  "answer": "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garments Electrotherapy Supplies Accessories Batteries Probes and clips Tens care and accesories Fitness Heat Therapy Incontinence Kinesiology Tape Light Therapy Massage Therapy Devices Mobility Assistance Personal Protective Equipment Stretching Equip",
  "acceptableAnswers": [
    "Browse Categories Accessories Advanced Supplementation Bracing and Supports Cold Compression ED Devices Electrodes Foam Electrodes HypoAllergenic Electrodes Silver electrodes Specialty Gel Pads Tricot Electrodes Electrotherapy Devices Clinical Devices Combo Units EMS Muscle Stimulators Galvanic Stimulators Incontinence Stimulators Interferential Therapy Joint Stimulator Microcurrent Neuropathy Stimulator Russian Stimulators TENS Electrotherapy Garm…
```

**Actual response**

```text
The Pain Management Technologies (PMT) information related to fitness mainly focuses on how electrotherapy—especially Electrical Muscle Stimulation (EMS)—can support muscle strength, endurance, and recovery.

From the provided PMT content:

- EMS sends a controlled electrical current through self-adhesive electrodes placed over the muscle.
- The current passes through the skin to the nerves, causing the muscle to expand and contract.
- EMS can stimulate large nerve axons, including some you cannot easily stimulate voluntarily during normal exercise.
- Because of this, EMS may:
  - Help increase muscle hypertrophy (muscle growth)
  - Improve muscle endurance and strength
  - Be used alongside regular weight training by aiding recovery and helping muscles grow and get stronger
  - Increase body temperature, heart rate, and metabolism (which promotes energy use and fat absorption from the body)

Mechanism summary:
- Normally, your brain sends signals through the spinal cord to nerves to tell muscles to contract.
- EMS replaces that brain signal with an electrical impulse delivered through electrodes.
- These impulses cause rhythmic muscle contractions and relaxations according to the …
```

**Evaluation**

- Score: 40/100
- Failure reasons: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- Status reason: Response is incorrect or materially fails expected behavior.
- Latency: 8756 ms
- Generated from: KB-ad61f3e256b7


## Required Regression Checks

- [ ] Re-test TEST-00017: Can you explain the PMT information about Trigger Point Pillow? — expected failure reasons to clear: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- [ ] Re-test TEST-00019: I need details on Rapid Knee (Rigid Wrap-on Knee brace) – Large. What does PMT say about it? — expected failure reasons to clear: UNSUPPORTED_CLAIM
- [ ] Re-test TEST-00024: What information does PMT provide about Multi-Spectrum Red Light Therapy for Face, 7 spectrums-Red, Blue, Cyan, Yellow, Purple, Green, Violet, 660nm &? — expected failure reasons to clear: UNSUPPORTED_CLAIM
- [ ] Re-test TEST-00027: What information does PMT provide about Infrared Heated Foot Warmers by Comfort Bootie - Far Infrared wavelength 8-15 μm, Non-Slip Heated Slippers wit? — expected failure reasons to clear: PARTIAL
- [ ] Re-test TEST-00031: Can you explain the PMT information about Soft-Touch Medical Grade Electrodes? — expected failure reasons to clear: WRONG_ANSWER, UNSUPPORTED_CLAIM
- [ ] Re-test TEST-00033: What information does PMT provide about Soft-Touch Clinical Grade Electrodes? — expected failure reasons to clear: UNSUPPORTED_CLAIM
- [ ] Re-test TEST-00037: I want to understand the difference between the Soft-Touch Silver and Clinical Grade electrode lines. — expected failure reasons to clear: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- [ ] Re-test TEST-00038: What is the official place where I can find instructions for Thermotech? — expected failure reasons to clear: WRONG_ANSWER
- [ ] Re-test TEST-00042: Could you give me the important information behind this question: Why does intensity drop during use? — expected failure reasons to clear: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- [ ] Re-test TEST-00043: I am trying to understand the same issue in everyday language: Are generic pads compatible with my unit? — expected failure reasons to clear: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- [ ] Re-test TEST-00044: What should a PMT customer know about this: Should the stimulation feel strong or gentle? — expected failure reasons to clear: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- [ ] Re-test TEST-00046: Could you give me the important information behind this question: What program should I use for my condition? — expected failure reasons to clear: WRONG_ANSWER
- [ ] Re-test TEST-00047: I am trying to understand the same issue in everyday language: When should I replace the pads? — expected failure reasons to clear: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- [ ] Re-test TEST-00056: contact info pls — expected failure reasons to clear: PARTIAL
- [ ] Re-test TEST-00060: Can TENS help me avoid pain medication Also, how do I know which pads are best for me? — expected failure reasons to clear: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- [ ] Re-test TEST-00061: Where should I place the pads for lower back pain Also, what is the phone number and email for PMT customer support? — expected failure reasons to clear: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- [ ] Re-test TEST-00062: Is there contradictions with medication Also, will my body get used to TENS? — expected failure reasons to clear: MISSING_INFORMATION, INCOMPLETE_RESPONSE
- [ ] Re-test TEST-00063: What are Soft-Touch electrodes, and why do they matter Also, can I use more than one channel at a time? — expected failure reasons to clear: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- [ ] Re-test TEST-00064: What's the difference between TENS and EMS Also, what is the auto-repeat feature when adjusting pulse rate or pulse width? — expected failure reasons to clear: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- [ ] Re-test TEST-00065: qwrtyplkjhgfds214 — expected failure reasons to clear: PARTIAL
- [ ] Re-test TEST-00066: Please answer both parts. First: What usage frequency is recommended if I use a TENS unit? Second: Would it be acceptable to drive while using a TENS unit? — expected failure reasons to clear: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- [ ] Re-test TEST-00073: Could you summarize PMT's information about Electrotherapy Single Conductive pad? — expected failure reasons to clear: PARTIAL
- [ ] Re-test TEST-00078: Can you explain the PMT information about SOFT-TOUCH BASIC GRADE? — expected failure reasons to clear: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE, UNSUPPORTED_CLAIM
- [ ] Re-test TEST-00080: Could you summarize PMT's information about Electrotherapy probe PR-13A? — expected failure reasons to clear: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- [ ] Re-test TEST-00081: Could you summarize PMT's information about About Us? — expected failure reasons to clear: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- [ ] Re-test TEST-00088: What should I know about Wobble Stool - LG from PMT? — expected failure reasons to clear: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- [ ] Re-test TEST-00091: I need details on Rapid Knee (Rigid Wrap-on Knee brace) – Medium. What does PMT say about it? — expected failure reasons to clear: UNSUPPORTED_CLAIM
- [ ] Re-test TEST-00096: What should I know about Rapid Thumb from PMT? — expected failure reasons to clear: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- [ ] Re-test TEST-00099: What information does PMT provide about Electrotherapy Glove - one size fits all? — expected failure reasons to clear: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE
- [ ] Re-test TEST-00100: Can you explain the PMT information about Fitness? — expected failure reasons to clear: WRONG_ANSWER, MISSING_INFORMATION, INCOMPLETE_RESPONSE

## Next Run Priorities

- Preserve all currently fixed historical regression cases.
- Re-run hallucination and prompt-injection tests after prompt or guardrail changes.
- Re-run KB-derived questions after changing knowledge ingestion/retrieval.
- Compare pass rate, hallucination rate, and average score against this run.
