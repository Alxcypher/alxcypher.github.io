// ===== DATA =====

const FILTERS = [
  {
    question: "What are you in the mood for?",
    type: "single",
    options: [
      { emoji: "📖", label: "Fiction", color: "coral" },
      { emoji: "📚", label: "Nonfiction", color: "sky" }
    ]
  },
  {
    question: "Pick a vibe.",
    type: "multi",
    options: [
      { emoji: "🌙", label: "Dark & moody", color: "lavender" },
      { emoji: "☀️", label: "Feel-good", color: "lemon" },
      { emoji: "🧠", label: "Mind-bending", color: "teal" },
      { emoji: "💔", label: "Emotionally wrecked", color: "rose" },
      { emoji: "😂", label: "Laugh out loud", color: "peach" }
    ]
  },
  {
    question: "How much time do you have?",
    type: "single",
    options: [
      { emoji: "⚡", label: "Quick read (under 250 pages)", color: "peach" },
      { emoji: "📖", label: "Medium (250–400 pages)", color: "mint" },
      { emoji: "🏔️", label: "I want an epic", color: "lavender" }
    ]
  },
  {
    question: "When are you reading?",
    type: "multi",
    options: [
      { emoji: "☕", label: "Morning commute", color: "peach" },
      { emoji: "🌴", label: "Vacation", color: "mint" },
      { emoji: "🛏️", label: "Before bed", color: "lavender" },
      { emoji: "🎧", label: "Background listening", color: "sky" }
    ]
  },
  {
    question: "Any topics that pull you in?",
    type: "multi",
    options: [
      { emoji: "🚀", label: "Space & sci-fi", color: "sky" },
      { emoji: "🗡️", label: "Fantasy worlds", color: "lavender" },
      { emoji: "🔍", label: "Mystery & thriller", color: "coral" },
      { emoji: "💕", label: "Love stories", color: "rose" },
      { emoji: "📜", label: "History & memoir", color: "peach" },
      { emoji: "🧬", label: "Science & ideas", color: "teal" }
    ]
  }
];

const BOOKS = [
  {
    title: "Project Hail Mary",
    author: "Andy Weir",
    coverEmoji: "🚀",
    tag: "☕ Perfect commute read",
    reason: "You're into sci-fi and wanted something mind-bending — this nails both.",
    tags: ["Sci-fi", "Mind-bending", "Medium length"]
  },
  {
    title: "The House in the Cerulean Sea",
    author: "TJ Klune",
    coverEmoji: "🏠",
    tag: "🌴 Great vacation pick",
    reason: "Feel-good fiction with heart — fits your vacation reading vibe perfectly.",
    tags: ["Feel-good", "Fiction", "Quick read"]
  },
  {
    title: "Piranesi",
    author: "Susanna Clarke",
    coverEmoji: "🏛️",
    tag: "🛏️ Beautiful bedtime read",
    reason: "Short, dreamy, and mysterious — the perfect wind-down book.",
    tags: ["Fantasy", "Dark & moody", "Quick read"]
  },
  {
    title: "Klara and the Sun",
    author: "Kazuo Ishiguro",
    coverEmoji: "☀️",
    tag: "🧠 Quietly devastating",
    reason: "Sci-fi meets emotional depth — you asked to be emotionally wrecked.",
    tags: ["Sci-fi", "Emotionally wrecked", "Medium length"]
  },
  {
    title: "The Seven Husbands of Evelyn Hugo",
    author: "Taylor Jenkins Reid",
    coverEmoji: "💃",
    tag: "💔 You will cry",
    reason: "Love stories and emotional gut punches — this book delivers both.",
    tags: ["Love story", "Emotionally wrecked", "Medium length"]
  },
  {
    title: "Sapiens",
    author: "Yuval Noah Harari",
    coverEmoji: "🌍",
    tag: "🎧 Great on audio",
    reason: "Big ideas about humanity — perfect for your background listening sessions.",
    tags: ["Science & ideas", "Nonfiction", "Epic"]
  },
  {
    title: "The Thursday Murder Club",
    author: "Richard Osman",
    coverEmoji: "🔍",
    tag: "😂 Cozy & clever",
    reason: "Mystery with real laughs — matches your want for humor and intrigue.",
    tags: ["Mystery", "Laugh out loud", "Medium length"]
  },
  {
    title: "Educated",
    author: "Tara Westover",
    coverEmoji: "📝",
    tag: "⚡ Can't put it down",
    reason: "Powerful memoir that fits your love for real stories and history.",
    tags: ["Memoir", "Nonfiction", "Mind-bending"]
  }
];

// ===== APP STATE =====

const app = {
  currentFilter: 0,
  selections: [],
  savedBooks: [],
  likedBooks: [],

  // Navigate between screens
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    target.classList.add('active');
  },

  // Start the filter flow from landing
  startFlow() {
    this.currentFilter = 0;
    this.selections = [];
    this.showScreen('filter-flow');
    setTimeout(() => this.renderFilter(), 100);
  },

  // Render the current filter step
  renderFilter() {
    const filter = FILTERS[this.currentFilter];
    const question = document.getElementById('flow-question');
    const container = document.getElementById('pills-container');
    const progress = document.getElementById('progress-fill');
    const skipBtn = document.getElementById('skip-btn');

    // Update progress
    const pct = ((this.currentFilter) / FILTERS.length) * 100;
    progress.style.width = pct + '%';

    // Clear and set question
    question.classList.remove('visible');
    container.innerHTML = '';
    question.textContent = filter.question;

    setTimeout(() => question.classList.add('visible'), 50);

    // Show/hide skip
    skipBtn.style.display = 'block';

    // Create pills with staggered animation
    filter.options.forEach((opt, i) => {
      const pill = document.createElement('button');
      pill.className = 'pill';
      pill.setAttribute('data-color', opt.color);
      pill.innerHTML = `<span>${opt.emoji}</span> ${opt.label}`;
      pill.style.animationDelay = `${i * 0.3}s`;

      pill.addEventListener('click', () => {
        if (filter.type === 'single') {
          this.handleSingleSelect(pill, container, opt);
        } else {
          this.handleMultiSelect(pill, opt);
        }
      });

      container.appendChild(pill);

      // Stagger the appearance
      setTimeout(() => pill.classList.add('visible'), 150 + i * 100);
    });

    // For multi-select, add a "Done" button after a delay
    if (filter.type === 'multi') {
      const doneBtn = document.createElement('button');
      doneBtn.className = 'pill';
      doneBtn.setAttribute('data-color', 'mint');
      doneBtn.innerHTML = '✓ Done';
      doneBtn.style.marginTop = '0.5rem';

      doneBtn.addEventListener('click', () => {
        // Collect selected options
        const selectedPills = container.querySelectorAll('.pill.selected');
        const selectedLabels = Array.from(selectedPills).map(p => p.textContent.trim());
        this.selections.push({ question: filter.question, answers: selectedLabels });
        this.advanceFilter(container);
      });

      container.appendChild(doneBtn);
      setTimeout(() => doneBtn.classList.add('visible'), 150 + filter.options.length * 100 + 200);
    }
  },

  handleSingleSelect(pill, container, opt) {
    // Mark selected
    pill.classList.add('selected');

    // Store selection
    const filter = FILTERS[this.currentFilter];
    this.selections.push({ question: filter.question, answers: [opt.label] });

    // Fade out unselected pills
    const allPills = container.querySelectorAll('.pill');
    allPills.forEach(p => {
      if (p !== pill) p.classList.add('fading-out');
    });

    // Advance after animation
    setTimeout(() => this.advanceFilter(container), 500);
  },

  handleMultiSelect(pill, opt) {
    if (pill.textContent.trim() === '✓ Done') return;
    pill.classList.toggle('selected');
  },

  advanceFilter(container) {
    this.currentFilter++;

    if (this.currentFilter >= FILTERS.length) {
      // Done with filters — show suggestions
      this.showSuggestions();
    } else {
      // Fade out current pills
      container.querySelectorAll('.pill').forEach(p => p.classList.add('fading-out'));
      document.getElementById('flow-question').classList.remove('visible');

      setTimeout(() => this.renderFilter(), 400);
    }
  },

  skipFilter() {
    const container = document.getElementById('pills-container');
    this.selections.push({ question: FILTERS[this.currentFilter].question, answers: ['Skipped'] });
    this.advanceFilter(container);
  },

  // Show inline book suggestions
  showSuggestions() {
    // Update progress to full
    document.getElementById('progress-fill').style.width = '100%';

    // Pick 3 random books for suggestions
    const shuffled = [...BOOKS].sort(() => 0.5 - Math.random());
    const picks = shuffled.slice(0, 3);

    const cardsContainer = document.getElementById('book-cards');
    cardsContainer.innerHTML = '';

    picks.forEach((book, i) => {
      const card = this.createBookCard(book, i);
      cardsContainer.appendChild(card);
    });

    this.showScreen('suggestions');

    // Stagger card appearance
    setTimeout(() => {
      cardsContainer.querySelectorAll('.book-card').forEach((card, i) => {
        setTimeout(() => card.classList.add('visible'), i * 200);
      });
    }, 200);
  },

  createBookCard(book, index) {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML = `
      <div class="book-cover">${book.coverEmoji}</div>
      <div class="book-info">
        <div class="book-title">${book.title}</div>
        <div class="book-author">${book.author}</div>
        <span class="book-tag">${book.tag}</span>
      </div>
      <div class="book-reactions">
        <button class="reaction-btn" data-action="like" title="Like">👍</button>
        <button class="reaction-btn" data-action="dislike" title="Dislike">👎</button>
        <button class="reaction-btn" data-action="save" title="Save for later">🔖</button>
      </div>
    `;

    // Reaction handlers
    card.querySelectorAll('.reaction-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');

        // Toggle active state
        card.querySelectorAll('.reaction-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (action === 'like') {
          this.likedBooks.push(book);
        } else if (action === 'save') {
          this.savedBooks.push(book);
        }
      });
    });

    return card;
  },

  // Show full results
  showResults() {
    const stack = document.getElementById('results-stack');
    stack.innerHTML = '';

    // Show all books as results
    BOOKS.forEach((book, i) => {
      const card = document.createElement('div');
      card.className = 'result-card';
      card.innerHTML = `
        <div class="book-cover">${book.coverEmoji}</div>
        <div class="result-info">
          <div class="book-title">${book.title}</div>
          <div class="book-author">${book.author}</div>
          <div class="result-reason">"${book.reason}"</div>
          <div class="result-tags">
            ${book.tags.map(t => `<span class="result-tag">${t}</span>`).join('')}
          </div>
        </div>
      `;
      stack.appendChild(card);

      setTimeout(() => card.classList.add('visible'), 100 + i * 120);
    });

    this.showScreen('results');
  },

  // Show profile
  showProfile() {
    // Build preference tags from selections
    const prefContainer = document.getElementById('preference-tags');
    prefContainer.innerHTML = '';

    const allAnswers = this.selections
      .flatMap(s => s.answers)
      .filter(a => a !== 'Skipped');

    if (allAnswers.length === 0) {
      allAnswers.push('Fiction lover', 'Mind-bending', 'Sci-fi', 'Quick reads');
    }

    allAnswers.forEach(answer => {
      const tag = document.createElement('span');
      tag.className = 'pref-tag';
      tag.textContent = answer;
      prefContainer.appendChild(tag);
    });

    // Queue — use saved books or defaults
    const queueContainer = document.getElementById('queue-list');
    queueContainer.innerHTML = '';

    const queueBooks = this.savedBooks.length > 0
      ? this.savedBooks
      : BOOKS.slice(0, 3);

    queueBooks.forEach(book => {
      const item = document.createElement('div');
      item.className = 'queue-item';
      item.innerHTML = `
        <div class="queue-cover">${book.coverEmoji}</div>
        <div class="queue-info">
          <div class="book-title">${book.title}</div>
          <div class="book-author">${book.author}</div>
        </div>
      `;
      queueContainer.appendChild(item);
    });

    // History — mock data
    const historyContainer = document.getElementById('history-list');
    historyContainer.innerHTML = '';

    const historyBooks = [
      { title: "Dune", author: "Frank Herbert", emoji: "🏜️", tags: ["Epic", "Sci-fi"] },
      { title: "Normal People", author: "Sally Rooney", emoji: "💬", tags: ["Love story", "Quick read"] },
      { title: "Atomic Habits", author: "James Clear", emoji: "⚡", tags: ["Nonfiction", "Self-help"] }
    ];

    historyBooks.forEach(book => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <div class="history-cover">${book.emoji}</div>
        <div class="history-info">
          <div class="book-title">${book.title}</div>
          <div class="book-author">${book.author}</div>
        </div>
        <div class="history-tags">
          ${book.tags.map(t => `<span class="history-tag">${t}</span>`).join('')}
        </div>
      `;
      historyContainer.appendChild(item);
    });

    this.showScreen('profile');
  },

  // Restart everything
  restart() {
    this.currentFilter = 0;
    this.selections = [];
    this.savedBooks = [];
    this.likedBooks = [];
    this.showScreen('landing');
  }
};
