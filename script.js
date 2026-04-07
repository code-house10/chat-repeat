const video = document.getElementById("learningVideo");
const subtitleOverlay = document.getElementById("subtitleOverlay");

const currentEnglishEl = document.getElementById("currentEnglish");
const currentArabicEl = document.getElementById("currentArabic");
const cueStartTimeEl = document.getElementById("cueStartTime");
const cueEndTimeEl = document.getElementById("cueEndTime");
const repeatProgressEl = document.getElementById("repeatProgress");

const repeatCountSelect = document.getElementById("repeatCount");
const playbackRateSelect = document.getElementById("playbackRate");
const autoRepeatToggle = document.getElementById("autoRepeatToggle");
const showArabicToggle = document.getElementById("showArabicToggle");
const shadowingToggle = document.getElementById("shadowingToggle");

const prevSubtitleBtn = document.getElementById("prevSubtitleBtn");
const replaySubtitleBtn = document.getElementById("replaySubtitleBtn");
const nextSubtitleBtn = document.getElementById("nextSubtitleBtn");
const saveSubtitleBtn = document.getElementById("saveSubtitleBtn");
const markDifficultBtn = document.getElementById("markDifficultBtn");
const clearSavedBtn = document.getElementById("clearSavedBtn");

const savedListEl = document.getElementById("savedList");
const savedCountStatEl = document.getElementById("savedCountStat");
const difficultCountStatEl = document.getElementById("difficultCountStat");
const practiceModeStatEl = document.getElementById("practiceModeStat");

const scrollToPlayerBtn = document.getElementById("scrollToPlayerBtn");
const scrollToSavedBtn = document.getElementById("scrollToSavedBtn");

const videoFileInput = document.getElementById("videoFileInput");
const subtitleFileInput = document.getElementById("subtitleFileInput");
const videoUrlInput = document.getElementById("videoUrlInput");
const loadVideoUrlBtn = document.getElementById("loadVideoUrlBtn");

const STORAGE_KEY = "movieEnglishTrainerSavedSubtitles";

let subtitles = [];
let currentCueIndex = -1;
let currentCue = null;
let repeatCycleCount = 0;
let repeatTarget = Number(repeatCountSelect.value);
let isRepeating = false;

const arabicDictionary = {
  "how are you?": "إزيك؟ / عامل إيه؟",
  "i'm fine.": "أنا بخير.",
  "are you serious?": "إنت بتتكلم بجد؟",
  "you've got to be kidding me.": "إنت أكيد بتهزر / مستحيل بجد.",
  "come on!": "يلا بقى / بلاش كده.",
  "let's go.": "يلا بينا.",
  "what are you doing?": "إنت بتعمل إيه؟",
  "i don't know.": "أنا مش عارف.",
  "thank you.": "شكرًا ليك.",
  "see you later.": "أشوفك بعدين."
};

function normalizeText(text) {
  return (text || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getArabicTranslation(text) {
  const clean = normalizeText(text);
  if (!clean) return "لا توجد ترجمة.";
  return arabicDictionary[clean.toLowerCase()] || `ترجمة سياقية تقريبية: ${clean}`;
}

function updateCueDisplay(cue) {
  if (!cue) {
    subtitleOverlay.textContent = "Waiting for subtitle...";
    currentEnglishEl.textContent = "Waiting for subtitle...";
    currentArabicEl.textContent = "الترجمة العربية ستظهر هنا";
    cueStartTimeEl.textContent = "--:--";
    cueEndTimeEl.textContent = "--:--";
    return;
  }

  const english = normalizeText(cue.text);
  const arabic = getArabicTranslation(english);

  subtitleOverlay.textContent = english;
  currentEnglishEl.textContent = english;
  currentArabicEl.textContent = showArabicToggle.checked ? arabic : "Arabic translation hidden";
  cueStartTimeEl.textContent = formatTime(cue.start);
  cueEndTimeEl.textContent = formatTime(cue.end);
}

function parseTimestampToSeconds(timeString) {
  const clean = timeString.replace(",", ".").trim();
  const parts = clean.split(":");
  if (parts.length !== 3) return 0;

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  const seconds = Number(parts[2]);

  return (hours * 3600) + (minutes * 60) + seconds;
}

function parseSrt(text) {
  const normalized = text.replace(/\r/g, "").trim();
  const blocks = normalized.split(/\n\s*\n/);
  const result = [];

  for (const block of blocks) {
    const lines = block.split("\n").map(line => line.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    let timeLineIndex = 0;
    if (/^\d+$/.test(lines[0])) {
      timeLineIndex = 1;
    }

    const timeLine = lines[timeLineIndex];
    if (!timeLine || !timeLine.includes("-->")) continue;

    const [startRaw, endRaw] = timeLine.split("-->").map(v => v.trim());
    const cueText = lines.slice(timeLineIndex + 1).join(" ");

    result.push({
      start: parseTimestampToSeconds(startRaw),
      end: parseTimestampToSeconds(endRaw),
      text: cueText
    });
  }

  return result;
}

function parseVtt(text) {
  const normalized = text.replace(/\r/g, "").replace(/^WEBVTT\s*/i, "").trim();
  const blocks = normalized.split(/\n\s*\n/);
  const result = [];

  for (const block of blocks) {
    const lines = block.split("\n").map(line => line.trim()).filter(Boolean);
    if (!lines.length) continue;

    let timeLineIndex = 0;
    if (!lines[0].includes("-->") && lines[1] && lines[1].includes("-->")) {
      timeLineIndex = 1;
    }

    const timeLine = lines[timeLineIndex];
    if (!timeLine || !timeLine.includes("-->")) continue;

    const [startRaw, endRaw] = timeLine.split("-->").map(v => v.trim().split(" ")[0]);
    const cueText = lines.slice(timeLineIndex + 1).join(" ");

    result.push({
      start: parseTimestampToSeconds(startRaw),
      end: parseTimestampToSeconds(endRaw),
      text: cueText
    });
  }

  return result;
}

function loadSubtitleText(text, extension) {
  if (extension === "srt") {
    subtitles = parseSrt(text);
  } else {
    subtitles = parseVtt(text);
  }

  currentCueIndex = -1;
  currentCue = null;
  repeatCycleCount = 0;
  repeatProgressEl.textContent = "0";
  updateCueDisplay(null);

  alert(`Subtitle loaded. Cues found: ${subtitles.length}`);
}

function findCurrentCueIndex(currentTime) {
  for (let i = 0; i < subtitles.length; i++) {
    const cue = subtitles[i];
    if (currentTime >= cue.start && currentTime <= cue.end) {
      return i;
    }
  }
  return -1;
}

function handleTimeUpdate() {
  if (!subtitles.length) return;

  const time = video.currentTime;
  const newIndex = findCurrentCueIndex(time);

  if (newIndex === -1) {
    return;
  }

  const cue = subtitles[newIndex];

  if (newIndex !== currentCueIndex) {
    currentCueIndex = newIndex;
    currentCue = cue;
    repeatCycleCount = 0;
    repeatProgressEl.textContent = "0";
    isRepeating = false;
    updateCueDisplay(cue);
  }

  if (!autoRepeatToggle.checked || !currentCue) return;

  if (time >= currentCue.end - 0.05) {
    if (repeatCycleCount < repeatTarget - 1) {
      repeatCycleCount += 1;
      repeatProgressEl.textContent = String(repeatCycleCount);
      isRepeating = true;
      video.currentTime = currentCue.start + 0.01;
      video.play();
    } else if (isRepeating) {
      repeatProgressEl.textContent = String(repeatTarget);
      isRepeating = false;

      if (shadowingToggle.checked) {
        video.pause();
      }
    }
  }
}

function replayCurrentCue() {
  if (!currentCue) return;
  repeatCycleCount = 0;
  repeatProgressEl.textContent = "0";
  video.currentTime = currentCue.start + 0.01;
  video.play();
}

function goToCue(index) {
  if (!subtitles.length) return;

  const safeIndex = Math.max(0, Math.min(index, subtitles.length - 1));
  const cue = subtitles[safeIndex];

  currentCueIndex = safeIndex;
  currentCue = cue;
  repeatCycleCount = 0;
  repeatProgressEl.textContent = "0";
  updateCueDisplay(cue);

  video.currentTime = cue.start + 0.01;
  video.play();
}

function getSavedSubtitles() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function setSavedSubtitles(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function updateStats() {
  const items = getSavedSubtitles();
  savedCountStatEl.textContent = items.length;
  difficultCountStatEl.textContent = items.filter(item => item.isDifficult).length;
  practiceModeStatEl.textContent = "Direct Video";
}

function renderSavedSubtitles() {
  const items = getSavedSubtitles();

  if (!items.length) {
    savedListEl.innerHTML = `<div class="empty-state">No saved subtitles yet.</div>`;
    updateStats();
    return;
  }

  savedListEl.innerHTML = items.map(item => `
    <article class="saved-item">
      <div class="saved-item-top">
        <div>
          <p class="saved-english">${item.english}</p>
          <p class="saved-arabic">${item.arabic}</p>
          ${item.isDifficult ? `<span class="saved-flag">Difficult</span>` : ""}
        </div>
        <div class="saved-item-time">${formatTime(item.startTime)}</div>
      </div>

      <div class="saved-item-actions">
        <button class="secondary-btn" onclick="jumpToSavedCue(${item.startTime})">Replay</button>
        <button class="ghost-btn" onclick="removeSavedSubtitle('${item.id}')">Delete</button>
      </div>
    </article>
  `).join("");

  updateStats();
}

function saveCurrentSubtitle(isDifficult = false) {
  if (!currentCue) {
    alert("No active subtitle to save.");
    return;
  }

  const english = normalizeText(currentCue.text);
  const arabic = getArabicTranslation(english);

  const items = getSavedSubtitles();
  const exists = items.some(item =>
    item.english === english &&
    Math.abs(item.startTime - currentCue.start) < 0.05
  );

  if (exists) {
    alert("This subtitle is already saved.");
    return;
  }

  items.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    english,
    arabic,
    startTime: currentCue.start,
    endTime: currentCue.end,
    isDifficult
  });

  setSavedSubtitles(items);
  renderSavedSubtitles();
}

function removeSavedSubtitle(id) {
  const items = getSavedSubtitles().filter(item => item.id !== id);
  setSavedSubtitles(items);
  renderSavedSubtitles();
}

function jumpToSavedCue(startTime) {
  video.currentTime = startTime + 0.01;
  video.play();
}

window.removeSavedSubtitle = removeSavedSubtitle;
window.jumpToSavedCue = jumpToSavedCue;

function loadVideoFromUrl() {
  const url = videoUrlInput.value.trim();
  if (!url) {
    alert("Paste a direct video link first.");
    return;
  }

  video.src = url;
  video.load();
}

function init() {
  renderSavedSubtitles();
  updateCueDisplay(null);

  scrollToPlayerBtn.addEventListener("click", () => {
    document.getElementById("playerSection").scrollIntoView({ behavior: "smooth" });
  });

  scrollToSavedBtn.addEventListener("click", () => {
    document.getElementById("savedSection").scrollIntoView({ behavior: "smooth" });
  });

  playbackRateSelect.addEventListener("change", () => {
    video.playbackRate = Number(playbackRateSelect.value);
  });

  repeatCountSelect.addEventListener("change", () => {
    repeatTarget = Number(repeatCountSelect.value);
    repeatCycleCount = 0;
    repeatProgressEl.textContent = "0";
  });

  showArabicToggle.addEventListener("change", () => {
    updateCueDisplay(currentCue);
  });

  replaySubtitleBtn.addEventListener("click", replayCurrentCue);
  prevSubtitleBtn.addEventListener("click", () => goToCue(currentCueIndex - 1));
  nextSubtitleBtn.addEventListener("click", () => goToCue(currentCueIndex + 1));
  saveSubtitleBtn.addEventListener("click", () => saveCurrentSubtitle(false));
  markDifficultBtn.addEventListener("click", () => saveCurrentSubtitle(true));

  clearSavedBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    renderSavedSubtitles();
  });

  loadVideoUrlBtn.addEventListener("click", loadVideoFromUrl);

  video.addEventListener("loadedmetadata", () => {
    video.playbackRate = Number(playbackRateSelect.value);
  });

  video.addEventListener("timeupdate", handleTimeUpdate);

  videoFileInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    video.src = url;
    video.load();
  });

  subtitleFileInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const name = file.name.toLowerCase();
    const text = await file.text();

    if (name.endsWith(".srt")) {
      loadSubtitleText(text, "srt");
    } else if (name.endsWith(".vtt")) {
      loadSubtitleText(text, "vtt");
    } else {
      alert("Use .srt or .vtt subtitle file.");
    }
  });

  updateStats();
}

init();