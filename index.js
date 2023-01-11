const express = require("express")
const app = express()
const http_port = 3000
const ws_port = 3002
const WebSocketServer = require('ws')
const wss = new WebSocketServer.Server({ port: ws_port })
let clients = []
let aantal = 0
class players {
    name
    constructor(name){
        this.name=name
    }
}





wss.on("connection", ws => {
    clients.push(ws)
    ws.on("message", data => {
        if (data.toString() === "Submit"){
            document.getElementById("input").ariaValueText
            (client => { client.send(ariaValueText) })
        }
        
    })



    ws.on("close", () => {
        clients = clients.filter(client => ws != client)
    })
    ws.onerror = () => {
        console.log("Some error occurred")
    }
})

console.log(`The Websocket server is runnign on port ${ws_port}`)
app.set("view engine", "pug");

app.get("/", (req, res) => {
res.render("home");
})

app.use(express.static("public"))

app.listen(http_port, () => {
console.log(`Example app listening on port ${http_port}`)
})
