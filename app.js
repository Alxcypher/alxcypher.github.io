// Legal Skills Bank - Application Logic
(function () {
  'use strict';

  // State
  let activeSkillId = null;
  let activeCategory = null;
  let activeTags = new Set();
  let searchQuery = '';
  let searchVisible = false;

  // DOM refs
  const els = {
    categoryList: document.getElementById('category-list'),
    skillsList: document.getElementById('skills-list'),
    detailPanel: document.getElementById('detail-panel'),
    detailWelcome: document.getElementById('detail-welcome'),
    detailView: document.getElementById('detail-view'),
    detailTitle: document.getElementById('detail-title'),
    detailAuthor: document.getElementById('detail-author'),
    detailUpdated: document.getElementById('detail-updated'),
    detailJurisdiction: document.getElementById('detail-jurisdiction'),
    detailComplexity: document.getElementById('detail-complexity'),
    detailTags: document.getElementById('detail-tags'),
    detailSummary: document.getElementById('detail-summary'),
    detailContent: document.getElementById('detail-content'),
    searchInput: document.getElementById('search-input'),
    searchContainer: document.getElementById('search-container'),
    btnSearch: document.getElementById('btn-search'),
    btnCopy: document.getElementById('btn-copy-skill'),
    activeFilters: document.getElementById('active-filters'),
    activeFiltersList: document.getElementById('active-filters-list'),
    clearFilters: document.getElementById('clear-filters'),
    welcomeSkillCount: document.getElementById('welcome-skill-count'),
    welcomeCategoryCount: document.getElementById('welcome-category-count'),
    welcomeTagCount: document.getElementById('welcome-tag-count'),
  };

  // ===== Init =====
  function init() {
    renderCategories();
    renderSkillsList();
    renderTagsPanel();
    updateStats();
    bindEvents();
  }

  // ===== Categories (2nd column) =====
  function renderCategories() {
    const folders = {};
    SKILLS.forEach(s => {
      if (!folders[s.folder]) folders[s.folder] = 0;
      folders[s.folder]++;
    });

    let html = '<div class="category-section">';
    html += '<div class="category-section__header">Practice Areas</div>';

    // "All Skills" item
    html += `<div class="category-item category-item--active" data-category="all">
      <span class="category-item__icon">📚</span>
      <span class="category-item__label">All Skills</span>
      <span class="category-item__count">${SKILLS.length}</span>
    </div>`;

    Object.keys(FOLDER_META).forEach(key => {
      const meta = FOLDER_META[key];
      const count = folders[key] || 0;
      html += `<div class="category-item" data-category="${key}">
        <span class="category-item__icon">${meta.icon}</span>
        <span class="category-item__label">${meta.label}</span>
        <span class="category-item__count">${count}</span>
      </div>`;
    });

    html += '</div>';
    els.categoryList.innerHTML = html;
  }

  // ===== Tags Panel (in customize panel) =====
  function renderTagsPanel() {
    // Group tags by category
    const groups = {};
    Object.entries(TAG_CATEGORIES).forEach(([tag, cat]) => {
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(tag);
    });

    const groupLabels = {
      practice: 'Practice Area',
      industry: 'Industry',
      jurisdiction: 'Jurisdiction',
      contract: 'Topic',
      complexity: 'Complexity',
      clause: 'Clause Type',
    };

    // We'll put tag filters inside the customize panel content when "Tags" tab is selected
    // For now, store tag data for later use
    window._tagGroups = groups;
    window._groupLabels = groupLabels;
  }

  // ===== Skills List (3rd column) =====
  function renderSkillsList() {
    const filtered = getFilteredSkills();

    if (filtered.length === 0) {
      els.skillsList.innerHTML = '<div class="skills-empty">No skills match your filters.</div>';
      return;
    }

    // Group by folder
    const grouped = {};
    filtered.forEach(s => {
      if (!grouped[s.folder]) grouped[s.folder] = [];
      grouped[s.folder].push(s);
    });

    let html = '';
    Object.keys(grouped).forEach(folder => {
      const meta = FOLDER_META[folder] || { icon: '📁', label: folder };
      const skills = grouped[folder];

      html += `<div class="skills-group skills-group--open" data-folder="${folder}">
        <div class="skills-group__header">
          <span class="skills-group__arrow">▶</span>
          <span>${meta.icon} ${meta.label}</span>
        </div>
        <div class="skills-group__items">`;

      skills.forEach(s => {
        const isActive = s.id === activeSkillId;
        html += `<div class="skill-item ${isActive ? 'skill-item--active' : ''}" data-skill="${s.id}">
          <span class="skill-item__icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </span>
          <span class="skill-item__name">${s.name}</span>
          <span class="skill-item__expand">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </div>`;
      });

      html += '</div></div>';
    });

    els.skillsList.innerHTML = html;
  }

  function getFilteredSkills() {
    let result = SKILLS;

    // Filter by category
    if (activeCategory && activeCategory !== 'all') {
      result = result.filter(s => s.folder === activeCategory);
    }

    // Filter by tags
    if (activeTags.size > 0) {
      result = result.filter(s => {
        for (const tag of activeTags) {
          if (!s.tags.includes(tag)) return false;
        }
        return true;
      });
    }

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q)) ||
        s.content.toLowerCase().includes(q)
      );
    }

    return result;
  }

  // ===== Skill Detail (4th column) =====
  function showSkillDetail(skillId) {
    const skill = SKILLS.find(s => s.id === skillId);
    if (!skill) return;

    activeSkillId = skillId;

    // Update UI
    els.detailWelcome.style.display = 'none';
    els.detailView.style.display = 'block';

    els.detailTitle.textContent = skill.name;
    els.detailAuthor.textContent = 'Community';
    els.detailUpdated.textContent = 'Mar 7, 2026';
    els.detailJurisdiction.textContent = skill.jurisdiction;
    els.detailComplexity.textContent = skill.complexity.charAt(0).toUpperCase() + skill.complexity.slice(1);
    els.detailSummary.textContent = skill.summary;

    // Tags
    els.detailTags.innerHTML = skill.tags.map(t => {
      const cat = TAG_CATEGORIES[t] || 'practice';
      return `<span class="tag tag--${cat}">${t}</span>`;
    }).join('');

    // Content (simple markdown rendering)
    els.detailContent.innerHTML = renderMarkdown(skill.content);

    // Scroll to top
    els.detailPanel.scrollTop = 0;

    // Update active state in list
    renderSkillsList();
  }

  function showWelcome() {
    activeSkillId = null;
    els.detailWelcome.style.display = 'flex';
    els.detailView.style.display = 'none';
    renderSkillsList();
  }

  // ===== Simple Markdown Renderer =====
  function renderMarkdown(md) {
    let html = md;

    // Escape HTML
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Code blocks (```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Blockquotes
    html = html.replace(/^&gt;\s(.+)$/gm, '<blockquote>$1</blockquote>');
    // Merge adjacent blockquotes
    html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Checkbox lists
    html = html.replace(/^- \[ \] (.+)$/gm, '<li class="checklist-item">$1</li>');

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');

    // Numbered lists
    html = html.replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>');

    // Wrap consecutive <li> elements in <ul>
    html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

    // Paragraphs — wrap lines that aren't already in a tag
    html = html.split('\n\n').map(block => {
      block = block.trim();
      if (!block) return '';
      if (block.startsWith('<')) return block;
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    return html;
  }

  // ===== Filters UI =====
  function updateFiltersUI() {
    if (activeTags.size === 0) {
      els.activeFilters.style.display = 'none';
      return;
    }

    els.activeFilters.style.display = 'flex';
    els.activeFiltersList.innerHTML = Array.from(activeTags).map(t => {
      const cat = TAG_CATEGORIES[t] || 'practice';
      return `<span class="tag tag--sm tag--${cat} tag--active" data-tag="${t}">${t} ×</span>`;
    }).join('');
  }

  function toggleTag(tag) {
    if (activeTags.has(tag)) {
      activeTags.delete(tag);
    } else {
      activeTags.add(tag);
    }
    updateFiltersUI();
    renderSkillsList();
  }

  function clearAllFilters() {
    activeTags.clear();
    searchQuery = '';
    els.searchInput.value = '';
    activeCategory = null;
    updateFiltersUI();
    renderCategories();
    renderSkillsList();

    // Reset active category to "All"
    document.querySelectorAll('.category-item').forEach(el => el.classList.remove('category-item--active'));
    const allItem = document.querySelector('[data-category="all"]');
    if (allItem) allItem.classList.add('category-item--active');
  }

  // ===== Stats =====
  function updateStats() {
    els.welcomeSkillCount.textContent = SKILLS.length;
    els.welcomeCategoryCount.textContent = Object.keys(FOLDER_META).length;

    const allTags = new Set();
    SKILLS.forEach(s => s.tags.forEach(t => allTags.add(t)));
    els.welcomeTagCount.textContent = allTags.size;
  }

  // ===== Copy =====
  function copySkillContent() {
    const skill = SKILLS.find(s => s.id === activeSkillId);
    if (!skill) return;

    navigator.clipboard.writeText(skill.content).then(() => {
      const btn = els.btnCopy;
      const origColor = btn.style.color;
      btn.style.color = '#4ade80';
      btn.title = 'Copied!';
      setTimeout(() => {
        btn.style.color = origColor;
        btn.title = 'Copy skill content';
      }, 1500);
    });
  }

  // ===== Events =====
  function bindEvents() {
    // Category clicks
    els.categoryList.addEventListener('click', e => {
      const item = e.target.closest('.category-item');
      if (!item) return;

      activeCategory = item.dataset.category;

      document.querySelectorAll('.category-item').forEach(el => el.classList.remove('category-item--active'));
      item.classList.add('category-item--active');

      renderSkillsList();
    });

    // Skill group toggle
    els.skillsList.addEventListener('click', e => {
      const header = e.target.closest('.skills-group__header');
      if (header) {
        const group = header.closest('.skills-group');
        group.classList.toggle('skills-group--open');
        return;
      }

      const skillItem = e.target.closest('.skill-item');
      if (skillItem) {
        showSkillDetail(skillItem.dataset.skill);
      }
    });

    // Search toggle
    els.btnSearch.addEventListener('click', () => {
      searchVisible = !searchVisible;
      els.searchContainer.style.display = searchVisible ? 'block' : 'none';
      if (searchVisible) {
        els.searchInput.focus();
      } else {
        searchQuery = '';
        els.searchInput.value = '';
        renderSkillsList();
      }
    });

    // Search input
    els.searchInput.addEventListener('input', e => {
      searchQuery = e.target.value;
      renderSkillsList();
    });

    // Copy button
    els.btnCopy.addEventListener('click', copySkillContent);

    // Clear filters
    els.clearFilters.addEventListener('click', clearAllFilters);

    // Tag clicks in detail view
    els.detailTags.addEventListener('click', e => {
      const tag = e.target.closest('.tag');
      if (tag) toggleTag(tag.textContent);
    });

    // Tag clicks in active filters
    els.activeFiltersList.addEventListener('click', e => {
      const tag = e.target.closest('.tag');
      if (tag) toggleTag(tag.dataset.tag);
    });

    // Customize panel tab switching
    document.querySelectorAll('.customize-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.customize-tab').forEach(t => t.classList.remove('customize-tab--active'));
        tab.classList.add('customize-tab--active');

        const view = tab.dataset.tab;
        if (view === 'tags') {
          renderTagsView();
        } else {
          renderCategories();
        }
      });
    });

    // Keyboard shortcut: Cmd/Ctrl + K for search
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchVisible = true;
        els.searchContainer.style.display = 'block';
        els.searchInput.focus();
      }
      if (e.key === 'Escape') {
        if (searchVisible) {
          searchVisible = false;
          els.searchContainer.style.display = 'none';
          searchQuery = '';
          els.searchInput.value = '';
          renderSkillsList();
        }
      }
    });
  }

  // ===== Tags View (replaces categories in customize panel) =====
  function renderTagsView() {
    const groups = window._tagGroups;
    const labels = window._groupLabels;

    let html = '';
    Object.entries(labels).forEach(([catKey, label]) => {
      const tags = groups[catKey];
      if (!tags || tags.length === 0) return;

      html += `<div class="tag-group">
        <div class="tag-group__label">${label}</div>
        <div class="tag-group__items">`;

      tags.forEach(t => {
        const isActive = activeTags.has(t);
        html += `<span class="tag tag--sm tag--${catKey} ${isActive ? 'tag--active' : ''}" data-filter-tag="${t}">${t}</span>`;
      });

      html += '</div></div>';
    });

    els.categoryList.innerHTML = html;

    // Bind tag click events in this view
    els.categoryList.querySelectorAll('[data-filter-tag]').forEach(el => {
      el.addEventListener('click', () => {
        toggleTag(el.dataset.filterTag);
        renderTagsView(); // Re-render to update active states
      });
    });
  }

  // Go!
  init();
})();
