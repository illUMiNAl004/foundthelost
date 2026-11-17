// Snap & Fill — the vision core. Runs SERVER-SIDE only (Netlify Function in prod, a
// Vite dev middleware locally) so API keys never reach the browser.
//
// Provider: open-weights Gemma 4 (multimodal) via OpenRouter, or via Google AI Studio
// (Gemini API) when only GEMINI_API_KEY is set. Both return the same normalized shape.
//
// The model is constrained to the app's OWN vocabulary (src/data/dictionary.js) so its
// answer plugs straight into the parser + matching engine — no new taxonomy to maintain.
import { ITEMS, COLORS, MATERIALS, BRANDS } from '../../../src/data/dictionary.js'

export const DEFAULT_OPENROUTER_MODEL = 'google/gemma-4-31b-it'
// $0 tier on OpenRouter (rate-limited: ~50 req/day without credits). Used automatically when
// the paid model answers 402, or always when VISION_MODEL points at it.
export const FREE_OPENROUTER_MODEL = 'google/gemma-4-26b-a4b-it:free'
// Gemini API (Google AI Studio) ids. Measured Nov 2, 2026 with a real key:
//   gemma-4-26b-a4b-it  — now IGNORES thinkingLevel=minimal on IMAGE inputs: ~1,500 chars of
//                         unflagged reasoning first, hits MAX_TOKENS / the time budget → unusable.
//   gemma-4-31b-it      — clean JSON, ~30s per photo. Open weights → the default.
//   gemini-3.5-flash-lite — clean JSON in ~1.6s on the same free key. The fallback when Gemma is
//                         too slow for the budget; set VISION_MODEL to it for a live demo.
export const DEFAULT_GEMINI_MODEL = 'gemma-4-31b-it'
export const GEMINI_MODELS = ['gemma-4-31b-it', 'gemini-3.5-flash-lite']
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024 // post-compression; client sends ≤ ~1MB
// Netlify sync functions are cut off around 10s. One model call gets 8s; a retry/rotation
// only happens if there's still time in the overall budget.
export const CALL_TIMEOUT_MS = 8000
export const TOTAL_BUDGET_MS = 9500
// Vite dev has no function timeout → vite.config.js passes VISION_BUDGET_MS=25000 so a slow
// model answer still lands locally; production keeps the Netlify-safe defaults.
const budgetOf = (env) => Math.max(3000, Number(env.VISION_BUDGET_MS) || TOTAL_BUDGET_MS)
const callTimeoutOf = (env) => Math.min(budgetOf(env), Math.max(CALL_TIMEOUT_MS, Number(env.VISION_BUDGET_MS) ? Number(env.VISION_BUDGET_MS) - 1500 : CALL_TIMEOUT_MS))

const ITEM_IDS = ITEMS.map((i) => i.id)
const COLOR_IDS = COLORS.map((c) => c.id)
const MATERIAL_IDS = MATERIALS.map((m) => m.id)
const BRAND_IDS = BRANDS.map((b) => b.id)
const CATEGORIES = ['electronics', 'wallets', 'keys', 'bottles', 'clothing', 'other']

const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]))
const BRAND_BY_ID = Object.fromEntries(BRANDS.map((b) => [b.id, b]))

// One line per item so the model sees the canonical id AND what it means.
const ITEM_GUIDE = ITEMS.map((i) => `${i.id} = ${i.label} (${i.aliases.slice(0, 4).join(', ')})`).join('\n')

export const SYSTEM_PROMPT = `You are the photo-understanding step of a campus lost & found app.
A student just found an object and photographed it. Identify the object precisely so it can be
matched against lost reports. Answer with ONE JSON object and nothing else — no prose, no markdown.

Schema (every key required; use null when unknown, never guess):
{
  "item_id": one of [${ITEM_IDS.join(', ')}] or null if the object isn't any of these,
  "item_label": short human name, e.g. "AirPods Pro", "Hydro Flask", "TI-84 calculator",
  "category": one of [${CATEGORIES.join(', ')}],
  "colors": array (dominant first, max 2) from [${COLOR_IDS.join(', ')}],
  "brand_id": one of [${BRAND_IDS.join(', ')}] or null,
  "brand_text": brand/model exactly as visible or clearly recognizable, or null,
  "material_id": one of [${MATERIAL_IDS.join(', ')}] or null,
  "distinctive": 1 short phrase of unique identifying marks (stickers, scratches, engravings, charms, case colour), or null,
  "visible_text": any legible text/names/initials on the object, or null,
  "identifier": for a bank/credit/debit card, the LAST 4 digits of the card number if legible (digits only, e.g. "4821"); for a student ID / UCard, the 8-digit SPIRE ID if legible; otherwise null,
  "sensitive": true if it is an ID card, bank/credit card, passport, license, keys, or shows a person's name/face,
  "confidence": number 0–1, how sure you are about item_id,
  "caption": one natural sentence a student would text to describe it (colour + brand + item + distinguishing mark).
}

Item vocabulary:
${ITEM_GUIDE}

Rules:
- earbuds (AirPods, in-ear) and headphones (over-ear) are DIFFERENT — never confuse them.
- An AirPods case with no earbuds visible is still "earbuds" unless it is clearly empty → "airpods_case".
- A student ID / UCard / driver's license → item_id "ucard", sensitive true.
- Do NOT transcribe full card numbers, ID numbers or full names into visible_text, distinctive or caption — write "has a name" or "has a card number" instead. The only digits you may return are the "identifier" field (last 4 of a card, or an 8-digit SPIRE ID).
- If several objects are visible, describe the most prominent found object, not the surface or hand holding it.
- If you truly cannot tell what it is, item_id null, confidence ≤ 0.3, and still write the best caption you can.`

const USER_PROMPT = 'Identify this found object. Respond with the JSON object only.'

/* ------------------------------------------------------------------ */
/* providers                                                            */
/* ------------------------------------------------------------------ */

async function callOpenRouter({ base64, mime, env, model }) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': env.URL || env.DEPLOY_PRIME_URL || 'https://foundthelost.app',
      'X-Title': 'foundthelost',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 1500, // headroom: the answer is ~150 tokens, but a stray thought burst must not truncate it
      // Gemma 4 thinks by default (600–1000 tokens, +15–20s). Identification doesn't need it.
      reasoning: { effort: 'none' },
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: USER_PROMPT },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(callTimeoutOf(env)),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw providerError('openrouter', res.status, json?.error?.message || JSON.stringify(json).slice(0, 300))
  const text = json?.choices?.[0]?.message?.content
  if (!text) throw providerError('openrouter', 502, json?.error?.message || 'empty completion')
  return { text, usage: json.usage, model: json.model || model }
}

// The two $0 Gemma 4 endpoints on OpenRouter. Free pools get congested (429 "Provider
// returned error"), so we rotate between them with one short retry each.
export const FREE_OPENROUTER_MODELS = ['google/gemma-4-26b-a4b-it:free', 'google/gemma-4-31b-it:free']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// paid model out of credits (402) → free tier; free tier busy (429/5xx) → rotate + retry
async function callOpenRouterWithFallback(args) {
  const started = Date.now()
  const timeLeft = () => budgetOf(args.env) - (Date.now() - started)
  const isFree = (m) => m.endsWith(':free')
  const plan = isFree(args.model)
    ? [args.model, ...FREE_OPENROUTER_MODELS.filter((m) => m !== args.model)]
    : [args.model]
  let lastErr
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const model of plan) {
      if (timeLeft() < 2500) break
      try {
        return await callOpenRouter({ ...args, model })
      } catch (e) {
        lastErr = normalizeAbort(e, 'openrouter')
        if (e.upstream === 402 && !isFree(model)) { // out of credits → switch plan to the free pool
          console.warn('[vision] openrouter 402 on', model, '→ free tier')
          plan.splice(0, plan.length, ...FREE_OPENROUTER_MODELS)
          break
        }
        if (e.upstream !== 429 && !(e.upstream >= 500)) throw e // real error (bad key, bad request…)
        console.warn(`[vision] ${model} busy (${e.upstream}), trying next`)
      }
    }
    if (attempt === 0) await sleep(1500)
  }
  if (lastErr?.upstream === 429) lastErr.message = 'The free photo-AI tier is busy right now — try again in a few seconds'
  throw lastErr
}

async function callGemini({ base64, mime, env, model }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: USER_PROMPT }, { inline_data: { mime_type: mime, data: base64 } }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1500,
        responseMimeType: 'application/json',
        // Gemma 4 thinks for 600–1000 tokens (+15–20s) unless told not to. Gemini ids don't need
        // (and may reject) the knob for a plain identification call, so it's only sent to Gemma.
        ...(model.startsWith('gemma') ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {}),
      },
    }),
    signal: AbortSignal.timeout(callTimeoutOf(env)),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw providerError('gemini', res.status, json?.error?.message || JSON.stringify(json).slice(0, 300))
  // Gemma 4 "thinks" first; those parts come back flagged thought:true — the answer is the rest
  const parts = (json?.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought)
  const text = parts.map((p) => p.text || '').join('')
  if (!text) throw providerError('gemini', 502, json?.candidates?.[0]?.finishReason || 'empty completion')
  return { text, usage: json.usageMetadata, model }
}

// same rotation idea as OpenRouter: on 429/5xx try the other Gemma id once, with a short retry
async function callGeminiWithFallback(args) {
  const started = Date.now()
  const timeLeft = () => budgetOf(args.env) - (Date.now() - started)
  const plan = [args.model, ...GEMINI_MODELS.filter((m) => m !== args.model)]
  let lastErr
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const model of plan) {
      if (timeLeft() < 2500) break
      try {
        return await callGemini({ ...args, model })
      } catch (e) {
        lastErr = normalizeAbort(e, 'gemini')
        // 404 = Google retired that model id (they rotate often) → just try the next one
        if (![404, 429, 504].includes(lastErr.upstream) && !(lastErr.upstream >= 500)) throw e
        console.warn(`[vision] gemini ${model} failed (${lastErr.upstream}), trying next`)
      }
    }
    if (attempt === 0) await sleep(1200)
  }
  if (lastErr?.upstream === 429) lastErr.message = 'Photo AI is rate-limited right now — try again in a few seconds'
  throw lastErr
}

// fetch's AbortSignal.timeout rejects with TimeoutError → treat as a 504 from that provider
function normalizeAbort(e, provider) {
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
    const err = providerError(provider, 504, 'model took too long')
    err.message = 'Photo AI took too long — try again, or type it out'
    return err
  }
  return e
}

function providerError(provider, status, message) {
  const e = new Error(`${provider}: ${message}`)
  e.upstream = status
  // upstream 4xx is OUR misconfig → 502; keep 429 (rate limit) so the UI can say "try again"
  e.status = status >= 400 && status < 500 && status !== 429 ? 502 : status
  e.provider = provider
  return e
}

/* ------------------------------------------------------------------ */
/* normalization — never trust the model's enums                       */
/* ------------------------------------------------------------------ */

function parseJson(text) {
  const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try { return JSON.parse(cleaned) } catch { /* fall through */ }
  const m = cleaned.match(/\{[\s\S]*\}/) // model wrapped the object in chatter
  if (m) { try { return JSON.parse(m[0]) } catch { /* fall through */ } }
  throw Object.assign(new Error('model did not return JSON'), { status: 502 })
}

const inSet = (v, set) => (typeof v === 'string' && set.includes(v.toLowerCase()) ? v.toLowerCase() : null)
const str = (v, max = 160) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const clamp01 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5)

export function normalize(raw) {
  const itemId = inSet(raw.item_id, ITEM_IDS)
  const item = itemId ? ITEM_BY_ID[itemId] : null
  const colors = Array.isArray(raw.colors) ? raw.colors.map((c) => inSet(c, COLOR_IDS)).filter(Boolean).slice(0, 2) : []
  const brandId = inSet(raw.brand_id, BRAND_IDS)
  const materialId = inSet(raw.material_id, MATERIAL_IDS)
  const sensitiveById = itemId === 'ucard' || itemId === 'card' || itemId === 'keys'
  // the owner-check identifier the photo shows: last 4 of a card, or an 8-digit SPIRE ID. Never a full number.
  const digits = String(raw.identifier ?? '').replace(/\D/g, '')
  const identifier = itemId === 'card' && digits.length >= 4 ? digits.slice(-4) : itemId === 'ucard' && digits.length === 8 ? digits : null
  // belt and braces: no long digit runs anywhere else (card numbers, IDs)
  const scrub = (v) => (typeof v === 'string' ? v.replace(/(?:\d[ -]?){8,}/g, '').replace(/\s{2,}/g, ' ').trim() : v)
  return {
    identifier,
    itemId,
    itemLabel: str(raw.item_label, 60) || item?.label || null,
    category: item?.category || inSet(raw.category, CATEGORIES) || 'other',
    emoji: item?.emoji || '🧸',
    colors,
    brandId,
    brandLabel: brandId ? BRAND_BY_ID[brandId].label : null,
    brandText: str(raw.brand_text, 60),
    materialId,
    distinctive: str(scrub(raw.distinctive), 140),
    visibleText: str(scrub(raw.visible_text), 80),
    sensitive: raw.sensitive === true || sensitiveById,
    confidence: clamp01(raw.confidence),
    caption: str(scrub(raw.caption), 240),
  }
}

// Turn the structured answer into the sentence a student would have typed. The client
// feeds this to parseDescription() so photo reports get the SAME chips, highlights,
// title and matching features as typed ones.
export function toDescription(n) {
  const colorWord = (id) => COLORS.find((c) => c.id === id)?.label.toLowerCase()
  const materialWord = (id) => MATERIALS.find((m) => m.id === id)?.aliases?.[0]
  const brandWord = n.brandId ? BRAND_BY_ID[n.brandId]?.aliases?.[0] : null
  // the item word the model itself used, if it's one of that item's aliases ("pen" for a pen,
  // not the canonical's first alias) — otherwise the first alias
  const said = `${n.itemLabel || ''} ${n.caption || ''}`.toLowerCase()
  const aliases = n.itemId ? ITEM_BY_ID[n.itemId]?.aliases || [] : []
  const itemWord = n.itemId
    ? [...aliases].sort((a, b) => b.length - a.length).find((a) => new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(said)) || aliases[0]
    : (n.itemLabel || '').toLowerCase()
  let bits = [n.colors.map(colorWord).filter(Boolean).join(' and '), brandWord, materialWord(n.materialId), itemWord]
    .filter(Boolean)
  // the model's own brand/model text when we have no canonical brand (e.g. "Owala FreeSip") —
  // but not long strings like "Soka University of America" (that's visible text, kept below)
  const brandText = n.brandText && n.brandText.split(/\s+/).length <= 2 && !(n.visibleText || '').toLowerCase().includes(n.brandText.toLowerCase()) ? n.brandText : null
  if (!brandWord && brandText && !bits.join(' ').toLowerCase().includes(brandText.toLowerCase())) bits.splice(1, 0, brandText)
  // drop repeats ("hydro flask … hydro flask", "rubber rubber duck") — keep the LAST occurrence so the item word survives
  bits = bits.filter((b, i) => !bits.slice(i + 1).some((later) => later.toLowerCase().includes(b.toLowerCase())))
  let s = bits.join(' ').trim()
  // nothing identifiable (no item word at all) → the model's own sentence beats a lone colour ("Brown")
  if (!n.itemId && !n.itemLabel) s = n.caption || s || 'unidentified item'
  if (!s) s = n.caption || 'unidentified item'
  // distinctive marks add information only if they say something the sentence doesn't already
  if (n.distinctive) {
    const said = new Set(s.toLowerCase().split(/\W+/))
    const fresh = n.distinctive.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && !said.has(w))
    if (fresh.length) s += `, ${n.distinctive.replace(/\.$/, '')}`
  }
  if (n.visibleText) {
    // only add text the sentence doesn't already carry (word-wise, so "UMASS Hydro Flask" after
    // "hydro flask … UMASS" adds nothing)
    const have = new Set(s.toLowerCase().split(/\W+/))
    const fresh = n.visibleText.split(/\W+/).filter((w) => w && !have.has(w.toLowerCase()))
    if (fresh.length) s += ` (text: ${n.visibleText})`
  }
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/* ------------------------------------------------------------------ */
/* entry                                                                */
/* ------------------------------------------------------------------ */

// VISION_PROVIDER=openrouter|gemini forces one; otherwise OpenRouter wins when both keys exist.
export function providerFor(env) {
  const forced = (env.VISION_PROVIDER || '').toLowerCase()
  if (forced === 'gemini' && env.GEMINI_API_KEY) return 'gemini'
  if (forced === 'openrouter' && env.OPENROUTER_API_KEY) return 'openrouter'
  if (env.OPENROUTER_API_KEY) return 'openrouter'
  if (env.GEMINI_API_KEY) return 'gemini'
  return null
}

export async function analyzeImage({ base64, mime = 'image/jpeg', env = {} }) {
  const provider = providerFor(env)
  if (!provider) throw Object.assign(new Error('vision not configured'), { status: 501 })
  if (!base64 || typeof base64 !== 'string') throw Object.assign(new Error('missing image'), { status: 400 })
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) throw Object.assign(new Error('unsupported image type'), { status: 415 })
  if (base64.length * 0.75 > MAX_IMAGE_BYTES) throw Object.assign(new Error('image too large'), { status: 413 })

  const t0 = Date.now()
  const call = provider === 'openrouter' ? callOpenRouterWithFallback : callGeminiWithFallback
  // VISION_MODEL only applies to the provider whose id format it matches
  // (OpenRouter slugs contain a "/", Gemini ids don't) — so one .env works for either.
  const override = env.VISION_MODEL || ''
  const model = provider === 'openrouter'
    ? (override.includes('/') ? override : DEFAULT_OPENROUTER_MODEL)
    : (override && !override.includes('/') ? override : DEFAULT_GEMINI_MODEL)
  const { text, usage } = await call({ base64, mime, env, model })
  const normalized = normalize(parseJson(text))
  return {
    ...normalized,
    description: toDescription(normalized),
    meta: { provider, model, ms: Date.now() - t0, usage: usage || null },
  }
}
