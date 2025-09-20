// ==========================
// Rediscover Optimizer v4 — Rules Accurate + Values in Slots
// ==========================

const els = {};
window.addEventListener('DOMContentLoaded', () => {
  const q = id => document.getElementById(id);
  ['cls','focus','weap','gearTier','col','char','guild','secret','target','fury']
    .forEach(id => els[id] = q(id));
  els.runBtn = document.getElementById('runBtn');
  els.runBtn.addEventListener('click', run);
});

// ---------- Master Rules ----------
const rules = {
  slots: ["Weapon","Necklace","Helm","Chest","Gloves","Boots","Belt","Ring"],

  caps: {
    critFromGearRune: 0.50,
    evaFromGearRune:  0.40,
    drFromGearRune:   1.00,
    critTotal:        1.00
  },

  baseInterval: {
    Original:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Primal:  {Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Chaos:   {Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Abyss:   {Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    "PvP/Boss":{Berserker:2.2,Paladin:2.5,Ranger:2.0,Sorcerer:2.3}
  },

  lineValues: {
    Primal:   {AS:0.12, CR:0.12, EV:0.12, ATK:0.23, CD:0.35, MD:0.35, HP:0.23, DF:0.23, DR:0.14},
    Original: {AS:0.12, CR:0.12, EV:0.12, ATK:0.23, CD:0.35, MD:0.35, HP:0.23, DF:0.23, DR:0.17},
    Chaos:    {AS:0.14, CR:0.14, EV:0.14, ATK:0.26, CD:0.40, MD:0.40, HP:0.26, DF:0.26, DR:0.19},
    Abyss:    {AS:0.16, CR:0.16, EV:0.16, ATK:0.29, CD:0.45, MD:0.45, HP:0.29, DF:0.29, DR:0.21}
  },

  purple5thLabels: {
    Necklace: "Crit DMG (5th)",
    Ring:     "Crit DMG (5th)",
    Helm:     "Boss DMG / HP% (5th)",
    Belt:     "Boss DMG / HP% (5th)",
    WeaponDPS: "Crit DMG (5th +80)",
    WeaponTank: "HP% (5th +52%)",
    Chest:   "ATK% (5th)",
    Gloves:  "ATK% (5th)",
    Boots:   "ATK% (5th)"
  },

  pets: {
    None:{AS:0.00, CR:0.00},
    B:{AS:0.06, CR:0.06},
    A:{AS:0.09, CR:0.09},
    S:{AS:0.12, CR:0.12}
  },

  weaponPool: {
    common: ["ATK%","Crit DMG","DEF%","HP%","Damage Reduction","Monster DMG"],
    castDPS: { chaosAbyss: "Cast Demon Lord (19%)", normal: "Cast Demon Lord (17%)" },
    castTank:{ chaosAbyss: "Cast Evasion (19%)",    normal: "Cast Evasion (17%)"   }
  }
};

const fmtPct = p => (p*100).toFixed(1) + '%';
const fmtSec = s => s.toFixed(3) + 's';

// ---------- Core ----------
function run(){
  const cls    = els.cls.value;
  const focus  = els.focus.value;
  const weap   = els.weap.value;
  const tier   = els.gearTier.value;
  const statColor = +els.col.value;
  const charMod   = +els.char.value;
  const guild     = (+els.guild.value||0)/100;
  const secret    = (+els.secret.value||0)/100;
  const target    = +els.target.value || 0.25;
  const furyMult  = (els.fury.checked && cls === 'Berserker') ? 1.25 : 1.0;

  const base = rules.baseInterval[weap][cls];
  const tierVals = rules.lineValues[tier];
  const passiveAS = statColor + charMod + guild + secret;

  let best = null;
  const petOptions = Object.entries(rules.pets);

  for (let rune=0; rune<=6; rune++){
    for (const [petName, petStats] of petOptions){
      const petAS = petStats.AS;
      const petCR = petStats.CR;
      for (let gearLines=0; gearLines<=8; gearLines++){
        const totalAS = passiveAS + rune*0.01 + petAS + gearLines*tierVals.AS;
        const finalInterval = base * (1 - totalAS) * furyMult;
        if (finalInterval <= target){
          const requiredAS = 1 - (target / base);
          const waste = totalAS - requiredAS;
          if (!best || gearLines < best.gearLines || (gearLines === best.gearLines && waste < best.waste - 1e-9)){
            best = {gearLines,rune,quick:0, petName,petAS,critPet:petCR,
              totalAS,finalInterval,waste,tierVals,
              critLines:0,evaLines:0,drLines:0,atkLines:0,cdLines:0,mdLines:0,hpLines:0,dfLines:0};
          }
        }
      }
    }
  }

  if (!best){
    document.getElementById('summary').innerHTML = "<b>No valid combo reaches cap.</b>";
    document.getElementById('slots').innerHTML = '';
    document.getElementById('totals').innerHTML = '';
    return;
  }

  renderCombo(cls, focus, weap, tier, base, target, best);
  renderSlots(cls, focus, tier, best);
  renderTotals(focus, tier, best);
}

// ---------- Slot rendering ----------
function renderSlots(cls,focus,tier,best){
  const box = document.getElementById('slots');
  box.innerHTML = '';

  const t = best.tierVals;
  const valueMap = {
    "ATK%": t.ATK, "Crit DMG": t.CD, "Monster DMG": t.MD,
    "HP%": t.HP, "DEF%": t.DF, "Evasion": t.EV,
    "Crit Chance": t.CR, "ATK SPD": t.AS, "DR%": t.DR
  };
  const statLabel = stat => {
    if (valueMap[stat]) return `${stat} +${(valueMap[stat]*100).toFixed(0)}%`;
    return stat;
  };

  const layout = {};
  for (const s of rules.slots) layout[s] = [];

  // Assign ATK SPD lines from optimizer output
  let asLeft = best.gearLines;
  for (const s of rules.slots){
    if (s!=="Weapon" && asLeft>0){
      layout[s].push("ATK SPD");
      asLeft--;
    }
  }

  // Priorities
  let critAccum=0, evaAccum=0, drAccum=0;
  const add = (slot, stat) => {
    layout[slot].push(stat);
    if (stat==="Crit Chance") best.critLines++;
    if (stat==="Evasion")     best.evaLines++;
    if (stat==="DR%")         best.drLines++;
    if (stat==="ATK%")        best.atkLines++;
    if (stat==="Crit DMG")    best.cdLines++;
    if (stat==="Monster DMG") best.mdLines++;
    if (stat==="HP%")         best.hpLines++;
    if (stat==="DEF%")        best.dfLines++;
  };

  const orderDPS  = ["Crit Chance","Evasion","ATK%","Crit DMG","Monster DMG","HP%","DEF%"];
  const orderTank = ["Evasion","DR%","Crit Chance","HP%","DEF%","ATK%","Crit DMG"];

  for (const slot of rules.slots){
    if (slot==="Weapon") continue;
    const order = (focus==="DPS") ? orderDPS : orderTank;
    for (const stat of order){
      const cap = (stat==="Crit Chance" && critAccum+ t.CR>rules.caps.critFromGearRune) ||
                  (stat==="Evasion"     && evaAccum+ t.EV>rules.caps.evaFromGearRune)  ||
                  (stat==="DR%"         && drAccum + t.DR>rules.caps.drFromGearRune);
      if (cap) continue;
      if (layout[slot].length<((tier==="Chaos"||tier==="Abyss")?5:4)){
        add(slot,stat);
        if (stat==="Crit Chance") critAccum+=t.CR;
        if (stat==="Evasion")     evaAccum+=t.EV;
        if (stat==="DR%")         drAccum+=t.DR;
      }
    }
  }

  // Render
  for (const [slot,stats] of Object.entries(layout)){
    const div = document.createElement('div');
    div.className = 'slot';
    div.innerHTML = `<h3>${slot}</h3>` + stats.map(s => `<div>- ${statLabel(s)}</div>`).join('');
    box.appendChild(div);
  }
}

// ---------- Totals ----------
function renderTotals(focus, tier, best){
  const box = document.getElementById('totals');
  const t = best.tierVals;

  const atk = (best.atkLines*t.ATK)*100;
  const cd  = (best.cdLines*t.CD).toFixed(2);
  const md  = (best.mdLines*t.MD)*100;
  const hp  = (best.hpLines*t.HP)*100;
  const df  = (best.dfLines*t.DF)*100;
  const eva = (best.evaLines*t.EV)*100;
  const dr  = (best.drLines*t.DR)*100;
  const crit = (best.critLines*t.CR)*100;

  box.innerHTML = `
    <h3>Equipment Stats</h3>
    <div>Attack Speed = ${(best.totalAS*100).toFixed(1)}%</div>
    <div>Attack = ${atk.toFixed(0)}%</div>
    <div>Crit Chance = ${crit.toFixed(0)}%</div>
    <div>Crit Chance + Pet = ${((crit/100)+(best.critPet||0))*100}%</div>
    <div>Crit Damage = ${cd}</div>
    <div>Evasion = ${eva.toFixed(0)}%</div>
    <div>DR% = ${dr.toFixed(0)}%</div>
    <div>HP% = ${hp.toFixed(0)}%</div>
    <div>DEF% = ${df.toFixed(0)}%</div>
    <div>Monster DMG = ${md.toFixed(0)}%</div>
    <div>Boss DMG = shown as choice (Helm/Belt)</div>
  `;
}
