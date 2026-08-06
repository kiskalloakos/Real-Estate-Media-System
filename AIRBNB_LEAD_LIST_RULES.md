# Airbnb Lead List Master Rules

## Source Of Truth

- All active lead-list files live in `lead-lists/`.
- The current master list is `lead-lists/Aribnb Lead List.numbers`.
- The current latest new-leads batch is `lead-lists/new-airbnb-cabana-leads-20260803.csv`.
- Treat the master file and every CSV in `lead-lists/` as the required source set for deduplication before any future extraction.
- Do not use older `.xlsx`, CSV, script output, preview, or prior batch files as the source of truth unless the user explicitly promotes them into `lead-lists/`.
- Default saved Airbnb seed link for future Cluj County pulls: `https://www.airbnb.com/s/Cluj-County/homes?refinement_paths%5B%5D=%2Fhomes&date_picker_type=calendar&place_id=ChIJiwtskR8MSUcR6Nk3QsedRkI&acp_id=470d6eef-56ce-4dbb-a3d9-5683724111de&search_type=filter_change&query=Cluj%20County&flexible_trip_lengths%5B%5D=one_week&monthly_start_date=2026-08-01&monthly_length=3&monthly_end_date=2026-11-01&search_mode=regular_search&price_filter_input_type=2&channel=EXPLORE&selected_filter_order%5B%5D=room_types%3AEntire%20home%2Fapt&selected_filter_order%5B%5D=l2_property_type_ids%3A1&selected_filter_order%5B%5D=l2_property_type_ids%3A2&selected_filter_order%5B%5D=l2_property_type_ids%3A3&update_selected_filters=false&l2_property_type_ids%5B%5D=1&l2_property_type_ids%5B%5D=2&l2_property_type_ids%5B%5D=3`

## Preflight SOP For Every New Batch

- Before researching or outputting any new list, inspect `lead-lists/`.
- Deduplicate against `lead-lists/Aribnb Lead List.numbers` and every CSV in `lead-lists/`.
- Check duplicate listing links, phone numbers, close name/property matches, and same-location name variants.
- Output only brand-new leads that are not present in the master list or any existing `lead-lists/` CSV.
- After dedupe and before delivery, run an enrichment pass for each surviving lead: property/operator website, TikTok first, Instagram, then Facebook.
- Only fill enrichment fields from property-owned or clearly property/operator-owned sources. Do not copy generic directory/platform socials as if they belonged to the property.
- Leave enrichment fields blank when the match is not confident.
- Save the new CSV into `lead-lists/` so it becomes part of the next duplicate check.
- If a batch is superseded, keep only the user-approved active version in `lead-lists/`.

## Lead Type Rules

- Only Airbnb-style cabin leads are allowed.
- Include standalone/private stays such as cabana, cabin, chalet, cottage, house, villa, A-frame, tiny house, lodge, retreat, dome, or similar weekend-style properties.
- Never add restaurants.
- Never add pensions/pensiuni/agropensiuni.
- Never add generic hotels, SPA resorts, restaurant complexes, shared rooms, city apartments, normal flats, or anything that is not clearly a standalone/private stay.
- If the property cannot be viewed as an Airbnb, Booking, or Wel.ro listing, do not add it.

## Required Fields

- `Name`
- `Judet, Location`
- `Phone number`
- `Listing Link`
- `Website`
- `TikTok`
- `Instagram`
- `Facebook`
- `Status`
- `Notes`

## Notes Rule

- Always leave `Notes` empty for every lead pull.
- Do not add source text, research comments, phone-source explanations, outreach context, or any other content to `Notes`.
- Keep the `Notes` column only because it is part of the template.

## Location Rules

- Keep location only once.
- Use one column named `Judet, Location`.
- Format should be simple, for example: `Cluj, Beliș`.
- Do not duplicate location across multiple columns.
- Do not include precise street addresses unless explicitly requested.

## Link Rules

- `Listing Link` must be exactly one listing URL.
- Allowed listing domains only:
  - Airbnb
  - Booking
  - Wel.ro
- Never use Google, Facebook, Instagram, official websites, directories, tourism portals, map pages, or article pages as the listing link.
- Official website and social links are allowed only in their own columns.

## Phone Rule

- If there is no public phone number, do not add the lead ever.
- Format Romanian numbers like `+40 732 775 601`.

## Status Rules

- Allowed statuses:
  - `Lead`
  - `Follow Up`
  - `Declined`
  - `Client`
- `Outreached` is a forbidden legacy status. Do not create it, keep it, map to it, or use it in dropdowns/CSV values.

## Deduplication Rules

- Before adding any row, check the current master list.
- Never duplicate by listing link.
- Never duplicate by phone number.
- Never duplicate by close property/name match in the same or nearby location.
- Always run fuzzy duplicate checks for compact names, spacing differences, spelling variants, and known typo variants. Example: `MonteRosso`, `MONTE ROSSO`, and `Monte Rosso` are the same lead; `Gray Aframe`, `Grey Aframe`, and `Gery Aframe` are the same lead.
- Apple Numbers extraction can expose only partial master fragments. If the master contains a strong name fragment or phone-tail fragment for the same property, treat it as a duplicate and exclude it.
- Never repeat the same researched area unless explicitly asked.
- New batch files must contain only the brand-new leads from that batch, not the whole master list.

## Research Completion Reality

- The full Cluj County Airbnb universe has not been completed yet.
- Treat future extraction as incremental, area by area, with strict dedupe against the master list.
