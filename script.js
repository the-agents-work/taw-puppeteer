const mouthPaths = {
  rest: "M75 154 C84 160 96 160 105 154",
  a: "M78 151 C86 143 98 143 104 151 C104 168 79 168 78 151",
  o: "M82 151 C87 144 96 144 101 151 C104 160 99 169 91 169 C83 169 78 160 82 151",
  e: "M74 153 C84 148 98 148 108 153 C101 160 82 160 74 153",
  m: "M76 156 C84 154 96 154 104 156",
};

const expressionMap = {
  happy: {
    leftBrow: "translate(50 122) rotate(-8)",
    rightBrow: "translate(112 122) rotate(8)",
    eyeScale: 1,
  },
  surprised: {
    leftBrow: "translate(50 114) rotate(-4)",
    rightBrow: "translate(112 114) rotate(4)",
    eyeScale: 1.28,
  },
  angry: {
    leftBrow: "translate(50 126) rotate(18)",
    rightBrow: "translate(112 126) rotate(-18)",
    eyeScale: 0.95,
  },
};

const characterPresets = {
  mai: {
    name: "Mai",
    skin: "#d6a06f",
    robe: "#a73725",
    robeDark: "#6f241b",
    trim: "#e2aa45",
    hair: "#1c120d",
    accent: "#fff0b8",
    accessory: "hair",
  },
  long: {
    name: "Long",
    skin: "#c88b61",
    robe: "#2f7b68",
    robeDark: "#195548",
    trim: "#f0c66c",
    hair: "#21140f",
    accent: "#e9d9a9",
    accessory: "hat",
  },
};

const timeline = [
  {
    start: 0,
    end: 4.2,
    actor: "mai",
    expression: "happy",
    text: "Mình thử làm phim mà không cần generate video từng cảnh nhé?",
  },
  {
    start: 4.2,
    end: 8.6,
    actor: "long",
    expression: "surprised",
    text: "Tức là nền đứng yên, nhân vật là SVG, chỉ đổi miệng với tay thôi?",
  },
  {
    start: 8.6,
    end: 13.2,
    actor: "mai",
    expression: "happy",
    text: "Đúng rồi. Script đổi là timeline đổi, asset vẫn dùng lại được.",
  },
  {
    start: 13.2,
    end: 17.8,
    actor: "long",
    expression: "angry",
    text: "Vậy chi phí render gần như chỉ là code và thời gian dựng cảnh.",
  },
  {
    start: 17.8,
    end: 22.2,
    actor: "mai",
    expression: "happy",
    text: "Sau này thêm TTS, lip-sync và xuất MP4 là thành pipeline phim ngắn.",
  },
];

const totalDuration = timeline.at(-1).end;
const mouthOrder = ["a", "o", "e", "m", "rest", "e", "a", "m"];

const stage = document.querySelector("#stage");
const puppetSlots = [...document.querySelectorAll(".puppet-slot")];
const captionText = document.querySelector("#captionText");
const speakerName = document.querySelector("#speakerName");
const progressBar = document.querySelector("#progressBar");
const timecode = document.querySelector("#timecode");
const togglePlayback = document.querySelector("#togglePlayback");
const toggleVoice = document.querySelector("#toggleVoice");
const restartScene = document.querySelector("#restartScene");
const shadowMode = document.querySelector("#shadowMode");
const exportSvg = document.querySelector("#exportSvg");
const voiceStatus = document.querySelector("#voiceStatus");

let startedAt = performance.now();
let pausedAt = 0;
let elapsedBeforePause = 0;
let isPlaying = true;
let activeActor = "mai";
let voiceEnabled = false;
let lastSpokenBeat = -1;
let currentAudio = null;
let ttsMode = "off";

function createPuppetSvg(actorKey, preset) {
  const accessory =
    preset.accessory === "hat"
      ? `<path class="hat" d="M32 90 C46 56 132 56 148 90 L136 105 L44 105 Z" fill="${preset.hair}"/>
         <path d="M44 101 H136" stroke="${preset.trim}" stroke-width="8" stroke-linecap="round"/>`
      : `<path d="M44 105 C45 65 136 62 138 110 C119 96 63 96 44 105Z" fill="${preset.hair}"/>
         <circle cx="126" cy="94" r="10" fill="${preset.trim}"/>`;

  return `
    <svg class="puppet-svg" data-puppet="${actorKey}" viewBox="0 0 180 300" role="img" aria-label="Nhân vật ${preset.name}">
      <line class="string" x1="90" y1="-36" x2="90" y2="92"/>
      <line class="string" x1="38" y1="-28" x2="48" y2="184"/>
      <line class="string" x1="142" y1="-28" x2="132" y2="184"/>
      <ellipse class="floor-shadow" cx="90" cy="286" rx="54" ry="13"/>
      <g class="body-rig">
        <path class="arm arm-left" d="M48 156 C24 168 18 216 36 246 C48 238 59 197 70 164Z" fill="${preset.robeDark}"/>
        <path class="arm arm-right" d="M132 156 C156 168 162 216 144 246 C132 238 121 197 110 164Z" fill="${preset.robeDark}"/>
        <path d="M58 150 L122 150 L148 282 L32 282 Z" fill="${preset.robe}"/>
        <path d="M69 150 L111 150 L104 282 H76 Z" fill="${preset.trim}" opacity="0.42"/>
        <path d="M58 202 C78 216 104 216 124 202" stroke="${preset.accent}" stroke-width="6" fill="none" opacity="0.7"/>
        <rect x="75" y="132" width="30" height="36" rx="12" fill="${preset.skin}"/>
      </g>
      <g class="head-rig">
        ${accessory}
        <path d="M47 112 C47 78 133 78 133 112 V137 C133 173 47 173 47 137Z" fill="${preset.skin}"/>
        <path d="M47 133 C61 142 119 142 133 133 V139 C133 172 47 172 47 139Z" fill="#000" opacity="0.08"/>
        <g class="brow brow-left" transform="${expressionMap.happy.leftBrow}">
          <path d="M-15 0 C-6 -5 6 -5 15 0" stroke="#21140f" stroke-width="5" stroke-linecap="round" fill="none"/>
        </g>
        <g class="brow brow-right" transform="${expressionMap.happy.rightBrow}">
          <path d="M-15 0 C-6 -5 6 -5 15 0" stroke="#21140f" stroke-width="5" stroke-linecap="round" fill="none"/>
        </g>
        <circle class="eye eye-left" cx="66" cy="137" r="5" fill="#1a100b"/>
        <circle class="eye eye-right" cx="114" cy="137" r="5" fill="#1a100b"/>
        <path class="mouth" d="${mouthPaths.rest}" stroke="#4a1d15" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </g>
    </svg>
  `;
}

function mountCharacters() {
  puppetSlots.forEach((slot) => {
    const actor = slot.dataset.actor;
    slot.innerHTML = createPuppetSvg(actor, characterPresets[actor]);
  });
}

function currentElapsed(now) {
  if (!isPlaying) return pausedAt;
  return ((now - startedAt) / 1000 + elapsedBeforePause) % totalDuration;
}

function activeBeat(seconds) {
  return timeline.find((beat) => seconds >= beat.start && seconds < beat.end) ?? timeline[0];
}

function setExpression(slot, expression) {
  const map = expressionMap[expression] ?? expressionMap.happy;
  slot.querySelector(".brow-left").setAttribute("transform", map.leftBrow);
  slot.querySelector(".brow-right").setAttribute("transform", map.rightBrow);
  slot.querySelectorAll(".eye").forEach((eye) => {
    eye.setAttribute("transform", `scale(${map.eyeScale})`);
    eye.setAttribute("transform-origin", `${eye.getAttribute("cx")} ${eye.getAttribute("cy")}`);
  });
}

function setPuppetState(beat, seconds) {
  const speakingMouth = mouthOrder[Math.floor(seconds * 8) % mouthOrder.length];
  activeActor = beat.actor;

  puppetSlots.forEach((slot) => {
    const isActive = slot.dataset.actor === beat.actor;
    slot.classList.toggle("active", isActive);
    slot.classList.toggle("listening", !isActive);
    slot.querySelector(".mouth").setAttribute("d", mouthPaths[isActive ? speakingMouth : "rest"]);
    setExpression(slot, isActive ? beat.expression : "happy");
  });
}

function setCaption(beat) {
  speakerName.textContent = characterPresets[beat.actor].name;
  captionText.textContent = beat.text;
}

function formatTime(seconds) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${mm}:${ss}`;
}

function render(now) {
  const seconds = currentElapsed(now);
  const beat = activeBeat(seconds);
  const beatIndex = timeline.indexOf(beat);

  setPuppetState(beat, seconds);
  setCaption(beat);
  speakBeat(beat, beatIndex);

  progressBar.style.width = `${(seconds / totalDuration) * 100}%`;
  timecode.textContent = formatTime(seconds);

  requestAnimationFrame(render);
}

function setPlaying(nextIsPlaying) {
  if (nextIsPlaying === isPlaying) return;

  if (!nextIsPlaying) {
    pausedAt = currentElapsed(performance.now());
    isPlaying = false;
    togglePlayback.textContent = "Tiếp tục";
    stopVoice();
    return;
  }

  startedAt = performance.now();
  elapsedBeforePause = pausedAt;
  isPlaying = true;
  togglePlayback.textContent = "Tạm dừng";
}

async function speakBeat(beat, beatIndex) {
  if (!voiceEnabled || !isPlaying || beatIndex === lastSpokenBeat) return;

  lastSpokenBeat = beatIndex;
  stopVoice();
  voiceStatus.textContent = "Đang tạo giọng...";

  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: beat.actor, text: beat.text }),
    });
    const data = await response.json();

    if (response.status === 412 || data.fallback === "browser-speech") {
      ttsMode = "browser";
      speakWithBrowser(beat);
      return;
    }

    if (!response.ok) {
      throw new Error(data.error || "TTS failed");
    }

    ttsMode = "vbee";
    currentAudio = new Audio(data.audioUrl);
    currentAudio.play();
    voiceStatus.textContent = `Vbee: ${data.voiceCode}`;
  } catch (error) {
    ttsMode = "browser";
    voiceStatus.textContent = "Vbee chưa sẵn sàng, dùng giọng browser.";
    speakWithBrowser(beat);
  }
}

function speakWithBrowser(beat) {
  if (!("speechSynthesis" in window)) {
    voiceStatus.textContent = "Browser này không hỗ trợ TTS local.";
    return;
  }

  const utterance = new SpeechSynthesisUtterance(beat.text);
  utterance.lang = "vi-VN";
  utterance.rate = beat.actor === "long" ? 0.92 : 1.02;
  utterance.pitch = beat.actor === "long" ? 0.82 : 1.14;
  utterance.onstart = () => {
    voiceStatus.textContent = "Đang dùng TTS local của browser.";
  };
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function stopVoice() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }
}

function exportActiveCharacterSvg() {
  const svg = document.querySelector(`[data-actor="${activeActor}"] svg`).cloneNode(true);
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.querySelectorAll(".string").forEach((line) => line.remove());

  const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `taw-puppeteer-${activeActor}.svg`;
  link.click();
  URL.revokeObjectURL(url);
}

togglePlayback.addEventListener("click", () => setPlaying(!isPlaying));

toggleVoice.addEventListener("click", () => {
  voiceEnabled = !voiceEnabled;
  toggleVoice.textContent = voiceEnabled ? "Tắt TTS" : "Bật TTS";
  voiceStatus.textContent = voiceEnabled ? "TTS đã bật" : "TTS đang tắt";

  if (!voiceEnabled) {
    stopVoice();
    ttsMode = "off";
    return;
  }

  lastSpokenBeat = -1;
});

restartScene.addEventListener("click", () => {
  startedAt = performance.now();
  pausedAt = 0;
  elapsedBeforePause = 0;
  lastSpokenBeat = -1;
  isPlaying = true;
  togglePlayback.textContent = "Tạm dừng";
  stopVoice();
});

shadowMode.addEventListener("change", (event) => {
  stage.classList.toggle("shadow-mode", event.target.checked);
});

exportSvg.addEventListener("click", exportActiveCharacterSvg);

mountCharacters();
requestAnimationFrame(render);
