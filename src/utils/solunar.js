import * as SunCalc from 'suncalc';

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const windowAround = (center, halfWidthMin, label) =>
  center ? {
    label,
    center,
    start: new Date(center.getTime() - halfWidthMin * 60000),
    end: new Date(center.getTime() + halfWidthMin * 60000),
  } : null;

export const getSunTimes = (date, lat, lon) => SunCalc.getTimes(date, lat, lon);

// Major periods (~2hr, moon overhead/underfoot) and minor periods (~1hr, moonrise/moonset)
export const getSolunarPeriods = (date, lat, lon) => {
  const dayStart = startOfDay(date);
  const stepMin = 5;
  const steps = (24 * 60) / stepMin;

  let maxAlt = -Infinity, maxTime = dayStart;
  let minAlt = Infinity, minTime = dayStart;
  for (let i = 0; i <= steps; i++) {
    const t = new Date(dayStart.getTime() + i * stepMin * 60000);
    const altDeg = SunCalc.getMoonPosition(t, lat, lon).altitude * (180 / Math.PI);
    if (altDeg > maxAlt) { maxAlt = altDeg; maxTime = t; }
    if (altDeg < minAlt) { minAlt = altDeg; minTime = t; }
  }

  const majors = [
    windowAround(maxTime, 60, 'Moon Overhead'),
    windowAround(minTime, 60, 'Moon Underfoot'),
  ].sort((a, b) => a.start - b.start);

  const moonTimes = SunCalc.getMoonTimes(dayStart, lat, lon);
  const minors = [
    windowAround(moonTimes.rise, 30, 'Moonrise'),
    windowAround(moonTimes.set, 30, 'Moonset'),
  ].filter(Boolean).sort((a, b) => a.start - b.start);

  return { majors, minors, moonrise: moonTimes.rise || null, moonset: moonTimes.set || null };
};

const periodsOverlapTime = (period, time, bufferMin = 60) => {
  if (!period || !time) return false;
  const t = new Date(time).getTime();
  return t >= period.start.getTime() - bufferMin * 60000 && t <= period.end.getTime() + bufferMin * 60000;
};

// Group an hourly field by local calendar date and average it per day
const getDailyMeans = (hourly, field) => {
  const means = {};
  if (!hourly?.time || !hourly?.[field]) return means;

  const buckets = {};
  hourly.time.forEach((t, i) => {
    const dateStr = t.slice(0, 10);
    const v = hourly[field][i];
    if (v == null) return;
    if (!buckets[dateStr]) buckets[dateStr] = [];
    buckets[dateStr].push(v);
  });

  Object.keys(buckets).forEach((dateStr) => {
    const arr = buckets[dateStr];
    means[dateStr] = arr.reduce((a, b) => a + b, 0) / arr.length;
  });

  return means;
};

// Derive a rising/falling/steady trend per date by comparing its mean pressure to the prior date's mean.
export const getDailyPressureTrends = (hourly) => {
  const dailyMeans = getDailyMeans(hourly, 'pressure_msl');
  const dates = Object.keys(dailyMeans).sort();
  const trends = {};

  dates.forEach((dateStr, i) => {
    if (i === 0) { trends[dateStr] = 'steady'; return; }
    const diff = dailyMeans[dateStr] - dailyMeans[dates[i - 1]];
    if (diff > 1) trends[dateStr] = 'rising';
    else if (diff < -1) trends[dateStr] = 'falling';
    else trends[dateStr] = 'steady';
  });

  return trends;
};

// Mean cloud cover % per local calendar date
export const getDailyCloudCover = (hourly) => getDailyMeans(hourly, 'cloud_cover');

// Daily mean temp (°F) from matching max/min arrays
export const getDailyMeanTemps = (tempMax, tempMin) =>
  tempMax.map((max, i) => (max != null && tempMin[i] != null ? (max + tempMin[i]) / 2 : null));

// Magnitude of the temperature drop over the trailing 48h, keyed by date. A sharp drop (a cold
// front passage) is a well-documented, specific trigger for deer movement and fish feeding —
// a stronger signal than just "trending down" over several days.
export const getColdFrontDeltas = (dateStrs, meanTemps) => {
  const deltas = {};
  dateStrs.forEach((dateStr, i) => {
    if (i < 2 || meanTemps[i] == null || meanTemps[i - 2] == null) { deltas[dateStr] = null; return; }
    deltas[dateStr] = meanTemps[i] - meanTemps[i - 2]; // negative = temp dropped
  });
  return deltas;
};

const dayOfYear = (date) => {
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.floor((date - start) / 86400000) + 1;
};

// Shortest distance between two days-of-year on a 365-day cycle (handles wraparound at New Year's)
const circularDayDiff = (a, b) => {
  const diff = Math.abs(a - b);
  return Math.min(diff, 365 - diff);
};

// Rough regional estimate of peak whitetail rut, by latitude. Rut timing tracks photoperiod and
// is well-documented at ~Nov 15 across most of the temperate US; it shifts later (and becomes far
// less predictable) moving south. This is a simplified estimate, not a substitute for local
// scouting/harvest data — far-southern/subtropical herds in particular can vary widely.
const getPeakRutDayOfYear = (lat) => {
  const NOV_15 = 319;
  const DEC_20 = 354;
  if (lat >= 38) return NOV_15;
  if (lat >= 28) {
    const t = (38 - lat) / (38 - 28);
    return Math.round(NOV_15 + t * (DEC_20 - NOV_15));
  }
  return DEC_20;
};

// Rut phase is the single biggest known driver of daylight whitetail movement — bucks move far
// more in daylight during the rut than weather alone would predict. Weather still modulates it
// (hence the other factors), but the rut window itself deserves the heaviest single weight.
export const getRutPhase = (date, lat) => {
  if (lat == null) return { bonus: 0, label: null };
  const diff = circularDayDiff(dayOfYear(date), getPeakRutDayOfYear(lat));
  if (diff <= 7) return { bonus: 30, label: 'Peak rut window - bucks moving in daylight' };
  if (diff <= 21) return { bonus: 18, label: 'Rut active - increased daylight movement' };
  if (diff <= 35) return { bonus: 8, label: 'Rut approaching/winding down' };
  return { bonus: 0, label: null };
};

export const scoreToStars = (score) => {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 55) return 3;
  if (score >= 35) return 2;
  return 1;
};

// Rating weighted toward the factors with the strongest real-world support for deer movement
// (rut timing, cold-front passages, wind) over pure solunar folklore (moon phase, which GPS-collar
// studies have repeatedly found has little measurable effect once dawn/dusk timing is accounted for -
// kept here as a minor factor since this is a "solunar" feature, not because the evidence is strong).
export const getDayRating = ({ periods, illumination, pressureTrend, sunrise, sunset, windSpeedMax, cloudCoverMean, coldFrontDelta, precipSum, rutBonus, rutLabel, activityType }) => {
  let score = 0;
  const reasons = [];

  // Rut phase (hunting only): the single biggest known driver of daylight deer movement
  if (activityType === 'hunting' && rutBonus) {
    score += rutBonus;
    if (rutLabel) reasons.push(rutLabel);
  }

  // Cold front: a sharp 48h temperature drop is a well-documented trigger for increased
  // movement/feeding - a stronger, more specific signal than a slow multi-day decline
  if (coldFrontDelta != null) {
    if (coldFrontDelta <= -15) { score += 20; reasons.push(`Sharp cold front (${Math.round(coldFrontDelta)}°F in 48h) - strong movement trigger`); }
    else if (coldFrontDelta <= -8) { score += 10; reasons.push(`Cooling trend (${Math.round(coldFrontDelta)}°F in 48h)`); }
    else if (coldFrontDelta >= 10) { score -= 5; reasons.push('Warming trend (less favorable)'); }
  }

  // Hunting-specific: high wind suppresses game movement by degrading scent/hearing - one of
  // the most consistently observed suppressors, calm wind favors it
  if (activityType === 'hunting' && windSpeedMax != null) {
    if (windSpeedMax > 25) { score -= 20; reasons.push(`${Math.round(windSpeedMax)} mph wind likely limits movement`); }
    else if (windSpeedMax > 15) { score -= 10; reasons.push(`${Math.round(windSpeedMax)} mph wind may limit movement`); }
    else if (windSpeedMax <= 8) { reasons.push('Calm winds favor movement'); }
  }

  // Precipitation: light rain traditionally triggers both game movement and the bite;
  // heavy rain suppresses activity (and is a safety concern for fishing).
  if (precipSum != null) {
    if (precipSum > 0.5) { score -= 15; reasons.push(`Heavy rain (${precipSum.toFixed(2)}") likely limits activity`); }
    else if (precipSum > 0.1) { score += 10; reasons.push('Light rain can trigger increased activity'); }
  }

  // Barometric trend: steady or slowly falling pressure favors activity; rising pressure suppresses it
  if (pressureTrend === 'falling') { score += 15; reasons.push('Falling pressure'); }
  else if (pressureTrend === 'steady') { score += 8; }
  else if (pressureTrend === 'rising') { score += 2; reasons.push('Rising pressure (less favorable)'); }

  // Fishing-specific: overcast skies traditionally favor the bite; bright/clear skies suppress it
  if (activityType === 'fishing' && cloudCoverMean != null) {
    if (cloudCoverMean >= 60) { score += 15; reasons.push('Overcast skies favor the bite'); }
    else if (cloudCoverMean <= 20) { score -= 5; reasons.push('Clear, bright skies may slow the bite'); }
  }

  // Prime time: a major or minor period overlapping sunrise/sunset - the dawn/dusk window is the
  // real driver here, the moon period is treated as a modest bonus on top of it
  const allPeriods = [...(periods?.majors || []), ...(periods?.minors || [])];
  let overlapBonus = 0;
  allPeriods.forEach((p) => {
    [sunrise, sunset].forEach((t) => {
      if (periodsOverlapTime(p, t)) {
        const isMajor = p.label.includes('Overhead') || p.label.includes('Underfoot');
        overlapBonus = Math.max(overlapBonus, isMajor ? 20 : 12);
      }
    });
  });
  score += overlapBonus;
  if (overlapBonus >= 12) reasons.push('Major/minor period near dawn or dusk');

  // Moon phase: kept as a minor, traditional factor only - new/full moon (illumination near 0 or
  // 100) is the solunar claim, but it's weakly supported at best once dawn/dusk is accounted for
  const phaseExtremity = Math.abs((illumination ?? 50) - 50) / 50;
  score += phaseExtremity * 10;
  if (phaseExtremity > 0.7) reasons.push('Near new/full moon (minor factor)');

  score = Math.max(0, Math.min(100, Math.round(score)));
  let rating, color;
  if (score >= 75) { rating = 'Excellent'; color = '#4ade80'; }
  else if (score >= 55) { rating = 'Good'; color = '#a3e635'; }
  else if (score >= 35) { rating = 'Fair'; color = '#fbbf24'; }
  else { rating = 'Poor'; color = '#f87171'; }

  return { score, rating, color, reasons, stars: scoreToStars(score) };
};
