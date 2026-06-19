/**
 * Imports the verified source CSV bundle. The parser supports quoted commas
 * and line breaks, so card/skill descriptions remain lossless.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve('.'), source=resolve(root,'source'), output=resolve(root,'data/generated');
function csv(text){
  const rows=[]; let row=[], field='', quoted=false;
  for(let i=0;i<text.length;i++) { const c=text[i], n=text[i+1];
    if(c==='"' && quoted && n==='"'){field+='"';i++;continue;}
    if(c==='"'){quoted=!quoted;continue;}
    if(c===','&&!quoted){row.push(field);field='';continue;}
    if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';continue;}
    field+=c;
  }
  if(field||row.length){row.push(field);rows.push(row);}
  const [header,...values]=rows; return values.map(r=>Object.fromEntries(header.map((h,i)=>[h.replace(/^\uFEFF/,''),r[i]??''])));
}
async function load(file){return csv(await readFile(resolve(source,file),'utf8'));}
const [instances,definitions,distributions,roles,phases,rules,characters,events,manual]=await Promise.all([
  load('01_card_instances.csv'),load('02_card_definitions.csv'),load('03_role_distribution.csv'),load('04_roles.csv'),load('05_turn_phases.csv'),load('06_game_rules.csv'),load('07_characters.csv'),load('08_backend_events.csv')
  ,JSON.parse(await readFile(resolve(output,'manual.json'),'utf8'))
]);
const byName=new Map(definitions.map(d=>[d.name_th,d]));
const cards=instances.map(instance=>{const d=byName.get(instance.name_th);if(!d)throw Error(`No definition for ${instance.card_id} (${instance.name_th})`);return {
  id:instance.card_id,name:instance.name_th,type:d.category,suit:instance.suit,number:instance.rank,
  image:null,description:d.effect_th,effect:d.backend_effect_key||null,conditions:{timing:d.timing,targetRule:d.target_rule,rangeOrValue:d.range_or_value},source:instance.source
};});
if(cards.length!==108)throw Error(`Expected 108 cards, got ${cards.length}`);
if(characters.length!==27||characters.some(c=>!c.char_id||!c.name_th||!c.max_hp))throw Error('Characters must contain 27 complete verified records');
const characterData=characters.map(c=>({id:c.char_id,name:c.name_th,kingdom:c.kingdom,kingdomTh:c.kingdom_th,gender:c.gender,hp:Number(c.max_hp),skills:[c.skill_1_name&&{name:c.skill_1_name,description:c.skill_1_desc},c.skill_2_name&&{name:c.skill_2_name,description:c.skill_2_desc}].filter(Boolean),image:null,source:c.source}));
const roleCompositions={}; for(const r of distributions){const v={emperor:Number(r.emperor),loyalist:Number(r.loyalist),rebel:Number(r.rebel),traitor:Number(r.traitor)};(roleCompositions[r.players]??=[]).push(v);}
const findManual=(needle)=>manual.paragraphs.find(p=>p.includes(needle));
const openingDeal=findManual('แจกให้ผู้เล่นทุกคน');
const openingCount=openingDeal?.match(/คนละ\s*(\d+)\s*ใบ/)?.[1];
const firstTurn=findManual('เกมจะเริ่มต้นโดยจักรพรรดิ');
const hpBonus=findManual('จักรพรรดิจะมีพลังชีวิตสูงสุดเพิ่ม');
if(!openingCount||!firstTurn||!hpBonus) throw Error('Authoritative manual is missing required V1 setup rules');
const authoritativeSetup={initialHandSize:Number(openingCount),firstPlayerRole:'emperor',direction:firstTurn.includes('ทวนเข็มนาฬิกา')?'counterclockwise':'unknown',emperorHpBonus:{amount:1,exceptPlayerCount:hpBonus.match(/ยกเว้น.*?(\d+)\s*คน/)?.[1] ? Number(hpBonus.match(/ยกเว้น.*?(\d+)\s*คน/)?.[1]) : null},source:manual.source};
if(authoritativeSetup.direction==='unknown'||authoritativeSetup.emperorHpBonus.exceptPlayerCount===null) throw Error('Could not safely parse authoritative opening setup');
await mkdir(output,{recursive:true});
await Promise.all([
  writeFile(resolve(output,'cards.json'),JSON.stringify(cards,null,2)),
  writeFile(resolve(output,'characters.json'),JSON.stringify(characterData,null,2)),
  writeFile(resolve(output,'rules.json'),JSON.stringify({authority:manual.source,authoritativeSetup,roleCompositions,roles,turnPhases:phases,gameRules:rules,backendEvents:events},null,2))
]);
console.log(`Imported ${cards.length} cards, ${characterData.length} characters, and ${distributions.length} role distributions.`);
