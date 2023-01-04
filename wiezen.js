const PROMPT = require("prompt-sync")({ sigint: true });

const STACK = 'stack'
const HAND = 'hand'
const TABLE = 'table'
const TRICK = 'trick'
const COLORS = ['♥', '♠', '♦', '♣']
const VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
const DECK = []
const PLAYERS = ['Joe', 'Jack', 'William', 'Avarell']

COLORS.forEach((c, ci) => {
    VALUES.forEach((v, vi) => {
        DECK.push({
            color: c,
            value: v,
            order: 13 * ci + vi,  // only for comparing
            state: STACK,
            trump: null,  // boolean
            stack: 13 * ci + vi + 1,  // range 1..52
            hand: null,  // name of the player
            table: null,  // range 1..4
            player: null, // name of the player
            trick: null, // range 1..13
            winner: null  // name of the player
        })
    })
})

function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min); // The maximum is inclusive and the minimum is inclusive
}

function cut() {
    // pick random position in DECK
    let p = getRandomIntInclusive(1, 51)  // p is how many cards you pick up
    // stack positions [1..p] become [52-p+1..52]
    // stack positions [p+1..52] become [1..52-p]
    DECK.forEach((card, cardi) => cardi <= p ? card.stack += 52 - p : card.stack -= p)
    console.log(`Deck cut at position ${p}`)
}

function get_cards_in_stack_order() {
    let stack = DECK.filter(card => card.state === STACK)
    let ordered_stack = [...stack].sort((card1, card2) => card1.stack - card2.stack)
    return ordered_stack
}


function deal(players) {
    // player after dealer is first player
    function deal_cards_to_player(cards_list, player) {
        cards_list.forEach(card => {
            // MOVE CARD FROM STACK TO HAND
            card.state = HAND
            card.hand = player
            card.stack = null
        })
    }
    function set_trump(color) {
        DECK.filter(card => card.color === color).forEach(card => card.trump = true)
        DECK.filter(card => card.color != color).forEach(card => card.trump = false)
    }
    let cards_in_stack_order = get_cards_in_stack_order()
    set_trump(cards_in_stack_order[47].color)  // 5th-latest card in stack
    let amounts = [4,4,5]
    amounts.forEach(amount => {
        players.forEach(player => {
            deal_cards_to_player(cards_in_stack_order.splice(0,amount), player)
        })
    })
}

function cards_to_string(cards, numbered) {
    return cards.map((card, cardi) => card.color + card.value 
        + (card.trump?'*':'') 
        + (numbered?`[${cardi}]`:'')).toString()
}


function play(player) {
    // look at table cards to set playable 
    let cards_on_table = DECK.filter(card => card.table != null)
    let hand = DECK.filter(card => card.hand === player)
    let playable_cards = []
    if (cards_on_table.length > 0) {
        // only cards with same color as opening card are playable
        // if there are none, any card is playable
        let opening_card = cards_on_table.filter(card => card.table === 1).pop()
        playable_cards.push(...hand.filter(card => card.color === opening_card.color))
        if (playable_cards.length === 0) {
            // no cards with same color, so all cards are playable
            playable_cards.push(...hand)
        }
    } 
    else {
        // all cards are playable
        playable_cards.push(...hand)
    }
    // show cards to player (indicating playable cards) with index for easy selecting
    console.log(`Table: ${cards_to_string(cards_on_table)}`)
    console.log(`Hand of ${player}: ${cards_to_string(hand)}`)
    console.log(`Play card from: ${cards_to_string(playable_cards, true)}`)
    // prompt player for input
    let idx
    do {
        idx = parseInt(PROMPT("Which card will you play? "));
    } while (isNaN(idx) || idx < 0 || idx >= playable_cards.length)
    let card = playable_cards[idx]
    // MOVE CARD FROM HAND TO TABLE
    card.state = TABLE
    card.table = cards_on_table.length + 1
    card.player = player
    card.hand = null
}

function evaluate_trick(cards) {
    // returns the (temporary) winner of the trick composed of input cards
    function highest_value_card(cards) {
        // regardless color!
        return cards.reduce((highest,card) => card.value > highest.value ? card : highest, cards[0])
    }
    let highest_trump = highest_value_card(cards.filter(card => card.trump))
    if (highest_trump && highest_trump.length > 0) 
        return highest_trump.player
    let opening_card = cards.filter(card => card.table === 1).pop()
    let highest = highest_value_card(cards.filter(card => card.color === opening_card.color))
    return highest
}

function collect_trick(trick) {
    // evaluate trick to identify winner 
    let cards_on_table = DECK.filter(card => card.table != null)
    let winning_card = evaluate_trick(cards_on_table)
    console.log(`Trick won by ${winning_card.player} (${cards_to_string([winning_card])}): ${cards_to_string(cards_on_table)}`)
    cards_on_table.forEach(card => {
        // MOVE CARD FROM TABLE TO TRICKS
        card.state = TRICK
        card.table = null
        card.trick = trick
        card.winner = winning_card.player
    })
    return winning_card.player
}

function dump() {
    // print contents of stack
    let ordered_stack = get_cards_in_stack_order()
    console.log(`Stack: ${cards_to_string(ordered_stack)}`)
    PLAYERS.forEach(player => {
        console.log(`Hand of ${player}: ${cards_to_string(DECK.filter(card => card.hand === player))}`)
    })
}

function rotate_players(first_player) {
    let players = [...PLAYERS]
    while (players[0] != first_player) {
        players.push(players.shift())
    }
    return players
}

cut()

let next_player = PLAYERS[2]
let players = rotate_players(next_player)

deal(players)

let tricks = [1,2,3,4,5,6,7,8,9,10,11,12,13]
tricks.forEach(trick => {
    players.forEach(player => {
        play(player)
    })
    next_player = collect_trick(trick)
    players = rotate_players(next_player)
})

dump()

