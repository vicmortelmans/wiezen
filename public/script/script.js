document.getElementById("Knop").addEventListener("click", () => {
    naam = (document.getElementById("input").value)
    ws.send(naam)
})

ws.addEventListener('message', function (event){
    console.log("message reveived" + event.data)
    message = JSON.parse(event.data)
    document.getElementById(message.id).innerHTML = message.htmlFragment
})