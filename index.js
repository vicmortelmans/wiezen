const express = require("express")
const app = express()
const Wiezen = require("./wiezen")
const http_port = process.env.CODE_SERVER_PORT_HTTP || 3000
const ws_port = process.env.CODE_SERVER_PORT_WS || 3001
const server_mode = process.env.CODE_SERVER_MODE || 'DEPLOY'
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
    constructor(ws) {
        this.ws = ws
    }
    set_state(state) {
        this.state = state
        let message = {}
        message.htmlFragment = pug.renderFile("views/aanmelden.pug")
        message.id = "content"
        this.ws.send(JSON.stringify(message))
    }
    set_pub(pub) {
        this.pub = pub
    }
    set_table(table) {
        this.table = table
    }
    set_name(name) {
        this.name = name
        pub.register(this)
    }
    update_waiting_players(waiting_players) {
        let message = {}
        message.htmlFragment = pug.renderFile("views/wachtend.pug", {
            aantal: waiting_players.length,
            naam: this.name,
            clients: waiting_players.filter(p => p.naam)
        })
        message.id = "content"
        this.ws.send(JSON.stringify(message))
    }
    update_bid_request(bidding_state, score, players) {
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
            cards: bidding_state.hands[this.name].map(c => {
                let c2 = c.replace("*", "")
                return { unicode: cardsLookup[c2], card: c }
            })
        })
        message.id = "content"
        this.ws.send(JSON.stringify(message))

    }
    bid(bid) {
        this.table.bid(bid)
    }
    update_play_request(play_state, players) {
        let playerNames = players.map(p => p.name)
        let message = {}
        message.htmlFragment = pug.renderFile("views/spelend.pug", {
            speler1: playerNames[0],
            speler2: playerNames[1],
            speler3: playerNames[2],
            cards: play_state.hands[this.name].map(c => {
                let clickable = false
                let c2 = c.replace("*", "")
                if (play_state.playable_cards.includes(c)) {
                    clickable = true
                }
                return { unicode: cardsLookup[c2], clickable, card: c }
            }),
            cards_on_table: play_state.cards_on_table.map(c => {
                let c2 = c.replace("*", "")
                return { unicode: cardsLookup[c2]}
            }),
            trump: play_state.trump,
            player_turn: play_state.player,
            

        })
        message.id = "content"
        this.ws.send(JSON.stringify(message))

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
        else if (this.state === PLAYING){
            this.table.remove_player(this)
        }
    }
    back_to_pub(){
        this.pub.back_to_pub(this)
    }
}
class Pub {
    registering_players
    waiting_players
    constructor() {
        this.registering_players = []
        this.waiting_players = []
    }
    add_player(player) {
        this.registering_players.push(player)
        player.set_state(REGISTERING)
        player.set_pub(this)
    }
    register(player) {
        this.registering_players = this.registering_players.filter(p => player != p)
        let i = 1
        while (true) {
            if (this.registering_players.map(p => p.name).includes(player.name)) {
                player.name = player.name + str(i)
            }
            else {
                break
            }

        }
        this.waiting_players.push(player)
        player.set_state(WAITING)
        if (this.waiting_players.length < 4) {
            for (let w of this.waiting_players) {
                w.update_waiting_players(this.waiting_players)
            }
        }
        else {
            let table = new Table(this.waiting_players)
            this.waiting_players = []
            table.start_game()
        }
    }
    remove_registering_player(player){
        this.registering_players = this.registering_players.filter(p => player != p)
    }
    remove_waiting_player(player){
        this.waiting_players = this.waiting_players.filter(p => player != p)
    }
    back_to_pub(player){
        this.waiting_players.push(player)
        player.set_state(WAITING)
        if (this.waiting_players.length < 4) {
            for (let w of this.waiting_players) {
                w.update_waiting_players(this.waiting_players)
            }
        }
        else {
            let table = new table(this.waiting_players)
            this.waiting_players = []
            table.start_game()
        }
    }
}
class Table {
    players
    wiezen
    bidding_state
    play_state
    score
    constructor(players) {
        this.players = players
        this.wiezen = new Wiezen(this.players.map(p => p.name))
        this.score = {score:{}, old_cumulative_score:{}, new_cumulative_score:{}}
        for (let p of players){
            this.score.score[p.name] = 0
            this.score.old_cumulative_score[p.name] = 0
            this.score.new_cumulative_score[p.name] = 0
        }
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
        this.bidding_state = this.wiezen.bid(bid)
        this.bidding_state = this.wiezen.bid_request(this.bidding_state)
        if (this.bidding_state.players_bidding.length > 0) {
            for (let p of this.players) {
                p.update_bid_request(this.bidding_state, this.score, this.players)// TO DO: IMPLEMENT SCORE!!!
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
        this.play_state = this.wiezen.play_request(this.play_state)
        console.log(JSON.stringify(this.play_state, null, 2)+"\n\n")
        if (!this.play_state.game_done) {
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
            p.back_to_pub()
        }
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
    let player = new Player(ws)
    pub.add_player(player)
    ws.on("message", data => {
        if (player.state === REGISTERING) {
            let name = data.toString().trim()
            player.set_name(name)
        }
        else if (player.state === BIDDING) {
            let bid = data.toString().trim()
            player.bid(bid)
        }
        else if (player.state === PLAYING) {
            let card = data.toString().trim()
            player.play(card)
        }
    })
    ws.on("close", () => {
        player.quit()
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
        ws_port: ws_port
    });
})

app.use(express.static("public"))

app.listen(http_port, host, () => {
    console.log(`Example app listening on port ${http_port}`)
})