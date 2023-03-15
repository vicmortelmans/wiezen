const express = require("express")
const app = express()
const Wiezen = require("./wiezen")
const http_port = process.env.CODE_SERVER_PORT_HTTP || 3000
const ws_port = process.env.CODE_SERVER_PORT_WS || 3001
const server_mode = process.env.CODE_SERVER_MODE || 'DEPLOY'
const host = '127.0.0.1'
const pug = require("pug")
const WACHTEND = "wachtend"
const AANMELDEND = "aanmeldend"
const BIEDEND = "biedend"
const GEKICKT = "gekickt"
const SPELEND = "spelend"
const SPEL_AANMELDEND = "spel_aanmelden"
const SPEL_SPELEND = "spelend"
const SPEL_BIEDEND = "biedend"
let wiezen = {}
let clients = []
let aantal = 0
let bidding_state = {}
let playerNames = []
let play_state = {}
class Player {
    ws
    naam
    status
    constructor(ws) {
        this.ws = ws
        this.status = AANMELDEND
    }
}
const WebSocketServer = require('ws')
const wss = new WebSocketServer.Server({
    port: ws_port,
    host: host
})
let global_status = SPEL_AANMELDEND
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
                aantal: aantal
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
wss.on("connection", ws => {
    let player = new Player(ws)
    clients.push(player)
    if (aantal === 4) {
        player.status = GEKICKT
        scherm_sturen()
        return
    }
    let message = {}
    message.htmlFragment = pug.renderFile("views/aanmelden.pug", { aantal: aantal })
    message.id = "content"
    ws.send(JSON.stringify(message))
    ws.on("message", data => {
        if (global_status === SPEL_AANMELDEND) {
            message_player_giving_name(player, data, ws)
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