const scriptUrl = document.currentScript ? document.currentScript.src : window.location.href;
const siteRoot = new URL("../../", scriptUrl);

if (document.documentElement.classList.contains("dark")) {
    document.body.classList.add("dark");
    document.documentElement.classList.remove("dark");
}

async function loadComponent(containerId, componentPath) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const response = await fetch(new URL(componentPath, siteRoot));
        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        const template = document.createElement("template");
        template.innerHTML = await response.text();

        template.content.querySelectorAll("[data-site-href]").forEach(link => {
            link.href = new URL(link.dataset.siteHref, siteRoot).href;
        });
        template.content.querySelectorAll("[data-site-src]").forEach(image => {
            image.src = new URL(image.dataset.siteSrc, siteRoot).href;
        });

        container.replaceChildren(template.content);
    } catch (error) {
        console.error(`Unable to load ${componentPath}:`, error);
    }
}

function setActiveNavigation() {
    const currentPath = window.location.pathname;
    const rootPath = siteRoot.pathname;
    const relativePath = currentPath.startsWith(rootPath)
        ? currentPath.slice(rootPath.length)
        : currentPath.replace(/^\/+/, "");
    const pagePath = relativePath || "index.html";
    const questionBankPages = new Set([
        "question-bank.html",
        "conceptual.html",
        "numerical.html",
        "gate-pyqs.html",
        "hot-questions.html"
    ]);

    document.querySelectorAll("#navLinks a").forEach(link => {
        link.classList.remove("active");
        link.removeAttribute("aria-current");

        const isActive = link.dataset.navPage === pagePath
            || (link.dataset.navGroup === "units" && pagePath.startsWith("units/"))
            || (link.dataset.navGroup === "practicals" && pagePath.startsWith("practicals/"))
            || (link.dataset.navGroup === "resources" && pagePath.startsWith("resources/"))
            || (link.dataset.navGroup === "question-bank" && questionBankPages.has(pagePath));

        if (isActive) {
            link.classList.add("active");
            link.setAttribute("aria-current", "page");
        }
    });
}

function initializeSiteFeatures() {
    const backToTop = document.createElement("button");
    backToTop.className = "back-to-top";
    backToTop.type = "button";
    backToTop.setAttribute("aria-label", "Go to top of page");
    backToTop.title = "Go to top";
    backToTop.innerHTML = "<span aria-hidden=\"true\">↑</span><span>Top</span>";
    backToTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
    document.body.append(backToTop);

    const nav = document.getElementById("navLinks");
    const menu = document.getElementById("menuToggle");
    if (menu && nav) {
        menu.addEventListener("click", () => nav.classList.toggle("open"));
    }

    const theme = document.getElementById("themeToggle");
    if (theme) {
        theme.addEventListener("click", () => {
            document.body.classList.toggle("dark");
            localStorage.setItem("fosd-dark", document.body.classList.contains("dark"));
        });
    }

    const search = document.getElementById("siteSearch");
    if (search) {
        search.addEventListener("input", () => {
            const query = search.value.toLowerCase().trim();
            document.querySelectorAll("[data-search]").forEach(element => {
                element.style.display = !query || element.dataset.search.toLowerCase().includes(query) ? "" : "none";
            });
        });
    }

    document.querySelectorAll(".pdf-placeholder").forEach(link => {
        link.addEventListener("click", event => {
            if (link.dataset.status === "soon") {
                event.preventDefault();
                alert(`PDF placeholder\n\nUpload the corresponding PDF to:\n${link.dataset.file}\n\nThe link is already prepared for GitHub Pages.`);
            }
        });
    });

}

const announcementTypes = new Set(["important", "academic", "practical", "resource", "website"]);

function resolveAnnouncementLink(value) {
    const link = new URL(value, siteRoot);
    if (!["http:", "https:"].includes(link.protocol)) {
        throw new Error(`Unsupported announcement link protocol: ${link.protocol}`);
    }
    if (link.origin === siteRoot.origin && !link.pathname.startsWith(siteRoot.pathname)) {
        throw new Error("Announcement links must stay within the site base path.");
    }
    return link;
}

function validateAnnouncementText(value, field, index) {
    if (value !== undefined && typeof value !== "string") {
        throw new Error(`Announcement at index ${index} has invalid ${field}.`);
    }
}

function validateAnnouncementLink(value, field, index) {
    validateAnnouncementText(value, field, index);
    if (value && value.trim()) {
        try {
            resolveAnnouncementLink(value.trim());
        } catch {
            throw new Error(`Announcement at index ${index} has an invalid ${field}.`);
        }
    }
}

function validateRegistration(registration, index) {
    if (!registration || typeof registration !== "object" || Array.isArray(registration)) {
        throw new Error(`Announcement at index ${index} has invalid registration details.`);
    }
    validateAnnouncementText(registration.description, "registration description", index);
    validateAnnouncementLink(registration.url, "registration URL", index);
    validateAnnouncementText(registration.text, "registration text", index);
}

function validateAnnouncement(announcement, index) {
    if (
        !announcement
        || typeof announcement !== "object"
        || Array.isArray(announcement)
        || typeof announcement.title !== "string"
        || typeof announcement.description !== "string"
        || typeof announcement.date !== "string"
        || !/^\d{4}-\d{2}-\d{2}$/.test(announcement.date)
        || Number.isNaN(Date.parse(`${announcement.date}T00:00:00Z`))
        || new Date(`${announcement.date}T00:00:00Z`).toISOString().slice(0, 10) !== announcement.date
        || !announcementTypes.has(announcement.type)
    ) {
        throw new Error(`Announcement at index ${index} has invalid required fields.`);
    }

    validateAnnouncementLink(announcement.link, "link", index);
    validateAnnouncementText(announcement.linkText, "link text", index);

    if (announcement.eventDetails !== undefined) {
        const details = announcement.eventDetails;
        if (!details || typeof details !== "object" || Array.isArray(details)) {
            throw new Error(`Announcement at index ${index} has invalid event details.`);
        }
        Object.entries(details).forEach(([key, value]) => {
            if (key === "registration") {
                validateRegistration(value, index);
            } else if (
                typeof value !== "string"
                && !(typeof value === "number" && Number.isFinite(value))
            ) {
                throw new Error(`Announcement at index ${index} has invalid event detail "${key}".`);
            }
        });
    }

    if (announcement.registration !== undefined) {
        validateRegistration(announcement.registration, index);
    }

    if (announcement.expert !== undefined) {
        const expert = announcement.expert;
        if (!expert || typeof expert !== "object" || Array.isArray(expert)) {
            throw new Error(`Announcement at index ${index} has invalid expert details.`);
        }
        validateAnnouncementText(expert.name, "expert name", index);
        validateAnnouncementText(expert.designation, "expert designation", index);
        validateAnnouncementLink(expert.linkedin, "expert LinkedIn URL", index);
    }
}

function formatAnnouncementDetailLabel(key) {
    const knownLabels = {
        date: "Event date",
        dateTime: "Date & time",
        maximumTeams: "Maximum teams"
    };
    if (knownLabels[key]) return knownLabels[key];

    const label = key
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .toLowerCase();
    return label.replace(/^./, character => character.toUpperCase());
}

function getAnnouncementEventDate(announcement) {
    const eventDate = announcement.eventDetails?.date;
    if (typeof eventDate !== "string" || !eventDate.trim()) {
        return announcement.date;
    }

    const isoDate = eventDate.trim().match(/^(\d{4}-\d{2}-\d{2})$/);
    if (isoDate) {
        const parsedDate = new Date(`${isoDate[1]}T00:00:00Z`);
        if (!Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === isoDate[1]) {
            return isoDate[1];
        }
    }

    const dateText = eventDate.trim();
    const monthNames = [
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december"
    ];
    const monthFirst = dateText.match(
        /\b([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(?:and|&)\s+\d{1,2}(?:st|nd|rd|th)?)?[,]?\s+(\d{4})\b/i
    );
    const dayFirst = dateText.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\s+(\d{4})\b/i);
    const dateMatch = monthFirst || dayFirst;
    if (dateMatch) {
        const monthName = (monthFirst ? dateMatch[1] : dateMatch[2]).toLowerCase();
        const month = monthNames.indexOf(monthName);
        const day = Number(monthFirst ? dateMatch[2] : dateMatch[1]);
        const year = Number(dateMatch[3]);
        if (month !== -1 && day >= 1 && day <= 31) {
            const date = new Date(Date.UTC(year, month, day));
            if (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
                return date.toISOString().slice(0, 10);
            }
        }
    }

    return announcement.date;
}

function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

async function loadAnnouncements() {
    const response = await fetch(new URL("data/announcements.json", siteRoot));
    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    const announcements = Array.isArray(data) ? data : [data];
    announcements.forEach(validateAnnouncement);

    return announcements.sort((first, second) => second.date.localeCompare(first.date));
}

function createAnnouncementCard(announcement, isLatest, compact = false) {
    const card = document.createElement("article");
    card.className = "card announcement-card";
    if (compact) {
        card.classList.add("announcement-card-compact");
    }
    if (isLatest) {
        card.classList.add("announcement-card-latest");
    }

    const labels = document.createElement("div");
    labels.className = "announcement-labels";

    const type = document.createElement("span");
    type.className = `announcement-type announcement-type-${announcement.type}`;
    type.textContent = announcement.type.toUpperCase();
    labels.append(type);

    if (isLatest) {
        const latest = document.createElement("span");
        latest.className = "announcement-latest";
        latest.textContent = "Latest";
        labels.append(latest);
    }

    const title = document.createElement("h3");
    title.textContent = announcement.title;
    title.className = "announcement-title";

    const date = document.createElement("time");
    date.className = "announcement-date";
    date.dateTime = announcement.date;
    date.textContent = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC"
    }).format(new Date(`${announcement.date}T00:00:00Z`));

    const description = document.createElement(compact ? "p" : "div");
    description.className = compact
        ? "announcement-description announcement-description-preview"
        : "announcement-description";
    if (compact) {
        description.textContent = announcement.description.replace(/\s+/g, " ").trim();
    } else {
        announcement.description.split(/\n\s*\n/).forEach(paragraphText => {
            const paragraph = document.createElement("p");
            paragraph.textContent = paragraphText;
            description.append(paragraph);
        });
    }

    card.append(labels, title, date, description);

    if (announcement.eventDetails && !compact) {
        const eventDetails = document.createElement("section");
        eventDetails.className = "announcement-event";
        eventDetails.setAttribute("aria-label", "Event details");
        const eventHeading = document.createElement("h4");
        eventHeading.textContent = "Event details";
        eventDetails.append(eventHeading);

        const detailsGrid = document.createElement("dl");
        detailsGrid.className = "announcement-event-grid";
        Object.entries(announcement.eventDetails)
            .filter(([key]) => key !== "registration")
            .forEach(([key, value]) => {
            if (value === "") return;
            const item = document.createElement("div");
            const term = document.createElement("dt");
            term.textContent = formatAnnouncementDetailLabel(key);
            const detail = document.createElement("dd");
            detail.textContent = String(value);
            item.append(term, detail);
            detailsGrid.append(item);
        });
        eventDetails.append(detailsGrid);
        card.append(eventDetails);
    }

    const registration = announcement.registration || announcement.eventDetails?.registration;
    if (registration?.description && !compact) {
        const registrationNote = document.createElement("p");
        registrationNote.className = "announcement-registration-note";
        registrationNote.textContent = registration.description;
        card.append(registrationNote);
    }

    if (announcement.expert && !compact) {
        const expert = document.createElement("div");
        expert.className = "announcement-expert";
        const expertHeading = document.createElement("h4");
        expertHeading.textContent = "Featuring";
        expert.append(expertHeading);

        const expertName = document.createElement("strong");
        expertName.textContent = announcement.expert.name || "Guest expert";
        expert.append(expertName);
        if (announcement.expert.designation) {
            const designation = document.createElement("p");
            designation.textContent = announcement.expert.designation;
            expert.append(designation);
        }
        if (announcement.expert.linkedin && announcement.expert.linkedin.trim()) {
            const profile = resolveAnnouncementLink(announcement.expert.linkedin.trim());
            const profileLink = document.createElement("a");
            profileLink.href = profile.href;
            profileLink.textContent = "View LinkedIn profile ↗";
            profileLink.target = "_blank";
            profileLink.rel = "noopener noreferrer";
            expert.append(profileLink);
        }
        card.append(expert);
    }

    const actionUrl = registration?.url || announcement.link;
    const actionText = registration?.text || announcement.linkText || "View announcement →";
    if (actionUrl && actionUrl.trim()) {
        const link = resolveAnnouncementLink(actionUrl.trim());
        const anchor = document.createElement("a");
        anchor.className = `btn announcement-link${registration ? " btn-primary" : ""}`;
        anchor.href = link.href;
        anchor.textContent = actionText;
        if (link.origin !== siteRoot.origin) {
            anchor.target = "_blank";
            anchor.rel = "noopener noreferrer";
        }
        card.append(anchor);
    }

    return card;
}

function showAnnouncementMessage(container, message, isError = false) {
    const notice = document.createElement("p");
    notice.className = isError ? "notice announcement-message announcement-error" : "notice announcement-message";
    notice.setAttribute("role", isError ? "alert" : "status");
    notice.textContent = message;
    container.replaceChildren(notice);
}

function renderAnnouncementList(container, announcements, limit, compact = false) {
    const displayed = announcements.slice(0, limit);
    container.replaceChildren(...displayed.map((announcement, index) =>
        createAnnouncementCard(announcement, index === 0, compact)
    ));
    return displayed.length > 0;
}

async function renderAnnouncements() {
    const fullList = document.getElementById("announcements-list");
    const homepageList = document.getElementById("homepage-announcements");
    const homepageSection = document.getElementById("latest-announcements");
    if (!fullList && !homepageList) return;

    try {
        const announcements = await loadAnnouncements();
        if (fullList && !renderAnnouncementList(fullList, announcements, announcements.length)) {
            showAnnouncementMessage(fullList, "No announcements are available at this time.");
        }
        if (homepageList) {
            const today = getLocalDateString(new Date());
            const upcomingAnnouncements = announcements.filter(
                announcement => getAnnouncementEventDate(announcement) >= today
            );
            if (renderAnnouncementList(homepageList, upcomingAnnouncements, 3, true)) {
                homepageSection.hidden = false;
            }
        }
    } catch (error) {
        console.error("Unable to load announcements:", error);
        if (fullList) {
            showAnnouncementMessage(fullList, "Announcements could not be loaded. Please try again later.", true);
        }
        if (homepageList) {
            showAnnouncementMessage(homepageList, "Announcements could not be loaded. Please try again later.", true);
            homepageSection.hidden = false;
        }
    }
}

async function initializeSite() {
    await Promise.all([
        loadComponent("site-navbar", "components/navbar.html"),
        loadComponent("site-footer", "components/footer.html"),
        renderAnnouncements()
    ]);
    setActiveNavigation();
    initializeSiteFeatures();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeSite, { once: true });
} else {
    initializeSite();
}
