"use strict";

const GAS_API_URL =
  "https://script.google.com/a/macros/charusat.ac.in/s/AKfycbz9HdHvpuIC2XRbSvdZyO1bKyWEejoGlRwn-5hMiXHnLgAPs8L9WkP_nRTTIXudRwS_/exec";
// Public OAuth Web Client ID (not a secret). Must match Script Property GOOGLE_CLIENT_ID.
const GOOGLE_CLIENT_ID =
  "804888875561-fl4rd9n8m5lupu6b07r3vudq3d8v8rqk.apps.googleusercontent.com";
let googleIdToken = "";
let signedInEmail = "";
const examElements = {
  form: document.getElementById("exam-token-form"),
  token: document.getElementById("exam-token"),
  signInButton: document.getElementById("google-signin-button"),
  authStatus: document.getElementById("auth-status"),
  start: document.getElementById("start-exam"),
  status: document.getElementById("exam-status"),
  content: document.getElementById("exam-content"),
  title: document.getElementById("quiz-title"),
  progressText: document.getElementById("question-progress"),
  progress: document.getElementById("exam-progress"),
  unit: document.getElementById("question-unit"),
  topic: document.getElementById("question-topic"),
  difficulty: document.getElementById("question-difficulty"),
  question: document.getElementById("question-text"),
  legend: document.getElementById("answer-legend"),
  options: document.getElementById("answer-options"),
  previous: document.getElementById("previous-question"),
  next: document.getElementById("next-question"),
  unansweredCount: document.getElementById("unanswered-count"),
  unansweredList: document.getElementById("unanswered-list"),
  submit: document.getElementById("submit-exam"),
  results: document.getElementById("exam-results"),
  resultSummary: document.getElementById("exam-result-summary"),
  resultReview: document.getElementById("exam-result-review"),
};

const examState = {
  attemptId: "",
  questions: [],
  currentIndex: 0,
  answers: new Map(),
  dirtyAnswers: new Map(),
  saveTimer: null,
  saveInFlight: null,
  busy: false,
  submitted: false,
  deadlineAt: 0,
  deadlineTimer: null,
  deadlineCheckInFlight: false,
};

examElements.start.disabled = true;

const validQuestionTypes = new Set(["single_select", "multi_select"]);
const gradingKeys = new Set([
  "correctOptionId",
  "correctOptionIds",
  "correctAnswer",
  "correctAnswers",
  "answerKey",
  "isCorrect",
  "grading",
  "score",
]);

function setStatus(message, state = "info") {
  examElements.status.textContent = message;
  examElements.status.dataset.state = state;
}

function containsGradingData(value) {
  if (Array.isArray(value)) {
    return value.some(containsGradingData);
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  return Object.entries(value).some(
    ([key, entry]) => gradingKeys.has(key) || containsGradingData(entry),
  );
}

function validateQuestions(responseData) {
  if (
    !responseData ||
    typeof responseData !== "object" ||
    Array.isArray(responseData) ||
    !Array.isArray(responseData.questions) ||
    responseData.questions.length === 0
  ) {
    throw new Error(
      "The API response does not contain a non-empty questions array.",
    );
  }
  if (containsGradingData(responseData)) {
    throw new Error(
      "The backend returned answer-key or grading fields before submission. Remove these fields from the exam response.",
    );
  }

  const questionIds = new Set();
  responseData.questions.forEach((question, index) => {
    if (
      !question ||
      typeof question !== "object" ||
      Array.isArray(question) ||
      (typeof question.id !== "string" && typeof question.id !== "number") ||
      questionIds.has(String(question.id)) ||
      typeof question.question !== "string" ||
      !question.question.trim() ||
      !validQuestionTypes.has(question.type) ||
      !Array.isArray(question.options) ||
      question.options.length < 2
    ) {
      throw new Error(
        `Question ${index + 1} has an invalid ID, text, type, or options.`,
      );
    }
    questionIds.add(String(question.id));
    const optionIds = new Set();
    question.options.forEach((option, optionIndex) => {
      if (
        !option ||
        typeof option !== "object" ||
        Array.isArray(option) ||
        (typeof option.id !== "string" && typeof option.id !== "number") ||
        optionIds.has(String(option.id)) ||
        typeof option.text !== "string"
      ) {
        throw new Error(
          `Question ${index + 1}, option ${optionIndex + 1} has an invalid ID or text.`,
        );
      }
      optionIds.add(String(option.id));
    });
  });
  return responseData.questions;
}

function getErrorMessage(data) {
  const text =
    typeof data?.message === "string"
      ? data.message
      : typeof data?.error === "string"
        ? data.error
        : "";
  if (
    data?.active === false ||
    data?.quiz?.active === false ||
    /inactive|not active|expired|closed/i.test(text)
  ) {
    return text || "This quiz is inactive or no longer available.";
  }
  if (/invalid token|unknown token|token not found/i.test(text)) {
    return text || "The quiz token is invalid.";
  }
  return text || "The exam service could not complete the request.";
}

async function requestJson(url, options, action) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error(
      `Could not reach the exam service. Check the network and Apps Script deployment access. ${error.message || ""}`.trim(),
    );
  }
  if (
    response.redirected &&
    new URL(response.url).hostname === "accounts.google.com"
  ) {
    throw new Error(
      "The Apps Script Web App redirected to Google sign-in. Check its student-facing deployment access.",
    );
  }
  if (!response.ok) {
    throw new Error(
      `The exam service returned HTTP ${response.status} for ${action}.`,
    );
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("json")) {
    throw new Error(`The exam service did not return JSON for ${action}.`);
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`The exam service returned malformed JSON for ${action}.`);
  }
  if (!data || typeof data !== "object" || data.error || data.ok === false) {
    throw new Error(getErrorMessage(data));
  }
  return data;
}

function decodeJwtPayload(jwt) {
  try {
    const part = jwt.split(".")[1];
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(
      decodeURIComponent(
        Array.from(
          atob(base64),
          (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"),
        ).join(""),
      ),
    );
  } catch {
    return {};
  }
}

function setAuthenticated(credential) {
  if (!credential || typeof credential.credential !== "string") {
    throw new Error("Google did not return a valid sign-in credential.");
  }
  googleIdToken = credential.credential;
  const claims = decodeJwtPayload(googleIdToken);
  signedInEmail =
    typeof claims.email === "string" ? claims.email : "your Google account";
  examElements.authStatus.textContent = `Signed in as ${signedInEmail}. The server will verify your institutional account and student-list eligibility.`;
  examElements.authStatus.dataset.state = "success";
  examElements.start.disabled = false;
}

function initializeGoogleIdentity() {
  if (!window.google?.accounts?.id) {
    examElements.authStatus.textContent =
      "Google Sign-In could not be loaded. Check your network or browser settings.";
    examElements.authStatus.dataset.state = "error";
    return;
  }
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.startsWith("YOUR_")) {
    examElements.authStatus.textContent =
      "Google Sign-In needs configuration: set GOOGLE_CLIENT_ID in exam.js.";
    examElements.authStatus.dataset.state = "error";
    return;
  }
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => {
      try {
        setAuthenticated(response);
      } catch (error) {
        googleIdToken = "";
        examElements.start.disabled = true;
        examElements.authStatus.textContent = error.message;
        examElements.authStatus.dataset.state = "error";
      }
    },
    auto_select: false,
    cancel_on_tap_outside: true,
  });
  window.google.accounts.id.renderButton(examElements.signInButton, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "signin_with",
    shape: "rectangular",
    width: 280,
  });
  examElements.authStatus.textContent =
    "Sign in using your institutional Google Workspace account.";
  examElements.authStatus.dataset.state = "info";
}

window.handleGoogleCredential = setAuthenticated;
if (document.readyState === "complete") {
  initializeGoogleIdentity();
} else {
  window.addEventListener("load", initializeGoogleIdentity, { once: true });
}

async function postAction(payload) {
  if (!googleIdToken) {
    throw new Error(
      "Sign in with your institutional Google account before continuing.",
    );
  }
  return requestJson(
    GAS_API_URL,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "text/plain;charset=UTF-8",
      },
      body: JSON.stringify({ ...payload, idToken: googleIdToken }),
      redirect: "follow",
    },
    payload.action,
  );
}

function renderQuestion() {
  const question = examState.questions[examState.currentIndex];
  if (!question) {
    return;
  }

  examElements.progressText.textContent = `Question ${examState.currentIndex + 1} of ${examState.questions.length}`;
  examElements.progress.max = examState.questions.length;
  examElements.progress.value = examState.currentIndex + 1;
  examElements.unit.textContent =
    question.unitTitle ||
    (question.unitId !== undefined ? `Unit ${question.unitId}` : "");
  examElements.topic.textContent = question.topic || "";
  examElements.difficulty.textContent = question.difficulty || "";
  examElements.question.textContent = question.question;
  examElements.legend.textContent =
    question.type === "multi_select"
      ? "Select all that apply"
      : "Choose one answer";
  examElements.options.replaceChildren(examElements.legend);

  const currentAnswer = examState.answers.get(String(question.id));
  question.options.forEach((option) => {
    const optionId = String(option.id);
    const label = document.createElement("label");
    label.className = "mcq-option";
    const input = document.createElement("input");
    input.type = question.type === "multi_select" ? "checkbox" : "radio";
    input.name = `answer-${question.id}`;
    input.value = optionId;
    input.disabled = examState.busy;
    input.checked =
      question.type === "multi_select"
        ? Array.isArray(currentAnswer) && currentAnswer.includes(optionId)
        : currentAnswer === optionId;
    input.addEventListener("change", () => {
      let selectedOptionIds;
      if (question.type === "multi_select") {
        const selected = new Set(
          examState.answers.get(String(question.id)) || [],
        );
        if (input.checked) {
          selected.add(optionId);
        } else {
          selected.delete(optionId);
        }
        selectedOptionIds = [...selected];
        examState.answers.set(String(question.id), selectedOptionIds);
      } else {
        selectedOptionIds = [optionId];
        examState.answers.set(String(question.id), optionId);
      }
      label.classList.toggle("is-selected", input.checked);
      updateUnanswered();
      queueAnswerSave(question, selectedOptionIds);
    });
    const text = document.createElement("span");
    text.textContent = option.text;
    label.classList.toggle("is-selected", input.checked);
    label.append(input, text);
    examElements.options.append(label);
  });

  examElements.previous.disabled =
    examState.busy || examState.currentIndex === 0;
  examElements.next.disabled =
    examState.busy || examState.currentIndex === examState.questions.length - 1;
  examElements.question.focus();
}

function hasAnswer(question) {
  const answer = examState.answers.get(String(question.id));
  return Array.isArray(answer) ? answer.length > 0 : typeof answer === "string";
}

function updateUnanswered() {
  const unanswered = examState.questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => !hasAnswer(question));
  examElements.unansweredCount.textContent = unanswered.length
    ? `${unanswered.length} question${unanswered.length === 1 ? "" : "s"} unanswered. Select a number to review.`
    : "All questions have an answer.";
  examElements.unansweredList.replaceChildren();
  unanswered.forEach(({ index }) => {
    const button = document.createElement("button");
    button.className = "btn exam-question-jump";
    button.type = "button";
    button.textContent = String(index + 1);
    button.disabled = examState.busy;
    button.setAttribute(
      "aria-label",
      `Review unanswered question ${index + 1}`,
    );
    button.addEventListener("click", () => {
      examState.currentIndex = index;
      renderQuestion();
    });
    examElements.unansweredList.append(button);
  });
}

function setBusy(busy) {
  examState.busy = busy;
  examElements.submit.disabled = busy || examState.submitted;
  examElements.previous.disabled = busy || examState.currentIndex === 0;
  examElements.next.disabled =
    busy || examState.currentIndex === examState.questions.length - 1;
  examElements.options.querySelectorAll("input").forEach((input) => {
    input.disabled = busy || examState.submitted;
  });
  examElements.unansweredList.querySelectorAll("button").forEach((button) => {
    button.disabled = busy;
  });
}

// Debounce answer persistence: one batched Apps Script request instead of one
// serialized request per selection. The in-memory answer map remains the source
// of truth for the current page; dirtyAnswers contains changes not yet confirmed
// by the server.
function queueAnswerSave(question, selectedOptionIds) {
  const questionId = String(question.id);
  const optionIds = Array.isArray(selectedOptionIds)
    ? [...selectedOptionIds].map(String)
    : [];

  examState.dirtyAnswers.set(questionId, optionIds);

  if (examState.saveTimer !== null) {
    clearTimeout(examState.saveTimer);
  }
  examState.saveTimer = setTimeout(() => {
    examState.saveTimer = null;
    flushAnswerSaves().catch((error) => {
      console.error("Unable to autosave answers:", error);
      if (!examState.busy && !examState.submitted) {
        setStatus(
          `Answer is retained on this page but server sync failed: ${error.message}. Submission will retry the save.`,
          "error",
        );
      }
    });
  }, 700);

  setStatus("Answer recorded. Saving in background…", "loading");
}

async function flushAnswerSaves() {
  if (examState.saveTimer !== null) {
    clearTimeout(examState.saveTimer);
    examState.saveTimer = null;
  }

  // Loop until every edit is acknowledged. The loop also serializes concurrent
  // timer/submit flushes so two requests cannot overwrite each other's snapshots.
  while (true) {
    if (examState.saveInFlight) {
      await examState.saveInFlight;
      continue;
    }
    if (examState.dirtyAnswers.size === 0) return;

    const batch = [...examState.dirtyAnswers.entries()].map(
      ([questionId, optionIds]) => ({
        questionId,
        optionIds: [...optionIds],
      }),
    );
    // Remove only the snapshot being sent. New edits made during the request stay dirty.
    batch.forEach(({ questionId }) =>
      examState.dirtyAnswers.delete(questionId),
    );

    const request = postAction({
      action: "saveAnswersBatch",
      attemptId: examState.attemptId,
      answers: batch,
    });
    examState.saveInFlight = request;

    try {
      const result = await request;
      if (result.saved !== true || result.ok !== true) {
        throw new Error("The server did not confirm saving the answers.");
      }
      if (!examState.busy && !examState.submitted) {
        setStatus("Answers saved. You can continue the exam.", "success");
      }
    } catch (error) {
      // Restore failed entries unless a newer selection for that question exists.
      batch.forEach(({ questionId, optionIds }) => {
        if (!examState.dirtyAnswers.has(questionId)) {
          examState.dirtyAnswers.set(questionId, optionIds);
        }
      });
      throw error;
    } finally {
      if (examState.saveInFlight === request) {
        examState.saveInFlight = null;
      }
    }
  }
}
async function checkExamDeadline() {
  if (
    examState.submitted ||
    !examState.attemptId ||
    !examState.deadlineAt ||
    Date.now() < examState.deadlineAt ||
    examState.deadlineCheckInFlight
  ) {
    return;
  }

  examState.deadlineCheckInFlight = true;
  try {
    const status = await postAction({
      action: "checkAttempt",
      attemptId: examState.attemptId,
    });
    if (status.submitted && status.result) {
      renderResults(status.result);
      setStatus(
        "The examination deadline has passed. Your last server-saved answers were submitted automatically.",
        "success",
      );
    }
  } catch (error) {
    // The server-side scheduled sweep still finalizes the attempt.
    console.warn("Deadline status check could not reach the server:", error);
  } finally {
    examState.deadlineCheckInFlight = false;
  }
}

function startExam(attempt) {
  if (typeof attempt.attemptId !== "string" || !attempt.attemptId) {
    throw new Error("The exam service did not return an attempt ID.");
  }
  examState.attemptId = attempt.attemptId;
  examState.questions = validateQuestions(attempt);
  examState.currentIndex = 0;
  examState.answers.clear();
  examState.dirtyAnswers.clear();
  examState.saveInFlight = null;
  if (examState.saveTimer !== null) {
    clearTimeout(examState.saveTimer);
    examState.saveTimer = null;
  }
  if (examState.deadlineTimer !== null) {
    clearInterval(examState.deadlineTimer);
    examState.deadlineTimer = null;
  }

  // Restore the last answers acknowledged by the server when resuming.
  (Array.isArray(attempt.answers) ? attempt.answers : []).forEach((saved) => {
    const qid = String(saved.questionId);
    const question = examState.questions.find((q) => String(q.id) === qid);
    const ids = Array.isArray(saved.optionIds)
      ? saved.optionIds.map(String)
      : [];
    if (!question || !ids.length) return;
    examState.answers.set(qid, question.type === "multi_select" ? ids : ids[0]);
  });

  examState.deadlineAt = attempt.deadlineAt
    ? Date.parse(attempt.deadlineAt)
    : 0;
  if (!Number.isFinite(examState.deadlineAt)) examState.deadlineAt = 0;
  examState.submitted = false;
  examElements.token.readOnly = true;
  examElements.start.disabled = true;
  examElements.title.textContent =
    typeof attempt.title === "string" ? attempt.title : "Faculty-issued exam";
  examElements.content.classList.remove("mcq-hidden");
  examElements.results.classList.add("mcq-hidden");
  examElements.submit.disabled = false;
  renderQuestion();
  updateUnanswered();

  if (examState.deadlineAt) {
    examState.deadlineTimer = setInterval(checkExamDeadline, 10000);
    checkExamDeadline();
  }
}

function renderResults(result) {
  if (
    !result ||
    result.submitted !== true ||
    !Number.isFinite(Number(result.score)) ||
    !Number.isFinite(Number(result.total)) ||
    !Number.isFinite(Number(result.percentage)) ||
    !Number.isFinite(Number(result.attempted)) ||
    !Number.isFinite(Number(result.unanswered)) ||
    !Number.isFinite(Number(result.incorrect))
  ) {
    throw new Error("The server returned an incomplete submission result.");
  }

  // Display score and summary statistics only.
  examElements.resultSummary.replaceChildren();

  const score = document.createElement("p");
  score.className = "exam-score";
  score.textContent = `Score: ${result.score} / ${result.total}`;

  const details = document.createElement("p");
  details.textContent =
    `${result.percentage}% · ${result.attempted} attempted · ` +
    `${result.unanswered} unanswered · ${result.incorrect} incorrect`;

  examElements.resultSummary.append(score, details);

  // Never render question reviews or answer-key information.
  examElements.resultReview.replaceChildren();

  examElements.content.classList.add("mcq-hidden");
  examElements.results.classList.remove("mcq-hidden");

  examState.submitted = true;
  if (examState.deadlineTimer !== null) {
    clearInterval(examState.deadlineTimer);
    examState.deadlineTimer = null;
  }
}

examElements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = examElements.token.value.trim();
  if (!token) {
    setStatus("Enter a quiz token.", "error");
    examElements.token.focus();
    return;
  }
  examElements.start.disabled = true;
  examElements.content.classList.add("mcq-hidden");
  setStatus("Starting your exam…", "loading");
  try {
    const attempt = await postAction({
      action: "startAttempt",
      token,
    });
    if (attempt.alreadySubmitted) {
      examElements.content.classList.add("mcq-hidden");
      examElements.results.classList.remove("mcq-hidden");
      examElements.start.disabled = true;

      renderResults(attempt.result);

      setStatus(
        "This quiz has already been submitted. Showing your saved result.",
        "success",
      );
      return;
    }

    startExam(attempt);
    setStatus(
      attempt.resumed
        ? "Your previous attempt has been resumed. Previously saved answers have been restored."
        : "Exam started. Your answers will be saved as you go.",
      "success",
    );
  } catch (error) {
    console.error("Unable to start exam:", error);
    setStatus(
      error.message || "An unexpected error occurred while starting the exam.",
      "error",
    );
    examElements.start.disabled = false;
  }
});

examElements.previous.addEventListener("click", () => {
  if (!examState.busy && examState.currentIndex > 0) {
    examState.currentIndex -= 1;
    renderQuestion();
  }
});
examElements.next.addEventListener("click", () => {
  if (
    !examState.busy &&
    examState.currentIndex < examState.questions.length - 1
  ) {
    examState.currentIndex += 1;
    renderQuestion();
  }
});

examElements.submit.addEventListener("click", async () => {
  if (examState.busy || examState.submitted || !examState.attemptId) {
    return;
  }

  const unanswered = examState.questions.filter(
    (question) => !hasAnswer(question),
  ).length;

  const confirmation = unanswered
    ? `You have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. Submit this exam anyway? You cannot change answers after submission.`
    : "Submit this exam now? You cannot change answers after submission.";

  if (!window.confirm(confirmation)) return;

  setBusy(true);
  setStatus("Saving answers and submitting your exam…", "loading");

  try {
    // Flush pending edits in one batch before server-side grading.
    await flushAnswerSaves();

    const result = await postAction({
      action: "submitQuiz",
      attemptId: examState.attemptId,
    });

    renderResults(result);
    setStatus(
      "Your exam has been submitted. The result below was returned by the exam server.",
      "success",
    );
  } catch (error) {
    console.error("Unable to submit exam:", error);
    let finalized = false;
    if (examState.deadlineAt && Date.now() >= examState.deadlineAt) {
      try {
        const status = await postAction({
          action: "checkAttempt",
          attemptId: examState.attemptId,
        });
        if (status.submitted && status.result) {
          renderResults(status.result);
          setStatus(
            "The deadline was reached. Your last server-saved answers were submitted automatically.",
            "success",
          );
          finalized = true;
        }
      } catch (statusError) {
        console.warn(
          "Could not retrieve automatic submission status:",
          statusError,
        );
      }
    }
    if (!finalized) {
      setStatus(
        `Submission failed: ${error.message} Your attempt remains available for retry if the deadline has not passed.`,
        "error",
      );
    }
  } finally {
    setBusy(false);
  }
});
