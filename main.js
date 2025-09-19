// Rediscover Optimizer v1 – brain
// Handles input, loads rules, calculates AS/crit/eva caps, allocates lines.

const els = {};
window.addEventListener('DOMContentLoaded', async () => {
  const q = id => document.getElementById(id);
  [
    'cls','focus','weap','col','char','guild','secret','rune',
    'quicken','pet','target','fury',
    'line_atkspd','line_crit','line_eva','line_atk','line_cd',
    'line_md','line_hp','line_def','line_dr'
  ].forEach(id => els[id] = q(id));
  els.runBtn = document.getElementById('runBtn');

  const rules = await (await fetch('assets/gearRules.json')).json();
  els.runBtn.addEventListener('click', () => run(rules));
  run(rules); // run once on load
});

function pctNum(el){ return Math.min(Math.max(+el.value || 0, -1), 5); }
function fmtPct(p){ return (p*100).toFixed(1) + '%'; }
function fmtSec(s){ return s.toFixed(3) + 's'; }

function baseInterval(rules, weaponTier, cls){
  return rules.baseInterval[weaponTier][cls];
}

function requiredAtkSpdFraction({base, quicken, fury, target}){
  const denom = Math.max(base * (1 - quicken) * fury, 1e-9);
  const need = 1 - (target / denom);
  return Math.min(Math.max(need, 0), 0.95);
}

function run(rules){
  const cls    = els.cls.value;
  const focus  = els.focus.value;
  const weap   = els.weap.value;

  const statColor = +els.col.value;
  const charMod   = +els.char.value;
  const guild     = pctNum(els.guild);
  const secret    = pctNum(els.secret);
  const runeAS    = pctNum(els.rune);
  const quicken   = +els.quicken.value;
  const petAS     = +els.pet.value;
  const target    = +els.target.value || 0.25;
  const fury      = (els.fury.checked && cls === 'Berserker') ? 1.25 : 1.0;

  const base = baseInterval(rules, weap, cls);
  const needAS = requiredAtkSpdFraction({base, quicken, fury, target});
  const passiveAS = statColor + charMod + guild + secret + runeAS + petAS;
  const needFromEquip = Math.max(0, needAS - passiveAS);

  const line = {
    AS:  +els.line_atkspd.value || 0.08,
    CR:  +els.line_crit.value   || 0.16,
    EV:  +els.line_eva.value    || 0.12,
    ATK: +els.line_atk.value    || 0.18,
    CD:  +els.line_cd.value     || 40,
    MD:  +els.line_md.value     || 0.18,
    HP:  +els.line_hp.value     || 0.20,
    DF:  +els.line_def.value    || 0.20,
    DR:  +els.line_dr.value     || 0.12
  };

  const slots = rules.slots.slice();
  const layout = {};
  for (const s of slots) layout[s] = [];

  allocateWeapon(layout, focus);

  // ATK SPD allocation
  const maxASLines = slots.length - 1; // 7 non-weapon
  const neededASLines = Math.min(maxASLines, Math.ceil(needFromEquip / line.AS));
  let asAccum = 0;
  for (let i=0; i<neededASLines; i++){
    const s = slots.filter(x => x !== "Weapon")[i];
    layout[s].push('ATK SPD');
    asAccum += line.AS;
  }
  const asWaste = Math.max(0, asAccum - needFromEquip);

  // Crit/Eva fill
  const caps = rules.caps;
  let critAccum = 0, evaAccum = 0;
  for (const s of slots){
    if (s === "Weapon") continue;
    if (!layout[s].includes('ATK SPD') && critAccum < caps.critFromGearRune){
      layout[s].push('Crit Chance');
      critAccum += line.CR;
    }
  }
  for (const s of slots){
    if (s === "Weapon") continue;
    if (!layout[s].includes('ATK SPD') && !layout[s].includes('Crit Chance') && evaAccum < caps.evaFromGearRune){
      layout[s].push('Evasion');
      evaAccum += line.EV;
    }
  }

  // Fill remaining
  const prio = rules.priority[focus];
  for (const stat of prio){
    if (['ATK SPD','Crit Chance','Evasion'].includes(stat)) continue;
    for (const s of slots){
      if (layout[s].length < 4 && !layout[s].includes(stat) && s !== "Weapon"){
        layout[s].push(stat);
      }
    }
  }

  // Compute totals
  const totalAS = passiveAS + asAccum;
  const finalInterval = base * (1 - quicken) * fury * (1 - totalAS);

  renderSummary({cls, focus, weap, base, target, totalAS, needAS, asWaste, finalInterval});
  renderSlots(layout);
}

function allocateWeapon(layout, focus){
  if (focus === 'DPS') {
    layout['Weapon'] = ['ATK%','Crit DMG','Monster DMG','DR%','Cast Demon Lord'];
  } else {
    layout['Weapon'] = ['DR%','HP%','DEF%','ATK%','Cast Evasion'];
  }
}

function renderSummary(d){
  const sum = document.getElementById('summary');
  sum.innerHTML = `
    <div>Class: <b>${d.cls}</b> | Focus: <b>${d.focus}</b> | Tier: <b>${d.weap}</b></div>
    <div>Base Interval: ${fmtSec(d.base)} | Target: ${fmtSec(d.target)}</div>
    <div>Total AS: ${fmtPct(d.totalAS)} | Needed: ${fmtPct(d.needAS)}</div>
    <div>Waste: ${fmtPct(d.asWaste)}</div>
    <div>Projected final: ${fmtSec(d.finalInterval)}</div>
  `;
}

function renderSlots(layout){
  const box = document.getElementById('slots');
  box.innerHTML = '';
  for (const [slot, stats] of Object.entries(layout)){
    const div = document.createElement('div');
    div.className = 'slot';
    div.innerHTML = `<h3>${slot}</h3>` +
      stats.map(s => `<span class="pill">${s}</span>`).join('');
    box.appendChild(div);
  }
}
