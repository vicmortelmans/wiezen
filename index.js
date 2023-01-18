const express = require("express")
const app = express()
const http_port = process.env.CODE_SERVER_PORT_HTTP || 3000
const ws_port = process.env.CODE_SERVER_PORT_WS || 3002
const server_mode = process.env.CODE_SERVER_MODE || 'DEBUG'
const WebSocketServer = require('ws')
const wss = new WebSocketServer.Server({ port: ws_port })
const pug = require("pug")
let clients = []
let aantal = 0 
class Player {
    ws
    naam
    status
    constructor(ws){
        this.ws=ws
        this.status = "aanmeldend"
    }
}

wss.on("connection", ws => {
    let player = new Player(ws)
    clients.push(player)
    message = {} 
    message.htmlFragment= pug.renderFile("views/aanmelden.pug", {aantal: aantal})
    message.id= "content"
    ws.send(JSON.stringify(message))
    ws.on("message", data => {
        aantal= aantal+1
        player.naam= data
        player.status= "wachtend"
    })

    ws.on("close", () => {
        for(const [key, value] of Object.entries(clients)) {
            if (ws === value){
                aantal= aantal-1
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
        ws_port_suffix: server_mode === 'DEBUG' ? '/proxy/' : ':',
        ws_port: ws_port
    });
})

app.use(express.static("public"))

app.listen(http_port, () => {
console.log(`Example app listening on port ${http_port}`)
})