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
const questionTypes = new Set(["single_select", "multi_select"]);
const questionCategories = [
    "Conceptual",
    "Numerical",
    "Application/Scenario-based",
    "GATE PYQ"
];
const unspecifiedValue = "unspecified";

const mcqElements = {
    unit: document.getElementById("unit-filter"),
    topic: document.getElementById("topic-filter"),
    questionType: document.getElementById("question-type-filter"),
    answerFormat: document.getElementById("answer-format-filter"),
    difficulty: document.getElementById("difficulty-filter"),
    count: document.getElementById("question-count"),
    countHelp: document.getElementById("question-count-help"),
    mode: document.getElementById("quiz-mode"),
    examTokenInput: document.getElementById("exam-token-input"),
    loadExamToken: document.getElementById("load-exam-token"),
    examTokenStatus: document.getElementById("exam-token-status"),
    shuffleQuestions: document.getElementById("shuffle-questions"),
    shuffleOptions: document.getElementById("shuffle-options"),
    apply: document.getElementById("apply-filters"),
    resetFilters: document.getElementById("reset-filters"),
    restart: document.getElementById("restart-practice"),
    setup: document.getElementById("practice-setup"),
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
    image: document.getElementById("question-image"),
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
    summaryMode: document.getElementById("summary-mode"),
    summaryNote: document.querySelector("#summary-panel .mcq-note"),
    summaryScoreNote: document.getElementById("summary-score-note"),
    summaryAttempted: document.getElementById("summary-attempted"),
    summaryCorrect: document.getElementById("summary-correct"),
    summaryIncorrect: document.getElementById("summary-incorrect"),
    summaryScore: document.getElementById("summary-score"),
    incorrectReview: document.getElementById("incorrect-review"),
    incorrectList: document.getElementById("incorrect-list"),
    retryIncorrect: document.getElementById("retry-incorrect"),
    restartSummary: document.getElementById("restart-summary"),
    newPractice: document.getElementById("new-practice")
};

const mcqState = {
    questions: [],
    questionBankFingerprint: "",
    filteredQuestions: [],
    sessionQuestions: [],
    sessionMembers: [],
    currentIndex: 0,
    selections: new Map(),
    results: new Map(),
    optionOrder: new Map(),
    hintVisible: false,
    reviewing: false,
    mode: "practice"
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
        if (question.unitId !== undefined && question.unitId !== null
            && (!Number.isInteger(question.unitId) || !unitTitles.has(question.unitId))) {
            throw new Error(`${position} has an invalid syllabus unit.`);
        }
        if ((question.unitTitle !== undefined && typeof question.unitTitle !== "string")
            || (question.unitTitle && question.unitId
                && question.unitTitle !== unitTitles.get(question.unitId))) {
            throw new Error(`${position} has an invalid syllabus unit title.`);
        }
        if ((question.topic !== undefined && question.topic !== null && typeof question.topic !== "string")
            || (question.difficulty !== undefined && question.difficulty !== null
                && typeof question.difficulty !== "string")
            || !questionTypes.has(question.type)
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
        if (question.type === "single_select") {
            if (typeof question.correctOptionId !== "string" || !optionIds.has(question.correctOptionId)
                || question.correctOptionIds !== undefined) {
                throw new Error(`${position} has no matching single correct option ID.`);
            }
        } else if (!Array.isArray(question.correctOptionIds)
            || question.correctOptionIds.length < 2
            || new Set(question.correctOptionIds).size !== question.correctOptionIds.length
            || question.correctOptionIds.some(optionId => !optionIds.has(optionId))
            || question.correctOptionId !== undefined) {
            throw new Error(`${position} must have at least two unique correct option IDs.`);
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
    const hasUnspecifiedUnit = mcqState.questions.some(question =>
        !Number.isInteger(question.unitId) || !unitTitles.has(question.unitId)
    );
    if (hasUnspecifiedUnit) {
        addOption(mcqElements.unit, unspecifiedValue, "Unit not specified");
    }
}

function fillDifficultyFilter() {
    const hasUnspecifiedDifficulty = mcqState.questions.some(question =>
        !allowedDifficulties.has(question.difficulty)
    );
    if (hasUnspecifiedDifficulty) {
        addOption(mcqElements.difficulty, unspecifiedValue, "Unspecified");
    }
}

function getQuestionTopic(question) {
    return typeof question.topic === "string" && question.topic.trim()
        ? question.topic
        : unspecifiedValue;
}

function getQuestionDifficulty(question) {
    return allowedDifficulties.has(question.difficulty)
        ? question.difficulty
        : unspecifiedValue;
}

function getQuestionCategory(question) {
    if (questionCategories.includes(question.questionType)) {
        return question.questionType;
    }
    if (questionCategories.includes(question.category)) {
        return question.category;
    }

    const sourceAndTags = [question.source, question.topic, ...(Array.isArray(question.tags) ? question.tags : [])]
        .filter(value => typeof value === "string")
        .join(" ");
    if (/\b(GATE|PYQ|previous[\s-]*year)\b/i.test(sourceAndTags)) {
        return "GATE PYQ";
    }

    const topic = getQuestionTopic(question);
    const text = `${topic} ${question.question}`;
    if (/\b(numerical|calculation|calculating)\b/i.test(topic)
        || (/\b(calculate|compute|numerical|what is the (?:average|total|value)|how many (?:bits|page faults|cylinders|milliseconds)|how much)\b/i.test(text)
            && /\d/.test(text))) {
        return "Numerical";
    }
    if (/\b(application|scenario|case study|integrated|trade[- ]off)\b/i.test(topic)
        || /\b(suppose|consider a scenario|in this scenario|what should (?:the|an?)|which (?:design|approach|policy|mechanism) should|how would you|most appropriate|best suited)\b/i.test(question.question)) {
        return "Application/Scenario-based";
    }
    return "Conceptual";
}

function matchesNonTopicFilters(question) {
    const selectedUnit = mcqElements.unit.value;
    const selectedCategory = mcqElements.questionType.value;
    const selectedFormat = mcqElements.answerFormat.value;
    const selectedDifficulty = mcqElements.difficulty.value;
    return (selectedUnit === "all"
            || (selectedUnit === unspecifiedValue
                ? !Number.isInteger(question.unitId) || !unitTitles.has(question.unitId)
                : question.unitId === Number(selectedUnit)))
        && (selectedCategory === "all" || getQuestionCategory(question) === selectedCategory)
        && (selectedFormat === "all" || question.type === selectedFormat)
        && (selectedDifficulty === "all"
            || getQuestionDifficulty(question) === selectedDifficulty);
}

function updateTopicFilter() {
    const previousTopic = mcqElements.topic.value;
    const topics = [...new Set(mcqState.questions
        .filter(matchesNonTopicFilters)
        .map(getQuestionTopic))]
        .sort((left, right) => left.localeCompare(right));

    mcqElements.topic.replaceChildren();
    addOption(mcqElements.topic, "all", "All topics");
    topics.forEach(topic => addOption(
        mcqElements.topic,
        topic,
        topic === unspecifiedValue ? "Topic not specified" : topic
    ));
    mcqElements.topic.value = topics.includes(previousTopic) ? previousTopic : "all";
}

function getFilteredQuestions() {
    const selectedTopic = mcqElements.topic.value;
    return mcqState.questions.filter(question => matchesNonTopicFilters(question)
        && (selectedTopic === "all" || getQuestionTopic(question) === selectedTopic));
}

function updateMatchCount() {
    mcqState.filteredQuestions = getFilteredQuestions();
    const count = mcqState.filteredQuestions.length;
    mcqElements.matchCount.textContent = `${count} matching ${count === 1 ? "question" : "questions"}; choose 1–${count}`;
    mcqElements.count.max = String(count);
    updateQuestionCountValidity(count);
    if (count === 0) {
        mcqElements.emptyState.textContent = mcqElements.questionType.value === "GATE PYQ"
            ? "No GATE PYQs are currently identified in this question bank. Add a verified GATE source or question-type label to include one."
            : "No questions match these filters. Change a filter or reset all filters to try again.";
        mcqElements.emptyState.classList.remove("mcq-hidden");
        mcqElements.panel.classList.add("mcq-hidden");
        mcqElements.summary.classList.add("mcq-hidden");
        mcqElements.restart.disabled = true;
    } else {
        mcqElements.emptyState.classList.add("mcq-hidden");
        mcqElements.restart.disabled = mcqState.sessionMembers.length === 0;
    }
}

function updateQuestionCountValidity(matchingCount = mcqState.filteredQuestions.length) {
    const value = mcqElements.count.value;
    const questionCount = Number(value);
    const isValid = value !== ""
        && Number.isInteger(questionCount)
        && questionCount >= 1
        && questionCount <= matchingCount;

    if (matchingCount === 0) {
        mcqElements.countHelp.textContent = "No questions match the current filters.";
    } else if (value === "") {
        mcqElements.countHelp.textContent = `Enter a whole number from 1 to ${matchingCount}.`;
    } else if (!isValid) {
        mcqElements.countHelp.textContent = `Enter a whole number from 1 to ${matchingCount}.`;
    } else {
        mcqElements.countHelp.textContent = `Choose between 1 and ${matchingCount} matching questions.`;
    }

    mcqElements.apply.disabled = !isValid;
}

function shuffle(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
}

function createSeededRandom(seed) {
    let state = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
        state = Math.imul(state ^ seed.charCodeAt(index), 16777619);
    }
    return () => {
        state += 0x6D2B79F5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function seededShuffle(items, seed) {
    const shuffled = [...items];
    const random = createSeededRandom(seed);
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
}

function makeQuestionSet(questions, seed = "") {
    const candidates = seed
        ? seededShuffle(questions, seed)
        : mcqElements.shuffleQuestions.checked ? shuffle(questions) : [...questions];
    const requestedCount = Number(mcqElements.count.value);
    return candidates.slice(0, requestedCount);
}

function getQuestionBankFingerprint(questions) {
    const serialized = JSON.stringify(questions);
    let first = 2166136261;
    let second = 5381;
    for (let index = 0; index < serialized.length; index += 1) {
        const code = serialized.charCodeAt(index);
        first = Math.imul(first ^ code, 16777619);
        second = Math.imul(second, 33) ^ code;
    }
    return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

function decodeExamToken(token) {
    const match = /^FOSD1-([A-Za-z0-9_-]+)$/.exec(token.trim());
    if (!match || token.length > 2048) {
        throw new Error("The exam token is invalid or unsupported.");
    }
    const base64 = match[1].replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const configuration = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
        throw new Error("The exam token does not contain a valid configuration.");
    }
    return configuration;
}

function loadExamToken() {
    const configuration = decodeExamToken(mcqElements.examTokenInput.value);
    const validUnits = new Set(["all", unspecifiedValue, ...[...unitTitles.keys()].map(String)]);
    const validCount = configuration.count === "all"
        || (typeof configuration.count === "string" && /^\d+$/.test(configuration.count));
    if (configuration.version !== 1
        || configuration.bank !== mcqState.questionBankFingerprint
        || typeof configuration.seed !== "string"
        || !configuration.seed.trim()
        || configuration.seed.length > 80
        || !validUnits.has(configuration.unit)
        || typeof configuration.topic !== "string"
        || !["all", ...questionCategories].includes(configuration.category)
        || !["all", ...questionTypes].includes(configuration.format)
        || !["all", unspecifiedValue, ...allowedDifficulties].includes(configuration.difficulty)
        || !validCount) {
        throw new Error("This token is invalid, uses an unsupported version, or does not match the current question bank.");
    }

    mcqElements.unit.value = configuration.unit;
    mcqElements.questionType.value = configuration.category;
    mcqElements.answerFormat.value = configuration.format;
    mcqElements.difficulty.value = configuration.difficulty;
    updateTopicFilter();
    if (![...mcqElements.topic.options].some(option => option.value === configuration.topic)) {
        throw new Error("This token refers to a topic that is not available in the current question bank.");
    }
    mcqElements.topic.value = configuration.topic;
    const matchingQuestions = getFilteredQuestions();
    const requestedCount = configuration.count === "all"
        ? matchingQuestions.length
        : Number(configuration.count);
    if (!Number.isInteger(requestedCount)
        || requestedCount < 1
        || requestedCount > matchingQuestions.length) {
        throw new Error("The question count in this token must be between 1 and the number of questions matching its filters.");
    }
    mcqElements.count.value = String(requestedCount);
    mcqElements.mode.value = "exam";
    mcqElements.apply.textContent = "Start exam";

    mcqElements.loadError.classList.add("mcq-hidden");
    updateMatchCount();
    beginSession(makeQuestionSet(matchingQuestions, configuration.seed));
}

function beginSession(questions) {
    mcqState.mode = mcqElements.mode.value;
    mcqState.sessionQuestions = [...questions];
    if (mcqState.mode === "exam" || mcqElements.shuffleQuestions.checked) {
        mcqState.sessionQuestions = shuffle(mcqState.sessionQuestions);
    }
    mcqState.sessionMembers = [...mcqState.sessionQuestions];
    mcqState.currentIndex = 0;
    mcqState.selections.clear();
    mcqState.results.clear();
    mcqState.optionOrder.clear();
    mcqState.sessionQuestions.forEach(question => {
        const options = mcqState.mode === "exam" || mcqElements.shuffleOptions.checked
            ? shuffle(question.options)
            : [...question.options];
        mcqState.optionOrder.set(question.id, options);
    });
    mcqState.hintVisible = false;
    mcqState.reviewing = false;
    mcqElements.setup.classList.add("mcq-hidden");
    mcqElements.summary.classList.add("mcq-hidden");
    mcqElements.panel.classList.remove("mcq-hidden");
    mcqElements.returnSummaryPractice.classList.add("mcq-hidden");
    mcqElements.submit.classList.toggle("mcq-hidden", mcqState.mode === "exam");
    mcqElements.showHint.classList.toggle("mcq-hidden", mcqState.mode === "exam");
    mcqElements.finish.textContent = mcqState.mode === "exam" ? "Submit exam" : "Finish practice";
    mcqElements.restart.disabled = false;
    mcqElements.emptyState.classList.add("mcq-hidden");
    renderQuestion();
    mcqElements.question.focus();
}

function setElementText(element, text) {
    element.textContent = text;
}

function getSelectedOptionIds(question) {
    const selection = mcqState.selections.get(question.id);
    if (question.type === "multi_select") {
        return Array.isArray(selection) ? selection : [];
    }
    return typeof selection === "string" ? [selection] : [];
}

function hasAnswerSelection(question) {
    return getSelectedOptionIds(question).length > 0;
}

function isAnswerCorrect(question, selectedOptionIds) {
    if (question.type === "multi_select") {
        const selected = new Set(selectedOptionIds);
        return selected.size === question.correctOptionIds.length
            && question.correctOptionIds.every(optionId => selected.has(optionId));
    }
    return selectedOptionIds.length === 1
        && selectedOptionIds[0] === question.correctOptionId;
}

function getCorrectOptionIds(question) {
    return question.type === "multi_select"
        ? question.correctOptionIds
        : [question.correctOptionId];
}

function getValidQuestionImage(image) {
    if (!image || typeof image !== "object" || Array.isArray(image)
        || typeof image.src !== "string" || !image.src.trim()
        || typeof image.alt !== "string" || !image.alt.trim()) {
        return null;
    }

    const source = image.src.trim();
    const isAbsoluteUrl = /^[a-z][a-z\d+.-]*:/i.test(source);
    let imageUrl;
    try {
        imageUrl = new URL(source, document.baseURI);
    } catch {
        return null;
    }
    if ((isAbsoluteUrl && !["http:", "https:"].includes(imageUrl.protocol))
        || (!isAbsoluteUrl && (source.startsWith("/") || source.startsWith("\\")))
        || !/\.(png|jpe?g|webp|svg)$/i.test(imageUrl.pathname)) {
        return null;
    }

    return {
        src: imageUrl.href,
        alt: image.alt.trim(),
        caption: typeof image.caption === "string" ? image.caption.trim() : ""
    };
}

function renderQuestionImage(imageMetadata, questionId) {
    const image = getValidQuestionImage(imageMetadata);
    mcqElements.image.replaceChildren();
    mcqElements.image.classList.add("mcq-hidden");
    if (!image) {
        if (imageMetadata !== undefined && imageMetadata !== null) {
            console.warn(`Ignoring invalid image metadata for question ${questionId}.`);
        }
        return;
    }

    const imageElement = document.createElement("img");
    imageElement.alt = image.alt;
    imageElement.decoding = "async";
    imageElement.referrerPolicy = "no-referrer";
    imageElement.addEventListener("load", () => {
        if (mcqElements.image.querySelector("img") === imageElement) {
            mcqElements.image.classList.remove("mcq-hidden");
        }
    }, { once: true });
    imageElement.addEventListener("error", () => {
        if (mcqElements.image.querySelector("img") === imageElement) {
            mcqElements.image.replaceChildren();
            mcqElements.image.classList.add("mcq-hidden");
            console.warn(`Unable to load the optional image for question ${questionId}.`);
        }
    }, { once: true });

    if (image.caption) {
        const caption = document.createElement("figcaption");
        caption.textContent = image.caption;
        mcqElements.image.append(imageElement, caption);
    } else {
        mcqElements.image.append(imageElement);
    }
    imageElement.src = image.src;
}

function renderQuestion() {
    const question = mcqState.sessionQuestions[mcqState.currentIndex];
    if (!question) {
        mcqElements.panel.classList.add("mcq-hidden");
        return;
    }

    const answerResult = mcqState.results.get(question.id);
    const selectedOptionIds = getSelectedOptionIds(question);
    const correctOptionIds = new Set(getCorrectOptionIds(question));
    setElementText(
        mcqElements.progressText,
        `Question ${mcqState.currentIndex + 1} of ${mcqState.sessionQuestions.length} · ${
            mcqState.mode === "exam" ? `${mcqState.selections.size} answered` : `${mcqState.results.size} submitted`
        }`
    );
    mcqElements.progress.max = mcqState.sessionQuestions.length;
    mcqElements.progress.value = mcqState.currentIndex + 1;
    setElementText(mcqElements.difficultyLabel, question.difficulty || "Difficulty not specified");
    setElementText(
        mcqElements.topicLabel,
        `${Number.isInteger(question.unitId) ? `Unit ${question.unitId}` : "Unit not specified"} · ${getQuestionTopic(question)} · ${getQuestionCategory(question)}`
    );
    setElementText(mcqElements.question, question.question);
    renderQuestionImage(question.image, question.id);
    mcqElements.tags.replaceChildren();
    const unitTitle = question.unitTitle
        || (Number.isInteger(question.unitId) ? unitTitles.get(question.unitId) : "")
        || "Unit not specified";
    [
        unitTitle,
        getQuestionCategory(question),
        question.type === "multi_select" ? "Multi-select" : "Single-select",
        ...question.tags
    ].forEach(tag => {
        const tagElement = document.createElement("span");
        tagElement.className = "mcq-tag";
        tagElement.textContent = tag;
        mcqElements.tags.append(tagElement);
    });

    mcqElements.options.replaceChildren();
    const legend = document.createElement("legend");
    legend.className = question.type === "multi_select" ? "mcq-option-instructions" : "mcq-visually-hidden";
    legend.textContent = question.type === "multi_select"
        ? "Select all that apply. All correct options must be selected."
        : "Choose one answer";
    mcqElements.options.append(legend);
    const optionOrder = mcqState.optionOrder.get(question.id) || question.options;
    optionOrder.forEach(option => {
        const label = document.createElement("label");
        label.className = "mcq-option";
        if (answerResult && correctOptionIds.has(option.id)) {
            label.classList.add("is-correct");
        }
        if (answerResult && selectedOptionIds.includes(option.id) && !correctOptionIds.has(option.id)) {
            label.classList.add("is-incorrect");
        }
        const input = document.createElement("input");
        input.type = question.type === "multi_select" ? "checkbox" : "radio";
        input.name = question.type === "multi_select"
            ? `answer-${question.id}-${option.id}`
            : `answer-${question.id}`;
        input.value = option.id;
        input.checked = selectedOptionIds.includes(option.id);
        input.disabled = Boolean(answerResult);
        input.addEventListener("change", () => {
            if (question.type === "multi_select") {
                const updatedSelection = new Set(getSelectedOptionIds(question));
                if (input.checked) updatedSelection.add(option.id);
                else updatedSelection.delete(option.id);
                mcqState.selections.set(question.id, [...updatedSelection]);
            } else {
                mcqState.selections.set(question.id, option.id);
            }
            if (mcqState.mode === "exam") {
                setElementText(
                    mcqElements.progressText,
                    `Question ${mcqState.currentIndex + 1} of ${mcqState.sessionQuestions.length} · ${mcqState.selections.size} answered`
                );
            }
            mcqElements.submit.disabled = !hasAnswerSelection(question);
            mcqElements.options.querySelectorAll(".mcq-option").forEach((optionLabel, index) => {
                const orderedOption = optionOrder[index];
                optionLabel.classList.toggle("is-selected", getSelectedOptionIds(question).includes(orderedOption.id));
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
        const correctAnswers = question.options
            .filter(option => correctOptionIds.has(option.id))
            .map(option => option.text)
            .join("; ");
        const correctAnswerLabel = question.type === "multi_select" ? "Correct answers:" : "Correct answer:";
        mcqElements.feedback.textContent = `${answerResult.correct ? "Correct." : "Not quite."} ${correctAnswerLabel} ${correctAnswers} Explanation: ${question.explanation}`;
        mcqElements.feedback.dataset.result = answerResult.correct ? "correct" : "incorrect";
        mcqElements.feedback.classList.remove("mcq-hidden");
    } else {
        mcqElements.feedback.textContent = "";
        delete mcqElements.feedback.dataset.result;
        mcqElements.feedback.classList.add("mcq-hidden");
    }

    mcqElements.hint.textContent = question.hint || "No hint is available for this question.";
    mcqElements.hint.classList.toggle("mcq-hidden", !mcqState.hintVisible);
    mcqElements.showHint.disabled = !question.hint || mcqState.mode === "exam";
    mcqElements.showHint.textContent = mcqState.hintVisible ? "Hide hint" : "Show hint";
    mcqElements.previous.disabled = mcqState.currentIndex === 0;
    mcqElements.next.disabled = mcqState.currentIndex === mcqState.sessionQuestions.length - 1;
    mcqElements.submit.disabled = Boolean(answerResult) || !hasAnswerSelection(question);
    mcqElements.returnSummaryPractice.classList.toggle("mcq-hidden", !mcqState.reviewing);
}

function showSummary() {
    const total = mcqState.sessionQuestions.length;
    if (mcqState.mode === "exam") {
        mcqState.sessionQuestions.forEach(question => {
            const selectedOptionIds = getSelectedOptionIds(question);
            mcqState.results.set(question.id, {
                correct: selectedOptionIds.length > 0 && isAnswerCorrect(question, selectedOptionIds)
            });
        });
    }
    const attempted = mcqState.mode === "exam"
        ? mcqState.sessionQuestions.filter(question => hasAnswerSelection(question)).length
        : mcqState.results.size;
    const correct = [...mcqState.results.values()].filter(result => result.correct).length;
    const incorrectQuestions = mcqState.sessionQuestions.filter(question =>
        mcqState.results.has(question.id) && !mcqState.results.get(question.id).correct
    );
    const percentageDenominator = mcqState.mode === "exam" ? total : attempted;
    const percentage = percentageDenominator ? Math.round((correct / percentageDenominator) * 100) : 0;

    setElementText(mcqElements.summaryAttempted, `${attempted} / ${total}`);
    setElementText(mcqElements.summaryCorrect, String(correct));
    setElementText(mcqElements.summaryIncorrect, String(incorrectQuestions.length));
    setElementText(mcqElements.summaryScore, `${percentage}%`);
    setElementText(
        mcqElements.summaryMode,
        mcqState.mode === "exam" ? "Exam results" : "Personal practice summary"
    );
    setElementText(
        mcqElements.summaryNote,
        mcqState.mode === "exam"
            ? "Your score is based on all questions; unanswered questions count as incorrect. This result is not transmitted or recorded."
            : "This score is only for your own learning and is not submitted or recorded."
    );
    setElementText(
        mcqElements.summaryScoreNote,
        mcqState.mode === "exam"
            ? "The percentage is based on all questions in the exam."
            : "The percentage is based on attempted questions; unanswered questions are not included."
    );
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
    mcqElements.setup.classList.add("mcq-hidden");
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
    const requestedCount = Number(mcqElements.count.value);
    if (!Number.isInteger(requestedCount)
        || requestedCount < 1
        || requestedCount > mcqState.filteredQuestions.length) {
        updateMatchCount();
        mcqElements.count.focus();
        return;
    }
    beginSession(makeQuestionSet(mcqState.filteredQuestions));
}

function showPracticeSetup() {
    mcqState.reviewing = false;
    mcqElements.panel.classList.add("mcq-hidden");
    mcqElements.summary.classList.add("mcq-hidden");
    mcqElements.setup.classList.remove("mcq-hidden");
    mcqElements.restart.disabled = true;
    mcqElements.apply.focus();
}

async function loadQuestionBank() {
    try {
        const response = await fetch(questionBankUrl);
        if (!response.ok) {
            throw new Error(`The question file returned HTTP ${response.status}.`);
        }
        const questionData = await response.json();
        mcqState.questions = validateQuestionBank(questionData);
        mcqState.questionBankFingerprint = getQuestionBankFingerprint(mcqState.questions);
        fillUnitFilter();
        fillDifficultyFilter();
        updateTopicFilter();
        updateMatchCount();
        if (!mcqElements.count.value && mcqState.filteredQuestions.length > 0) {
            mcqElements.count.value = String(mcqState.filteredQuestions.length);
            updateQuestionCountValidity();
        }
        mcqElements.loadExamToken.disabled = false;
    } catch (error) {
        console.error("Unable to load MCQ question bank:", error);
        const details = error instanceof SyntaxError
            ? "The question file contains invalid JSON."
            : error.message || "An unexpected error occurred.";
        showMcqError(`Questions could not be loaded. ${details} Please check the data file and try again.`);
    }
}

function refreshFilters() {
    updateTopicFilter();
    updateMatchCount();
}

mcqElements.unit.addEventListener("change", refreshFilters);
mcqElements.topic.addEventListener("change", updateMatchCount);
mcqElements.questionType.addEventListener("change", refreshFilters);
mcqElements.answerFormat.addEventListener("change", refreshFilters);
mcqElements.difficulty.addEventListener("change", refreshFilters);
mcqElements.count.addEventListener("input", () => updateQuestionCountValidity());
mcqElements.resetFilters.addEventListener("click", () => {
    mcqElements.unit.value = "all";
    mcqElements.questionType.value = "all";
    mcqElements.answerFormat.value = "all";
    mcqElements.difficulty.value = "all";
    mcqElements.topic.value = "all";
    refreshFilters();
});
mcqElements.apply.addEventListener("click", startPractice);
mcqElements.mode.addEventListener("change", () => {
    mcqElements.apply.textContent = mcqElements.mode.value === "exam" ? "Start exam" : "Start practice";
});
mcqElements.loadExamToken.addEventListener("click", () => {
    try {
        loadExamToken();
        mcqElements.examTokenStatus.textContent = "Exam token loaded. Your question and option order is randomized for this session.";
        mcqElements.examTokenStatus.dataset.result = "success";
        mcqElements.examTokenStatus.classList.remove("mcq-hidden");
    } catch (error) {
        mcqElements.examTokenStatus.textContent = error.message || "The exam token could not be loaded.";
        mcqElements.examTokenStatus.dataset.result = "error";
        mcqElements.examTokenStatus.classList.remove("mcq-hidden");
    }
});
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
    const selectedOptionIds = getSelectedOptionIds(question);
    if (!selectedOptionIds.length || mcqState.results.has(question.id)) return;
    mcqState.results.set(question.id, {
        correct: isAnswerCorrect(question, selectedOptionIds)
    });
    renderQuestion();
});
mcqElements.finish.addEventListener("click", showSummary);
mcqElements.returnSummaryPractice.addEventListener("click", showSummary);
mcqElements.newPractice.addEventListener("click", showPracticeSetup);
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
