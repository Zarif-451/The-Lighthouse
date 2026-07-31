(function () {
  'use strict';
  const { $, $$, showToast, bootUserPage } = window.LighthouseShell;

  let messages = [];

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  function scrollToBottom() {
    const el = $('#chatMessages');
    if (el) {
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    }
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
      content.textContent = text;
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
    messages.push({ role, text, time: Date.now() });
    const msgEl = $('#chatMessages');
    if (msgEl) {
      msgEl.appendChild(createBubble(role, text));
      scrollToBottom();
    }
  }

  function disableInput(disabled) {
    const input = $('#chatInput');
    const btn = $('#chatSendBtn');
    if (input) input.disabled = disabled;
    if (btn) btn.disabled = disabled;
  }

  function clearInput() {
    const input = $('#chatInput');
    if (input) {
      input.value = '';
      input.style.height = 'auto';
    }
    const btn = $('#chatSendBtn');
    if (btn) btn.disabled = true;
  }

  async function simulateReply(userMessage) {
    disableInput(true);
    showTyping(true);
    scrollToBottom();

    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 1200));

    showTyping(false);

    const lower = (userMessage || '').toLowerCase();
    let reply = '';

    if (lower.includes('summarize') || lower.includes('week') || lower.includes('summary')) {
      reply = 'Based on your recent check-ins, your sleep has been averaging around 7 hours this week, your mood has been mostly "Good" with occasional dips midweek, and you have completed your daily journey steps on 4 out of 5 active days. Your wellness score is trending upward. Would you like me to go deeper into any of these areas?';
    } else if (lower.includes('dashboard') || lower.includes('explain')) {
      reply = 'Your dashboard gives you a real-time view of your wellbeing. At the top you will find your wellness score calculated from sleep, mood, productivity, physical activity, reflections, and journey completion. The trend chart shows your wellness over the last 30 days, and the distribution ring breaks your days into Excellent, Good, Moderate, and Needs Attention bands. Below that, the behavioural cards slot in specific metrics from each activity — Memory, Click Accuracy, Reaction Speed, and more. You can switch between Demo and Real-time analytics at any time using the toggle at the top of the charts.';
    } else if (lower.includes('reflection') || lower.includes('today')) {
      reply = 'Reflecting — even just a few sentences — helps you notice what is working and where you might need a little more care. If you have journaled today, you can view your latest entries on the dashboard. If you are in the middle of the daily journey, the Reflection Journal step unlocks once all the core activities are complete. Would you like a prompt to help you get started with a reflection right now?';
    } else if (lower.includes('productivity') || lower.includes('tip')) {
      reply = 'One simple productivity approach that works well alongside Lighthouse is the "3-3-3 method": identify three small wins you can achieve today, three medium tasks to move forward, and three moments of rest or recovery. This balances output with the self-care that Lighthouse encourages. If you try it, you can note how it felt in your daily check-in notes.';
    } else if (lower.includes('focus') || lower.includes('improve')) {
      reply = 'Improving focus often starts with reducing friction. Try a short timer — 20 or 25 minutes — for a single task, then take a 5-minute break. After a few focused blocks, step outside or look away from screens. This ties in well with the Memory Challenge and Click Accuracy Challenge in your daily journey, both of which gently exercise your concentration. If you complete those activities regularly, Lighthouse can show you your accuracy trends over time so you can see if your focus is improving.';
    } else if (lower.includes('pattern') || lower.includes('notice')) {
      reply = 'From what I can see, you are building a consistent habit of daily check-ins, which is the best foundation. Over time, patterns often emerge in a few key areas — sleep regularity, midweek energy dips, and which visual themes you gravitate toward. The Insights page tracks week-over-week comparisons for check-ins, reflections, and sleep so you can spot shifts early. Keeping your daily journey consistent is the best way to make those patterns visible.';
    } else {
      reply = 'That is a thoughtful question. I am here to support your wellbeing journey — I can help you reflect on your week, make sense of your dashboard and insights, suggest ways to improve focus or productivity, or help you notice patterns in your activity. Would any of those sound helpful right now?';
    }

    addMessage('ai', reply);
    disableInput(false);
    const input = $('#chatInput');
    if (input) input.focus();
  }

  function sendMessage(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    if (messages.length === 0) showWelcome(false);

    addMessage('user', trimmed);
    clearInput();

    simulateReply(trimmed);
  }

  (async function init() {
    const session = await bootUserPage();
    if (!session) return;
    const { user } = session;
    const name = window.Lighthouse.displayNameFromUser(user);
    const firstName = name.split(' ')[0] || '';

    if ($('#welcomeName')) {
      $('#welcomeName').textContent = firstName ? ` ${firstName}` : '';
    }

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
          sendMessage(input.value);
        }
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        sendMessage(input.value);
      });
    }

    const cta = $('#startChatCta');
    if (cta) {
      cta.addEventListener('click', () => {
        if (input) input.focus();
      });
    }

    $('#chatPrompts').addEventListener('click', (e) => {
      const btn = e.target.closest('.chat-prompt');
      if (!btn) return;
      const prompt = btn.dataset.prompt;
      if (input) input.value = prompt;
      autoResize(input);
      if (sendBtn) sendBtn.disabled = false;
      sendMessage(prompt);
    });
  })();
})();
