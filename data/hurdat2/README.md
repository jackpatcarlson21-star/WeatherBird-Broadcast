# HURDAT2 source data

Raw NHC best-track files used by the Hurricane tab's HISTORY view. They are
not deployed; `npm run hurdat2` converts them into the compact
`public/hurdat2-*.json` files the app downloads.

| File | Source |
|---|---|
| `atlantic.txt` | https://www.nhc.noaa.gov/data/hurdat/hurdat2-1851-2025-092326.txt |
| `pacific.txt`  | https://www.nhc.noaa.gov/data/hurdat/hurdat2-nepac-1949-2025-092926.txt |

To update after NHC publishes a new season (usually each spring): download the
newest files from https://www.nhc.noaa.gov/data/hurdat/, replace the two files
here, run `npm run hurdat2`, and set `HURDAT2_LAST_YEAR` in
`src/components/tabs/HurricaneTab.jsx` to the year the script prints.
