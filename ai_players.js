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

            wiezen_clone = JSON.parse(JSON.stringify(wiezen))
            
            console.log(`Table: ${cards_to_string(play_state.cards_on_table)}`)
            console.log(`Hand of ${play_state.player}: ${cards_to_string(play_state.hands[play_state.player])}`)
            console.log(`Play card from: ${cards_to_string(play_state.playable_cards, {numbered: true})}`)
            let idx
            do {
                idx = parseInt(PROMPT("Which card will you play? "));
            } while (isNaN(idx) || idx < 0 || idx >= play_state.playable_cards.length)
            let card = play_state.playable_cards[idx]

            play_state = wiezen.play(card)

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

