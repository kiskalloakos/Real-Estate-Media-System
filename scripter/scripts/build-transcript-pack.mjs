import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceDir = process.argv[2] || "transcripts-medium";
const transcriptDir = path.join(root, sourceDir);
const videoDir = path.join(root, "training-the-ai");
const outDir = path.join(root, "script-workspace");

if (!fs.existsSync(transcriptDir)) {
  throw new Error(`Transcript folder not found: ${transcriptDir}`);
}

fs.mkdirSync(outDir, { recursive: true });

const videoFiles = fs
  .readdirSync(videoDir)
  .filter((file) => file.endsWith(".mp4"))
  .sort();

const readJson = (file) => {
  const jsonPath = path.join(transcriptDir, file.replace(/\.mp4$/, ".json"));
  if (!fs.existsSync(jsonPath)) return null;
  return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
};

const readText = (file) => {
  const txtPath = path.join(transcriptDir, file.replace(/\.mp4$/, ".txt"));
  if (!fs.existsSync(txtPath)) return "";
  return fs.readFileSync(txtPath, "utf8").trim();
};

const durationFromSegments = (json) => {
  const last = json?.segments?.at(-1);
  return last?.end ? Math.round(last.end) : null;
};

const wordCount = (text) => {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
};

const rows = videoFiles.map((video) => {
  const json = readJson(video);
  const text = readText(video);
  return {
    video,
    language: json?.language || "unknown",
    duration_seconds: durationFromSegments(json),
    word_count: wordCount(text),
    transcript_txt: `${sourceDir}/${video.replace(/\.mp4$/, ".txt")}`,
    transcript_json: `${sourceDir}/${video.replace(/\.mp4$/, ".json")}`,
    text,
  };
});

const manifestJson = rows.map(({ text, ...row }) => row);
fs.writeFileSync(
  path.join(outDir, "transcript-manifest.json"),
  `${JSON.stringify(manifestJson, null, 2)}\n`,
);

const manifestMd = [
  "# Transcript Manifest",
  "",
  `Source transcript folder: \`${sourceDir}\``,
  "",
  "| Video | Lang | Seconds | Words | Transcript |",
  "|---|---:|---:|---:|---|",
  ...manifestJson.map((row) =>
    `| ${row.video} | ${row.language} | ${row.duration_seconds ?? ""} | ${row.word_count} | ${row.transcript_txt} |`,
  ),
  "",
].join("\n");

fs.writeFileSync(path.join(outDir, "transcript-manifest.md"), manifestMd);

const corpus = [
  "# Consolidated Training Transcripts",
  "",
  `Built from \`${sourceDir}\`. Keep these as reference, not as final client-facing copy.`,
  "",
  ...rows.flatMap((row, index) => [
    `## ${index + 1}. ${row.video}`,
    "",
    `Language: ${row.language}`,
    `Approx. duration: ${row.duration_seconds ?? "unknown"} seconds`,
    `Words: ${row.word_count}`,
    "",
    row.text || "_No transcript text found._",
    "",
  ]),
].join("\n");

fs.writeFileSync(path.join(outDir, "all-transcripts.md"), corpus);

console.log(`Built ${rows.length} transcript records from ${sourceDir}`);
