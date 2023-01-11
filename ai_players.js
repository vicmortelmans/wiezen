var Wiezen = require("./wiezen")

const PROMPT = require("prompt-sync")({ sigint: true });

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

// - object playing_state (= player-neutral), 
// - object wiezen (does it need to be stored??)
// - dict by card of links to the new nodes
// - list by player of the score (=fixed) and 
// - list by player of the evaluation(=dynamic until final depth is reached)
function minimax_player(node, depth, alpha, beta, maximizing) {
    // static evaluation of node = the number of tricks won + 1 if winning current trick
    if (depth === 0 || node.state.game_done) {
        return node.scores[node.watching_player]
    }
    // create the child nodes
    node.state.playable_cards.forEach(card => {
        console.log(`Calculating move for ${node.watching_player}: ${node.state.player} virtually playing ${card.color}${card.value}`)
        let wiezen_clone = JSON.parse(JSON.stringify(wiezen))
        let play_state = wiezen_clone.play(card)
        if (play_state.cards_on_table.length === 4) {
            play_state = wiezen_clone.collect_trick()
        }
        // store scores in the node
        node.children[card] = {
            watching_player: node.watching_player,
            state: play_state,
            wiezen: wiezen_clone,
            children: {},
            scores: play_state.tricks_per_player + (play_state.winning_card === card ? 1 : 0)
        }
    })
    if (maximizing) {
        max_eval = -999
        for (let child of node.children) {
            scores = minimax_player(child, depth-1, alpha, beta, child.state.player === node.watching_player)
            eval = scores[node.watching_player]
            max_eval = Math.max(max_eval, eval)
            alpha = Math.max(alpha, eval)
            if (beta <= alpha)
                break
        }
        return scores
    }
    else {
        minEval = 999
        for (let child of node.children) {
            scores = minimax_player(child, depth-1, alpha, beta, child.state.player === node.watching_player)
            eval = scores[node.watching_player]
            min_eval = Math.min(min_eval, eval)
            beta = Math.min(beta, eval)
            if (beta <= alpha)
                break
        }
        return scores
    }
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

        bidding_state = wiezen.bid_request()

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
            
        bidding_state = wiezen.bid(bid)

    } while (bidding_state.players_bidding.length > 0)

    let play_state = wiezen.initialize_play()

    if (play_state.game_playable) {

        console.log(`Game set: ${play_state.game}`)
        console.log(`Player(s): ${play_state.game_players}`)
        console.log(`Trump: ${play_state.trump}`)

        do {

            play_state = wiezen.play_request()

            
            console.log(`Table: ${cards_to_string(play_state.cards_on_table)}`)
            console.log(`Hand of ${play_state.player}: ${cards_to_string(play_state.hands[play_state.player])}`)
            console.log(`Play card from: ${cards_to_string(play_state.playable_cards, {numbered: true})}`)
            
            // if this is the player's first card, initialize game_tree_node for this player
            if (!( play_state.player in game_tree_root_nodes)) {
                game_tree_root_nodes[play_state.player] = {
                    watching_player: play_state.player,
                    state: play_state,
                    wiezen: wiezen,
                    children: {},
                    scores: []
                }
                game_tree_current_nodes[play_state.player] = game_tree_root_nodes[play_state.player]
            }

            // let the minimax algorithm choose a card
            // during this process, the game tree is filled in to a certain depth
            let card = minimax_player(game_tree_current_nodes[play_state.player], 2, -999, 999, true)

            play_state = wiezen.play(card)

            // change tree pointer to the child node
            game_tree_current_nodes[play_state.player] = game_tree_current_nodes[play_state.player].children[card]

            if (play_state.cards_on_table.length === 4) {

                console.log(`Trick won by ${play_state.winning_card.player} (${cards_to_string([play_state.winning_card])}): ${cards_to_string(play_state.cards_on_table)}`)

                play_state = wiezen.collect_trick()

                players.forEach(player => {
                    console.log(`Tricks won by ${player}: ${play_state.tricks_per_player[player]}`)
                })
        
            }

        } while (!play_state.game_done)

        let {tricks_per_player, score, old_cumulative_score, new_cumulative_score, score_factor} = wiezen.score()

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

    wiezen.new_game()
    
}

