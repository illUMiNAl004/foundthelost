// JS ↔ SQL matching parity: score identical fixture pairs with scorePair() (demo) and
// the live match_item() (SQL) and print both side by side.
//
//   PGHOST=127.0.0.1 PGPORT=54329 node scripts/db-test/parity.mjs
//
// Needs a DB with every migration applied (run.sh leaves one behind as ftl_test).
// It works in a separate throwaway DB it clones from that template.
import { execFileSync } from 'node:child_process'
import { scorePair, MATCH_THRESHOLD } from '../../src/lib/scoring.js'

const BERK = [-72.5310, 42.3818]
const ILC = [-72.5258, 42.3912]
const REC = [-72.5362, 42.3960] // ~1.2km from Berkshire

const FIXTURES = [
  ['AirPods ↔ AirPods', { name: 'White AirPods Pro', details: 'white airpods pro case, small scratch near the hinge, lost at berkshire around 2pm', category: 'electronics', coords: BERK, h: 3 },
    { name: 'White AirPods Pro', details: 'white airpods pro in a case found on a table at berkshire', category: 'electronics', coords: BERK, h: 2 }],
  ['navy ↔ blue flask (synonym)', { name: 'Navy Hydro Flask', details: 'navy hydro flask with a mountain sticker near the ilc', category: 'bottles', coords: ILC, h: 5 },
    { name: 'Blue Hydro Flask', details: 'blue hydro flask water bottle with stickers', category: 'bottles', coords: ILC, h: 4 }],
  ['black ↔ grey earbuds (neighbour)', { name: 'Black AirPods', details: 'black airpods case', category: 'electronics', coords: BERK, h: 6 },
    { name: 'Grey AirPods', details: 'grey airpods case on a bench', category: 'electronics', coords: BERK, h: 5 }],
  ['laptop ↔ phone (item gate)', { name: 'Silver MacBook Air', details: 'silver macbook air laptop', category: 'electronics', coords: ILC, h: 5 },
    { name: 'Silver iPhone', details: 'silver iphone phone', category: 'electronics', coords: ILC, h: 4 }],
  ['black ↔ white flask (colour gate)', { name: 'Black Hydro Flask', details: 'black hydro flask', category: 'bottles', coords: ILC, h: 4 },
    { name: 'White Hydro Flask', details: 'white hydro flask', category: 'bottles', coords: ILC, h: 3 }],
  ['leather ↔ nylon wallet (material)', { name: 'Brown Leather Wallet', details: 'brown leather wallet with my cards', category: 'wallets', coords: BERK, h: 8 },
    { name: 'Brown Nylon Wallet', details: 'brown nylon wallet', category: 'wallets', coords: BERK, h: 6 }],
  ['keys 1.2km apart', { name: 'Keys', details: 'keys on a red lanyard', category: 'keys', coords: BERK, h: 10 },
    { name: 'Keys', details: 'keys with a red lanyard', category: 'keys', coords: REC, h: 9 }],
  ['found 3 days before loss', { name: 'Black Umbrella', details: 'black umbrella', category: 'other', coords: ILC, h: 2 },
    { name: 'Black Umbrella', details: 'black umbrella', category: 'other', coords: ILC, h: 74 }],
  ['no known item word (fuzzy)', { name: 'Blue thing', details: 'blue squishmallow plush with a keychain clip', category: 'other', coords: BERK, h: 3 },
    { name: 'Blue plush', details: 'blue squishmallow plush toy', category: 'other', coords: BERK, h: 2 }],
  ['same place+time, different stuff', { name: 'Grey Scarf', details: 'grey knitted scarf', category: 'clothing', coords: ILC, h: 3 },
    { name: 'Grey Notebook', details: 'grey spiral notebook', category: 'other', coords: ILC, h: 3 }],
  // 008: pens are their own item — a pen must never match a pencil case, but pen ↔ sharpie must
  ['pen ↔ pencil case (008 item gate)', { name: 'Blue Pen', details: 'blue pen', category: 'other', coords: ILC, h: 3 },
    { name: 'Blue Pencil Case', details: 'blue pencil case', category: 'other', coords: ILC, h: 2 }],
  ['pen ↔ sharpie (008 synonym)', { name: 'Black Pen', details: 'black pen', category: 'other', coords: ILC, h: 3 },
    { name: 'Black Sharpie', details: 'black sharpie', category: 'other', coords: ILC, h: 2 }],
]

const env = { ...process.env, PGHOST: process.env.PGHOST || '127.0.0.1', PGPORT: process.env.PGPORT || '5432', PGUSER: process.env.PGUSER || 'postgres' }
const psql = (db, sql) => execFileSync('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-d', db, '-c', sql], { env, encoding: 'utf8' }).trim()
const q = (s) => `'${String(s).replace(/'/g, "''")}'`

const TEMPLATE = process.env.DB || 'ftl_test'
const DB = 'ftl_parity'
psql('postgres', `drop database if exists ${DB}`)
psql('postgres', `create database ${DB} template ${TEMPLATE}`)

// a threshold-free copy of the live engine so sub-threshold scores are visible too
const def = psql(DB, `select pg_get_functiondef('public.match_item(uuid)'::regprocedure)`)
const probe = def.replace(/public\.match_item\(/, 'public.match_item_probe(').replace(/s_score\s*>=\s*55/, 's_score >= 0')
if (probe === def || !/s_score >= 0/.test(probe)) throw new Error('could not derive threshold-free probe from match_item')
psql(DB, probe)
psql(DB, 'truncate public.matches, public.items cascade')
psql(DB, "select public.set_signup_mode('open')") // 007 gates sign-up; fixture users aren't on the waitlist

const rows = []
FIXTURES.forEach(([label, lost, found], i) => {
  const lu = `00000000-0000-4000-8000-${String(i * 2 + 1).padStart(12, '0')}`
  const fu = `00000000-0000-4000-8000-${String(i * 2 + 2).padStart(12, '0')}`
  const li = `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`
  const fi = `20000000-0000-4000-8000-${String(i).padStart(12, '0')}`
  const ins = (id, uid, kind, it) => `insert into public.items (id, user_id, kind, name, category, description, lat, lng, occurred_at)
    values (${q(id)}, ${q(uid)}, ${q(kind)}, ${q(it.name)}, ${q(it.category)}, ${q(it.details)}, ${it.coords[1]}, ${it.coords[0]}, now() - interval '${it.h} hours')`
  psql(DB, `insert into auth.users (id, email) values (${q(lu)}, 'l${i}@umass.edu'), (${q(fu)}, 'f${i}@umass.edu');
    ${ins(li, lu, 'lost', lost)}; ${ins(fi, fu, 'found', found)};
    update public.items set status = 'closed' where id not in (${q(li)}, ${q(fi)});
    set request.jwt.claims to '{"sub":"${fu}","role":"authenticated"}';
    select public.match_item_probe(${q(fi)});`)
  const sql = psql(DB, `select score from public.matches where lost_item_id = ${q(li)} and found_item_id = ${q(fi)}`)

  const js = scorePair({ ...lost, time: `${lost.h}h ago` }, { ...found, time: `${found.h}h ago` })
  const jsScore = js.gated ? `gated:${js.reason}` : js.score
  const sqlScore = sql === '' ? 'gated' : Number(sql)
  const jsMatch = !js.gated && js.score >= MATCH_THRESHOLD
  const sqlMatch = typeof sqlScore === 'number' && sqlScore >= MATCH_THRESHOLD
  rows.push({ label, js: jsScore, sql: sqlScore, delta: typeof sqlScore === 'number' && !js.gated ? sqlScore - js.score : '', same_decision: jsMatch === sqlMatch ? 'yes' : 'NO' })
})

console.table(rows)
const disagree = rows.filter((r) => r.same_decision === 'NO')
console.log(disagree.length ? `${disagree.length} pair(s) where demo and live DISAGREE on match/no-match` : 'demo and live agree on every match/no-match decision')
psql('postgres', `drop database if exists ${DB}`)
process.exitCode = disagree.length ? 1 : 0
