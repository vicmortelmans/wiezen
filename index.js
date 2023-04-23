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
const cardsLookup = {'♥A': '🂱', '♥2': '🂲', '♥3' :'🂳', '♥4': '🂴', '♥5':'🂵', '♥6':'🂶', '♥7': '🂷', '♥8': '🂸', '♥9': '🂹', '♥10':'🂺', '♥J':'🂻', '♥Q': '🂽', '♥K': '🂾',
'♦A': '🃁', '♦2': '🃂', '♦3' :'🃃', '♦4': '🃄', '♦5':'🃅', '♦6':'🃆', '♦7': '🃇', '♦8': '🃈', '♦9': '🃉', '♦10':'🃊', '♦J':'🃋', '♦Q': '🃍', '♦K': '🃎', 
'♠A': '🂡', '♠2': '🂢', '♠3' :'🂣', '♠4': '🂤', '♠5':'🂥', '♠6':'🂦', '♠7': '🂧', '♠8': '🂨', '♠9': '🂩', '♠10':'🂪', '♠J':'🂫', '♠Q': '🂭', '♠K': '🂮',
'♣A': '🃑', '♣2': '🃒', '♣3' :'🃓', '♣4': '🃔', '♣5':'🃕', '♣6':'🃖', '♣7': '🃗', '♣8': '🃘', '♣9': '🃙', '♣10':'🃚', '♣J':'🃛', '♣Q': '🃝', '♣K': '🃞'}
let wiezen = {}
let clients = []
let aantal = 0
let bidding_state = {}
let playerNames = []
let play_state = {}
class Player {
    ws
    name
    state
    pub
    table
    constructor(ws) {
        this.ws = ws
    }
    set_state (state){
        this.state = state
        let message = {}
        message.htmlFragment = pug.renderFile("views/aanmelden.pug")
        message.id = "content"
        this.ws.send(JSON.stringify(message))
    }
    set_pub (pub){
        this.pub = pub
    }
    set_table (table){
        this.table = table
    }
    set_name (name){
        this.name = name
        pub.register(this)
    }
    update_waiting_players (waiting_players){
        let message = {}
        message.htmlFragment = pug.renderFile("views/wachtend.pug", {
            aantal: waiting_players.length,
            naam: this.name,
            clients: waiting_players.filter(p => p.naam)
        })
        message.id = "content"
        this.ws.send(JSON.stringify(message))
    }
    update_bid_request (bidding_state, score, players){
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
            bidopties: bidopties
        })
        message.id = "content"
        this.ws.send(JSON.stringify(message))
        
    }
    bid (bid){
        this.table.bid(bid)
    }
    update_play_request (play_request, players){
        let playerNames = players.map(p => p.name)
        let message = {}
        message.htmlFragment = pug.renderFile("views/spelend.pug", {
            speler1: playerNames[0],
            speler2: playerNames[1],
            speler3: playerNames[2],
            cards: play_state.hands[p.naam].map(c=> {
                let clickable= false
                let c2 = c.replace("*", "")
                if (play_state.playable_cards.includes(c)){
                    clickable = true
                }
                return {unicode: cardsLookup[c2], clickable, card: c}
            })
        })
        message.id = "content"
        this.ws.send(JSON.stringify(message))
        
    }
    play (card){
        this.table.play(card) 
    }
}
class pub{
    registering_players
    waiting_players
    constructor (){
        this.registering_players = []
        this.waiting_players = []
    }
    add_player (player){
        this.registering_players.push(player)
        player.set_state(REGISTERING)
        player.set_pub(this)
    }
    register (player){
        this.registering_players = this.registering_players.filter(p => player != p)
        let i = 1
        while(true){
            if (this.registering_players.map ( p => p.name).includes(player.name)){
                player.name = player.name + str(i)
            }
            else {
                break
            }
            
        }
        this.waiting_players.push(player)
        player.set_state(WAITING)
        if (this.waiting_players.length < 4){
            for (w of this.waiting_players){
                w.update_waiting_players(this.waiting_players)
            }
        }
        else {
            table = new table(this.waiting_players)
            this.waiting_players = []
            table.start_game()
        }
    }
}
class table{
    players
    wiezen
    bidding_state
    play_state
    score
    constructor(players){
        this.players = players
        this.wiezen = new Wiezen(this.players.map (p => p.name))
    }
    start_game(){
        this.wiezen.cut()
        this.wiezen.deal()
        this.bidding_state = this.wiezen.initialize_bid()
        this.bidding_state = this.wiezen.bid_request(this.bidding_state)
        for (p of this.players){
            p.set_state(BIDDING)
            p.set_table(this)
            p.update_bid_request(this.bid_request, {}, this.players)//TO DO : IMPLEMENT SCORE!!!
        }
    }
    bid (bid){
        this.bidding_state = this.wiezen.bid(bid)
        this.bidding_state = this.wiezen.bid_request(this.bidding_state)
        if (this.bidding_state.players_bidding.length > 0){
            for (p in this.players){
                p.update_bid_request(this.bid_request, {}, this.players)// TO DO: IMPLEMENT SCORE!!!
            }
        }
        else {
            this.play_state = this.wiezen.initialize_play()
        }
        if (this.play_state.game_playable){
            this.play_state = this.wiezen.play_request(this.play_state)
            for ( p in this.players){
                p.set_state(PLAYING)
                p.update_play_request(this.play_state, this.players )
            }
        }
        else {
            this.wiezen.new_game()
            this.start_game()
        }
    }
    play (card){
        this.play_state = this.wiezen.play(card)
        this.play_state = this.wiezen.play_request(this.play_state)
        if (!this.play_state.game_done){
            for (p in this.players){
                p.update_play_request(this.play_state, this.players)
            }
        }
        else {
            this.score = this.wiezen.calculate_score()
            this.wiezen.new_game()
            this.start_game()
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
function scherm_sturen() {
    for (const p of clients) {
        let message = {}
        if (p.status === WACHTEND) {
            message.htmlFragment = pug.renderFile("views/wachtend.pug", {
                aantal: aantal,
                naam: p.naam,
                clients: clients.filter(p => p.naam)
            })
        }
        else if (p.status === AANMELDEND) {
            message.htmlFragment = pug.renderFile("views/aanmelden.pug", {
            })
        }
        else if (p.status === BIEDEND) {
            let scoreFactor
            if (bidding_state.score_factor === undefined) {
                scoreFactor = 1
            }
            else {
                scoreFactor = bidding_state.score_factor
            }
            let bidopties = []
            if (bidding_state.player === p.naam) {
                bidopties = bidding_state.games_open_mee
            }
            message.htmlFragment = pug.renderFile("views/starten.pug", {
                scoreFactor: scoreFactor,
                speler1: playerNames[0],
                speler2: playerNames[1],
                speler3: playerNames[2],
                speler4: playerNames[3],
                bidopties: bidopties
            })
        }
        else if (p.status === GEKICKT) {
            message.htmlFragment = pug.renderFile("views/gekick.pug")
        }
        else if (p.status === SPELEND){
            playerNamesSpelend = rotate_players(p.naam, playerNames )
            message.htmlFragment = pug.renderFile("views/spelend.pug", {
                speler1: playerNamesSpelend[1],
                speler2: playerNamesSpelend[2],
                speler3: playerNamesSpelend[3],
                cards: play_state.hands[p.naam].map(c=> {
                    let clickable= false
                    let c2 = c.replace("*", "")
                    if (play_state.playable_cards.includes(c)){
                        clickable = true
                    }
                    return {unicode: cardsLookup[c2], clickable, card: c}
                })
            })
        }
        message.id = "content"
        p.ws.send(JSON.stringify(message))
    }
}
function message_player_giving_name(player, data, ws) {
    if (aantal === 4) {
        player.status = GEKICKT
        scherm_sturen()
        return
    }
    let naam = data.toString().trim()
    if (naam === "") {
        let message = {}
        message.htmlFragment = pug.renderFile("views/aanmelden.pug", {
            aantal: aantal,
            message: "Er is geen naam ingevoerd."
        })
        message.id = "content"
        ws.send(JSON.stringify(message))
        return
    }
    let i
    for (i in clients) {
        if (naam === clients[i].naam) {
            //foutmelding geven
            let message = {}
            message.htmlFragment = pug.renderFile("views/aanmelden.pug", {
                aantal: aantal,
                message: "Deze naam is al in gebruik."
            })
            message.id = "content"
            ws.send(JSON.stringify(message))
            return
        }
    }
    aantal = aantal + 1
    player.naam = naam
    if (aantal === 4) {
        for (let p of clients) {
            if (p.status === WACHTEND) {
                p.status = BIEDEND
            }
            if (p.status === AANMELDEND) {
                p.status = GEKICKT
            }
        }
        player.status = BIEDEND //This is the 4th player with status AANMELDEND before
        global_status = SPEL_BIEDEND
        playerNames = []
        for (let p of clients) {
            if (p.status === BIEDEND) {
                playerNames.push(p.naam)
            }
        }
        wiezen = new Wiezen(playerNames)
        wiezen.cut()
        wiezen.deal()
        bidding_state = wiezen.initialize_bid()
        bidding_state = wiezen.bid_request(bidding_state)

    }
    else if (aantal < 4) {
        player.status = WACHTEND
    }
    scherm_sturen()
}
const pub = new Pub()
wss.on("connection", ws => {
    let player = new Player(ws)
    pub.add_player(player)
    ws.on("message", data => {
        if (player.state === REGISTERING) {
            let name = data.toString().trim()
            player.set_name (name)
        }
        else if (player_state === BIDDING){
            let bid = data.toString().trim()
            player.bid(bid)
        }
        else if (player_state === PLAYING){
            let card = data.toString().trim()
            player.play(card)
        }
        else if (global_status === SPEL_BIEDEND) {
            let messageFromBiddingPlayer = true
            for (i in clients) {
                if (clients[i].status != BIEDEND) {
                    message = {}
                    message.htmlFragment = pug.renderFile("views/gekick.pug")
                    message.id = "content"
                    clients[i].ws.send(JSON.stringify(message))
                    if (clients[i].ws === ws) {
                        messageFromBiddingPlayer = false
                    }
                }
            }
            if (messageFromBiddingPlayer) {
                bidding_state = wiezen.bid(data.toString())
                if(bidding_state.players_bidding.length === 0){
                    play_state = wiezen.initialize_play(bidding_state)
                    play_state = wiezen.play_request(play_state)
                    global_status = SPEL_SPELEND
                    for(let p of clients){
                        p.status = SPELEND
                    }
                    
                }
                else{
                bidding_state = wiezen.bid_request(bidding_state)
                }
                scherm_sturen()
            }
        }
    })


    ws.on("close", () => {
        let i
        for (i in clients) {
            if (ws === clients[i].ws) {
                if (clients[i].status === WACHTEND) {
                    aantal = aantal - 1
                }
                else if (clients[i].status === BIEDEND) {
                    aantal = aantal - 1
                    let j
                    for (j in clients) {
                        if (clients[j].status === BIEDEND) {
                            clients[j].status = WACHTEND
                        }
                        else if (clients[j].status === GEKICKT) {
                            clients[j].status = AANMELDEND
                        }
                    }
                }
                break
            }
        }
        delete clients[i]
        clients = clients.filter(x => x) //remove empty slots
        scherm_sturen()
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