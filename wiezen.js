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
    dict  // object with id's as keys and links to the cards as values
    
    constructor() {
        // create the deck of cards:
        this.deck = []
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

    #card_by_id(id) {
        id = id.replace('*','')  // remove trump mark
        return this.deck.filter(card => card.id === id).pop()
    }

    #cards_by_ids(ids) {
        ids = ids.map(id => id.replace('*',''))  // remove trump mark
        return this.deck.filter(card => ids.includes(card.id))
    }

    #id_trump(card) {
        return card.id + (card.trump ? '*' : '')
    }

    /* data setters */

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
        console.log(`Deck cut at position ${p}`)
    }

    set_trump(color) {
        if (color) {
            this.deck.filter(card => card.color === color).forEach(card => card.trump = true)
            this.deck.filter(card => card.color != color).forEach(card => card.trump = false)
        } else {
            this.deck.forEach(card => card.trump = false)
        }
    }

    deal_cards_to_player(ids, player) {
        for (const id of ids) {
            // MOVE CARD FROM STACK TO HAND
            let card = this.#card_by_id(id)
            card.state = HAND
            card.hand = player
        }
    }

    play(id, player) {
        let count = this.deck.filter(card => card.state === TABLE).length
        let card = this.#card_by_id(id)
        // MOVE CARD FROM HAND TO TABLE
        card.state = TABLE
        card.table = count + 1  // TODO I wonder if this is actually needed
        card.player = player
    }

    collect_trick(ids, winning_card_id, number) {
        let winning_card = this.#card_by_id(winning_card_id)
        for (const id of ids) {
            // MOVE CARD FROM TABLE TO TRICKS
            let card = this.#card_by_id(id)
            card.state = TRICK
            card.trick = number
            card.winner = winning_card.player
        }
    }

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
    }

    /* data getters */

    /**
     * Return the id of the (temporary) winning card of the trick composed of input cards
     * @param {array of strings} ids 
     * @returns card id with trump mark
     */
    evaluate_trick(ids) {
        function highest_value_card(cards) {
            // regardless color!
            return cards.reduce((highest,card) => card.order > highest.order ? card : highest, cards[0])
        }
        let cards = this.#cards_by_ids(ids)
        let highest_trump = highest_value_card(cards.filter(card => card.trump))
        if (highest_trump) 
            return highest_trump.id
        let opening_card = cards.filter(card => card.table === 1).pop()
        let highest = highest_value_card(cards.filter(card => card.color === opening_card.color))
        return this.#id_trump(highest)
    }
    
    /**
     * List the aces that are NOT in the player's hand
     * @param {string} player 
     * @returns array of card id's (no trump mark)
     */
    get_aces_not_with_player(player) {
        let cards = this.deck.filter(card => card.value === 'A' && card.hand != player)
        return cards.map(card => card.id)
    }

    /**
     * List all cards according to their order in the stack
     * @returns array of card id's (no trump mark)
     */
    get_cards_in_stack_order() {
        let stack = this.deck.filter(card => card.state === STACK)
        let ordered_stack = stack.sort((card1, card2) => card1.stack - card2.stack)
        return ordered_stack.map(card => card.id)
    }

    /**
     * List all cards in the player's hand with the same color
     * @param {string} player 
     * @param {string} id 
     * @returns array of card id's with trump mark
     */
    get_hand_cards_with_same_color(player, id) {
        let color = this.#card_by_id(id).color
        let cards = this.deck.filter(card => card.state === HAND && card.color === color && card.hand === player)
        return cards.map(card => this.#id_trump(card))
    }

    /**
     * Get the color of the card
     * @param {string} id 
     * @returns color of the card
     */
    get_color(id) {
        return this.#card_by_id(id).color
    }

    /**
     * Get the player in who's hand the card is
     * @param {string} id 
     * @returns player 
     */
    get_hand(id) {
        return this.#card_by_id(id).hand
    }

    /**
     * Get each player's hand
     * @returns object with players as  keys and arrays of card id's with trump mark as values
     *     (card id's include trump marker '*')
     */
    get_hands() {
        let hands = {}
        for (const card of this.deck)
            if (card.state === HAND) 
                (hands[card.hand] ??= []).push(this.#id_trump(card))
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
        this.set_trump(this.deck.get_color(cards_in_stack_order[4 * NUMBER_OF_TRICKS - 1]))  // latest card in stack
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
                let troel_player = this.bidding.game_players[0]
                let other_aces = this.deck.get_aces_not_with_player(troel_player)
                if (! other_aces.length) {
                    // players has 4 aces, so H is trump and highest of H plays first
                    this.set_trump(HEARTS)
                    let values = [...VALUES].reverse().shift()  // [K, Q, J,...]
                    let highest_of_hearts = null
                    for (let value of values) {
                        let player = this.deck.get_hand(HEARTS + value)
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
            case MISERIE:
            case MISERIE_TAFEL:
                this.set_trump(null)
                break
        }
        // only rondje pas if no one made a bid!
        if (this.bidding.game === PAS && this.bidding.count_bids === 4)
            this.bidding.game = RONDEPAS
        // initialize tricks per player
        let tricks_per_player = {}
        this.players.forEach(player => tricks_per_player[player] = 0)
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
            hands: this.deck.get_hands(),  // for output only
            tricks_per_player: tricks_per_player,
            count_tricks: 0,  // is assigned to cards won in trick  [1..13]; incremented when collecting trick,
            game_done: false,

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
            case VRAAG:
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
            case ALLEEN:
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
            case ABONDANCE_H:
            case ABONDANCE_S:
            case ABONDANCE_D:
            case ABONDANCE_C:
            case ABONDANCE_TROEF:
                if (game_player_tricks >= 9) {  // gewonnen
                    game_players.forEach(player => score[player] += 3 * (5))
                    opponents.forEach(opponent => score[opponent] -= 5)
                }
                else {  // verloren
                    game_players.forEach(player => score[player] -= 3 * (5))
                    opponents.forEach(opponent => score[opponent] += 5)
                }
                break
            case TROEL:
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
            case MISERIE:
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
            case MISERIE_TAFEL:
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
            case SOLO_H:
            case SOLO_S:
            case SOLO_D:
            case SOLO_C:
                if (game_player_tricks === 13) {  // gewonnen
                    game_players.forEach(player => score[player] += 3 * (75))
                    opponents.forEach(opponent => score[opponent] -= 75)
                }
                else {  // verloren
                    game_players.forEach(player => score[player] -= 3 * (75))
                    opponents.forEach(opponent => score[opponent] += 75)
                }
                break
            case SOLO_SLIM:
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

module.exports = Wiezen

