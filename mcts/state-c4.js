'use strict'

/** Class representing a game state. */
class State_C4 {

  constructor(playHistory, player, ai_player_hand, other_players_cards, cards_on_table, tricks_per_player) {
    this.playHistory = playHistory
    this.player = player
    this.ai_player_hand = [...ai_player_hand]
    this.other_players_cards = [...other_players_cards]
    this.cards_on_table = [...cards_on_table]
    this.tricks_per_player = tricks_per_player
  }

  isPlayer(player) {
    return (player === this.player)
  }

  hash() {
    return JSON.stringify(this.playHistory)
  }

  // Note: If hash uses board, multiple parents possible
}

module.exports = State_C4
