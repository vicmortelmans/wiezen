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

class Deck {
    deck  // array of cards (see constructor for attributes)
    
    constructor() {
        // create the deck of cards:
        COLORS.forEach((c, ci) => {
            VALUES.forEach((v, vi) => {
                this.deck.push({
                    color: c,
                    value: v,
                    id: c+v,
                    order: 13 * ci + vi,  // only for comparing
                    state: STACK,  // STACK -> HAND -> TABLE -> TRICK
                    trump: null,  // boolean
                    stack: 13 * ci + vi + 1,  // range 1..52 order of the cards in the stack before dealing
                    hand: null,  // name of the player who owned the card
                    table: null,  // range 1..4 order of cards on the table
                    player: null, // name of the player who put the card on the table (same as hand, but only filled in when played)
                    trick: null, // range 1..13 order of the tricks
                    winner: null  // name of the player in who won the trick containing this card
                })
            })
        })
    }

    /**
     * Cut the stack in half at random position and put the bottom half on top of the other.
     */
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
        this.deck.forEach((card, cardi) => cardi <= p ? card.stack += 4 * NUMBER_OF_TRICKS - p : card.stack -= p)
    }

    get_hands() {
        let hands = {}
        for (card of this.deck)
            if (card.state === HAND)
                hands[card.hand].push(card)
        return hands
    }
}

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
        console.log(`Deck cut at position ${p}`)
    }

    /**
     * Distribute the cards in the stack over the players.
     * - This method modifies the position of cards, moving them from STACK to HAND
     * @returns {Object} hands - key: player name, value: array of card objects held by that player
     */
    deal() {
        function deal_cards_to_player(cards_list, player) {
            cards_list.forEach(card => {
                // MOVE CARD FROM STACK TO HAND
                card.state = HAND
                card.hand = player
            })
        }
        // player after dealer is first player
        let players = this.rotate_players(this.player_after(this.dealer))
        // get cards in stack order
        let stack = this.deck.filter(card => card.state === STACK)
        let cards_in_stack_order = [...stack].sort((card1, card2) => card1.stack - card2.stack)
        this.set_trump(cards_in_stack_order[4 * NUMBER_OF_TRICKS - 1].color)  // latest card in stack
        let amounts = [4,4,5]  // should be calculated based on NUMBER_OF_TRICKS for debugging fast games
        amounts.forEach(amount => {
            players.forEach(player => {
                deal_cards_to_player(cards_in_stack_order.splice(0,amount), player)
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
        let games = [...GAMES].filter(game => !game.includes(this.trump))
        this.bidding = {
            game: PAS,
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
        if (this.bidding.games_open.includes(ALLEEN)) {
            this.bidding.player = this.bidding.game_players[0]
        } else {
            // next player in players_bidding who is not a game player is to bid now 
            do { 
                this.bidding.player = this.player_after(this.bidding.player, {list: this.bidding.players_bidding})
            } while (this.bidding.game_players.includes(this.bidding.player))
            // add MEE when applicable (VRAGEN only allows one player to bid MEE)
            if ([VRAAG, MISERIE, MISERIE_TAFEL].includes(this.bidding.game))
                if ( ! (this.bidding.game === VRAAG && this.bidding.game_players.length >= 2) )
                this.bidding.games_open_mee.push(MEE)
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
            case MEE:
                this.bidding.game_players.push(this.bidding.player)
                this.bidding.players_bidding = this.bidding.players_bidding.filter(p => p != this.bidding.player)
                break
            case PAS:
                if (this.bidding.games_open.includes(ALLEEN)) 
                    this.bidding.game = PAS
                this.bidding.players_bidding = this.bidding.players_bidding.filter(p => p != this.bidding.player)
                break
            case ALLEEN:
                this.bidding.game = bid
                this.bidding.players_bidding = []
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
            this.bidding.games_open = this.bidding.games_open.filter(game => game != TROEL)
            // if game is still VRAAG and there's one game player, he can choose to bid ALLEEN
            if (this.bidding.game === VRAAG && this.bidding.game_players.length === 1) {
                this.bidding.games_open = [ALLEEN, PAS]
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
     * - {array} playable_cards - containing the cards that can be played
     * - {array} cards_on_table - containing the cards that are on the table
     * - {object} winning_card - the card on the table that is currently winning
     * - {array} hands - key: player name, value: array of card objects held by that player
     * - {array} tricks_per_player - key: player name, value: number counting the tricks won by that player
     * - {number} count_tricks - how many tricks have been played 
     * - {boolean} game_done: set true after the last trick has been played
     */
     initialize_play() {
        // change trump if needed and set first player
        let next_player = this.player_after(this.dealer)  // player after dealer is to play first by default
        switch (this.bidding.game) {
            case ABONDANCE_H:
            case SOLO_H:
                this.set_trump(HEARTS)
                next_player = this.bidding.game_players[0]
                break
            case ABONDANCE_S:
            case SOLO_S:
                this.set_trump(SPADES)
                next_player = this.bidding.game_players[0]
                break
            case ABONDANCE_D:
            case SOLO_D:
                this.set_trump(DIAMONDS)
                next_player = this.bidding.game_players[0]
                break
            case ABONDANCE_C:
            case SOLO_C:
                this.set_trump(CLUBS)
                next_player = this.bidding.game_players[0]
                break
            case TROEL:
                let aces = this.deck.filter(card => card.value === 'A')
                let troel_player = this.bidding.game_players[0]
                if (aces.every(ace => ace.hand === troel_player)) {
                    // players has 4 aces, so H is trump and highest of H plays first
                    this.set_trump(HEARTS)
                    let values = [...VALUES].reverse().shift()  // [K, Q, J,...]
                    let highest_of_hearts = null
                    for (let value of values) {
                        highest_of_hearts = this.deck.filter(card => card.color === HEARTS && card.hand != troel_player)
                        if (highest_of_hearts) {
                            next_player = highest_of_hearts.hand
                            this.bidding.game_players.push(highest_of_hearts.hand)
                            break
                        }                        
                    }
                } else {
                    // 4th ace is trump and plays first
                    let ace4 = aces.filter(ace => ace.hand != troel_player)[0]
                    this.set_trump(ace4.color)
                    next_player = ace4.hand
                    this.bidding.game_players.push(ace4.hand)
                }
                break
            case MISERIE:
            case MISERIE_TAFEL:
                this.set_trump(null)
                break
        }
        // only rondje pas if no one made a bid!
        if (this.bidding.game === PAS && this.bidding.count_bids === 4)
            this.bidding.game = RONDEPAS
        // collect hands for output
        let hands = {}
        this.players.forEach(player => hands[player] = this.deck.filter(card => card.hand === player))
        // initialize tricks per player
        let tricks_per_player = {}
        this.players.forEach(player => tricks_per_player[player] = 0)
        // initialize depleted colors
        let depleted_colors = {}
        this.players.forEach(player => depleted_colors[player] = [])
        this.playing = {
            game: this.bidding.game,
            game_playable: [PAS, RONDEPAS].includes(this.bidding.game) ? false : true,
            game_players: this.bidding.game_players,
            trump: this.trump,
            player: null,
            next_player: next_player,
            playable_cards: [],
            cards_on_table: [],
            winning_card: null,
            hands: hands,
            tricks_per_player: tricks_per_player,
            count_tricks: 0,  // is assigned to cards won in trick  [1..13]; incremented when collecting trick,
            game_done: false,
            depleted_colors: depleted_colors  // object per player listing publicly known depleted colors 
                                 // (only filled in after a play_request where the player can't follow suit)

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
     * Process the card that has been played:
     * - which cards are on the table (cards_on_table)?
     * - which cards are in the player's hands (hands)?
     * - which card on the table is currently winning (winning_card)?
     * - who is the next player (next_player)?
     * - This method modifies the position of cards, moving them from HAND to TABLE
     * @param {string} card - card that was played
     * @returns {object} state - object for keeping track of the playing workflow
     */
     play(card) {
        // Player didn't follow suit? let's remember that!
        if (this.playing.cards_on_table.length > 0) {
            let opening_card = this.playing.cards_on_table.filter(card => card.table === 1).pop()
            if (card.color != opening_card.color)
                this.playing.depleted_colors[this.playing.player].push(opening_card.color)
        }
        // MOVE CARD FROM HAND TO TABLE
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
        this.playing.cards_on_table.forEach(card => {
            // MOVE CARD FROM TABLE TO TRICKS
            card.state = TRICK
            card.trick = this.playing.count_tricks + 1
            card.winner = this.playing.winning_card.player
        })
        this.playing.next_player = this.playing.winning_card.player
        this.playing.tricks_per_player[this.playing.winning_card.player]++
        this.playing.cards_on_table = []
        this.playing.winning_card = null
        this.playing.count_tricks++
        this.playing.game_done = this.playing.count_tricks >= NUMBER_OF_TRICKS
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
    score() {
        /* https://www.rijkvanafdronk.be//puntentelling/puntentelling/ */
        let old_cumulative_score = {...this.score}
        let players = this.playing.game_players
        let opponents = this.players.filter(player => !this.playing.game_players.includes(player))
        let game_player_tricks = 0
        players.forEach(player => {
            game_player_tricks += this.playing.tricks_per_player[player]
        })
        let score = {}
        this.players.forEach(player => score[player] = 0)
        switch (this.playing.game) {
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
                    let single_player_opponents = this.players.filter(player => player != player)
                    if (this.playing.tricks_per_player[player] === 0) {  // gewonnen
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
                    let single_player_opponents = this.players.filter(player => player != player)
                    if (this.playing.tricks_per_player[player] === 0) {  // gewonnen
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
        // MOVE CARDS FROM TRICKS TO STACK
        this.deck.forEach(card => {
            card.state = STACK
            card.trump = null
            card.stack = 13 * (card.trick - 1) + card.table - 1
            card.hand = null
            card.table = null
            card.player = null
            card.trick = null
            card.winner = null
        })
        this.trump = null
        switch (this.playing.game) {
            case PAS:
                this.dealer = this.player_after(this.dealer)
                this.rondepas_count = 0
                break
            case RONDEPAS:
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
    
    set_trump(color) {
        this.trump = color  // null is allowed to remove trump
        if (color) {
            this.deck.filter(card => card.color === color).forEach(card => card.trump = true)
            this.deck.filter(card => card.color != color).forEach(card => card.trump = false)
        } else {
            this.deck.forEach(card => card.trump = false)
        }
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


    
}

module.exports = Wiezen

