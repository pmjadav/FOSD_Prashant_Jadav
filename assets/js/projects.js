const projectsSiteRoot = new URL("../../", document.currentScript.src);
const projectDifficulties = ["Beginner", "Intermediate", "Advanced"];
const projectCatalogue = {
    projects: [],
    filters: {
        search: document.getElementById("project-search"),
        category: document.getElementById("project-category"),
        difficulty: document.getElementById("project-difficulty")
    }
};

function showProjectsMessage(container, message, isError = false) {
    const notice = document.createElement("p");
    notice.className = isError
        ? "notice projects-list-message announcement-error"
        : "notice projects-list-message";
    notice.setAttribute("role", isError ? "alert" : "status");
    notice.textContent = message;
    container.replaceChildren(notice);
    container.setAttribute("aria-busy", "false");
}

function validateProjectList(projects, label, requiredFields) {
    if (!Array.isArray(projects)) {
        throw new Error(`${label} must be a JSON array.`);
    }

    projects.forEach((project, index) => {
        if (!project || typeof project !== "object" || Array.isArray(project)) {
            throw new Error(`${label} entry ${index + 1} must be an object.`);
        }
        requiredFields.forEach(field => {
            if (typeof project[field] !== "string" || !project[field].trim()) {
                throw new Error(`${label} entry ${index + 1} has an invalid ${field}.`);
            }
        });
    });

    return projects;
}

function validateProjectCatalogue(projects) {
    const projectIds = new Set();
    const arrayFields = ["concepts", "features", "technologies", "extensions"];
    projects.forEach((project, index) => {
        if (
            typeof project.id !== "string"
            || !project.id.trim()
            || projectIds.has(project.id)
            || typeof project.category !== "string"
            || !project.category.trim()
            || !projectDifficulties.includes(project.difficulty)
        ) {
            throw new Error(`Project idea ${index + 1} has invalid catalogue details.`);
        }
        projectIds.add(project.id);

        arrayFields.forEach(field => {
            if (!Array.isArray(project[field]) || project[field].some(value => typeof value !== "string")) {
                throw new Error(`Project idea ${index + 1} has an invalid ${field} list.`);
            }
        });

        if (
            project.resources !== undefined
            && (
                !Array.isArray(project.resources)
                || project.resources.some(resource =>
                    !resource
                    || typeof resource !== "object"
                    || typeof resource.title !== "string"
                    || typeof resource.url !== "string"
                )
            )
        ) {
            throw new Error(`Project idea ${index + 1} has invalid resources.`);
        }
    });

    return projects;
}

function createProjectList(title, values) {
    const section = document.createElement("div");
    section.className = "project-detail";
    const heading = document.createElement("h4");
    heading.textContent = title;
    const list = document.createElement("ul");
    values.forEach(value => {
        const item = document.createElement("li");
        item.textContent = value;
        list.append(item);
    });
    section.append(heading, list);
    return section;
}

function createProjectCard(project) {
    const card = document.createElement("article");
    card.className = "card project-card";

    const heading = document.createElement("div");
    heading.className = "project-card-heading";
    const title = document.createElement("h3");
    title.textContent = project.title;
    const badges = document.createElement("div");
    badges.className = "project-card-badges";

    const category = document.createElement("span");
    category.className = "badge project-category-badge";
    category.textContent = project.category;
    const difficulty = document.createElement("span");
    difficulty.className = "badge";
    difficulty.textContent = project.difficulty;
    badges.append(category, difficulty);
    heading.append(title, badges);

    const description = document.createElement("p");
    description.textContent = project.description;
    card.append(heading, description);
    card.append(createProjectList("Related OS concepts", project.concepts));
    card.append(createProjectList("Suggested features", project.features));

    if (project.technologies.length) {
        const technologies = document.createElement("div");
        technologies.className = "project-detail";
        const technologyHeading = document.createElement("h4");
        technologyHeading.textContent = "Suggested technologies";
        const technologyList = document.createElement("div");
        technologyList.className = "project-technologies";
        project.technologies.forEach(name => {
            const technology = document.createElement("span");
            technology.className = "project-technology";
            technology.textContent = name;
            technologyList.append(technology);
        });
        technologies.append(technologyHeading, technologyList);
        card.append(technologies);
    }

    const details = document.createElement("details");
    details.className = "project-more";
    const summary = document.createElement("summary");
    summary.textContent = "Possible extensions and resources";
    details.append(summary, createProjectList("Possible extensions", project.extensions));

    if (project.resources?.length) {
        const resourceSection = document.createElement("div");
        resourceSection.className = "project-detail";
        const resourceHeading = document.createElement("h4");
        resourceHeading.textContent = "Learning resources";
        const resourceList = document.createElement("ul");
        project.resources.forEach(resource => {
            const item = document.createElement("li");
            const url = resolveShowcaseUrl(resource.url);
            if (url) {
                const link = document.createElement("a");
                link.href = url.href;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = resource.title;
                item.append(link);
            } else {
                item.textContent = resource.title;
            }
            resourceList.append(item);
        });
        resourceSection.append(resourceHeading, resourceList);
        details.append(resourceSection);
    }
    card.append(details);

    return card;
}

function resolveShowcaseUrl(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
        const url = new URL(value.trim(), projectsSiteRoot);
        return ["http:", "https:"].includes(url.protocol) ? url : null;
    } catch {
        return null;
    }
}

function appendShowcaseLink(links, label, value) {
    const url = resolveShowcaseUrl(value);
    if (!url) return;

    const link = document.createElement("a");
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    links.append(link);
}

function createShowcaseCard(project) {
    const card = document.createElement("article");
    card.className = "card showcase-card";

    if (project.image) {
        const imageUrl = resolveShowcaseUrl(project.image);
        if (imageUrl) {
            const image = document.createElement("img");
            image.className = "showcase-image";
            image.src = imageUrl.href;
            image.alt = project.imageAlt || `Preview of ${project.title}`;
            image.loading = "lazy";
            image.addEventListener("error", () => image.remove(), { once: true });
            card.append(image);
        }
    }

    const title = document.createElement("h3");
    title.textContent = project.title;
    card.append(title);

    if (typeof project.students === "string" && project.students.trim()) {
        const students = document.createElement("p");
        students.textContent = project.students;
        card.append(students);
    }
    if (typeof project.description === "string" && project.description.trim()) {
        const description = document.createElement("p");
        description.textContent = project.description;
        card.append(description);
    }
    if (Array.isArray(project.technologies) && project.technologies.length) {
        const technologies = document.createElement("p");
        technologies.textContent = `Technologies: ${project.technologies.join(", ")}`;
        card.append(technologies);
    }

    const links = document.createElement("div");
    links.className = "showcase-links";
    appendShowcaseLink(links, "GitHub repository ↗", project.github);
    appendShowcaseLink(links, "Live demo ↗", project.demo);
    if (links.childElementCount) card.append(links);

    return card;
}

function getMatchingProjects() {
    const query = projectCatalogue.filters.search.value.trim().toLocaleLowerCase();
    const category = projectCatalogue.filters.category.value;
    const difficulty = projectCatalogue.filters.difficulty.value;

    return projectCatalogue.projects.filter(project => {
        const searchableText = [
            project.title,
            project.description,
            ...project.concepts
        ].join(" ").toLocaleLowerCase();
        return (!query || searchableText.includes(query))
            && (!category || project.category === category)
            && (!difficulty || project.difficulty === difficulty);
    });
}

function renderProjectCatalogue() {
    const container = document.getElementById("projects-list");
    const resultCount = document.getElementById("project-result-count");
    const matchingProjects = getMatchingProjects();

    resultCount.textContent = `Showing ${matchingProjects.length} of ${projectCatalogue.projects.length} projects.`;
    if (!matchingProjects.length) {
        showProjectsMessage(
            container,
            "No projects match these filters. Try changing your search or filters."
        );
        return;
    }

    container.replaceChildren(...matchingProjects.map(createProjectCard));
    container.setAttribute("aria-busy", "false");
}

function populateProjectFilters(projects) {
    const categories = [...new Set(projects.map(project => project.category))];
    categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        projectCatalogue.filters.category.append(option);
    });

    projectDifficulties.forEach(difficulty => {
        const option = document.createElement("option");
        option.value = difficulty;
        option.textContent = difficulty;
        projectCatalogue.filters.difficulty.append(option);
    });

    projectCatalogue.filters.search.addEventListener("input", renderProjectCatalogue);
    projectCatalogue.filters.category.addEventListener("change", renderProjectCatalogue);
    projectCatalogue.filters.difficulty.addEventListener("change", renderProjectCatalogue);
}

async function loadProjectData(path, label, fields) {
    const response = await fetch(new URL(path, projectsSiteRoot));
    if (!response.ok) {
        throw new Error(`Unable to load ${label} (HTTP ${response.status}).`);
    }
    return validateProjectList(await response.json(), label, fields);
}

async function renderProjectIdeas() {
    const container = document.getElementById("projects-list");
    if (!container) return;

    try {
        const projects = await loadProjectData(
            "data/projects.json",
            "Project ideas",
            ["id", "title", "category", "difficulty", "description"]
        );
        validateProjectCatalogue(projects);
        if (!projects.length) {
            showProjectsMessage(container, "Project ideas are not available at this time.");
            return;
        }
        projectCatalogue.projects = projects;
        populateProjectFilters(projects);
        renderProjectCatalogue();
    } catch (error) {
        console.error("Unable to load project ideas:", error);
        document.getElementById("project-result-count").textContent =
            "The project catalogue could not be loaded.";
        showProjectsMessage(
            container,
            "Project ideas could not be loaded. Please try again later.",
            true
        );
    }
}

async function renderStudentShowcase() {
    const container = document.getElementById("student-projects-list");
    if (!container) return;

    try {
        const projects = await loadProjectData(
            "data/student-projects.json",
            "Student project showcase",
            ["title"]
        );
        if (!projects.length) {
            showProjectsMessage(
                container,
                "Interesting projects developed by students may be featured here in the future."
            );
            return;
        }
        container.replaceChildren(...projects.map(createShowcaseCard));
        container.setAttribute("aria-busy", "false");
    } catch (error) {
        console.error("Unable to load student project showcase:", error);
        showProjectsMessage(
            container,
            "The student project showcase could not be loaded. Please try again later.",
            true
        );
    }
}

Promise.all([renderProjectIdeas(), renderStudentShowcase()]);
