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

// Group hourly pressure readings by local calendar date and derive a rising/falling/steady
// trend for each date by comparing its mean pressure to the prior date's mean.
export const getDailyPressureTrends = (hourly) => {
  const trends = {};
  if (!hourly?.time || !hourly?.pressure_msl) return trends;

  const dailyMeans = {};
  hourly.time.forEach((t, i) => {
    const dateStr = t.slice(0, 10);
    const p = hourly.pressure_msl[i];
    if (p == null) return;
    if (!dailyMeans[dateStr]) dailyMeans[dateStr] = [];
    dailyMeans[dateStr].push(p);
  });

  const dates = Object.keys(dailyMeans).sort();
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

  dates.forEach((dateStr, i) => {
    if (i === 0) { trends[dateStr] = 'steady'; return; }
    const diff = avg(dailyMeans[dateStr]) - avg(dailyMeans[dates[i - 1]]);
    if (diff > 1) trends[dateStr] = 'rising';
    else if (diff < -1) trends[dateStr] = 'falling';
    else trends[dateStr] = 'steady';
  });

  return trends;
};

export const scoreToStars = (score) => {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 55) return 3;
  if (score >= 35) return 2;
  return 1;
};

// Folklore-based rating (solunar theory), not scientifically validated - a traditional heuristic
// combining moon phase, barometric trend, overlap of solunar periods with dawn/dusk, and
// (for hunting) wind speed, since high wind suppresses big-game movement.
export const getDayRating = ({ periods, illumination, pressureTrend, sunrise, sunset, windSpeedMax, activityType }) => {
  let score = 0;
  const reasons = [];

  // Moon phase: new/full (illumination near 0 or 100) is traditionally most active
  const phaseExtremity = Math.abs((illumination ?? 50) - 50) / 50;
  score += phaseExtremity * 40;
  if (phaseExtremity > 0.7) reasons.push('Near new/full moon');

  // Barometric trend: steady or slowly falling pressure favors activity; rising pressure suppresses it
  if (pressureTrend === 'falling') { score += 25; reasons.push('Falling pressure'); }
  else if (pressureTrend === 'steady') { score += 15; }
  else if (pressureTrend === 'rising') { score += 5; reasons.push('Rising pressure (less favorable)'); }

  // Prime time: a major or minor period overlapping sunrise/sunset is a well-known bonus
  const allPeriods = [...(periods?.majors || []), ...(periods?.minors || [])];
  let overlapBonus = 0;
  allPeriods.forEach((p) => {
    [sunrise, sunset].forEach((t) => {
      if (periodsOverlapTime(p, t)) {
        const isMajor = p.label.includes('Overhead') || p.label.includes('Underfoot');
        overlapBonus = Math.max(overlapBonus, isMajor ? 30 : 18);
      }
    });
  });
  score += overlapBonus;
  if (overlapBonus >= 18) reasons.push('Major/minor period near dawn or dusk');

  // Hunting-specific: high wind suppresses game movement, calm wind favors it
  if (activityType === 'hunting' && windSpeedMax != null) {
    if (windSpeedMax > 25) { score -= 20; reasons.push(`${Math.round(windSpeedMax)} mph wind likely limits movement`); }
    else if (windSpeedMax > 15) { score -= 10; reasons.push(`${Math.round(windSpeedMax)} mph wind may limit movement`); }
    else if (windSpeedMax <= 8) { reasons.push('Calm winds favor movement'); }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  let rating, color;
  if (score >= 75) { rating = 'Excellent'; color = '#4ade80'; }
  else if (score >= 55) { rating = 'Good'; color = '#a3e635'; }
  else if (score >= 35) { rating = 'Fair'; color = '#fbbf24'; }
  else { rating = 'Poor'; color = '#f87171'; }

  return { score, rating, color, reasons, stars: scoreToStars(score) };
};
