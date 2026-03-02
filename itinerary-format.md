# Itinerary Planning Reference

## Output Format

Use this exact markdown structure for the final itinerary:

```markdown
# [Destination] Trip Itinerary — [Start Date] to [End Date]

## Overview
| Period | Base | Days |
|--------|------|------|
| Date range | City | N full days |

**Sunrise / Sunset reference:**
| Location | Period | Sunrise | Ready by | Sunset |
|----------|--------|---------|----------|--------|

---
## Pre-booking Requirements
> Book these in advance...
- **Attraction** — reason + booking notes

---
## Locations Dropped
| Location | Reason |
|----------|--------|

---
## Locations to Verify Before Trip
| Place | Issue |
|-------|-------|
| **Place name** | e.g. "Listed as temporarily closed on Google Maps — check status before trip" |
| **Place name** | e.g. "Requires advance booking — book by [date]" |

---
## Day N — [Weekday, Month DD]: [Day Theme]
**Sunrise HH:MM · Sunset HH:MM · Ready by HH:MM**

| Time  | Activity | Notes |
|-------|----------|-------|
| 07:30 | Leave hotel | ... |
| 08:00 | **Place Name** | Opening hours, price, time needed |
...
| 18:00+ | Dinner | Area suggestion |
```

---

## Scheduling Rules

### Daylight Budget
- **Hotel departure**: use the time provided by the user. Default: 1h after sunrise (e.g., sunrise 06:30 → leave 07:30).
- Outdoor attractions must END by sunset (budget 30 min before sunset for the last outdoor spot).
- After sunset: restaurants, bars, indoor shopping, illuminated temples/shrines, night markets.

### Airport Time
- **Arrival**: Allow 1 hour to clear immigration + collect luggage before leaving the airport (unless user specifies otherwise)
- **Departure**: Arrive at airport 2 hours before international flights, 1.5 hours before domestic

### Meal Times
- Use times provided by user in onboarding questions
- Default if not provided: Lunch 12:00–13:30, Dinner 18:30–20:30
- Dinner only after 18:00 — never during late afternoon

### Day Trip Rules
- Return to base city in time for dinner (latest departure from day trip destination: 17:30)
- Keep transit time realistic — add buffer for connections

### Optimal Visit Times
Some locations are strongly time-sensitive within the day. Apply these when relevant:

| Pattern | Best Time | Reason |
|---------|-----------|--------|
| Very popular outdoor spots (bamboo forests, famous viewpoints, busy shrines) | First thing after hotel departure | Fewest crowds, best light |
| Sunrise hikes / pagoda + mountain views | Arrive at trailhead at or before sunrise | Light + no crowds |
| Atmospheric streets (old town lanes, geisha districts) | Dusk (30–60 min before sunset) | Golden light, lanterns lit, geisha active |
| Evening illuminations (temples, gardens) | Opening time of the event (typically 17:30–18:00) | Avoid queues, see full show |
| Observation decks | Dusk → night | Golden hour then city lights |
| Indoor markets and shopping streets | Mid-morning (10:00–11:00) | Shops open, before lunch crowds |
| Flea markets and outdoor markets | Early (opening time) | Best selection before items are picked over |

When a place benefits from a specific time, note it in the schedule Notes column and build the day plan around it.

### Crowd & Holiday Awareness
- **Public holidays**: check if any travel dates fall on national holidays in the destination country. Expect significantly higher crowds at popular spots. Adjust by going earlier, deprioritising the most crowded places on those days, or warning the user.
- **Peak seasons**: if travel dates overlap with a known peak (cherry blossoms, autumn foliage, Golden Week, etc.), treat all popular outdoor spots as if they are crowded by default — schedule them early in the day.
- **Weekends vs weekdays**: for very popular spots, note if visiting on a weekend will be significantly more crowded and suggest a weekday alternative where possible.
- **Fixed-date events**: schedule these on the exact correct day first (monthly markets, seasonal illuminations, annual festivals), then build the rest of the day around them.

---

## Location Classification

When categorizing scraped places, assign each to:
1. **City/Region** (for multi-agent routing)
2. **Type**: outdoor-daylight | indoor | shopping | food-drink | nightlife | transit
3. **Cluster**: geographic grouping for efficient routing

### Type Definitions

| Type | Schedule When |
|------|--------------|
| outdoor-daylight | During daylight hours only |
| indoor | Any time during operating hours |
| shopping | Afternoon or evening (most open 10:00–21:00) |
| food-drink | Appropriate meal slots |
| nightlife | After 18:00 |
| transit | n/a — navigation landmark |

**Night-friendly outdoor spots** (can be visited after dark):
- Illuminated temple/shrine events
- Famous city crossing/streets at night
- Neon/market areas
- Observation decks
- Waterfront promenades

---

## Planning Logic

### Step 1: Group by Region
Assign each place to a city or region. For Japan trips, typical groupings:
- Kyoto area (Kyoto + Arashiyama + Fushimi + Nijo)
- Osaka area (day trip)
- Nara area (day trip)
- Tokyo area (Tokyo base)
- Kamakura (day trip from Tokyo)
- Fuji Five Lakes (day trip from Tokyo)

### Step 2: Cluster by Proximity
Within each city, group places that are walkable from each other into clusters. Assign each cluster to a day.

### Step 3: Calculate Day Capacity

**Always account for both transit time and dwell time at each location.**

Transit time (between locations, by public transport):
- Same neighbourhood / walkable: 5–15 min
- Different district, same city (metro/bus): 20–40 min
- Cross-city (train): 30–90 min depending on route
- Day trip destinations: look up the actual route and include it explicitly in the schedule notes

Dwell time (time needed at each location):
- Quick stop (statue, viewpoint, small shrine): 15–30 min
- Standard attraction (temple, shrine, market, park): 45–90 min
- Major attraction (large museum, famous temple complex, bamboo forest + walk): 1.5–2.5h
- Full-day venue (theme park, immersive experience, long hike): 3h+

Build the day timeline by chaining: `hotel departure → [transit] → location 1 (dwell) → [transit] → location 2 (dwell) → …`

Verify each step fits before finalising. If the chain runs past sunset for outdoor stops, or past a reasonable dinner time, drop the last stop rather than squeezing it.

- Typical realistic day: 4–6 locations (mix of major + quick stops)
- Don't overpack — a dropped location is better than an unrealistic schedule

### Step 4: Prioritize
Priority order:
1. Places with narrow time windows (flea markets, specific events, limited opening hours)
2. Places highly sensitive to light (sunrise hikes, pagoda+mountain combos, waterfalls)
3. Popular must-sees
4. Secondary attractions
5. Shopping / convenience stops (can be squeezed in or done on the way)

### Step 5: Drop Locations
Drop a location if:
- It requires a car and user chose public transport only
- Adding it makes the day unrealistic (more than ~7 major stops)
- It is in a remote area that requires >1h detour for a minor attraction
- It overlaps functionally with a higher-rated nearby alternative

Always list dropped locations in the "Locations Dropped" section with the reason.

---

## Multi-City Agent Coordination

When spawning city agents:

**Each city agent must output:**
```json
{
  "city": "Kyoto",
  "base_nights": 6,
  "days": [
    {
      "date": "2026-11-19",
      "theme": "Arashiyama",
      "locations": ["Arashiyama Bamboo Forest", "Tenryu-ji", ...],
      "notes": "..."
    }
  ],
  "transition": {
    "arrives_from": null,
    "departs_to": "Tokyo",
    "suggested_departure": "09:00",
    "suggested_arrival": "11:30",
    "transport": "Nozomi Shinkansen (~2h 20min, ¥14,000)"
  }
}
```

**Coordination rules:**
- City agents negotiate the split of total trip days based on number of attractions per city
- The transition day (travel day) belongs to the *destination* city agent
- The lead agent assembles the final document from each city agent's output

---

## Sunrise/Sunset Lookup

Fetch sunrise/sunset data from timeanddate.com or use web search:
- Query: `"sunrise sunset [city] [month] [year]"`
- For multi-week trips, sample key dates (start, middle, end of each city stay)

Typical Japan late November values (use as fallback):
| City | Sunrise | Sunset |
|------|---------|--------|
| Kyoto | 06:33–06:40 | 16:46–16:49 |
| Tokyo | 06:26–06:33 | 16:27–16:29 |
| Osaka | 06:36–06:43 | 16:48–16:51 |

---

## Transport Notes (Japan)

- IC Card (Suica/ICOCA/Pasmo): works on all metros, JR local, buses
- JR Pass: covers Hikari/Kodama Shinkansen, JR local — NOT Nozomi, Kintetsu, Tobu, private subways
- Nozomi: fastest Shinkansen, not JR Pass, ~¥14,000 Kyoto–Tokyo
- Day trip transport: include one-way time and cost in the notes column
- For public-transport-only trips: flag locations that practically require a car and drop them
