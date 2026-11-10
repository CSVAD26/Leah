// One photo per dot. Exact timestamps are read locally, never bundled or uploaded.
/** @typedef {{year: number, hour: number, timestamp: string, time: number, timeOfDay: number}} TimePhoto */
/** @typedef {TimePhoto & {index: number}} TimePoint */

/** Parse the CSV produced by either clean-metadata.py or analyze.py.
 * @param {string} text
 * @returns {{photos: TimePhoto[], skipped: number}}
 */
function parsePhotoCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (character === '"') {
      if (quoted && text[i + 1] === '"') {cell += '"'; i++;}
      else quoted = !quoted;
    } else if (!quoted && (character === ',' || character === '\n' || character === '\r')) {
      row.push(cell); cell = '';
      if (character !== ',') {
        if (row.some(value => value.trim() !== '')) rows.push(row);
        row = [];
        if (character === '\r' && text[i + 1] === '\n') i++;
      }
    } else cell += character;
  }
  if (quoted) throw new Error('The CSV contains an unfinished quoted field.');
  row.push(cell);
  if (row.some(value => value.trim() !== '')) rows.push(row);
  const headers = (rows.shift() || []).map(value => value.trim().toLowerCase());
  const takenAt = headers.indexOf('taken_at');
  const timestampColumn = headers.indexOf('timestamp');
  const dateColumn = headers.indexOf('date');
  const timeColumn = headers.indexOf('time');
  if (takenAt < 0 && timestampColumn < 0 && (dateColumn < 0 || timeColumn < 0)) {
    throw new Error('Choose a photo CSV with taken_at, timestamp, or date and time columns.');
  }
  const photos = [];
  let skipped = 0;
  for (const values of rows) {
    const timestamp = (values[takenAt] || values[timestampColumn]
      || ((values[dateColumn] || '') + ' ' + (values[timeColumn] || ''))).trim();
    const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:Z|[+-]\d{2}:?\d{2})?$/);
    if (!match) {skipped++; continue;}
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const hour = Number(match[4]), minute = Number(match[5]), second = Number(match[6]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (year < YEAR_START || year > YEAR_END || hour > 23 || minute > 59 || second > 59
        || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      skipped++; continue;
    }
    // Keep camera-local hours, including timestamps that contain a UTC offset.
    const milliseconds = Math.floor(Number('0.' + (match[7] || '0')) * 1000);
    photos.push({year, hour, timestamp,
      time: Date.UTC(year, month - 1, day, hour, minute, second, milliseconds),
      timeOfDay: hour + minute / 60 + second / 3600 + milliseconds / 3600000});
  }
  photos.sort((a, b) => a.time - b.time);
  return {photos, skipped};
}

/** @param {number} value */
function timeTickStep(value) {
  const power = 10 ** Math.floor(Math.log10(Math.max(1, value)));
  const fraction = value / power;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
}

/** @param {string} id */
function timeElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error('Missing time navigation element: ' + id);
  return element;
}

function setupTimeNavigation() {
  const canvasNode = timeElement('navigate-canvas');
  const selectorNode = timeElement('year-select');
  const fileNode = timeElement('navigate-file');
  if (!(canvasNode instanceof HTMLCanvasElement) || !(selectorNode instanceof HTMLSelectElement)
      || !(fileNode instanceof HTMLInputElement)) return;
  const canvas = canvasNode, selector = selectorNode, fileInput = fileNode;
  const stage = timeElement('navigate-stage');
  const loadButton = timeElement('navigate-load');
  const clearButton = timeElement('navigate-clear');
  const inButton = timeElement('navigate-in');
  const outButton = timeElement('navigate-out');
  const resetButton = timeElement('navigate-reset');
  const tooltip = timeElement('navigate-tooltip');
  const status = timeElement('navigate-status');
  const detail = timeElement('navigate-detail');
  const legend = timeElement('navigate-years');
  const context = canvas.getContext('2d');
  if (!context) return;
  const ctx = context;

  /** @type {TimePhoto[] | null} */
  let importedPhotos = null;
  /** @type {TimePoint[][]} */
  let groups = Array.from({length: 24}, () => []);
  /** @type {TimePoint | null} */
  let selectedPoint = null;
  /** @type {TimePoint | null} */
  let hoveredPoint = null;
  /** @type {{x: number, y: number} | null} */
  let pointer = null;
  /** @type {Map<number, {x: number, y: number}>} */
  const pointers = new Map();
  let zoom = 1, panX = 0, panY = 0;
  let canvasW = 1, canvasH = 1, plotW = 1, plotH = 1;
  const left = 60, top = 28, right = 18, bottom = 52;
  let yMax = 4, total = 0, skipped = 0;
  let frameId = 0;
  let dragged = false, dragDistance = 0, pinchDistance = 0;
  let pinchX = 0, pinchY = 0;

  /** @param {number} year */
  function yearColor(year) {
    const blend = (year - YEAR_START) / Math.max(1, YEAR_END - YEAR_START);
    return 'rgb(' + Math.round(54 + blend * 198) + ',' + Math.round(91 - blend * 8) + ',' + Math.round(140 - blend * 15) + ')';
  }

  function requestDraw() {
    if (!frameId) frameId = requestAnimationFrame(frame);
  }

  function updateStatus() {
    const source = importedPhotos ? 'Local CSV' : 'Exported photo counts';
    status.textContent = source + ' · ' + total.toLocaleString() + ' photos · '
      + zoom.toFixed(1) + '× zoom' + (skipped ? ' · ' + skipped + ' records skipped' : '');
  }

  function rebuild() {
    groups = Array.from({length: 24}, () => []);
    selectedPoint = null;
    hoveredPoint = null;
    tooltip.hidden = true;
    const selected = selector.value;
    /** @param {TimePhoto} photo */
    function addPhoto(photo) {
      const point = {...photo, index: groups[photo.hour].length};
      groups[photo.hour].push(point);
    }
    if (importedPhotos) {
      for (const photo of importedPhotos) {
        if (selected === 'all' || String(photo.year) === selected) addPhoto(photo);
      }
    } else {
      for (const record of PHOTO_DATA.records) {
        if (selected === 'all' || String(record.year) === selected) {
          for (let i = 0; i < record.count; i++) {
            addPhoto({year: record.year, hour: record.hour, timestamp: '', time: 0, timeOfDay: record.hour + 0.5});
          }
        }
      }
    }
    total = groups.reduce((sum, group) => sum + group.length, 0);
    yMax = timeTickStep(Math.max(1, ...groups.map(group => group.length)) / 4) * 4;
    zoom = 1; panX = 0; panY = 0;
    detail.textContent = importedPhotos
      ? 'Zoom in to read timestamps, or click a dot to inspect its capture time and running photo count within that hour.'
      : 'Load your private photo_times_private.csv for exact time-of-day positions and timestamp labels.';
    clearButton.hidden = importedPhotos === null;
    updateStatus();
    requestDraw();
  }

  function clampView() {
    panX = Math.max(plotW * (1 - zoom), Math.min(0, panX));
    panY = Math.max(0, Math.min(plotH * (zoom - 1), panY));
  }

  /** @param {number} value @param {number} x @param {number} y */
  function zoomAt(value, x, y) {
    const next = Math.max(1, Math.min(256, value));
    const factor = next / zoom;
    panX = x - left - (x - left - panX) * factor;
    panY = y - (canvasH - bottom) - (y - (canvasH - bottom) - panY) * factor;
    zoom = next;
    clampView();
    updateStatus();
    requestDraw();
  }

  /** @param {number} x */
  function screenX(x) {return left + x / 24 * plotW * zoom + panX;}
  /** @param {number} y */
  function screenY(y) {return canvasH - bottom - y / yMax * plotH * zoom + panY;}

  function resize() {
    const bounds = stage.getBoundingClientRect();
    const oldCenterX = ((canvasW / 2 - left - panX) / (plotW * zoom)) * 24;
    const oldCenterY = ((canvasH - bottom + panY - canvasH / 2) / (plotH * zoom)) * yMax;
    canvasW = Math.max(180, bounds.width - 2);
    canvasH = Math.max(250, bounds.height - 2);
    plotW = canvasW - left - right;
    plotH = canvasH - top - bottom;
    const density = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvasW * density);
    canvas.height = Math.round(canvasH * density);
    ctx.setTransform(density, 0, 0, density, 0, 0);
    if (zoom > 1) {
      panX = canvasW / 2 - left - oldCenterX / 24 * plotW * zoom;
      panY = canvasH / 2 - (canvasH - bottom) + oldCenterY / yMax * plotH * zoom;
    }
    clampView();
    requestDraw();
  }

  /** @param {TimePoint} point */
  function pointLabel(point) {
    return point.timestamp || point.year + ' · ' + String(point.hour).padStart(2, '0') + ':00 hour · photo ' + (point.index + 1);
  }

  function paint() {
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = '#f8f7f3'; ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.font = '11px system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    const minimum = Math.max(0, (panY / (plotH * zoom)) * yMax);
    const maximum = Math.min(yMax, ((plotH + panY) / (plotH * zoom)) * yMax);
    const step = timeTickStep((maximum - minimum) / 5);
    ctx.lineWidth = 1; ctx.strokeStyle = '#e0e3df';
    for (let value = Math.ceil(minimum / step) * step; value <= maximum; value += step) {
      const y = screenY(value);
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(canvasW - right, y); ctx.stroke();
      ctx.fillStyle = '#707c82'; ctx.textAlign = 'right';
      ctx.fillText(value.toLocaleString(), left - 9, y + 4);
    }
    let hourLabels = 0;
    for (let hour = 0; hour <= 24; hour++) {
      const boundary = screenX(hour);
      if (boundary >= left && boundary <= canvasW - right) {
        ctx.beginPath(); ctx.moveTo(boundary, top); ctx.lineTo(boundary, canvasH - bottom); ctx.stroke();
      }
      if ((importedPhotos && zoom >= 3) || hour === 24
          || (zoom < 1.5 && canvasW < 720 && hour % 3 !== 0 && hour !== 23)) continue;
      const x = screenX(hour + 0.5);
      if (x < left || x > canvasW - right) continue;
      ctx.fillStyle = '#707c82'; ctx.textAlign = 'center';
      ctx.fillText(String(hour).padStart(2, '0'), x, canvasH - bottom + 21);
      hourLabels++;
    }
    if (importedPhotos && zoom >= 3) {
      const minHour = Math.max(0, -panX / (plotW * zoom) * 24);
      const maxHour = Math.min(24, (plotW - panX) / (plotW * zoom) * 24);
      const steps = [1 / 3600, 5 / 3600, 15 / 3600, 30 / 3600, 1 / 60, 5 / 60, 0.25, 0.5, 1, 2, 3, 6];
      const tick = steps.find(value => value >= (maxHour - minHour) / plotW * 80) || 6;
      for (let value = Math.ceil(minHour / tick) * tick; value <= maxHour + tick / 1000; value += tick) {
        const seconds = Math.round(value * 3600);
        const hour = String(Math.floor(seconds / 3600)).padStart(2, '0');
        const minute = String(Math.floor(seconds / 60) % 60).padStart(2, '0');
        const label = hour + ':' + minute + (tick < 1 / 60 ? ':' + String(seconds % 60).padStart(2, '0') : '');
        const x = screenX(value);
        ctx.fillStyle = '#707c82'; ctx.textAlign = 'center';
        ctx.fillText(label, x, canvasH - bottom + 21);
        hourLabels++;
      }
    }
    if (!hourLabels) {
      const hour = Math.max(0, Math.min(23, Math.floor(((plotW / 2 - panX) / (plotW * zoom)) * 24)));
      ctx.fillStyle = '#707c82'; ctx.textAlign = 'center';
      ctx.fillText(String(hour).padStart(2, '0') + ':00 hour', left + plotW / 2, canvasH - bottom + 21);
    }
    ctx.fillStyle = '#707c82'; ctx.textAlign = 'left'; ctx.fillText('Photo count within each hour', left, 16);
    ctx.textAlign = 'center'; ctx.fillText('Capture hour · camera-local time', left + plotW / 2, canvasH - 10);

    ctx.save(); ctx.beginPath(); ctx.rect(left, top, plotW, plotH); ctx.clip();
    hoveredPoint = null;
    let nearestDistance = 100;
    let selectedX = 0, selectedY = 0, selectedVisible = false;
    /** @type {{point: TimePoint, x: number, y: number}[]} */
    const labels = [];
    for (let hour = 0; hour < 24; hour++) {
      const group = groups[hour];
      if (!group.length || screenX(hour + 1) < left || screenX(hour) > canvasW - right) continue;
      ctx.globalAlpha = Math.min(0.85, 0.35 + zoom * 0.035);
      let lastYear = -1;
      for (const point of group) {
        const x = screenX(point.timeOfDay);
        const y = screenY(point.index + 1);
        if (x < left || x > canvasW - right || y < top || y > canvasH - bottom) continue;
        if (point.year !== lastYear) {ctx.fillStyle = yearColor(point.year); lastYear = point.year;}
        const size = Math.min(3.5, 1.2 + zoom * 0.07);
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
        if (pointer && pointer.x >= left && pointer.x <= canvasW - right
            && pointer.y >= top && pointer.y <= canvasH - bottom) {
          const distance = (pointer.x - x) ** 2 + (pointer.y - y) ** 2;
          if (distance < nearestDistance) {nearestDistance = distance; hoveredPoint = point;}
        }
        if (point === selectedPoint) {selectedX = x; selectedY = y; selectedVisible = true;}
        if (zoom >= 6) labels.push({point, x, y});
      }
    }
    // Only draw text that fits. Closer zoom exposes the remaining timestamps.
    ctx.globalAlpha = 0.9; ctx.fillStyle = '#20272b';
    ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'left';
    const occupied = new Set();
    for (const label of labels) {
      const text = pointLabel(label.point);
      const length = ctx.measureText(text).width;
      const x1 = Math.floor((label.x + 3) / 28), x2 = Math.ceil((label.x + length + 10) / 28);
      const y1 = Math.floor((label.y - 20) / 18), y2 = Math.ceil((label.y - 3) / 18);
      let free = true;
      for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) if (occupied.has(x + ':' + y)) free = false;
      if (!free) continue;
      for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) occupied.add(x + ':' + y);
      ctx.fillText(text, label.x + 6, label.y - 6);
    }
    ctx.globalAlpha = 1;
    if (selectedVisible) {
      ctx.strokeStyle = '#fc537d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(selectedX, selectedY, 6, 0, Math.PI * 2); ctx.stroke();
    }
    if (!total) {
      ctx.fillStyle = '#707c82'; ctx.textAlign = 'center'; ctx.font = '13px system-ui, sans-serif';
      ctx.fillText('No photos in this year', left + plotW / 2, top + plotH / 2);
    }
    ctx.restore(); ctx.globalAlpha = 1;
    if (hoveredPoint && pointer && !pointers.size) {
      tooltip.textContent = pointLabel(hoveredPoint) + '\nPhoto ' + (hoveredPoint.index + 1).toLocaleString()
        + ' of ' + groups[hoveredPoint.hour].length.toLocaleString() + ' in this hour';
      tooltip.hidden = false;
      tooltip.style.left = Math.max(4, Math.min(canvasW - tooltip.offsetWidth - 4, pointer.x + 14)) + 'px';
      tooltip.style.top = Math.max(4, Math.min(canvasH - tooltip.offsetHeight - 4, pointer.y - tooltip.offsetHeight - 12)) + 'px';
    } else tooltip.hidden = true;
  }

  function frame() {
    frameId = 0;
    paint();
  }

  /** @param {PointerEvent | WheelEvent} event */
  function eventPosition(event) {
    const bounds = canvas.getBoundingClientRect();
    return {x: event.clientX - bounds.left, y: event.clientY - bounds.top};
  }

  canvas.addEventListener('wheel', event => {
    const position = eventPosition(event);
    if (position.x < left || position.x > canvasW - right || position.y < top || position.y > canvasH - bottom) return;
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? plotH : 1);
    zoomAt(zoom * Math.exp(-delta * 0.0015), position.x, position.y);
  }, {passive: false});
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    canvas.focus({preventScroll: true});
    pointers.set(event.pointerId, eventPosition(event));
    canvas.setPointerCapture(event.pointerId);
    if (pointers.size === 1) {dragged = false; dragDistance = 0;}
    pinchDistance = 0;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      pinchX = (a.x + b.x) / 2; pinchY = (a.y + b.y) / 2;
      dragged = true;
    }
  });
  canvas.addEventListener('pointermove', event => {
    pointer = eventPosition(event);
    const old = pointers.get(event.pointerId);
    if (old) {
      pointers.set(event.pointerId, pointer);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
        if (pinchDistance > 0) zoomAt(zoom * distance / pinchDistance, pinchX, pinchY);
        panX += x - pinchX; panY += y - pinchY;
        pinchDistance = distance; pinchX = x; pinchY = y; dragged = true;
      } else {
        const dx = pointer.x - old.x, dy = pointer.y - old.y;
        panX += dx; panY += dy;
        dragDistance += Math.hypot(dx, dy);
        if (dragDistance > 4) dragged = true;
      }
      clampView();
    }
    requestDraw();
  });
  canvas.addEventListener('pointerup', event => {
    pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!dragged && !pointers.size) {
      pointer = eventPosition(event); paint(); selectedPoint = hoveredPoint;
      if (selectedPoint) {
        detail.textContent = pointLabel(selectedPoint) + ' · Photo ' + (selectedPoint.index + 1).toLocaleString()
          + ' of ' + groups[selectedPoint.hour].length.toLocaleString() + ' within this hour. '
          + (importedPhotos ? 'Position uses the recorded capture time and chronological count.' : 'Exact capture time is unavailable until a timestamp CSV is loaded.');
      }
      else detail.textContent = importedPhotos
        ? 'Zoom to 6× or closer to read timestamps, or click a dot to inspect it.'
        : 'Load your private photo_times_private.csv to reveal exact timestamps. The file stays in this browser tab.';
    }
    pinchDistance = 0; requestDraw();
  });
  canvas.addEventListener('pointercancel', event => {pointers.delete(event.pointerId); pinchDistance = 0; pointer = null; requestDraw();});
  canvas.addEventListener('pointerleave', () => {if (!pointers.size) pointer = null; requestDraw();});
  canvas.addEventListener('keydown', event => {
    if (event.key === '+' || event.key === '=') zoomAt(zoom * 1.6, left + plotW / 2, top + plotH / 2);
    else if (event.key === '-') zoomAt(zoom / 1.6, left + plotW / 2, top + plotH / 2);
    else if (event.key === '0') {zoom = 1; panX = 0; panY = 0; updateStatus();}
    else if (event.key === 'ArrowLeft') panX += 60;
    else if (event.key === 'ArrowRight') panX -= 60;
    else if (event.key === 'ArrowUp') panY += 60;
    else if (event.key === 'ArrowDown') panY -= 60;
    else return;
    event.preventDefault(); clampView(); requestDraw();
  });
  inButton.addEventListener('click', () => zoomAt(zoom * 1.6, left + plotW / 2, top + plotH / 2));
  outButton.addEventListener('click', () => zoomAt(zoom / 1.6, left + plotW / 2, top + plotH / 2));
  resetButton.addEventListener('click', () => {zoom = 1; panX = 0; panY = 0; updateStatus(); requestDraw();});
  selector.addEventListener('change', rebuild);
  loadButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    loadButton.setAttribute('disabled', '');
    try {
      const result = parsePhotoCSV(await file.text());
      if (!result.photos.length) throw new Error('No valid photo timestamps from 2019–2026 were found.');
      importedPhotos = result.photos; skipped = result.skipped; rebuild();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'The CSV could not be read.';
    } finally {loadButton.removeAttribute('disabled'); fileInput.value = '';}
  });
  clearButton.addEventListener('click', () => {importedPhotos = null; skipped = 0; rebuild();});
  window.addEventListener('resize', resize);
  for (const year of Object.keys(PHOTO_DATA.daysByYear)) {
    const item = document.createElement('span');
    const dot = document.createElement('i'); dot.style.background = yearColor(Number(year));
    item.append(dot, document.createTextNode(year)); legend.appendChild(item);
  }
  resize(); rebuild();
}

setupTimeNavigation();
