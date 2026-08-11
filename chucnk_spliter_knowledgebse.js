const text = $json.content;

// Primary strategy: split by double newlines or headers to preserve context
// Fallback: character-based split with overlap
const chunkSize = 1500; 
const overlap = 200;     

let chunks = [];

// Split by sections if possible
const sections = text.split(/\n{2,}/);

let currentChunk = "";

for (const section of sections) {
  if (currentChunk.length + section.length < chunkSize) {
    currentChunk += (currentChunk ? "\n\n" : "") + section;
  } else {
    if (currentChunk) {
      chunks.push({ json: { content: currentChunk.trim() } });
    }
    // If a single section is too big, character split it
    if (section.length > chunkSize) {
      for (let i = 0; i < section.length; i += chunkSize - overlap) {
        chunks.push({ json: { content: section.substring(i, i + chunkSize).trim() } });
      }
      currentChunk = "";
    } else {
      currentChunk = section;
    }
  }
}

if (currentChunk) {
  chunks.push({ json: { content: currentChunk.trim() } });
}

return chunks;

return chunks;
