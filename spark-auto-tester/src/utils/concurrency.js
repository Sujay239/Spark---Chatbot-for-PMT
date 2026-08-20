const sleep = ms => new Promise(r=>setTimeout(r,ms));
export async function mapControlled(items, worker, { concurrency=3, delayMs=0, requestsPerSecond=0 }={}) {
  const out=new Array(items.length); let next=0; let lastStart=0;
  const minGap=requestsPerSecond>0 ? Math.ceil(1000/requestsPerSecond) : 0;
  let lock=Promise.resolve();
  async function takeSlot() {
    let release; const prev=lock; lock=new Promise(r=>release=r); await prev;
    const wait=Math.max(0, Math.max(delayMs,minGap) - (Date.now()-lastStart)); if (wait) await sleep(wait);
    lastStart=Date.now(); release();
  }
  async function runner() {
    while (true) {
      const i=next++; if (i>=items.length) return;
      await takeSlot();
      try { out[i]=await worker(items[i],i); } catch (error) { out[i]={ error }; }
    }
  }
  await Promise.all(Array.from({length:Math.max(1,concurrency)},runner)); return out;
}
export { sleep };
