const qaData = [
  {
    "question": "How do I set up the Ultima 5?",
    "answer":
      "Setting up your Ultima 5 is quick and easy: 1. Install the batteries: Insert the two charged AA batteries into the battery compartment, following the +/– markings, and replace the cover. 2. Connect the lead wires: Plug the L-shaped end of the lead wire into CH1 for two pads. If using four pads, connect both CH1 and CH2. 3. Connect the pads: Attach the pin ends of the lead wires to the electrode pads. 4. Place the pads: Make sure your skin is clean and dry. Remove the pads from their plastic backing and place them around the treatment area as directed. Pads from the same channel should not touch and should be no more than 6 inches apart. 5. Turn on the unit: Press and hold the Power button for about 3 seconds. The screen will light up and the intensity will start at zero. 6. Set your treatment: For the initial setup shown in the Ultima 5 Quick Start Guide, select 150 Hz pulse rate, 250 μs pulse width, 30–45 minutes, and the Asymmetrical Bi-Phasic Rectangular waveform. 7. Adjust the intensity: Slowly turn the intensity control for each active channel until the stimulation feels strong but comfortable. After treatment, turn the unit off before removing the pads. Place the pads back on their clear plastic backing and store them in the sealed bag. Tip: If you change the treatment mode, the Ultima 5 automatically resets the intensity to zero. Simply readjust it to a comfortable level.\n\nUseful Resources & Links:\n📘 [Ultima 5 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-5-User-Manual.pdf)\n🎥 [Ultima 5 Video Guide](https://www.youtube.com/watch?v=Evm1mGxXUMU)\n📄 [Tips on using Ultima 5 TENS](https://paintechnology.s3.us-east-1.amazonaws.com/pdf/Tips%20on%20using%20the%20Ultima%205%20TENS%20device.doc)",
  },
  {
    "question": "What do CH1 and CH2 mean on my Ultima 5?",
    "answer":
      "CH1 and CH2 are the Ultima 5's two stimulation channels. Each channel connects to one lead wire and can power two electrode pads. If you're using only two pads, connect the lead wire to CH1. If you're using four pads, connect one lead to CH1 and the other to CH2. Each channel has its own intensity control.",
  },
  {
    "question": "Can I use only two electrode pads with my Ultima 5?",
    "answer":
      "Yes. You can use the Ultima 5 with two pads. Connect one lead wire to CH1 and attach the two electrode pads to that lead. If you want to use four pads, connect a second lead wire to CH2. [Ultima 5 User Manual](https://paintechnology.s3.amazonaws.com/pdf/Ultima-5-User-Manual.pdf)",
  },
  {
    "question": "How do I change the waveform on my Ultima 5?",
    "answer":
      "Press the PR- and PW- buttons simultaneously to change the waveform. The Ultima 5 offers three waveform options. For your initial treatment, the Quick Start Guide recommends the Asymmetrical Bi-Phasic Rectangular waveform.",
  },
  {
    "question": "How do I set the treatment timer on my Ultima 5?",
    "answer":
      "Use the TIMER button to select your treatment time. Once the timer is set, it counts down in minutes. When it reaches zero, the Ultima 5 automatically stops the treatment.",
  },
  {
    "question": "Why don't I feel anything when I turn on my Ultima 5?",
    "answer":
      "This is usually normal. The Ultima 5 always starts with the stimulation intensity at zero. After turning it on and placing the pads correctly, slowly turn up the intensity knob for the active channel until you feel a strong but comfortable stimulation.",
  },
  {
    "question": "Why is CH1 or CH2 flashing on my Ultima 5?",
    "answer":
      "If Pad Contact Detection is enabled, a flashing CH1 or CH2 means the Ultima 5 has detected poor contact between the electrode pads and your skin on that channel. Check that the pads are firmly attached and that the lead wires are fully connected. If poor contact continues for 3 seconds, intensity drops to 60%. If poor contact lasts more than 30 seconds, intensity resets to zero.",
  },
  {
    "question": "How do I turn Pad Contact Detection on or off?",
    "answer":
      "Press and hold PR+ and MODE simultaneously to enable or disable Pad Contact Detection. The feature is disabled by default.",
  },
  {
    "question": "Why can't I change the intensity on my Ultima 5?",
    "answer":
      "Check whether the Lock function is active. When the Ultima 5 is locked, the current intensity is held and cannot be adjusted. With the unit on, briefly press the Power button to toggle Lock/Unlock, then try adjusting the intensity again.",
  },
  {
    "question": "Does the red light on the charger go out?",
    "answer":
      "The charger will consistently stay red. It will not change to green upon the full charge of the batteries.",
  },
  {
    "question": "How do you know when the batteries are charged?",
    "answer":
      "Our rechargable batteries work just like any other rechargable battery. You will typically want to charge these for 4-6 hours. ",
  },
  {
    "question": "What batteries can I use in the Ultima 5?",
    "answer":
      "The Ultima 5 can use two AA batteries. The manual permits 1.5V AA alkaline disposable batteries or 1.2V AA Ni-MH rechargeable batteries. Do not mix different battery types.",
  },
  {
    "question": "What should I do with the electrode pads after treatment?",
    "answer":
      "Turn the Ultima 5 off before removing the electrode pads. Carefully remove the pads from your skin, place them back on their clear plastic backing, and return them to their storage bag to help preserve the gel and adhesion.",
  },
  {
    "question": "What is interferential therapy?",
    "answer":
      'Interferential therapy, also called interferential current or IFC therapy, is a form of electrical stimulation commonly used for pain management. It uses two medium-frequency electrical currents that interact, or "interfere," with each other to create a therapeutic beat frequency in the treatment area. The IF4D can provide interferential therapy using either two electrodes or four electrodes.',
  },
  {
    "question": "What is the difference between interferential therapy and TENS?",
    "answer":
      "Both interferential therapy and TENS use electrical stimulation for pain management, but they deliver stimulation differently. TENS typically applies lower-frequency electrical pulses directly through the electrodes. Interferential therapy uses medium-frequency currents that interact to create a lower therapeutic beat frequency. The IF4D uses a 4000 Hz carrier frequency and can be used with either a 2-electrode bipolar setup or a 4-electrode quadripolar setup.",
  },
  {
    "question": "How long are interferential therapy sessions typically?",
    "answer":
      "The IF4D includes selectable 15- or 30-minute treatment timers. Your treatment time should follow the instructions provided by your healthcare professional or treatment plan.",
  },
  {
    "question": "What is criss-cross pad application for interferential therapy?",
    "answer":
      'Criss-cross pad application is a four-electrode placement used for interferential therapy. Four electrodes are positioned around the treatment area so the electrical currents from the two channels cross one another in an "X" pattern. The area where the two currents intersect becomes the targeted interferential treatment area. Electrode placement should follow your healthcare professional\'s instructions and the IF4D user guide.',
  },
  {
    "question": "What is the IF4D?",
    "answer":
      "The IF4D is a dual-channel digital interferential therapy device designed for electrical stimulation treatments. It can be used with either two electrodes in a bipolar configuration or four electrodes in a quadripolar configuration. It offers adjustable frequency settings, multiple frequency sweep and shift options, a symmetrical balanced sine-wave waveform, treatment timers, setting recall, and a settings lock.",
  },
  {
    "question": "Can I use two or four electrodes with the IF4D?",
    "answer":
      "Yes. The IF4D supports both bipolar treatment using two electrodes and quadripolar treatment using four electrodes. The appropriate configuration depends on your treatment plan and electrode placement instructions.",
  },
  {
    "question": "What treatment settings does the IF4D offer?",
    "answer":
      "The IF4D offers Constant, Auto Sweep, and Frequency Shift treatment modes. It has an adjustable interference frequency from 4-160 Hz, along with preset sweep ranges and multiple frequency-shift options. Use the settings recommended by your healthcare professional for your treatment.",
  },
  {
    "question": "What kind of waveform does the IF4D use?",
    "answer":
      "The IF4D uses a symmetrical balanced sine-wave waveform. Its interferential system uses a fixed 4000 Hz carrier frequency on one channel and an adjustable 4004-4160 Hz modulating frequency on the second channel.",
  },
  {
    "question": "What comes with the IF4D?",
    "answer":
      "The IF4D includes the interferential unit, four reusable self-adhering electrodes, lead wires, a 9-volt battery, AC wall adapter, carrying case, and instruction manual.",
  },
  {
    "question": "Can the IF4D run on batteries or wall power?",
    "answer":
      "Yes. The IF4D can operate using a 9-volt battery or the supplied AC wall adapter.",
  },
];

// n8n requires an array of objects with a 'json' property:
return qaData.map(item => ({
  json: item
}));

