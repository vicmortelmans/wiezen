let update = true
let ws = new WebSocket(ws_URL)
ws.addEventListener('open', function(){
    ws.send("")
})
ws.addEventListener('message', function (event){
    console.log("message reveived" + event.data)
    message = JSON.parse(event.data)
    //document.getElementById(message.id).innerHTML = message.htmlFragment
    if (update){
        const target = document.getElementById(message.id)
        target.innerHTML = ''  // clear the original content
        const new_content = document.createRange().createContextualFragment(message.htmlFragment);
        target.append(new_content);
    }
    //Dit is enkel voor debugging. Weg in productie
    play_random_card()
})
ws.addEventListener('close', function (){
    ws = new WebSocket(ws_URL)
    ws.addEventListener('open', function(){
        ws.send(player_name)
    })
})
//Dit is enkel voor debugging. Weg in productie
function play_random_card(){
    let first_clickable_card = document.getElementsByClassName("clickable")[0];
    if (first_clickable_card){ws.send(first_clickable_card.dataset['card'])}
}
