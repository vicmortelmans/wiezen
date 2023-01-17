let LocalStorage = require('node-localstorage').LocalStorage
let localStorage = new LocalStorage('./deck')

/**
 * 
 */
class Deck {
    deck  // array of cards (see constructor for attributes)
    
    /**
     * 
     * @param {object} deck (optional). If deck is provided, its contents is cloned.
     * Without arguments, the deck that was stored after the last game is restored.
     * If there's no deck stored, a fresh deck is created.
     */
    constructor(deck) {
        if (deck) {
            // clone an existing deck (cf. wiezen_ai)
            this.deck = JSON.parse(JSON.stringify(deck.deck))
        }
        else {
            // retrieve the deck stored after the last game
            this.deck = JSON.parse(localStorage.getItem('deck'))
            if (!this.deck) {
                // create the deck of cards:
                console.log("A fresh deck is taken out of the box.")
                this.deck = []
                Deck.COLORS.forEach((c, ci) => {
                    Deck.VALUES.forEach((v, vi) => {
                        this.deck.push({
                            color: c,
                            value: v,
                            id: c+v,
                            order: 13 * ci + vi,  // only for comparing
                            state: Deck.STACK,  // STACK -> HAND -> TABLE -> TRICK
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
        }
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
        let p = getRandomIntInclusive(1, this.deck.length - 1)  // p is how many cards you pick up
        // stack positions [1..p] become [52-p+1..52]
        // stack positions [p+1..52] become [1..52-p]
        this.deck.forEach((card, cardi) => cardi <= p ? card.stack += this.deck.length - p : card.stack -= p)
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
            card.state = Deck.HAND
            card.hand = player
        }
    }

    play(id, player) {
        let count = this.deck.filter(card => card.state === Deck.TABLE).length
        let card = this.#card_by_id(id)
        // MOVE CARD FROM HAND TO TABLE
        card.state = Deck.TABLE
        card.table = count + 1  // TODO I wonder if this is actually needed
        card.player = player
    }

    collect_trick(ids, winning_card_id, number) {
        let winning_card = this.#card_by_id(winning_card_id)
        for (const id of ids) {
            // MOVE CARD FROM TABLE TO TRICKS
            let card = this.#card_by_id(id)
            card.state = Deck.TRICK
            card.trick = number
            card.winner = winning_card.player
        }
    }

    new_game() {
        // MOVE CARDS FROM TRICKS TO STACK
        this.deck.forEach(card => {
            card.state = Deck.STACK
            card.trump = null
            card.stack = 13 * (card.trick - 1) + card.table - 1
            card.hand = null
            card.table = null
            card.player = null
            card.trick = null
            card.winner = null
        })
        localStorage.setItem('deck',JSON.stringify(this.deck))
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
        let stack = this.deck.filter(card => card.state === Deck.STACK)
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
        let cards = this.deck.filter(card => card.state === Deck.HAND && card.color === color && card.hand === player)
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
            if (card.state === Deck.HAND) 
                (hands[card.hand] ??= []).push(this.#id_trump(card))
        return hands
    }

}

Deck.STACK = 'stack'
Deck.HAND = 'hand'
Deck.TABLE = 'table'
Deck.TRICK = 'trick'
Deck.HEARTS = '♥'
Deck.SPADES = '♠'
Deck.DIAMONDS = '♦'
Deck.CLUBS = '♣'
Deck.COLORS = [Deck.HEARTS, Deck.SPADES, Deck.DIAMONDS, Deck.CLUBS]
Deck.VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']

module.exports = Deck
