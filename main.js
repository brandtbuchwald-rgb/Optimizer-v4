// ===========================
// Rediscover Optimizer v2
// ===========================
// Slot-by-slot output version

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
  run(rules);
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

    // Pull line values from rules (gear tier specific)
  const tierVals = rules.lineValues[weap] || {};
  const line = {
    AS: tierVals.AS || +els.line_atkspd.value || 0.08,
    CR: tierVals.CR || +els.line_crit.value   || 0.16,
    EV: tierVals.EV || +els.line_eva.value    || 0.12,
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

  // 1. Weapon
  allocateWeapon(layout, focus);

  // 2. Assign ATK SPD across slots until cap
  let asAccum = 0;
  const nonWeaponSlots = slots.filter(s => s !== "Weapon");
  for (const s of nonWeaponSlots){
    if (asAccum < needFromEquip){
      layout[s].push("ATK SPD");
      asAccum += line.AS;
    }
  }

  // 3. Crit Chance until 50%
  let critAccum = 0;
  for (const s of nonWeaponSlots){
    if (!layout[s].includes("ATK SPD") && critAccum < rules.caps.critFromGearRune){
      layout[s].push("Crit Chance");
      critAccum += line.CR;
    }
  }

  // 4. Evasion until 40%
  let evaAccum = 0;
  for (const s of nonWeaponSlots){
    if (!layout[s].includes("ATK SPD") &&
        !layout[s].includes("Crit Chance") &&
        evaAccum < rules.caps.evaFromGearRune){
      layout[s].push("Evasion");
      evaAccum += line.EV;
    }
  }

  // 5. Fill remaining with DPS priorities
  const filler = (focus === "DPS")
    ? ["ATK%","Crit DMG","Monster DMG"]
    : ["Evasion","HP%","DR%","DEF%","ATK%"];
  for (const s of nonWeaponSlots){
    while (layout[s].length < 4){
      for (const f of filler){
        if (layout[s].length < 4 && !layout[s].includes(f)){
          layout[s].push(f);
        }
      }
    }
  }

  // 6. Compute totals
  const totalAS = passiveAS + asAccum;
  const finalInterval = base * (1 - quicken) * fury * (1 - totalAS);

  renderSummary({cls, focus, weap, base, target, totalAS, needAS, finalInterval});
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
    <div><b>${d.cls}</b> (${d.focus}) | Tier: ${d.weap}</div>
    <div>Base Interval: ${fmtSec(d.base)} → Target: ${fmtSec(d.target)}</div>
    <div>Total AS: ${fmtPct(d.totalAS)} | Needed: ${fmtPct(d.needAS)}</div>
    <div>Projected final interval: ${fmtSec(d.finalInterval)}</div>
    <hr/>
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
