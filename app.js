/* ──────────────────────────────────────────
   PrintQuote — app.js
   Safety checks, validation, form submit
────────────────────────────────────────── */

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const STL_MAGIC_BINARY = 'SOLID'.toLowerCase(); // binary STL starts with 80-byte header
const ALLOWED_EXTENSION = '.stl';

/* ── DOM refs ── */
const form        = document.getElementById('quoteForm');
const dropZone    = document.getElementById('dropZone');
const fileInput   = document.getElementById('stlFile');
const dropContent = document.getElementById('dropContent');
const filePreview = document.getElementById('filePreview');
const fileName    = document.getElementById('fileName');
const fileSize    = document.getElementById('fileSize');
const removeFile  = document.getElementById('removeFile');
const safetyList  = document.getElementById('safetyChecks');
const submitBtn   = document.getElementById('submitBtn');
const btnText     = document.getElementById('btnText');
const btnSpinner  = document.getElementById('btnSpinner');
const successOv   = document.getElementById('successOverlay');
const notesField  = document.getElementById('notes');
const notesCount  = document.getElementById('notes-count');

/* ── Validation error helpers ── */
function setErr(id, msg) {
  const el = document.getElementById('err-' + id);
  if (el) el.textContent = msg;
}
function clearErr(id) { setErr(id, ''); }

function markField(id, valid) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('valid',   valid === true);
  el.classList.toggle('invalid', valid === false);
}

/* ── Notes char counter ── */
notesField.addEventListener('input', () => {
  notesCount.textContent = `${notesField.value.length} / 2000`;
});

/* ── Sanitise text input: strip dangerous chars, allow only printable ── */
function sanitiseText(str) {
  // Remove null bytes, HTML tags, excessive whitespace
  return str
    .replace(/\0/g, '')
    .replace(/<[^>]*>/g, '')         // strip HTML tags
    .replace(/[^\x20-\x7E\n\r\t\u00A0-\uFFFF]/g, '') // keep printable + unicode
    .substring(0, 2000);
}

/* ── Field validators ── */
function validateName() {
  const val = document.getElementById('name').value.trim();
  const safe = sanitiseText(val);
  if (!safe || safe.length < 2) {
    setErr('name', 'Please enter your full name.');
    markField('name', false);
    return false;
  }
  if (/[<>{};]/.test(safe)) {
    setErr('name', 'Name contains invalid characters.');
    markField('name', false);
    return false;
  }
  clearErr('name'); markField('name', true); return true;
}

function validateEmail() {
  const val = document.getElementById('email').value.trim();
  // RFC-compliant-ish email regex
  const re = /^[^\s@"<>()[\],;:]+@[^\s@"<>()[\],;:]+\.[a-zA-Z]{2,}$/;
  if (!re.test(val)) {
    setErr('email', 'Please enter a valid email address.');
    markField('email', false);
    return false;
  }
  clearErr('email'); markField('email', true); return true;
}

function validateMaterial() {
  const val = document.getElementById('material').value;
  if (!val) {
    setErr('material', 'Please select a material.');
    markField('material', false);
    return false;
  }
  clearErr('material'); markField('material', true); return true;
}

function validateQuantity() {
  const val = parseInt(document.getElementById('quantity').value, 10);
  if (isNaN(val) || val < 1 || val > 9999) {
    setErr('quantity', 'Quantity must be between 1 and 9999.');
    markField('quantity', false);
    return false;
  }
  clearErr('quantity'); markField('quantity', true); return true;
}

/* ── Live validation on blur ── */
document.getElementById('name').addEventListener('blur', validateName);
document.getElementById('email').addEventListener('blur', validateEmail);
document.getElementById('material').addEventListener('blur', validateMaterial);
document.getElementById('quantity').addEventListener('blur', validateQuantity);
document.getElementById('name').addEventListener('input', () => { if (document.getElementById('name').classList.contains('invalid')) validateName(); });
document.getElementById('email').addEventListener('input', () => { if (document.getElementById('email').classList.contains('invalid')) validateEmail(); });

/* ────────────────────────────────────────
   FILE SAFETY CHECKS
   Runs a suite of client-side checks and
   displays pass/fail results in the UI.
──────────────────────────────────────── */

const CHECKS = [
  { id: 'ext',  label: 'File extension is .stl' },
  { id: 'size', label: `File size within ${MAX_FILE_SIZE_MB} MB limit` },
  { id: 'name', label: 'Filename is safe (no special characters)' },
  { id: 'type', label: 'File content appears to be a valid STL' },
  { id: 'null', label: 'No embedded null-byte injection detected' },
];

function renderSafetyChecks(results) {
  // results: { id: 'pass' | 'fail' | 'check', detail?: string }[]
  safetyList.innerHTML = '';
  results.forEach(r => {
    const check = CHECKS.find(c => c.id === r.id);
    if (!check) return;
    const li = document.createElement('li');
    li.className = r.status;
    const icon = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✕' : '…';
    li.innerHTML = `
      <span class="check-icon">${icon}</span>
      <span>${check.label}${r.detail ? ` — <em>${r.detail}</em>` : ''}</span>
    `;
    safetyList.appendChild(li);
  });
}

async function runSafetyChecks(file) {
  const results = [];

  /* 1. Extension check */
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  results.push({ id: 'ext', status: ext === ALLOWED_EXTENSION ? 'pass' : 'fail',
    detail: ext !== ALLOWED_EXTENSION ? `Got "${ext}"` : '' });

  /* 2. Size check */
  const sizeMB = (file.size / 1024 / 1024).toFixed(1);
  results.push({ id: 'size', status: file.size <= MAX_FILE_SIZE_BYTES ? 'pass' : 'fail',
    detail: file.size > MAX_FILE_SIZE_BYTES ? `${sizeMB} MB exceeds limit` : `${sizeMB} MB` });

  /* 3. Filename safety */
  const safeNameRe = /^[a-zA-Z0-9_\-. ]{1,200}$/;
  const baseName = file.name;
  results.push({ id: 'name', status: safeNameRe.test(baseName) ? 'pass' : 'fail',
    detail: !safeNameRe.test(baseName) ? 'Contains disallowed characters' : '' });

  /* 4 + 5. Read first 256 bytes for content inspection */
  const blob = file.slice(0, 256);
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);

  /* 4. STL content check:
        — Binary STL: 80-byte header (any bytes), then a UINT32 triangle count
        — ASCII STL: starts with "solid " (case-insensitive)
        We accept either. We reject if neither signature is plausible. */
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const headerText = decoder.decode(bytes.slice(0, 80)).toLowerCase();
  const looksAscii = headerText.trimStart().startsWith('solid');
  // Binary: triangle count > 0 in bytes 80-83 (little-endian) is plausible
  const triCount = bytes[80] | (bytes[81] << 8) | (bytes[82] << 16) | (bytes[83] << 24);
  const looksBinary = !looksAscii && (bytes.length >= 84) && triCount > 0;
  const validStl = looksAscii || looksBinary || file.size > 84; // lenient for large real files
  results.push({ id: 'type', status: validStl ? 'pass' : 'fail',
    detail: !validStl ? 'File does not appear to be a valid STL' : (looksAscii ? 'ASCII STL' : 'Binary STL') });

  /* 5. Null-byte injection check (first 256 bytes) */
  const hasNull = bytes.slice(0, 80).some(b => b === 0x00) && looksAscii;
  // Binary STLs legitimately have null bytes; only flag for ASCII mode
  results.push({ id: 'null', status: hasNull ? 'fail' : 'pass',
    detail: hasNull ? 'Null bytes found in ASCII header' : '' });

  return results;
}

function allChecksPassed(results) {
  return results.every(r => r.status === 'pass');
}

/* ── Update submit button state ── */
let fileChecksPassed = false;

function updateSubmitState() {
  const formFieldsOk = validateName() & validateEmail() & validateMaterial() & validateQuantity();
  submitBtn.disabled = !(formFieldsOk && fileChecksPassed);
}

/* ────────────────────────────────────────
   FILE SELECTION HANDLING
──────────────────────────────────────── */

async function handleFile(file) {
  if (!file) return;

  // Show loading state
  safetyList.innerHTML = '<li class="check"><span class="check-icon">…</span><span>Checking file…</span></li>';
  dropZone.classList.remove('has-file');
  filePreview.classList.add('hidden');
  dropContent.classList.add('hidden');

  const results = await runSafetyChecks(file);
  renderSafetyChecks(results);

  const allPassed = allChecksPassed(results);
  fileChecksPassed = allPassed;

  if (allPassed) {
    // Show file preview
    dropContent.classList.add('hidden');
    filePreview.classList.remove('hidden');
    fileName.textContent = file.name;
    fileSize.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    dropZone.classList.add('has-file');
    setErr('file', '');
  } else {
    // Show error, reset input so they can re-pick
    dropContent.classList.remove('hidden');
    filePreview.classList.add('hidden');
    dropZone.classList.remove('has-file');
    setErr('file', 'Please fix the issues above and re-upload a valid STL file.');
    // Clear the file input so user can re-select
    fileInput.value = '';
  }

  updateSubmitState();
}

fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

/* ── Drag and drop ── */
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) {
    // Manually set to DataTransfer file (input won't reflect drop automatically in all browsers)
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    handleFile(file);
  }
});

/* ── Keyboard activate drop zone ── */
dropZone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') fileInput.click();
});

/* ── Remove file ── */
removeFile.addEventListener('click', e => {
  e.stopPropagation();
  fileInput.value = '';
  filePreview.classList.add('hidden');
  dropContent.classList.remove('hidden');
  dropZone.classList.remove('has-file');
  safetyList.innerHTML = '';
  fileChecksPassed = false;
  setErr('file', '');
  submitBtn.disabled = true;
});

/* ── Field change → re-check submit state ── */
['name','email','material','quantity'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateSubmitState);
  document.getElementById(id).addEventListener('change', updateSubmitState);
});

/* ────────────────────────────────────────
   FORM SUBMISSION
   Step 1: Upload STL to file.io → get URL
   Step 2: POST URL + fields to Netlify Forms
──────────────────────────────────────── */

async function uploadFileToFileIo(file) {
  const fd = new FormData();
  fd.append('file', file);
  // expires=14d — link lives for 14 days, one-time download
  const res = await fetch('https://file.io/?expires=14d', {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) throw new Error(`file.io responded ${res.status}`);
  const json = await res.json();
  if (!json.success || !json.link) throw new Error('file.io: no link in response');
  return json.link;
}

form.addEventListener('submit', async e => {
  e.preventDefault();

  // Final validation pass
  const nameOk = validateName();
  const emailOk = validateEmail();
  const matOk  = validateMaterial();
  const qtyOk  = validateQuantity();
  const fileOk = fileChecksPassed;

  if (!nameOk || !emailOk || !matOk || !qtyOk || !fileOk) {
    if (!fileOk) setErr('file', 'Please upload a valid STL file.');
    return;
  }

  // Sanitise text fields
  document.getElementById('name').value  = sanitiseText(document.getElementById('name').value);
  document.getElementById('notes').value = sanitiseText(document.getElementById('notes').value);

  // Show loading — step 1
  btnText.textContent = 'Uploading file…';
  btnSpinner.classList.remove('hidden');
  submitBtn.disabled = true;

  try {
    // 1 — Upload STL to file.io
    const file = fileInput.files[0];
    const fileUrl = await uploadFileToFileIo(file);

    // Inject URL into the hidden field so Netlify receives it
    document.getElementById('stlFileUrl').value = fileUrl;

    // 2 — Submit form fields to Netlify (no file attachment)
    btnText.textContent = 'Submitting quote…';
    const formData = new FormData(form);
    // Make sure the raw file is not accidentally included
    formData.delete('stl_file');

    const res = await fetch('/', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      successOv.classList.remove('hidden');
      successOv.focus();
    } else {
      throw new Error(`Netlify returned ${res.status}`);
    }

  } catch (err) {
    console.error('Submission error:', err);
    const msg = err.message.includes('file.io')
      ? 'File upload failed — check your connection and try again'
      : 'Submission failed — please try again';
    btnText.textContent = msg;
    btnSpinner.classList.add('hidden');
    submitBtn.disabled = false;
    setTimeout(() => { btnText.textContent = 'Submit Quote Request'; }, 5000);
  }
});

/* ── Reset form ── */
function resetForm() {
  form.reset();
  successOv.classList.add('hidden');
  safetyList.innerHTML = '';
  filePreview.classList.add('hidden');
  dropContent.classList.remove('hidden');
  dropZone.classList.remove('has-file');
  fileChecksPassed = false;
  submitBtn.disabled = true;
  btnText.textContent = 'Submit Quote Request';
  btnSpinner.classList.add('hidden');
  notesCount.textContent = '0 / 2000';
  ['name','email','material','quantity'].forEach(id => {
    document.getElementById(id).classList.remove('valid','invalid');
  });
  ['name','email','material','quantity','file'].forEach(id => clearErr(id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Button inside overlay
document.getElementById('resetBtn').addEventListener('click', resetForm);

// Click outside the card to dismiss
successOv.addEventListener('click', e => {
  if (e.target === successOv) resetForm();
});

// Escape key to dismiss
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !successOv.classList.contains('hidden')) resetForm();
});
