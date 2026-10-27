'use strict';

const KEY = 'workout-tracker-v1';
const app = document.getElementById('app');

// ---------- helpers ----------
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const num = v => {
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};
const round = n => Math.round(n * 100) / 100;
const today = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
};
const fmtDate = iso => iso.split('-').reverse().join('.');
const fmtShort = iso => iso.split('-').reverse().slice(0, 2).join('.');
const fmtTime = s => s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min` : `${s} s`;
const daysAgo = iso => {
    const days = Math.round((new Date(today()) - new Date(iso)) / 864e5);
    return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};

function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- storage ----------
let db = load();

function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) { /* fall through to sample data */ }
    const data = seed();
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage blocked */ }
    return data;
}

function save() {
    try {
        localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
        toast('Could not save – browser storage is blocked or full');
    }
}

if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

// Workouts from the training log PDF, so history starts with real data.
function seed() {
    const ex = (name, o) => Object.assign({ id: uid(), name, kind: 'weight', repMin: 10, repMax: 12, step: 2.5 }, o);
    const W = (w, r) => ({ w, r });
    const T = t => ({ t });
    const sessions = [];
    const log = (plan, dates, rows) => dates.forEach((date, i) => sessions.push({
        id: uid(), planId: plan.id, date, created: i,
        entries: plan.exercises
            .map((e, j) => ({ exId: e.id, sets: rows[j][i] || [] }))
            .filter(en => en.sets.length),
    }));

    const a = {
        id: uid(), name: 'Workout A', exercises: [
            ex('Belt squat', { step: 5 }),
            ex('Hip thrust', { step: 5 }),
            ex('Hantle skos 30°', { step: 2 }),
            ex('Ściąganie drążka', { step: 5 }),
            ex('Wznosy w bok', { step: 1, repMax: 14 }),
            ex('Deska', { kind: 'time' }),
            ex('Biceps', { step: 2, repMin: 8 }),
        ],
    };
    log(a, ['2026-10-12', '2026-10-21', '2026-10-26'], [
        [[W(60, 12)], [W(65, 12)], [W(70, 10)]],
        [[W(70, 10)], [W(70, 12)], [W(75, 10)]],
        [[W(18, 10)], [W(18, 12)], [W(20, 10)]],
        [[W(50, 12)], [W(55, 10)], [W(55, 12)]],
        [[W(7, 14)], [W(8, 12)], [W(9, 10)]],
        [[T(65)], [T(70)], [T(75)]],
        [[W(12, 8)], [W(12, 10)], [W(12, 12)]],
    ]);

    const b = {
        id: uid(), name: 'Workout B', exercises: [
            ex('RDL', { step: 5 }),
            ex('Przysiad bułgarski', { step: 2 }),
            ex('Hantle pionowo', { step: 2 }),
            ex('Cable row', { step: 5 }),
            ex('Rozpiętki', { step: 5, repMax: 14 }),
            ex('Przelewanie wody', { step: 2, repMin: 30, repMax: 40 }),
            ex('Triceps warkocz', { step: 2.5 }),
        ],
    };
    log(b, ['2026-10-14', '2026-10-19', '2026-10-23'], [
        [[W(65, 10), W(70, 8)], [W(70, 12)], [W(75, 10)]],
        [[W(12, 12)], [W(14, 8)], [W(14, 10)]],
        [[W(14, 12)], [W(16, 10)], [W(16, 12)]],
        [[W(50, 10)], [W(50, 12)], [W(55, 10)]],
        [[W(40, 10)], [W(40, 14)], [W(50, 10)]],
        [[W(8, 30)], [W(8, 40)], []],
        [[W(15, 10)], [W(15, 12)], [W(17.5, 10)]],
    ]);

    return { plans: [a, b], sessions, draft: null, settings: { rest: 90 } };
}

// ---------- queries ----------
const findPlan = id => db.plans.find(p => p.id === id);
function findExercise(id) {
    for (const p of db.plans) {
        const ex = p.exercises.find(e => e.id === id);
        if (ex) return ex;
    }
    return null;
}
const sessionsDesc = () => [...db.sessions].sort((x, y) =>
    y.date.localeCompare(x.date) || (y.created || 0) - (x.created || 0));
const lastSessionOf = planId => sessionsDesc().find(s => s.planId === planId);

// The most recent result for an exercise on or before `date`, ignoring session `skipId`.
function previous(exId, date, skipId) {
    for (const s of sessionsDesc()) {
        if (s.id === skipId || s.date > date) continue;
        const en = s.entries.find(e => e.exId === exId);
        if (en && en.sets.length) return { date: s.date, sets: en.sets };
    }
    return null;
}

// Comparable strength value of a set: estimated 1RM (Epley), reps for bodyweight, seconds for holds.
function score(ex, s) {
    if (ex.kind === 'time') return s.t;
    return s.w > 0 ? s.w * (1 + s.r / 30) : s.r;
}
const best = (ex, sets) => sets.reduce((a, s) => score(ex, s) > score(ex, a) ? s : a);

function fmtSet(ex, s) {
    if (ex.kind === 'time') return fmtTime(s.t);
    return s.w > 0 ? `${s.w} kg × ${s.r}` : `${s.r} reps`;
}

// Double progression: add reps until the top of the range, then add weight and start over.
function suggest(ex, prev) {
    if (!prev) return null;
    const b = best(ex, prev.sets);
    if (ex.kind === 'time') return { t: b.t + 5 };
    if (b.r >= ex.repMax && ex.step > 0) return { w: round(b.w + ex.step), r: ex.repMin };
    return { w: b.w, r: b.r + 1 };
}

// ---------- rest timer ----------
const rest = { end: 0, iv: null };

function restLabel() {
    if (!rest.end) return `Rest ${fmtTime(db.settings.rest)}`;
    const left = Math.max(0, Math.ceil((rest.end - Date.now()) / 1000));
    return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

function toggleRest() {
    clearInterval(rest.iv);
    if (rest.end) {
        rest.end = 0;
    } else {
        rest.end = Date.now() + db.settings.rest * 1000;
        rest.iv = setInterval(() => {
            if (Date.now() >= rest.end) {
                clearInterval(rest.iv);
                rest.end = 0;
                if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
                toast('Rest is over – next set!');
            }
            updateRest();
        }, 250);
    }
    updateRest();
}

function updateRest() {
    const el = document.getElementById('rest');
    if (!el) return;
    el.textContent = restLabel();
    el.classList.toggle('running', !!rest.end);
}

// ---------- views ----------
function viewTrain() {
    const lastDates = db.plans.map(p => (lastSessionOf(p.id) || {}).date || '');
    const next = lastDates.indexOf([...lastDates].sort()[0]);
    const d = db.draft;
    return `
    <header class="top"><h1>Train</h1></header>
    ${d ? `<a class="card resume" href="#/workout">
        <span><strong>Workout in progress</strong><br><span class="muted">${esc((findPlan(d.planId) || {}).name)} · ${fmtDate(d.date)}</span></span>
        <span class="btn primary">Resume</span></a>` : ''}
    ${db.plans.map((p, i) => `
    <div class="card plan">
        <div>
            <h2>${esc(p.name)} ${i === next && db.plans.length > 1 ? '<span class="badge">Up next</span>' : ''}</h2>
            <p class="muted">${p.exercises.filter(e => !e.archived).length} exercises ·
                ${lastDates[i] ? `last ${fmtDate(lastDates[i])} (${daysAgo(lastDates[i])})` : 'not done yet'}</p>
        </div>
        <button class="btn ${i === next ? 'primary' : ''}" data-act="start" data-plan="${p.id}">Start</button>
    </div>`).join('')}
    ${db.plans.length ? '' : '<p class="empty">No workout plans yet. Add one in <a href="#/plans">Plans</a>.</p>'}`;
}

function blankSet(ex) {
    return ex.kind === 'time' ? { t: '' } : { w: '', r: '' };
}

function startWorkout(planId) {
    if (db.draft && !confirm('Discard the workout in progress?')) return;
    db.draft = { id: null, planId, date: today(), sets: {} };
    save();
    location.hash = '#/workout';
}

function editSession(id) {
    const s = db.sessions.find(x => x.id === id);
    if (db.draft && !confirm('Discard the workout in progress?')) return;
    const sets = {};
    s.entries.forEach(en => { sets[en.exId] = en.sets.map(x => Object.assign({}, x)); });
    db.draft = { id: s.id, planId: s.planId, date: s.date, sets };
    save();
    location.hash = '#/workout';
}

function draftExercises() {
    const d = db.draft;
    const p = findPlan(d.planId);
    const list = p ? p.exercises.filter(e => !e.archived || d.sets[e.id]) : [];
    Object.keys(d.sets).forEach(id => {
        const ex = findExercise(id);
        if (ex && !list.includes(ex)) list.push(ex);
    });
    return list;
}

function viewWorkout() {
    const d = db.draft;
    if (!d) return viewTrain();
    const p = findPlan(d.planId) || { name: 'Workout' };
    return `
    <header class="top">
        <h1>${esc(p.name)}</h1>
        <input type="date" class="date" data-bind="date" value="${d.date}" aria-label="Workout date">
    </header>
    ${draftExercises().map(ex => {
        const prev = previous(ex.id, d.date, d.id);
        const sug = suggest(ex, prev);
        const sets = d.sets[ex.id] || (d.sets[ex.id] = [blankSet(ex)]);
        const ph = sug || {};
        return `
        <section class="card exercise">
            <h2>${esc(ex.name)}</h2>
            <p class="muted small">${prev
                ? `Last (${fmtShort(prev.date)}): ${prev.sets.map(s => fmtSet(ex, s)).join(', ')}`
                : 'First time – no previous result'}</p>
            ${sug ? `<button class="hint" data-act="fill" data-ex="${ex.id}">Try <strong>${fmtSet(ex, sug)}</strong> · tap to fill</button>` : ''}
            ${sets.map((s, i) => `
            <div class="set">
                <span class="setno">${i + 1}</span>
                ${ex.kind === 'time'
                    ? `<label class="field"><input inputmode="numeric" data-ex="${ex.id}" data-i="${i}" data-f="t" value="${esc(s.t)}" placeholder="${ph.t || ''}"><span>sec</span></label>`
                    : `<label class="field"><input inputmode="decimal" data-ex="${ex.id}" data-i="${i}" data-f="w" value="${esc(s.w)}" placeholder="${ph.w != null ? ph.w : ''}"><span>kg</span></label>
                       <span class="x">×</span>
                       <label class="field"><input inputmode="numeric" data-ex="${ex.id}" data-i="${i}" data-f="r" value="${esc(s.r)}" placeholder="${ph.r || ''}"><span>reps</span></label>`}
                <button class="icon" data-act="del-set" data-ex="${ex.id}" data-i="${i}" aria-label="Remove set">✕</button>
            </div>`).join('')}
            <button class="btn ghost small" data-act="add-set" data-ex="${ex.id}">+ Add set</button>
        </section>`;
    }).join('')}
    <div class="actions">
        <button class="btn" data-act="discard">${d.id ? 'Cancel' : 'Discard'}</button>
        <button class="btn primary grow" data-act="save-workout">${d.id ? 'Save changes' : 'Finish workout'}</button>
    </div>
    <button id="rest" class="rest ${rest.end ? 'running' : ''}" data-act="rest">${restLabel()}</button>`;
}

function parseSets(ex, sets) {
    return sets.map(s => {
        if (ex.kind === 'time') {
            const t = num(s.t);
            return t > 0 ? { t: Math.round(t) } : null;
        }
        const w = num(s.w);
        const r = num(s.r);
        return r > 0 ? { w: w > 0 ? w : 0, r: Math.round(r) } : null;
    }).filter(Boolean);
}

function saveWorkout() {
    const d = db.draft;
    const entries = draftExercises()
        .map(ex => ({ exId: ex.id, sets: parseSets(ex, d.sets[ex.id] || []) }))
        .filter(en => en.sets.length);
    if (!entries.length) return toast('Log at least one set first');
    if (d.id) {
        const s = db.sessions.find(x => x.id === d.id);
        Object.assign(s, { date: d.date, entries });
    } else {
        db.sessions.push({ id: uid(), planId: d.planId, date: d.date, created: Date.now(), entries });
    }
    db.draft = null;
    save();
    toast(d.id ? 'Workout updated' : 'Workout saved 💪');
    location.hash = '#/history';
}

function viewHistory() {
    const list = sessionsDesc();
    return `
    <header class="top"><h1>History</h1></header>
    ${list.length ? '' : '<p class="empty">No workouts logged yet.</p>'}
    ${list.map(s => `
    <section class="card session">
        <div class="row">
            <div><h2>${fmtDate(s.date)}</h2><p class="muted small">${esc((findPlan(s.planId) || {}).name || 'Workout')} · ${daysAgo(s.date)}</p></div>
            <div class="row gap">
                <button class="btn small" data-act="edit" data-id="${s.id}">Edit</button>
                <button class="btn small danger" data-act="delete" data-id="${s.id}" aria-label="Delete workout">Delete</button>
            </div>
        </div>
        <ul class="entries">${s.entries.map(en => {
            const ex = findExercise(en.exId);
            return ex ? `<li><span>${esc(ex.name)}</span><span>${en.sets.map(x => fmtSet(ex, x)).join(', ')}</span></li>` : '';
        }).join('')}</ul>
    </section>`).join('')}`;
}

const ui = { progPlan: null };

function viewProgress() {
    if (!findPlan(ui.progPlan)) ui.progPlan = db.plans.length ? db.plans[0].id : null;
    const p = findPlan(ui.progPlan);
    const sessions = sessionsDesc().filter(s => s.planId === ui.progPlan).reverse();
    const exs = p ? p.exercises.filter(e => !e.archived || sessions.some(s => s.entries.some(en => en.exId === e.id))) : [];
    return `
    <header class="top"><h1>Progress</h1></header>
    <div class="chips">${db.plans.map(x => `
        <button class="chip ${x.id === ui.progPlan ? 'on' : ''}" data-act="prog-plan" data-plan="${x.id}">${esc(x.name)}</button>`).join('')}
    </div>
    ${sessions.length ? `
    <div class="grid-wrap" id="grid">
        <table class="grid">
            <thead><tr><th>Exercise</th>${sessions.map(s => `<th>${fmtShort(s.date)}</th>`).join('')}</tr></thead>
            <tbody>${exs.map(ex => {
                let prevScore = null;
                return `<tr><th><a href="#/exercise/${ex.id}">${esc(ex.name)}</a></th>${sessions.map(s => {
                    const en = s.entries.find(e => e.exId === ex.id);
                    if (!en) return '<td class="muted">–</td>';
                    const sc = score(ex, best(ex, en.sets));
                    const cls = prevScore == null ? '' : sc > prevScore ? 'up' : sc < prevScore ? 'down' : '';
                    prevScore = sc;
                    return `<td class="${cls}">${en.sets.map(x => fmtSet(ex, x)).join('<br>')}</td>`;
                }).join('')}</tr>`;
            }).join('')}</tbody>
        </table>
    </div>
    <p class="muted small legend"><span class="up">green</span> = stronger than last time (by estimated 1-rep max). Tap an exercise for its chart.</p>`
    : '<p class="empty">No workouts for this plan yet.</p>'}`;
}

function chart(points, unit) {
    const W = 320, H = 170, L = 36, R = 12, T = 14, B = 26;
    const ys = points.map(p => p.y);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    if (hi - lo < 1) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.15;
    lo -= pad; hi += pad;
    const x = i => L + (points.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (points.length - 1));
    const y = v => T + (hi - v) * (H - T - B) / (hi - lo);
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
    const ticks = [hi - pad, (hi + lo) / 2, lo + pad];
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Progress chart">
        ${ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="gridline"/>
            <text x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${Math.round(t)}</text>`).join('')}
        <path d="${path}" class="line"/>
        ${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.y)}" r="4" class="dot"><title>${fmtDate(p.date)}: ${p.label}</title></circle>`).join('')}
        <text x="${x(0)}" y="${H - 6}" text-anchor="${points.length === 1 ? 'middle' : 'start'}">${fmtShort(points[0].date)}</text>
        ${points.length > 1 ? `<text x="${x(points.length - 1)}" y="${H - 6}" text-anchor="end">${fmtShort(points[points.length - 1].date)}</text>` : ''}
        <text x="4" y="${T - 2}" class="unit">${unit}</text>
    </svg>`;
}

function viewExercise(id) {
    const ex = findExercise(id);
    if (!ex) return '<p class="empty">Exercise not found.</p>';
    const hist = sessionsDesc().reverse()
        .map(s => ({ date: s.date, en: s.entries.find(e => e.exId === id) }))
        .filter(h => h.en);
    const points = hist.map(h => {
        const b = best(ex, h.en.sets);
        return { date: h.date, y: round(score(ex, b)), label: fmtSet(ex, b) };
    });
    const unit = ex.kind === 'time' ? 'seconds' : hist.some(h => h.en.sets.some(s => s.w > 0)) ? 'est. 1RM kg' : 'reps';
    const pr = points.reduce((a, p) => (!a || p.y > a.y ? p : a), null);
    const change = points.length > 1 ? Math.round((points[points.length - 1].y / points[0].y - 1) * 100) : null;
    return `
    <header class="top"><a href="#/progress" class="back" aria-label="Back">‹</a><h1>${esc(ex.name)}</h1></header>
    ${points.length ? `
    <div class="stats">
        <div class="card stat"><span class="muted small">Best set</span><strong>${pr.label}</strong></div>
        <div class="card stat"><span class="muted small">Workouts</span><strong>${points.length}</strong></div>
        <div class="card stat"><span class="muted small">Since first</span><strong>${change == null ? '–' : (change >= 0 ? '+' : '') + change + '%'}</strong></div>
    </div>
    <div class="card">${chart(points, unit)}</div>
    <section class="card"><ul class="entries">${hist.slice().reverse().map(h =>
        `<li><span>${fmtDate(h.date)}</span><span>${h.en.sets.map(s => fmtSet(ex, s)).join(', ')}</span></li>`).join('')}</ul></section>`
    : '<p class="empty">No results logged for this exercise yet.</p>'}`;
}

function viewPlans() {
    return `
    <header class="top"><h1>Plans</h1></header>
    ${db.plans.map(p => `
    <section class="card plan-edit">
        <div class="row gap">
            <input class="title-input" data-plan="${p.id}" data-pf="name" value="${esc(p.name)}" aria-label="Plan name">
            <button class="btn small danger" data-act="del-plan" data-plan="${p.id}">Delete</button>
        </div>
        ${p.exercises.map((ex, i) => ex.archived ? '' : `
        <div class="ex-edit">
            <div class="row gap">
                <input data-exf="name" data-ex="${ex.id}" value="${esc(ex.name)}" aria-label="Exercise name">
                <button class="icon" data-act="move" data-plan="${p.id}" data-i="${i}" data-dir="-1" aria-label="Move up">↑</button>
                <button class="icon" data-act="move" data-plan="${p.id}" data-i="${i}" data-dir="1" aria-label="Move down">↓</button>
                <button class="icon" data-act="del-ex" data-plan="${p.id}" data-ex="${ex.id}" aria-label="Remove exercise">✕</button>
            </div>
            <div class="row gap small muted opts">
                <select data-exf="kind" data-ex="${ex.id}" aria-label="Type">
                    <option value="weight" ${ex.kind === 'weight' ? 'selected' : ''}>Weight</option>
                    <option value="time" ${ex.kind === 'time' ? 'selected' : ''}>Time</option>
                </select>
                ${ex.kind === 'weight' ? `
                <label>Reps <input class="tiny" inputmode="numeric" data-exf="repMin" data-ex="${ex.id}" value="${ex.repMin}">–<input class="tiny" inputmode="numeric" data-exf="repMax" data-ex="${ex.id}" value="${ex.repMax}"></label>
                <label>+<input class="tiny" inputmode="decimal" data-exf="step" data-ex="${ex.id}" value="${ex.step}"> kg</label>` : ''}
            </div>
        </div>`).join('')}
        <button class="btn ghost small" data-act="add-ex" data-plan="${p.id}">+ Add exercise</button>
    </section>`).join('')}
    <button class="btn" data-act="add-plan">+ New plan</button>
    <p class="muted small">Reps range and kg step drive the “Try …” hint: add reps until the top of the range, then add the step and start from the bottom again.</p>

    <h2 class="section">Settings</h2>
    <section class="card">
        <label class="row">Rest timer (seconds) <input class="tiny" inputmode="numeric" data-setting="rest" value="${db.settings.rest}"></label>
    </section>

    <h2 class="section">Your data</h2>
    <section class="card">
        <p class="muted small">Workouts are stored only on this device. Export a backup now and then, or to move to a new phone.</p>
        <div class="row gap wrap">
            <button class="btn" data-act="export">Export backup</button>
            <label class="btn">Import backup<input type="file" accept="application/json,.json" data-act="import" hidden></label>
            <button class="btn danger" data-act="wipe">Delete all data</button>
        </div>
    </section>`;
}

// ---------- routing ----------
const routes = { '': viewTrain, workout: viewWorkout, history: viewHistory, progress: viewProgress, exercise: viewExercise, plans: viewPlans };
const tabOf = { '': '', workout: '', history: 'history', progress: 'progress', exercise: 'progress', plans: 'plans' };
let lastRoute = null;

function render() {
    const [route, arg] = location.hash.replace(/^#\/?/, '').split('/');
    const view = routes[route] || viewTrain;
    const tab = tabOf[route] || '';
    const scroll = route === lastRoute ? window.scrollY : 0;
    app.innerHTML = view(arg) + `
    <nav class="tabs">
        ${[['', 'Train', '🏋️'], ['history', 'History', '📅'], ['progress', 'Progress', '📈'], ['plans', 'Plans', '📝']]
            .map(([r, label, icon]) => `<a href="#/${r}" class="${tab === r ? 'on' : ''}"><span aria-hidden="true">${icon}</span>${label}</a>`).join('')}
    </nav>`;
    window.scrollTo(0, scroll);
    if (route === 'progress' && route !== lastRoute) {
        const grid = document.getElementById('grid');
        if (grid) grid.scrollLeft = grid.scrollWidth;
    }
    lastRoute = route;
}

window.addEventListener('hashchange', render);

// ---------- events ----------
app.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT') return;
    const { act, plan: planId, ex: exId, id } = el.dataset;
    const i = +el.dataset.i;
    const d = db.draft;
    const p = findPlan(planId);

    switch (act) {
        case 'start': return startWorkout(planId);
        case 'rest': return toggleRest();
        case 'fill': {
            const ex = findExercise(exId);
            const sug = suggest(ex, previous(exId, d.date, d.id));
            const sets = d.sets[exId];
            let target = sets.find(s => ex.kind === 'time' ? s.t === '' : s.w === '' && s.r === '');
            if (!target) sets.push(target = blankSet(ex));
            Object.assign(target, sug);
            break;
        }
        case 'add-set': {
            const sets = d.sets[exId];
            sets.push(Object.assign({}, sets[sets.length - 1] || blankSet(findExercise(exId))));
            break;
        }
        case 'del-set':
            d.sets[exId].splice(i, 1);
            if (!d.sets[exId].length) d.sets[exId].push(blankSet(findExercise(exId)));
            break;
        case 'save-workout': return saveWorkout();
        case 'discard':
            if (!d.id && Object.values(d.sets).some(sets => sets.some(x => Object.values(x).some(v => v !== '')))
                && !confirm('Discard this workout?')) return;
            db.draft = null;
            save();
            location.hash = d.id ? '#/history' : '#/';
            return;
        case 'edit': return editSession(id);
        case 'delete':
            if (!confirm('Delete this workout?')) return;
            db.sessions = db.sessions.filter(s => s.id !== id);
            break;
        case 'prog-plan':
            ui.progPlan = planId;
            lastRoute = null;
            break;
        case 'add-plan':
            db.plans.push({ id: uid(), name: `Workout ${String.fromCharCode(65 + db.plans.length)}`, exercises: [] });
            break;
        case 'del-plan':
            if (!confirm(`Delete “${p.name}”? Its logged workouts stay in History.`)) return;
            db.plans = db.plans.filter(x => x !== p);
            break;
        case 'add-ex':
            p.exercises.push({ id: uid(), name: 'New exercise', kind: 'weight', repMin: 10, repMax: 12, step: 2.5 });
            break;
        case 'del-ex': {
            const ex = p.exercises.find(x => x.id === exId);
            if (!confirm(`Remove “${ex.name}” from this plan? Its history is kept.`)) return;
            // Keep the exercise so past workouts still show its name.
            if (db.sessions.some(s => s.entries.some(en => en.exId === exId))) ex.archived = true;
            else p.exercises = p.exercises.filter(x => x !== ex);
            break;
        }
        case 'move': {
            let j = i + +el.dataset.dir;
            while (p.exercises[j] && p.exercises[j].archived) j += +el.dataset.dir;
            if (j < 0 || j >= p.exercises.length) return;
            [p.exercises[i], p.exercises[j]] = [p.exercises[j], p.exercises[i]];
            break;
        }
        case 'export': {
            const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `workout-log-${today()}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            return;
        }
        case 'wipe':
            if (!confirm('Delete all workouts and plans from this device? This cannot be undone.')) return;
            db = { plans: [], sessions: [], draft: null, settings: { rest: 90 } };
            break;
        default: return;
    }
    save();
    render();
});

app.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.f) {
        db.draft.sets[t.dataset.ex][+t.dataset.i][t.dataset.f] = t.value;
        save();
    }
});

app.addEventListener('change', e => {
    const t = e.target;
    const ds = t.dataset;
    if (ds.bind === 'date') {
        if (!t.value) return;
        db.draft.date = t.value;
    } else if (ds.pf) {
        findPlan(ds.plan)[ds.pf] = t.value.trim() || 'Workout';
    } else if (ds.exf) {
        const ex = findExercise(ds.ex);
        if (ds.exf === 'name') ex.name = t.value.trim() || 'Exercise';
        else if (ds.exf === 'kind') ex.kind = t.value;
        else {
            const n = num(t.value);
            if (n == null || n < 0) return render();
            ex[ds.exf] = n;
            if (ex.repMin > ex.repMax) [ex.repMin, ex.repMax] = [ex.repMax, ex.repMin];
        }
    } else if (ds.setting === 'rest') {
        const n = num(t.value);
        if (n > 0) db.settings.rest = Math.round(n);
    } else if (ds.act === 'import') {
        const file = t.files[0];
        if (!file) return;
        file.text().then(text => {
            const data = JSON.parse(text);
            if (!Array.isArray(data.plans) || !Array.isArray(data.sessions)) throw new Error('bad file');
            if (!confirm(`Replace everything on this device with the backup (${data.sessions.length} workouts)?`)) return;
            db = Object.assign({ draft: null, settings: { rest: 90 } }, data);
            save();
            toast('Backup imported');
            render();
        }).catch(() => toast('That file is not a workout backup'));
        return;
    } else {
        return;
    }
    save();
    render();
});

render();
