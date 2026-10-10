'use strict';

const $ = (id) => document.getElementById(id);
const form = $('wordForm');
const input = $('wordInput');
const goButton = $('goButton');
const statusBox = $('status');
const result = $('result');
let requestNumber = 0;
let exampleOffset = new Map();
let lastSentence = '';
let currentWord = '';

function setStatus(message, type = '') {
  statusBox.textContent = message;
  statusBox.className = `status${type ? ` ${type}` : ''}`;
}

async function fetchJson(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightTarget(sentence, word) {
  const safeWord = escapeRegExp(word.trim());
  if (!safeWord) return sentence;
  return sentence.replace(new RegExp(`(^|[^A-Za-z])(${safeWord})(?=$|[^A-Za-z])`, 'ig'), (match, before, found) => `${before}[[[${found}]]]`);
}

function renderClickableSentence(container, sentence, target) {
  container.replaceChildren();
  const marked = highlightTarget(sentence, target);
  const pieces = marked.split(/(\[\[\[[\s\S]*?\]\]\])/g).filter(Boolean);
  for (const piece of pieces) {
    const isTarget = piece.startsWith('[[[') && piece.endsWith(']]]');
    const plain = isTarget ? piece.slice(3, -3) : piece;
    // Preserve punctuation and spaces while making each word independently playable.
    const tokens = plain.split(/([A-Za-z]+(?:['’-][A-Za-z]+)*)/g);
    for (const token of tokens) {
      if (/^[A-Za-z]+(?:['’-][A-Za-z]+)*$/.test(token)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `tap-word${isTarget ? ' target-word' : ''}`;
        button.textContent = token;
        button.setAttribute('aria-label', `تلفظ ${token}`);
        button.addEventListener('click', () => speak(token));
        container.append(button);
      } else if (token) {
        container.append(document.createTextNode(token));
      }
    }
  }
}

function speak(text) {
  if (!('speechSynthesis' in window)) {
    setStatus('پخش تلفظ در این مرورگر پشتیبانی نمی‌شود.', 'error');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.88;
  window.speechSynthesis.speak(utterance);
}

async function translateToPersian(text) {
  if (!text || !text.trim()) return 'ترجمه‌ای در دسترس نیست.';
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 450))}&langpair=en%7Cfa`;
  try {
    const data = await fetchJson(url, 9000);
    const translated = data?.responseData?.translatedText;
    if (typeof translated === 'string' && translated.trim() && data?.responseStatus === 200) {
      return decodeHtml(translated.trim());
    }
  } catch (_) { /* Use a friendly fallback below. */ }
  return 'ترجمه آنلاین فعلاً در دسترس نیست؛ کمی بعد دوباره امتحان کن.';
}

function decodeHtml(text) {
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

async function getDictionaryEntry(word) {
  const data = await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (!Array.isArray(data) || !data.length) throw new Error('برای این کلمه نتیجه‌ای پیدا نشد.');
  const entries = data;
  const meanings = entries.flatMap(entry => (entry.meanings || []).map(meaning => ({
    partOfSpeech: meaning.partOfSpeech || '',
    definitions: (meaning.definitions || []).filter(d => d && d.definition),
    phonetic: entry.phonetic || (entry.phonetics || []).find(p => p.text)?.text || ''
  })));
  const usable = meanings.find(m => m.definitions.length) || meanings[0];
  if (!usable || !usable.definitions.length) throw new Error('معنی قابل نمایش برای این کلمه پیدا نشد.');
  const allExamples = meanings.flatMap(m => m.definitions.map(d => d.example).filter(Boolean));
  return { meaning: usable.definitions[0].definition, partOfSpeech: usable.partOfSpeech, phonetic: usable.phonetic, examples: allExamples };
}

function fallbackSentence(word, count) {
  const templates = [
    `I want to learn how to use the word ${word} correctly.`,
    `Today, I wrote the word ${word} in my notebook.`,
    `Can you help me understand the word ${word}?`,
    `I heard someone use the word ${word} in a conversation.`,
    `I will practice the word ${word} again tomorrow.`,
    `The word ${word} is part of my English practice today.`
  ];
  let index = count % templates.length;
  let sentence = templates[index];
  if (sentence === lastSentence) sentence = templates[(index + 1) % templates.length];
  return sentence;
}

function chooseSentence(examples, word) {
  const key = word.toLowerCase();
  const offset = exampleOffset.get(key) || 0;
  const validExamples = examples.filter(example => typeof example === 'string' && example.trim().length > 3 && example.length < 220);
  let sentence = validExamples.length ? validExamples[offset % validExamples.length] : fallbackSentence(word, offset);
  if (sentence === lastSentence) sentence = validExamples.length > 1 ? validExamples[(offset + 1) % validExamples.length] : fallbackSentence(word, offset + 1);
  exampleOffset.set(key, offset + 1);
  lastSentence = sentence;
  return sentence;
}

async function findImage(word, thisRequest) {
  const wrap = $('imageWrap');
  $('imageCaption').textContent = '';
  wrap.replaceChildren();
  const placeholder = document.createElement('div');
  placeholder.className = 'image-placeholder';
  placeholder.textContent = 'در حال جست‌وجوی عکس…';
  wrap.append(placeholder);
  try {
    const query = `filetype:bitmap ${word}`;
    const api = new URL('https://commons.wikimedia.org/w/api.php');
    api.search = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: query, gsrnamespace: '6', gsrlimit: '12', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '1000', format: 'json', origin: '*' }).toString();
    const data = await fetchJson(api.toString(), 12000);
    if (thisRequest !== requestNumber) return;
    const pages = Object.values(data?.query?.pages || {}).filter(page => {
      const info = page.imageinfo?.[0];
      const url = info?.thumburl || info?.url || '';
      return /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url) && !/\.svg(\?|$)/i.test(url);
    });
    if (!pages.length) throw new Error('No images');
    const page = pages[Math.floor(Math.random() * Math.min(pages.length, 8))];
    const info = page.imageinfo[0];
    const img = document.createElement('img');
    img.alt = `تصویر مرتبط با ${word}`;
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.src = info.thumburl || info.url;
    img.addEventListener('error', () => {
      if (thisRequest === requestNumber) {
        wrap.replaceChildren();
        const fallback = document.createElement('div');
        fallback.className = 'image-placeholder';
        fallback.textContent = 'بارگذاری عکس ناموفق بود. دوباره GO را بزن.';
        wrap.append(fallback);
      }
    }, { once: true });
    wrap.replaceChildren(img);
    $('imageCaption').textContent = page.title.replace(/^File:/, '').replace(/_/g, ' ');
  } catch (_) {
    if (thisRequest !== requestNumber) return;
    wrap.replaceChildren();
    const fallback = document.createElement('div');
    fallback.className = 'image-placeholder';
    fallback.textContent = 'فعلاً عکسی پیدا نشد. اتصال اینترنت را بررسی کن و دوباره GO را بزن.';
    wrap.append(fallback);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const word = input.value.trim().replace(/\s+/g, ' ');
  if (!word) {
    setStatus('اول یک کلمه وارد کن.', 'error');
    input.focus();
    return;
  }
  if (!/^[A-Za-z][A-Za-z'’-]*$/.test(word)) {
    setStatus('لطفاً یک کلمه انگلیسی وارد کن؛ بدون فاصله یا عدد.', 'error');
    input.focus();
    return;
  }
  const thisRequest = ++requestNumber;
  currentWord = word;
  goButton.disabled = true;
  goButton.textContent = '…';
  result.hidden = false;
  $('wordTitle').textContent = word;
  $('meaning').textContent = 'در حال دریافت معنی…';
  $('definition').textContent = '';
  $('sentence').textContent = 'در حال آماده‌سازی جمله…';
  $('sentenceMeaning').textContent = 'در حال ترجمه…';
  $('imageWrap').replaceChildren();
  setStatus('در حال جست‌وجوی معنی، جمله و تصویر…');
  try {
    const entry = await getDictionaryEntry(word);
    if (thisRequest !== requestNumber) return;
    $('meaning').textContent = await translateToPersian(entry.meaning);
    if (thisRequest !== requestNumber) return;
    $('definition').textContent = `${entry.partOfSpeech ? `${entry.partOfSpeech} · ` : ''}${entry.meaning}`;
    const sentence = chooseSentence(entry.examples, word);
    renderClickableSentence($('sentence'), sentence, word);
    $('sentenceMeaning').textContent = await translateToPersian(sentence);
    if (thisRequest !== requestNumber) return;
    $('wordSound').onclick = () => speak(currentWord);
    $('sentenceSound').onclick = () => speak(sentence);
    setStatus('آماده است. برای شنیدن تلفظ، روی کلمه‌های انگلیسی بزن.');
    findImage(word, thisRequest);
  } catch (error) {
    if (thisRequest !== requestNumber) return;
    $('meaning').textContent = 'معنی این کلمه پیدا نشد.';
    $('definition').textContent = '';
    $('sentence').textContent = '';
    $('sentenceMeaning').textContent = 'برای نمایش جمله، کلمه را بررسی کن و دوباره تلاش کن.';
    $('imageWrap').replaceChildren();
    const fallback = document.createElement('div');
    fallback.className = 'image-placeholder';
    fallback.textContent = 'پس از پیدا شدن کلمه، عکس مرتبط اینجا نمایش داده می‌شود.';
    $('imageWrap').append(fallback);
    setStatus(error.name === 'AbortError' ? 'پاسخ سرویس دیر شد؛ دوباره GO را بزن.' : 'نتیجه‌ای پیدا نشد یا سرویس موقتاً در دسترس نیست. املای کلمه و اینترنت را بررسی کن.', 'error');
  } finally {
    if (thisRequest === requestNumber) {
      goButton.disabled = false;
      goButton.innerHTML = 'GO <span aria-hidden="true">↗</span>';
    }
  }
});
