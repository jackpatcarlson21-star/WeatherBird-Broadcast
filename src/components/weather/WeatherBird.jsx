import React from 'react';

const PixelBird = ({ bodyColor = '#00FFFF' }) => (
  <svg
    viewBox="0 0 32 32"
    width="64"
    height="64"
    style={{ imageRendering: 'pixelated' }}
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="WeatherBird mascot"
  >
    {/* Head */}
    <rect x="12" y="4" width="8" height="2" fill={bodyColor} />
    <rect x="10" y="6" width="12" height="2" fill={bodyColor} />
    <rect x="10" y="8" width="12" height="2" fill={bodyColor} />
    {/* Eyes */}
    <rect x="12" y="8" width="2" height="2" fill="#000" />
    <rect x="18" y="8" width="2" height="2" fill="#000" />
    {/* Eye shine */}
    <rect x="12" y="8" width="1" height="1" fill="#FFF" />
    <rect x="18" y="8" width="1" height="1" fill="#FFF" />
    {/* Beak */}
    <rect x="22" y="8" width="4" height="2" fill="#FFA500" />
    <rect x="22" y="10" width="2" height="2" fill="#FFA500" />
    {/* Body */}
    <rect x="8" y="10" width="14" height="2" fill={bodyColor} />
    <rect x="6" y="12" width="16" height="2" fill={bodyColor} />
    <rect x="6" y="14" width="16" height="2" fill={bodyColor} />
    <rect x="6" y="16" width="16" height="2" fill={bodyColor} />
    <rect x="8" y="18" width="14" height="2" fill={bodyColor} />
    {/* Belly highlight */}
    <rect x="12" y="14" width="6" height="4" fill={bodyColor} opacity="0.6" />
    {/* Wing */}
    <rect x="4" y="12" width="2" height="2" fill={bodyColor} opacity="0.8" />
    <rect x="2" y="14" width="4" height="2" fill={bodyColor} opacity="0.8" />
    <rect x="2" y="16" width="2" height="2" fill={bodyColor} opacity="0.6" />
    {/* Tail */}
    <rect x="22" y="16" width="4" height="2" fill={bodyColor} opacity="0.7" />
    <rect x="24" y="14" width="4" height="2" fill={bodyColor} opacity="0.5" />
    {/* Feet */}
    <rect x="10" y="20" width="2" height="2" fill="#FFA500" />
    <rect x="8" y="22" width="2" height="2" fill="#FFA500" />
    <rect x="12" y="22" width="2" height="2" fill="#FFA500" />
    <rect x="16" y="20" width="2" height="2" fill="#FFA500" />
    <rect x="14" y="22" width="2" height="2" fill="#FFA500" />
    <rect x="18" y="22" width="2" height="2" fill="#FFA500" />
  </svg>
);

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 9) return 'early_morning';
  if (hour >= 9 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'evening';
  return 'late_night';
};

const WeatherBird = ({ temp, weatherCode, windSpeed, night, alerts }) => {
  let message = "";
  let animation = "";
  let accessory = "";
  let bodyColor = "#00FFFF";

  const time = getTimeOfDay();
  const hasSevereAlerts = alerts && alerts.some(a => {
    const event = a.properties?.event?.toLowerCase() || '';
    return event.includes('warning') || event.includes('watch');
  });
  const hasTornado = alerts && alerts.some(a => {
    const event = a.properties?.event?.toLowerCase() || '';
    return event.includes('tornado');
  });

  // === SEVERE ALERTS (highest priority) ===
  if (hasTornado) {
    bodyColor = "#EF4444";
    accessory = "\uD83C\uDF2A\uFE0F";
    animation = "animate-shiver";
    message = pick([
      "TORNADO THREAT! Get to shelter NOW!",
      "Take cover immediately! This is serious!",
      "Find your safe room RIGHT NOW!",
      "Not the time for birdwatching! TAKE SHELTER!",
    ]);
  } else if (hasSevereAlerts) {
    bodyColor = "#FACC15";
    accessory = "\u26A0\uFE0F";
    animation = "animate-bounce";
    message = pick([
      "Severe weather nearby! Stay alert!",
      "Keep your eyes on the sky!",
      "Stay weather aware today!",
      "Active alerts in your area! Be ready!",
      "This bird says stay inside!",
    ]);

  // === THUNDERSTORMS ===
  } else if (weatherCode >= 95) {
    bodyColor = "#FACC15";
    accessory = "\u26A1";
    animation = "animate-bounce";
    message = pick([
      "YIKES! Stay safe inside!",
      "Thunder and lightning! Not ideal flying weather!",
      "Even this bird is grounded right now!",
      "Mother Nature is putting on a show!",
      "Storms rolling through! Hunker down!",
      night ? "Scary night out there! Stay cozy!" : "Wild weather! Maybe skip the picnic!",
    ]);

  // === SNOW ===
  } else if (weatherCode >= 71 && weatherCode <= 77) {
    bodyColor = "#93C5FD";
    accessory = "\u2744\uFE0F";
    animation = "animate-pulse";
    message = pick([
      "Brrr! Bundle up out there!",
      "Snow day vibes! Stay warm!",
      "My feathers are frozen!",
      "Hot cocoa weather for sure!",
      "Winter wonderland mode activated!",
      night ? "Snowy night! Cozy up by the fire!" : "The snow is beautiful but COLD!",
    ]);

  // === RAIN / DRIZZLE ===
  } else if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) {
    bodyColor = "#60A5FA";
    accessory = "\u2614";
    animation = "";
    message = pick([
      "Don't forget your umbrella!",
      "Rainy day! Perfect for staying in!",
      "Splish splash! Wet feathers today!",
      "The plants are loving this!",
      "Rain rain go away... or don't, we need it!",
      night ? "Rainy night... great sleeping weather!" : "Grab a jacket, it's wet out there!",
    ]);

  // === FOG ===
  } else if (weatherCode >= 45 && weatherCode <= 48) {
    bodyColor = "#94A3B8";
    accessory = "\uD83C\uDF2B\uFE0F";
    animation = "";
    message = pick([
      "Can barely see my own beak out here!",
      "Foggy! Drive careful out there!",
      "Spooky vibes with all this fog!",
      "Low visibility! Take it slow!",
    ]);

  // === HIGH WIND ===
  } else if (windSpeed >= 25) {
    accessory = "\uD83D\uDCA8";
    animation = "animate-wiggle";
    message = pick([
      "Hold onto your feathers!",
      "It's BREEZY out here! Woo!",
      "Wind is howling today!",
      "Almost blew me off my perch!",
      "Secure any loose items outside!",
    ]);

  // === FREEZING ===
  } else if (temp <= 20) {
    bodyColor = "#60A5FA";
    accessory = "\uD83E\uDDCA";
    animation = "animate-shiver";
    message = pick([
      "DANGEROUSLY cold! Limit time outside!",
      "My beak is an icicle right now!",
      "Frostbite weather! Bundle up!",
      night ? "Brutally cold night! Stay inside!" : "Bitter cold today! Layer up!",
    ]);
  } else if (temp <= 32) {
    bodyColor = "#60A5FA";
    accessory = "\uD83E\uDDE3";
    animation = "animate-shiver";
    message = pick([
      "It's freezing! Stay warm!",
      "Below freezing! Watch for ice!",
      "Brrrr! This bird needs a sweater!",
      "Jack Frost is nipping at your nose!",
      night ? "Freezing night! Crank up the heat!" : "Cold one today! Dress warm!",
    ]);

  // === EXTREME HEAT ===
  } else if (temp >= 100) {
    bodyColor = "#EF4444";
    accessory = "\uD83E\uDD75";
    animation = "animate-pulse";
    message = pick([
      "EXTREME heat! Stay hydrated!",
      "Triple digits! Limit outdoor time!",
      "Even birds need shade in this heat!",
      "Dangerously hot! Drink lots of water!",
    ]);
  } else if (temp >= 90) {
    bodyColor = "#FB923C";
    accessory = "\uD83D\uDE0E";
    animation = "animate-pulse";
    message = pick([
      "Whew! It's a hot one!",
      "Sunscreen and water, people!",
      "This bird is melting!",
      "Perfect pool weather if you ask me!",
      "Hot hot hot! Stay cool out there!",
    ]);

  // === CLEAR SKY ===
  } else if (weatherCode === 0) {
    if (night) {
      bodyColor = "#6366F1";
      accessory = "\uD83C\uDF19";
      animation = "";
      message = pick([
        time === 'late_night'
          ? pick(["Up late? The stars are incredible tonight!", "Can't sleep? At least the sky is clear!", "Night owl mode! Clear skies above!"])
          : pick(["What a lovely evening!", "Clear skies! Perfect for stargazing!", "Beautiful night out there!", "The moon is looking gorgeous tonight!"]),
      ]);
    } else {
      accessory = "\u2600\uFE0F";
      animation = "animate-happy";
      message = pick([
        time === 'early_morning'
          ? pick(["Rise and shine! Beautiful morning!", "Early bird gets the worm! Clear skies!", "Good morning sunshine!"])
          : time === 'morning'
          ? pick(["Gorgeous morning! Get outside!", "What a perfect morning!", "Blue skies all around!"])
          : time === 'midday'
          ? pick(["Beautiful day at its peak!", "Lunchtime and the weather is perfect!", "Sunny and clear! Love it!"])
          : time === 'afternoon'
          ? pick(["Enjoy the rest of this beautiful day!", "Perfect afternoon! Soak it up!", "Clear skies all afternoon!"])
          : pick(["What a beautiful evening ahead!", "Lovely evening coming up! Get outside!", "Golden hour with clear skies!"]),
      ]);
    }

  // === PARTLY CLOUDY / OVERCAST ===
  } else if (weatherCode <= 3) {
    if (night) {
      bodyColor = "#818CF8";
      accessory = "\u2601\uFE0F";
      animation = "";
      message = pick([
        "Cloudy night. Cozy up!",
        "Overcast skies tonight. Rest easy!",
        "Quiet night under the clouds!",
        time === 'late_night' ? "Clouds and quiet. Perfect for sleep!" : "Calm evening with some clouds!",
      ]);
    } else {
      accessory = "\u26C5";
      animation = "";
      message = pick([
        "A few clouds, but not bad at all!",
        "Partly cloudy! Still a good day!",
        "Some clouds rolling in, no worries!",
        "Not too shabby out there!",
        time === 'morning' ? "Cloudy morning! Should clear up!" : "Clouds are hanging around, but it's fine!",
        time === 'afternoon' ? "Partly cloudy afternoon! Still nice!" : "Looking decent out there!",
      ]);
    }

  // === FALLBACK ===
  } else {
    message = pick([
      "CAW CAW!",
      "Stay weather aware!",
      "Check back soon for updates!",
      night ? "Keeping an eye on things tonight!" : "Watching the skies for you!",
    ]);
  }

  return (
    <div className="flex flex-col items-center p-4 rounded-lg border-2 border-cyan-600 bg-black/30">
      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }
        @keyframes shiver {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
        @keyframes happy {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-wiggle { animation: wiggle 0.3s ease-in-out infinite; }
        .animate-shiver { animation: shiver 0.1s ease-in-out infinite; }
        .animate-happy { animation: happy 0.5s ease-in-out infinite; }
      `}</style>
      <div className={`${animation}`}>
        <span className="relative inline-block">
          <PixelBird bodyColor={bodyColor} />
          {accessory && <span className="absolute -top-2 -right-4 text-3xl" aria-hidden="true">{accessory}</span>}
        </span>
      </div>
      <p className="text-cyan-300 font-vt323 text-lg mt-2 text-center">{message}</p>
    </div>
  );
};

export default WeatherBird;
