(() => {
  'use strict';

  const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  // Proyecto de Supabase "horario-escolar". La clave publishable es segura de exponer
  // en el cliente: el acceso real a los datos lo controla Row Level Security en la tabla.
  const SUPABASE_URL = 'https://bcfletonntxwtuneamjv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_xHoB-ITvLD5AzJOzqj5rSQ_pwYTeuU1';
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const $ = (sel) => document.querySelector(sel);

  const dayTabsEl = $('#day-tabs');
  const listEl = $('#departures-list');
  const emptyStateEl = $('#empty-state');
  const nowClassEl = $('#now-class');
  const nowSubEl = $('#now-sub');
  const nextClassEl = $('#next-class');
  const nextSubEl = $('#next-sub');
  const liveTimeEl = $('#live-time');
  const liveDateEl = $('#live-date');
  const notifBtn = $('#notif-toggle');
  const notifStatus = $('#notif-status');
  const addForm = $('#add-form');
  const daySelect = $('#f-day');
  const csvInput = $('#csv-input');
  const fileDrop = $('#file-drop');
  const fileDropText = $('#file-drop-text');
  const csvFeedback = $('#csv-feedback');
  const downloadTemplateBtn = $('#download-template');
  const clearAllBtn = $('#clear-all');
  const photoInput = $('#photo-input');
  const photoDrop = $('#photo-drop');
  const photoDropText = $('#photo-drop-text');
  const photoStatus = $('#photo-status');
  const reviewPanel = $('#review-panel');
  const reviewList = $('#review-list');
  const reviewAddBtn = $('#review-add');
  const reviewCancelBtn = $('#review-cancel');
  const authScreen = $('#auth-screen');
  const authForm = $('#auth-form');
  const authEmailInput = $('#auth-email');
  const authStatus = $('#auth-status');
  const authSubtitle = $('#auth-subtitle');
  const authCodeForm = $('#auth-code-form');
  const authCodeInput = $('#auth-code');
  const authBackBtn = $('#auth-back');
  const boardEl = $('#board');
  const accountEmailEl = $('#account-email');
  const logoutBtn = $('#logout-btn');

  let schedule = [];
  let selectedDay = DAYS[todayIndex()];
  let notificationsOn = false;
  let scheduledTimers = [];
  let swRegistration = null;
  let draftEntries = [];
  let currentUser = null;

  // ---------- base de datos (Supabase) ----------

  function rowToEntry(row) {
    return {
      id: row.id,
      subject: row.subject,
      day: row.day,
      start: row.start_time.slice(0, 5),
      end: row.end_time.slice(0, 5),
      room: row.room || '',
    };
  }

  async function fetchSchedule() {
    const { data, error } = await sb.from('classes').select('*').order('start_time');
    if (error) {
      console.error(error);
      return [];
    }
    return data.map(rowToEntry);
  }

  // Guarda una o varias clases nuevas en Supabase y devuelve las filas insertadas
  // ya convertidas al formato que usa la app.
  async function insertEntriesDB(entries) {
    const rows = entries.map((e) => ({
      user_id: currentUser.id,
      subject: e.subject,
      day: e.day,
      start_time: e.start,
      end_time: e.end,
      room: e.room || null,
    }));
    const { data, error } = await sb.from('classes').insert(rows).select();
    if (error) {
      alert('No se pudo guardar en la base de datos: ' + error.message);
      return [];
    }
    return data.map(rowToEntry);
  }

  async function deleteEntryDB(id) {
    const { error } = await sb.from('classes').delete().eq('id', id);
    if (error) alert('No se pudo borrar: ' + error.message);
    return !error;
  }

  async function deleteAllEntriesDB() {
    const { error } = await sb.from('classes').delete().eq('user_id', currentUser.id);
    if (error) alert('No se pudo borrar: ' + error.message);
    return !error;
  }

  // ---------- helpers ----------

  function todayIndex() {
    const jsDay = new Date().getDay(); // 0 = domingo
    return jsDay === 0 ? 6 : jsDay - 1; // reindex to 0 = lunes
  }

  function minutesNow() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  function formatTime12(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const period = h < 12 ? 'am' : 'pm';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  }

  function stripAccents(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function normalizeDay(input) {
    const target = stripAccents(input.trim().toLowerCase());
    return DAYS.find((d) => stripAccents(d.toLowerCase()) === target) || null;
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  // ---------- rendering: day tabs ----------

  function renderDayTabs() {
    dayTabsEl.innerHTML = '';
    DAYS.forEach((day) => {
      const btn = document.createElement('button');
      btn.className = 'day-tab';
      btn.type = 'button';
      btn.textContent = day.slice(0, 3);
      btn.title = day;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(day === selectedDay));
      btn.addEventListener('click', () => {
        selectedDay = day;
        renderDayTabs();
        renderList();
      });
      dayTabsEl.appendChild(btn);
    });
  }

  // ---------- rendering: departures list ----------

  function renderList() {
    const entries = schedule
      .filter((e) => e.day === selectedDay)
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

    listEl.innerHTML = '';
    emptyStateEl.hidden = entries.length > 0;

    const isToday = selectedDay === DAYS[todayIndex()];
    const now = minutesNow();

    entries.forEach((entry) => {
      const li = document.createElement('li');
      li.className = 'departure-row';
      if (isToday) {
        const start = toMinutes(entry.start);
        const end = toMinutes(entry.end);
        if (now >= start && now < end) li.classList.add('is-now');
        else if (now >= end) li.classList.add('is-past');
      }

      const time = document.createElement('span');
      time.className = 'd-time';
      time.textContent = formatTime12(entry.start);

      const subject = document.createElement('span');
      subject.className = 'd-subject';
      subject.textContent = entry.subject;

      const room = document.createElement('span');
      room.className = 'd-room';
      room.textContent = entry.room || '—';

      const del = document.createElement('button');
      del.className = 'd-delete';
      del.type = 'button';
      del.setAttribute('aria-label', `Eliminar ${entry.subject}`);
      del.textContent = '✕';
      del.addEventListener('click', async () => {
        del.disabled = true;
        const ok = await deleteEntryDB(entry.id);
        if (ok) {
          schedule = schedule.filter((e) => e.id !== entry.id);
          renderList();
          updateNowNext();
          if (notificationsOn) scheduleTodayNotifications();
        } else {
          del.disabled = false;
        }
      });

      li.append(time, subject, room, del);
      listEl.appendChild(li);
    });
  }

  // ---------- now / next panel ----------

  function updateNowNext() {
    const todayName = DAYS[todayIndex()];
    const now = minutesNow();
    const todays = schedule
      .filter((e) => e.day === todayName)
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

    const current = todays.find((e) => now >= toMinutes(e.start) && now < toMinutes(e.end));
    const upcoming = todays.find((e) => toMinutes(e.start) > now);

    if (current) {
      nowClassEl.textContent = current.subject;
      nowSubEl.textContent = `${formatTime12(current.start)} – ${formatTime12(current.end)}${current.room ? ' · ' + current.room : ''}`;
    } else {
      nowClassEl.textContent = 'Sin clases en curso';
      nowSubEl.textContent = '\u00A0';
    }

    if (upcoming) {
      nextClassEl.textContent = upcoming.subject;
      nextSubEl.textContent = `${formatTime12(upcoming.start)}${upcoming.room ? ' · ' + upcoming.room : ''}`;
    } else {
      const nextDayInfo = findNextClassAfterToday();
      if (nextDayInfo) {
        nextClassEl.textContent = nextDayInfo.entry.subject;
        nextSubEl.textContent = `${nextDayInfo.dayLabel} · ${formatTime12(nextDayInfo.entry.start)}`;
      } else {
        nextClassEl.textContent = '—';
        nextSubEl.textContent = '\u00A0';
      }
    }
  }

  function findNextClassAfterToday() {
    const start = todayIndex();
    for (let offset = 1; offset <= 7; offset++) {
      const dayName = DAYS[(start + offset) % 7];
      const entries = schedule
        .filter((e) => e.day === dayName)
        .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
      if (entries.length) {
        const label = offset === 1 ? 'Mañana' : dayName;
        return { entry: entries[0], dayLabel: label };
      }
    }
    return null;
  }

  // ---------- live clock ----------

  function tickClock() {
    const d = new Date();
    liveTimeEl.textContent = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    liveDateEl.textContent = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  // ---------- add form ----------

  function populateDaySelect() {
    daySelect.innerHTML = '';
    DAYS.forEach((day) => {
      const opt = document.createElement('option');
      opt.value = day;
      opt.textContent = day;
      daySelect.appendChild(opt);
    });
    daySelect.value = selectedDay;
  }

  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subject = $('#f-subject').value.trim();
    const day = daySelect.value;
    const start = $('#f-start').value;
    const end = $('#f-end').value;
    const room = $('#f-room').value.trim();

    if (!subject || !start || !end) return;
    if (toMinutes(end) <= toMinutes(start)) {
      alert('La hora de salida debe ser después de la hora de entrada.');
      return;
    }

    const submitBtn = addForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const inserted = await insertEntriesDB([{ subject, day, start, end, room }]);
    submitBtn.disabled = false;
    if (!inserted.length) return;

    schedule.push(...inserted);
    selectedDay = day;
    renderDayTabs();
    renderList();
    updateNowNext();
    if (notificationsOn) scheduleTodayNotifications();
    addForm.reset();
    daySelect.value = day;
  });

  // ---------- CSV import ----------

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed = [];
    let skipped = 0;

    lines.forEach((line, idx) => {
      const cols = line.split(',').map((c) => c.trim());
      if (idx === 0 && stripAccents(cols[0].toLowerCase()) === 'materia') return; // encabezado

      const [subject, dayRaw, start, end, room] = cols;
      const day = dayRaw ? normalizeDay(dayRaw) : null;
      const validTime = (t) => /^\d{1,2}:\d{2}$/.test(t || '');

      if (!subject || !day || !validTime(start) || !validTime(end)) {
        skipped++;
        return;
      }

      parsed.push({
        subject,
        day,
        start: start.padStart(5, '0'),
        end: end.padStart(5, '0'),
        room: room || '',
      });
    });

    return { parsed, skipped };
  }

  function handleCSVFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const { parsed, skipped } = parseCSV(String(reader.result));
      const inserted = parsed.length ? await insertEntriesDB(parsed) : [];

      if (inserted.length) {
        schedule.push(...inserted);
        renderDayTabs();
        renderList();
        updateNowNext();
        if (notificationsOn) scheduleTodayNotifications();
      }

      csvFeedback.classList.toggle('is-error', inserted.length === 0);
      csvFeedback.textContent = inserted.length
        ? `Se agregaron ${inserted.length} clase${inserted.length === 1 ? '' : 's'}${skipped ? `, ${skipped} línea${skipped === 1 ? '' : 's'} no se pudo leer` : ''}.`
        : 'No se pudo leer ninguna fila. Revisa el formato del CSV.';
    };
    reader.onerror = () => {
      csvFeedback.classList.add('is-error');
      csvFeedback.textContent = 'No se pudo leer el archivo.';
    };
    reader.readAsText(file, 'UTF-8');
  }

  csvInput.addEventListener('change', () => handleCSVFile(csvInput.files[0]));

  fileDrop.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDrop.classList.add('drag-over');
  });
  fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('drag-over'));
  fileDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDrop.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleCSVFile(file);
  });

  downloadTemplateBtn.addEventListener('click', () => {
    const template = 'Materia,Dia,HoraInicio,HoraFin,Salon\nArtes,Lunes,13:00,14:00,A-101\nHistoria,Lunes,14:00,15:00,B-204\n';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-horario.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  clearAllBtn.addEventListener('click', async () => {
    if (!schedule.length) return;
    if (!confirm('¿Borrar todas las clases guardadas? Esta acción no se puede deshacer.')) return;
    clearAllBtn.disabled = true;
    const ok = await deleteAllEntriesDB();
    clearAllBtn.disabled = false;
    if (!ok) return;
    schedule = [];
    renderList();
    updateNowNext();
    clearTimers();
    csvFeedback.classList.remove('is-error');
    csvFeedback.textContent = 'Tu horario quedó vacío.';
  });

  // ---------- notifications ----------

  function clearTimers() {
    scheduledTimers.forEach((t) => clearTimeout(t));
    scheduledTimers = [];
  }

  function showClassNotification(entry) {
    const title = 'Empieza tu clase';
    const body = `${entry.subject}${entry.room ? ' · ' + entry.room : ''} · ${formatTime12(entry.start)}`;
    // Preferimos el service worker (funciona mejor en Android/PC como app instalada);
    // si no está listo, caemos a una notificación normal de página.
    if (swRegistration) {
      swRegistration.active?.postMessage({ type: 'SHOW_CLASS_NOTIFICATION', title, body });
    } else if ('Notification' in window) {
      new Notification(title, { body });
    }
  }

  function scheduleTodayNotifications() {
    clearTimers();
    if (!notificationsOn || !('Notification' in window) || Notification.permission !== 'granted') return;

    const todayName = DAYS[todayIndex()];
    const now = minutesNow();

    schedule
      .filter((e) => e.day === todayName && toMinutes(e.start) > now)
      .forEach((entry) => {
        const msUntil = (toMinutes(entry.start) - now) * 60 * 1000 - (new Date().getSeconds() * 1000);
        const timer = setTimeout(() => showClassNotification(entry), Math.max(msUntil, 0));
        scheduledTimers.push(timer);
      });
  }

  // ---------- PWA / service worker ----------

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('service-worker.js')
      .then((reg) => { swRegistration = reg; })
      .catch(() => { swRegistration = null; });
  }

  // ---------- avisos reales de servidor (Web Push) ----------

  // Clave pública VAPID de este proyecto (la privada solo vive en la Edge Function).
  const VAPID_PUBLIC_KEY = 'BICiTq1hAXGWor1Rl2WMVqajsB6eCkasCf_FW1f2FsjulvjSBEEHC02JHHs6hnMbQsQ5wf-qw61HSH7P-kkLICU';

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }

  async function subscribeToPush() {
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) return false;
    try {
      const reg = swRegistration || (await navigator.serviceWorker.ready);
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const json = sub.toJSON();
      const { error } = await sb.from('push_subscriptions').upsert(
        {
          user_id: currentUser.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        { onConflict: 'endpoint' },
      );
      return !error;
    } catch (err) {
      console.error('push subscribe error', err);
      return false;
    }
  }

  async function unsubscribeFromPush() {
    try {
      const reg = swRegistration || (await navigator.serviceWorker?.ready);
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
    } catch (err) {
      console.error('push unsubscribe error', err);
    }
  }

  // ---------- importar horario desde una foto ----------

  function normalizeText(str) {
    return stripAccents(str.toLowerCase()).replace(/[^a-z0-9]/g, '');
  }

  function findDayInText(text) {
    const norm = normalizeText(text);
    return DAYS.find((d) => norm.includes(normalizeText(d))) || null;
  }

  // Extrae uno o dos horarios (HH:MM) de un fragmento de texto.
  function extractTimeRange(text) {
    const re = /(\d{1,2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?/gi;
    const matches = [...text.matchAll(re)].filter((m) => Number(m[1]) <= 23);
    if (!matches.length) return null;

    const toHHMM = (m) => {
      let h = Number(m[1]);
      const min = m[2] ? Number(m[2]) : 0;
      const period = m[3] ? (m[3].toLowerCase().startsWith('p') ? 'pm' : 'am') : null;
      if (period === 'pm' && h < 12) h += 12;
      if (period === 'am' && h === 12) h = 0;
      if (h > 23) return null;
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    };

    const start = toHHMM(matches[0]);
    if (!start) return null;
    if (matches.length >= 2) {
      const end = toHHMM(matches[1]);
      if (end && toMinutes(end) > toMinutes(start)) return { start, end };
    }
    // Solo se detectó una hora: asumimos una clase de 1 hora, editable en la revisión.
    const startMin = toMinutes(start);
    const endMin = Math.min(startMin + 60, 23 * 60 + 59);
    const end = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    return { start, end };
  }

  // Modo lista: una clase por línea, ej. "Lunes 13:00-14:00 Historia B-204"
  function parseAsList(lines) {
    const results = [];
    lines.forEach((line) => {
      const day = findDayInText(line);
      const range = extractTimeRange(line);
      if (!day || !range) return;
      let subject = line
        .replace(new RegExp(day, 'gi'), '')
        .replace(/\d{1,2}(?::\d{2})?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?/gi, '')
        .replace(/[-–—:.,]/g, ' ')
        .trim();
      if (!subject) subject = 'Clase';
      results.push({ subject, day, start: range.start, end: range.end, room: '' });
    });
    return results;
  }

  // Modo tabla: encabezados de día como columnas, horas como filas (horario tipo cuadrícula).
  function parseAsGrid(words) {
    const dayWords = words
      .map((w) => ({ ...w, day: findDayInText(w.text) }))
      .filter((w) => w.day);

    if (dayWords.length < 2) return null;

    // Una sola posición de columna por día (la primera vez que aparece, típicamente el encabezado).
    const columns = [];
    const seenDays = new Set();
    dayWords
      .sort((a, b) => a.bbox.x0 - b.bbox.x0)
      .forEach((w) => {
        if (seenDays.has(w.day)) return;
        seenDays.add(w.day);
        columns.push({ day: w.day, xCenter: (w.bbox.x0 + w.bbox.x1) / 2, headerY: w.bbox.y0 });
      });
    columns.sort((a, b) => a.xCenter - b.xCenter);
    if (columns.length < 2) return null;

    const leftEdge = columns[0].xCenter - (columns[1].xCenter - columns[0].xCenter) / 2;
    const headerY = Math.min(...columns.map((c) => c.headerY));

    // Palabras del cuerpo de la tabla (debajo de los encabezados).
    const bodyWords = words.filter((w) => w.bbox.y0 > headerY + 10);
    if (!bodyWords.length) return null;

    const avgHeight = bodyWords.reduce((s, w) => s + (w.bbox.y1 - w.bbox.y0), 0) / bodyWords.length;
    const rowGap = Math.max(avgHeight * 1.4, 12);

    // Agrupa palabras en filas por posición vertical.
    const sorted = [...bodyWords].sort((a, b) => a.bbox.y0 - b.bbox.y0);
    const rows = [];
    sorted.forEach((w) => {
      const yc = (w.bbox.y0 + w.bbox.y1) / 2;
      let row = rows.find((r) => Math.abs(r.y - yc) < rowGap);
      if (!row) {
        row = { y: yc, words: [] };
        rows.push(row);
      }
      row.words.push(w);
    });

    const results = [];
    rows.forEach((row) => {
      const gutterWords = row.words.filter((w) => w.bbox.x1 < leftEdge);
      const gutterText = gutterWords.sort((a, b) => a.bbox.x0 - b.bbox.x0).map((w) => w.text).join(' ');
      const range = extractTimeRange(gutterText);
      if (!range) return;

      columns.forEach((col, i) => {
        const colLeft = i === 0 ? leftEdge : (columns[i - 1].xCenter + col.xCenter) / 2;
        const colRight = i === columns.length - 1 ? Infinity : (col.xCenter + columns[i + 1].xCenter) / 2;
        const cellWords = row.words
          .filter((w) => w.bbox.x0 >= colLeft && w.bbox.x0 < colRight && !gutterWords.includes(w))
          .sort((a, b) => a.bbox.x0 - b.bbox.x0);
        const subject = cellWords.map((w) => w.text).join(' ').trim();
        if (subject && normalizeText(subject) !== normalizeText(col.day)) {
          results.push({ subject, day: col.day, start: range.start, end: range.end, room: '' });
        }
      });
    });

    return results.length ? results : null;
  }

  async function handlePhotoFile(file) {
    if (!file) return;
    if (typeof Tesseract === 'undefined') {
      photoStatus.classList.add('is-error');
      photoStatus.textContent = 'No se pudo cargar el lector de imágenes. Revisa tu conexión e intenta de nuevo.';
      return;
    }

    photoDropText.textContent = 'Leyendo tu foto…';
    photoStatus.classList.remove('is-error');
    photoStatus.textContent = 'Esto puede tardar unos segundos.';

    try {
      const { data } = await Tesseract.recognize(file, 'spa+eng');
      const words = (data.words || []).filter((w) => w.text && w.text.trim());

      let found = parseAsGrid(words) || [];
      if (!found.length) {
        const lines = (data.lines || []).map((l) => l.text.trim()).filter(Boolean);
        found = parseAsList(lines);
      }

      draftEntries = found.slice(0, 60);
      renderReview();

      photoStatus.classList.toggle('is-error', draftEntries.length === 0);
      photoStatus.textContent = draftEntries.length
        ? `Detectamos ${draftEntries.length} clase${draftEntries.length === 1 ? '' : 's'}. Revísalas abajo antes de guardar.`
        : 'No logramos leer clases en esa foto. Prueba con más luz/enfoque o agrégalas a mano.';
    } catch (err) {
      photoStatus.classList.add('is-error');
      photoStatus.textContent = 'Ocurrió un error leyendo la imagen.';
    } finally {
      photoDropText.textContent = 'Elige o toma otra foto';
    }
  }

  photoInput.addEventListener('change', () => handlePhotoFile(photoInput.files[0]));
  photoDrop.addEventListener('dragover', (e) => { e.preventDefault(); photoDrop.classList.add('drag-over'); });
  photoDrop.addEventListener('dragleave', () => photoDrop.classList.remove('drag-over'));
  photoDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    photoDrop.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handlePhotoFile(file);
  });

  function renderReview() {
    reviewPanel.hidden = draftEntries.length === 0;
    reviewList.innerHTML = '';

    draftEntries.forEach((entry, idx) => {
      const li = document.createElement('li');
      li.className = 'review-row';

      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = true;
      check.dataset.field = 'include';

      const subject = document.createElement('input');
      subject.type = 'text';
      subject.value = entry.subject;
      subject.dataset.field = 'subject';

      const daySel = document.createElement('select');
      DAYS.forEach((d) => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        if (d === entry.day) opt.selected = true;
        daySel.appendChild(opt);
      });
      daySel.dataset.field = 'day';

      const start = document.createElement('input');
      start.type = 'time';
      start.value = entry.start;
      start.dataset.field = 'start';

      const end = document.createElement('input');
      end.type = 'time';
      end.value = entry.end;
      end.dataset.field = 'end';

      const room = document.createElement('input');
      room.type = 'text';
      room.placeholder = 'Salón';
      room.value = entry.room || '';
      room.dataset.field = 'room';

      [check, subject, daySel, start, end, room].forEach((el) => {
        el.addEventListener('input', () => {
          const field = el.dataset.field;
          draftEntries[idx][field] = field === 'include' ? el.checked : el.value;
        });
        el.addEventListener('change', () => {
          const field = el.dataset.field;
          draftEntries[idx][field] = field === 'include' ? el.checked : el.value;
        });
      });

      li.append(check, subject, daySel, start, end, room);
      reviewList.appendChild(li);
    });
  }

  reviewAddBtn.addEventListener('click', async () => {
    const toAdd = draftEntries.filter((e) => e.include !== false && e.subject && e.day && e.start && e.end);
    reviewAddBtn.disabled = true;
    const inserted = toAdd.length ? await insertEntriesDB(toAdd) : [];
    reviewAddBtn.disabled = false;

    if (inserted.length) schedule.push(...inserted);
    draftEntries = [];
    renderReview();
    renderDayTabs();
    renderList();
    updateNowNext();
    if (notificationsOn) scheduleTodayNotifications();
    photoStatus.textContent = inserted.length ? `Se agregaron ${inserted.length} clase(s) a tu horario.` : '';
    photoInput.value = '';
    photoDropText.textContent = 'Elige o toma una foto';
  });

  reviewCancelBtn.addEventListener('click', () => {
    draftEntries = [];
    renderReview();
    photoStatus.textContent = '';
    photoInput.value = '';
    photoDropText.textContent = 'Elige o toma una foto';
  });

  notifBtn.addEventListener('click', async () => {
    notifStatus.classList.remove('is-error');

    if (!('Notification' in window)) {
      notifStatus.classList.add('is-error');
      notifStatus.textContent = /iphone|ipad|ipod/i.test(navigator.userAgent)
        ? 'Tu iPhone no soporta avisos en Safari normal: primero agrega la app a tu pantalla de inicio (compartir → "Agregar a pantalla de inicio") y ábrela desde ahí.'
        : 'Este navegador no admite notificaciones.';
      return;
    }

    if (notificationsOn) {
      notificationsOn = false;
      notifBtn.dataset.on = 'false';
      notifBtn.textContent = 'Activar avisos';
      notifStatus.textContent = '';
      clearTimers();
      await unsubscribeFromPush();
      return;
    }

    if (Notification.permission === 'denied') {
      notifStatus.classList.add('is-error');
      notifStatus.textContent = 'Bloqueaste los avisos antes. Entra a la configuración del sitio en tu navegador (el ícono de candado junto a la URL) y permite las notificaciones, luego intenta de nuevo.';
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      notificationsOn = true;
      notifBtn.dataset.on = 'true';
      notifBtn.textContent = 'Avisos activados';
      scheduleTodayNotifications();

      const pushed = await subscribeToPush();
      notifStatus.textContent = pushed
        ? 'Listo. Ahora te avisamos aunque tengas la app cerrada (mientras el celular tenga internet).'
        : 'Listo, pero solo mientras esta pestaña esté abierta — no pudimos activar los avisos en segundo plano en este navegador.';
    } else {
      notifStatus.classList.add('is-error');
      notifStatus.textContent = 'No diste permiso, así que no puedo mandarte avisos.';
    }
  });

  // ---------- acceso (Supabase Auth, enlace mágico por correo) ----------

  function showApp() {
    authScreen.hidden = true;
    boardEl.hidden = false;
  }

  function showAuth() {
    authScreen.hidden = false;
    boardEl.hidden = true;
  }

  // Guardamos qué correo está esperando su código en localStorage: así, si el
  // navegador recarga la pestaña (muy común en celular al ir y venir del correo),
  // la app recuerda que ya se pidió un código en vez de regresar al paso 1.
  const PENDING_EMAIL_KEY = 'horario_pending_otp_email';

  function showEmailStep() {
    authCodeForm.hidden = true;
    authForm.hidden = false;
    authSubtitle.textContent = 'Escribe tu correo y te mandamos un código de 6 dígitos para entrar.';
    authStatus.textContent = '';
  }

  function showCodeStep(email) {
    authForm.hidden = true;
    authCodeForm.hidden = false;
    authEmailInput.value = email;
    authSubtitle.textContent = `Te mandamos un código a ${email}. Escríbelo abajo (revisa spam si no llega en un minuto).`;
    authStatus.textContent = '';
    authCodeInput.value = '';
  }

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authEmailInput.value.trim();
    if (!email) return;

    authStatus.classList.remove('is-error');
    authStatus.textContent = 'Enviando código…';
    const submitBtn = authForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    const { error } = await sb.auth.signInWithOtp({ email });

    submitBtn.disabled = false;
    if (error) {
      authStatus.classList.add('is-error');
      authStatus.textContent = 'No se pudo enviar el código: ' + error.message;
      return;
    }

    localStorage.setItem(PENDING_EMAIL_KEY, email);
    showCodeStep(email);
    authCodeInput.focus();
  });

  authCodeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authEmailInput.value.trim();
    const code = authCodeInput.value.trim();
    if (!email || !code) return;

    authStatus.classList.remove('is-error');
    authStatus.textContent = 'Verificando…';
    const submitBtn = authCodeForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    const { error } = await sb.auth.verifyOtp({ email, token: code, type: 'email' });

    submitBtn.disabled = false;
    if (error) {
      authStatus.classList.add('is-error');
      authStatus.textContent = 'Código incorrecto o vencido: ' + error.message;
      return;
    }
    localStorage.removeItem(PENDING_EMAIL_KEY);
    // onAuthStateChange se encarga de mostrar la app.
  });

  authBackBtn.addEventListener('click', () => {
    localStorage.removeItem(PENDING_EMAIL_KEY);
    showEmailStep();
  });

  logoutBtn.addEventListener('click', async () => {
    localStorage.removeItem(PENDING_EMAIL_KEY);
    clearTimers();
    await sb.auth.signOut();
  });

  async function onLoggedIn(user) {
    localStorage.removeItem(PENDING_EMAIL_KEY);
    currentUser = user;
    accountEmailEl.textContent = user.email;
    showApp();
    chatToggle.hidden = false;
    schedule = await fetchSchedule();
    renderDayTabs();
    renderList();
    updateNowNext();
  }

  function onLoggedOut() {
    currentUser = null;
    schedule = [];
    clearTimers();
    notificationsOn = false;
    notifBtn.dataset.on = 'false';
    notifBtn.textContent = 'Activar avisos';
    chatToggle.hidden = true;
    closeChat();

    const pendingEmail = localStorage.getItem(PENDING_EMAIL_KEY);
    if (pendingEmail) showCodeStep(pendingEmail);
    else showEmailStep();
    showAuth();
  }

  sb.auth.onAuthStateChange((_event, session) => {
    if (session?.user) onLoggedIn(session.user);
    else onLoggedOut();
  });

  // ---------- asistente de IA (chat) ----------

  const chatToggle = $('#chat-toggle');
  const chatPanel = $('#chat-panel');
  const chatClose = $('#chat-close');
  const chatMessages = $('#chat-messages');
  const chatForm = $('#chat-form');
  const chatTextInput = $('#chat-text-input');
  const chatImageInput = $('#chat-image-input');
  const chatImagePreview = $('#chat-image-preview');
  const chatImageThumb = $('#chat-image-thumb');
  const chatImageRemove = $('#chat-image-remove');

  let chatHistory = []; // formato Anthropic messages (sin la clave de API, eso vive en la Edge Function)
  let chatPendingImage = null; // { base64, mediaType, dataUrl }

  function addChatBubble(text, who, { isError = false } = {}) {
    const div = document.createElement('div');
    div.className = `chat-bubble chat-bubble-${who}` + (isError ? ' is-error' : '');
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        resolve({ base64: dataUrl.split(',')[1], dataUrl });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  chatImageInput.addEventListener('change', async () => {
    const file = chatImageInput.files[0];
    if (!file) return;
    const { base64, dataUrl } = await fileToBase64(file);
    chatPendingImage = { base64, mediaType: file.type || 'image/jpeg', dataUrl };
    chatImageThumb.src = dataUrl;
    chatImagePreview.hidden = false;
  });

  chatImageRemove.addEventListener('click', () => {
    chatPendingImage = null;
    chatImageInput.value = '';
    chatImagePreview.hidden = true;
  });

  function openChat() {
    chatPanel.hidden = false;
    chatTextInput.focus();
  }

  function closeChat() {
    chatPanel.hidden = true;
  }

  chatToggle.addEventListener('click', openChat);
  chatClose.addEventListener('click', closeChat);

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatTextInput.value.trim();
    const image = chatPendingImage;
    if (!text && !image) return;

    const bubble = addChatBubble(text || '(foto adjunta)', 'user');
    if (image) {
      const img = document.createElement('img');
      img.src = image.dataUrl;
      bubble.appendChild(img);
    }

    chatTextInput.value = '';
    chatImageInput.value = '';
    chatImagePreview.hidden = true;
    chatPendingImage = null;

    const sendBtn = chatForm.querySelector('.chat-send');
    sendBtn.disabled = true;
    const thinkingBubble = addChatBubble('Pensando…', 'bot');

    try {
      const { data, error } = await sb.functions.invoke('ai-schedule-assistant', {
        body: {
          message: text,
          imageBase64: image?.base64,
          imageMediaType: image?.mediaType,
          history: chatHistory,
        },
      });

      thinkingBubble.remove();
      sendBtn.disabled = false;

      if (error) {
        addChatBubble('No pude conectar con el asistente. Intenta de nuevo en un momento.', 'bot', { isError: true });
        return;
      }
      if (data?.error) {
        addChatBubble(data.error, 'bot', { isError: true });
        return;
      }

      addChatBubble(data.reply || '...', 'bot');

      // Mantenemos el historial corto para la conversación (sin las imágenes, para no repetir payloads pesados).
      chatHistory.push({ role: 'user', content: text || '(foto)' });
      chatHistory.push({ role: 'assistant', content: data.reply || '' });
      chatHistory = chatHistory.slice(-10);

      if (Array.isArray(data.classes) && data.classes.length) {
        draftEntries = data.classes.map((c) => ({
          subject: c.subject,
          day: c.day,
          start: c.start,
          end: c.end,
          room: c.room || '',
        }));
        renderReview();
        const note = document.createElement('div');
        note.className = 'chat-classes-found';
        note.textContent = `Encontré ${draftEntries.length} clase(s) — revísalas en el panel de abajo antes de guardarlas.`;
        chatMessages.appendChild(note);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        closeChat();
        reviewPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      thinkingBubble.remove();
      sendBtn.disabled = false;
      addChatBubble('Algo salió mal. Intenta de nuevo.', 'bot', { isError: true });
    }
  });

  // ---------- init ----------

  function init() {
    populateDaySelect();
    tickClock();
    registerServiceWorker();
    setInterval(() => {
      tickClock();
      if (currentUser) {
        renderList();
        updateNowNext();
      }
    }, 30 * 1000);
  }

  init();
})();
