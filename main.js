// ==========================
// Rediscover Optimizer v4 — Debug Wrapped
// ==========================

const els = {};
window.addEventListener('DOMContentLoaded', () => {
  const q = id => document.getElementById(id);
  ['cls','focus','weap','gearTier','col','char','guild','secret','target','fury']
    .forEach(id => els[id] = q(id));
  els.runBtn = document.getElementById('runBtn');
  els.runBtn.addEventListener('click', run);
});

// ---------- Debug Helper ----------
function logDebug(...args) {
  const dbg = document.getElementById('debug');
  if (!dbg) return;
  dbg.textContent += args.map(a => {
    try { return JSON.stringify(a); } catch(e) { return String(a); }
  }).join(" ") + "\n";
}

// ---------- Master Rules ----------
const rules = {
  slots: ["Weapon","Necklace","Helm","Chest","Gloves","Boots","Belt","Ring"],
  caps: { critFromGearRune:0.50, evaFromGearRune:0.40, drFromGearRune:1.00, critTotal:1.00 },
  baseInterval: {
    Original:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Primal:  {Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Chaos:   {Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Abyss:   {Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    "PvP/Boss":{Berserker:2.2,Paladin:2.5,Ranger:2.0,Sorcerer:2.3}
  },
  lineValues: {
    Primal:   {AS:0.12,CR:0.12,EV:0.12,ATK:0.23,CD:0.35,MD:0.35,BD:0.35,HP:0.23,DF:0.23,DR:0.14},
    Original: {AS:0.12,CR:0.12,EV:0.12,ATK:0.23,CD:0.35,MD:0.35,BD:0.35,HP:0.23,DF:0.23,DR:0.17},
    Chaos:    {AS:0.14,CR:0.14,EV:0.14,ATK:0.26,CD:0.40,MD:0.40,BD:0.40,HP:0.26,DF:0.26,DR:0.19},
    Abyss:    {AS:0.16,CR:0.16,EV:0.16,ATK:0.29,CD:0.45,MD:0.45,BD:0.45,HP:0.29,DF:0.29,DR:0.21}
  },
  pets: { None:{AS:0,CR:0}, B:{AS:0.06,CR:0.06}, A:{AS:0.09,CR:0.09}, S:{AS:0.12,CR:0.12} },
  weaponPool: {
    common:["ATK%","Crit DMG","Racial DMG","HP%","Damage Reduction","DEF%"],
    castDPS:{chaosAbyss:"Cast Demon Lord (19%)",normal:"Cast Demon Lord (17%)"},
    castTank:{chaosAbyss:"Cast Evasion (19%)",normal:"Cast Evasion (17%)"}
  }
};

const fmtPct=p=>(p*100).toFixed(1)+'%';
const fmtSec=s=>s.toFixed(3)+'s';

// ---------- Core ----------
function run(){
  document.getElementById('debug').textContent = ""; // clear log

  const cls=els.cls.value, focus=els.focus.value, weap=els.weap.value, tier=els.gearTier.value;
  const statColor=+els.col.value, charMod=+els.char.value;
  const guild=(+els.guild.value||0)/100, secret=(+els.secret.value||0)/100;
  const target=+els.target.value||0.25;
  const fury=(els.fury.checked&&cls==="Berserker")?1.25:1.0;

  logDebug("Run started with:", {cls, focus, weap, tier, target, fury});

  const base=rules.baseInterval[weap][cls], tVals=rules.lineValues[tier];
  const passiveAS=statColor+charMod+guild+secret;

  logDebug("Base interval:", base, "PassiveAS:", passiveAS);

  let best=null;
  const pets=Object.entries(rules.pets);

  // Pass 1
  for(let rune=0;rune<=6;rune++){
    for(const [petName,petStats] of pets){
      for(let gearLines=0;gearLines<=8;gearLines++){
        const totalAS=passiveAS+rune*0.01+petStats.AS+gearLines*tVals.AS;
        const interval=base*(1-totalAS)*fury;
        if(interval<=target){
          const req=1-(target/base), waste=totalAS-req;
          if(!best||gearLines<best.gearLines||(gearLines===best.gearLines&&waste<best.waste)){
            best={gearLines,rune,quick:0,petName,petAS:petStats.AS,critPet:petStats.CR,
                  totalAS,finalInterval:interval,waste,tierVals:tVals};
          }
        }
      }
    }
  }

  if(!best){
    logDebug("No valid combo found!");
    document.getElementById('summary').innerHTML = "<b>No valid combo reaches target.</b>";
    return;
  }

  logDebug("Best combo:", best);

  renderCombo(cls,focus,weap,tier,base,target,best);

  try {
    logDebug("renderSlots started");
    renderSlots(cls,focus,tier,best);
    logDebug("renderSlots finished");
  } catch(e) {
    logDebug("Error in renderSlots:", e.message);
  }

  try {
    logDebug("renderTotals started");
    renderTotals(focus,tier,best);
    logDebug("renderTotals finished");
  } catch(e) {
    logDebug("Error in renderTotals:", e.message);
  }
}

// ---------- Render Functions ----------
function renderCombo(cls,focus,weap,tier,base,target,best){
  document.getElementById('summary').innerHTML = `
    <h3>Optimal Combo</h3>
    <div>${cls} (${focus}) | Weapon: ${weap} | Gear Tier: ${tier}</div>
    <div>Base Interval: ${fmtSec(base)} → Target: ${fmtSec(target)}</div>
    <ul>
      <li>${best.gearLines} gear line(s) ATK SPD</li>
      <li>Rune ${best.rune}%</li>
      <li>Pet ${best.petName} (AS ${fmtPct(best.petAS)}, Crit ${fmtPct(best.critPet||0)})</li>
      ${best.quick>0 ? `<li>Quicken Lv ${best.quick}</li>` : ""}
    </ul>
  `;
}

// Keep your existing renderSlots and renderTotals here
