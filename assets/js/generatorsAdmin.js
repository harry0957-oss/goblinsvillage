(function () {
  const adminGrid = document.getElementById('admin-grid');
  const passwordInput = document.getElementById('admin-password');
  let adminPassword = '';

  const sections = [
    {
      key: 'config',
      title: 'config.json',
      description: 'Races, genders, aesthetics, and other knobs that guide the generator.',
      inputId: 'config-file',
      previewId: 'config-preview',
      summary: summarizeConfig,
    },
    {
      key: 'names',
      title: 'names.json',
      description: 'Names organized by race and gender. Extend these to add more flavor without touching the code.',
      inputId: 'names-file',
      previewId: 'names-preview',
      summary: summarizeNames,
    },
    {
      key: 'professions',
      title: 'professions.json',
      description: 'Professions with weights by race. Tags are used to bias traits and voice notes.',
      inputId: 'professions-file',
      previewId: 'professions-preview',
      summary: summarizeProfessions,
    },
    {
      key: 'towns',
      title: 'towns.json',
      description: 'Locales the NPCs can hail from. Tags help connect to relevant traits and hooks.',
      inputId: 'towns-file',
      previewId: 'towns-preview',
      summary: summarizeTowns,
    },
    {
      key: 'traits',
      title: 'traits.json',
      description: 'Traits for physical description, backstory, motivations, hooks, voice, and visuals.',
      inputId: 'traits-file',
      previewId: 'traits-preview',
      summary: summarizeTraits,
    },
    {
      key: 'ages',
      title: 'ages.json',
      description: 'Age buckets used to seed defaults and flavor text.',
      inputId: 'ages-file',
      previewId: 'ages-preview',
      summary: summarizeAges,
    },
  ];

  function setFeedback(container, message, type = 'info') {
    if (!container) return;
    container.textContent = message;
    container.className = `feedback ${type}`;
  }

  function createCard(section) {
    const card = document.createElement('article');
    card.className = 'admin-card';

    const title = document.createElement('h3');
    title.textContent = section.title;

    const desc = document.createElement('p');
    desc.textContent = section.description;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    fileInput.id = section.inputId;
    fileInput.className = 'goblin-input';

    const actions = document.createElement('div');
    actions.className = 'file-actions';

    const previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.textContent = 'Preview';
    previewBtn.className = 'goblin-btn';

    const uploadBtn = document.createElement('button');
    uploadBtn.type = 'button';
    uploadBtn.textContent = 'Upload (stub)';
    uploadBtn.className = 'ghost-btn';

    const feedback = document.createElement('div');
    feedback.id = section.previewId;
    feedback.className = 'feedback info';
    feedback.textContent = 'No file selected yet.';

    const previewBox = document.createElement('div');
    previewBox.className = 'preview-box';
    previewBox.id = `${section.previewId}-box`;
    previewBox.textContent = 'Preview details will appear here after loading a file.';

    previewBtn.addEventListener('click', () => handlePreview(section, fileInput, feedback, previewBox));
    uploadBtn.addEventListener('click', () => handleUpload(section, feedback));

    actions.appendChild(previewBtn);
    actions.appendChild(uploadBtn);

    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(fileInput);
    card.appendChild(actions);
    card.appendChild(feedback);
    card.appendChild(previewBox);

    adminGrid.appendChild(card);
  }

  function handleUpload(section, feedbackEl) {
    if (!adminPassword) {
      setFeedback(feedbackEl, 'Add the admin password before uploading.', 'error');
      return;
    }

    // When the site moves off GitHub Pages, this stub can post to a real endpoint with the password attached.
    // fetch(`/api/generators/data/${section.key}`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', 'x-admin-key': adminPassword },
    //   body: JSON.stringify(parsedJson),
    // });

    console.log(`[admin] Would upload ${section.title} with password ${adminPassword}`);
    setFeedback(
      feedbackEl,
      `Upload stubbed. In production, this would send ${section.title} to /api/generators/data/${section.key} with the provided password.`,
      'info'
    );
  }

  function readFileAsJson(inputEl) {
    return new Promise((resolve, reject) => {
      const file = inputEl.files?.[0];
      if (!file) {
        reject(new Error('Please choose a JSON file first.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          resolve(parsed);
        } catch (err) {
          reject(new Error('Invalid JSON format.'));
        }
      };
      reader.onerror = () => reject(new Error('Unable to read the file.'));
      reader.readAsText(file);
    });
  }

  function handlePreview(section, fileInput, feedbackEl, previewBox) {
    readFileAsJson(fileInput)
      .then((json) => {
        const summary = section.summary(json);
        previewBox.textContent = summary.message;
        setFeedback(feedbackEl, summary.feedback, summary.type);
      })
      .catch((err) => {
        setFeedback(feedbackEl, err.message, 'error');
        previewBox.textContent = 'Preview failed. Fix the file and try again.';
      });
  }

  function summarizeConfig(json) {
    if (!json?.races || !json?.genders || !json?.aesthetics) {
      return { message: 'config.json must include races, genders, and aesthetics arrays.', feedback: 'Missing core arrays.', type: 'error' };
    }

    const lines = [
      `Races: ${json.races.length}`,
      `Genders: ${json.genders.length}`,
      `Aesthetics: ${json.aesthetics.length}`,
    ];

    return {
      message: lines.join('\n'),
      feedback: 'Config looks valid. Add more races or aesthetics in /data/config.json to expand the generator.',
      type: 'success',
    };
  }

  function summarizeNames(json) {
    if (!json?.races) {
      return { message: 'Expected a races object keyed by race id.', feedback: 'names.json schema mismatch.', type: 'error' };
    }

    const raceEntries = Object.entries(json.races);
    const lines = raceEntries.map(([race, genders]) => {
      const genderKeys = Object.keys(genders || {});
      const counts = genderKeys.map((gender) => `${gender}: ${(genders[gender] || []).length}`).join(', ');
      return `${race}: ${counts}`;
    });

    return {
      message: lines.join('\n'),
      feedback: 'Names loaded. Add more entries per race/gender to deepen the pool without code changes.',
      type: 'success',
    };
  }

  function summarizeProfessions(json) {
    if (!json?.professions || !Array.isArray(json.professions)) {
      return { message: 'Expected professions array.', feedback: 'professions.json schema mismatch.', type: 'error' };
    }

    const weightsMentioned = json.professions.filter((p) => p.weightsByRace).length;
    return {
      message: `Professions: ${json.professions.length}. With race weights: ${weightsMentioned}.`,
      feedback: 'Professions ready. Add tags or weights to guide hooks, traits, and names.',
      type: 'success',
    };
  }

  function summarizeTowns(json) {
    if (!json?.towns || !Array.isArray(json.towns)) {
      return { message: 'Expected towns array.', feedback: 'towns.json schema mismatch.', type: 'error' };
    }

    const tagsMentioned = json.towns.filter((t) => Array.isArray(t.tags) && t.tags.length).length;
    return {
      message: `Towns: ${json.towns.length}. With tags: ${tagsMentioned}.`,
      feedback: 'Towns loaded. Tags help match hooks and traits to the locale.',
      type: 'success',
    };
  }

  function summarizeTraits(json) {
    if (!json?.traits || !Array.isArray(json.traits)) {
      return { message: 'Expected traits array.', feedback: 'traits.json schema mismatch.', type: 'error' };
    }

    const countsBySlot = json.traits.reduce((acc, trait) => {
      const slot = trait.slot || 'unknown';
      acc[slot] = (acc[slot] || 0) + 1;
      return acc;
    }, {});

    const lines = Object.entries(countsBySlot).map(([slot, count]) => `${slot}: ${count}`);
    return {
      message: lines.join('\n'),
      feedback: 'Traits parsed. Add more entries per slot to diversify generated NPCs.',
      type: 'success',
    };
  }

  function summarizeAges(json) {
    if (!json?.ages || !Array.isArray(json.ages)) {
      return { message: 'Expected ages array.', feedback: 'ages.json schema mismatch.', type: 'error' };
    }

    const labels = json.ages.map((a) => a.label || a.id).join(', ');
    return {
      message: `Age bands: ${labels}`,
      feedback: 'Ages loaded. Update ranges or labels here to change how age is described.',
      type: 'success',
    };
  }

  function markActiveNav() {
    const link = document.querySelector('.nav-generators');
    if (link) link.classList.add('nav-active');
  }

  function init() {
    markActiveNav();
    sections.forEach(createCard);

    if (passwordInput) {
      passwordInput.addEventListener('input', (event) => {
        adminPassword = event.target.value;
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
