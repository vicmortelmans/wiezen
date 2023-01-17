const Deck = require("./deck")
var Wiezen = require("./wiezen")

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
        // look at table cards to set playable 
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
        return this.playing
    }

    /**
     * ai auxiliary method
     * prepare data for playing the next card, but not knowing how the other hands are dealt:
     * - who is the player (player)?
     * - which cards can be played (playable_cards)?
     * @returns {object} state - object for keeping track of the playing workflow
     */
    play_request_from_viewpoint_of_player(watchingplayer) {
        // this function is only for when player's opponents have to play!
        if (watchingplayer === this.playing.next_player)
            return this.play_request()
        // next player is to play now
        this.playing.player = this.playing.next_player
        this.playing.next_player = null
        // all remaining cards are playable, apart from the colors that the player didn't follow earlier
        this.playing.playable_cards = []
        for (const player of this.players) 
            if (player != watchingplayer)
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
        // TODO fix not working:
        for (const player in this.players)
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

const prompt = require("prompt-sync")({ sigint: true });

function cards_to_string(cards, {numbered = false} = {}) {
    return cards.map((card, cardi) => card.color + card.value 
        + (card.trump?'*':'') 
        + (numbered?`[${cardi}]`:'')).toString()
}

function list_to_string_numbered(list) {
    return list.map((item, itemi) => item + `[${itemi}]`).toString()
}


function minimax_player(node, depth, alpha, beta, simulated_player) {
    // static evaluation of node = the number of tricks won + 1 if winning current trick
    if (depth === 0 || node.state.game_done) {
        let eval = node.scores[simulated_player]
        let card_nr = node.state.count_tricks * 4 + node.state.cards_on_table.length + 1
        console.log(`${' '.repeat(card_nr)}- ${node.card_id}(${node.player}): At card ${card_nr} score is ${eval} tricks for ${simulated_player}`)
        return [null, node.scores]
    }
    // create the child nodes
    node.state.playable_cards.forEach(card_id => {
        // store scores in the node
        if (!node.children.has(card_id)) {
            let wiezen_clone = new Wiezen_ai(node.wiezen)
            let play_state = wiezen_clone.play(card_id)
            if (play_state.cards_on_table.length === 4) {
                play_state = wiezen_clone.collect_trick()
            }
            play_state = wiezen_clone.play_request()
            let scores = play_state.tricks_per_player 
            if (play_state.winning_card)
                scores[wiezen_clone.get_hand(play_state.winning_card)]++
            node.children.set(card_id, {
                card_id: card_id,  // only for logging
                player: node.state.player,  // only for logging
                state: play_state,
                wiezen: wiezen_clone,
                children: new Map(),
                scores: scores,
                parent: node  // only for debugging
            })
        }
    })
    node.wiezen = null  // don't need it anymore
    if (simulated_player === node.state.player) {
        let max_eval = -999
        let max_card_id, max_scores
        for (const [card_id, child] of node.children) {
            //console.log(`Going to calculate score @${node.state.count_tricks * 4 + node.state.cards_on_table.length} for ${simulated_player} if ${node.state.player} virtually plays ${card_id}`)
            let [next_card_id, scores] = minimax_player(child, depth-1, alpha, beta, simulated_player)
            let eval = scores[simulated_player]
            if (eval > max_eval) {
                max_eval = eval
                max_card_id = card_id
                max_scores = scores
            }
            alpha = Math.max(alpha, eval)
            if (beta <= alpha)
                break
        }
        let card_nr = node.state.count_tricks * 4 + node.state.cards_on_table.length + 1
        console.log(`${' '.repeat(card_nr)}- ${node.card_id}(${node.player}): At card ${card_nr} ${node.state.player}'s best card is ${max_card_id} maximizing ${max_scores[simulated_player]} tricks for ${simulated_player}`)
        return [max_card_id, max_scores]
    }
    else {
        let min_eval = 999
        let min_card_id, min_scores
        for (const [card_id, child] of node.children) {
            //console.log(`Going to calculate score @${node.state.count_tricks * 4 + node.state.cards_on_table.length} for ${simulated_player} if ${node.state.player} virtually plays ${card_id}`)
            let [next_card_id, scores] = minimax_player(child, depth-1, alpha, beta, simulated_player)
            let eval = scores[simulated_player]
            if (eval < min_eval) {
                min_eval = eval
                min_card_id = card_id
                min_scores = scores
            }
            beta = Math.min(beta, eval)
            if (beta <= alpha)
                break
        }
        let card_nr = node.state.count_tricks * 4 + node.state.cards_on_table.length + 1
        console.log(`${' '.repeat(card_nr)}- ${node.card_id}(${node.player}): At card ${card_nr} ${node.state.player}'s best card is ${min_card_id} minimizing ${min_scores[simulated_player]} tricks for ${simulated_player}`)
        return [min_card_id, min_scores]
    }
}

let players = ['joe', 'jack', 'william', 'avarell']

let wiezen = new Wiezen(players)

while (true) {

    wiezen.cut()

    let hands = wiezen.deal()

    players.forEach(player => {
        console.log(`Hand of ${player}: ${hands[player].toString()}`)
    })

    let bidding_state = wiezen.initialize_bid()

    do {

        bidding_state = wiezen.bid_request()

        console.log(`game bid: ${bidding_state.game}`)
        console.log(`by: ${bidding_state.game_players.toString()}`)
        console.log(`higher bid is open to: ${bidding_state.player}`)
        console.log(`open games: ${list_to_string_numbered(bidding_state.games_open_mee)}`)
        if (bidding_state.score_factor) {
            console.log(`score factor: ${bidding_state.score_factor}`)
        }
        let idx
        do {
            idx = parseInt(prompt("which game do you bid for? "));
        } while (isNaN(idx) || idx < 0 || idx >= bidding_state.games_open_mee.length)
        let bid = bidding_state.games_open_mee[idx]
            
        bidding_state = wiezen.bid(bid)

    } while (bidding_state.players_bidding.length > 0)

    let play_state = wiezen.initialize_play()

    if (play_state.game_playable) {

        console.log(`Game set: ${play_state.game}`)
        console.log(`Player(s): ${play_state.game_players}`)
        console.log(`Trump: ${play_state.trump}`)

        let game_tree = null

        do {

            play_state = wiezen.play_request()

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
            let [card_id, scores] = minimax_player(game_tree, 2, -999, 999, play_state.player)

            console.log(`Table: ${play_state.cards_on_table.toString()}`)
            console.log(`Hand of ${play_state.player}: ${play_state.hands[play_state.player].toString()}`)
            console.log(`Play card from: ${list_to_string_numbered(play_state.playable_cards)}`)

            prompt(`${play_state.player} plays ${card_id}. Continue...`)

            play_state = wiezen.play(card_id)

            // change tree pointer to the child node
            game_tree = game_tree.children.get(card_id)

            if (play_state.cards_on_table.length === 4) {

                console.log(`Trick won by ${wiezen.get_hand(play_state.winning_card)} (${play_state.winning_card}): ${play_state.cards_on_table.toString()}`)

                play_state = wiezen.collect_trick()

                players.forEach(player => {
                    console.log(`Tricks won by ${player}: ${play_state.tricks_per_player[player]}`)
                })
        
            }

        } while (!play_state.game_done)

        let {tricks_per_player, score, old_cumulative_score, new_cumulative_score, score_factor} = wiezen.calculate_score()

        players.forEach(player => {
            console.log(`tricks won by ${player}: ${tricks_per_player[player]}`)
        })
        players.forEach(player => {
            console.log(`score of ${player}: ${score[player]}`)
        })
        if (score_factor) {
            console.log(`score factor: ${score_factor}`)
        }
        players.forEach(player => {
            console.log(`total original score of ${player}: ${old_cumulative_score[player]}`)
        })
        players.forEach(player => {
            console.log(`total new score of ${player}: ${new_cumulative_score[player]}`)
        })
    
    } else {

        console.log(`game set: ${play_state.game}`)
        
    }

    wiezen.new_game()
    
}

