// NPC Generator logic for goblinsvillage.com
// Loads JSON-driven data and assembles NPCs from weighted and tagged fragments.

(function () {
  const store = {
    config: null,
    names: null,
    professions: null,
    towns: null,
    traits: null,
    ages: null,
  };

  let lastNpc = null;

  const selectors = {
    race: document.getElementById('race-select'),
    gender: document.getElementById('gender-select'),
    age: document.getElementById('age-input'),
    town: document.getElementById('town-select'),
    profession: document.getElementById('profession-select'),
    aesthetic: document.getElementById('aesthetic-select'),
    generateBtn: document.getElementById('generate-btn'),
    copyBtn: document.getElementById('copy-btn'),
    copyStatus: document.getElementById('copy-status'),
  };

  const outputEls = {
    name: document.getElementById('npc-name'),
    race: document.getElementById('npc-race'),
    gender: document.getElementById('npc-gender'),
    age: document.getElementById('npc-age'),
    town: document.getElementById('npc-town'),
    profession: document.getElementById('npc-profession'),
    aesthetic: document.getElementById('npc-aesthetic'),
    physical: document.getElementById('npc-physical'),
    backstory: document.getElementById('npc-backstory'),
    motivations: document.getElementById('motivations-list'),
    hook: document.getElementById('npc-hook'),
    voice: document.getElementById('npc-voice'),
    visual: document.getElementById('npc-visual'),
  };

  function getBasePathLocal() {
    if (typeof getBasePath === 'function') return getBasePath();
    const path = window.location.pathname;
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return '/';
    if (segments.length === 1 && segments[0].includes('.')) return '/';
    return `/${segments[0]}/`;
  }

  const BASE_PATH = getBasePathLocal();

  async function fetchJson(fileName) {
    const response = await fetch(`${BASE_PATH}data/${fileName}`, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Failed to load ${fileName}: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  // Data is sourced from /data; add new races, professions, towns, or traits there to extend the generator without
  // modifying the logic here.
  async function loadData() {
    const files = ['config.json', 'names.json', 'professions.json', 'towns.json', 'traits.json', 'ages.json'];
    const [config, names, professions, towns, traits, ages] = await Promise.all(files.map(fetchJson));
    store.config = config;
    store.names = names;
    store.professions = professions;
    store.towns = towns;
    store.traits = traits;
    store.ages = ages;
  }

  function populateSelect(selectEl, options, includeRandom) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    if (includeRandom) {
      const opt = document.createElement('option');
      opt.value = 'random';
      opt.textContent = 'Random';
      selectEl.appendChild(opt);
    }
    options.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.label;
      selectEl.appendChild(opt);
    });
  }

  function populateDropdowns() {
    const { config, professions, towns } = store;
    populateSelect(selectors.race, config.races);
    populateSelect(selectors.gender, config.genders);
    populateSelect(selectors.aesthetic, config.aesthetics);
    populateSelect(selectors.profession, professions.professions, true);
    populateSelect(selectors.town, towns.towns, true);
  }

  function randomFrom(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  function findLabel(items = [], id) {
    const found = items.find((item) => item.id === id);
    return found ? found.label : id;
  }

  function pickName(raceId, genderId) {
    const raceNames = store.names?.races?.[raceId];
    if (!raceNames) return 'Nameless Wanderer';

    const genderList = raceNames[genderId];
    if (genderList && genderList.length) return randomFrom(genderList);

    const neutralList = raceNames.neutral;
    if (neutralList && neutralList.length) return randomFrom(neutralList);

    const anyList = Object.values(raceNames).find((list) => Array.isArray(list) && list.length);
    return anyList ? randomFrom(anyList) : 'Nameless Wanderer';
  }

  function pickProfession(raceId, chosenId) {
    const list = store.professions.professions;
    if (chosenId && chosenId !== 'random') {
      return list.find((p) => p.id === chosenId) || list[0];
    }

    const weightedPool = [];
    list.forEach((profession) => {
      const weight = profession.weightsByRace?.[raceId] ?? 1;
      const entries = Math.max(1, Math.round(weight * 10));
      for (let i = 0; i < entries; i += 1) {
        weightedPool.push(profession);
      }
    });

    return randomFrom(weightedPool.length ? weightedPool : list);
  }

  function pickTown(chosenId) {
    const list = store.towns.towns;
    if (chosenId && chosenId !== 'random') {
      return list.find((t) => t.id === chosenId) || list[0];
    }
    return randomFrom(list);
  }

  function pickTrait(slot, tags, excludeSet = new Set()) {
    const traitsForSlot = store.traits.traits.filter((trait) => trait.slot === slot);
    const tagged = traitsForSlot.filter(
      (trait) => trait.tags?.some((tag) => tags.includes(tag)) && !excludeSet.has(trait.text)
    );

    if (tagged.length) return randomFrom(tagged).text;

    const fallback = traitsForSlot.filter((trait) => !excludeSet.has(trait.text));
    if (fallback.length) return randomFrom(fallback).text;

    return null;
  }

  function generateNpc(config) {
    const name = pickName(config.raceId, config.genderId);
    const profession = pickProfession(config.raceId, config.professionId);
    const town = pickTown(config.townId);
    const aestheticLabel = findLabel(store.config.aesthetics, config.aestheticId);
    const raceLabel = findLabel(store.config.races, config.raceId);
    const genderLabel = findLabel(store.config.genders, config.genderId);

    // Tags are used to bias trait selection; extend data in /data to expand these combinations.
    const tags = [config.raceId, config.genderId, profession.id, town.id, config.aestheticId].filter(Boolean);

    const physical = pickTrait('physical', tags);
    const backstory = pickTrait('backstory', tags);

    const motivations = [];
    const exclusion = new Set();
    const desiredCount = 2 + Math.floor(Math.random() * 2);
    let attempts = 0;
    while (motivations.length < desiredCount && attempts < 10) {
      const next = pickTrait('motivation', tags, exclusion);
      if (next) {
        motivations.push(next);
        exclusion.add(next);
      }
      attempts += 1;
    }

    const hook = pickTrait('hook', tags);
    const voice = pickTrait('voice', tags);
    const visual = pickTrait('visual', tags);

    return {
      name,
      race: raceLabel,
      gender: genderLabel,
      age: config.age,
      townLabel: town.label,
      professionLabel: profession.label,
      aesthetic: aestheticLabel,
      physical,
      backstory,
      motivations,
      hook,
      voice,
      visual,
    };
  }

  function setOutput(el, text) {
    if (!el) return;
    el.textContent = text;
    el.classList.remove('placeholder-text');
  }

  function renderNpc(npc) {
    setOutput(outputEls.name, npc.name);
    setOutput(outputEls.race, npc.race);
    setOutput(outputEls.gender, npc.gender);
    setOutput(outputEls.age, npc.age);
    setOutput(outputEls.town, npc.townLabel);
    setOutput(outputEls.profession, npc.professionLabel);
    setOutput(outputEls.aesthetic, npc.aesthetic);

    setOutput(outputEls.physical, npc.physical || 'No physical description found.');
    setOutput(outputEls.backstory, npc.backstory || 'No backstory found.');
    setOutput(outputEls.voice, npc.voice || 'No vocal guidance available.');
    setOutput(outputEls.visual, npc.visual || 'No visual prompt available yet.');
    setOutput(outputEls.hook, npc.hook || 'No hook found.');

    outputEls.motivations.innerHTML = '';
    if (npc.motivations && npc.motivations.length) {
      npc.motivations.forEach((motivation) => {
        const li = document.createElement('li');
        li.textContent = motivation;
        outputEls.motivations.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.textContent = 'No motivations available.';
      outputEls.motivations.appendChild(li);
    }
    outputEls.motivations.classList.remove('placeholder-text');
  }

  function buildSummary(npc) {
    return `${npc.name} (${npc.race}, ${npc.gender}, ${npc.age}, ${npc.professionLabel} from ${npc.townLabel}, aesthetic: ${npc.aesthetic})\n` +
      `Physical: ${npc.physical || 'N/A'}\n` +
      `Backstory: ${npc.backstory || 'N/A'}\n` +
      `Motivations:\n- ${(npc.motivations || []).join('\n- ') || 'N/A'}\n` +
      `Hook: ${npc.hook || 'N/A'}\n` +
      `How to voice: ${npc.voice || 'N/A'}\n` +
      `Visuals: ${npc.visual || 'N/A'}`;
  }

  async function copySummary() {
    if (!lastNpc) {
      selectors.copyStatus.textContent = 'Generate an NPC first.';
      return;
    }

    try {
      const summary = buildSummary(lastNpc);
      await navigator.clipboard.writeText(summary);
      selectors.copyStatus.textContent = 'Summary copied!';
      setTimeout(() => {
        selectors.copyStatus.textContent = '';
      }, 2000);
    } catch (err) {
      console.error('Copy failed:', err);
      selectors.copyStatus.textContent = 'Copy not available in this browser.';
    }
  }

  function handleGenerate() {
    const config = {
      raceId: selectors.race.value,
      genderId: selectors.gender.value,
      age: selectors.age.value || '30',
      townId: selectors.town.value,
      professionId: selectors.profession.value,
      aestheticId: selectors.aesthetic.value,
    };

    lastNpc = generateNpc(config);
    renderNpc(lastNpc);
  }

  function markActiveNav() {
    const applyActive = () => {
      const link = document.querySelector('.nav-generators');
      if (link) {
        link.classList.add('nav-active');
        return true;
      }
      return false;
    };

    if (applyActive()) return;

    const header = document.getElementById('site-header');
    if (!header) return;

    const observer = new MutationObserver(() => {
      if (applyActive()) {
        observer.disconnect();
      }
    });

    observer.observe(header, { childList: true, subtree: true });
  }

  async function init() {
    markActiveNav();
    selectors.age.value = selectors.age.value || '30';
    if (selectors.generateBtn) selectors.generateBtn.disabled = true;
    if (selectors.copyBtn) selectors.copyBtn.disabled = true;

    try {
      await loadData();
      populateDropdowns();
      if (selectors.generateBtn) selectors.generateBtn.disabled = false;
      if (selectors.copyBtn) selectors.copyBtn.disabled = false;
    } catch (err) {
      console.error('Failed to initialize NPC generator', err);
      if (selectors.generateBtn) selectors.generateBtn.disabled = true;
      if (selectors.copyBtn) selectors.copyBtn.disabled = true;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (selectors.generateBtn) selectors.generateBtn.addEventListener('click', handleGenerate);
    if (selectors.copyBtn) selectors.copyBtn.addEventListener('click', copySummary);
    init();
  });
})();
