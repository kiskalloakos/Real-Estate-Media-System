import { corsHeaders, json } from '../_shared/cors.ts';
import {
  CABANA_SCRIPTING_SYSTEM_PROMPT,
  CABANA_SCRIPTING_USER_INSTRUCTIONS,
} from '../_shared/cabana-scripting.ts';
import {
  authenticatedUser,
  FunctionHttpError,
  requireAgencyAdmin,
  serviceClient,
} from '../_shared/supabase.ts';

type CabanaScriptBrief = {
  amenities?: string;
  avoid?: string;
  bookingCta?: string;
  clientAccountId?: string;
  contentTemplate?: 'property_showcase' | 'personal_brand' | 'service_explainer' | 'testimonial' | 'campaign_offer';
  location?: string;
  mustMention?: string;
  name?: string;
  propertyId?: string;
  targetGuest?: string;
  tone?: string;
  generationMode?: 'new' | 'more';
  variationIndex?: number;
};

type ApprovedScriptMemory = {
  existingCount: number;
  scripts: {
    hooks: string[];
    scriptExcerpt: string;
    status: string;
    title: string;
  }[];
  usedBriefTerms: string[];
};

const ANGLE_LIBRARY = [
  { label: 'family freedom and indoor/outdoor play', terms: ['copii', 'famil', 'joacă', 'joaca'] },
  { label: 'game night and small details', terms: ['biliard', 'ping pong', 'joc'] },
  { label: 'cooking and gathering', terms: ['bucătă', 'bucata', 'cuptor', 'masă', 'masa', 'găt', 'gatit'] },
  { label: 'guided ATV adventure', terms: ['atv', 'trase'] },
  { label: 'group logistics and private bathrooms', terms: ['baie proprie', 'baia ei', 'doisprezece', '12 oameni'] },
  { label: 'fireplace and indoor comfort', terms: ['șemineu', 'semineu', 'living'] },
  { label: 'fire, evening and shared stories', terms: ['foc de tabără', 'foc de tabara', 'balansoar', 'povești', 'povesti'] },
  { label: 'morning ritual and mountain atmosphere', terms: ['diminea', 'cafea', 'ceață', 'ceata', 'liniște', 'liniste'] },
  { label: 'design and classification', terms: ['margarete', 'design', 'rustic', 'modern'] },
  { label: 'location and nearby discovery', terms: ['cluj', 'beliș', 'belis', 'mărișel', 'marisel', 'apusen'] },
  { label: 'capacity and flexible booking', terms: ['discount', 'capac', 'grup'] },
];

const toneLabels: Record<string, string> = {
  calm_cinematic: 'calm cinematic',
  warm_family: 'warm family',
  premium: 'premium',
  playful: 'playful',
  direct_sales: 'direct sales',
};

const templateLabels: Record<string, string> = {
  campaign_offer: 'campaign offer',
  personal_brand: 'personal brand',
  property_showcase: 'property showcase',
  service_explainer: 'service explainer',
  testimonial: 'testimonial',
};

const GENERIC_SCRIPTING_SYSTEM_PROMPT = `You are a senior Romanian social-media copywriter for service businesses and agencies. Write a single natural Romanian short-form video script. Use concrete facts from the brief, avoid invented claims, keep the first line strong, and make the requested call to action clear. Return only the requested structured result.`;

const MAX_REQUEST_BYTES = 24 * 1024;
const MAX_GENERATIONS_PER_MINUTE = 5;
const generationWindows = new Map<string, { count: number; startedAt: number }>();
const contentTemplates = new Set<CabanaScriptBrief['contentTemplate']>([
  'property_showcase',
  'personal_brand',
  'service_explainer',
  'testimonial',
  'campaign_offer',
]);
const tones = new Set(['calm_cinematic', 'warm_family', 'premium', 'playful', 'direct_sales']);

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function required(value: unknown, message: string) {
  const cleaned = clean(value);
  if (!cleaned) throw new FunctionHttpError(400, message);
  return cleaned;
}

function boundedString(value: unknown, field: string, maximum: number) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new FunctionHttpError(400, `${field} must be text.`);
  }
  const cleaned = value.trim();
  if (cleaned.length > maximum) {
    throw new FunctionHttpError(400, `${field} must be ${maximum} characters or fewer.`);
  }
  return cleaned;
}

function optionalIdentifier(value: unknown, field: string) {
  return boundedString(value, field, 128) || undefined;
}

function parseBrief(value: unknown): CabanaScriptBrief {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new FunctionHttpError(400, 'Campaign brief is required.');
  }
  const raw = value as Record<string, unknown>;
  const contentTemplate = raw.contentTemplate === undefined
    ? undefined
    : boundedString(raw.contentTemplate, 'Script template', 40) as CabanaScriptBrief['contentTemplate'];
  if (contentTemplate && !contentTemplates.has(contentTemplate)) {
    throw new FunctionHttpError(400, 'Choose a valid script template.');
  }
  const tone = boundedString(raw.tone, 'Tone', 40);
  if (!tones.has(tone)) {
    throw new FunctionHttpError(400, 'Choose a valid tone.');
  }
  const generationMode = raw.generationMode === undefined
    ? undefined
    : boundedString(raw.generationMode, 'Generation mode', 12) as CabanaScriptBrief['generationMode'];
  if (generationMode && generationMode !== 'new' && generationMode !== 'more') {
    throw new FunctionHttpError(400, 'Choose a valid generation mode.');
  }
  const variationIndex = raw.variationIndex === undefined ? undefined : raw.variationIndex;
  if (variationIndex !== undefined && (
    typeof variationIndex !== 'number'
    || !Number.isInteger(variationIndex)
    || variationIndex < 0
    || variationIndex > 100
  )) {
    throw new FunctionHttpError(400, 'Variation index must be a whole number between 0 and 100.');
  }

  return {
    amenities: boundedString(raw.amenities, 'Proof points', 4_000),
    avoid: boundedString(raw.avoid, 'Avoid instructions', 1_000),
    bookingCta: boundedString(raw.bookingCta, 'Call to action', 500),
    clientAccountId: optionalIdentifier(raw.clientAccountId, 'Client account ID'),
    contentTemplate,
    generationMode,
    location: boundedString(raw.location, 'Location', 300),
    mustMention: boundedString(raw.mustMention, 'Must-mention facts', 1_000),
    name: boundedString(raw.name, 'Brand or property name', 300),
    propertyId: optionalIdentifier(raw.propertyId, 'Property ID'),
    targetGuest: boundedString(raw.targetGuest, 'Audience', 500),
    tone,
    variationIndex: variationIndex as number | undefined,
  };
}

function enforceGenerationRateLimit(key: string) {
  const now = Date.now();
  const current = generationWindows.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    generationWindows.set(key, { count: 1, startedAt: now });
    return;
  }
  if (current.count >= MAX_GENERATIONS_PER_MINUTE) {
    throw new FunctionHttpError(429, 'Please wait a minute before generating more scripts.');
  }
  current.count += 1;
}

function termsFromBrief(brief: CabanaScriptBrief) {
  const text = [
    brief.amenities,
    brief.targetGuest,
    brief.mustMention,
  ].map(clean).filter(Boolean).join('\n');

  return Array.from(new Set(
    text
      .split(/[\n,;•|/]+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 3 && item.length <= 48),
  )).slice(0, 80);
}

function memoryToPrompt(memory: ApprovedScriptMemory) {
  if (!memory.existingCount) {
    return 'Existing scripts for this property/client: none.';
  }

  const existingText = memory.scripts.map((script) => script.scriptExcerpt.toLowerCase()).join('\n');
  const usedAngles = ANGLE_LIBRARY
    .filter((angle) => angle.terms.some((term) => existingText.includes(term)))
    .map((angle) => angle.label);
  const unusedAngles = ANGLE_LIBRARY
    .filter((angle) => !usedAngles.includes(angle.label))
    .map((angle) => angle.label);

  return `
Existing scripts for this property/client:
- Existing script count: ${memory.existingCount}
- Brief terms already used in existing scripts: ${memory.usedBriefTerms.length ? memory.usedBriefTerms.join(', ') : 'not enough overlap detected'}
- Creative angles already used: ${usedAngles.length ? usedAngles.join('; ') : 'none detected'}
- Creative angles still available: ${unusedAngles.length ? unusedAngles.join('; ') : 'invent a genuinely new angle from the property brief'}

Existing script memory:
${memory.scripts.map((script, index) => `
Existing script ${index + 1} (${script.status}): ${script.title}
Hooks already used:
${script.hooks.length ? script.hooks.map((hook) => `- ${hook}`).join('\n') : '- none'}
Script excerpt:
${script.scriptExcerpt}
`).join('\n')}

Anti-repetition rule:
- Do not reuse the same hook angle, first sentence, first visual, or title pattern.
- Do not lead with the already-used brief terms if another strong amenity or surrounding detail exists.
- Do not repeat the same opening sentence shape.
- If existing scripts focused on altitude, jacuzzi, capacity, groups, terrace, or foișor, choose a different lead angle: kids/play area, ATV routes, Beliș/Mărișel proximity, fireplace/living, kitchen/dinner, fire pit/balansoare, morning coffee, privacy/forest curtain, 3-margarete comfort, or summer coolness without repeating altitude.
- For hooks, avoid any wording that starts like an existing hook. If existing hooks start with "La 1200..." or "Sus...", do not start with altitude again.
- Use a different first 6 words than every existing script.
- Keep the facts from the brief, but choose a noticeably different angle.
`;
}

function briefToPrompt(brief: CabanaScriptBrief, memory: ApprovedScriptMemory) {
  const tone = (toneLabels[clean(brief.tone)] ?? clean(brief.tone)) || 'calm cinematic';

  return `
${CABANA_SCRIPTING_USER_INSTRUCTIONS}

${memoryToPrompt(memory)}

Generation mode:
- ${brief.generationMode === 'more' ? `This is an additional script, variation ${Number(brief.variationIndex ?? 0) + 1}. It must be clearly different from every existing script above.` : 'This is the first script request. Establish one strong angle without trying to cover the whole property.'}
- Choose one unused creative angle before writing. Do not mention the angle name in the output.

Campaign brief:
- Brand, business or property: ${required(brief.name, 'A brand, business, or property name is required.')}
- Template: ${templateLabels[clean(brief.contentTemplate)] ?? 'property showcase'}
- Location: ${required(brief.location, 'Location is required.')}
- Offer, proof points, or visual assets: ${required(brief.amenities, 'Add a few proof points or visual assets.')}
- Audience: ${clean(brief.targetGuest) || 'general audience'}
- Call to action: ${required(brief.bookingCta, 'A call to action is required.')}
- Tone preference: ${tone}
- Must-mention facts: ${clean(brief.mustMention) || 'none'}
- Avoid: ${clean(brief.avoid) || 'none'}
`;
}

function responseSchema() {
  return {
    name: 'cabana_script_generation',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        model: { type: 'string' },
        script: {
          type: 'object',
          additionalProperties: false,
          properties: {
            hooks: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 1,
            },
            id: { type: 'string' },
            title: { type: 'string' },
            script: { type: 'string' },
          },
          required: ['hooks', 'id', 'title', 'script'],
        },
      },
      required: ['model', 'script'],
    },
    strict: true,
  };
}

async function previousApprovedScriptsForBrief(
  client: ReturnType<typeof serviceClient>,
  agencyId: string,
  brief: CabanaScriptBrief,
): Promise<ApprovedScriptMemory> {
  const propertyId = clean(brief.propertyId);
  const clientAccountId = clean(brief.clientAccountId);
  if (!propertyId && !clientAccountId) return { existingCount: 0, scripts: [], usedBriefTerms: [] };

  let query = client
    .from('cabana_scripts')
    .select('title, hooks, script, status')
    .eq('agency_id', agencyId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(20);

  query = propertyId
    ? query.eq('property_id', propertyId)
    : query.eq('client_account_id', clientAccountId);

  const { data, error } = await query;
  if (error) {
    console.error('Could not load existing scripts', error);
    throw new FunctionHttpError(500, 'Could not load existing scripts. Please try again.');
  }

  const previousText = (data ?? [])
    .map((script) => typeof script.script === 'string' ? script.script.toLowerCase() : '')
    .join('\n');
  const usedBriefTerms = termsFromBrief(brief)
    .filter((term) => previousText.includes(term.toLowerCase()))
    .slice(0, 20);

  return {
    existingCount: data?.length ?? 0,
    scripts: (data ?? []).map((script) => ({
      hooks: Array.isArray(script.hooks)
        ? script.hooks.filter((hook): hook is string => typeof hook === 'string').slice(0, 3)
        : [],
      scriptExcerpt: typeof script.script === 'string' ? script.script.slice(0, 900) : '',
      status: typeof script.status === 'string' ? script.status : 'draft',
      title: typeof script.title === 'string' ? script.title : 'Existing script',
    })).filter((script) => script.scriptExcerpt.trim()).slice(0, 15),
    usedBriefTerms,
  };
}

async function generateScripts(brief: CabanaScriptBrief, memory: ApprovedScriptMemory) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new FunctionHttpError(500, 'ANTHROPIC_API_KEY is not configured for script generation.');
  }

  const model = Deno.env.get('ANTHROPIC_SCRIPTING_MODEL') || 'claude-sonnet-5';
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system: brief.contentTemplate && brief.contentTemplate !== 'property_showcase'
        ? GENERIC_SCRIPTING_SYSTEM_PROMPT
        : CABANA_SCRIPTING_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: briefToPrompt(brief, memory) }],
      model,
      max_tokens: 1000,
      tools: [{
        name: responseSchema().name,
        description: 'Return the generated hooks and Romanian script in the requested schema.',
        input_schema: responseSchema().schema,
      }],
      tool_choice: { type: 'tool', name: responseSchema().name },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    console.error('Anthropic script generation failed', { status: response.status, payload });
    throw new FunctionHttpError(
      502,
      'Script generation is temporarily unavailable. Please try again.',
    );
  }

  const toolUse = payload.content?.find((item: { type?: string }) => item.type === 'tool_use');
  const parsed = toolUse?.input;
  if (!parsed) {
    throw new FunctionHttpError(500, 'Claude returned an empty script response.');
  }

  return {
    ...parsed,
    model,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return json(request, { error: 'Method not allowed.' }, 405);
  }

  try {
    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      throw new FunctionHttpError(413, 'Campaign brief is too large.');
    }
    const client = serviceClient();
    const user = await authenticatedUser(request, client);
    const body = await request.json() as { brief?: unknown };
    const brief = parseBrief(body.brief);
    const { agencyId } = await requireAgencyAdmin(client, user.id);
    enforceGenerationRateLimit(`${agencyId}:${user.id}`);
    const previousApprovedScripts = await previousApprovedScriptsForBrief(client, agencyId, brief);
    return json(request, await generateScripts(brief, previousApprovedScripts));
  } catch (error) {
    if (!(error instanceof FunctionHttpError)) {
      console.error('Campaign script generation failed', error);
    }
    const message = error instanceof FunctionHttpError
      ? error.message
      : 'Campaign script generation failed. Please try again.';
    const status = error instanceof FunctionHttpError ? error.status : 500;
    return json(request, { error: message }, status);
  }
});
