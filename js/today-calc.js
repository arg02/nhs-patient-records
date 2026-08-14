/**
 * Today DAQI calculation — guide-normative rules from nhs-data-guide.html.
 * WHO annual maths stay separate; this module is short-term / Today only.
 *
 * Trigger activation (PM₂.₅, PM₁₀, O₃): two consecutive hours, not falling —
 * previous hour ≥ index-point trigger, current hour ≥ previous.
 * NO₂: latest hour only (no trigger table).
 */

import {
  daqiLevel,
  roundDaqiConcentration,
  DAQI_THRESHOLDS,
  POLLUTANTS,
} from './air-quality.js';

/** ERG proprietary per-index triggers (µg/m³). Bold DEFRA 2013 band anchors in the guide. */
export const ERG_TRIGGERS = {
  pm25: { 1: 8, 2: 17, 3: 33, 4: 50, 5: 56, 6: 61, 7: 74, 8: 84, 9: 95, 10: 101 },
  pm10: { 1: 12, 2: 22, 3: 44, 4: 68, 5: 79, 6: 95, 7: 107, 8: 118, 9: 130, 10: 177 },
  o3: { 1: 14, 2: 34, 3: 68, 4: 105, 5: 126, 6: 146, 7: 170, 8: 198, 9: 224 },
};

const TRIGGER_SPECIES = ['pm25', 'pm10', 'o3'];

export function emptyTriggerState() {
  return {
    pm25: { index: null, sinceHour: null, sinceGmt: null },
    pm10: { index: null, sinceHour: null, sinceGmt: null },
    o3: { index: null, sinceHour: null, sinceGmt: null, quietHours: 0 },
  };
}

/** GMT hour from sample timestamp (API is GMT); falls back to UK-local index only if missing. */
function gmtHourOf(hourSample, ukHour) {
  if (hourSample?.gmtTimestamp) {
    const d = new Date(hourSample.gmtTimestamp);
    if (!Number.isNaN(d.getTime())) return d.getUTCHours();
  }
  return ukHour;
}

function triggerWhen(hourSample, ukHour, extra = {}) {
  return {
    sinceHour: gmtHourOf(hourSample, ukHour),
    sinceGmt: hourSample?.gmtTimestamp || null,
    ...extra,
  };
}

/** Highest index whose trigger threshold ≤ previousHour when current ≥ previous (rising/flat). */
export function triggerIndexFromPair(previousUg, currentUg, species) {
  if (previousUg == null || currentUg == null) return null;
  const prev = roundDaqiConcentration(previousUg);
  const curr = roundDaqiConcentration(currentUg);
  if (curr < prev) return null; // falling — no new fire
  const table = ERG_TRIGGERS[species];
  if (!table) return null;
  let best = null;
  for (let idx = 10; idx >= 1; idx--) {
    const thr = table[idx];
    if (thr == null) continue;
    if (prev >= thr && curr >= prev) {
      best = idx;
      break;
    }
  }
  return best;
}

export function ukLocalParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** Mean of hours 0..endHourInclusive (UK local hour indexes), require ≥75% capture. */
export function partialDayMean(hourlyUg, endHourInclusive) {
  if (!hourlyUg?.length) return null;
  const need = endHourInclusive + 1;
  const slice = hourlyUg.slice(0, need).filter((v) => v != null && !Number.isNaN(v));
  const required = Math.ceil(need * 0.75);
  if (slice.length < required) return { mean: null, capture: slice.length, need: required, ok: false };
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  return { mean, capture: slice.length, need: required, ok: true };
}

export function rolling8hMean(hourlyUg, endIndex) {
  if (endIndex == null || endIndex < 0) return null;
  const start = Math.max(0, endIndex - 7);
  const slice = hourlyUg.slice(start, endIndex + 1).filter((v) => v != null && !Number.isNaN(v));
  if (slice.length < 6) return null; // need most of the window
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/**
 * Advance Today state by one completed UK-local hour.
 * @param {object} state — mutable day state (triggers, previousHour, hours[])
 * @param {object} hourSample — { hour, pm25, pm10, no2, o3 } concentrations µg/m³
 */
export function applyHour(state, hourSample) {
  const hour = hourSample.hour;
  const steps = [];
  const prev = state.previousHour || {};
  const triggers = state.triggers || emptyTriggerState();

  // Midnight clear
  if (hour === 0 && state.ukDateKey && state.ukDateKey !== hourSample.ukDateKey) {
    steps.push({ kind: 'midnight-clear', text: 'UK midnight — cleared PM/O₃ triggers for the new day.' });
    Object.assign(triggers, emptyTriggerState());
  }
  if (hourSample.ukDateKey) state.ukDateKey = hourSample.ukDateKey;

  // Store hour series
  if (!state.hours) state.hours = [];
  state.hours[hour] = {
    pm25: hourSample.pm25,
    pm10: hourSample.pm10,
    no2: hourSample.no2,
    o3: hourSample.o3,
  };

  // NO₂ — latest hour only
  const no2Index = daqiLevel(hourSample.no2, 'no2');
  steps.push({
    kind: 'no2',
    text: `NO₂ latest hour ${String(hour).padStart(2, '0')}:00 = ${fmtUg(hourSample.no2)} → DAQI ${no2Index}.`,
    index: no2Index,
    ug: hourSample.no2,
  });

  for (const sp of TRIGGER_SPECIES) {
    const curr = hourSample[sp];
    const previous = prev[sp];
    const fired = triggerIndexFromPair(previous, curr, sp);
    const before = triggers[sp]?.index ?? null;

    const prevRounded = previous != null ? roundDaqiConcentration(previous) : null;
    const currRounded = curr != null ? roundDaqiConcentration(curr) : null;
    if (prevRounded != null && currRounded != null && currRounded < prevRounded) {
      steps.push({
        kind: `${sp}-falling`,
        text: `${spLabel(sp)} falling (${fmtUg(previous)} → ${fmtUg(curr)}) — keep active trigger ${before ?? 'none'}.`,
        index: before,
      });
    } else if (fired != null) {
      const next = before == null ? fired : Math.max(before, fired);
      triggers[sp] = { index: next, ...triggerWhen(hourSample, hour) };
      if (sp === 'o3') triggers.o3.quietHours = 0;
      steps.push({
        kind: `${sp}-trigger`,
        text: `${spLabel(sp)} trigger: prev ${fmtUg(previous)} ≥ threshold for index ${fired}, current ${fmtUg(curr)} ≥ prev → active ${next}.`,
        index: next,
        fired,
        previous,
        current: curr,
      });
    } else if (sp === 'o3' && triggers.o3?.index != null) {
      triggers.o3.quietHours = (triggers.o3.quietHours || 0) + 1;
      if (triggers.o3.quietHours >= 4) {
        steps.push({
          kind: 'o3-clear',
          text: `O₃ ~4 quiet hours without a new trigger — cleared active index ${triggers.o3.index}.`,
        });
        triggers.o3 = { index: null, sinceHour: null, sinceGmt: null, quietHours: 0 };
      } else {
        steps.push({
          kind: 'o3-quiet',
          text: `O₃ no new trigger; quiet hour ${triggers.o3.quietHours}/4 (active ${triggers.o3.index}).`,
          index: triggers.o3.index,
        });
      }
    } else {
      steps.push({
        kind: `${sp}-none`,
        text: `${spLabel(sp)} ${fmtUg(curr)} — no new trigger (prev ${fmtUg(previous)}; active ${before ?? 'none'}).`,
        index: before,
      });
    }
  }

  // PM partial-day mean from 19:00 UK (00:00–18:00)
  const pmNotes = {};
  if (hour > 18) {
    for (const sp of ['pm25', 'pm10']) {
      const series = state.hours.map((h) => h?.[sp]);
      const partial = partialDayMean(series, 18);
      pmNotes[sp] = partial;
      if (partial.ok) {
        const idx = daqiLevel(partial.mean, sp);
        const trig = triggers[sp]?.index ?? null;
        if (trig == null || idx > trig) {
          triggers[sp] = { index: idx, ...triggerWhen(hourSample, hour, { fromDayMean: true }) };
          steps.push({
            kind: `${sp}-daymean`,
            text: `${spLabel(sp)} day-so-far mean ${fmtUg(partial.mean)} (${partial.capture}h, ≥75%) → DAQI ${idx} replaces trigger ${trig ?? 'none'}.`,
            index: idx,
          });
        } else {
          steps.push({
            kind: `${sp}-daymean-keep`,
            text: `${spLabel(sp)} day-so-far DAQI ${idx} ≤ active trigger ${trig} — keep trigger.`,
            index: trig,
          });
        }
      } else {
        steps.push({
          kind: `${sp}-daymean-skip`,
          text: `${spLabel(sp)} day-so-far capture ${partial.capture}/${partial.need} — mean not applied yet.`,
        });
      }
    }
  }

  // O₃ rolling 8h can supersede if higher
  const o3Series = state.hours.map((h) => h?.o3);
  const roll = rolling8hMean(o3Series, hour);
  if (roll != null) {
    const rollIdx = daqiLevel(roll, 'o3');
    const trig = triggers.o3?.index ?? null;
    if (trig == null || rollIdx > trig) {
      triggers.o3 = { ...(triggers.o3 || {}), index: rollIdx, ...triggerWhen(hourSample, hour, { fromRolling8h: true }) };
      steps.push({
        kind: 'o3-roll',
        text: `O₃ rolling 8h mean ${fmtUg(roll)} → DAQI ${rollIdx} supersedes trigger ${trig ?? 'none'}.`,
        index: rollIdx,
      });
    } else {
      steps.push({
        kind: 'o3-roll-keep',
        text: `O₃ rolling 8h DAQI ${rollIdx} ≤ active ${trig} — keep trigger.`,
        index: trig,
      });
    }
  }

  state.previousHour = {
    pm25: hourSample.pm25,
    pm10: hourSample.pm10,
    no2: hourSample.no2,
    o3: hourSample.o3,
    hour,
  };
  state.triggers = triggers;
  state.lastHour = hour;
  state.lastSteps = steps;

  const indexes = {
    no2: no2Index,
    pm25: triggers.pm25?.index ?? null,
    pm10: triggers.pm10?.index ?? null,
    o3: triggers.o3?.index ?? null,
  };
  // If no PM/O₃ trigger yet, fall back to latest-hour DAQI (provisional — labelled in UI)
  if (indexes.pm25 == null) indexes.pm25 = daqiLevel(hourSample.pm25, 'pm25');
  if (indexes.pm10 == null) indexes.pm10 = daqiLevel(hourSample.pm10, 'pm10');
  if (indexes.o3 == null) {
    const rollIdx = roll != null ? daqiLevel(roll, 'o3') : null;
    indexes.o3 = rollIdx ?? daqiLevel(hourSample.o3, 'o3');
  }

  const todayLevel = Math.max(
    indexes.no2 || 0,
    indexes.pm25 || 0,
    indexes.pm10 || 0,
    indexes.o3 || 0,
  ) || null;

  state.indexes = indexes;
  state.todayLevel = todayLevel;
  return { state, steps, indexes, todayLevel };
}

/** Replay a full UK-local day of hourly samples from midnight through asOfHour-1. */
export function replayDay(hourlyBySpecies, { asOfHour = 14, ukDateKey, hourMeta = null } = {}) {
  let state = {
    ukDateKey: ukDateKey || ukLocalParts().dateKey,
    previousHour: null,
    triggers: emptyTriggerState(),
    hours: [],
  };
  const timeline = [];
  for (let h = 0; h < asOfHour; h++) {
    const meta = hourMeta?.[h] || null;
    const sample = {
      hour: h,
      ukDateKey: state.ukDateKey,
      gmtTimestamp: meta?.gmtTimestamp || null,
      pm25: hourlyBySpecies.pm25?.[h],
      pm10: hourlyBySpecies.pm10?.[h],
      no2: hourlyBySpecies.no2?.[h],
      o3: hourlyBySpecies.o3?.[h],
    };
    const result = applyHour(state, sample);
    state = result.state;
    timeline.push({ hour: h, ...result });
  }
  return { state, timeline };
}

function spLabel(sp) {
  return POLLUTANTS.find((p) => p.key === sp)?.label || sp;
}

function fmtUg(v) {
  if (v == null || Number.isNaN(v)) return '—';
  return `${roundDaqiConcentration(Number(v))} µg/m³`;
}

export function concentrationForDaqiLevel(level, species = 'pm25') {
  if (level == null) return null;
  const t = DAQI_THRESHOLDS[species];
  if (!t) return null;
  return t[Math.min(Math.max(level, 1), 10) - 1];
}
