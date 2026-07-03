import fs from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

const baseUrl =
  "https://www.airbnb.com/s/Cluj-County/homes?refinement_paths%5B%5D=%2Fhomes&place_id=ChIJiwtskR8MSUcR6Nk3QsedRkI&location_bb=Qj2FTEHB0bNCOZYxQbUZDQ%3D%3D&acp_id=470d6eef-56ce-4dbb-a3d9-5683724111de&date_picker_type=calendar&search_type=autocomplete_click";

const maxOffset = Number(process.argv[2] ?? 360);
const offsets = [];
for (let offset = 0; offset <= maxOffset; offset += 18) offsets.push(offset);

for (const offset of offsets) {
  const url =
    offset === 0
      ? baseUrl
      : `${baseUrl}&items_offset=${offset}&section_offset=${Math.floor(offset / 18) * 2 + 1}`;
  const output = `/tmp/airbnb-cluj-offset-${offset}.html`;
  try {
    await fs.access(output);
    const stat = await fs.stat(output);
    if (stat.size > 500000) {
      console.log(`skip ${offset} (${stat.size} bytes)`);
      continue;
    }
  } catch {}

  console.log(`fetch ${offset}`);
  await execFile("curl", ["-L", "-s", url, "-o", output], { maxBuffer: 4 * 1024 * 1024 });
  const stat = await fs.stat(output);
  console.log(`saved ${offset} (${stat.size} bytes)`);
}
