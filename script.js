const urlInput = document.getElementById('project-url');
const fetchButton = document.getElementById('fetch-button');
const historyContainer = document.getElementById('history-container');
const loader = document.getElementById('loader');
const errorContainer = document.getElementById('error-container');

fetchButton.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
        showError('Please enter a project URL, ID, or slug.');
        return;
    }

    clearUI();
    loader.style.display = 'block';

    try {
        const projectId = await resolveProjectId(url);
        if (!projectId) {
            showError('Invalid input. Please use a project ID, a project URL (e.g., /p/...), or a user slug (e.g., @username/project-slug).');
            loader.style.display = 'none';
            return;
        }

        const history = await fetchAllRevisions(projectId);
        renderHistory(history);
    } catch (err) {
        showError(err.message);
    } finally {
        loader.style.display = 'none';
    }
});

urlInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        fetchButton.click();
    }
});


function extractProjectId(input) {
    const urlParts = input.split('/p/');
    if (urlParts.length > 1) {
        const potentialId = urlParts[1].split('/')[0];
        if (potentialId.length === 20 && /^[a-z0-9_-]+$/.test(potentialId)) {
            return potentialId;
        }
    }

    if (input.length === 20 && /^[a-z0-9_-]+$/.test(input)) {
        return input;
    }

    return null;
}

async function resolveProjectId(input) {
    input = input.trim();

    // 1. Project ID
    if (input.length === 20 && /^[a-z0-9_-]+$/.test(input)) {
        return input;
    }

    // 2. Project URL: /p/PROJECT_ID
    let match = input.match(/\/p\/([a-z0-9_-]{20})/);
    if (match) {
        return match[1];
    }

    // 3. Slug URL: /@username/slug or @username/slug
    match = input.match(/@([a-zA-Z0-9_]{3,32})\/([a-zA-Z0-9-]{3,50})/);
    if (match) {
        const username = match[1];
        const slug = match[2];
        const apiUrl = `/api/v1/users/${username}/slugs/${slug}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Project not found for user @${username} with slug "${slug}".`);
            }
            throw new Error(`Failed to fetch project by slug. Status: ${response.status}`);
        }
        const data = await response.json();
        if (data && data.project && data.project.id) {
            return data.project.id;
        } else {
            throw new Error('Could not get project ID from slug response.');
        }
    }

    return null;
}

async function fetchAllRevisions(projectId) {
    let allRevisions = [];
    let cursor = null;
    let hasNextPage = true;

    while (hasNextPage) {
        const apiUrl = `/api/v1/projects/${projectId}/revisions?first=100${cursor ? `&after=${cursor}` : ''}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Project not found. Please check the URL or ID.');
            }
            throw new Error(`Failed to fetch revisions. Status: ${response.status}`);
        }

        const data = await response.json();
        const revisionsData = data.revisions.data;

        if (!revisionsData || revisionsData.length === 0) {
            break;
        }

        allRevisions.push(...revisionsData);
        hasNextPage = data.revisions.meta.has_next_page;
        cursor = data.revisions.meta.end_cursor;
    }

    return allRevisions;
}

function renderHistory(revisions) {
    const validRevisions = revisions.filter(item => item.site && item.site.prompt && item.site.prompt.text);

    if (validRevisions.length === 0) {
        historyContainer.innerHTML = '<p>No prompt history found for this project.</p>';
        return;
    }

    validRevisions.reverse();

    const fragment = document.createDocumentFragment();
    validRevisions.forEach(item => {
        const { project_revision, site } = item;
        const prompt = site.prompt;

        const revisionElement = document.createElement('div');
        revisionElement.className = 'revision-item';

        const header = document.createElement('div');
        header.className = 'revision-header';
        header.innerHTML = `<strong>Version ${project_revision.version}</strong> <span class="prompt-type">(${prompt.type})</span>`;

        const promptText = document.createElement('p');
        promptText.className = 'prompt-text';
        promptText.textContent = prompt.text;
        
        revisionElement.appendChild(header);
        revisionElement.appendChild(promptText);

        fragment.appendChild(revisionElement);
    });
    
    historyContainer.appendChild(fragment);
}

function showError(message) {
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
}

function clearUI() {
    historyContainer.innerHTML = '';
    errorContainer.textContent = '';
    errorContainer.style.display = 'none';
}