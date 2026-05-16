const state = {
  sources: [],
  selectedAlias: undefined,
};

const els = {
  healthDot: document.querySelector('#healthDot'),
  configPath: document.querySelector('#configPath'),
  sourceCount: document.querySelector('#sourceCount'),
  sourceList: document.querySelector('#sourceList'),
  sourceDetails: document.querySelector('#sourceDetails'),
  detailsTitle: document.querySelector('#detailsTitle'),
  selectedSubtitle: document.querySelector('#selectedSubtitle'),
  refreshConfig: document.querySelector('#refreshConfig'),
  refreshSource: document.querySelector('#refreshSource'),
  removeSource: document.querySelector('#removeSource'),
  discoverForm: document.querySelector('#discoverForm'),
  discoverQuery: document.querySelector('#discoverQuery'),
  discoverResults: document.querySelector('#discoverResults'),
  addForm: document.querySelector('#addForm'),
  toast: document.querySelector('#toast'),
};

await boot();

async function boot() {
  bindEvents();
  await loadConfig();
}

function bindEvents() {
  els.refreshConfig.addEventListener('click', loadConfig);
  els.refreshSource.addEventListener('click', refreshSelectedSource);
  els.removeSource.addEventListener('click', removeSelectedSource);
  els.discoverForm.addEventListener('submit', discoverSources);
  els.addForm.addEventListener('submit', addSource);
}

async function loadConfig() {
  try {
    const config = await requestJson('/api/config');
    state.sources = config.sources || [];
    state.selectedAlias = state.sources.some((source) => source.alias === state.selectedAlias)
      ? state.selectedAlias
      : state.sources[0]?.alias;
    els.configPath.textContent = config.config_path || 'No config path';
    els.sourceCount.textContent = String(state.sources.length);
    els.healthDot.classList.add('online');
    renderSources();
    renderDetails();
  } catch (error) {
    els.healthDot.classList.remove('online');
    showToast(error.message, 'error');
  }
}

function renderSources() {
  els.sourceList.replaceChildren();
  if (!state.sources.length) {
    els.sourceList.append(emptyBlock('No mappings configured yet. Add a Notion data source to start using aliases in MCP tools.'));
    return;
  }

  for (const source of state.sources) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `source-item${source.alias === state.selectedAlias ? ' active' : ''}`;
    item.innerHTML = `
      <span class="source-alias"></span>
      <span class="source-meta"></span>
    `;
    item.querySelector('.source-alias').textContent = source.alias;
    item.querySelector('.source-meta').textContent = source.name || source.id || 'Unnamed source';
    item.addEventListener('click', () => {
      state.selectedAlias = source.alias;
      renderSources();
      renderDetails();
    });
    els.sourceList.append(item);
  }
}

function renderDetails() {
  const source = selectedSource();
  els.refreshSource.disabled = !source;
  els.removeSource.disabled = !source;

  if (!source) {
    els.detailsTitle.textContent = 'No source selected';
    els.selectedSubtitle.textContent = 'Select a mapping from the sidebar.';
    els.sourceDetails.className = 'details empty-note';
    els.sourceDetails.textContent = 'Select a source to inspect local mapping metadata.';
    return;
  }

  els.detailsTitle.textContent = source.alias;
  els.selectedSubtitle.textContent = source.name || source.id || 'Local data source mapping';
  els.sourceDetails.className = 'details';
  els.sourceDetails.replaceChildren(
    detailCell('Alias', source.alias),
    detailCell('Data source ID', source.id),
    detailCell('Name', source.name),
    detailCell('Key property', source.key_property),
    detailCell('Title property', source.title_property),
    detailCell('Status property', source.status_property),
    detailCell('Config section', source.source),
  );
}

function detailCell(label, value) {
  const node = document.createElement('div');
  node.className = 'detail-cell';
  node.innerHTML = '<span class="detail-label"></span><span class="detail-value"></span>';
  node.querySelector('.detail-label').textContent = label;
  node.querySelector('.detail-value').textContent = value || '-';
  return node;
}

async function discoverSources(event) {
  event.preventDefault();
  els.discoverResults.className = 'discover-results empty-note';
  els.discoverResults.textContent = 'Searching accessible Notion data sources...';
  try {
    const query = els.discoverQuery.value.trim();
    const result = await requestJson(`/api/discover${query ? `?query=${encodeURIComponent(query)}` : ''}`);
    renderCandidates(result.candidates || []);
    showToast(`Found ${result.count || 0} data source${result.count === 1 ? '' : 's'}.`);
  } catch (error) {
    els.discoverResults.textContent = error.message;
    showToast(error.message, 'error');
  }
}

function renderCandidates(candidates) {
  els.discoverResults.className = 'discover-results';
  els.discoverResults.replaceChildren();
  if (!candidates.length) {
    els.discoverResults.className = 'discover-results empty-note';
    els.discoverResults.textContent = 'No data sources found. Check Notion access or try a broader query.';
    return;
  }

  for (const candidate of candidates) {
    const row = document.createElement('div');
    row.className = 'candidate';
    row.innerHTML = `
      <div>
        <span class="candidate-title"></span>
        <span class="candidate-url"></span>
      </div>
      <button type="button">Use</button>
    `;
    row.querySelector('.candidate-title').textContent = candidate.title || candidate.data_source_id;
    row.querySelector('.candidate-url').textContent = candidate.url || candidate.data_source_id;
    row.querySelector('button').addEventListener('click', () => {
      els.addForm.elements.input.value = candidate.data_source_id;
      if (!els.addForm.elements.alias.value) {
        els.addForm.elements.alias.value = slugify(candidate.title || 'notion_source');
      }
      if (!els.addForm.elements.name.value) {
        els.addForm.elements.name.value = candidate.title || '';
      }
      els.addForm.elements.alias.focus();
    });
    els.discoverResults.append(row);
  }
}

async function addSource(event) {
  event.preventDefault();
  const form = new FormData(els.addForm);
  const body = {
    alias: String(form.get('alias') || '').trim(),
    input: String(form.get('input') || '').trim(),
    key: clean(form.get('key')),
    title: clean(form.get('title')),
    status: clean(form.get('status')),
    name: clean(form.get('name')),
    overwrite: form.get('overwrite') === 'on',
  };

  try {
    const result = await requestJson('/api/sources', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    state.selectedAlias = result.alias;
    els.addForm.reset();
    await loadConfig();
    showToast(`Added mapping: ${result.alias}`);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function refreshSelectedSource() {
  const source = selectedSource();
  if (!source) return;
  try {
    await requestJson(`/api/sources/${encodeURIComponent(source.alias)}/refresh`, { method: 'POST' });
    await loadConfig();
    showToast(`Refreshed mapping: ${source.alias}`);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function removeSelectedSource() {
  const source = selectedSource();
  if (!source) return;
  const confirmed = window.confirm(`Remove local mapping "${source.alias}"?`);
  if (!confirmed) return;

  try {
    await requestJson(`/api/sources/${encodeURIComponent(source.alias)}?confirm=true`, { method: 'DELETE' });
    state.selectedAlias = undefined;
    await loadConfig();
    showToast(`Removed mapping: ${source.alias}`);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function selectedSource() {
  return state.sources.find((source) => source.alias === state.selectedAlias);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed with ${response.status}`);
  return payload;
}

function showToast(message, type = 'success') {
  els.toast.textContent = message;
  els.toast.className = `toast show${type === 'error' ? ' error' : ''}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.className = 'toast';
  }, 3600);
}

function emptyBlock(message) {
  const node = document.createElement('div');
  node.className = 'empty-note';
  node.textContent = message;
  return node;
}

function clean(value) {
  const text = String(value || '').trim();
  return text || undefined;
}

function slugify(value) {
  const slug = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return slug || 'notion_source';
}
