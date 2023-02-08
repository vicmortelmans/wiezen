let update = true
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
})