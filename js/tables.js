// tables.js — Cyberpunk RED NET Architecture generation tables (pp. 210-212)

const TABLES = (() => {
    const DIFFICULTIES = {
        basic:    { label: 'Basic',    dv: 6,  interfaceRec: 2 },
        standard: { label: 'Standard', dv: 8,  interfaceRec: 4 },
        uncommon: { label: 'Uncommon', dv: 10, interfaceRec: 6 },
        advanced: { label: 'Advanced', dv: 12, interfaceRec: 8 }
    };

    // --- Helpers to build floor content objects ---
    function ice(...args) {
        const entries = args.map(a =>
            typeof a === 'string' ? { name: a, count: 1 } : a
        );
        return { type: 'black_ice', entries };
    }
    function iceN(name, count) { return { name, count }; }
    function password(dv)      { return { type: 'password',     dv }; }
    function file(dv)          { return { type: 'file',         dv }; }
    function controlNode(dv)   { return { type: 'control_node', dv }; }

    // --- Lobby Table — 1d6 (p. 211) ---
    const LOBBY = [
        file(6),            // 1
        password(6),        // 2
        password(8),        // 3
        ice('Skunk'),       // 4
        ice('Wisp'),        // 5
        ice('Killer')       // 6
    ];

    // --- Body Table — 3d6 by difficulty (p. 211) ---
    const BODY = {
        3:  { basic: ice('Hellhound'),              standard: ice(iceN('Hellhound',2)),        uncommon: ice('Kraken'),                  advanced: ice(iceN('Hellhound',3))       },
        4:  { basic: ice('Sabertooth'),             standard: ice('Hellhound','Killer'),       uncommon: ice('Hellhound','Scorpion'),    advanced: ice(iceN('Asp',2))             },
        5:  { basic: ice(iceN('Raven',2)),          standard: ice(iceN('Skunk',2)),            uncommon: ice('Hellhound','Killer'),      advanced: ice('Hellhound','Liche')       },
        6:  { basic: ice('Hellhound'),              standard: ice('Sabertooth'),               uncommon: ice(iceN('Raven',2)),           advanced: ice(iceN('Wisp',3))            },
        7:  { basic: ice('Wisp'),                   standard: ice('Scorpion'),                 uncommon: ice('Sabertooth'),              advanced: ice('Hellhound','Sabertooth')  },
        8:  { basic: ice('Raven'),                  standard: ice('Hellhound'),                uncommon: ice('Hellhound'),               advanced: ice('Kraken')                  },
        9:  { basic: password(6),                   standard: password(8),                     uncommon: password(10),                   advanced: password(12)                   },
        10: { basic: file(6),                       standard: file(8),                         uncommon: file(10),                       advanced: file(12)                       },
        11: { basic: controlNode(6),                standard: controlNode(8),                  uncommon: controlNode(10),                advanced: controlNode(12)                },
        12: { basic: password(6),                   standard: password(8),                     uncommon: password(10),                   advanced: password(12)                   },
        13: { basic: ice('Skunk'),                  standard: ice('Asp'),                      uncommon: ice('Killer'),                  advanced: ice('Giant')                   },
        14: { basic: ice('Asp'),                    standard: ice('Killer'),                   uncommon: ice('Liche'),                   advanced: ice('Dragon')                  },
        15: { basic: ice('Scorpion'),               standard: ice('Liche'),                    uncommon: ice('Dragon'),                  advanced: ice('Killer','Scorpion')        },
        16: { basic: ice('Killer','Skunk'),         standard: ice('Asp'),                      uncommon: ice('Asp','Raven'),             advanced: ice('Kraken')                  },
        17: { basic: ice(iceN('Wisp',3)),           standard: ice(iceN('Raven',3)),            uncommon: ice('Dragon','Wisp'),           advanced: ice('Raven','Wisp','Hellhound')},
        18: { basic: ice('Liche'),                  standard: ice('Liche','Raven'),            uncommon: ice('Giant'),                   advanced: ice(iceN('Dragon',2))          }
    };

    // --- Black ICE categories ---
    const ICE_CATEGORY = {
        Asp:        'anti_personnel', Giant:      'anti_personnel',
        Hellhound:  'anti_personnel', Kraken:     'anti_personnel',
        Liche:      'anti_personnel', Raven:      'anti_personnel',
        Scorpion:   'anti_personnel', Skunk:      'anti_personnel',
        Wisp:       'anti_personnel',
        Dragon:     'anti_program',   Killer:     'anti_program',
        Sabertooth: 'anti_program'
    };

    // --- Full Black ICE stat blocks ---
    const ICE_STATS = {
        Asp:        { per:4, spd:6, atk:2, def:2, rez:15, effect:"Destroys a random Program on enemy Netrunner's Cyberdeck.",                                                             cost:'100eb' },
        Giant:      { per:2, spd:2, atk:8, def:4, rez:25, effect:"3d6 brain damage. Forcibly unsafe Jack Out (suffers all Rezzed Black ICE effects, not including Giant).",                cost:'1,000eb' },
        Hellhound:  { per:6, spd:6, atk:6, def:2, rez:20, effect:"2d6 brain damage. Cyberdeck/clothing catch fire (unless insulated). 2 HP/Turn until put out (no stacking).",            cost:'500eb' },
        Kraken:     { per:6, spd:2, atk:8, def:4, rez:30, effect:"3d6 brain damage. Until end of next Turn, cannot progress deeper or safely Jack Out.",                                  cost:'1,000eb' },
        Liche:      { per:8, spd:2, atk:6, def:2, rez:25, effect:"INT, REF, DEX each lowered by 1d6 for 1 hour (min 1). Psychosomatic.",                                                cost:'500eb' },
        Raven:      { per:6, spd:4, atk:4, def:2, rez:15, effect:"Derezzes a random Defender Program, then 1d6 brain damage.",                                                           cost:'50eb' },
        Scorpion:   { per:2, spd:6, atk:2, def:2, rez:15, effect:"MOVE lowered by 1d6 for 1 hour (min 1). Psychosomatic.",                                                              cost:'100eb' },
        Skunk:      { per:2, spd:4, atk:4, def:2, rez:10, effect:"Until Derezzed, target makes all Slide Checks at -2. Multiple Skunks stack.",                                          cost:'500eb' },
        Wisp:       { per:4, spd:4, atk:4, def:2, rez:15, effect:"1d6 brain damage. Lowers total NET Actions next Turn by 1 (min 2).",                                                   cost:'50eb' },
        Dragon:     { per:6, spd:4, atk:6, def:6, rez:30, effect:"6d6 REZ to a Program. If enough to Derezz, Program is Destroyed instead.",                                             cost:'1,000eb' },
        Killer:     { per:4, spd:8, atk:6, def:2, rez:20, effect:"4d6 REZ to a Program. If enough to Derezz, Program is Destroyed instead.",                                             cost:'500eb' },
        Sabertooth: { per:8, spd:6, atk:6, def:2, rez:25, effect:"6d6 REZ to a Program. If enough to Derezz, Program is Destroyed instead.",                                             cost:'1,000eb' }
    };

    // --- Demon stat blocks (p. 213) ---
    const DEMONS = {
        Imp:    { rez:15, interface:3, netActions:2, combatNumber:14 },
        Efreet: { rez:25, interface:4, netActions:3, combatNumber:14 },
        Balron: { rez:30, interface:7, netActions:4, combatNumber:14 }
    };

    return { DIFFICULTIES, LOBBY, BODY, ICE_CATEGORY, ICE_STATS, DEMONS };
})();
