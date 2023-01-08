const PROMPT = require("prompt-sync")({ sigint: true });
const PAS = 'pas'
const RONDEPAS = 'ronde pas'
const VRAAG = 'vraag'
const ABONDANCE_H = 'abondance in ♥'
const ABONDANCE_S = 'abondance in ♠'
const ABONDANCE_D = 'abondance in ♦'
const ABONDANCE_C = 'abondance in ♣'
const ABONDANCE_TROEF = 'abondance in troef'
const MISERIE = 'miserie'
const TROEL = 'troel'
const MISERIE_TAFEL = 'miserie op tafel'
const SOLO_H = 'solo in ♥'
const SOLO_S = 'solo in ♠'
const SOLO_D = 'solo in ♦'
const SOLO_C = 'solo in ♣'
const SOLO_SLIM = 'solo slim'
const MEE = 'meegaan'
const ALLEEN = 'alleen'
const GAMES = [VRAAG, ABONDANCE_H, ABONDANCE_S, ABONDANCE_D, ABONDANCE_C, 
    ABONDANCE_TROEF, MISERIE, TROEL, MISERIE_TAFEL, SOLO_H, SOLO_S, SOLO_D, SOLO_C, 
    SOLO_SLIM, PAS]
const STACK = 'stack'
const HAND = 'hand'
const TABLE = 'table'
const TRICK = 'trick'
const HEARTS = '♥'
const SPADES = '♠'
const DIAMONDS = '♦'
const CLUBS = '♣'
const COLORS = [HEARTS, SPADES, DIAMONDS, CLUBS]
const VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
const NUMBER_OF_TRICKS = VALUES.length

class Wiezen {
    #deck  // object
    #players  // array of strings ** DO NOT CHANGE ** 
    #dealer  // string ** THIS IS UPDATED AFTER EACH GAME **
    #trump
    #score  // scores by player
    #game_number  // numbering games 0,1,2,...; a game number stands until a game is actually played!
    #rondepas_count  // counting subsequent rondepas
    #scorefactors  // array of multipliers for each game
    
    constructor(players) {
        this.#players = [...players]
        this.#dealer = this.#players[0]
        this.#trump = null
        this.#deck = []
        this.#score = {}
        this.#game_number = 0
        this.#rondepas_count = 0
        this.#scorefactors = []
        COLORS.forEach((c, ci) => {
            VALUES.forEach((v, vi) => {
                this.#deck.push({
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
        players.forEach(player => this.#score[player] = 0)
    }

    dealer() {
        return this.#dealer
    }

    cut() {
        function getRandomIntInclusive(min, max) {
            min = Math.ceil(min);
            max = Math.floor(max);
            return Math.floor(Math.random() * (max - min + 1) + min); // The maximum is inclusive and the minimum is inclusive
        }
        // pick random position in DECK
        let p = getRandomIntInclusive(1, 4 * NUMBER_OF_TRICKS - 1)  // p is how many cards you pick up
        // stack positions [1..p] become [52-p+1..52]
        // stack positions [p+1..52] become [1..52-p]
        this.#deck.forEach((card, cardi) => cardi <= p ? card.stack += 4 * NUMBER_OF_TRICKS - p : card.stack -= p)
        console.log(`Deck cut at position ${p}`)
    }

    deal() {
        function deal_cards_to_player(cards_list, player) {
            cards_list.forEach(card => {
                // MOVE CARD FROM STACK TO HAND
                card.state = HAND
                card.hand = player
            })
        }
        // player after dealer is first player
        let players = this.rotate_players(this.player_after(this.#dealer))
        // get cards in stack order
        let stack = this.#deck.filter(card => card.state === STACK)
        let cards_in_stack_order = [...stack].sort((card1, card2) => card1.stack - card2.stack)
        this.#set_trump(cards_in_stack_order[4 * NUMBER_OF_TRICKS - 1].color)  // latest card in stack
        let amounts = [4,4,5]  // should be calculated based on NUMBER_OF_TRICKS for debugging fast games
        amounts.forEach(amount => {
            players.forEach(player => {
                deal_cards_to_player(cards_in_stack_order.splice(0,amount), player)
            })
        })
        let hands = {}
        players.forEach(player => {
            hands[player] = this.#deck.filter(card => card.hand === player)
        })
        return hands
    }

    initialize_bid() {
        let games = [...GAMES].filter(game => !game.includes(this.#trump))
        return {
            game: PAS,
            game_players: [],
            games_open: games,
            games_open_mee: null,
            players_bidding: [...this.#players],  // /!\ not necessarily in right order yet !
            player: this.#dealer,  // player after dealer is to bid first 
            count_bids: 0,
            score_factor: this.#scorefactors[this.#game_number]       
        }
    }

    bid_request(state) {
        state.games_open_mee = [...state.games_open]
        if (state.games_open.includes(ALLEEN)) {
            state.player = state.game_players[0]
        } else {
            // next player in players_bidding who is not a game player is to bid now 
            do { 
                state.player = this.player_after(state.player, {list: state.players_bidding})
            } while (state.game_players.includes(state.player))
            // add MEE when applicable (VRAGEN only allows one player to bid MEE)
            if ([VRAAG, MISERIE, MISERIE_TAFEL].includes(state.game))
                if ( ! (state.game === VRAAG && state.game_players.length >= 2) )
                    state.games_open_mee.push(MEE)
        }
        return state
    }

    bid(state, bid) {
        switch (bid) {
            case MEE:
                state.game_players.push(state.player)
                state.players_bidding = state.players_bidding.filter(p => p != state.player)
                break
            case PAS:
                if (state.games_open.includes(ALLEEN)) 
                    state.game = PAS
                state.players_bidding = state.players_bidding.filter(p => p != state.player)
                break
            case ALLEEN:
                state.game = bid
                state.players_bidding = []
                break
            case VRAAG:
            case ABONDANCE_H:
            case ABONDANCE_S:
            case ABONDANCE_D:
            case ABONDANCE_C:
            case ABONDANCE_TROEF:
            case MISERIE:
            case TROEL:
            case MISERIE_TAFEL:
            case SOLO_H:
            case SOLO_S:
            case SOLO_D:
            case SOLO_C:
            case SOLO_SLIM:
                if (state.game_players.length > 0)
                    // players that have bid a lower game can bid again
                    state.players_bidding.push(...state.game_players)
                state.game = bid
                state.game_players = [state.player]
                state.players_bidding = state.players_bidding.filter(p => p != state.player)
                while (state.games_open[0] != bid) state.games_open.shift()
                    state.games_open.shift()  // remove this game and lower games
        }
        if (++state.count_bids === 4) {
            // after a first round, TROEL should be removed
            state.games_open = state.games_open.filter(game => game != TROEL)
            // if game is still VRAAG and there's one game player, he can choose to bid ALLEEN
            if (state.game === VRAAG && state.game_players.length === 1) {
                state.games_open = [ALLEEN, PAS]
                state.players_bidding.push(state.game_players[0])
            }
        }
        return state
    }

    initialize_play(bidding_state) {
        // change trump if needed and set first player
        let next_player = this.player_after(this.#dealer)  // player after dealer is to play first by default
        switch (bidding_state.game) {
            case ABONDANCE_H:
            case SOLO_H:
                this.#set_trump(HEARTS)
                next_player = bidding_state.game_players[0]
                break
            case ABONDANCE_S:
            case SOLO_S:
                this.#set_trump(SPADES)
                next_player = bidding_state.game_players[0]
                break
            case ABONDANCE_D:
            case SOLO_D:
                this.#set_trump(DIAMONDS)
                next_player = bidding_state.game_players[0]
                break
            case ABONDANCE_C:
            case SOLO_C:
                this.#set_trump(CLUBS)
                next_player = bidding_state.game_players[0]
                break
            case TROEL:
                let aces = this.#deck.filter(card => card.value === 'A')
                let troel_player = bidding_state.game_players[0]
                if (aces.every(ace => ace.hand === troel_player)) {
                    // players has 4 aces, so H is trump and highest of H plays first
                    this.#set_trump(HEARTS)
                    let values = [...VALUES].reverse().shift()  // [K, Q, J,...]
                    let highest_of_hearts = null
                    for (let value of values) {
                        highest_of_hearts = this.#deck.filter(card => card.color === HEARTS && card.hand != troel_player)
                        if (highest_of_hearts) {
                            next_player = highest_of_hearts.hand
                            bidding_state.game_players.push(highest_of_hearts.hand)
                            break
                        }                        
                    }
                } else {
                    // 4th ace is trump and plays first
                    let ace4 = aces.filter(ace => ace.hand != troel_player)[0]
                    this.#set_trump(ace4.color)
                    next_player = ace4.hand
                    bidding_state.game_players.push(ace4.hand)
                }
                break
            case MISERIE:
            case MISERIE_TAFEL:
                this.#set_trump(null)
                break
        }
        // only rondje pas if no one made a bid!
        if (bidding_state.game === PAS && bidding_state.count_bids === 4)
            bidding_state.game = RONDEPAS
        // collect hands for output
        let hands = {}
        players.forEach(player => hands[player] = this.#deck.filter(card => card.hand === player))
        // initialize tricks per player
        let tricks_per_player = {}
        players.forEach(player => tricks_per_player[player] = 0)
        return {
            game: bidding_state.game,
            game_players: bidding_state.game_players,
            trump: this.#trump,
            player: null,
            next_player: next_player,
            playable_cards: [],
            cards_on_table: [],
            winning_card: null,
            hands: hands,
            tricks_per_player: tricks_per_player,
            count_tricks: 0  // is assigned to cards won in trick # [1..13]; incremented when collecting trick
        }
    }

    play_request(state) {
        // next player is to play now
        state.player = state.next_player
        state.next_player = null
        // look at table cards to set playable 
        state.playable_cards = []
        if (state.cards_on_table.length > 0) {
            // only cards with same color as opening card are playable
            // if there are none, any card is playable
            let opening_card = state.cards_on_table.filter(card => card.table === 1).pop()
            state.playable_cards.push(...state.hands[state.player].filter(card => card.color === opening_card.color))
            if (state.playable_cards.length === 0) {
                // no cards with same color, so all cards are playable
                state.playable_cards.push(...state.hands[state.player])
            }
        } 
        else {
            // all cards are playable
            state.playable_cards.push(...state.hands[state.player])
        }
        return state
    }

    play(state, card) {
        // MOVE CARD FROM HAND TO TABLE
        card.state = TABLE
        card.table = state.cards_on_table.length + 1
        card.player = state.player
        let hands = {}
        players.forEach(player => hands[player] = this.#deck.filter(card => card.state === HAND && card.hand === player))
        state.playable_cards = null
        state.cards_on_table.push(card)
        state.hands = hands
        let winning_card = this.#evaluate_trick(state.cards_on_table)
        state.winning_card = winning_card
        state.next_player = this.player_after(state.player)
        return state
    }

    collect_trick(state) {
        state.cards_on_table.forEach(card => {
            // MOVE CARD FROM TABLE TO TRICKS
            card.state = TRICK
            card.trick = state.count_tricks + 1
            card.winner = state.winning_card.player
        })
        state.next_player = state.winning_card.player
        state.tricks_per_player[state.winning_card.player]++
        state.cards_on_table = []
        state.winning_card = null
        state.count_tricks++
        return state
    }

    score(state) {
        let old_cumulative_score = {...this.#score}
        let players = state.game_players
        let opponents = this.#players.filter(player => !player in state.game_players)
        let game_player_tricks = 0
        players.forEach(player => {
            game_player_tricks += state.tricks_per_player[player]
        })
        let score = {}
        this.#players.forEach(player => score[player] = 0)
        switch (state.game) {
            case VRAAG:
                if (game_player_tricks === 13) {  // onder tafel
                    players.forEach(player => score[player] += 14)
                    opponents.forEach(opponent => score[opponent] -= 14)
                }
                else if (game_player_tricks >= 8) {  // gewonnen
                    let extra = game_player_tricks - 8
                    players.forEach(player => score[player] += 2 + extra)
                    opponents.forEach(opponent => score[opponent] -= 2 + extra)
                }
                else {  // verloren
                    let extra = 8 - game_player_tricks
                    players.forEach(player => score[player] -= 2 + extra)
                    opponents.forEach(opponent => score[opponent] += 2 + extra)
                }
                break
            case ALLEEN:
                if (game_player_tricks === 13) {  // onder tafel
                    players.forEach(player => score[player] += 60)
                    opponents.forEach(opponent => score[opponent] -= 20)
                }
                else if (game_player_tricks >= 8) {  // gewonnen
                    let extra = game_player_tricks - 8
                    players.forEach(player => score[player] += 3 * (3 + extra))
                    opponents.forEach(opponent => score[opponent] -= 3 + extra)
                }
                else {  // verloren
                    let extra = 8 - game_player_tricks
                    players.forEach(player => score[player] -= 3 * (2 + extra))
                    opponents.forEach(opponent => score[opponent] += 2 + extra)
                }
            case ABONDANCE_H:
            case ABONDANCE_S:
            case ABONDANCE_D:
            case ABONDANCE_C:
            case ABONDANCE_TROEF:
                if (game_player_tricks >= 9) {  // gewonnen
                    players.forEach(player => score[player] += 3 * (5))
                    opponents.forEach(opponent => score[opponent] -= 5)
                }
                else {  // verloren
                    players.forEach(player => score[player] -= 3 * (5))
                    opponents.forEach(opponent => score[opponent] += 5)
                }
                break
            case TROEL:
                if (game_player_tricks === 13) {  // onder tafel
                    players.forEach(player => score[player] += 2 * 14)
                    opponents.forEach(opponent => score[opponent] -= 2 * 14)
                }
                else if (game_player_tricks >= 8) {  // gewonnen
                    let extra = game_player_tricks - 8
                    players.forEach(player => score[player] += 2 * (2 + extra))
                    opponents.forEach(opponent => score[opponent] -= 2 * (2 + extra))
                }
                else {  // verloren
                    let extra = 8 - game_player_tricks
                    players.forEach(player => score[player] -= 2 * (2 + extra))
                    opponents.forEach(opponent => score[opponent] += 2 * (2 + extra))
                }
                break
            case MISERIE:
                game_players.forEach(player => {
                    let single_player_opponents = this.#players.filter(player => player != player)
                    if (state.tricks_per_player[player] === 0) {  // gewonnen
                        score[player] += 3 * (5)
                        single_player_opponents.forEach(opponent => score[opponent] -= 5)
                    } else {  // verloren
                        score[player] -= 3 * (5)
                        single_player_opponents.forEach(opponent => score[opponent] += 5)
                    }
                })
                break
            case MISERIE_TAFEL:
                game_players.forEach(player => {
                    let single_player_opponents = this.#players.filter(player => player != player)
                    if (state.tricks_per_player[player] === 0) {  // gewonnen
                        score[player] += 3 * (15)
                        single_player_opponents.forEach(opponent => score[opponent] -= 15)
                    } else {  // verloren
                        score[player] -= 3 * (15)
                        single_player_opponents.forEach(opponent => score[opponent] += 15)
                    }
                })
                break
            case SOLO_H:
            case SOLO_S:
            case SOLO_D:
            case SOLO_C:
                if (game_player_tricks === 13) {  // gewonnen
                    players.forEach(player => score[player] += 3 * (75))
                    opponents.forEach(opponent => score[opponent] -= 75)
                }
                else {  // verloren
                    players.forEach(player => score[player] -= 3 * (75))
                    opponents.forEach(opponent => score[opponent] += 75)
                }
                break
            case SOLO_SLIM:
                if (game_player_tricks === 13) {  // gewonnen
                    players.forEach(player => score[player] += 3 * (150))
                    opponents.forEach(opponent => score[opponent] -= 150)
                }
                else {  // verloren
                    players.forEach(player => score[player] -= 3 * (150))
                    opponents.forEach(opponent => score[opponent] += 150)
                }
                break
        }
        // apply multiplier
        if (this.#scorefactors[this.#game_number])
            this.#players.forEach(player => {
                score[player] *= this.#scorefactors[this.#game_number]
            })
        // cumulative score
        this.#players.forEach(player => {
            this.#score[player] += score[player]
        })
        return {
            tricks_per_player: state.tricks_per_player,
            score: score, 
            old_cumulative_score: old_cumulative_score, 
            new_cumulative_score: this.#score,
            score_factor: this.#scorefactors[this.#game_number]
        }
    }

    new_game(state) {
        // MOVE CARDS FROM TRICKS TO STACK
        this.#deck.forEach(card => {
            card.state = STACK
            card.trump = null
            card.stack = 13 * (card.trick - 1) + card.table - 1
            card.hand = null
            card.table = null
            card.player = null
            card.trick = null
            card.winner = null
        })
        this.#trump = null
        switch (state.game) {
            case PAS:
                this.#dealer = this.player_after(this.#dealer)
                this.#rondepas_count = 0
                break
            case RONDEPAS:
                if (this.#rondepas_count >= 3) {
                    this.#dealer = this.player_after(this.#dealer)
                    if (!this.#scorefactors[this.#game_number + this.#rondepas_count])
                        this.#scorefactors[this.#game_number + this.#rondepas_count] = 1
                    this.#scorefactors[this.#game_number + this.#rondepas_count]++
                    this.#rondepas_count++
                } else {
                    if (!this.#scorefactors[this.#game_number + this.#rondepas_count])
                        this.#scorefactors[this.#game_number + this.#rondepas_count] = 1
                    this.#scorefactors[this.#game_number + this.#rondepas_count]++
                    this.#rondepas_count++
                }
                break
            default:
                this.#dealer = this.player_after(this.#dealer)
                this.#rondepas_count = 0
                this.#game_number++
        }
    }

    #evaluate_trick(cards) {
        // returns the (temporary) winner of the trick composed of input cards
        function highest_value_card(cards) {
            // regardless color!
            return cards.reduce((highest,card) => card.order > highest.order ? card : highest, cards[0])
        }
        let highest_trump = highest_value_card(cards.filter(card => card.trump))
        if (highest_trump) 
            return highest_trump
        let opening_card = cards.filter(card => card.table === 1).pop()
        let highest = highest_value_card(cards.filter(card => card.color === opening_card.color))
        return highest
    }
    
    #set_trump(color) {
        this.#trump = color  // null is allowed to remove trump
        if (color) {
            this.#deck.filter(card => card.color === color).forEach(card => card.trump = true)
            this.#deck.filter(card => card.color != color).forEach(card => card.trump = false)
        } else {
            this.#deck.forEach(card => card.trump = false)
        }
    }

    rotate_players(first_player, {list = null} = {}) {
        // returns a COPY of the array of players (or custom list, if provided) with 'first_player' first
        let players = list ? list : [...this.#players]
        while (players[0] != first_player) {
            players.push(players.shift())
        }
        return players
    }
    
    player_after(player) {
        let players = this.rotate_players(player)
        return players[1]
    }    
    
    player_before(player) {
        let players = this.rotate_players(player)
        return players[3]
    }    
    
}

function cards_to_string(cards, {numbered = false} = {}) {
    return cards.map((card, cardi) => card.color + card.value 
        + (card.trump?'*':'') 
        + (numbered?`[${cardi}]`:'')).toString()
}

function list_to_string_numbered(list) {
    return list.map((item, itemi) => item + `[${itemi}]`).toString()
}

let players = ['Joe', 'Jack', 'William', 'Avarell']

let wiezen = new Wiezen(players)

while (true) {

    wiezen.cut()

    let hands = wiezen.deal()

    players.forEach(player => {
        console.log(`Hand of ${player}: ${cards_to_string(hands[player])}`)
    })

    let bidding_state = wiezen.initialize_bid()

    do {

        bidding_state = wiezen.bid_request(bidding_state)

        console.log(`Game bid: ${bidding_state.game}`)
        console.log(`By: ${bidding_state.game_players.toString()}`)
        console.log(`Higher bid is open to: ${bidding_state.player}`)
        console.log(`Open games: ${list_to_string_numbered(bidding_state.games_open_mee)}`)
        if (bidding_state.score_factor) {
            console.log(`Score factor: ${bidding_state.score_factor}`)
        }
        let idx
        do {
            idx = parseInt(PROMPT("Which game do you bid for? "));
        } while (isNaN(idx) || idx < 0 || idx >= bidding_state.games_open_mee.length)
        let bid = bidding_state.games_open_mee[idx]
            
        bidding_state = wiezen.bid(bidding_state, bid)

    } while (bidding_state.players_bidding.length > 0)

    let play_state = wiezen.initialize_play(bidding_state)

    if (play_state.game != RONDEPAS && play_state.game != PAS) {

        console.log(`Game set: ${play_state.game}`)
        console.log(`Player(s): ${play_state.game_players}`)
        console.log(`Trump: ${play_state.trump}`)

        do {

            play_state = wiezen.play_request(play_state)

            console.log(`Table: ${cards_to_string(play_state.cards_on_table)}`)
            console.log(`Hand of ${play_state.player}: ${cards_to_string(play_state.hands[play_state.player])}`)
            console.log(`Play card from: ${cards_to_string(play_state.playable_cards, {numbered: true})}`)
            let idx
            do {
                idx = parseInt(PROMPT("Which card will you play? "));
            } while (isNaN(idx) || idx < 0 || idx >= play_state.playable_cards.length)
            let card = play_state.playable_cards[idx]

            play_state = wiezen.play(play_state, card)

            if (play_state.cards_on_table.length === 4) {

                console.log(`Trick won by ${play_state.winning_card.player} (${cards_to_string([play_state.winning_card])}): ${cards_to_string(play_state.cards_on_table)}`)

                play_state = wiezen.collect_trick(play_state)

                players.forEach(player => {
                    console.log(`Tricks won by ${player}: ${play_state.tricks_per_player[player]}`)
                })
        
            }

        } while (play_state.count_tricks < NUMBER_OF_TRICKS)

        let {tricks_per_player, score, old_cumulative_score, new_cumulative_score, score_factor} = wiezen.score(play_state)

        players.forEach(player => {
            console.log(`Tricks won by ${player}: ${tricks_per_player[player]}`)
        })
        players.forEach(player => {
            console.log(`Score of ${player}: ${score[player]}`)
        })
        if (score_factor) {
            console.log(`Score factor: ${score_factor}`)
        }
        players.forEach(player => {
            console.log(`Total original score of ${player}: ${old_cumulative_score[player]}`)
        })
        players.forEach(player => {
            console.log(`Total new score of ${player}: ${new_cumulative_score[player]}`)
        })
    
    } else {

        console.log(`Game set: ${play_state.game}`)
        
    }

    wiezen.new_game(play_state)
    
}

