var Deck = require("./deck")

/**
 * Class representing four players playing a series of whist games.
 */
class Wiezen {
    deck  // Deck object
    players  // array of strings ** DO NOT CHANGE ** 
    dealer  // string ** THIS IS UPDATED AFTER EACH GAME **
    trump  // string (from COLORS)
    score  // object scores per player
    game_number  // numbering games 0,1,2,...; a game number stands until a game is actually played!
    rondepas_count  // counting subsequent rondepas
    scorefactors  // array of multipliers for each game
    bidding  // object managing state during bidding workflow
    playing  // object managing state during playing workflow
    
    /**
     * Constructor of a Wiezen object.
     * @param {Array} players - containing player names as strings
     */
    constructor(players) {
        this.players = [...players]
        this.dealer = this.players[0]
        this.trump = null
        this.deck = new Deck()
        this.score = {}
        this.game_number = 0
        this.rondepas_count = 0
        this.scorefactors = []
        this.bidding = {}
        this.playing = {}
        // initialize score
        players.forEach(player => this.score[player] = 0)
    }

    /**
     * Cut the stack in half at random position and put the bottom half on top of the other.
     */
    cut() {
        this.deck.cut()
    }

    /**
     * Distribute the cards in the stack over the players.
     * - This method modifies the position of cards, moving them from STACK to HAND
     * - Set trump color
     * @returns {Object} hands - key: player name, value: array of card id's held by that player
     *     (card id's include trump marker '*')
     */
    deal() {
        let cards_in_stack_order = this.deck.get_cards_in_stack_order()
        this.set_trump(this.deck.get_color(cards_in_stack_order[4 * Wiezen.NUMBER_OF_TRICKS - 1]))  // latest card in stack
        // player after dealer is first player
        let players = this.rotate_players(this.player_after(this.dealer))
        let amounts = [4,4,5]  // should be calculated based on NUMBER_OF_TRICKS for debugging fast games
        amounts.forEach(amount => {
            players.forEach(player => {
                this.deck.deal_cards_to_player(cards_in_stack_order.splice(0,amount), player)
            })
        })
        return this.deck.get_hands()
    }

    /**
     * Initialize data for the bidding workflow. A bidding workflow consists of (1) `initialize_bid()`,
     * then loop over (2) `bid_request()` -> (3) ask user for bid -> (4) `bid()` until players_bidding is 0.
     * @returns {object} state - object for keeping track of the bidding workflow
     * - {string} game - the highest bid up till now
     * - {array} game_players - containing the names of the players taking part of the highest bid
     * - {array} games_open - containing the games that can be bid
     * - {array} games_open_mee - containing the games that can be bid, and also 'meegaan' if applicable
     * - {array} players_bidding - containing the players that still can place new bids
     * - {string} player - the player currently up for a new bid
     * - {number} count_bids - how many bids have been made (this includes PAS)
     * - {number} score_factor - multiplier that will be applied to the score of this game
     */
    initialize_bid() {
        let games = [...Wiezen.GAMES].filter(game => !game.includes(this.trump))
        this.bidding = {
            game: Wiezen.PAS,
            game_players: [],
            games_open: games,
            games_open_mee: null,
            players_bidding: [...this.players],  // /!\ not necessarily in right order yet !
            player: this.dealer,  // player after dealer is to bid first 
            count_bids: 0,
            score_factor: this.scorefactors[this.game_number]       
        }
        return this.bidding
    }

    /**
     * Prepare data for the next bid: 
     * - which player is up for a new bid (player)? 
     * - which games can be bid (games_open_mee)?
     * @returns {object} state - object for keeping track of the bidding workflow
     */
    bid_request() {
        this.bidding.games_open_mee = [...this.bidding.games_open]
        if (this.bidding.games_open.includes(Wiezen.ALLEEN)) {
            this.bidding.player = this.bidding.game_players[0]
        } else {
            // next player in players_bidding who is not a game player is to bid now 
            do { 
                this.bidding.player = this.player_after(this.bidding.player, {list: this.bidding.players_bidding})
            } while (this.bidding.game_players.includes(this.bidding.player))
            // add MEE when applicable (VRAGEN only allows one player to bid MEE)
            if ([Wiezen.VRAAG, Wiezen.MISERIE, Wiezen.MISERIE_TAFEL].includes(this.bidding.game))
                if ( ! (this.bidding.game === Wiezen.VRAAG && this.bidding.game_players.length >= 2) )
                this.bidding.games_open_mee.push(Wiezen.MEE)
        }
        return this.bidding
    }

    /**
     * Process the bid made by the player: 
     * - which game is now highest (game)? 
     * - which players are participating (game_players)? 
     * - which players can still place a new bid (players_bidding)?
     * - which games can be bid (games_open)?
     * @param {string} bid - game selected by the player
     * @returns {object} state - object for keeping track of the bidding workflow
     */
    bid(bid) {
        switch (bid) {
            case Wiezen.MEE:
                this.bidding.game_players.push(this.bidding.player)
                this.bidding.players_bidding = this.bidding.players_bidding.filter(p => p != this.bidding.player)
                break
            case Wiezen.PAS:
                if (this.bidding.games_open.includes(Wiezen.ALLEEN)) 
                    this.bidding.game = Wiezen.PAS
                this.bidding.players_bidding = this.bidding.players_bidding.filter(p => p != this.bidding.player)
                break
            case Wiezen.ALLEEN:
                this.bidding.game = bid
                this.bidding.players_bidding = []
                break
            case Wiezen.VRAAG:
            case Wiezen.ABONDANCE_H:
            case Wiezen.ABONDANCE_S:
            case Wiezen.ABONDANCE_D:
            case Wiezen.ABONDANCE_C:
            case Wiezen.ABONDANCE_TROEF:
            case Wiezen.MISERIE:
            case Wiezen.TROEL:
            case Wiezen.MISERIE_TAFEL:
            case Wiezen.SOLO_H:
            case Wiezen.SOLO_S:
            case Wiezen.SOLO_D:
            case Wiezen.SOLO_C:
            case Wiezen.SOLO_SLIM:
                if (this.bidding.game_players.length > 0)
                    // players that have bid a lower game can bid again
                    this.bidding.players_bidding.push(...this.bidding.game_players)
                this.bidding.game = bid
                this.bidding.game_players = [this.bidding.player]
                this.bidding.players_bidding = this.bidding.players_bidding.filter(p => p != this.bidding.player)
                while (this.bidding.games_open[0] != bid) this.bidding.games_open.shift()
                    this.bidding.games_open.shift()  // remove this game and lower games
        }
        if (++this.bidding.count_bids === 4) {
            // after a first round, TROEL should be removed
            this.bidding.games_open = this.bidding.games_open.filter(game => game != Wiezen.TROEL)
            // if game is still VRAAG and there's one game player, he can choose to bid ALLEEN
            if (this.bidding.game === Wiezen.VRAAG && this.bidding.game_players.length === 1) {
                this.bidding.games_open = [Wiezen.ALLEEN, Wiezen.PAS]
                this.bidding.players_bidding.push(this.bidding.game_players[0])
            }
        }
        return this.bidding
    }

    /**
     * Initialize data for the playing workflow. A playing workflow covers 13 tricks and consists
     * of (1) `initialize_play()` and then loop for playing all cards: (2) `play_request()` -> (3) ask user for a card
     * to play -> (4) `play()` -> (5) `collect_trick()` until game_done. Step 5 is only done after
     * every 4th card. When game_done, (6) `score` is calculated. If the game is not playable, 
     * steps (2) -> (6) are skipped. Finally, (7) `new_game` sets up for a new bidding workflow.  
     * Data is read from the bidding state object that is the result of the bidding workflow 
     * (after this, the bidding_state can be discarded). Only following attributes are relevant now:
     * - {string} game - the highest bid 
     * - {array} game_players - containing the names of the players taking part of the highest bid
     * - {number} count_bids - how many bids have been made (this includes PAS)
     * @returns {object} state - object for keeping track of the PLAYING workflow
     * - {string} game - the name of the game
     * - {boolean} game_playable - false when bidding ended in PAS
     * - {array} game_players - containing the names of the players taking part of the game
     * - {string} trump - color that is trump
     * - {string} player - the player currently playing a card
     * - {string} next_player - the player who has to play the next card 
     * - {array} playable_cards - containing the card id's that can be played
     * - {array} cards_on_table - containing the cards id'd that are on the table
     * - {object} winning_card - the card id on the table that is currently winning
     * - {array} hands - key: player name, value: array of card id's held by that player
     *     (card id's include trump marker '*')
     * - {array} tricks_per_player - key: player name, value: number counting the tricks won by that player
     * - {number} count_tricks - how many tricks have been played 
     * - {boolean} game_done: set true after the last trick has been played
     */
     initialize_play() {
        // change trump if needed and set first player
        let next_player = this.player_after(this.dealer)  // player after dealer is to play first by default
        switch (this.bidding.game) {
            case Wiezen.ABONDANCE_H:
            case Wiezen.SOLO_H:
                this.set_trump(Deck.HEARTS)
                next_player = this.bidding.game_players[0]
                break
            case Wiezen.ABONDANCE_S:
            case Wiezen.SOLO_S:
                this.set_trump(Deck.SPADES)
                next_player = this.bidding.game_players[0]
                break
            case Wiezen.ABONDANCE_D:
            case Wiezen.SOLO_D:
                this.set_trump(Deck.DIAMONDS)
                next_player = this.bidding.game_players[0]
                break
            case Wiezen.ABONDANCE_C:
            case Wiezen.SOLO_C:
                this.set_trump(Deck.CLUBS)
                next_player = this.bidding.game_players[0]
                break
            case Wiezen.TROEL:
                let troel_player = this.bidding.game_players[0]
                let other_aces = this.deck.get_aces_not_with_player(troel_player)
                if (! other_aces.length) {
                    // players has 4 aces, so H is trump and highest of H plays first
                    this.set_trump(Deck.HEARTS)
                    let values = [...Deck.VALUES].reverse().shift()  // [K, Q, J,...]
                    let highest_of_hearts = null
                    for (let value of values) {
                        let player = this.deck.get_hand(Deck.HEARTS + value)
                        if (player != troel_player) {
                            next_player = player
                            this.bidding.game_players.push(next_player)
                            break
                        }                        
                    }
                } else {
                    // 4th ace is trump and plays first
                    let ace4 = other_aces.pop()
                    this.set_trump(this.deck.get_color(ace4))
                    next_player = this.deck.get_hand(ace4)
                    this.bidding.game_players.push(next_player)
                }
                break
            case Wiezen.MISERIE:
            case Wiezen.MISERIE_TAFEL:
                this.set_trump(null)
                break
        }
        // only rondje pas if no one made a bid!
        if (this.bidding.game === Wiezen.PAS && this.bidding.count_bids === 4)
            this.bidding.game = Wiezen.RONDEPAS
        // initialize tricks per player
        let tricks_per_player = {}
        this.players.forEach(player => tricks_per_player[player] = 0)
        this.playing = {
            game: this.bidding.game,
            game_playable: [Wiezen.PAS, Wiezen.RONDEPAS].includes(this.bidding.game) ? false : true,
            game_players: this.bidding.game_players,
            trump: this.trump,
            player: null,
            next_player: next_player,
            playable_cards: [],
            cards_on_table: [],
            winning_card: null,
            hands: this.deck.get_hands(),  // for output only
            tricks_per_player: tricks_per_player,
            count_tricks: 0,  // is assigned to cards won in trick  [1..13]; incremented when collecting trick,
            game_done: false
        }
        return this.playing
    }

    /**
     * Prepare data for playing the next card:
     * - who is the player (player)?
     * - which cards can be played (playable_cards)?
     * @returns {object} state - object for keeping track of the playing workflow
     */
    play_request() {
        // next player is to play now
        this.playing.player = this.playing.next_player
        this.playing.next_player = null
        // look at table cards to set playable 
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
     * Process the card that has been played:
     * - which cards are on the table (cards_on_table)?
     * - which cards are in the player's hands (hands)?
     * - which card on the table is currently winning (winning_card)?
     * - who is the next player (next_player)?
     * - This method modifies the position of cards, moving them from HAND to TABLE
     * @param {string} card_id - id of the card that was played
     * @returns {object} state - object for keeping track of the playing workflow
     */
     play(card_id) {
        this.deck.play(card_id, this.playing.player)
        this.playing.playable_cards = null
        this.playing.cards_on_table.push(card_id)
        this.playing.hands = this.deck.get_hands()
        this.playing.winning_card = this.deck.evaluate_trick(this.playing.cards_on_table)
        this.playing.next_player = this.player_after(this.playing.player)
        return this.playing
    }

    /**
     * Process the trick when it is complete:
     * - who is the next player = the winner of the trick (next_player)?
     * - how many tricks has each player won so far (tricks_per_player)?
     * - how many tricks have been played (count_tricks)?
     * - was this the last trick of the game (game_done)?
     * - This method modifies the position of cards, moving them from TABLE to TRICK
     * @returns {object} state - object for keeping track of the playing workflow
     */
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

    /**
     * Calculate the score for the finished game 
     * @returns {object} scores
     * - {object} tricks_per_player - key: player name, value: number counting the tricks won by that player
     * - {object} score - key: player name, value: score of the last game
     * - {object} old_cumulative_score - key: player name, value: total score BEFORE playing this game
     * - {object} new_cumulative_score - key: player name, value: total score AFTER playing this game
     * - {number} score_factor - multiplier that has been applied to the score of this game
     */
    calculate_score() {
        /* https://www.rijkvanafdronk.be//puntentelling/puntentelling/ */
        let old_cumulative_score = {...this.score}
        let game_players = this.playing.game_players
        let opponents = this.players.filter(player => !this.playing.game_players.includes(player))
        let game_player_tricks = 0
        game_players.forEach(player => {
            game_player_tricks += this.playing.tricks_per_player[player]
        })
        let score = {}
        this.players.forEach(player => score[player] = 0)
        switch (this.playing.game) {
            case Wiezen.VRAAG:
                if (game_player_tricks === 13) {  // onder tafel
                    game_players.forEach(player => score[player] += 14)
                    opponents.forEach(opponent => score[opponent] -= 14)
                }
                else if (game_player_tricks >= 8) {  // gewonnen
                    let extra = game_player_tricks - 8
                    game_players.forEach(player => score[player] += 2 + extra)
                    opponents.forEach(opponent => score[opponent] -= 2 + extra)
                }
                else {  // verloren
                    let extra = 8 - game_player_tricks
                    game_players.forEach(player => score[player] -= 2 + extra)
                    opponents.forEach(opponent => score[opponent] += 2 + extra)
                }
                break
            case Wiezen.ALLEEN:
                if (game_player_tricks === 13) {  // onder tafel
                    game_players.forEach(player => score[player] += 60)
                    opponents.forEach(opponent => score[opponent] -= 20)
                }
                else if (game_player_tricks >= 8) {  // gewonnen
                    let extra = game_player_tricks - 8
                    game_players.forEach(player => score[player] += 3 * (3 + extra))
                    opponents.forEach(opponent => score[opponent] -= 3 + extra)
                }
                else {  // verloren
                    let extra = 8 - game_player_tricks
                    game_players.forEach(player => score[player] -= 3 * (2 + extra))
                    opponents.forEach(opponent => score[opponent] += 2 + extra)
                }
            case Wiezen.ABONDANCE_H:
            case Wiezen.ABONDANCE_S:
            case Wiezen.ABONDANCE_D:
            case Wiezen.ABONDANCE_C:
            case Wiezen.ABONDANCE_TROEF:
                if (game_player_tricks >= 9) {  // gewonnen
                    game_players.forEach(player => score[player] += 3 * (5))
                    opponents.forEach(opponent => score[opponent] -= 5)
                }
                else {  // verloren
                    game_players.forEach(player => score[player] -= 3 * (5))
                    opponents.forEach(opponent => score[opponent] += 5)
                }
                break
            case Wiezen.TROEL:
                if (game_player_tricks === 13) {  // onder tafel
                    game_players.forEach(player => score[player] += 2 * 14)
                    opponents.forEach(opponent => score[opponent] -= 2 * 14)
                }
                else if (game_player_tricks >= 8) {  // gewonnen
                    let extra = game_player_tricks - 8
                    game_players.forEach(player => score[player] += 2 * (2 + extra))
                    opponents.forEach(opponent => score[opponent] -= 2 * (2 + extra))
                }
                else {  // verloren
                    let extra = 8 - game_player_tricks
                    game_players.forEach(player => score[player] -= 2 * (2 + extra))
                    opponents.forEach(opponent => score[opponent] += 2 * (2 + extra))
                }
                break
            case Wiezen.MISERIE:
                game_players.forEach(game_player => {
                    let single_player_opponents = this.players.filter(player => player != game_player)
                    if (this.playing.tricks_per_player[game_player] === 0) {  // gewonnen
                        score[game_player] += 3 * (5)
                        single_player_opponents.forEach(opponent => score[opponent] -= 5)
                    } else {  // verloren
                        score[game_player] -= 3 * (5)
                        single_player_opponents.forEach(opponent => score[opponent] += 5)
                    }
                })
                break
            case Wiezen.MISERIE_TAFEL:
                game_players.forEach(game_player => {
                    let single_player_opponents = this.players.filter(player => player != game_player)
                    if (this.playing.tricks_per_player[game_player] === 0) {  // gewonnen
                        score[game_player] += 3 * (15)
                        single_player_opponents.forEach(opponent => score[opponent] -= 15)
                    } else {  // verloren
                        score[game_player] -= 3 * (15)
                        single_player_opponents.forEach(opponent => score[opponent] += 15)
                    }
                })
                break
            case Wiezen.SOLO_H:
            case Wiezen.SOLO_S:
            case Wiezen.SOLO_D:
            case Wiezen.SOLO_C:
                if (game_player_tricks === 13) {  // gewonnen
                    game_players.forEach(player => score[player] += 3 * (75))
                    opponents.forEach(opponent => score[opponent] -= 75)
                }
                else {  // verloren
                    game_players.forEach(player => score[player] -= 3 * (75))
                    opponents.forEach(opponent => score[opponent] += 75)
                }
                break
            case Wiezen.SOLO_SLIM:
                if (game_player_tricks === 13) {  // gewonnen
                    game_players.forEach(player => score[player] += 3 * (150))
                    opponents.forEach(opponent => score[opponent] -= 150)
                }
                else {  // verloren
                    game_players.forEach(player => score[player] -= 3 * (150))
                    opponents.forEach(opponent => score[opponent] += 150)
                }
                break
        }
        // apply multiplier
        if (this.scorefactors[this.game_number])
            this.players.forEach(player => {
                score[player] *= this.scorefactors[this.game_number]
            })
        // cumulative score
        this.players.forEach(player => {
            this.score[player] += score[player]
        })
        return {
            tricks_per_player: this.playing.tricks_per_player,
            score: score, 
            old_cumulative_score: old_cumulative_score, 
            new_cumulative_score: this.score,
            score_factor: this.scorefactors[this.game_number]
        }
    }

    /**
     * Collect the cards back into the stack for a next game. Assign the next dealer. In case of RONDEPAS, increment the score factors of future games.
     * - This method modifies the position of cards, moving them from TRICK to STACK
     */
    new_game() {
        this.deck.new_game()
        this.trump = null
        switch (this.playing.game) {
            case Wiezen.PAS:
                this.dealer = this.player_after(this.dealer)
                this.rondepas_count = 0
                break
            case Wiezen.RONDEPAS:
                if (this.rondepas_count >= 3) {
                    this.dealer = this.player_after(this.dealer)
                    if (!this.scorefactors[this.game_number + this.rondepas_count])
                        this.scorefactors[this.game_number + this.rondepas_count] = 1
                    this.scorefactors[this.game_number + this.rondepas_count]++
                    this.rondepas_count++
                } else {
                    if (!this.scorefactors[this.game_number + this.rondepas_count])
                        this.scorefactors[this.game_number + this.rondepas_count] = 1
                    this.scorefactors[this.game_number + this.rondepas_count]++
                    this.rondepas_count++
                }
                break
            default:
                this.dealer = this.player_after(this.dealer)
                this.rondepas_count = 0
                this.game_number++
        }
    }

    set_trump(color) {
        this.trump = color  // null is allowed to remove trump
        this.deck.set_trump(color)  // mark trump cards in deck
    }

    rotate_players(first_player, {list = null} = {}) {
        // returns a COPY of the array of players (or custom list, if provided) with 'first_player' first
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

Wiezen.PAS = 'pas'
Wiezen.RONDEPAS = 'ronde pas'
Wiezen.VRAAG = 'vraag'
Wiezen.ABONDANCE_H = 'abondance in ♥'
Wiezen.ABONDANCE_S = 'abondance in ♠'
Wiezen.ABONDANCE_D = 'abondance in ♦'
Wiezen.ABONDANCE_C = 'abondance in ♣'
Wiezen.ABONDANCE_TROEF = 'abondance in troef'
Wiezen.MISERIE = 'miserie'
Wiezen.TROEL = 'troel'
Wiezen.MISERIE_TAFEL = 'miserie op tafel'
Wiezen.SOLO_H = 'solo in ♥'
Wiezen.SOLO_S = 'solo in ♠'
Wiezen.SOLO_D = 'solo in ♦'
Wiezen.SOLO_C = 'solo in ♣'
Wiezen.SOLO_SLIM = 'solo slim'
Wiezen.MEE = 'meegaan'
Wiezen.ALLEEN = 'alleen'
Wiezen.GAMES = [Wiezen.VRAAG, Wiezen.ABONDANCE_H, Wiezen.ABONDANCE_S, Wiezen.ABONDANCE_D, Wiezen.ABONDANCE_C, 
    Wiezen.ABONDANCE_TROEF, Wiezen.MISERIE, Wiezen.TROEL, Wiezen.MISERIE_TAFEL, Wiezen.SOLO_H, Wiezen.SOLO_S, Wiezen.SOLO_D, Wiezen.SOLO_C, 
    Wiezen.SOLO_SLIM, Wiezen.PAS]
Wiezen.NUMBER_OF_TRICKS = Deck.VALUES.length

module.exports = Wiezen