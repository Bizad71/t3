/* WordSpark front end. Keep the AI key on the Worker, never in this file. */
const API_ENDPOINT = "PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE";
const form = document.getElementById("wordForm");
const input = document.getElementById("wordInput");
const goButton = document.getElementById("goButton");
const anotherButton = document.getElementById("anotherButton");
const statusBox = document.getElementById("status");
const result = document.getElementById("result");
const wordTitle = document.getElementById("wordTitle");
const wordMeaning = document.getElementById("wordMeaning");
const englishSentence = document.getElementById("englishSentence");
const sentenceMeaning = document.getElementById("sentenceMeaning");
const imageArea = document.getElementById("imageArea");
const imageCaption = document.getElementById("imageCaption");
let requestCounter = 0;

form.addEventListener("submit", (event) => {
  event.preventDefault();
  lookupWord(false);
});
anotherButton.addEventListener("click", () => lookupWord(true));

async function lookupWord(forceNew) {
  const word = input.value.trim();
  if (!word) {
    setStatus("اول یک کلمه وارد کن.", true);
    input.focus();
    return;
  }
  if (API_ENDPOINT.includes("PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE")) {
    setStatus("برای فعال شدن هوش مصنوعی، آدرس Worker را در فایل script.js وارد کن. راهنما در README است.", true);
    return;
  }

  const thisRequest = ++requestCounter;
  goButton.disabled = true;
  anotherButton.disabled = true;
  setStatus(forceNew ? "دارم یک مثال تازه می‌سازم…" : "دارم معنی و یک مثال تازه پیدا می‌کنم…");
  result.hidden = true;
  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, variation: cryptoRandomSeed(), forceNew })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `خطای سرور (${response.status})`);
    if (thisRequest !== requestCounter) return;
    if (!data.meaning_fa || !data.sentence_en || !data.sentence_fa) throw new Error("پاسخ هوش مصنوعی کامل نبود. دوباره امتحان کن.");

    wordTitle.textContent = data.word || word;
    wordMeaning.textContent = data.meaning_fa;
    sentenceMeaning.textContent = data.sentence_fa;
    renderClickableSentence(data.sentence_en, data.word || word);
    imageArea.innerHTML = '<p class="image-placeholder">در حال پیدا کردن تصویر مرتبط…</p>';
    imageCaption.textContent = "";
    result.hidden = false;
    setStatus("آماده است. روی کلمات انگلیسی بزن تا تلفظ شوند.");
    findImage(data.image_query || word, thisRequest);
  } catch (error) {
    if (thisRequest === requestCounter) setStatus(error.message || "ارتباط برقرار نشد. دوباره امتحان کن.", true);
  } finally {
    if (thisRequest === requestCounter) {
      goButton.disabled = false;
      anotherButton.disabled = false;
    }
  }
}

function renderClickableSentence(sentence, target) {
  englishSentence.replaceChildren();
  // Keep punctuation and whitespace as separate text nodes, while making each word clickable.
  const pieces = sentence.match(/[A-Za-z]+(?:['’][A-Za-z]+)*|[^A-Za-z]+/g) || [sentence];
  const normalizedTarget = target.toLocaleLowerCase().replace(/[^a-z'-]/g, "");
  for (const piece of pieces) {
    if (/^[A-Za-z]+(?:['’][A-Za-z]+)*$/.test(piece)) {
      const button = document.createElement("span");
      button.className = "word-token" + (piece.toLocaleLowerCase() === normalizedTarget ? " target-word" : "");
      button.textContent = piece;
      button.tabIndex = 0;
      button.setAttribute("role", "button");
      button.setAttribute("aria-label", `تلفظ ${piece}`);
      const speak = () => speakEnglish(piece);
      button.addEventListener("click", speak);
      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); speak(); }
      });
      englishSentence.appendChild(button);
    } else {
      englishSentence.appendChild(document.createTextNode(piece));
    }
  }
}

function speakEnglish(text) {
  if (!("speechSynthesis" in window)) {
    setStatus("مرورگر شما قابلیت پخش تلفظ را ندارد.", true);
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.86;
  window.speechSynthesis.speak(utterance);
}

async function findImage(query, requestId) {
  const cleaned = String(query || input.value).trim().slice(0, 100);
  const endpoint = new URL("https://commons.wikimedia.org/w/api.php");
  endpoint.search = new URLSearchParams({
    action: "query", format: "json", origin: "*", generator: "search",
    gsrsearch: `${cleaned} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "8",
    prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "1000"
  }).toString();
  try {
    const response = await fetch(endpoint.toString());
    if (!response.ok) throw new Error("Image search failed");
    const data = await response.json();
    if (requestId !== requestCounter) return;
    const pages = Object.values(data.query?.pages || {});
    const suitable = pages.find(page => {
      const info = page.imageinfo?.[0];
      const url = info?.thumburl || info?.url || "";
      return /^https:\/\//i.test(url) && !/\.svg(?:$|\?)/i.test(url) && !/\.pdf(?:$|\?)/i.test(url);
    });
    if (!suitable) {
      imageArea.innerHTML = '<p class="image-placeholder">تصویر مناسبی پیدا نشد. می‌تونی با کلمه دقیق‌تری دوباره جست‌وجو کنی.</p>';
      imageCaption.textContent = "تصاویر از Wikimedia Commons جست‌وجو می‌شوند.";
      return;
    }
    const info = suitable.imageinfo[0];
    const image = document.createElement("img");
    image.src = info.thumburl || info.url;
    image.alt = `تصویر مرتبط با ${cleaned}`;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.onerror = () => {
      imageArea.innerHTML = '<p class="image-placeholder">این تصویر بارگذاری نشد. دوباره جست‌وجو کن.</p>';
    };
    imageArea.replaceChildren(image);
    imageCaption.textContent = `منبع تصویر: Wikimedia Commons — ${suitable.title.replace(/^File:/, "")}`;
  } catch (_) {
    if (requestId === requestCounter) {
      imageArea.innerHTML = '<p class="image-placeholder">جست‌وجوی تصویر ناموفق بود. اتصال اینترنت را بررسی کن.</p>';
      imageCaption.textContent = "";
    }
  }
}

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
}
function cryptoRandomSeed() {
  try { return crypto.randomUUID(); } catch (_) { return `${Date.now()}-${Math.random()}`; }
}
