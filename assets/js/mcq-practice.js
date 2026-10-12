const questionBankUrl = new URL("../../data/mcqs.json", document.currentScript.src);
const unitTitles = new Map([
    [1, "Operating System Design, Processes and Threads"],
    [2, "CPU Scheduling and Performance Evaluation"],
    [3, "Synchronization and Concurrency Control Design"],
    [4, "Deadlock Modeling and System-level Handling"],
    [5, "Memory Management System Design"],
    [6, "Virtual Memory and Page Replacement Design"],
    [7, "File System Design and Performance"],
    [8, "I/O Subsystem and Storage System Design"],
    [9, "Specialized Operating Systems: Design and Performance Overview"]
]);
const allowedDifficulties = new Set(["Easy", "Medium", "Hard"]);

const mcqElements = {
    unit: document.getElementById("unit-filter"),
    topic: document.getElementById("topic-filter"),
    difficulty: document.getElementById("difficulty-filter"),
    count: document.getElementById("question-count"),
    shuffleQuestions: document.getElementById("shuffle-questions"),
    shuffleOptions: document.getElementById("shuffle-options"),
    apply: document.getElementById("apply-filters"),
    restart: document.getElementById("restart-practice"),
    matchCount: document.getElementById("match-count"),
    loadError: document.getElementById("load-error"),
    emptyState: document.getElementById("empty-state"),
    panel: document.getElementById("practice-panel"),
    progressText: document.getElementById("question-progress"),
    progress: document.getElementById("practice-progress"),
    difficultyLabel: document.getElementById("question-difficulty"),
    tags: document.getElementById("question-tags"),
    topicLabel: document.getElementById("question-topic"),
    question: document.getElementById("question-text"),
    options: document.getElementById("answer-options"),
    hint: document.getElementById("question-hint"),
    feedback: document.getElementById("answer-feedback"),
    previous: document.getElementById("previous-question"),
    showHint: document.getElementById("show-hint"),
    submit: document.getElementById("submit-answer"),
    next: document.getElementById("next-question"),
    finish: document.getElementById("finish-practice"),
    returnSummaryPractice: document.getElementById("return-summary-practice"),
    summary: document.getElementById("summary-panel"),
    summaryAttempted: document.getElementById("summary-attempted"),
    summaryCorrect: document.getElementById("summary-correct"),
    summaryIncorrect: document.getElementById("summary-incorrect"),
    summaryScore: document.getElementById("summary-score"),
    incorrectReview: document.getElementById("incorrect-review"),
    incorrectList: document.getElementById("incorrect-list"),
    retryIncorrect: document.getElementById("retry-incorrect"),
    restartSummary: document.getElementById("restart-summary")
};

const mcqState = {
    questions: [],
    filteredQuestions: [],
    sessionQuestions: [],
    sessionMembers: [],
    currentIndex: 0,
    selections: new Map(),
    results: new Map(),
    optionOrder: new Map(),
    hintVisible: false,
    reviewing: false
};

function validateQuestionBank(questions) {
    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error("The question bank must be a non-empty JSON array.");
    }

    const datasetIds = new Set();
    questions.forEach((question, index) => {
        const position = `Question ${index + 1}`;
        if (!question || typeof question !== "object" || Array.isArray(question)) {
            throw new Error(`${position} is not an object.`);
        }
        if (typeof question.id !== "string" || !question.id.trim() || datasetIds.has(question.id)) {
            throw new Error(`${position} has a missing or duplicate ID.`);
        }
        datasetIds.add(question.id);
        if (!Number.isInteger(question.unitId) || !unitTitles.has(question.unitId)
            || question.unitTitle !== unitTitles.get(question.unitId)) {
            throw new Error(`${position} has an invalid syllabus unit.`);
        }
        if (typeof question.topic !== "string" || !question.topic.trim()
            || !allowedDifficulties.has(question.difficulty)
            || question.type !== "single_select"
            || typeof question.question !== "string" || !question.question.trim()
            || typeof question.explanation !== "string" || !question.explanation.trim()) {
            throw new Error(`${position} has invalid required question fields.`);
        }
        if (question.hint !== undefined && typeof question.hint !== "string") {
            throw new Error(`${position} has an invalid hint.`);
        }
        if (question.source !== undefined && typeof question.source !== "string") {
            throw new Error(`${position} has an invalid source.`);
        }
        if (!Array.isArray(question.tags) || question.tags.some(tag => typeof tag !== "string")) {
            throw new Error(`${position} has invalid tags.`);
        }
        if (!Array.isArray(question.options) || question.options.length !== 4) {
            throw new Error(`${position} must have exactly four answer options.`);
        }
        const optionIds = new Set();
        question.options.forEach(option => {
            if (!option || typeof option.id !== "string" || !option.id.trim()
                || optionIds.has(option.id) || datasetIds.has(option.id)
                || typeof option.text !== "string" || !option.text.trim()) {
                throw new Error(`${position} has a missing or duplicate option ID or invalid option text.`);
            }
            optionIds.add(option.id);
            datasetIds.add(option.id);
        });
        if (typeof question.correctOptionId !== "string" || !optionIds.has(question.correctOptionId)) {
            throw new Error(`${position} has no matching correct option ID.`);
        }
    });
    return questions;
}

function showMcqError(message) {
    mcqElements.loadError.textContent = message;
    mcqElements.loadError.classList.remove("mcq-hidden");
    mcqElements.matchCount.textContent = "Question bank unavailable";
    mcqElements.apply.disabled = true;
}

function addOption(select, value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
}

function fillUnitFilter() {
    unitTitles.forEach((title, id) => addOption(mcqElements.unit, String(id), `Unit ${id} · ${title}`));
}

function updateTopicFilter() {
    const previousTopic = mcqElements.topic.value;
    const selectedUnit = mcqElements.unit.value;
    const topics = [...new Set(mcqState.questions
        .filter(question => selectedUnit === "all" || question.unitId === Number(selectedUnit))
        .map(question => question.topic))]
        .sort((left, right) => left.localeCompare(right));

    mcqElements.topic.replaceChildren();
    addOption(mcqElements.topic, "all", "All topics");
    topics.forEach(topic => addOption(mcqElements.topic, topic, topic));
    mcqElements.topic.value = topics.includes(previousTopic) ? previousTopic : "all";
}

function getFilteredQuestions() {
    const selectedUnit = mcqElements.unit.value;
    const selectedTopic = mcqElements.topic.value;
    const selectedDifficulty = mcqElements.difficulty.value;

    return mcqState.questions.filter(question =>
        (selectedUnit === "all" || question.unitId === Number(selectedUnit))
        && (selectedTopic === "all" || question.topic === selectedTopic)
        && (selectedDifficulty === "all" || question.difficulty === selectedDifficulty)
    );
}

function updateMatchCount() {
    mcqState.filteredQuestions = getFilteredQuestions();
    const count = mcqState.filteredQuestions.length;
    mcqElements.matchCount.textContent = `${count} matching ${count === 1 ? "question" : "questions"}`;
    mcqElements.apply.disabled = count === 0;
    if (count === 0) {
        mcqElements.emptyState.textContent = "No questions match these filters. Choose another unit, topic or difficulty.";
        mcqElements.emptyState.classList.remove("mcq-hidden");
        mcqElements.panel.classList.add("mcq-hidden");
        mcqElements.summary.classList.add("mcq-hidden");
        mcqElements.restart.disabled = true;
    } else {
        mcqElements.emptyState.classList.add("mcq-hidden");
        mcqElements.restart.disabled = mcqState.sessionMembers.length === 0;
    }
}

function shuffle(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
}

function makeQuestionSet(questions) {
    const candidates = mcqElements.shuffleQuestions.checked ? shuffle(questions) : [...questions];
    const requestedCount = mcqElements.count.value === "all"
        ? candidates.length
        : Number(mcqElements.count.value);
    return candidates.slice(0, requestedCount);
}

function beginSession(questions) {
    mcqState.sessionQuestions = [...questions];
    if (mcqElements.shuffleQuestions.checked) {
        mcqState.sessionQuestions = shuffle(mcqState.sessionQuestions);
    }
    mcqState.sessionMembers = [...mcqState.sessionQuestions];
    mcqState.currentIndex = 0;
    mcqState.selections.clear();
    mcqState.results.clear();
    mcqState.optionOrder.clear();
    mcqState.sessionQuestions.forEach(question => {
        const options = mcqElements.shuffleOptions.checked
            ? shuffle(question.options)
            : [...question.options];
        mcqState.optionOrder.set(question.id, options);
    });
    mcqState.hintVisible = false;
    mcqState.reviewing = false;
    mcqElements.summary.classList.add("mcq-hidden");
    mcqElements.panel.classList.remove("mcq-hidden");
    mcqElements.returnSummaryPractice.classList.add("mcq-hidden");
    mcqElements.restart.disabled = false;
    mcqElements.emptyState.classList.add("mcq-hidden");
    renderQuestion();
    mcqElements.question.focus();
}

function setElementText(element, text) {
    element.textContent = text;
}

function renderQuestion() {
    const question = mcqState.sessionQuestions[mcqState.currentIndex];
    if (!question) {
        mcqElements.panel.classList.add("mcq-hidden");
        return;
    }

    const answerResult = mcqState.results.get(question.id);
    const selectedOptionId = mcqState.selections.get(question.id);
    setElementText(
        mcqElements.progressText,
        `Question ${mcqState.currentIndex + 1} of ${mcqState.sessionQuestions.length} · ${mcqState.results.size} submitted`
    );
    mcqElements.progress.max = mcqState.sessionQuestions.length;
    mcqElements.progress.value = mcqState.currentIndex + 1;
    setElementText(mcqElements.difficultyLabel, question.difficulty);
    setElementText(mcqElements.topicLabel, `Unit ${question.unitId} · ${question.topic}`);
    setElementText(mcqElements.question, question.question);
    mcqElements.tags.replaceChildren();
    [question.unitTitle, ...question.tags].forEach(tag => {
        const tagElement = document.createElement("span");
        tagElement.className = "mcq-tag";
        tagElement.textContent = tag;
        mcqElements.tags.append(tagElement);
    });

    mcqElements.options.replaceChildren();
    const legend = document.createElement("legend");
    legend.className = "mcq-visually-hidden";
    legend.textContent = "Choose one answer";
    mcqElements.options.append(legend);
    const optionOrder = mcqState.optionOrder.get(question.id) || question.options;
    optionOrder.forEach(option => {
        const label = document.createElement("label");
        label.className = "mcq-option";
        if (answerResult && option.id === question.correctOptionId) {
            label.classList.add("is-correct");
        }
        if (answerResult && selectedOptionId === option.id && !answerResult.correct) {
            label.classList.add("is-incorrect");
        }
        const input = document.createElement("input");
        input.type = "radio";
        input.name = `answer-${question.id}`;
        input.value = option.id;
        input.checked = selectedOptionId === option.id;
        input.disabled = Boolean(answerResult);
        input.addEventListener("change", () => {
            mcqState.selections.set(question.id, option.id);
            mcqElements.submit.disabled = false;
            mcqElements.options.querySelectorAll(".mcq-option").forEach(optionLabel => {
                optionLabel.classList.toggle("is-selected", optionLabel === label);
            });
        });
        const text = document.createElement("span");
        text.textContent = option.text;
        label.append(input, text);
        if (input.checked && !answerResult) {
            label.classList.add("is-selected");
        }
        mcqElements.options.append(label);
    });

    if (answerResult) {
        mcqElements.feedback.textContent = `${answerResult.correct ? "Correct." : "Not quite."} Correct answer: ${question.options.find(option => option.id === question.correctOptionId).text} Explanation: ${question.explanation}`;
        mcqElements.feedback.dataset.result = answerResult.correct ? "correct" : "incorrect";
        mcqElements.feedback.classList.remove("mcq-hidden");
    } else {
        mcqElements.feedback.textContent = "";
        delete mcqElements.feedback.dataset.result;
        mcqElements.feedback.classList.add("mcq-hidden");
    }

    mcqElements.hint.textContent = question.hint || "No hint is available for this question.";
    mcqElements.hint.classList.toggle("mcq-hidden", !mcqState.hintVisible);
    mcqElements.showHint.disabled = !question.hint;
    mcqElements.showHint.textContent = mcqState.hintVisible ? "Hide hint" : "Show hint";
    mcqElements.previous.disabled = mcqState.currentIndex === 0;
    mcqElements.next.disabled = mcqState.currentIndex === mcqState.sessionQuestions.length - 1;
    mcqElements.submit.disabled = Boolean(answerResult) || !selectedOptionId;
    mcqElements.returnSummaryPractice.classList.toggle("mcq-hidden", !mcqState.reviewing);
}

function showSummary() {
    const total = mcqState.sessionQuestions.length;
    const attempted = mcqState.results.size;
    const correct = [...mcqState.results.values()].filter(result => result.correct).length;
    const incorrectQuestions = mcqState.sessionQuestions.filter(question =>
        mcqState.results.has(question.id) && !mcqState.results.get(question.id).correct
    );
    const percentage = attempted ? Math.round((correct / attempted) * 100) : 0;

    setElementText(mcqElements.summaryAttempted, `${attempted} / ${total}`);
    setElementText(mcqElements.summaryCorrect, String(correct));
    setElementText(mcqElements.summaryIncorrect, String(incorrectQuestions.length));
    setElementText(mcqElements.summaryScore, `${percentage}%`);
    mcqElements.incorrectList.replaceChildren();
    incorrectQuestions.forEach(question => {
        const reviewButton = document.createElement("button");
        reviewButton.className = "btn mcq-review-item";
        reviewButton.type = "button";
        reviewButton.dataset.questionId = question.id;
        reviewButton.textContent = `Review Unit ${question.unitId} · ${question.topic}: ${question.question}`;
        mcqElements.incorrectList.append(reviewButton);
    });
    mcqElements.incorrectReview.classList.toggle("mcq-hidden", incorrectQuestions.length === 0);
    mcqElements.retryIncorrect.classList.toggle("mcq-hidden", incorrectQuestions.length === 0);
    mcqElements.panel.classList.add("mcq-hidden");
    mcqElements.summary.classList.remove("mcq-hidden");
    mcqState.reviewing = false;
    mcqElements.summary.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("summary-heading").focus();
}

function showReviewQuestion(questionId) {
    const index = mcqState.sessionQuestions.findIndex(question => question.id === questionId);
    if (index < 0) return;
    mcqState.currentIndex = index;
    mcqState.reviewing = true;
    mcqElements.summary.classList.add("mcq-hidden");
    mcqElements.panel.classList.remove("mcq-hidden");
    renderQuestion();
    mcqElements.question.focus();
    mcqElements.panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function startPractice() {
    mcqElements.loadError.classList.add("mcq-hidden");
    mcqState.filteredQuestions = getFilteredQuestions();
    if (mcqState.filteredQuestions.length === 0) {
        mcqElements.panel.classList.add("mcq-hidden");
        mcqElements.summary.classList.add("mcq-hidden");
        updateMatchCount();
        return;
    }
    beginSession(makeQuestionSet(mcqState.filteredQuestions));
}

async function loadQuestionBank() {
    try {
        const response = await fetch(questionBankUrl);
        if (!response.ok) {
            throw new Error(`The question file returned HTTP ${response.status}.`);
        }
        const questionData = await response.json();
        mcqState.questions = validateQuestionBank(questionData);
        fillUnitFilter();
        updateTopicFilter();
        updateMatchCount();
        mcqElements.apply.disabled = false;
    } catch (error) {
        console.error("Unable to load MCQ question bank:", error);
        const details = error instanceof SyntaxError
            ? "The question file contains invalid JSON."
            : error.message || "An unexpected error occurred.";
        showMcqError(`Questions could not be loaded. ${details} Please check the data file and try again.`);
    }
}

mcqElements.unit.addEventListener("change", () => {
    updateTopicFilter();
    updateMatchCount();
});
mcqElements.topic.addEventListener("change", updateMatchCount);
mcqElements.difficulty.addEventListener("change", updateMatchCount);
mcqElements.apply.addEventListener("click", startPractice);
mcqElements.restart.addEventListener("click", () => beginSession(mcqState.sessionMembers));
mcqElements.previous.addEventListener("click", () => {
    if (mcqState.currentIndex > 0) {
        mcqState.currentIndex -= 1;
        mcqState.hintVisible = false;
        renderQuestion();
        mcqElements.question.focus();
    }
});
mcqElements.next.addEventListener("click", () => {
    if (mcqState.currentIndex < mcqState.sessionQuestions.length - 1) {
        mcqState.currentIndex += 1;
        mcqState.hintVisible = false;
        renderQuestion();
        mcqElements.question.focus();
    }
});
mcqElements.showHint.addEventListener("click", () => {
    mcqState.hintVisible = !mcqState.hintVisible;
    renderQuestion();
});
mcqElements.submit.addEventListener("click", () => {
    const question = mcqState.sessionQuestions[mcqState.currentIndex];
    const selectedOptionId = mcqState.selections.get(question.id);
    if (!selectedOptionId || mcqState.results.has(question.id)) return;
    mcqState.results.set(question.id, {
        correct: selectedOptionId === question.correctOptionId
    });
    renderQuestion();
});
mcqElements.finish.addEventListener("click", showSummary);
mcqElements.returnSummaryPractice.addEventListener("click", showSummary);
mcqElements.incorrectList.addEventListener("click", event => {
    const reviewButton = event.target.closest("[data-question-id]");
    if (reviewButton) showReviewQuestion(reviewButton.dataset.questionId);
});
mcqElements.retryIncorrect.addEventListener("click", () => {
    const incorrectQuestions = mcqState.sessionQuestions.filter(question =>
        mcqState.results.has(question.id) && !mcqState.results.get(question.id).correct
    );
    if (incorrectQuestions.length) beginSession(incorrectQuestions);
});
mcqElements.restartSummary.addEventListener("click", () => beginSession(mcqState.sessionMembers));

loadQuestionBank();
