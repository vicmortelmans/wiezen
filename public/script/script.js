document.getElementById("Knop").addEventListener("click", () => {
    ws.send("Submit")
})

ws.addEventListener('message', function (event){
    if(event.data=== ariaValueText){
        document.getElementById("naam").innerHTML
    }
})