var Deck = require("./deck")
var Wiezen = require("./wiezen")
var colors = require("colors")

/**
 * class representing four players playing a series of whist games.
 * modified to serve for constructing game trees with knowledge of one player only
 */
class Wiezen_ai {
    deck  // array of cards (see constructor for attributes)
    players  // array of strings ** do not change ** 
    trump  // string (from colors)
    playing  // object managing state during playing workflow
    
    /**
     * constructor of a wiezen_ai object.
     * @param {object} wiezen - a wiezen object for a normal gameplay, or another wiezen_ai object
     */
    constructor(wiezen) {
        this.deck = new Deck(wiezen.deck)  // clone the deck
        this.players = [...wiezen.players]
        this.trump = wiezen.trump
        this.playing = JSON.parse(JSON.stringify(wiezen.playing))  // clone the playing object
        this.playing.depleted_colors = {}
        this.players.forEach(player => this.playing.depleted_colors[player] = [])
    }

    play_request() {
        // next player is to play now
        this.playing.player = this.playing.next_player
        this.playing.next_player = null
        // look at table cards and own hand to set playable 
        this.playing.playable_cards = []
        if (this.playing.cards_on_table.length > 0) {
            // only cards with same color as opening card are playable
            // if there are none, any card is playable
            let opening_card = this.playing.cards_on_table[0]
            this.playing.playable_cards = this.deck.get_hand_cards_with_same_color(this.playing.player, opening_card)
            if (this.playing.playable_cards.length === 0) {
                // no cards with same color, so all cards are playable
                this.playing.playable_cards = [...this.playing.hands[this.playing.player]]
            }
        } 
        else {
            // all cards are playable
            this.playing.playable_cards = [...this.playing.hands[this.playing.player]]
        }
        // ALL playable cards include all remaining cards, apart from the colors that the player didn't follow earlier
        // it is not taken into account if the color of the opening card is followed
        // it is not taken into account who is the simulated player, because the node can be used for simulating any player
        this.playing.all_playable_cards = []
        for (const player of this.players) 
            for (const card_id of this.playing.hands[player])
                if (!this.playing.depleted_colors[player].includes(this.deck.get_color(card_id)))
                    this.playing.all_playable_cards.push(card_id)
        return this.playing
    }

    /**
     * ai auxiliary method
     * prepare data for playing the next card, but not knowing how the other hands are dealt:
     * - who is the player (player)?
     * - which cards can be played (playable_cards)?
     * @returns {object} state - object for keeping track of the playing workflow
     */
    play_request_from_viewpoint_of_player(simulated_player) {
        // this function is only for when player's opponents have to play!
        if (simulated_player === this.playing.next_player)
            return this.play_request()
        // next player is to play now
        this.playing.player = this.playing.next_player
        this.playing.next_player = null
        // all remaining cards are playable, apart from the colors that the player didn't follow earlier
        this.playing.playable_cards = []
        if (this.playing.cards_on_table.length > 0) {
            let opening_card_color = this.deck.get_color(this.playing.cards_on_table[0])
            for (const player of this.players) 
                if (player != simulated_player)
                    for (const card_id of this.playing.hands[player])
                        if (this.deck.get_color(card_id) === opening_card_color)
                            if (!this.playing.depleted_colors[player].includes(this.deck.get_color(card_id)))
                                this.playing.playable_cards.push(card_id)
        }
        else 
            for (const player of this.players) 
                if (player != simulated_player)
                    for (const card_id of this.playing.hands[player])
                        if (!this.playing.depleted_colors[player].includes(this.deck.get_color(card_id)))
                            this.playing.playable_cards.push(card_id)
        return this.playing
    }

    play(card_id) {
        // player didn't follow suit? let's remember that!
        if (this.playing.cards_on_table.length > 0) {
            let opening_card_color = this.deck.get_color(this.playing.cards_on_table[0])
            if (this.deck.get_color(card_id) != opening_card_color)
                this.playing.depleted_colors[this.playing.player].push(opening_card_color)
        }
        // move card from hand to table
        this.deck.play(card_id, this.playing.player)
        this.playing.playable_cards = null
        this.playing.cards_on_table.push(card_id)
        this.playing.hands = this.deck.get_hands()
        // fix missing players in hands
        for (const player of this.players)
            if (!(player in this.playing.hands))  // deck will not create property if player has no cards left
                this.playing.hands[player] = []
        this.playing.winning_card = this.deck.evaluate_trick(this.playing.cards_on_table)
        this.playing.next_player = this.player_after(this.playing.player)
        return this.playing
    }

    collect_trick() {
        this.deck.collect_trick(this.playing.cards_on_table, this.playing.winning_card, ++this.playing.count_tricks)
        let winning_player = this.deck.get_hand(this.playing.winning_card)
        this.playing.next_player = winning_player
        this.playing.tricks_per_player[winning_player]++
        this.playing.cards_on_table = []
        this.playing.winning_card = null
        this.playing.game_done = this.playing.count_tricks >= Wiezen.NUMBER_OF_TRICKS
        return this.playing
    }

    rotate_players(first_player, {list = null} = {}) {
        // returns a copy of the array of players (or custom list, if provided) with 'first_player' first
        let players = list ? list : [...this.players]
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

    get_hand(card_id) {
        return this.deck.get_hand(card_id)
    }
    
}

const PROMPT = require("prompt-sync")({ sigint: true });

function numbered(list) {
    return list.map((item, itemi) => item + `[${itemi}]`)
}

function colored(list) {
    return list.map(item => {
        if (!item) return item  // can be null
        else if (item.includes(Deck.HEARTS)) return item.red
        else if (item.includes(Deck.DIAMONDS)) return item.red
        else return item
    }) 
}

/**
 * At a specific play state, calculate for each player the current score, taking into account:
 * - the number of tricks he won (+0..+13)
 * - the number of tricks his opponents won (-0..-13)
 * - whether he's winning the trick on the table (+0.5)
 * - whether he's played in the trick on the table a high card (+0..+0.12)
 * @param {object} node - the gametree object containing the play state  
 * @param {object} simulated_player - the player for which the state is evaluated
 * @returns {number} the evaluation for the simulated player - higher values are 'good' for that player,
 * lower values are 'bad' for that player 
 */
function node_evaluation(node, simulated_player) {
    // calculate for each player a score, based on the number of tricks they won,
    // 'spiced' with info from the ongoing trick
    let scores = {...node.state.tricks_per_player}
    // score is higher for temporary winner of the trick
    if (node.state.winning_card)
        scores[node.wiezen.get_hand(node.state.winning_card)] += 0.5
    // score is higher for a higher card
    //for (const card_id of node.state.cards_on_table)
    //    scores[node.wiezen.get_hand(card_id)] += 0.01 * node.wiezen.deck.get_value_index(card_id)
    // accumulate the scores, depending on the game that's played
    let eval = 0
    for (const player of node.wiezen.players) {
        let score = scores[player]
        if (node.state.game === Wiezen.VRAAG) 
            if (node.state.game_players.includes(simulated_player)) 
                if (node.state.game_players.includes(player))
                    // player and simulated player are partners (or perhaps the same)
                    eval += score
                else
                    // player is an opponent of simulated player 
                    eval -= score
            else 
                if (node.state.game_players.includes(player))
                    // player is an opponent of simulated player 
                    eval -= score
                else
                    // player and simulated player are partners (or perhaps the same)
                    eval += score
        else if (node.state.game === Wiezen.MISERIE || node.state.game === Wiezen.MISERIE_TAFEL) 
            if (player === simulated_player) 
                eval -= score
            else 
                eval += score
        else 
            if (player === simulated_player) 
                eval += score
            else 
                eval -= score
    }
    return eval
}

/**
 * Minimax recursive algorithm to find the best card to be played. 
 * @param {object} node - the position in the game at which a card must be played
 * @param {number} depth - the number of future cards that will be considered for optimization
 * @param {number} alpha 
 * @param {number} beta 
 * @param {string} simulated_player - the player for whom the evaluation is done
 * - on the initial function call, this is always the player who has to play the next card
 * - inside the recursion, this may be another player!
 * @returns [card_id, eval] {[string, object]} card_id and evaluation when playing that card
 * - on the initial function call: the best card for the simulated player to play
 * - inside the recursion, the best card for the player in this node to play
 */
function minimax_player(node, depth, alpha, beta, simulated_player) {
    // static evaluation of node = the number of tricks won + 1 if winning current trick
    if (depth === 0 || node.state.game_done) {
        let eval = node_evaluation(node, simulated_player)
        let card_nr = node.state.count_tricks * 4 + node.state.cards_on_table.length + 1
        console.log(`${' '.repeat(card_nr)}- ${colored([node.card_id]).toString()}(${node.player}): At card ${card_nr} evaluation is ${eval} simulated for ${simulated_player}`)
        return [null, eval]
    }
    // create the child nodes
    // note that ALL playable cards include all cards
    // - that are not yet played and
    // - that are not of a color of which all know the player is depleted
    // it is not taken into account if the color of the opening card is followed
    node.state.all_playable_cards.forEach(card_id => {
        if (!node.children.has(card_id)) {
            let wiezen_clone = new Wiezen_ai(node.wiezen)
            let play_state = wiezen_clone.play(card_id)
            if (play_state.cards_on_table.length === 4) {
                play_state = wiezen_clone.collect_trick()
            }
            play_state = wiezen_clone.play_request(simulated_player) // imporant to keep other hands closed!
            node.children.set(card_id, {
                card_id: card_id,  // only for logging
                player: node.state.player,  // only for logging
                state: play_state,
                wiezen: wiezen_clone,
                children: new Map(),
                parent: node  // only for debugging
            })
        }
    })
    if (simulated_player === node.state.player) {
        let max_eval = -999
        let max_card_id
        for (const [card_id, child] of node.children) {
            // the simulated player should only consider playing the cards he's allowed to play!
            if (node.state.playable_cards.includes(card_id)) {
                let [next_card_id, eval] = minimax_player(child, depth-1, alpha, beta, simulated_player)
                if (eval > max_eval) {
                    max_eval = eval
                    max_card_id = card_id
                }
                alpha = Math.max(alpha, eval)
                if (beta <= alpha)
                    break
            }
        }
        let card_nr = node.state.count_tricks * 4 + node.state.cards_on_table.length + 1
        console.log(`${' '.repeat(card_nr)}- ${colored([node.card_id]).toString()}(${node.player}): At card ${card_nr} ${node.state.player}'s best card is ${colored([max_card_id]).toString()} maximizing evaluation ${max_eval} simulated for ${simulated_player}`)
        return [max_card_id, max_eval]
    }
    else {
        let min_eval = 999
        let min_card_id
        for (const [card_id, child] of node.children) {
            // the simulated player should consider another player playing any card that he himself is not holding!
            if (node.wiezen.get_hand(card_id) != simulated_player) {
                let [next_card_id, eval] = minimax_player(child, depth-1, alpha, beta, simulated_player)
                if (eval < min_eval) {
                    min_eval = eval
                    min_card_id = card_id
                }
                beta = Math.min(beta, eval)
                if (beta <= alpha)
                    break
            }
        }
        let card_nr = node.state.count_tricks * 4 + node.state.cards_on_table.length + 1
        console.log(`${' '.repeat(card_nr)}- ${colored([node.card_id]).toString()}(${node.player}): At card ${card_nr} ${node.state.player}'s best card is ${colored([min_card_id]).toString()} minimizing evaluation ${min_eval} simulated for ${simulated_player}`)
        return [min_card_id, min_eval]
    }
}

let players = ['joe', 'jack', 'william', 'avarell']

let wiezen = new Wiezen(players)

while (true) {

    wiezen.cut()

    let hands = wiezen.deal()

    for (const player of players) console.log(`Hand of ${player}: ${colored(hands[player]).toString()}`)

    let bidding_state = wiezen.initialize_bid()

    do {

        bidding_state = wiezen.bid_request()

        console.log(`game bid: ${bidding_state.game}`)
        console.log(`by: ${bidding_state.game_players.toString()}`)
        console.log(`higher bid is open to: ${bidding_state.player}`)
        console.log(`open games: ${numbered(bidding_state.games_open_mee).toString()}`)
        if (bidding_state.score_factor) {
            console.log(`score factor: ${bidding_state.score_factor}`)
        }
        let idx
        do {
            idx = parseInt(PROMPT("which game do you bid for? "));
        } while (isNaN(idx) || idx < 0 || idx >= bidding_state.games_open_mee.length)
        let bid = bidding_state.games_open_mee[idx]
            
        bidding_state = wiezen.bid(bid)

    } while (bidding_state.players_bidding.length > 0)

    let play_state = wiezen.initialize_play()

    if (play_state.game_playable) {

        console.log(`Game set: ${play_state.game}`)
        console.log(`Player(s): ${play_state.game_players}`)
        console.log(`Trump: ${colored([play_state.trump]).toString()}`)

        let game_tree = null

        do {

            play_state = wiezen.play_request()

            // Initialize the extra state element used for developing the gametree
            play_state.all_playable_cards = [...play_state.playable_cards]

            // Initialize gametree
            // Each node has properties:
            // - card (only for logging)
            // - player (only for logging)
            // - object playing_state (= player-neutral), 
            // - object wiezen_ai
            // - map by card child nodes
            // - list by player of the evaluation in this node (= count of tricks + winning hand)
            if (!game_tree) 
                game_tree = {
                    card: null,  // the card that got me in this node
                    player: null,  // the player that played this card
                    state: play_state,  // current play_state snapshot, after play_request call
                    wiezen: new Wiezen_ai(wiezen),
                    children: new Map(),
                    scores: [],
                    parent: null
                }

            // let the minimax algorithm choose a card
            // during this process, the game tree is filled in to a certain depth
            let [card_id, eval] = minimax_player(game_tree, 2, -999, 999, play_state.player)

            console.log(`Table: ${colored(play_state.cards_on_table).toString()}`)
            console.log(`Hand of ${play_state.player}: ${colored(play_state.hands[play_state.player]).toString()}`)
            console.log(`Play card from: ${colored(numbered(play_state.playable_cards)).toString()}`)

            PROMPT(`${play_state.player} plays ${colored([card_id]).toString()}. Continue...`)

            play_state = wiezen.play(card_id)

            // change tree pointer to the child node
            game_tree = game_tree.children.get(card_id)

            if (play_state.cards_on_table.length === 4) {

                console.log(`Trick won by ${wiezen.get_hand(play_state.winning_card)} (${colored([play_state.winning_card]).toString()}): ${colored(play_state.cards_on_table).toString()}`)

                play_state = wiezen.collect_trick()

                for (const player of players) console.log(`Tricks won by ${player}: ${play_state.tricks_per_player[player]}`)
        
            }

        } while (!play_state.game_done)

        let {tricks_per_player, score, old_cumulative_score, new_cumulative_score, score_factor} = wiezen.calculate_score()

        for (const player of players) console.log(`Tricks won by ${player}: ${tricks_per_player[player]}`)
        for (const player of players) console.log(`Score of ${player}: ${score[player]}`)
        if (score_factor) console.log(`Score factor: ${score_factor}`)
        for (const player of players) console.log(`Total original score of ${player}: ${old_cumulative_score[player]}`)
        for (const player of players) console.log(`Total new score of ${player}: ${new_cumulative_score[player]}`)
    
    } else {

        console.log(`game set: ${play_state.game}`)
        
    }

    wiezen.new_game()
    
}

