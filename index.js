const express = require("express")
const app = express()
const { v4: uuidv4 } = require('uuid')
const Wiezen = require("./wiezen")
const util = require('util')
const Game_C4 = require('mcts/game-c4.js')
const MonteCarlo = require('mcts/monte-carlo.js')
console.log(`Debug mode is: ${!!process.env.PORT}`)
const debug_mode = !!process.env.PORT  // this variable is set in package.json when 'npm run debug'
                                       // ASSERT that this variable is not set on production user account!
const http_port = debug_mode ? 3010 : 3000
const ws_port = debug_mode ? 3011 : 3001
const host = '127.0.0.1'
const pug = require("pug")
const WAITING = "waiting"
const REGISTERING = "registering"
const BIDDING = "bidding"
const PLAYING = "playing"
const cardsLookup = {
    '♥A': '🂱', '♥2': '🂲', '♥3': '🂳', '♥4': '🂴', '♥5': '🂵', '♥6': '🂶', '♥7': '🂷', '♥8': '🂸', '♥9': '🂹', '♥10': '🂺', '♥J': '🂻', '♥Q': '🂽', '♥K': '🂾',
    '♦A': '🃁', '♦2': '🃂', '♦3': '🃃', '♦4': '🃄', '♦5': '🃅', '♦6': '🃆', '♦7': '🃇', '♦8': '🃈', '♦9': '🃉', '♦10': '🃊', '♦J': '🃋', '♦Q': '🃍', '♦K': '🃎',
    '♠A': '🂡', '♠2': '🂢', '♠3': '🂣', '♠4': '🂤', '♠5': '🂥', '♠6': '🂦', '♠7': '🂧', '♠8': '🂨', '♠9': '🂩', '♠10': '🂪', '♠J': '🂫', '♠Q': '🂭', '♠K': '🂮',
    '♣A': '🃑', '♣2': '🃒', '♣3': '🃓', '♣4': '🃔', '♣5': '🃕', '♣6': '🃖', '♣7': '🃗', '♣8': '🃘', '♣9': '🃙', '♣10': '🃚', '♣J': '🃛', '♣Q': '🃝', '♣K': '🃞'
}
class Player {
    ws
    name
    state
    pub
    table
    table_name
    screen
    constructor(ws) {
        this.ws = ws
    }
    set_state(state) {
        this.state = state
    }
    set_pub(pub) {
        this.pub = pub
    }
    set_table(table) {
        this.table = table
    }
    register(name, table_name) {
        this.name = name
        this.table_name = table_name
        pub.register(this)
    }
    update_registering_player(){
        let message = {}
        message.htmlFragment = pug.renderFile("views/aanmelden.pug")
        message.id = "content"
        this.ws.send(JSON.stringify(message))
        console.log(`WS.SEND ${this.name} AANMELDEN`) 
        console.log(`List registering players: ${this.pub.registering_players.map(p => p.name)}`)
        console.log(`List waiting players: ${this.pub.waiting_players.map(p => p.name)}`)
        console.log(`List playing players: ${this.pub.playing_players.map(p => p.name)}`)
        this.screen = message
    }
    update_waiting_players(waiting_players, ex_player) {
        let message = {}
        message.htmlFragment = pug.renderFile("views/wachtend.pug", {
            aantal: waiting_players.length,
            name: this.name,
            alert: ex_player ?  `Speler ${ex_player.name} heeft het spel verlaten` : ``,
            table_name: this.table_name,
        })
        message.id = "content"
        this.ws.send(JSON.stringify(message))
        console.log(`WS.SEND ${this.name} WACHTEND`)
        console.log(`List registering players: ${this.pub.registering_players.map(p => p.name)}`)
        console.log(`List waiting players: ${this.pub.waiting_players.map(p => p.name)}`)
        console.log(`List playing players: ${this.pub.playing_players.map(p => p.name)}`)
        this.screen = message
    }
    update_bid_request(bidding_state, score, players, play_state) {
        let playerNames = players.map(p => p.name)
        let message = {}
        let scoreFactor
        if (bidding_state.score_factor === undefined) {
            scoreFactor = 1
        }
        else {
            scoreFactor = bidding_state.score_factor
        }
        let bidopties = []
        if (bidding_state.player === this.name) {
            bidopties = bidding_state.games_open_mee
        }
        message.htmlFragment = pug.renderFile("views/starten.pug", {
            scoreFactor: scoreFactor,
            speler1: playerNames[0],
            speler2: playerNames[1],
            speler3: playerNames[2],
            speler4: playerNames[3],
            bidopties: bidopties,
            score : score,
            trump: bidding_state.trump,
            highest_bid: bidding_state.game,
            players_with_highest_bid: bidding_state.game_players,
            cards: bidding_state.hands[this.name].map(c => {
                let c2 = c.replace("*", "")
                return { unicode: cardsLookup[c2], card: c, color: (c.startsWith("♥") || c.startsWith("♦")) ?"red": "black"}
            }),
            uid: this.table.uid
        })
        message.id = "content"
        this.ws.send(JSON.stringify(message))
        console.log(`WS.SEND ${this.name} STARTEN`)
        console.log(`List registering players: ${this.pub.registering_players.map(p => p.name)}`)
        console.log(`List waiting players: ${this.pub.waiting_players.map(p => p.name)}`)
        console.log(`List playing players: ${this.pub.playing_players.map(p => p.name)}`)
        this.screen = message
    }
    bid(bid) {
        this.table.bid(bid)
    }
    update_play_request(play_state, players) {
        let playerNames = players.map(p => p.name)
        let message = {}
        let next_players = rotate_players(this.name, playerNames)
        let cards 
        if (this.name in play_state.hands){ 
            cards = play_state.hands[this.name].map(c => {
                let clickable = false
                let c2 = c.replace("*", "")
                if (play_state.playable_cards.includes(c)) {
                    clickable = true
                }
                return { unicode: cardsLookup[c2], clickable, card: c, color: (c.startsWith("♥") || c.startsWith("♦")) ?"red": "black" }
            })
        }
        else{
            cards = []
        }
        message.htmlFragment = pug.renderFile("views/spelend.pug", {
            speler1: next_players[1],
            speler2: next_players[2],
            speler3: next_players[3],
            speler0: next_players[0],
            cards,
            cards_on_table: play_state.cards_on_table.map(c => {
                let c2 = c.replace("*", "")
                return { unicode: cardsLookup[c2], color: (c.startsWith("♥") || c.startsWith("♦")) ?"red": "black"}
            }),
            trump: play_state.trump,
            player_turn: play_state.player,
            highest_bid: play_state.game,
            players_with_highest_bid: play_state.game_players,
            tricks: play_state.tricks_per_player
        })
        message.id = "content"
        this.ws.send(JSON.stringify(message))
        console.log(`WS.SEND ${this.name} SPELEND`)
        console.log(`List registering players: ${this.pub.registering_players.map(p => p.name)}`)
        console.log(`List waiting players: ${this.pub.waiting_players.map(p => p.name)}`)
        console.log(`List playing players: ${this.pub.playing_players.map(p => p.name)}`)
        this.screen = message
    }
    play(card) {
        this.table.play(card)
    }
    quit(){
        if(this.state === REGISTERING){
            this.pub.remove_registering_player(this)
        }
        else if (this.state === WAITING){
            this.pub.remove_waiting_player(this)
        }
        else if (this.state === BIDDING){
            this.table.remove_player(this)
        }
        else if (this.state === PLAYING){
            this.table.remove_player(this)
        }
    }
    back_to_pub(ex_player){
        this.pub.back_to_pub(this, ex_player)
    }
    refresh_screen(){
        this.ws.send(JSON.stringify(this.screen))
        console.log(`WS.SEND ${this.name} STARTEN`) 
    }
}
class MCTS_Player {
    ws
    name
    state
    pub
    table
    screen
    constructor(ws) {
        // TODO MCTS_Player has no ws
        this.ws = ws
        
        // initialize Monte Carlo Tree Search
        let game = new Game_C4(ai_player, players, trump, min_max)
        let mcts = new MonteCarlo(game)

        let state = game.start()
        let winner = game.winner(state)
    }
    set_state(state) {
        this.state = state
    }
    set_pub(pub) {
        this.pub = pub
    }
    set_table(table) {
        this.table = table
    }
    set_name(name) {
        // MCTS_Player doesn't receive calls from client 
    }
    update_registering_player(){
        // TODO MCTS_Player should set name and call pub.register(this) when receiving this call 
        pub.register("Jean")
    }
    update_waiting_players(waiting_players) {
        // MCTS_Player nothing to do here
    }
    update_bid_request(bidding_state, score, players, play_state) {
        let bidopties = []
        if (bidding_state.player === this.name) {
            bidopties = bidding_state.games_open_mee
        }
        // TODO MCTS_Player if it's his turn, should call this.table.bid(bid) with bid from bidopties
        if (bidding_state.player === this.name)
            this.table.bid('pas')
    }
    bid(bid) {
        // MCTS_Player doesn't receive calls from client 
    }
    update_play_request(play_state, players) {
        // TODO MCTS_Player if it's his turn, should call this.table.play(card) with card from play_state.playable_cards
    }
    play(card) {
        // MCTS_Player doesn't receive calls from client 
    }
    quit(){
        // MCTS_Player doesn't quit
    }
    back_to_pub(){
        // MCTS_Player just vanishes
    }
    refresh_screen(){
        // MCTS_Player has no screen
    }
}
class Pub {
    registering_players
    waiting_players
    playing_players
    constructor() {
        this.registering_players = []
        this.waiting_players = []
        this.playing_players = []
    }
    add_player(player) {
        this.registering_players.push(player)
        player.set_state(REGISTERING)
        player.set_pub(this)
        player.update_registering_player()
    }
    register(player) {
        this.registering_players = this.registering_players.filter(p => player != p)
        let i = 1
        let original_name = player.name
        while (true) {
            if (this.find_player(player.name)) {
                player.name = original_name + i.toString()
                i++
            }
            else {
                break
            }
        }
        this.waiting_players.push(player)
        player.set_state(WAITING)
        let player_friends = this.waiting_players.filter(function(p){
            return (player.table_name === p.table_name)
        })
        if (player_friends.length < 4) {
            for (let w of player_friends) {
                w.update_waiting_players(player_friends)
            }
        }
        else {
            let table = new Table(player_friends)
            for (let p of player_friends){
                this.playing_players.push(p)
            }
            this.waiting_players = this.waiting_players.filter(function(p){
                return (!player_friends.includes(p))
            })
            table.start_game()
        }
    }
    remove_registering_player(player){
        this.registering_players = this.registering_players.filter(p => player != p)
    }
    remove_waiting_player(player){
        this.waiting_players = this.waiting_players.filter(p => player != p)
    }
    remove_playing_player(player){
        this.playing_players = this.playing_players.filter(p => player !=p )
    }
    back_to_pub(player, ex_player){
        this.waiting_players.push(player)
        this.remove_playing_player(player)
        player.set_state(WAITING)
        if (this.waiting_players.length < 4) {
            for (let w of this.waiting_players) {
                w.update_waiting_players(this.waiting_players, ex_player)
            }
        }
        else {
            let table = new Table(this.waiting_players)
            this.waiting_players = []
            table.start_game()
        }
    }
    find_player (player_name){
        let player = this.waiting_players.find(p => p.name === player_name)
        if (!player){
            player = this.playing_players.find(p => p.name === player_name)
        }
        return player
    }
}
class Table {
    players
    wiezen
    bidding_state
    play_state
    score
    uid
    constructor(players) {
        this.players = players
        this.wiezen = new Wiezen(this.players.map(p => p.name))
        this.score = {score:{}, old_cumulative_score:{}, new_cumulative_score:{}}
        for (let p of players){
            this.score.score[p.name] = 0
            this.score.old_cumulative_score[p.name] = 0
            this.score.new_cumulative_score[p.name] = 0
        }
        this.uid = uuidv4()
    }
    start_game() {
        this.wiezen.cut()
        this.wiezen.deal()
        this.bidding_state = this.wiezen.initialize_bid()
        this.bidding_state = this.wiezen.bid_request(this.bidding_state)
        for (let p of this.players) {
            p.set_state(BIDDING)
            p.set_table(this)
            p.update_bid_request(this.bidding_state, this.score, this.players)//TO DO : IMPLEMENT SCORE!!!
        }
    }
    bid(bid) {
        console.log(`table: ${this.players.map(p => p.name)}`)
        this.bidding_state = this.wiezen.bid(bid)
        this.bidding_state = this.wiezen.bid_request(this.bidding_state)
        if (this.bidding_state.players_bidding.length > 0) {
            for (let p of this.players) {
                p.update_bid_request(this.bidding_state, this.score, this.players, this.play_state)// TO DO: IMPLEMENT SCORE!!!
            }
        }
        else {
            this.play_state = this.wiezen.initialize_play()
            if (this.play_state.game_playable) {
                this.play_state = this.wiezen.play_request(this.play_state)
                    for (let p of this.players) {
                    p.set_state(PLAYING)
                    p.update_play_request(this.play_state, this.players)
                }
            }
            else {
                this.wiezen.new_game()
                this.start_game()
            }
        }
    }
    play(card) {
        this.play_state = this.wiezen.play(card)
        let clear_table_after_displaying_cards = false
        if (this.play_state.cards_on_table.length === 4){
            clear_table_after_displaying_cards = true
            this.play_state= this.wiezen.collect_trick()
        }
        if (!this.play_state.game_done) {
            this.play_state = this.wiezen.play_request(this.play_state)
            for (let p of this.players) {
                p.update_play_request(this.play_state, this.players)
            }
            if (clear_table_after_displaying_cards){
            this.wiezen.clear_table()
            }
        }
        else {
            this.score = this.wiezen.calculate_score()
            this.wiezen.new_game()
            this.start_game()
        }
    }
    remove_player(player){
        let other_players = this.players.filter(p => player != p)
        for (let p of other_players){
            p.back_to_pub(player)
        }
        player.pub.remove_playing_player(player)
    }

}

const WebSocketServer = require('ws')
const wss = new WebSocketServer.Server({
    port: ws_port,
    host: host
})
function rotate_players(first_player, list) {
    // returns a COPY of the array of players (or custom list, if provided) with 'first_player' first
    let list2 = [...list]
    while (list2[0] != first_player) {
        list2.push(list2.shift())
    }
    return list2
}
const pub = new Pub()
wss.on("connection", ws => {
    console.log(`WS CONNECTION`)
    let player = null
    ws.on("message", data => {
        let message = data.toString().trim()
        console.log(`WS RECEIVED data: ${data.toString()} player.name: ${player?.name}`)
        if (!player){
            if (!message){ 
                //New player
                player  = new Player(ws)
                pub.add_player(player)
            }
            else{
                player = pub.find_player(message)
                if (!player){
                    player  = new Player(ws)
                    pub.add_player(player)
                }
                else {
                    //reconnect old player
                    player.ws = ws
                    player.refresh_screen()
                    player.table && console.log(player.table.players.map(p => p.name))
                }
            }
        }
        else if (player.state === REGISTERING) {
            let name = JSON.parse(message).player_name
            let table_name = JSON.parse(message).table_name
            player.register(name, table_name)
        }
        else if (player.state === BIDDING) {
            let bid = message
            player.bid(bid)
        }
        else if (player.state === PLAYING) {
            let card = message
            player.play(card)
        }
    })
    ws.on("close", () => {
        console.log(`WS CLOSED player.name: ${player && player.name}`)
        player && player.quit()

    })
    ws.onerror = () => {
        console.log("Some error occurred")
    }
})

console.log(`The Websocket server is runnign on port ${ws_port}`)
app.set("view engine", "pug");

app.get("/", (req, res) => {
    res.render("home", {
        ws_port_suffix: '/proxy/',
        ws_port: ws_port,
        debug_mode,
    });
})

app.use(express.static("public"))

app.listen(http_port, host, () => {
    console.log(`Example app listening on port ${http_port}`)
})