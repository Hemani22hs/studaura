document.addEventListener("DOMContentLoaded", () => {

    // =================================
    // FLASHCARDS
    // =================================

    const cards = [
        {
            q: "What is Spaced Repetition?",
            a: "An evidence-based learning technique that reviews information at increasing intervals."
        },
        {
            q: "What is Active Recall?",
            a: "Testing yourself during study sessions instead of passively rereading notes."
        },
        {
            q: "How long is a standard Pomodoro cycle?",
            a: "25 minutes of focused work followed by a 5-minute break."
        }
    ];

    let currentIndex = 0;
    let isFlipped = false;

    const flashcard = document.getElementById("flashcard");
    const cardText = document.getElementById("card-text");
    const cardIndex = document.getElementById("card-index");

    function updateCard() {
        if (!cardText || !cardIndex) return;

        cardText.textContent = isFlipped
            ? cards[currentIndex].a
            : cards[currentIndex].q;

        cardIndex.textContent =
            `Card ${currentIndex + 1} of ${cards.length}`;
    }

    if (flashcard) {
        flashcard.addEventListener("click", () => {
            isFlipped = !isFlipped;
            updateCard();
        });
    }

    document.getElementById("next-btn")?.addEventListener("click", () => {
        currentIndex = (currentIndex + 1) % cards.length;
        isFlipped = false;
        updateCard();
    });

    document.getElementById("prev-btn")?.addEventListener("click", () => {
        currentIndex =
            (currentIndex - 1 + cards.length) % cards.length;

        isFlipped = false;
        updateCard();
    });

    updateCard();


    // =================================
    // FAQ
    // =================================

    document.querySelectorAll(".faq-question").forEach(question => {

        question.addEventListener("click", () => {

            const item = question.parentElement;
            const wasActive = item.classList.contains("active");

            document.querySelectorAll(".faq-item").forEach(faq => {
                faq.classList.remove("active");

                const symbol = faq.querySelector(".faq-toggle-symbol");

                if (symbol) symbol.textContent = "+";
            });

            if (!wasActive) {
                item.classList.add("active");

                const symbol = question.querySelector(".faq-toggle-symbol");

                if (symbol) symbol.textContent = "-";
            }

        });

    });


    // =================================
    // STUDY PLANNER
    // =================================

    const subjectName = document.getElementById("subject-name");
    const subjectHours = document.getElementById("subject-hours");

    const addSubjectBtn = document.getElementById("add-subject");
    const subjectList = document.getElementById("subject-list");

    const generateBtn = document.getElementById("generate-plan");
    const timetableContainer = document.getElementById("timetable-container");

    const studyDays = document.getElementById("study-days");
    const dailyHours = document.getElementById("daily-hours");

    let subjects = JSON.parse(
        localStorage.getItem("studauraSubjects") || "[]"
    );

    let savedTimetable = JSON.parse(
        localStorage.getItem("studauraTimetable") || "null"
    );


    // SAVE SUBJECTS

    function saveSubjects() {
        localStorage.setItem(
            "studauraSubjects",
            JSON.stringify(subjects)
        );
    }


    // DISPLAY SUBJECTS

    function displaySubjects() {

        if (!subjectList) return;

        subjectList.innerHTML = "";

        subjects.forEach((subject, index) => {

            const item = document.createElement("div");
            item.className = "subject-item";

            const details = document.createElement("span");
            details.textContent =
                `${subject.name} - ${subject.hours} hours/week`;

            const removeBtn = document.createElement("button");
            removeBtn.textContent = "Remove";

            removeBtn.addEventListener("click", () => {

                subjects.splice(index, 1);

                saveSubjects();
                displaySubjects();

                timetableContainer.innerHTML = "";
                localStorage.removeItem("studauraTimetable");

            });

            item.appendChild(details);
            item.appendChild(removeBtn);

            subjectList.appendChild(item);

        });

    }


    // ADD SUBJECT

    addSubjectBtn?.addEventListener("click", () => {

        const name = subjectName.value.trim();
        const hours = Number(subjectHours.value);

        if (!name) {
            alert("Please enter a subject name.");
            return;
        }

        if (!Number.isInteger(hours) || hours < 1 || hours > 100) {
            alert("Please enter study hours between 1 and 100.");
            return;
        }

        const alreadyExists = subjects.some(
            subject => subject.name.toLowerCase() === name.toLowerCase()
        );

        if (alreadyExists) {
            alert("This subject has already been added.");
            return;
        }

        subjects.push({
            name: name,
            hours: hours
        });

        saveSubjects();
        displaySubjects();

        subjectName.value = "";
        subjectHours.value = "";

        timetableContainer.innerHTML = "";
        localStorage.removeItem("studauraTimetable");

    });


    // GENERATE TIMETABLE

    function generateTimetable() {

        if (subjects.length === 0) {
            alert("Please add at least one subject first.");
            return;
        }

        const days = Number(studyDays.value);
        const hoursPerDay = Number(dailyHours.value);

        if (
            !Number.isInteger(days) ||
            days < 1 || days > 7 ||
            !Number.isInteger(hoursPerDay) ||
            hoursPerDay < 1 || hoursPerDay > 16
        ) {
            alert("Please enter valid study days and hours.");
            return;
        }

        const totalHours = subjects.reduce(
            (sum, subject) => sum + subject.hours, 0
        );

        if (totalHours > days * hoursPerDay) {
            alert(
                `You need ${totalHours} hours, but you only have ` +
                `${days * hoursPerDay} hours available per week. ` +
                `Please adjust your subject hours or availability.`
            );
            return;
        }

        const weekDays = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday"
        ];

        const timetable = Array.from(
            { length: days },
            () => []
        );

        let dayIndex = 0;

        subjects.forEach(subject => {

            let remainingHours = subject.hours;

            while (remainingHours > 0) {

                const availableDay = dayIndex % days;

                const usedHours = timetable[availableDay].reduce(
                    (sum, session) => sum + session.hours,
                    0
                );

                if (usedHours < hoursPerDay) {

                    const availableHours = hoursPerDay - usedHours;

                    const sessionHours = Math.min(
                        remainingHours,
                        availableHours
                    );

                    timetable[availableDay].push({
                        name: subject.name,
                        hours: sessionHours
                    });

                    remainingHours -= sessionHours;

                }

                dayIndex++;

                if (dayIndex > 10000) {
                    alert("Unable to create the timetable.");
                    return;
                }

            }

        });

        savedTimetable = timetable;

        localStorage.setItem(
            "studauraTimetable",
            JSON.stringify(timetable)
        );

        displayTimetable(timetable, weekDays);

    }


    // DISPLAY TIMETABLE

    function displayTimetable(timetable, weekDays) {

        timetableContainer.innerHTML = "";

        const heading = document.createElement("h2");
        heading.textContent = "📅 Your Weekly Study Timetable";
        heading.style.marginBottom = "20px";

        timetableContainer.appendChild(heading);

        timetable.forEach((sessions, index) => {

            const card = document.createElement("div");
            card.className = "timetable-card";

            const dayHeading = document.createElement("h3");
            dayHeading.textContent = weekDays[index];

            card.appendChild(dayHeading);

            if (sessions.length === 0) {

                const message = document.createElement("p");
                message.textContent = "Free day! Take some rest.";
                message.style.color = "#94a3b8";

                card.appendChild(message);

            } else {

                sessions.forEach(session => {

                    const row = document.createElement("div");
                    row.className = "timetable-row";

                    const name = document.createElement("span");
                    name.textContent = "📖 " + session.name;

                    const duration = document.createElement("span");
                    duration.textContent =
                        session.hours + " hour(s)";

                    row.appendChild(name);
                    row.appendChild(duration);

                    card.appendChild(row);

                });

            }

            timetableContainer.appendChild(card);

        });

    }


    generateBtn?.addEventListener("click", generateTimetable);


    // RESTORE SAVED DATA

    displaySubjects();

    if (savedTimetable) {

        displayTimetable(
            savedTimetable,
            [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday"
            ]
        );

    }


    // KEYBOARD SHORTCUTS FOR FLASHCARDS

    document.addEventListener("keydown", event => {

        const tag = document.activeElement?.tagName;

        if (["INPUT", "TEXTAREA", "BUTTON"].includes(tag)) return;

        if (event.code === "Space" && flashcard) {
            event.preventDefault();
            flashcard.click();
        }

        if (event.code === "ArrowRight") {
            document.getElementById("next-btn")?.click();
        }

        if (event.code === "ArrowLeft") {
            document.getElementById("prev-btn")?.click();
        }

    });

});