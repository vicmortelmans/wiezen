var Wiezen = require("./wiezen")

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


/**
 * class representing four players playing a series of whist games.
 * modified to serve for constructing a single game with knowledge of one player only
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
        this.players = [...wiezen.players]
        this.trump = wiezen.trump
        this.deck = JSON.parse(JSON.stringify(wiezen.deck)) 
        // recompose the hands
        let card_map = wiezen.deck.reduce((acc, card, i) => (acc.set(card, this.deck[i]), acc), new Map())
        let hands = {}
        for (let player in wiezen.playing.hands) {
            let hand = []
            wiezen.playing.hands[player].forEach(card => hand.push(card_map.get(card)))
            hands[player] = hand
        }
        // clone the playing object
        this.playing = {
            game: wiezen.playing.game,
            game_players: [...wiezen.playing.game_players],
            trump: wiezen.playing.trump,
            player: wiezen.playing.player,
            next_player: wiezen.playing.next_player,
            playable_cards: wiezen.playing.playable_cards.map(card => card_map.get(card)),
            cards_on_table: wiezen.playing.cards_on_table.map(card => card_map.get(card)),
            winning_card: card_map.get(wiezen.playing.winning_card),
            hands: hands,
            tricks_per_player: {...wiezen.playing.tricks_per_player},
            count_tricks: wiezen.playing.count_tricks,
            game_done: wiezen.playing.game_done,
            depleted_colors: JSON.parse(JSON.stringify(wiezen.playing.depleted_colors))
        } 
        console.log(JSON.stringify(this.playing.cards_on_table))
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
            let opening_card = this.playing.cards_on_table.filter(card => card.table === 1).pop()
            this.playing.playable_cards.push(...this.playing.hands[this.playing.player].filter(card => card.color === opening_card.color))
            if (this.playing.playable_cards.length === 0) {
                // no cards with same color, so all cards are playable
                this.playing.playable_cards.push(...this.playing.hands[this.playing.player])
            }
        } 
        else {
            // all cards are playable
            this.playing.playable_cards.push(...this.playing.hands[this.playing.player])
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
        this.players.filter(player => player != watchingplayer).forEach(player => {
            this.playing.playable_cards.push(...this.playing.hands[player].filter(card => !this.playing.depleted_colors[player].includes(card.color)))
        })
        return this.playing
    }

    play(card) {
        // player didn't follow suit? let's remember that!
        if (this.playing.cards_on_table.length > 0) {
            let opening_card = this.playing.cards_on_table.filter(card => card.table === 1).pop()
            if (card.color != opening_card.color)
                this.playing.depleted_colors[this.playing.player].push(opening_card.color)
        }
        // move card from hand to table
        card.state = TABLE
        card.table = this.playing.cards_on_table.length + 1
        card.player = this.playing.player
        this.playing.playable_cards = null
        this.playing.cards_on_table.push(card)
        let hands = {}
        this.players.forEach(player => hands[player] = this.deck.filter(card => card.state === HAND && card.hand === player))
        this.playing.hands = hands
        let winning_card = this.evaluate_trick(this.playing.cards_on_table)
        this.playing.winning_card = winning_card
        this.playing.next_player = this.player_after(this.playing.player)
        return this.playing
    }

    collect_trick() {
        this.playing.cards_on_table.forEach(card => {
            // move card from table to tricks
            card.state = TRICK
            card.trick = this.playing.count_tricks + 1
            card.winner = this.playing.winning_card.player
        })
        this.playing.next_player = this.playing.winning_card.player
        this.playing.tricks_per_player[this.playing.winning_card.player]++
        this.playing.cards_on_table = []
        this.playing.winning_card = null
        this.playing.count_tricks++
        this.playing.game_done = this.playing.count_tricks >= number_of_tricks
        return this.playing
    }

    evaluate_trick(cards) {
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

var game_tree_root_nodes = {}
var game_tree_current_nodes = {}
// Each node has properties:
// - object playing_state (= player-neutral), 
// - object wiezen_ai
// - map by card child nodes
// - list by player of the evaluation in this node (= count of tricks + winning hand)

function minimax_player(node, depth, alpha, beta, simulated_player) {
    // static evaluation of node = the number of tricks won + 1 if winning current trick
    if (depth === 0 || node.state.game_done) {
        let eval = node.scores[simulated_player]
        console.log(`calculated score ${eval}@${node.state.count_tricks * 4 + node.state.cards_on_table.length} for ${simulated_player} at max depth`)
        return [null, node.scores]
    }
    // create the child nodes
    node.state.playable_cards.forEach(card => {
        // store scores in the node
        if (!node.children.has(card)) {
            let wiezen_clone = new Wiezen_ai(node.wiezen)
            let play_state = wiezen_clone.play(card)
            if (play_state.cards_on_table.length === 4) {
                play_state = wiezen_clone.collect_trick()
            }
            play_state = wiezen_clone.play_request()
            let scores = play_state.tricks_per_player 
            if (play_state.winning_card)
                scores[play_state.winning_card.player]++
            node.children.set(card, {
                state: play_state,
                wiezen: wiezen_clone,
                children: new Map(),
                scores: scores
            })
        }
    })
    node.wiezen = null  // don't need it anymore
    if (simulated_player === node.state.player) {
        let max_eval = -999
        let max_card, max_scores
        for (const [card, child] of node.children) {
            console.log(`going to calculate score @${node.state.count_tricks * 4 + node.state.cards_on_table.length} for ${simulated_player} if ${node.state.player} virtually plays ${card.color}${card.value}`)
            let [next_card, scores] = minimax_player(child, depth-1, alpha, beta, simulated_player)
            let eval = scores[simulated_player]
            if (eval > max_eval) {
                max_eval = eval
                max_card = card
                max_scores = scores
            }
            alpha = Math.max(alpha, eval)
            if (beta <= alpha)
                break
        }
        console.log(`calculated score ${max_eval}@${node.state.count_tricks * 4 + node.state.cards_on_table.length} for ${simulated_player} if ${node.state.player} virtually plays ${max_card.color}${max_card.value}`)
        return [max_card, max_scores]
    }
    else {
        let min_eval = 999
        let min_card, min_scores
        for (const [card, child] of node.children) {
            let [next_card, scores] = minimax_player(child, depth-1, alpha, beta, simulated_player)
            let eval = scores[simulated_player]
            if (eval < min_eval) {
                min_eval = eval
                min_card = card
                min_scores = scores
            }
            beta = Math.min(beta, eval)
            if (beta <= alpha)
                break
        }
        console.log(`calculated score ${min_eval}@${node.state.count_tricks * 4 + node.state.cards_on_table.length} for ${simulated_player} if ${node.state.player} virtually plays ${min_card.color}${min_card.value}`)
        return [min_card, min_scores]
    }
}

let players = ['joe', 'jack', 'william', 'avarell']

let wiezen = new Wiezen(players)

while (true) {

    wiezen.cut()

    let hands = wiezen.deal()

    players.forEach(player => {
        console.log(`hand of ${player}: ${cards_to_string(hands[player])}`)
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

        console.log(`game set: ${play_state.game}`)
        console.log(`player(s): ${play_state.game_players}`)
        console.log(`trump: ${play_state.trump}`)

        do {

            play_state = wiezen.play_request()

            
            console.log(`table: ${cards_to_string(play_state.cards_on_table)}`)
            console.log(`hand of ${play_state.player}: ${cards_to_string(play_state.hands[play_state.player])}`)
            console.log(`play card from: ${cards_to_string(play_state.playable_cards, {numbered: true})}`)
            
            // if this is the player's first card, initialize game_tree_node for this player
            if (!( play_state.player in game_tree_root_nodes)) {
                game_tree_root_nodes[play_state.player] = {
                    state: play_state,
                    wiezen: new Wiezen_ai(wiezen),
                    children: new Map(),
                    scores: []
                }
                game_tree_current_nodes[play_state.player] = game_tree_root_nodes[play_state.player]
            }

            // let the minimax algorithm choose a card
            // during this process, the game tree is filled in to a certain depth
            let [card, scores] = minimax_player(game_tree_current_nodes[play_state.player], 2, -999, 999, play_state.player)

            play_state = wiezen.play(card)

            // change tree pointer to the child node
            game_tree_current_nodes[play_state.player] = game_tree_current_nodes[play_state.player].children.get(card)

            if (play_state.cards_on_table.length === 4) {

                console.log(`trick won by ${play_state.winning_card.player} (${cards_to_string([play_state.winning_card])}): ${cards_to_string(play_state.cards_on_table)}`)

                play_state = wiezen.collect_trick()

                players.forEach(player => {
                    console.log(`tricks won by ${player}: ${play_state.tricks_per_player[player]}`)
                })
        
            }

        } while (!play_state.game_done)

        let {tricks_per_player, score, old_cumulative_score, new_cumulative_score, score_factor} = wiezen.score()

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

