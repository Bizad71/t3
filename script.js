'use strict';

const form = document.getElementById('wordForm');
const input = document.getElementById('wordInput');
const goButton = document.getElementById('goButton');
const statusEl = document.getElementById('status');
const result = document.getElementById('result');
const englishMeaning = document.getElementById('englishMeaning');
const englishSentence = document.getElementById('englishSentence');
const persianSentence = document.getElementById('persianSentence');
const meaningSpeak = document.getElementById('meaningSpeak');
const imageLink = document.getElementById('imageLink');
const wordImage = document.getElementById('wordImage');
const imageCaption = document.getElementById('imageCaption');

let requestNumber = 0;
let sentenceIndex = 0;
let imageIndexByWord = new Map();
let currentEnglishWord = '';
let currentPersianWord = '';

// Each sentence has a matching Persian translation, so the highlighted word
// stays correct without relying on a second, potentially inconsistent translation.
const sentenceTemplates = [
  { en: w => `I wrote the word “${w}” in my notebook today.`, fa: w => `امروز کلمهٔ «${w}» را در دفترم نوشتم.` },
  { en: w => `I am learning how to use the word “${w}”.`, fa: w => `دارم یاد می‌گیرم چطور از کلمهٔ «${w}» استفاده کنم.` },
  { en: w => `Can you say the word “${w}” slowly, please?`, fa: w => `می‌توانی لطفاً کلمهٔ «${w}» را آهسته بگویی؟` },
  { en: w => `I heard the word “${w}” in an English lesson.`, fa: w => `کلمهٔ «${w}» را در یک درس انگلیسی شنیدم.` },
  { en: w => `Today, I want to remember the word “${w}”.`, fa: w => `امروز می‌خواهم کلمهٔ «${w}» را به خاطر بسپارم.` },
  { en: w => `She asked me to spell the word “${w}”.`, fa: w => `او از من خواست کلمهٔ «${w}» را هجی کنم.` },
  { en: w => `I practiced saying the word “${w}” three times.`, fa: w => `تلفظ کلمهٔ «${w}» را سه بار تمرین کردم.` },
  { en: w => `I found the word “${w}” in my English book.`, fa: w => `کلمهٔ «${w}» را در کتاب انگلیسی‌ام پیدا کردم.` }
];

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

function normalizeEnglish(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

async function translatePersianToEnglish(word) {
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', word);
  url.searchParams.set('langpair', 'fa|en');
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error('translation-http');
  const data = await response.json();
  const translated = normalizeEnglish(data?.responseData?.translatedText);
  const match = Number(data?.responseStatus) === 200 && translated && !/^NO QUERY/i.test(translated);
  if (!match || /MYMEMORY WARNING|PLEASE SELECT/i.test(translated)) throw new Error('translation-empty');
  return translated.replace(/[<>]/g, '').slice(0, 100);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function appendClickableEnglishText(parent, text, highlighted = false) {
  const pieces = text.match(/\s+|[^\s]+/g) || [text];
  for (const piece of pieces) {
    if (/^\s+$/.test(piece)) {
      parent.append(document.createTextNode(piece));
      continue;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = highlighted ? 'word-token target' : 'word-token';
    button.textContent = piece;
    button.lang = 'en';
    button.addEventListener('click', () => speak(piece.replace(/^[^A-Za-z]+|[^A-Za-z'-]+$/g, '')));
    button.setAttribute('aria-label', `تلفظ ${piece}`);
    parent.append(button);
  }
}

function renderEnglishSentence(sentence, target) {
  englishSentence.replaceChildren();
  // Highlight the whole translated phrase, including multi-word meanings.
  const lowerSentence = sentence.toLocaleLowerCase();
  const lowerTarget = target.toLocaleLowerCase();
  const start = lowerSentence.indexOf(lowerTarget);
  if (start < 0) {
    appendClickableEnglishText(englishSentence, sentence);
    return;
  }
  appendClickableEnglishText(englishSentence, sentence.slice(0, start));
  appendClickableEnglishText(englishSentence, sentence.slice(start, start + target.length), true);
  appendClickableEnglishText(englishSentence, sentence.slice(start + target.length));
}

function renderPersianSentence(sentence, target) {
  persianSentence.replaceChildren();
  const idx = sentence.indexOf(target);
  if (idx < 0) {
    persianSentence.textContent = sentence;
    return;
  }
  persianSentence.append(document.createTextNode(sentence.slice(0, idx)));
  const mark = document.createElement('span');
  mark.className = 'persian-target';
  mark.textContent = target;
  persianSentence.append(mark, document.createTextNode(sentence.slice(idx + target.length)));
}

function speak(text) {
  const clean = normalizeEnglish(text);
  if (!clean || !('speechSynthesis' in window)) {
    setStatus('قابلیت تلفظ در این مرورگر در دسترس نیست.', 'error');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = 'en-US';
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

async function findRelevantImage(englishWord, token) {
  imageLink.hidden = true;
  wordImage.removeAttribute('src');
  imageCaption.textContent = 'در حال جست‌وجوی تصویر مرتبط…';
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', englishWord);
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrlimit', '12');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|mime|extmetadata');
  url.searchParams.set('iiurlwidth', '900');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error('image-http');
  const data = await response.json();
  const pages = Object.values(data?.query?.pages || {}).filter(page => {
    const info = page?.imageinfo?.[0];
    return info && /^image\/(jpeg|png|webp|gif)$/i.test(info.mime || '') && (info.thumburl || info.url);
  });
  if (!pages.length) throw new Error('image-empty');
  const key = englishWord.toLocaleLowerCase();
  const previous = imageIndexByWord.get(key) || 0;
  const chosenIndex = pages.length > 1 ? previous % pages.length : 0;
  imageIndexByWord.set(key, previous + 1);
  const page = pages[chosenIndex];
  const info = page.imageinfo[0];
  const imageUrl = info.thumburl || info.url;
  // Ignore stale responses if the user has already submitted another word.
  if (token !== requestNumber) return;
  wordImage.onload = () => {
    if (token !== requestNumber) return;
    imageLink.href = info.descriptionurl || info.url;
    imageLink.hidden = false;
    imageCaption.textContent = `منبع تصویر: Wikimedia Commons — ${page.title.replace(/^File:/, '')}`;
  };
  wordImage.onerror = () => {
    if (token === requestNumber) imageCaption.textContent = 'بارگذاری تصویر انجام نشد؛ اتصال اینترنت را بررسی کن.';
  };
  wordImage.src = imageUrl;
  wordImage.alt = `تصویر مرتبط با ${currentPersianWord} (${englishWord})`;
}

async function handleSubmit(event) {
  event.preventDefault();
  const persianWord = input.value.trim();
  if (!persianWord) {
    setStatus('اول یک کلمهٔ فارسی وارد کن.', 'error');
    input.focus();
    return;
  }
  const token = ++requestNumber;
  currentPersianWord = persianWord;
  goButton.disabled = true;
  goButton.textContent = '…';
  result.hidden = true;
  setStatus('در حال پیدا کردن معنی انگلیسی…');
  try {
    const englishWord = await translatePersianToEnglish(persianWord);
    if (token !== requestNumber) return;
    currentEnglishWord = englishWord;
    englishMeaning.textContent = englishWord;
    const template = sentenceTemplates[sentenceIndex % sentenceTemplates.length];
    sentenceIndex += 1;
    renderEnglishSentence(template.en(englishWord), englishWord);
    renderPersianSentence(template.fa(persianWord), persianWord);
    result.hidden = false;
    setStatus('آماده است. برای شنیدن تلفظ، روی هر کلمهٔ انگلیسی بزن.', 'success');
    try {
      await findRelevantImage(englishWord, token);
    } catch (imageError) {
      if (token === requestNumber) imageCaption.textContent = 'تصویر پیدا نشد. ممکن است سرویس تصویر موقتاً در دسترس نباشد.';
    }
  } catch (error) {
    if (token !== requestNumber) return;
    console.error('Word lookup failed:', error);
    setStatus('معنی پیدا نشد. املای کلمه را بررسی کن یا کمی بعد دوباره تلاش کن.', 'error');
  } finally {
    if (token === requestNumber) {
      goButton.disabled = false;
      goButton.innerHTML = 'برو <span aria-hidden="true">←</span>';
    }
  }
}

form.addEventListener('submit', handleSubmit);
meaningSpeak.addEventListener('click', () => speak(currentEnglishWord));
