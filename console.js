var Wiezen = require("./wiezen")
var Deck = require("./deck")
var colors = require("colors")

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

let players = ['Joe', 'Jack', 'William', 'Avarell']

let wiezen = new Wiezen(players)

while (true) {

    wiezen.cut()

    let hands = wiezen.deal()

    for (const player of players) console.log(`Hand of ${player}: ${colored(hands[player]).toString()}`)

    let bidding_state = wiezen.initialize_bid()

    do {

        bidding_state = wiezen.bid_request()

        console.log(`Game bid: ${bidding_state.game}`)
        console.log(`By: ${bidding_state.game_players.toString()}`)
        console.log(`Higher bid is open to: ${bidding_state.player}`)
        console.log(`Open games: ${numbered(bidding_state.games_open_mee).toString()}`)
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
        console.log(`Trump: ${colored([play_state.trump]).toString()}`)

        do {

            play_state = wiezen.play_request()

            console.log(`Table: ${play_state.cards_on_table.toString()}`)
            console.log(`Hand of ${play_state.player}: ${colored(play_state.hands[play_state.player]).toString()}`)
            console.log(`Play card from: ${colored(numbered(play_state.playable_cards)).toString()}`)
            let idx
            do {
                idx = parseInt(PROMPT("Which card will you play? "));
            } while (isNaN(idx) || idx < 0 || idx >= play_state.playable_cards.length)
            let card_id = play_state.playable_cards[idx]

            play_state = wiezen.play(card_id)

            if (play_state.cards_on_table.length === 4) {

                console.log(`Trick won by ${wiezen.get_hand(play_state.winning_card)} (${colored([play_state.winning_card]).toString()}): ${colored(play_state.cards_on_table).toString()}`)

                play_state = wiezen.collect_trick()
                wiezen.clear_table()

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

        console.log(`Game set: ${play_state.game}`)
        
    }

    wiezen.new_game()
    
}

