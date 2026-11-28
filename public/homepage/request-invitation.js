const form = document.querySelector('[data-invitation-request]');
const fields = form.querySelector('fieldset');
const send = form.querySelector('button');
const status = document.querySelector('[data-request-status]');
const error = document.querySelector('[data-request-error]');
const confirmation = document.querySelector('.request-confirmation');
const confirmationTitle = document.querySelector('#request-confirmation-title');
const confirmationMessage = document.querySelector('#request-confirmation-message');
const confirmationSignoff = document.querySelector('#request-confirmation-signoff');
const sentTitle = confirmationTitle.textContent;
const sentMessage = confirmationMessage.textContent;
confirmation.addEventListener('close', () => send.focus());
let pending = false;
let previousRequest;

form.hidden = false;
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (pending) return;
  const answers = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, value.trim()]));
  const payload = JSON.stringify(answers);
  if (previousRequest?.payload !== payload) previousRequest = {payload, id: crypto.randomUUID()};

  pending = true;
  fields.disabled = true;
  form.setAttribute('aria-busy', 'true');
  send.textContent = 'Sending…';
  status.textContent = '';
  error.textContent = '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  let preview;
  try {
    const response = await fetch(form.dataset.endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({...answers, requestId: previousRequest.id}),
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok || (!result.sent && !result.preview)) {
      error.textContent = result.error || 'Could not send your request. Your answers are still here.';
      return;
    }
    form.reset();
    previousRequest = undefined;
    preview = Boolean(result.preview);
  } catch {
    error.textContent = 'Could not confirm your request. Your answers are still here. Try again or email the HH team.';
  } finally {
    clearTimeout(timeout);
    pending = false;
    fields.disabled = false;
    form.setAttribute('aria-busy', 'false');
    send.textContent = 'Send request';
  }
  if (preview === undefined) return;
  if (preview) {
    confirmationTitle.textContent = 'TEST request saved';
    confirmationMessage.textContent = 'Your request was saved in HH TEST. No email was sent.';
    confirmationSignoff.hidden = true;
  } else {
    confirmationTitle.textContent = sentTitle;
    confirmationMessage.textContent = sentMessage;
    confirmationSignoff.hidden = false;
  }
  if (typeof confirmation.showModal === 'function') confirmation.showModal();
  else status.textContent = `${confirmationTitle.textContent}. ${confirmationMessage.textContent}`;
});
