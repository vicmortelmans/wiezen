const express = require("express")
const app = express()
const http_port = process.env.CODE_SERVER_PORT_HTTP || 3000
const ws_port = process.env.CODE_SERVER_PORT_WS || 3001
const server_mode = process.env.CODE_SERVER_MODE || 'DEPLOY'
const host = '127.0.0.1'
const pug = require("pug")
const WACHTEND = "wachtend"
const AANMELDEND = "aanmeldend"
const SPELEND = "spelend"
const GEKICKT = "gekickt"
const SPEL_AANMELDEND = "spel_aanmelden"
const SPEL_SPELEND = "spelend"
const SPEL_BIEDEND = "biedend"
let clients = []
let aantal = 0
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
function scherm_wachtend_of_aanmeldend_sturen() {
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
        else if (p.status === SPELEND) {
            message.htmlFragment = pug.renderFile("views/starten.pug", {
                clients: clients.filter(p => p.naam)
            })
        }
        else if (p.status === GEKICKT) {
            message.htmlFragment = pug.renderFile("views/gekick.pug")
        }
        message.id = "content"
        p.ws.send(JSON.stringify(message))
    }
}
function message_player_giving_name(player, data, ws){
    if (aantal === 4) {
        player.status = GEKICKT
        scherm_wachtend_of_aanmeldend_sturen()
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
                p.status = SPELEND
            }
            if (p.status === AANMELDEND){
                p.status = GEKICKT
            }
        }
        player.status = SPELEND
        global_status = SPEL_BIEDEND

    }
    else if (aantal < 4) {
        player.status = WACHTEND
    }
    scherm_wachtend_of_aanmeldend_sturen()
}
wss.on("connection", ws => {
    let player = new Player(ws)
    clients.push(player)
    if (aantal === 4) {
        player.status = GEKICKT
        scherm_wachtend_of_aanmeldend_sturen()
        return
    }
    let message = {}
    message.htmlFragment = pug.renderFile("views/aanmelden.pug", { aantal: aantal })
    message.id = "content"
    ws.send(JSON.stringify(message))
    ws.on("message", data => {
        if (global_status = SPEL_AANMELDEND){
            message_player_giving_name(player, data, ws)
        }
        else if (global_status === SPEL_BIEDEND){
            for (i in clients){
                if (clients[i].status === SPELEND){
                    //nieuwe functie
                }
                    else {
                        message = {}
                        message.htmlFragment = pug.renderFile("views/gekick.pug")
                        message.id = "content"
                        p.ws.send(JSON.stringify(message))
                    }
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
                else if (clients[i].status === SPELEND) {
                    aantal = aantal - 1
                    let j
                    for (j in clients) {
                        if (clients[j].status === SPELEND) {
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
        scherm_wachtend_of_aanmeldend_sturen()
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