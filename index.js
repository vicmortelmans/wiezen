const express = require("express")
const app = express()
const http_port = process.env.CODE_SERVER_PORT_HTTP || 3000
const ws_port = process.env.CODE_SERVER_PORT_WS || 3001
const server_mode = process.env.CODE_SERVER_MODE || 'DEPLOY'
const host = '127.0.0.1'
const pug = require("pug")
const WACHTEND = "wachtend"
const AANMELDEND = "aanmeldend"
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
wss.on("connection", ws => {
    let player = new Player(ws)
    clients.push(player)
    let message = {}
    message.htmlFragment = pug.renderFile("views/aanmelden.pug", { aantal: aantal })
    message.id = "content"
    ws.send(JSON.stringify(message))
    ws.on("message", data => {
        aantal = aantal + 1
        player.naam = data
        player.status = WACHTEND
        for (const p of clients) {
            let message = {}
            if (p.status === WACHTEND) {
                message.htmlFragment = pug.renderFile("views/wachtend.pug", {
                    aantal: aantal,
                    naam: p.naam,
                    clients: clients
                })
            }
            else if (p.status === AANMELDEND) {
                message.htmlFragment = pug.renderFile("views/aanmelden.pug", {
                    aantal: aantal
                })
            }
            message.id = "content"
            p.ws.send(JSON.stringify(message))
        }
    })

    ws.on("close", () => {
        for (const [key, value] of Object.entries(clients)) {
            if (ws === value) {
                aantal = aantal - 1
                delete clients[key]
            }
        }
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