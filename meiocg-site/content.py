# -*- coding: utf-8 -*-
"""Page content for the MEIOCG deck pages, deck hub and Why KodeX page.
Card names in [[double brackets]] must match KodeX card names exactly; build.py checks every one.
Every combo step was checked against the card text in the KodeX database (Nov 2026)."""

UPDATED = "2026-11-07"
BANLIST = "OCG list of Oct 1, 2026"
PERIOD = "Oct 7 – Nov 6, 2026"
META_SRC = ("Share of top-placing decks at Japanese OCG events, Oct 7 – Nov 6, 2026 (467 decks), from "
            "tcg-portal.jp. A deck that mixes two themes counts for both, so shares add up to more than 100%.")

SITE = "https://meiocg.org"
PAGES = {
    "hub": "decks",
    "light-and-darkness-ritual": "deck-light-and-darkness-ritual",
    "ars-magna-elfnote": "deck-ars-magna-elfnote",
    "raise-moon": "deck-raise-moon",
    "why": "why-kodex",
    "guides": "guides",
    "guide-light-and-darkness-ritual": "guide-light-and-darkness-ritual",
    "guide-ars-magna-elfnote": "guide-ars-magna-elfnote",
    "guide-raise-moon": "guide-raise-moon",
    "cup": "meiocg-cup",
    "players": "players",
    "ds": "duelsynapse",
}
URL = lambda k: f"{SITE}/{PAGES[k]}"

DECKS = {}

DECKS["light-and-darkness-ritual"] = dict(
    name="Light and Darkness Ritual",
    label=("Meta deck", "Ritual · Midrange"),
    metaLine="#1 in the OCG · 15.8% of top decks",
    readMin=8,
    art=70405001,
    lead=("The most played deck in the OCG right now. It Ritual Summons two Level 8 bosses that ignore your untargeted effects, "
          "tutors its whole engine from the Deck and keeps a hand-trap answer ready on both turns. Here is how it wins, "
          "where its turn breaks, and the list that won the 1st School CS on Nov 1."),
    source=dict(text="Winning list from the **1st School CS** (42 players, Nov 1, 2026), piloted by ぺーじ.",
                url="https://ygoprodeck.com/deck/light-and-darkness-ritual-742279"),
    how=dict(
        intro=[
            "Light and Darkness Ritual (光と闇の儀式) is built around two Level 8 Ritual Monsters, [[Magician of Dark Chaos - Black Chaos]] and "
            "[[Black Luster Soldier - Soldier of Light and Darkness]]. Both are **unaffected by your activated effects unless you target them**, "
            "and both can banish your cards. The rest of the deck exists to find them, summon them cheaply and bring the Ritual Spell back.",
            "Built this way it plays as midrange: it rarely ends on a huge board, but every turn it removes something, recycles "
            "[[Light and Darkness Ritual]] from the GY, and keeps a big monster that most removal cannot touch. The winning list adds the "
            "Fallen/Branded package ([[Fallen of the White Dragon]], [[The Fallen & The Virtuous]]) and a heavy hand-trap count.",
        ],
        keys=[
            "[[Ragged Records of Rites]]: reveal a Ritual Spell and add any monster that mentions it. It is the deck's main search.",
            "[[Skull Archfiend of Chaos]]: when it is sent to the GY, send a Ritual Spell from the Deck and add the Ritual Monster named on it. "
            "From the GY it can also summon itself by putting three cards on the bottom of the Deck.",
            "[[Celtic Mystic]]: on summon, reveal your hand to draw 3 and discard 2 (discarding Skull Archfiend sets up its search), "
            "then Tribute itself to Special Summon a Ritual Monster from your hand without a Ritual Spell.",
            "[[Light and Darkness Ritual]]: from the GY it returns itself plus another card that mentions it, so the deck rarely runs out.",
            "[[Black Chaos]]: summoned by shuffling a Spellcaster or Warrior Ritual Monster back. It banishes 2 of your cards in its Main Phase "
            "and is unaffected by your activated effects while a Ritual Spell is in its GY.",
            "[[The Great Gallant Bandit]]: Tribute Summoned from the hand. While Normal Summoned it negates and destroys a card or effect you "
            "activate in the hand, GY or banishment, so it is their answer to hand traps.",
        ],
    ),
    line=dict(
        start="[[Celtic Mystic]] + [[Skull Archfiend of Chaos]] + [[Griffoh]]",
        end="[[Magician of Dark Chaos - Black Chaos]] + [[Skull Archfiend of Chaos]], [[Mind Shuffle]] ready, [[Light and Darkness Ritual]] in hand",
        steps=[
            ("Normal Summon [[Celtic Mystic]]. Reveal the hand (Griffoh mentions the Ritual), draw 3, then discard 2, including [[Skull Archfiend of Chaos]].",
             "Celtic Mystic limits them to one Special Summon from the Extra Deck for the rest of the turn."),
            ("[[Skull Archfiend of Chaos]] was sent to the GY: send [[Light and Darkness Ritual]] from the Deck to the GY and add [[Magician of Dark Chaos - Black Chaos]].",
             "First chokepoint: this effect sends from the Deck and adds from the Deck."),
            ("Tribute [[Celtic Mystic]] to Special Summon [[Magician of Dark Chaos - Black Chaos]] from the hand.", None),
            ("Magician's summon effect adds [[Light and Darkness Ritual]] from the GY back to the hand.",
             "From here it can banish one of your cards face-down (its other effect)."),
            ("[[Skull Archfiend of Chaos]] puts 3 cards from the GYs on the bottom of the Deck, including Celtic Mystic, and Special Summons itself.", None),
            ("Discard [[Griffoh]] (Quick Effect) to Set [[Mind Shuffle]] from the Deck. It can be activated this turn.",
             "Mind Shuffle searches on either turn and can swap a Level 7+ monster for another Ritual piece in response to your play."),
        ],
        note=("End: a 2800 ATK boss that ignores your untargeted effects and protects their Spells/Traps, a 2500 beater, "
              "a live Continuous Trap and the Ritual Spell in hand for next turn, after a draw-3. "
              "Every step was checked against the card text; real players vary the order to suit their hand."),
    ),
    duel=("Load this exact list into Duel Synapse Arena and goldfish it against a dummy, or choose your opening hand to drill the line above.",
          "Save the list in the Arena, then let Synapse AI play it while you bring your own deck. Pick going first or second and replay the opening until your hand traps land."),
    board=[
        "[[Magician of Dark Chaos - Black Chaos]] and [[Black Luster Soldier - Soldier of Light and Darkness]] ignore your untargeted activated effects. "
        "Board wipes and \"negate all\" effects pass them by. You must **target** them or beat them in battle. Black Luster Soldier also cannot be destroyed by battle.",
        "While Magician is on the field, their Spells and Traps cannot be destroyed or banished by your card effects.",
        "[[Mind Shuffle]]: when you activate a card or effect, they can return a Level 7+ monster to the hand and Special Summon a different "
        "Ritual piece, ignoring summoning conditions. Each fresh summon of a Ritual boss banishes something again.",
        "[[The Great Gallant Bandit]] (Normal Summoned) negates and destroys one effect activated from your hand, GY or banishment. Your first hand trap may just feed it.",
        "[[Fydraulis Harmonia]] (main deck hand trap): when one of your monsters activates its effect, it Special Summons itself and, with enough Synchro Monsters revealed, can also destroy a monster.",
        "[[Black Chaos]] banishes 2 of your cards during their Main Phase and is unaffected by your activated effects while a Ritual Spell is in their GY.",
    ],
    stopIntro=["The engine searches from the Deck again and again, so it hands you a lot of chances to interrupt. Hit it early, before a Ritual boss lands."],
    stops=[
        ("[[Ash Blossom & Joyous Spring]]", "On [[Ragged Records of Rites]], or on [[Skull Archfiend of Chaos]]'s GY effect (it sends and adds from the Deck).",
         "No Ritual Monster gets searched. They fall back to [[Mind Shuffle]] or the GY Ritual Spell, which are slower."),
        ("[[Droll & Lock Bird]]", "After their first search of the turn.",
         "Nothing else can be added from the Deck that turn. Celtic Mystic's draw still works, but Skull Archfiend, Mind Shuffle and Ragged Records stop."),
        ("[[Infinite Impermanence]] / [[Effect Veiler]]", "On [[Celtic Mystic]] when its summon effect activates, or on a Ritual boss (these target it, so they work).",
         "No draw 3 means no discard into Skull Archfiend. On Magician or Black Luster Soldier, it stops the banish."),
        ("[[Ghost Ogre & Snow Rabbit]]", "When [[Mind Shuffle]] activates its effect on the field.",
         "Destroys their main follow-up. Mind Shuffle is how they replace a boss you removed."),
        ("[[Maxx \"C\"]] / [[Mulcharmy Purulia]]", "Early, before [[The Great Gallant Bandit]] is on the field.",
         "Once Bandit is Normal Summoned it can negate effects from your hand. Using a draw effect first, during their Draw or Standby Phase, gets around it."),
        ("Targeted removal", "On [[Magician of Dark Chaos - Black Chaos]] or [[Black Luster Soldier - Soldier of Light and Darkness]].",
         "They only protect against untargeted effects. Destroy, banish or bounce effects that target them work normally."),
    ],
    takeaways=[
        "Interrupt the **first search**. Most of their power comes from Deck access.",
        "Save at least one **targeting** answer for the Ritual bosses. Your board wipes will not touch them.",
        "Play around [[The Great Gallant Bandit]]: if they have 2+ cards to Tribute and no monsters, assume your hand trap may be negated.",
    ],
    second=[
        "Count their protection before you commit. Magician makes their Spells/Traps immune to your destruction and banishing, so remove Magician first.",
        "Battle works. Magician has 2800 ATK and can be destroyed by battle. Black Luster Soldier cannot, but it can be targeted.",
        "Expect [[Mind Shuffle]] to answer your first big play. If you can, bait it with a smaller effect, or have [[Ghost Ogre & Snow Rabbit]] ready for it.",
        "Their GY is a resource: [[Skull Archfiend of Chaos]] and [[Light and Darkness Ritual]] both work from it. GY banishing or \"cannot activate in GY\" effects slow them a lot.",
    ],
    practice=[
        "Going first: open with a hand trap held for [[Ragged Records of Rites]] or Skull Archfiend's GY effect, and see how often they still reach a Ritual boss.",
        "Going second: practise breaking a Magician board. You need a targeting removal for Magician before anything that destroys Spells/Traps.",
        "Drill one interruption at a time: give the list to Synapse AI, choose your opening hand, and restart after each try.",
    ],
    faq=[
        ("Is Light and Darkness Ritual the best deck in the OCG right now?",
         "By results, yes. It is the most played deck among top placings at Japanese events from Oct 7 to Nov 6, 2026 (15.8% of 467 decks), ahead of Elfnote and Raise Moon."),
        ("Why can't my board wipe remove Magician of Dark Chaos?",
         "[[Magician of Dark Chaos - Black Chaos]] is unaffected by your activated effects unless they target it. Use an effect that targets it, or attack it."),
        ("What is the best hand trap against it?",
         "[[Ash Blossom & Joyous Spring]] and [[Droll & Lock Bird]] hit the searches that the deck relies on. Keep a targeting removal for the Ritual bosses as well."),
        ("Which builds exist?",
         "Mitsurugi is the most common variant, followed by Fallen/Branded (the list on this page), Dark Magician and Ars Magna builds."),
        ("Is this list legal?",
         "Yes. It follows the OCG Forbidden & Limited list of Oct 1, 2026. The badge above the list checks it on this page."),
    ],
)

DECKS["ars-magna-elfnote"] = dict(
    name="Ars Magna Elfnote",
    label=("Meta deck", "Synchro · Combo"),
    metaLine="#2 in the OCG · 11.8% of top decks",
    readMin=8,
    art=13597785,
    lead=("Elfnote has been a top OCG deck since mid-2026, and Ars Magna gave it new ways to start. It plays Level 6 "
          "Spellcasters into its center Main Monster Zone, raises their Level with a Tuner and Synchro Summons on either player's turn. "
          "Here is how it wins, where it breaks, and the list that won the 21st Fuwadora Cup."),
    source=dict(text="Winning list from the **21st Fuwadora Cup 3-Person Team Battle** (~114 players, Sep 26, 2026), piloted by やす. Still legal under the Oct 1 list.",
                url="https://ygoprodeck.com/deck/ars-magna-elfnote-734763"),
    how=dict(
        intro=[
            "Elfnote (エルフェンノーツ) cares about one zone: the **center Main Monster Zone**. Its Level 6 Spellcasters ([[Elfnote Lucina]], [[Elfnote Tinia]], "
            "[[Elfnote Fortuna]]) Special Summon themselves there, use a Main Phase effect, and on your turn swap into the center to disrupt you.",
            "[[Elfnote Power Patron]] is the engine. It is a Level 1 Tuner that raises the center monster's Level by 3 as a Quick Effect, then Synchro Summons right away, "
            "so the deck can make Synchro Monsters during your turn. Ars Magna and [[Medius the Pure]] are extra starters that reach Power Patron and the "
            "Elfnote Continuous Spells from the Deck.",
        ],
        keys=[
            "[[Medius the Pure]]: when Normal or Special Summoned, it adds or Special Summons a Power Patron monster from the Deck, usually [[Elfnote Power Patron]].",
            "[[Elfnote Power Patron]]: Quick Effect Level boost and an instant Synchro Summon. When used as Synchro Material it adds any Elfnote card from the Deck.",
            "[[Elfnote Lucina]] searches an Elfnote monster. On your turn it swaps into the center and returns one of your Level 6 or lower monsters to the hand.",
            "[[Elfnote Regina]]: summoned to the center, it Special Summons another Elfnote from the Deck. It returns to the hand after being used as Synchro Material.",
            "[[Elfnote June Pride]] (Level 10): only center-zone monsters can attack. As a Quick Effect it returns to the Extra Deck to summon an Elfnote from the hand, the Deck and the GY.",
            "[[Ars Magna \"Citrinitas\"]] counts as an Elfnote card. It searches a Medius or Ars Magna monster and makes Ars Magna effects Quick Effects. "
            "[[Ars Magna the Finite and the Infinite]] banishes a monster on the field while they control a Power Patron Link Monster.",
        ],
    ),
    line=dict(
        start="[[Medius the Pure]] + [[Elfnote Lucina]]",
        end="[[Elfnote June Pride]] in the center + an extra Elfnote card in hand, with a Quick Effect that summons 3 more Elfnotes",
        steps=[
            ("Normal Summon [[Medius the Pure]] in a side zone and Special Summon [[Elfnote Power Patron]] from the Deck.", "First chokepoint: this Special Summons from the Deck."),
            ("Special Summon [[Elfnote Lucina]] from the hand to the center Main Monster Zone (its own procedure).", None),
            ("Lucina's Main Phase effect adds an Elfnote monster from the Deck, for example [[Elfnote Regina]].", "Second chokepoint: a search."),
            ("[[Elfnote Power Patron]] (Quick Effect) raises Lucina to Level 9, then Synchro Summons [[Elfnote June Pride]] (Level 1 + Level 9).",
             "Power Patron goes to the GY as material and adds an Elfnote card from the Deck, such as [[Elfnotes: Welcome Home]]."),
            ("With June Pride in the center, its Quick Effect can return it to the Extra Deck to Special Summon an Elfnote from the hand (Regina), the Deck and the GY (Lucina).",
             "Regina landing in the center summons yet another Elfnote from the Deck, and the deck keeps building."),
        ],
        note=("They usually stop at June Pride going first and keep its Quick Effect for your turn, so the board grows when you try to interact. "
              "Every step was checked against the card text."),
    ),
    duel=("Load this list into Duel Synapse Arena and goldfish it, or choose the Medius + Lucina hand to drill the line.",
          "Save the list, give it to Synapse AI and practise stopping Elfnote Power Patron before the first Synchro Summon."),
    board=[
        "[[Elfnote June Pride]] in the center: only monsters in your center Main Monster Zone can attack, so you get one attacker. On your turn it can return to the Extra Deck to summon three Elfnotes.",
        "Level 6 Elfnotes swap into the center on your turn: [[Elfnote Lucina]] returns your Level 6 or lower monster, [[Elfnote Tinia]] banishes a random card from your hand until the End Phase, "
        "and [[Elfnote Fortuna]] returns a face-up Spell/Trap to the hand.",
        "[[Elfnotes: Welcome Home]]: their center monster cannot be destroyed by card effects. Banish, bounce or negate it instead.",
        "[[Elfnotes: Rhapsodia of Madness]] (Trap): revives an Elfnote from the GY and, if they control a Synchro Monster, negates one of your face-up cards.",
        "[[Elfnote Seraphim Strelitzia]]: a Quick Effect that revives a Level 6 or lower Elfnote and lowers Levels by 3 so they can Synchro again on your turn.",
        "[[Mediclius the Extraordinary Power Patron]] (Link): negates all your monsters' effects in their Main Phase and can banish itself plus all your cards as a Quick Effect when it points to 3 monsters.",
    ],
    stopIntro=["Elfnote Power Patron is the card that turns their hand into Synchro plays. Most of your best stops are on it, or on the cards that bring it out."],
    stops=[
        ("[[Ash Blossom & Joyous Spring]]", "On [[Medius the Pure]] (it adds or summons from the Deck), [[Elfnote Lucina]]'s search, or Power Patron's add from the Deck.",
         "Hit Medius and Elfnote Power Patron never arrives from that card."),
        ("[[Effect Veiler]] / [[Infinite Impermanence]]", "On [[Elfnote Power Patron]] once it is on the field, before its Quick Effect resolves.",
         "No Level boost and no instant Synchro. It also stops Power Patron's add from the Deck later in the turn."),
        ("[[Droll & Lock Bird]]", "After Lucina's search or Medius adding to the hand.",
         "Power Patron's add-on-Synchro and [[Ars Magna \"Citrinitas\"]]'s search stop for the turn."),
        ("[[Ghost Ogre & Snow Rabbit]]", "When [[Ars Magna \"Citrinitas\"]] or [[Elfnotes: Welcome Home]] uses its effect on the field.",
         "Destroys the Continuous Spell that keeps their engine going."),
        ("[[Nibiru, the Primal Being]]", "After their 5th summon in one turn.",
         "Clears their board. Road of the King suggests pairing Veiler/Impermanence with a hard stop like Nibiru, since Baronne or Crystal Wing can negate a single hand trap."),
        ("[[Mulcharmy Fuwalos]] / [[Maxx \"C\"]]", "At the start of their turn, while you control no cards (Fuwalos).",
         "Elfnote Special Summons from the Deck and Extra Deck many times, so you draw a lot."),
    ],
    takeaways=[
        "Watch the **center Main Monster Zone**. Removing or negating the center monster breaks most of their effects.",
        "Save a negate for [[Elfnote Power Patron]], not just the first card they play.",
        "Their protection ([[Elfnotes: Welcome Home]]) only stops destruction. Banish and bounce still work.",
    ],
    second=[
        "Attack with care: with [[Elfnote June Pride]] in the center, only your center-zone monster can attack.",
        "Expect a Quick Effect Synchro or swap during your turn. Play your strongest negate first, then your removal.",
        "[[Elfnote Tinia]] can banish a random card from your hand on your turn, so do not rely on a single key card.",
        "Bait [[Elfnotes: Rhapsodia of Madness]]: it needs a Synchro Monster on their field to negate.",
    ],
    practice=[
        "Going first: hold [[Effect Veiler]] or [[Infinite Impermanence]] for Elfnote Power Patron and see what they can still make.",
        "Going second: practise breaking June Pride + Welcome Home without destruction effects.",
        "Use the Arena's opening-hand picker to give Synapse AI the Medius + Lucina start every time.",
    ],
    faq=[
        ("Why is the center Main Monster Zone so important?", "Most Elfnote effects only work in the center zone or swap into it, and [[Elfnote Power Patron]] can only raise the Level of the monster there."),
        ("What changed with the Oct 1 list?", "[[Elfnote Lucina]] and [[Elfnote Tinia]] became Limited (1 copy each). The deck still has many starters through Medius and Ars Magna."),
        ("Is Elfnote Power Patron a Power Patron monster?", "Yes. That is why [[Medius the Pure]] can Special Summon it from the Deck."),
        ("What is the best hand trap against Ars Magna Elfnote?", "[[Effect Veiler]] or [[Infinite Impermanence]] on Elfnote Power Patron, and [[Ash Blossom & Joyous Spring]] on Medius. Pair them with a hard stop like [[Nibiru, the Primal Being]]."),
        ("Is this list legal?", "Yes, it follows the OCG Forbidden & Limited list of Oct 1, 2026 (Lucina and Tinia at 1)."),
    ],
)

DECKS["raise-moon"] = dict(
    name="Raise Moon",
    label=("Meta deck", "Xyz · Draw control"),
    metaLine="#3 in the OCG · 10.5% of top decks",
    readMin=7,
    art=75934716,
    lead=("The newest deck in the OCG top three plays like a casino. It never searches. It draws, and its Level 7 monsters "
          "Special Summon themselves when drawn, often on your turn. It also turns your searches into draws. Here is how it wins, "
          "where it breaks, and the list that won the 7th Kinjito Cup."),
    source=dict(text="Winning list from the **7th Kinjito Cup** (~36 players, Oct 4, 2026), piloted by 斉藤伸也.",
                url="https://ygoprodeck.com/deck/raise-moon-736318"),
    how=dict(
        intro=[
            "Raise Moon (レイズ・ムーン) comes from Deck Build Pack: Glorious Victors. Its Level 7 monsters share one idea: **when you draw them, reveal them and Special Summon them**. "
            "Each one then does something: [[Raise Moon Blade Shayna]] puts one of your monsters on the bottom of the Deck, and [[Raise Moon Lamp Croucier]] does the same to a Spell/Trap.",
            "So the deck wants to draw at instant speed, especially on your turn. Its Rank 7 LIGHT Xyz Monsters, hand traps that draw ([[Raise Moon Starter Squeeze]], "
            "[[Maxx \"C\"]], the Mulcharmy cards) and [[The Stars of Raise Moon]], which stacks a chosen card on top of the Deck, make that happen. "
            "Most cards stop them adding from the Deck except by drawing, which costs them nothing.",
        ],
        keys=[
            "[[Cielo, the Night Sky of Raise Moon - No More Bets!]] (Rank 7, in the Extra Monster Zone): unaffected by other cards' effects. "
            "When your effect would add from the Deck to your hand, they can change it to \"draw 1 card\". Once per turn it detaches to draw as a Quick Effect.",
            "[[Raise Moon Hope Squeeze - Jackpot]]: your monsters can only attack it. When it is Xyz Summoned, or a monster is Special Summoned from the hand, "
            "it puts your cards on the bottom of the Deck, one per material detached.",
            "[[Raise Moon Wings Rapi]]: once per your turn it Xyz Summons a Rank 7 LIGHT monster as a Quick Effect.",
            "[[The Stars of Raise Moon]]: puts a chosen Raise Moon card on top of their Deck. After it resolves, neither player can add from the Deck except by drawing this turn.",
            "[[Raise Moon Starter Squeeze]]: a hand trap. For the rest of that turn, every time you add a card to your hand other than by drawing, they draw 1.",
            "[[\"Raise Moon\" the City that Never Sleeps]]: each Level 7 Raise Moon survives the first destruction by card effect each turn, and it shuffles their GY and banished Raise Moon cards back every End Phase.",
        ],
    ),
    line=dict(
        start="[[Raise Moon Elegance Carol]] + [[Cielo, the Veil of Raise Moon]] + [[The Stars of Raise Moon]] + 1 card",
        end="[[Cielo, the Night Sky of Raise Moon - No More Bets!]] in the Extra Monster Zone, a known Raise Moon monster on top of the Deck",
        steps=[
            ("Normal Summon [[Raise Moon Elegance Carol]] without Tributing (its ATK becomes 700) and draw 1.",
             "For the rest of the turn they can only Special Summon LIGHT Xyz Monsters from the Extra Deck."),
            ("[[Cielo, the Veil of Raise Moon]]: put 1 other card from the hand on the bottom of the Deck to Special Summon it.", None),
            ("Overlay the two Level 7s into [[Cielo, the Night Sky of Raise Moon - No More Bets!]] in the Extra Monster Zone.",
             "In that zone it is unaffected by other cards' effects."),
            ("Activate [[The Stars of Raise Moon]] to put [[Raise Moon Blade Shayna]] on top of the Deck.",
             "Ash Blossom cannot stop this: placing a card on top of the Deck is not a search."),
            ("On your turn, No More Bets detaches to draw Shayna as a Quick Effect. Shayna reveals itself, Special Summons itself and puts one of your monsters on the bottom of the Deck.",
             "This is the deck's main trick: removal that is drawn on your turn."),
        ],
        note=("They don't search, so Ash Blossom has almost nothing to hit. Expect a draw on your turn to become a monster that removes your board. "
              "Every step was checked against the card text."),
    ),
    duel=("Load this list into Duel Synapse Arena and goldfish it to see how often you draw into a Level 7 on the opponent's turn.",
          "Save the list, give it to Synapse AI and practise playing through No More Bets without searching."),
    board=[
        "[[Cielo, the Night Sky of Raise Moon - No More Bets!]] in the Extra Monster Zone is unaffected by other cards' effects. Beat it in battle or stop it before it lands. "
        "It also turns your searches into draws.",
        "[[Raise Moon Hope Squeeze - Jackpot]] makes your monsters attack only it, and it can put several of your cards on the bottom of the Deck whenever a monster is Special Summoned from the hand. "
        "Each time you make cards leave your own Deck other than by drawing, it attaches your top card as material.",
        "[[Raise Moon Wings Rapi]] Xyz Summons a Rank 7 LIGHT monster on your turn, as a Quick Effect.",
        "[[The Glitter of Raise Moon]] (Trap) Special Summons a Raise Moon Xyz Monster from the Extra Deck and shuffles their Raise Moon cards back.",
        "Any card they draw on your turn might be [[Raise Moon Blade Shayna]] (removes a monster) or [[Raise Moon Lamp Croucier]] (removes a Spell/Trap).",
    ],
    stopIntro=["Raise Moon draws instead of searching, so the usual hand traps change value. Stop the draws, not the searches."],
    stops=[
        ("[[Droll & Lock Bird]]", "After their first draw outside the Draw Phase.",
         "Droll stops all adding from the Main Deck to the hand for the turn, and that includes drawing. Their whole engine stops."),
        ("[[Effect Veiler]] / [[Infinite Impermanence]]", "On [[Raise Moon Elegance Carol]] or [[Raise Moon Wings Rapi]] when their draw-on-summon activates, or on Rapi's Quick Effect Xyz.",
         "No draw and no Rank 7 on your turn. Do not aim them at No More Bets in the Extra Monster Zone, because it is unaffected."),
        ("[[Ghost Ogre & Snow Rabbit]]", "When a Raise Moon monster on the field activates its effect, or when the [[\"Raise Moon\" the City that Never Sleeps]] Continuous Spell activates its draw effect.",
         "Destroys it. City's protection only covers Level 7 Raise Moon monsters, not the Spell itself."),
        ("[[Ash Blossom & Joyous Spring]]", "Few targets: their draws and top-of-Deck stacking are not searches.",
         "Side it out, or keep it for the splashed cards."),
        ("Mind on Air", "Before they reveal drawn monsters.",
         "Road of the King notes it in Raise Moon mirror side decks: with the hand already revealed, the \"reveal when drawn\" cost cannot be paid."),
        ("Banish / non-destruction removal", "On Level 7 Raise Moon monsters.",
         "City that Never Sleeps stops the first destruction each turn. Banishing skips that, and also skips the End Phase shuffle."),
    ],
    takeaways=[
        "**Stop the draw, not the search**: [[Droll & Lock Bird]] and the monster-negating hand traps are the high-value cards here.",
        "Don't search into [[Raise Moon Starter Squeeze]] or [[Cielo, the Night Sky of Raise Moon - No More Bets!]]. Your search may turn into their draw, or into a plain draw for you.",
        "Count the cards in their hand on your turn. Any of them can come out as removal if they draw at instant speed.",
    ],
    second=[
        "No More Bets ignores card effects in the Extra Monster Zone. Plan to beat it in battle: it has 2100 ATK.",
        "Hope Squeeze – Jackpot forces attacks into itself. Remove it before attacking anything else.",
        "Play cards that summon or draw instead of search when you can. Their whole board punishes searching.",
        "Remember their monsters only come out when drawn or by their own effects. If they have no draw left this turn, the threat is low.",
    ],
    practice=[
        "Going first: open [[Droll & Lock Bird]] and test what Raise Moon can still do after the first draw.",
        "Going second: practise a line that beats a 2100 ATK No More Bets in battle without searching.",
        "In the Arena, give Synapse AI this list and let it go first so you see No More Bets every game.",
    ],
    faq=[
        ("Does Ash Blossom stop Raise Moon?", "Barely. Drawing and putting a card on top of the Deck are not searches. [[Droll & Lock Bird]] is far better: it stops drawing too."),
        ("Why can't I target No More Bets?", "[[Cielo, the Night Sky of Raise Moon - No More Bets!]] is unaffected by other cards' effects while in the Extra Monster Zone. Battle is the clean answer."),
        ("Can Raise Moon search?", "Most of its cards stop it adding from the Deck except by drawing, for the turn or the whole Duel (Starter Squeeze, Glitter). It is built not to."),
        ("Where do Raise Moon cards come from?", "OCG Deck Build Pack: Glorious Victors (DBGV), released in September 2026."),
        ("Is this list legal?", "Yes, it follows the OCG Forbidden & Limited list of Oct 1, 2026."),
    ],
)

HUB = dict(
    lead=("The three decks that top OCG events right now: how each one wins, where its turn breaks, a legal winning list with today's Yuyu-tei price, "
          "and a one-tap playtest in Duel Synapse Arena."),
    table=[("Light and Darkness Ritual", 15.8), ("Elfnote", 11.8), ("Raise Moon", 10.5), ("Sacred Beasts", 9.4), ("Mitsurugi", 5.6),
           ("Power Patron", 4.3), ("Ars Magna", 4.3), ("Maliss", 3.9), ("Sky Striker", 2.8), ("Clown Crew", 2.8)],
    practice=["Every deck page has its winning list ready for Duel Synapse Arena. Open it with one tap, goldfish it, choose your opening hand, "
              "or save it and let Synapse AI play it against your own deck.",
              "Track your real results too: the KodeX app has a match log that shows your win rate going first and second against each of these decks."],
)

WHY = dict(
    lead="KodeX is Meta Insider OCG's card and rulings app for OCG players, with deck tools, live prices and its own duel Arena built in.",
    what=["KodeX started in 2023 as a fast way to look up OCG cards and their official rulings. It has grown into a full toolkit for building, checking, "
          "pricing and playtesting decks, made in the Philippines for players who follow the OCG."],
    features=[
        dict(i="🔎", t="Cards and official rulings", d="Search every card and read the official Q&A rulings, translated, on any card. Works offline once you save the database."),
        dict(i="📷", t="Card scanner", d="Point the camera at a card, in any language, and KodeX finds it. Built for Japanese OCG cards, with artwork matching.", tag="App only"),
        dict(i="🧩", t="Deck builder", d="Build decks with drag and drop. Import or export .ydk files, ydke:// deck links and plain text lists, and share a deck image."),
        dict(i="✅", t="OCG legality check", d="Every deck shows whether it is OCG legal: Forbidden, Limited and Semi-Limited cards, the 3-copy rule and deck sizes."),
        dict(i="📊", t="Synapse Deck Analyzer", d="Starters, opening-hand odds, brick rates going first and second, and how your deck performs in Arena duels."),
        dict(i="📝", t="Match log", d="Log games from locals and events: result, going first or second, the opponent's deck. See your win rate against each matchup."),
        dict(i="💴", t="Live prices", d="Yuyu-tei standard prices with history, in yen, pesos and dollars. Every deck page on meiocg.org shows its build price.", tag="On meiocg.org"),
        dict(i="🏅", t="Player profile", d="Your name, title, icon and a frame that levels up as you use KodeX, shown to opponents in the Arena. Opt in to appear on MEIOCG Players."),
        dict(i="⚔️", t="Duel Synapse Arena", d="Play your decks in the browser or the app: against Synapse AI, a practice dummy, or a friend online."),
    ],
    arena=dict(
        intro=["Duel Synapse Arena runs a full rules engine in your browser, so every duel follows the real card rulings. Open any KodeX deck in it with one tap."],
        points=[
            "**Synapse AI** develops its board, holds hand traps for your turn and learns combo lines from the duels people play.",
            "**Goldfish testing** against a dummy that never responds, and you can **choose your opening hand**.",
            "Synapse AI can play **any of your saved decks**, so you can practise against the meta decks on meiocg.org.",
            "**Online rooms** with an invite link, spectators, chat and rematch.",
            "Replays you can save (Premium) and watch at ½× to 4×.",
            "Every card in the duel links to its KodeX rulings page.",
        ],
    ),
    plans=[
        ("Card search and official rulings", True, True), ("Deck builder, import/export, OCG legality check", True, True),
        ("Deck Analyzer and match log", True, True), ("Duel Synapse Arena", True, True),
        ("Card scanner", "4 scans per day", "Unlimited"), ("Ads", "Yes", "No ads"),
        ("Player profile and icon frames earned by use", True, True), ("Own profile picture, animated banners, Premium frame", False, True),
        ("Premium Studio: skins, showdowns, Ace cards, emotes", False, True), ("Save duel replays", False, True),
    ],
    not_=[
        "Not an official Konami product. KodeX is an independent fan project.",
        "Not a store. Prices come from Yuyu-tei listings and are a guide only.",
        "Not a ranked ladder yet. Online duels are friendly rooms for practice and playtesting.",
    ],
    get=["KodeX runs in your browser today at kodex.meiocg.org. The Android app is coming to Google Play."],
    faq=[
        ("Is KodeX free?", "Yes. KodeX Premium removes ads and unlocks unlimited scans, Premium Studio and replays."),
        ("Does KodeX use the OCG or TCG list?", "The OCG Forbidden & Limited list. The legality check updates with the card database."),
        ("Can I import my existing decks?", "Yes: .ydk files, ydke:// links and plain text lists like \"3 Ash Blossom & Joyous Spring\" all work."),
        ("Where do rulings come from?", "The official Q&A database, mirrored and kept up to date by KodeX, with translations."),
        ("What is MEIOCG Players?", "A page on meiocg.org that lists KodeX players who opt in from their profile, ranked by how active they are."),
        ("Who makes KodeX?", "Meta Insider OCG (MEIOCG), a Philippine OCG publication. Contact: metainsiderocg@gmail.com."),
    ],
)


# Date stamp shown on every decklist ("OCG · Nov 2026 list"). When the OCG list changes, set archived=True on the old
# deck entries (their pages stay up with an "Archived list" banner) and add them to ARCHIVE with the list they were legal on.
LIST_TAG = "OCG · Nov 2026 list"
ARCHIVE = []   # e.g. dict(slug="raise-moon", name="Raise Moon", tag="OCG · Nov 2026 list", banlist="OCG list of Oct 1, 2026")

# Guides: learn to pilot each meta deck. Lessons 1-3 are free on meiocg.org; the rest are KodeX Premium lessons.
GUIDES = dict(
    lead=("Learn to pilot the decks that top OCG events. Each guide starts with three free lessons: what the deck wants to do, "
          "its core line step by step, and where opponents will try to stop you. Every lesson ends with a drill in Duel Synapse Arena."),
    premium=[("Playing through hand traps", "Which follow-up to take after each common interruption."),
             ("Going second", "Breaking the boards you'll face and the cards to side in."),
             ("Side deck and matchups", "What to bring in and take out against the rest of the meta.")],
    premiumNote=("Premium lessons are being written now and will open in the KodeX app for KodeX Premium players. "
                 "The free lessons stay free."),
)
CUP = dict(
    lead=("The MEIOCG Cup is Meta Insider OCG's community tournament for OCG players: Swiss rounds, the current OCG Forbidden & Limited list, "
          "and the top decks published on meiocg.org with full lists you can open in Duel Synapse Arena."),
    status="Next Cup: date to be announced",
    statusNote="Follow MEIOCG on Facebook for the date, venue or online room, and sign-up.",
    format=[
        "**OCG format**, current OCG Forbidden & Limited list (" + BANLIST + " until the next list).",
        "**Swiss rounds**, best of three, run with the MEIOCG Swiss Tournament Manager. The number of rounds depends on how many players join.",
        "**Deck registration** with a KodeX deck link (ydke://) or a text list. KodeX checks your deck is OCG legal before you send it.",
        "**Results published**: standings, the top decks as full lists, and the winning deck written up as a meiocg.org deck page.",
    ],
    steps=[("Build and check", "Build your deck in KodeX. The legality bar under the deck must say ✓ OCG legal."),
           ("Practise", "Playtest it in Duel Synapse Arena against the meta decks on meiocg.org."),
           ("Register", "Send your deck link or text list when sign-up opens."),
           ("Play", "Report each round's result to the organiser; standings update after every round.")],
    faq=[("How much does it cost to join?", "Each Cup's entry and prizes are announced with its date."),
         ("Online or in person?", "Each Cup's announcement says whether it is played online or in person."),
         ("Which list do you use?", "The OCG Forbidden & Limited list in force on the day of the Cup."),
         ("Where do results go?", "On meiocg.org, with the top lists and a deck page for the winner. Older Cup lists stay in the deck archive."),
         ("Who runs it?", "Meta Insider OCG (MEIOCG). Contact: metainsiderocg@gmail.com.")],
    past=[],   # dict(name="MEIOCG Cup #1", date="2026-12-06", players=32, winner="…", deck="…", href=URL("…"))
)
PLAYERS = dict(
    lead=("KodeX players who chose to be listed, ranked by how active they are. Frames unlock as you use KodeX: "
          "Rookie, Bronze, Silver, Gold, Platinum, Diamond and Master, plus the Premium frame for KodeX Premium."),
    how=["Open KodeX → Settings → Profile → Edit profile and turn on **Show me on MEIOCG Players**.",
         "Points come from using KodeX: each day you open it, each duel in Duel Synapse Arena, each deck you build and the cards you look up.",
         "Only what your profile shows is listed: name, title, about line, preset icon, frame and activity counts. No email or account. Turn it off and you're removed."],
)


# meiocg.org/duelsynapse: the KodeX / Duel Synapse landing page. Card art in the demos is real art from the KodeX
# database (kodex.meiocg.org/img/<passcode>.jpg). Set PLAY_FREE when the free app's Play listing is live.
DS = dict(
    play_free="",   # e.g. "https://play.google.com/store/apps/details?id=…"
    # Live meiocg.org/duelsynapse (Nov 9, 2026) still says KodeX and Premium are "coming soon" to Google Play: keep that until the listings are live.
    play_premium="",  # e.g. "https://play.google.com/store/apps/details?id=com.duelsynapse.kodex.premium"
    web="https://kodex.meiocg.org",
    # Text below keeps the wording from the live DashNex page (hero, features, scanner, plans, get-the-app) and adds the new features.
    tagline="Every card. Every ruling. In your pocket.",
    lead=("The Yu-Gi-Oh! card and rulings app from Meta Insider OCG. Search any card in seconds, settle table disputes with official rulings, "
          "and scan cards straight from your camera. Then build legal OCG decks and playtest them in the Duel Synapse Arena."),
    chips=["Free to download", "OCG & TCG cards", "Play with Friends"],
    why_title="Built for the table, not the textbook.",
    why_lead="Everything you need between rounds, at locals or at regionals — fast, clean and made for your phone.",
    cards=dict(ace=93481594, ash=14558127, maxx=23434538, finisher=86066372, dm=46986414, bewd=89631139, dmg=38033121, veiler=97268402, nibiru=27204311, snake=9674034),
    features=[
        ("🔎", "Instant card search", "Find any Monster, Spell or Trap by name or text. Filter by type and jump straight to the details, with the OCG Forbidden & Limited status on every card."),
        ("⚖️", "Rulings that settle it", "Read card rulings and interactions in one place, so the judge call is clear before the argument starts."),
        ("📷", "Card scanner", "Point your camera at a card and KodeX identifies it — even Japanese cards, recognised by their artwork. **App exclusive.**"),
        ("⚔️", "Arena playtesting (and more)", "Test your deck or duel online in the KodeX Arena — perfect for tuning your list before the next event. Play Synapse AI or a dummy, choose your opening hand, set a turn timer or play best-of-three."),
        ("🧩", "Decks that check themselves", "Build, import deck links, files or text lists, and see at a glance if a deck is OCG legal."),
        ("🔄", "Always up to date", "Kept current by Meta Insider OCG — the team behind PH's leading Yu-Gi-Oh! OCG publication."),
        ("🏁", "Duel endings", "A finishing move breaks the loser's field, their profile icon cracks and shatters, a comeback moment when you turn it around, then a winner screen with your finishing card."),
        ("🎨", "Make it yours", "Adjust text size, toggle card pictures and set your own wallpaper for a KodeX that feels like your deck box."),
        ("🏅", "Your profile", "Name, title, icon and a frame that levels up as you use KodeX: Rookie to Master. Opponents see it in every duel."),
        ("❓", "Help bubble", "Find any feature or setting by name, open the banlist and quick settings from anywhere, even mid-duel."),
    ],
    premium=[
        ("ace", "Ace showdowns", "Your Ace cards take the whole screen when they're summoned, activated or added to the hand, and nothing covers them."),
        ("finish", "Finishing moves", "Shatter, Meteor, Thunder, Vortex or Slash: the loser's field and profile icon crack and break before the result."),
        ("staple", "Staple animations", "Ash Blossom, Maxx \"C\", Effect Veiler, Nibiru and more get their own cut-in for everyone (free too, and you can turn them off)."),
        ("frames", "Profile frames", "Frames from Rookie to Master for everyone; Premium adds the Premium frame, your own picture or GIF and animated banners."),
        ("win", "Winner screen", "Your profile, your finishing card and YOU WIN, with a secret comeback moment when you turn the duel around."),
    ],
    compare=[("Ads", "Sponsor strip", "None"), ("Card scans", "4 a day", "Unlimited"), ("Winning showdowns", "Menacing", "13 styles + Random"),
             ("Ace cards", "–", "✓"), ("Finishing moves", "Shatter", "5 + one per card"), ("Profile", "MEIOCG icon, presets, earned frames", "Own picture, animated banner, Premium frame"),
             ("Skins, emotes, music", "–", "✓")],
    # The live Arena demo (kodex.meiocg.org/duel/showcase.html): real cards and the Arena's own animation code.
    arena_demo="https://kodex.meiocg.org/duel/showcase.html",
    arena_scenes=["Playtest setup", "Summon entrance", "Staple cut-in", "Revealed card", "Ace showdown", "Turn timer", "Finishing move", "Comeback", "Winner screen"],
    scanner=dict(kicker="Only in the app", title="Scan it. Know it. Play it.",
                 lead="The KodeX scanner is the fastest way to look up a card you're holding — no typing, no guessing the English name.",
                 points=["Recognises artwork, not just printed text", "Works with Japanese cards — ideal for OCG players", "Jumps straight to rulings for the card you scanned"]),
    plans_title="Download free. Go Premium when you're ready.",
    plans_lead="KodeX is free on Google Play. Duel Synapse Premium is on the way for players who want more.",
    plans=[dict(name="KodeX Free", price="₱0 · Google Play", items=["Full card search and rulings", "Camera card scanner", "Arena deck playtesting", "Custom wallpaper & display settings"]),
           dict(name="Duel Synapse Premium", price="Subscription · in-app", tag="Coming soon", items=["Remove all ads", "Exclusive premium features", "Support MEIOCG and the PH community"])],
    get_kicker="Step up your game",
    get_title="Get KodeX on your phone.",
    get_lead="KodeX is landing on Google Play soon. Until then, use the full web version — it's free.",
    qr_note="On your computer? Scan with your phone to open KodeX on Google Play.",
    trial="New to Premium? The free app has a one-time 5-day KodeX Premium trial in Settings: every feature, no ads, nothing charged, and it ends on its own.",
    faq=[("Is KodeX free?", "Yes. The free edition has everything for cards, rulings, decks and the Arena, with a small sponsor strip. KodeX Premium removes it and adds the showdowns, skins and profile extras."),
         ("Which format does KodeX follow?", "The OCG: its Forbidden & Limited list and legality checks. TCG cards are in the card database too."),
         ("Can I duel my friends?", "Yes. Open a room in the Arena and send the invite link; friends can also watch."),
         ("Do I need an account?", "No. Your decks, profile and settings stay on your phone. Being listed on MEIOCG Players is optional."),
         ("Who makes KodeX?", "Meta Insider OCG (MEIOCG), created by Castel Noleal. A project of Meta Insider OCG since 2023.")],
)
