'use strict'

const State = require('./state-c4.js')

/** Class representing the game. */
class Game_C4 {

  ai_player
  players
  trump
  min_max

  constructor(ai_player, players, trump, min_max)  {
    this.ai_player = ai_player
    this.players = players
    this.trump = trump
    this.min_max = min_max  // 1 if playing for most tricks, -1 if playing for least (0) tricks
  }

  /** Generate and return the initial game state. */
  start(player, ai_player_hand, other_players_cards) {
    let playHistory = []
    let cards_on_table = []
    let tricks_per_player = {}
    players.forEach(player => tricks_per_player[player] = 0)
    return new State(playHistory, player, ai_player_hand, other_players_cards, cards_on_table, tricks_per_player)
  }

  /** Return the current player's legal plays from given state. */
  legalPlays(state) {
    let legalPlays = []
    let cardsToPickFrom = []
    if (state.player === this.ai_player) {
      cardsToPickFrom = state.ai_player_hand
    }
    else {
      cardsToPickFrom = state.other_players_cards
    }
    if (state.cards_on_table.length > 0 && state.cards_on_table.length < 4) {
      // only cards with same color as opening card are playable
      // if there are none, any card is playable
      let trickColor = state.cards_on_table[0][0]  // first character of first card
      legalPlays = cardsToPickFrom.filter(card => card.startsWith(trickColor))
      if (legalPlays.length === 0) {
        // no cards with same color, so all cards are playable
        legalPlays = [...cardsToPickFrom]
      }
    }
    else {
      // all cards are playable
      legalPlays = [...cardsToPickFrom]
    }

    return legalPlays
  }

  /** Advance the given state and return it. */
  nextState(state, play) {
    // playHistory => add played card
    let newHistory = [...state.playHistory, play]
    // player => next player or if trick is done winning player (see further on)
    let player = player_after(state.player, this.players)
    // ai_player_hand => if ai_player played, remove played card
    let ai_player_hand = state.ai_player_hand
    if (state.player === this.ai_player)
      ai_player_hand = state.ai_player_hand.filter(card => card !== play)
    // other_players_cards => if other player played, remove played card
    let other_players_cards = state.other_players_cards
    if (state.player !== this.ai_player)
      other_players_cards = state.other_players_cards.filter(card => card !== play)
    // cards_on_table => add played card or if trick is done, remove all cards (see further on)
    let cards_on_table = [...state.cards_on_table, play]
    // tricks_per_player
    let tricks_per_player = structuredClone(state.tricks_per_player)
    // special cases for full trick
    if (state.cards_on_table.length === 3) {
      // this is the fourth card
      let first_card = state.cards_on_table[0]
      let card_player = player
      let winning_player = null
      let winning_card_rate = 0
      for (const card of [...state.cards_on_table, play]) {
        let card_rate = rate_card(card, first_card, this.trump)
        if (card_rate > winning_card_rate) {
          winning_player = card_player
          winning_card_rate = card_rate
        }
        card_player = player_after(card_player, this.players)
      }
      tricks_per_player[winning_player]++
      player = winning_player
      cards_on_table = []
    }
    return new State(newHistory, player, ai_player_hand, other_players_cards, cards_on_table, tricks_per_player)
  }

  /** Return the winner of the game. */
  winner(state) {
    if (state.ai_player_hand.length === 0 && state.other_players_cards.length === 0) {
      // game is done
      let winning_player = null
      let winning_tricks = 0
      for (const player in this.players) {
        if (state.tricks_per_player[player] * this.min_max > winning_tricks) {
          winning_tricks = state.tricks_per_player[player]
          winning_player = player
        }
      }
      return winning_player
    }
    else {
      // game is not done
      return null
    }
  }
}


function player_after(player, original_players) {
  let players = [...original_players]
  if (players.includes(first_player))
    while (players[0] != first_player) {
        players.push(players.shift())
    }
  else
    console.error(`ERROR player ${player} not in list of players ${original_players}`)
  return players[1]
}

function rate_card(card, first_card, trump) {
  const rates = {'A': 12, '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, '10': 8, 'J': 9, 'Q': 10, 'K': 11}
  let rate = 0
  if ('*' in card) {
    card = card.slice(0, -1)
  }
  if (trump === card[0]) {
    rate += 13
    rate += rates[card.substring(1)]
  }
  else if (card[0] === first_card[0]) {
    rate += rates[card.substring(1)]
  }
  return rate
}

module.exports = Game_C4
