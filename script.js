// =====================================
// STUD AURAX - MAIN JAVASCRIPT
// =====================================

const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "studauraX_data";

let data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
  subjects: [],
  timetable: [],
  cards: [],
  sessions: [],
  goal: 10,
  theme: "light"
};

let currentCardIndex = 0;
let editingCardId = null;
let showingAnswer = false;

let timerSeconds = 25 * 60;
let timerRemaining = timerSeconds;
let timerInterval = null;
let timerRunning = false;
let timerMode = "Focus";

let audioContext = null;
let soundNodes = [];
let soundPlaying = false;
let selectedSound = "rain";

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function safeText(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return remaining
    ? `${hours}h ${remaining}m`
    : `${hours}h`;
}

function todayKey() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function getMonday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

function getWeekSessions() {
  const monday = getMonday();

  return data.sessions.filter(session => {
    return new Date(session.date) >= monday;
  });
}

function sumMinutes(sessions) {
  return sessions.reduce((sum, session) => {
    return sum + Number(session.minutes || 0);
  }, 0);
}

// =====================================
// NAVIGATION
// =====================================

function navigate(page) {
  document.querySelectorAll(".page").forEach(section => {
    section.classList.remove("active");
  });

  document.querySelectorAll(".nav").forEach(button => {
    button.classList.remove("active");
  });

  $(page).classList.add("active");

  const navButton = document.querySelector(
    `.nav[data-page="${page}"]`
  );

  if (navButton) {
    navButton.classList.add("active");
  }

  const titles = {
    home: "Overview",
    planner: "Study Planner",
    flashcards: "Flashcards",
    focus: "Focus Room",
    progress: "Progress"
  };

  $("page-title").textContent = titles[page] || "Overview";

  $("sidebar").classList.remove("open");

  if (page === "progress") renderProgress();
  if (page === "flashcards") renderFlashcards();
}

document.querySelectorAll(".nav[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    navigate(button.dataset.page);
  });
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => {
    navigate(button.dataset.go);
  });
});

$("menu-button").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
});

// =====================================
// THEMES
// =====================================

function applyTheme(theme) {
  if (theme === "light") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.dataset.theme = theme;
  }

  data.theme = theme;
  saveData();
}

$("theme-button").addEventListener("click", () => {
  const themes = [
    ["light", "Light"],
    ["dark", "Dark"],
    ["pink", "Pastel Pink"],
    ["mint", "Mint"],
    ["blue", "Sky Blue"]
  ];

  const choice = prompt(
    "Choose your theme:\n" +
    themes.map((item, index) =>
      `${index + 1}. ${item[1]}`
    ).join("\n") +
    "\nEnter a number from 1 to 5:"
  );

  if (choice === null) return;

  const selected = themes[Number(choice) - 1];

  if (!selected) {
    showToast("Choose a number between 1 and 5.");
    return;
  }

  applyTheme(selected[0]);
  showToast(`${selected[1]} theme applied!`);
});

// =====================================
// SUBJECTS
// =====================================

$("subject-form").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("subject-name").value.trim();
  const hours = Number($("subject-hours").value);

  if (!name || hours < 1 || hours > 40) {
    showToast("Enter a valid subject and hours.");
    return;
  }

  const duplicate = data.subjects.some(subject =>
    subject.name.toLowerCase() === name.toLowerCase()
  );

  if (duplicate) {
    showToast("This subject already exists.");
    return;
  }

  data.subjects.push({
    id: makeId(),
    name,
    hours
  });

  saveData();

  $("subject-name").value = "";

  renderSubjects();
  renderHome();

  showToast("Subject added!");
});

function renderSubjects() {
  const container = $("subject-list");

  if (data.subjects.length === 0) {
    container.innerHTML =
      '<p class="muted">No subjects added yet.</p>';
  } else {
    container.innerHTML = data.subjects.map(subject => `
      <div class="subject-row">
        <b>${safeText(subject.name)}</b>
        <small>${subject.hours} hours/week</small>
        <button class="delete-subject"
          data-delete-subject="${subject.id}">×</button>
      </div>
    `).join("");
  }

  document.querySelectorAll("[data-delete-subject]").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.deleteSubject;

      data.subjects = data.subjects.filter(
        subject => subject.id !== id
      );

      data.timetable = [];

      saveData();
      renderSubjects();
      renderTimetable();
      renderHome();

      showToast("Subject removed.");
    });
  });

  $("home-subjects").textContent = data.subjects.length;
}

// =====================================
// TIMETABLE GENERATOR
// =====================================

$("daily-hours").addEventListener("input", () => {
  $("hours-label").textContent = $("daily-hours").value;
});

$("generate-plan").addEventListener("click", generateTimetable);

function generateTimetable() {
  if (data.subjects.length === 0) {
    showToast("Add subjects before generating a timetable.");
    return;
  }

  const selectedDays = [
    ...document.querySelectorAll(".days input:checked")
  ].map(input => input.value);

  if (selectedDays.length === 0) {
    showToast("Choose at least one study day.");
    return;
  }

  const hoursPerDay = Number($("daily-hours").value);
  const availableSlots = selectedDays.length * hoursPerDay * 2;

  const totalRequestedSlots = data.subjects.reduce(
    (sum, subject) => sum + subject.hours * 2,
    0
  );

  if (totalRequestedSlots > availableSlots) {
    showToast(
      "Your requested subject hours exceed your available time."
    );
    return;
  }

  // Create half-hour study blocks for each subject.
  const subjectQueue = [];

  data.subjects.forEach(subject => {
    for (let i = 0; i < subject.hours * 2; i++) {
      subjectQueue.push(subject.id);
    }
  });

  // Distribute blocks across selected days.
  const timetable = selectedDays.map(day => ({
    day,
    items: []
  }));

  // Round-robin distribution keeps subjects spread across days.
  let index = 0;

  while (subjectQueue.length > 0) {
    const day = timetable[index % timetable.length];

    if (day.items.length < hoursPerDay * 2) {
      day.items.push(subjectQueue.shift());
    } else {
      subjectQueue.shift();
    }

    index++;
  }

  data.timetable = timetable;
  data.startTime = $("start-time").value;

  saveData();
  renderTimetable();
  renderHome();

  showToast("Your timetable has been generated!");
}

function getTimeLabel(startTime, blockIndex) {
  const [hour, minute] = startTime.split(":").map(Number);

  const date = new Date();
  date.setHours(hour, minute + blockIndex * 30, 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function renderTimetable() {
  const container = $("timetable");

  if (!data.timetable.length) {
    container.innerHTML =
      '<p class="muted">Your timetable will appear here.</p>';
    return;
  }

  const startTime = data.startTime || "09:00";

  container.innerHTML = data.timetable.map(day => {
    const items = day.items.map((subjectId, index) => {
      const subject = data.subjects.find(
        item => item.id === subjectId
      );

      if (!subject) return "";

      return `
        <div class="plan-item">
          <b>${safeText(subject.name)}</b>
          <small>
            ${getTimeLabel(startTime, index)} · 30 minutes
          </small>
        </div>
      `;
    }).join("");

    return `
      <div class="day-column">
        <h3>${day.day}</h3>
        ${items || '<p class="muted">Free day</p>'}
      </div>
    `;
  }).join("");
}

$("clear-plan").addEventListener("click", () => {
  data.timetable = [];
  saveData();
  renderTimetable();
  renderHome();
  showToast("Timetable cleared.");
});

// =====================================
// FLASHCARDS
// =====================================

$("add-card").addEventListener("click", () => {
  openCardModal();
});

function openCardModal(card = null) {
  editingCardId = card ? card.id : null;

  $("modal-heading").textContent =
    card ? "Edit flashcard" : "New flashcard";

  $("card-subject").value = card ? card.subject : "";
  $("card-question").value = card ? card.question : "";
  $("card-answer").value = card ? card.answer : "";

  $("modal").hidden = false;
}

function closeCardModal() {
  $("modal").hidden = true;
  $("card-form").reset();
  editingCardId = null;
}

$("close-modal").addEventListener("click", closeCardModal);
$("cancel-modal").addEventListener("click", closeCardModal);

$("card-form").addEventListener("submit", event => {
  event.preventDefault();

  const subject = $("card-subject").value.trim();
  const question = $("card-question").value.trim();
  const answer = $("card-answer").value.trim();

  if (!subject || !question || !answer) return;

  if (editingCardId) {
    const card = data.cards.find(
      item => item.id === editingCardId
    );

    if (card) {
      card.subject = subject;
      card.question = question;
      card.answer = answer;
    }
  } else {
    data.cards.push({
      id: makeId(),
      subject,
      question,
      answer
    });
  }

  saveData();
  closeCardModal();
  renderFlashcards();

  showToast("Flashcard saved!");
});

function getVisibleCards() {
  const selected = $("deck-select").value;

  if (selected === "all") return data.cards;

  return data.cards.filter(card => card.subject === selected);
}

function renderFlashcards() {
  const select = $("deck-select");
  const previousValue = select.value || "all";

  const subjects = [...new Set(
    data.cards.map(card => card.subject)
  )];

  select.innerHTML =
    '<option value="all">All subjects</option>' +
    subjects.map(subject =>
      `<option value="${safeText(subject)}">${safeText(subject)}</option>`
    ).join("");

  if (subjects.includes(previousValue)) {
    select.value = previousValue;
  }

  const cards = getVisibleCards();

  if (currentCardIndex >= cards.length) {
    currentCardIndex = Math.max(0, cards.length - 1);
  }

  const card = cards[currentCardIndex];

  $("flashcard-count").textContent =
    cards.length ? `${currentCardIndex + 1} of ${cards.length} cards` : "No cards yet.";

  if (!card) {
    $("card-side").textContent = "YOUR FLASHCARDS";
    $("card-content").textContent = "Create your first flashcard!";
    $("flashcard").querySelector("p").textContent =
      "Add a question and answer to begin.";
    return;
  }

  $("card-side").textContent =
    showingAnswer ? "ANSWER" : "QUESTION";

  $("card-content").textContent =
    showingAnswer ? card.answer : card.question;

  $("flashcard").querySelector("p").textContent =
    "Click the card to reveal the answer.";
}

$("deck-select").addEventListener("change", () => {
  currentCardIndex = 0;
  showingAnswer = false;
  renderFlashcards();
});

$("flashcard").addEventListener("click", () => {
  if (!getVisibleCards().length) return;

  showingAnswer = !showingAnswer;
  renderFlashcards();
});

$("next-card").addEventListener("click", () => {
  const cards = getVisibleCards();

  if (!cards.length) return;

  currentCardIndex = (currentCardIndex + 1) % cards.length;
  showingAnswer = false;

  renderFlashcards();
});

$("previous-card").addEventListener("click", () => {
  const cards = getVisibleCards();

  if (!cards.length) return;

  currentCardIndex =
    (currentCardIndex - 1 + cards.length) % cards.length;

  showingAnswer = false;

  renderFlashcards();
});

$("edit-card").addEventListener("click", () => {
  const card = getVisibleCards()[currentCardIndex];

  if (card) openCardModal(card);
});

$("delete-card").addEventListener("click", () => {
  const card = getVisibleCards()[currentCardIndex];

  if (!card) return;

  if (!confirm("Delete this flashcard?")) return;

  data.cards = data.cards.filter(
    item => item.id !== card.id
  );

  currentCardIndex = 0;
  showingAnswer = false;

  saveData();
  renderFlashcards();

  showToast("Flashcard deleted.");
});

// =====================================
// POMODORO TIMER
// =====================================

document.querySelectorAll(".timer-mode").forEach(button => {
  button.addEventListener("click", () => {
    stopTimer();

    document.querySelectorAll(".timer-mode").forEach(item => {
      item.classList.remove("active");
    });

    button.classList.add("active");

    timerMode = button.textContent.trim();
    timerSeconds = Number(button.dataset.time) * 60;
    timerRemaining = timerSeconds;

    $("timer-label").textContent = timerMode.toUpperCase();
    $("timer-start").textContent = "Start";

    updateTimerDisplay();
  });
});

$("timer-start").addEventListener("click", () => {
  if (timerRunning) {
    stopTimer();
    $("timer-start").textContent = "Resume";
  } else {
    startTimer();
  }
});

$("timer-reset").addEventListener("click", () => {
  stopTimer();
  timerRemaining = timerSeconds;
  $("timer-start").textContent = "Start";
  updateTimerDisplay();
});

function startTimer() {
  if (timerRemaining <= 0) {
    timerRemaining = timerSeconds;
  }

  timerRunning = true;
  $("timer-start").textContent = "Pause";

  timerInterval = setInterval(() => {
    timerRemaining--;

    updateTimerDisplay();

    if (timerRemaining <= 0) {
      stopTimer();

      $("timer-start").textContent = "Start again";

      if (timerMode === "Focus") {
        data.sessions.push({
          id: makeId(),
          date: todayKey(),
          minutes: Math.round(timerSeconds / 60)
        });

        saveData();
        renderHome();
        renderProgress();

        showToast("Focus session completed!");
      } else {
        showToast("Break completed!");
      }
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning = false;
}

function updateTimerDisplay() {
  const minutes = Math.floor(timerRemaining / 60);
  const seconds = timerRemaining % 60;

  $("timer").textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// =====================================
// STUDY SOUNDS
// =====================================

document.querySelectorAll(".sound-option").forEach(button => {
  button.addEventListener("click", () => {
    selectedSound = button.dataset.sound;

    document.querySelectorAll(".sound-option").forEach(item => {
      item.classList.remove("active");
    });

    button.classList.add("active");

    if (soundPlaying) {
      stopSound();
      startSound();
    }
  });
});

$("sound-toggle").addEventListener("click", () => {
  if (soundPlaying) {
    stopSound();
  } else {
    startSound();
  }
});

$("volume").addEventListener("input", () => {
  $("volume-label").textContent = $("volume").value + "%";

  const gain = soundNodes.find(node =>
    node instanceof GainNode
  );

  if (gain && audioContext) {
    gain.gain.setTargetAtTime(
      Number($("volume").value) / 100 * 0.12,
      audioContext.currentTime,
      0.05
    );
  }
});

async function startSound() {
  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    showToast("Audio is not supported in this browser.");
    return;
  }

  audioContext = audioContext || new AudioContextClass();

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  stopAudioNodes();

  const gain = audioContext.createGain();

  gain.gain.value = Number($("volume").value) / 100 * 0.12;
  gain.connect(audioContext.destination);

  soundNodes.push(gain);

  if (selectedSound === "tone") {
    const oscillator = audioContext.createOscillator();

    oscillator.type = "sine";
    oscillator.frequency.value = 220;

    oscillator.connect(gain);
    oscillator.start();

    soundNodes.push(oscillator);
  } else {
    const buffer = audioContext.createBuffer(
      1,
      audioContext.sampleRate * 2,
      audioContext.sampleRate
    );

    const channel = buffer.getChannelData(0);

    for (let i = 0; i < channel.length; i++) {
      channel[i] = (Math.random() * 2 - 1) *
        (selectedSound === "rain" ? 0.24 : 0.7);
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = audioContext.createBiquadFilter();

    filter.type = "lowpass";
    filter.frequency.value =
      selectedSound === "rain" ? 950 : 230;

    source.connect(filter);
    filter.connect(gain);

    source.start();

    soundNodes.push(source, filter);
  }

  soundPlaying = true;
  $("sound-toggle").textContent = "Ⅱ Pause sound";
}

function stopAudioNodes() {
  soundNodes.forEach(node => {
    try {
      if (node.stop) node.stop();
      node.disconnect();
    } catch (error) {}
  });

  soundNodes = [];
}

function stopSound() {
  stopAudioNodes();
  soundPlaying = false;
  $("sound-toggle").textContent = "▶ Play sound";
}

// =====================================
// PROGRESS TRACKER
// =====================================

$("goal-hours").addEventListener("input", () => {
  data.goal = Number($("goal-hours").value);
  saveData();
  renderProgress();
  renderHome();
});

$("clear-history").addEventListener("click", () => {
  if (!confirm("Clear all session history?")) return;

  data.sessions = [];

  saveData();
  renderProgress();
  renderHome();

  showToast("History cleared.");
});

function renderProgress() {
  const total = sumMinutes(data.sessions);
  const week = sumMinutes(getWeekSessions());

  const goalMinutes = data.goal * 60;

  const percentage = Math.min(
    100,
    Math.round(week / goalMinutes * 100)
  );

  $("total-time").textContent = formatMinutes(total);
  $("total-sessions").textContent = data.sessions.length;
  $("week-time").textContent = formatMinutes(week);

  $("goal-hours").value = data.goal;
  $("goal-label").textContent = data.goal + " hours";
  $("goal-percent").textContent = percentage + "%";

  $("goal-circle").style.background =
    `conic-gradient(var(--primary) ${percentage}%, var(--soft) 0%)`;

  $("goal-description").textContent =
    `${formatMinutes(week)} studied this week.`;

  renderWeeklyChart();
  renderHistory();

  $("home-goal").textContent = percentage + "%";
}

function renderWeeklyChart() {
  const monday = getMonday();
  const days = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);

    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");

    const minutes = sumMinutes(
      data.sessions.filter(session => session.date === key)
    );

    days.push({
      name: date.toLocaleDateString("en-US", {
        weekday: "short"
      }),
      minutes
    });
  }

  const max = Math.max(60, ...days.map(day => day.minutes));

  $("weekly-chart").innerHTML = days.map(day => {
    const height = day.minutes / max * 100;

    return `
      <div class="chart-day">
        <div class="chart-bar" style="height:${height}%"></div>
        <span>${day.name}</span>
        <small>${day.minutes}m</small>
      </div>
    `;
  }).join("");
}

function renderHistory() {
  const recent = [...data.sessions].reverse().slice(0, 10);

  if (!recent.length) {
    $("history").innerHTML =
      '<p class="muted">Your completed sessions will appear here.</p>';
    return;
  }

  $("history").innerHTML = recent.map(session => `
    <div class="history-row">
      <div>
        <b>Focus session</b><br>
        <small>${session.date}</small>
      </div>
      <b>${session.minutes} min</b>
    </div>
  `).join("");
}

// =====================================
// HOME DASHBOARD
// =====================================

function renderHome() {
  const today = todayKey();

  const todaySessions = data.sessions.filter(
    session => session.date === today
  );

  const todayMinutes = sumMinutes(todaySessions);
  const weekMinutes = sumMinutes(getWeekSessions());

  $("home-today").textContent = formatMinutes(todayMinutes);
  $("home-sessions").textContent = data.sessions.length;
  $("home-subjects").textContent = data.subjects.length;

  const percentage = Math.min(
    100,
    Math.round(weekMinutes / (data.goal * 60) * 100)
  );

  $("home-goal").textContent = percentage + "%";

  const weekday = new Date().toLocaleDateString("en-US", {
    weekday: "short"
  });

  const todayPlan = data.timetable.find(
    day => day.day === weekday
  );

  if (!todayPlan || !todayPlan.items.length) {
    $("home-plan").innerHTML =
      '<p class="muted">No study plan for today. Generate your timetable in the Study Planner.</p>';
    return;
  }

  $("home-plan").innerHTML = todayPlan.items.map((id, index) => {
    const subject = data.subjects.find(
      item => item.id === id
    );

    if (!subject) return "";

    return `
      <div class="history-row">
        <div>
          <b>${safeText(subject.name)}</b><br>
          <small>${getTimeLabel(data.startTime || "09:00", index)}</small>
        </div>
        <small>30 min</small>
      </div>
    `;
  }).join("");
}

// =====================================
// INITIAL LOAD
// =====================================

function initialize() {
  applyTheme(data.theme || "light");

  $("date-label").textContent =
    new Date().toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short"
    });

  renderSubjects();
  renderTimetable();
  renderFlashcards();
  renderProgress();
  renderHome();
  updateTimerDisplay();
}

initialize();