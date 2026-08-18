# Cluj Real Estate Agents - Master Prompt

## Objective

Create a one-time, comprehensive lead list of real estate agents who work for real estate agencies in Cluj-Napoca, Romania.

First discover the real estate agencies operating in Cluj-Napoca. Then inspect each agency's official website and include every individual agent, broker, consultant, or real estate advisor publicly listed by that agency with a public phone number.

This is a separate workflow. Do not use, modify, merge with, or inherit the Airbnb/cabin lead-list setup.

## Scope

- Location: Cluj-Napoca, Cluj County, Romania.
- Research real estate agencies serving Cluj-Napoca.
- Prioritize agencies whose official websites have a team, agents, brokers, consultants, or contact-person section.
- The expected useful set may be approximately 5-10 agencies, but do not impose an arbitrary limit. Include every qualifying agency found after a comprehensive search.
- From every qualifying agency, extract all publicly listed agents who have a public phone number.
- This is a one-time research and export task.

## Inclusion Rules

Include a person only when all of the following are true:

1. The person is publicly identified as an individual real estate agent, broker, real estate consultant, property consultant, sales agent, rental agent, or equivalent role.
2. The person is associated with a real estate agency operating in Cluj-Napoca.
3. The agency's official website publicly lists the person.
4. A public phone number can be confidently associated with that individual.

Agency owners or managers may be included only if the official website also presents them as active real estate professionals or client contacts.

## Exclusion Rules

Never include:

- Agencies that do not publicly list individual agents on their official website.
- People found only on third-party directories, social media, scraped databases, or data-broker websites when they are not listed by the agency's official website.
- Generic company reception, office, call-center, or switchboard numbers as an individual agent's phone number.
- Administrative, accounting, legal, marketing, photography, HR, or technical staff unless they are also explicitly presented as real estate agents or consultants.
- Former employees or agents whose association with the agency cannot be confirmed on the current official website.
- Any person without a public phone number.
- Any duplicate person, phone number, or agent profile.

## Research Workflow

1. Search broadly for real estate agencies in Cluj-Napoca using public web search, Google results, maps results, industry directories, and local searches.
2. Build a candidate agency index containing the agency name and official website.
3. Deduplicate agencies by official domain, legal/brand identity, phone number, and close name match.
4. Open each agency's official website.
5. Locate pages such as `Echipa`, `Agenți`, `Consultanți`, `Brokeri`, `Despre noi`, `Contact`, or individual agent profile pages.
6. Extract every qualifying agent and their direct public phone number.
7. Preserve names exactly as published, including Romanian diacritics and original capitalization.
8. Record the most specific official source URL available, preferably the individual agent profile; otherwise use the official team page.
9. Run a final duplicate check across the entire output before exporting it.

## Phone Rules

- A phone number is mandatory. Never add a row without one.
- Prefer the agent's direct mobile number.
- Normalize Romanian mobile numbers to this format: `+40 732 775 601`.
- Convert numbers beginning with `07` to `+40 7...`.
- Do not infer, guess, or manufacture phone numbers.
- If the same phone number appears for multiple people, investigate it. Exclude it when it is a generic agency number rather than a direct personal contact.

## Duplicate Rules

Before adding an agent, compare against every row already collected using:

- Exact normalized phone number.
- Exact official agent-profile URL.
- Normalized full name plus agency.
- Diacritic-insensitive and punctuation-insensitive close-name matching.
- Known shortened names, reordered names, and spelling variants.

When duplicates are found, retain one canonical row with the most specific official source URL.

## Output

Create one CSV file named:

`cluj-real-estate-agents.csv`

Use exactly these columns in this order:

1. `Name`
2. `Judet, Location`
3. `Phone number`
4. `Listing Link`
5. `Website`
6. `TikTok`
7. `Instagram`
8. `Facebook`
9. `Status`
10. `Notes`

The literal CSV header must be exactly:

```csv
Name,"Judet, Location",Phone number,Listing Link,Website,TikTok,Instagram,Facebook,Status,Notes
```

This schema is mandatory because the CSV will be imported into the same system as the Airbnb lead lists. Do not rename, reorder, remove, or add columns.

Requirements:

- One agent per row.
- Every data row must contain exactly ten CSV fields, including empty fields.
- `Name` must contain the agent's name exactly as published by the agency.
- `Judet, Location` must be `Cluj, Cluj-Napoca`.
- `Phone number` must contain the agent's public direct phone number in the required Romanian format.
- `Listing Link` must contain the official agent profile or official agency team page that visibly lists the agent. Use only one link.
- `Website` must contain the agency's official homepage or canonical official domain.
- `TikTok`, `Instagram`, and `Facebook` should contain the agent's professional profile only when it is confidently linked from the official agency website or agent profile. Otherwise leave these fields empty.
- `Status` must always be `Lead`.
- `Notes` must always be empty.
- Do not use `Pending`, `Outreached`, `Follow Up`, `Declined`, `Client`, or any other value for newly scraped rows. Every new row starts as `Lead`.
- Keep empty `TikTok`, `Instagram`, `Facebook`, and `Notes` cells as empty CSV fields; do not omit their columns and do not write placeholders such as `N/A`, `None`, or `Unknown`.
- Do not add agency, role, email, confidence, or any other columns.
- Do not produce a master workbook or multiple batch files. Produce only the final one-time CSV.

## Verification

Before delivering the CSV, verify and report:

- Number of qualifying agencies included.
- Number of agents included.
- Every row has a public direct phone number.
- Every row is supported by an official agency website.
- No duplicate phone numbers, agent profiles, or name-and-agency combinations remain.
- Phone formatting is consistent.
- Every row has `Judet, Location = Cluj, Cluj-Napoca`.
- Every row has `Status = Lead` and an empty `Notes` field.
- The CSV contains exactly the ten required Airbnb-import columns in the required order.

## Execution Instruction

Perform the complete research, extraction, deduplication, CSV creation, and verification in this task. Do not stop after presenting a plan or a sample. Continue until all discoverable qualifying Cluj-Napoca agencies and all publicly listed agents with direct phone numbers have been processed.
