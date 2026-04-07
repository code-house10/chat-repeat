const video = document.getElementById("learningVideo");
const englishTrackElement = document.getElementById("englishTrack");

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
const sourceTypeSelect = document.getElementById("sourceType");
const loadVideoUrlBtn = document.getElementById("loadVideoUrlBtn");

const html5PlayerWrap = document.getElementById("html5PlayerWrap");
const youtubePlayerWrap = document.getElementById("youtubePlayerWrap");

const STORAGE_KEY = "movieEnglishTrainerSavedSubtitles";

let textTrack = null;
let cues = [];
let currentCue = null;
let currentCueIndex = -1;

let activeCueId = null;
let repeatCycleCount = 0;
let repeatTarget = Number(repeatCountSelect.value);
let isAutoRepeatingNow = false;
let shadowPauseTimeout = null;

let youtubePlayer = null;
let currentSourceMode = "direct";

const arabicDictionary = {
  "how are you?": "إزيك؟ / عامل إيه؟",
  "i'm fine.": "أنا بخير.",
  "are you serious?": "إنت بتتكلم بجد؟",
  "you've got to be kidding me.": "إنت أكيد بتهزر / مستحيل بجد.",
  "come on!": "يا عم بقى / هيا بقى / بلاش كده.",
  "let's go.": "يلا بينا.",
  "what are you doing?": "إنت بتعمل إيه؟",
  "i don't know.": "أنا مش عارف.",
  "thank you.": "شكرًا ليك.",
  "see you later.": "أشوفك بعدين.",
  "watch out!": "خلي بالك!",
  "hurry up!": "يلا بسرعة!",
  "leave me alone.": "سيبني لوحدي.",
  "that's enough.": "كفاية كده.",
  "i'm sorry.": "أنا آسف.",
  "it doesn't matter.": "مش مهم / مش فارقة.",
  "what's going on?": "إيه اللي بيحصل؟",
  "i can't believe it.": "مش مصدق ده.",
  "we need to talk.": "لازم نتكلم.",
  "it's not your fault.": "ده مش ذنبك."
};

function normalizeText(text) {
  return (text || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getArabicTranslation(englishText) {
  const clean = normalizeText(englishText);
  const lower = clean.toLowerCase();

  if (arabicDictionary[lower]) {
    return arabicDictionary[lower];
  }

  if (!clean) return "لا توجد ترجمة.";

  return `ترجمة سياقية تقريبية: ${clean}`;
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
  practiceModeStatEl.textContent = shadowingToggle.checked ? "Shadowing" : "Normal";
}

function renderSavedSubtitles() {
  const items = getSavedSubtitles();

  if (!items.length) {
    savedListEl.innerHTML = `
      <div class="empty-state">
        No saved subtitles yet. Start the video and click "Save Subtitle".
      </div>
    `;
    updateStats();
    return;
  }

  savedListEl.innerHTML = items
    .map((item) => {
      return `
        <article class="saved-item">
          <div class="saved-item-top">
            <div>
              <p class="saved-english">${escapeHTML(item.english)}</p>
              <p class="saved-arabic">${escapeHTML(item.arabic)}</p>
              ${item.isDifficult ? `<span class="saved-flag">Difficult</span>` : ""}
            </div>
            <div class="saved-item-time">${formatTime(item.startTime)}</div>
          </div>

          <div class="saved-item-actions">
            <button class="secondary-btn" onclick="jumpToSavedCue(${item.startTime}, ${item.endTime})">
              Replay
            </button>
            <button class="ghost-btn" onclick="removeSavedSubtitle('${item.id}')">
              Delete
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  updateStats();
}

function removeSavedSubtitle(id) {
  const items = getSavedSubtitles().filter((item) => item.id !== id);
  setSavedSubtitles(items);
  renderSavedSubtitles();
}

window.removeSavedSubtitle = removeSavedSubtitle;

function jumpToSavedCue(startTime, endTime) {
  if (currentSourceMode !== "direct") {
    alert("Replay by saved subtitle works best in direct video mode.");
    return;
  }

  video.currentTime = Math.max(0, startTime);
  video.play();

  setTimeout(() => {
    if (video.currentTime >= endTime) {
      video.pause();
    }
  }, Math.max(300, (endTime - startTime) * 1000));
}

window.jumpToSavedCue = jumpToSavedCue;

function saveCurrentSubtitle(isDifficult = false) {
  if (!currentCue) {
    alert("No active subtitle to save yet.");
    return;
  }

  const english = normalizeText(currentCue.text);
  const arabic = getArabicTranslation(english);

  const items = getSavedSubtitles();

  const alreadyExists = items.some(
    (item) =>
      item.english === english &&
      Math.abs(item.startTime - currentCue.startTime) < 0.05
  );

  if (alreadyExists) {
    alert("This subtitle is already saved.");
    return;
  }

  items.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    english,
    arabic,
    startTime: currentCue.startTime,
    endTime: currentCue.endTime,
    isDifficult
  });

  setSavedSubtitles(items);
  renderSavedSubtitles();
}

function updateCueDisplay(cue) {
  const english = cue ? normalizeText(cue.text) : "Waiting for subtitle...";
  const arabic = cue ? getArabicTranslation(english) : "الترجمة العربية ستظهر هنا";

  currentEnglishEl.textContent = english;
  currentArabicEl.textContent = showArabicToggle.checked ? arabic : "Arabic translation hidden";
  cueStartTimeEl.textContent = cue ? formatTime(cue.startTime) : "--:--";
  cueEndTimeEl.textContent = cue ? formatTime(cue.endTime) : "--:--";
}

function resetRepeatStateForCue(cue) {
  if (!cue) return;
  activeCueId = `${cue.startTime}-${cue.endTime}-${normalizeText(cue.text)}`;
  repeatCycleCount = 0;
  repeatProgressEl.textContent = "0";
  isAutoRepeatingNow = false;
}

function handleCueChange(cue) {
  const cueId = cue ? `${cue.startTime}-${cue.endTime}-${normalizeText(cue.text)}` : null;

  if (!cue) {
    currentCue = null;
    currentCueIndex = -1;
    updateCueDisplay(null);
    return;
  }

  const isNewCue = cueId !== activeCueId;

  currentCue = cue;
  currentCueIndex = cues.findIndex(
    (item) =>
      item.startTime === cue.startTime &&
      item.endTime === cue.endTime &&
      normalizeText(item.text) === normalizeText(cue.text)
  );

  if (isNewCue) {
    resetRepeatStateForCue(cue);
  }

  updateCueDisplay(cue);
}

function replayCurrentCueManual() {
  if (currentSourceMode !== "direct") {
    alert("Current subtitle replay is available in direct video mode with subtitle cues.");
    return;
  }

  if (!currentCue) return;
  repeatCycleCount = 0;
  repeatProgressEl.textContent = "0";
  video.currentTime = Math.max(0, currentCue.startTime + 0.01);
  video.play();
}

function goToCueByIndex(index) {
  if (currentSourceMode !== "direct") {
    alert("Previous/next subtitle navigation works in direct video mode.");
    return;
  }

  if (!cues.length) return;
  const boundedIndex = Math.max(0, Math.min(index, cues.length - 1));
  const cue = cues[boundedIndex];
  currentCue = cue;
  currentCueIndex = boundedIndex;
  resetRepeatStateForCue(cue);
  updateCueDisplay(cue);
  video.currentTime = Math.max(0, cue.startTime + 0.01);
  video.play();
}

function setupTrack() {
  if (!video.textTracks || !video.textTracks.length) {
    console.warn("No text tracks found.");
    return;
  }

  textTrack = video.textTracks[0];
  textTrack.mode = "hidden";

  cues = Array.from(textTrack.cues || []);

  textTrack.oncuechange = () => {
    const activeCues = textTrack.activeCues;
    if (activeCues && activeCues.length > 0) {
      handleCueChange(activeCues[0]);
    }
  };
}

function handleAutoRepeatLogic() {
  if (currentSourceMode !== "direct") return;
  if (!currentCue || !autoRepeatToggle.checked) return;

  const epsilon = 0.06;
  const endedCurrentCue = video.currentTime >= currentCue.endTime - epsilon;

  if (!endedCurrentCue) return;

  repeatTarget = Number(repeatCountSelect.value);

  if (repeatCycleCount < repeatTarget - 1) {
    repeatCycleCount += 1;
    repeatProgressEl.textContent = String(repeatCycleCount);
    isAutoRepeatingNow = true;

    video.currentTime = Math.max(0, currentCue.startTime + 0.01);
    video.play();
    return;
  }

  if (repeatCycleCount >= repeatTarget - 1 && isAutoRepeatingNow) {
    repeatProgressEl.textContent = String(repeatTarget);
    isAutoRepeatingNow = false;

    if (shadowingToggle.checked) {
      clearTimeout(shadowPauseTimeout);
      shadowPauseTimeout = setTimeout(() => {
        video.pause();
      }, 180);
    }
  }
}

function isYouTubeUrl(url) {
  return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/i.test(url);
}

function isDirectVideoUrl(url) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
}

function extractYouTubeVideoId(url) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "").trim();
    }

    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.searchParams.get("v")) {
        return parsed.searchParams.get("v");
      }

      const parts = parsed.pathname.split("/");
      const embedIndex = parts.indexOf("embed");
      if (embedIndex !== -1 && parts[embedIndex + 1]) {
        return parts[embedIndex + 1];
      }
    }

    return null;
  } catch {
    return null;
  }
}

function setMode(mode) {
  currentSourceMode = mode;

  if (mode === "youtube") {
    html5PlayerWrap.classList.add("hidden");
    youtubePlayerWrap.classList.remove("hidden");
    video.pause();
    updateCueDisplay(null);
  } else {
    youtubePlayerWrap.classList.add("hidden");
    html5PlayerWrap.classList.remove("hidden");
  }
}

function loadDirectVideo(url) {
  setMode("direct");

  video.src = url;
  video.load();

  currentCue = null;
  currentCueIndex = -1;
  cues = [];
  updateCueDisplay(null);

  alert("Direct video loaded. For full subtitle learning features, also load a matching .vtt subtitle file.");
}

function createOrLoadYouTubePlayer(videoId) {
  setMode("youtube");

  if (!videoId) {
    alert("Invalid YouTube link.");
    return;
  }

  if (!window.YT || !window.YT.Player) {
    alert("YouTube API is not ready yet. Please try again.");
    return;
  }

  if (youtubePlayer && typeof youtubePlayer.loadVideoById === "function") {
    youtubePlayer.loadVideoById(videoId);
    return;
  }

  youtubePlayer = new YT.Player("youtubePlayer", {
    videoId,
    playerVars: {
      playsinline: 1,
      rel: 0
    },
    events: {
      onReady: () => {
        console.log("YouTube player ready");
      }
    }
  });
}

window.onYouTubeIframeAPIReady = function () {
  console.log("YouTube IFrame API is ready");
};

function loadVideoFromUrl() {
  const url = videoUrlInput.value.trim();
  const forcedType = sourceTypeSelect.value;

  if (!url) {
    alert("Please paste a video link first.");
    return;
  }

  let detectedType = forcedType;

  if (forcedType === "auto") {
    if (isYouTubeUrl(url)) {
      detectedType = "youtube";
    } else if (isDirectVideoUrl(url)) {
      detectedType = "direct";
    } else {
      detectedType = "unknown";
    }
  }

  if (detectedType === "youtube") {
    const videoId = extractYouTubeVideoId(url);
    createOrLoadYouTubePlayer(videoId);
    return;
  }

  if (detectedType === "direct") {
    loadDirectVideo(url);
    return;
  }

  alert("This link is not recognized as a YouTube link or a direct video file link like .mp4");
}

function initControls() {
  playbackRateSelect.addEventListener("change", () => {
    if (currentSourceMode === "direct") {
      video.playbackRate = Number(playbackRateSelect.value);
    }
  });

  repeatCountSelect.addEventListener("change", () => {
    repeatTarget = Number(repeatCountSelect.value);
    if (currentCue) {
      resetRepeatStateForCue(currentCue);
    }
  });

  showArabicToggle.addEventListener("change", () => {
    if (currentCue) {
      updateCueDisplay(currentCue);
    } else {
      updateCueDisplay(null);
    }
  });

  shadowingToggle.addEventListener("change", () => {
    updateStats();
  });

  replaySubtitleBtn.addEventListener("click", replayCurrentCueManual);
  prevSubtitleBtn.addEventListener("click", () => goToCueByIndex(currentCueIndex - 1));
  nextSubtitleBtn.addEventListener("click", () => goToCueByIndex(currentCueIndex + 1));

  saveSubtitleBtn.addEventListener("click", () => saveCurrentSubtitle(false));
  markDifficultBtn.addEventListener("click", () => saveCurrentSubtitle(true));

  clearSavedBtn.addEventListener("click", () => {
    const confirmed = confirm("Delete all saved subtitles?");
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    renderSavedSubtitles();
  });

  scrollToPlayerBtn.addEventListener("click", () => {
    document.getElementById("playerSection").scrollIntoView({ behavior: "smooth" });
  });

  scrollToSavedBtn.addEventListener("click", () => {
    document.getElementById("savedSection").scrollIntoView({ behavior: "smooth" });
  });

  video.addEventListener("timeupdate", handleAutoRepeatLogic);

  video.addEventListener("loadedmetadata", () => {
    video.playbackRate = Number(playbackRateSelect.value);
  });

  video.addEventListener("loadeddata", () => {
    if (currentSourceMode === "direct") {
      setupTrack();
    }
  });

  videoFileInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const objectURL = URL.createObjectURL(file);
    setMode("direct");
    video.src = objectURL;
    video.load();

    setTimeout(() => {
      setupTrack();
    }, 400);
  });

  subtitleFileInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const objectURL = URL.createObjectURL(file);

    englishTrackElement.src = objectURL;
    setMode("direct");
    video.load();

    setTimeout(() => {
      setupTrack();
    }, 400);
  });

  loadVideoUrlBtn.addEventListener("click", loadVideoFromUrl);
}

function init() {
  renderSavedSubtitles();
  updateStats();

  if (video.readyState >= 1) {
    setupTrack();
  } else {
    video.addEventListener("loadedmetadata", setupTrack, { once: true });
  }

  initControls();
}

init();