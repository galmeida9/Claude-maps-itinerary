# /maps-itinerary

Plan, update, or modify a travel itinerary from a Google Maps saved list.

## Usage

```
/maps-itinerary <url>                              # Create a new itinerary
/maps-itinerary update <url> <schedule.md>         # Sync new places from the list into an existing schedule
/maps-itinerary ask <url> <schedule.md> <question> # Ask a question or apply a change to an existing schedule
```

## Workflow

### 1. Scrape the Google Maps List

Run the scrape script — it requires Node.js and Playwright:

```bash
# From the skill directory:
node scrape-gmaps-list.mjs "<url>" "/tmp/places.json"
```

The script launches a visible Chromium browser, handles Google consent pages in any language, scrolls to load all items, and saves results to `places.json`. Output includes name, category, rating, and any user-added notes per place.

**If Playwright is not installed:** run `npm install playwright` then `npx playwright install chromium` in the script directory (or any directory with a package.json).

**If the browser fails to load the list:** the user must have the Google Maps list set to public. Ask them to verify.

### 2. Ask Onboarding Questions

After scraping (or while the script runs), ask the user these 4 questions — all at once in a single message:

1. **Trip dates** — When does the trip begin and end? (e.g. "Nov 18 – Dec 3, 2026")
2. **Arrival & departure** — What time do you arrive (airport + terminal), and what time does your return flight depart?
3. **Transport** — Public transportation only, or will you rent a car? If renting, on which days?
4. **Meal times** — What are your preferred breakfast, lunch, and dinner times?
5. **Hotel departure** — What time do you plan to leave the hotel each morning? (default: 1h after sunrise if not provided)
6. **Seasonal research** — Would you like me to research local events, public holidays, festivals, and seasonal highlights (e.g. foliage peaks, illuminations, monthly markets) for your travel dates? (Recommended)

### 3. Classify & Group Locations

**Use the Google Maps list as the primary location source.** Every saved place has an exact pin. Use Playwright to click through to each place's detail panel to read its address — do not rely on web search for location. For large lists, prioritise clicking on any place whose city/region is not immediately obvious from its name.

```bash
# Reuse the Chromium session from scraping:
# Navigate to the list URL → click a place item → read the address from the right-hand detail panel
```

For each place:

1. **Assign to city/region** from the Google Maps address. Click through for anything ambiguous.
2. **Flag temporarily closed** — if the scraped category contains "closed", "temporarily closed", or an equivalent in any language, mark it for the "Locations to Verify" section and exclude it from day planning.
3. **Identify the city order** from the user's stated plan (e.g. "west first, then Tokyo").
4. **Allocate nights per city** based on attraction count and travel logistics.
5. **Flag public-transport-hostile locations** — if user chose no car, mark which places require one.

### 4. Research

**Always do for every trip:**

- Look up actual transit times and costs for all day trips and city-to-city moves (web search). Include in the Notes column of the schedule.
- Check opening hours for all venues; note any that open unusually early (e.g. 06:00 shrines), close early, or are only open on specific days.
- Identify the best time of day to visit each location — see `itinerary-format.md` for guidance. Note these before building day plans.

**If user said yes to seasonal research:**

- Look up public holidays in each destination country during the travel dates. Flag days that will be significantly more crowded and adjust plans accordingly (go earlier, choose less popular alternatives, or warn the user).
- Search for local festivals, seasonal events, and special openings tied to the travel dates.
- Identify fixed-date events linked to places in the list (e.g. a temple that holds a monthly flea market, seasonal illuminations with specific dates). Pin these to the correct calendar days first before filling in the rest.
- Note seasonal conditions relevant to the trip (foliage peak, bloom windows, weather, peak vs off-peak crowd levels).

### 5. Plan the Itinerary

**Single-city trip:** Plan directly — no city agents needed; proceed to Step 6.

**Multi-city trip:** Spawn a planning agent per city using the Agent tool:

```
Agent: "[City] itinerary planner"
Prompt: "Plan the [City] portion of a [N]-day trip (dates: X–Y).
  Base city: [City]. Day trips allowed to: [list].
  Transport: [public/car].
  Meal times: [times].
  Places to cover: [JSON list of places in this city/region].
  Sunrise/sunset for dates: [table].
  Refer to the itinerary format guidelines in itinerary-format.md.
  Output: structured JSON with days, locations, themes, and transition info."
```

City agents coordinate on:

- How many days each city gets (negotiate based on attraction count)
- Transition day ownership (destination city owns the travel day)
- Realistic day capacity (4–6 major stops per day max)

Assemble the final itinerary from all agents' outputs.

### 6. Generate the Itinerary

Write the itinerary as a markdown file. Follow the format and scheduling rules in `itinerary-format.md` exactly.

Key rules (summary — full details in reference file):

- User ready at their stated hotel departure time; outdoor spots end by sunset
- Dinner at 18:00+, never in the afternoon
- Airport: 1h to exit on arrival, 2h before departure
- Drop locations that are impractical — list them in "Locations Dropped"
- Pre-booking requirements get their own section at the top
- Pay attention to user notes on saved places — they indicate priorities
- Add a "Locations to Verify Before Trip" section for any place flagged as: temporarily closed, location unclear, or requiring advance booking confirmation

Save the output to a `.md` file in the user's working directory and show the path.

---

## Command: update

```
/maps-itinerary update <url> <schedule.md>
```

Re-scrape the Google Maps list and incorporate any new places into an existing schedule.

### 1. Scrape & Diff

Run the scrape script to get the current list:

```bash
node scrape-gmaps-list.mjs "<url>" "/tmp/places-new.json"
```

Read the existing `schedule.md`. Extract every place name that already appears in the schedule (in day tables, the dropped locations section, and any notes).

Compare the two sets to find **new places** — places in the freshly scraped list that are not mentioned anywhere in the existing schedule.

If there are no new places, tell the user the schedule is already up to date and stop.

### 2. Evaluate Each New Place

For each new place:

1. **Identify its city/region** and which days in the schedule cover that area.
2. **Check if it fits** into an existing day without making it unrealistic (max ~6 major stops per day). Consider: location cluster, opening hours, daylight requirements.
3. **Classify the outcome:**
   - **Fits cleanly** — there is a natural slot in an existing day (e.g. it's near other places already on that day, or there is slack time).
   - **Fits with a swap** — adding it would make the day too full; something less important on that day could be removed to make room.
   - **Doesn't fit** — the region's days are already at capacity and no reasonable swap exists; add it to the Dropped section with a note.

### 3. Handle Swaps — Always Ask First

If a new place **fits with a swap**, do not remove anything automatically. Instead, present the trade-off to the user:

> "**[New Place]** could be added to Day N ([theme]), but the day would be too full. To make room I'd suggest removing **[Existing Place]** because [reason — e.g. lower rating, less unique, similar to another place already on that day]. Would you like me to make that swap, or is there something else you'd prefer to remove?"

Wait for the user's response before editing the schedule. The user may:

- Agree to the suggested swap
- Name a different place to remove instead
- Say no — in which case add the new place to Dropped

### 4. Apply Changes & Save

Once all decisions are made, update the schedule:

- Insert new places into the appropriate day tables with correct times
- Update the "Locations Dropped" section if needed
- Add a brief `> Updated [date]: added X, swapped Y for Z` note at the top of the file

Overwrite the original `schedule.md` (or save as `schedule-updated.md` if the user prefers) and show the diff summary.

---

## Command: ask

```
/maps-itinerary ask <url> <schedule.md> <question>
```

Answer a question or apply a freeform instruction to an existing schedule.

### 1. Load Context

- Read `schedule.md` in full.
- Scrape the Google Maps list with the scrape script so you have the full place metadata (ratings, notes, categories) available for reasoning.

```bash
node scrape-gmaps-list.mjs "<url>" "/tmp/places.json"
```

### 2. Interpret the Question

The `<question>` can be:

- **A factual question** — e.g. "How many temples are in the Kyoto week?" or "Which day has the most walking?" → Answer directly, no schedule changes needed.
- **A what-if** — e.g. "What if I only have 4 days in Tokyo instead of 7?" → Reason through the impact and propose a revised plan; ask for confirmation before saving.
- **A change instruction** — e.g. "Move Fushimi Inari to the morning of Day 5" or "Swap the Kamakura and Fuji days" → Apply the change, check it doesn't create conflicts (opening hours, daylight, overcrowding), then save.
- **A preference change** — e.g. "I now have a rental car for the Fuji day" or "Add dinner at 19:00 instead of 18:00 throughout" → Apply globally or locally as appropriate.

### 3. Conflict Check

Before saving any structural change, verify:

- Opening hours still respected after the move
- Daylight window still sufficient for outdoor spots
- Day capacity not exceeded (max ~6 major stops)
- Transit times between reordered stops are still realistic

If a conflict is found, explain it and propose a resolution before applying.

### 4. Save

For changes: overwrite `schedule.md` (or save as a new file if the user prefers) and summarise what changed.
For questions: just answer — do not modify the file.

---

## Prerequisites

- **Node.js** (v16+) and **Playwright** installed
- Google Maps list must be **public** (shareable link)
- For multi-city planning: the Agent tool must be available

## References

- `itinerary-format.md` — Full output format, scheduling rules, multi-agent coordination protocol, and transport notes. Read this before planning.
