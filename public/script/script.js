let update = true
var ws = new WebSocket(ws_URL)
function add_event_listeners (ws){
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
        //Dit is enkel voor debugging. Uitgeschakeld in productie
        if (debug_mode) {
            play_random_card()
        }
    })
    ws.addEventListener('close', function (){
        window.ws = new WebSocket(ws_URL)
        add_event_listeners(window.ws)
        window.ws.addEventListener('open', function(){
            window.ws.send(player_name)
        })
    })
}
ws.addEventListener('open', function(){
    ws.send("")
})
add_event_listeners(ws)
//Dit is enkel voor debugging. Weg in productie
function play_random_card(){
    let first_clickable_card = document.getElementsByClassName("clickable")[0];
    if (first_clickable_card){ws.send(first_clickable_card.dataset['card'])}
}
