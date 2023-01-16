var Wiezen = require("./wiezen")

const PROMPT = require("prompt-sync")({ sigint: true });

function list_to_string_numbered(list) {
    return list.map((item, itemi) => item + `[${itemi}]`).toString()
}

let players = ['Joe', 'Jack', 'William', 'Avarell']

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

            console.log(`Table: ${play_state.cards_on_table.toString()}`)
            console.log(`Hand of ${play_state.player}: ${play_state.hands[play_state.player].toString()}`)
            console.log(`Play card from: ${list_to_string_numbered(play_state.playable_cards)}`)
            let idx
            do {
                idx = parseInt(PROMPT("Which card will you play? "));
            } while (isNaN(idx) || idx < 0 || idx >= play_state.playable_cards.length)
            let card_id = play_state.playable_cards[idx]

            play_state = wiezen.play(card_id)

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

