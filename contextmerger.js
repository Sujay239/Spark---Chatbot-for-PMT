const items = $input.all();
let combinedAnswer = items
  .map((item, index) => {
    const text = item.json.answer || item.json.content || item.json.text || "";
    if (!text.trim()) return null;
    return `[${index + 1}] ${text}`;
  })
  .filter((t) => t !== null)
  .join("\n\n");

let userQuestion = "";
try {
  userQuestion = $("Edit Fields").first().json.question;
} catch (e) {
  // Gracefully fallback if Edit Fields is not available
  userQuestion = items[0]?.json?.question || "";
}

return [
  {
    json: {
      question: userQuestion,
      context: combinedAnswer,
    },
  },
];
