(function () {
  'use strict';
  const { $, $$, showToast, bootUserPage } = window.LighthouseShell;
  const LH = window.Lighthouse;

  // In-session conversation history (role: 'user'|'ai', content: string)
  let conversationHistory = [];

  // ─────────────────────────────────────────────────────────────────────────
  // SUGGESTION BUTTON CONFIGURATION
  // Labels match the HTML exactly. Prompts are what actually gets sent to AI.
  // ─────────────────────────────────────────────────────────────────────────
  const BASE_SUGGESTIONS = [
    {
      label: 'Summarize my week',
      prompt: 'Based on my Lighthouse data, summarize how my week has gone — check-ins, sleep, mood, and any activities I completed.',
    },
    {
      label: 'Explain my dashboard',
      prompt: 'Explain what my current Lighthouse dashboard metrics mean — my wellness score, sleep average, mood trend, and activity streak.',
    },
    {
      label: "Discuss today's reflection",
      prompt: "Let's discuss my most recent journal reflection. What does it reveal about my current state, and are there any themes worth exploring?",
    },
    {
      label: 'Give me a productivity tip',
      prompt: 'Based on my check-in data showing my energy and productivity levels, give me one practical, specific tip for improving my productivity today.',
    },
    {
      label: 'Help me improve my focus',
      prompt: 'Looking at my Lighthouse activity results — especially memory and click accuracy — help me understand how my focus has been and suggest one concrete improvement.',
    },
    {
      label: 'What patterns do you notice?',
      prompt: 'Looking at my Lighthouse data across check-ins, activities, and reflections, what meaningful patterns or trends do you notice about my wellbeing?',
    },
  ];

  // Dynamic suggestions that replace base ones after certain activities are done
  const DYNAMIC_SUGGESTIONS = {
    memory: [
      { label: "Explain today's memory result", prompt: 'Explain my Memory Challenge result from today — what does my accuracy score mean and how does it compare to my average?' },
      { label: 'Show my memory trend', prompt: 'How has my Memory Challenge performance trended over my recent sessions? Am I improving?' },
    ],
    reaction: [
      { label: 'Explain my reaction time', prompt: 'Explain my Reaction Challenge result today — is my reaction time fast or slow compared to my average?' },
      { label: 'How can I improve my reactions?', prompt: 'Based on my Reaction Challenge history, what can I do to improve my reaction speed?' },
    ],
    click_accuracy: [
      { label: 'Explain my click accuracy', prompt: 'Explain my Click Accuracy result from today — what does my score mean and how am I doing overall?' },
      { label: 'Compare with my average', prompt: 'How does my click accuracy today compare to my historical average? Am I getting better?' },
    ],
    journal: [
      { label: "Summarize today's reflection", prompt: 'Summarize my most recent journal reflection and highlight any key themes or emotions I expressed.' },
      { label: 'What themes appear most often?', prompt: 'Looking at all my recent journal reflections, what themes or topics appear most frequently?' },
    ],
    checkin: [
      { label: 'How is my sleep trending?', prompt: 'Based on my recent check-ins, how has my sleep been trending? Is it improving or declining?' },
      { label: 'How has my mood been?', prompt: 'Based on my check-in history, what has my mood trend looked like recently?' },
    ],
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CONTEXT FETCHER — called fresh on every send
  // ─────────────────────────────────────────────────────────────────────────
  async function fetchLighthouseContext(user) {
    try {
      const [
        todaysProgress,
        recentCheckins,
        recentReflections,
        activityStats,
        dashboardMetrics,
        weeklyReport,
        todayMemory,
        todayReaction,
        todayClickAcc,
        profile,
        scenarioResponses,
      ] = await Promise.all([
        LH.getTodaysProgress().catch(() => null),
        LH.listCheckins({ limit: 14 }).catch(() => []),
        LH.listReflections({ limit: 5 }).catch(() => []),
        LH.getActivityStats().catch(() => null),
        LH.getDashboardMetrics().catch(() => null),
        LH.getReport('weekly').catch(() => null),
        LH.getTodayActivityResult('memory').catch(() => null),
        LH.getTodayActivityResult('reaction').catch(() => null),
        LH.getTodayActivityResult('click_accuracy').catch(() => null),
        LH.ensureProfile(user).catch(() => null),
        LH.listScenarioResponses().catch(() => []),
      ]);

      return {
        profile: profile ? {
          displayName: profile.display_name || LH.displayNameFromUser(user),
          occupation: profile.occupation || null,
          interests: profile.interests || [],
          shortBio: profile.short_bio || null,
        } : null,
        todaysProgress,
        recentCheckins,
        recentReflections,
        activityStats,
        dashboardMetrics,
        weeklyReport,
        scenarioCount: (scenarioResponses || []).length,
        todayActivities: {
          memory: todayMemory,
          reaction: todayReaction,
          click_accuracy: todayClickAcc,
        },
      };
    } catch (err) {
      console.warn('[Companion] Context fetch failed silently:', err?.message);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DYNAMIC SUGGESTION UPDATER
  // Replaces up to 2 base suggestion buttons based on today's activity.
  // Only modifies the dataset.prompt — labels remain unchanged on the HTML.
  // ─────────────────────────────────────────────────────────────────────────
  function updateDynamicSuggestions(context) {
    if (!context) return;

    const btnEls = Array.from($$('.chat-prompt'));
    if (!btnEls.length) return;

    const tp = context.todaysProgress?.steps || {};
    const ta = context.todayActivities || {};

    // Determine which dynamic set to inject (priority order)
    const candidates = [];
    if (ta.memory) candidates.push(...DYNAMIC_SUGGESTIONS.memory);
    if (ta.reaction) candidates.push(...DYNAMIC_SUGGESTIONS.reaction);
    if (ta.click_accuracy) candidates.push(...DYNAMIC_SUGGESTIONS.click_accuracy);
    if (tp.journal) candidates.push(...DYNAMIC_SUGGESTIONS.journal);
    if (tp.checkin) candidates.push(...DYNAMIC_SUGGESTIONS.checkin);

    if (!candidates.length) return;

    // Replace slots 4 and 5 (index 3 and 4 = "Give me a productivity tip" and "Help me improve my focus")
    // with the most relevant dynamic suggestions
    const toInject = candidates.slice(0, 2);
    const slots = [3, 4]; // zero-indexed positions in the 6-button grid

    toInject.forEach((suggestion, i) => {
      const btn = btnEls[slots[i]];
      if (btn) {
        btn.dataset.prompt = suggestion.prompt;
        // Optionally update the visible label too
        btn.textContent = suggestion.label;
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UI HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  function scrollToBottom() {
    const el = $('#chatMessages');
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }

  function showWelcome(visible) {
    const welcome = $('#chatWelcome');
    const msgEl = $('#chatMessages');
    if (welcome) welcome.hidden = !visible;
    if (msgEl) msgEl.hidden = visible;
  }

  function showTyping(visible) {
    const typing = $('#chatTyping');
    if (typing) typing.hidden = !visible;
    if (visible) scrollToBottom();
  }

  function createBubble(role, text) {
    const div = document.createElement('div');
    div.className = `chat-bubble ${role}`;

    if (role === 'ai') {
      const avatar = document.createElement('span');
      avatar.className = 'chat-avatar';
      avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
      div.appendChild(avatar);
      const body = document.createElement('div');
      body.className = 'chat-body';
      const content = document.createElement('div');
      content.className = 'chat-content';
      // Safely render paragraphs and line breaks
      content.innerHTML = '<p>' +
        text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n\n+/g, '</p><p>')
          .replace(/\n/g, '<br>') +
        '</p>';
      body.appendChild(content);
      const time = document.createElement('div');
      time.className = 'chat-time';
      time.textContent = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      body.appendChild(time);
      div.appendChild(body);
    } else {
      const body = document.createElement('div');
      body.className = 'chat-body';
      const content = document.createElement('div');
      content.className = 'chat-content';
      content.textContent = text;
      body.appendChild(content);
      const time = document.createElement('div');
      time.className = 'chat-time';
      time.textContent = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      body.appendChild(time);
      div.appendChild(body);
    }

    return div;
  }

  function addMessage(role, text) {
    conversationHistory.push({ role, content: text });
    const msgEl = $('#chatMessages');
    if (msgEl) {
      msgEl.appendChild(createBubble(role, text));
      scrollToBottom();
    }
  }

  function addErrorBubble(errorText) {
    const msgEl = $('#chatMessages');
    if (!msgEl) return;
    const div = document.createElement('div');
    div.className = 'chat-bubble ai chat-bubble-error';
    const avatar = document.createElement('span');
    avatar.className = 'chat-avatar';
    avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    div.appendChild(avatar);
    const body = document.createElement('div');
    body.className = 'chat-body';
    const content = document.createElement('div');
    content.className = 'chat-content chat-content-error';
    content.textContent = errorText;
    body.appendChild(content);
    div.appendChild(body);
    msgEl.appendChild(div);
    scrollToBottom();
  }

  function disableInput(disabled) {
    const input = $('#chatInput');
    const btn = $('#chatSendBtn');
    if (input) input.disabled = disabled;
    if (btn) btn.disabled = disabled;
  }

  function clearInput() {
    const input = $('#chatInput');
    if (input) { input.value = ''; input.style.height = 'auto'; }
    const btn = $('#chatSendBtn');
    if (btn) btn.disabled = true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GROQ API CALL — fetches fresh context on every send
  // ─────────────────────────────────────────────────────────────────────────
  async function fetchGroqReply(userMessage, user) {
    disableInput(true);
    showTyping(true);

    // Re-fetch context fresh on every send (per user requirement)
    const context = await fetchLighthouseContext(user);

    // Also update dynamic suggestions based on fresh context
    updateDynamicSuggestions(context);

    // History excludes the message we're about to send (last item)
    const history = conversationHistory.slice(0, -1);

    let retries = 0;
    const MAX_RETRIES = 1;

    while (retries <= MAX_RETRIES) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMessage, history, context }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = await response.json();
        showTyping(false);

        if (!response.ok) {
          if (response.status === 429 && retries < MAX_RETRIES) {
            retries++;
            showTyping(true);
            await new Promise(r => setTimeout(r, 3000));
            continue;
          }
          addErrorBubble(data.error || 'Something went wrong. Please try again.');
          disableInput(false);
          return;
        }

        if (data.reply) addMessage('ai', data.reply);
        disableInput(false);
        const input = $('#chatInput');
        if (input) input.focus();
        return;

      } catch (err) {
        showTyping(false);
        if (err.name === 'AbortError') {
          addErrorBubble('The response took too long. Please try again.');
        } else if (!navigator.onLine) {
          addErrorBubble('You appear to be offline. Please check your connection and try again.');
        } else {
          addErrorBubble('Could not reach the AI. Please try again in a moment.');
        }
        disableInput(false);
        const input = $('#chatInput');
        if (input) input.focus();
        return;
      }
    }

    showTyping(false);
    addErrorBubble('The AI is busy right now. Please try again in a moment.');
    disableInput(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEND FLOW
  // ─────────────────────────────────────────────────────────────────────────
  function sendMessage(text, user) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    if (conversationHistory.length === 0) showWelcome(false);
    addMessage('user', trimmed);
    clearInput();
    fetchGroqReply(trimmed, user);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────────────────────
  (async function init() {
    const session = await bootUserPage();
    if (!session) return;
    const { user } = session;
    const name = LH.displayNameFromUser(user);
    const firstName = name.split(' ')[0] || '';

    if ($('#welcomeName')) {
      $('#welcomeName').textContent = firstName ? ` ${firstName}` : '';
    }

    // Update base suggestion button prompts (labels stay as-is in HTML)
    const promptBtns = Array.from($$('.chat-prompt'));
    BASE_SUGGESTIONS.forEach((s, i) => {
      if (promptBtns[i]) promptBtns[i].dataset.prompt = s.prompt;
    });

    // Prefetch context once on load to set dynamic suggestions early
    fetchLighthouseContext(user).then(ctx => updateDynamicSuggestions(ctx));

    const input = $('#chatInput');
    const sendBtn = $('#chatSendBtn');

    if (input) {
      input.addEventListener('input', () => {
        autoResize(input);
        if (sendBtn) sendBtn.disabled = !input.value.trim();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage(input.value, user);
        }
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => sendMessage(input.value, user));
    }

    const cta = $('#startChatCta');
    if (cta) {
      cta.addEventListener('click', () => { if (input) input.focus(); });
    }

    const chatPrompts = $('#chatPrompts');
    if (chatPrompts) {
      chatPrompts.addEventListener('click', (e) => {
        const btn = e.target.closest('.chat-prompt');
        if (!btn) return;
        const prompt = btn.dataset.prompt || btn.textContent.trim();
        if (input) { input.value = prompt; autoResize(input); }
        if (sendBtn) sendBtn.disabled = false;
        sendMessage(prompt, user);
      });
    }
  })();
})();
